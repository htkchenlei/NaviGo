import { SETTING_DEFAULTS, SITE_VERSION } from './types'
import type { Link, LinkRow, Module, ModuleRow, NavPayload } from './types'

export async function getNav(db: D1Database): Promise<NavPayload> {
  // 一次性取全量：导航页每次打开只有 1 次 API 往返，避免 N+1
  const [moduleResult, linkResult, settingResult] = await db.batch([
    db.prepare('SELECT id, name, color, sort_order FROM modules ORDER BY sort_order ASC, id ASC'),
    db.prepare(
      `SELECT id, module_id, name, icon_url, url_lan, url_vpn, url_wan, sort_order
       FROM links ORDER BY module_id ASC, sort_order ASC, id ASC`,
    ),
    db.prepare('SELECT key, value FROM settings'),
  ])

  const settings: Record<string, string> = { ...SETTING_DEFAULTS }
  for (const row of (settingResult.results ?? []) as { key: string; value: string }[]) {
    settings[row.key] = row.value
  }

  const modules: Module[] = ((moduleResult.results ?? []) as ModuleRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    links: [],
  }))
  const index = new Map(modules.map((module) => [module.id, module]))

  for (const row of (linkResult.results ?? []) as LinkRow[]) {
    const target = index.get(row.module_id)
    if (!target) continue
    target.links.push(mapLink(row))
  }

  return { modules, settings, version: SITE_VERSION }
}

function mapLink(row: LinkRow): Link {
  return {
    id: row.id,
    moduleId: row.module_id,
    name: row.name,
    iconUrl: row.icon_url,
    urlLan: row.url_lan,
    urlVpn: row.url_vpn,
    urlWan: row.url_wan,
  }
}

/* ── 模块 ────────────────────────────────────────────────────────── */

export async function createModule(db: D1Database, name: string, color: string): Promise<number> {
  const row = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM modules')
    .first<{ m: number }>()
  const next = (row?.m ?? -1) + 1
  const result = await db
    .prepare('INSERT INTO modules (name, color, sort_order) VALUES (?, ?, ?)')
    .bind(name, color, next)
    .run()
  return Number(result.meta.last_row_id ?? 0)
}

export async function updateModule(
  db: D1Database,
  id: number,
  patch: { name?: string; color?: string },
): Promise<boolean> {
  const sets: string[] = []
  const values: (string | number)[] = []
  if (patch.name !== undefined) {
    sets.push('name = ?')
    values.push(patch.name)
  }
  if (patch.color !== undefined) {
    sets.push('color = ?')
    values.push(patch.color)
  }
  if (sets.length === 0) return true
  values.push(id)
  const result = await db
    .prepare(`UPDATE modules SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()
  return (result.meta.changes ?? 0) > 0
}

/** 删模块必须连同它的链接一起删，否则残留孤儿数据会污染下一次导入导出 */
export async function deleteModule(db: D1Database, id: number): Promise<boolean> {
  const results = await db.batch([
    db.prepare('DELETE FROM links WHERE module_id = ?').bind(id),
    db.prepare('DELETE FROM modules WHERE id = ?').bind(id),
  ])
  return (results[1]?.meta.changes ?? 0) > 0
}

/* ── 链接 ────────────────────────────────────────────────────────── */

export interface LinkInput {
  name: string
  iconUrl: string | null
  urlLan: string | null
  urlVpn: string | null
  urlWan: string | null
}

export async function createLink(db: D1Database, moduleId: number, input: LinkInput): Promise<number> {
  const row = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM links WHERE module_id = ?')
    .bind(moduleId)
    .first<{ m: number }>()
  const next = (row?.m ?? -1) + 1
  const result = await db
    .prepare(
      `INSERT INTO links (module_id, name, icon_url, url_lan, url_vpn, url_wan, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(moduleId, input.name, input.iconUrl, input.urlLan, input.urlVpn, input.urlWan, next)
    .run()
  return Number(result.meta.last_row_id ?? 0)
}

export async function updateLink(
  db: D1Database,
  id: number,
  patch: Partial<LinkInput> & { moduleId?: number },
): Promise<boolean> {
  const sets: string[] = []
  const values: (string | number | null)[] = []
  const map: Record<string, keyof typeof patch> = {
    name: 'name',
    icon_url: 'iconUrl',
    url_lan: 'urlLan',
    url_vpn: 'urlVpn',
    url_wan: 'urlWan',
    module_id: 'moduleId',
  }
  for (const [column, key] of Object.entries(map)) {
    const value = patch[key]
    if (value === undefined) continue
    sets.push(`${column} = ?`)
    values.push(value as string | number | null)
  }
  if (sets.length === 0) return true
  values.push(id)
  const result = await db
    .prepare(`UPDATE links SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()
  return (result.meta.changes ?? 0) > 0
}

export async function deleteLink(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
  return (result.meta.changes ?? 0) > 0
}

/* ── 批量排序 ────────────────────────────────────────────────────── */

export interface ReorderPayload {
  modules?: { id: number; sortOrder: number }[]
  links?: { id: number; moduleId: number; sortOrder: number }[]
}

/** 拖拽结束后一次提交、一个事务写回，避免 N 次往返与中间态 */
export async function applyReorder(db: D1Database, payload: ReorderPayload): Promise<number> {
  const statements: D1PreparedStatement[] = []
  for (const item of payload.modules ?? []) {
    statements.push(
      db.prepare('UPDATE modules SET sort_order = ? WHERE id = ?').bind(item.sortOrder, item.id),
    )
  }
  for (const item of payload.links ?? []) {
    statements.push(
      db
        .prepare('UPDATE links SET sort_order = ?, module_id = ? WHERE id = ?')
        .bind(item.sortOrder, item.moduleId, item.id),
    )
  }
  if (statements.length === 0) return 0
  await db.batch(statements)
  return statements.length
}

/* ── 设置 ────────────────────────────────────────────────────────── */

export async function saveSettings(db: D1Database, values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values)
  if (entries.length === 0) return
  await db.batch(
    entries.map(([key, value]) =>
      db
        .prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        )
        .bind(key, value),
    ),
  )
}

/* ── 导出 / 导入 / 示例数据 ─────────────────────────────────────── */

export interface ExportBundle {
  version: string
  exportedAt: string
  settings: Record<string, string>
  modules: { name: string; color: string; links: Omit<Link, 'id' | 'moduleId'>[] }[]
}

export async function exportBundle(db: D1Database): Promise<ExportBundle> {
  const nav = await getNav(db)
  return {
    version: SITE_VERSION,
    exportedAt: new Date().toISOString(),
    settings: nav.settings,
    modules: nav.modules.map((module) => ({
      name: module.name,
      color: module.color,
      links: module.links.map(({ name, iconUrl, urlLan, urlVpn, urlWan }) => ({
        name,
        iconUrl,
        urlLan,
        urlVpn,
        urlWan,
      })),
    })),
  }
}

export async function wipeAll(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM links'),
    db.prepare('DELETE FROM modules'),
  ])
}

export async function importBundle(db: D1Database, bundle: ExportBundle): Promise<void> {
  await wipeAll(db)
  let moduleOrder = 0
  for (const module of bundle.modules) {
    const moduleId = await db
      .prepare('INSERT INTO modules (name, color, sort_order) VALUES (?, ?, ?)')
      .bind(module.name, module.color, moduleOrder)
      .run()
    moduleOrder += 1
    const newId = Number(moduleId.meta.last_row_id ?? 0)
    let linkOrder = 0
    for (const link of module.links) {
      await db
        .prepare(
          `INSERT INTO links (module_id, name, icon_url, url_lan, url_vpn, url_wan, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(newId, link.name, link.iconUrl ?? null, link.urlLan ?? null, link.urlVpn ?? null, link.urlWan ?? null, linkOrder)
        .run()
      linkOrder += 1
    }
  }
  if (bundle.settings) await saveSettings(db, bundle.settings)
}

export const DEMO_BUNDLE: ExportBundle = {
  version: SITE_VERSION,
  exportedAt: '',
  settings: SETTING_DEFAULTS,
  modules: [
    {
      name: '家庭服务',
      color: 'mint',
      links: [
        { name: '群晖 NAS', iconUrl: null, urlLan: 'http://192.168.1.10:5000', urlVpn: 'http://100.66.1.10:5000', urlWan: 'https://nas.example.com' },
        { name: '家庭影院', iconUrl: null, urlLan: 'http://192.168.1.20:8096', urlVpn: 'http://100.66.1.20:8096', urlWan: null },
      ],
    },
    {
      name: '开发环境',
      color: 'sky',
      links: [
        { name: '代码仓库', iconUrl: null, urlLan: null, urlVpn: null, urlWan: 'https://github.com' },
        { name: 'CI 流水线', iconUrl: null, urlLan: 'http://192.168.1.31:8080', urlVpn: null, urlWan: null },
      ],
    },
    {
      name: '常用工具',
      color: 'butter',
      links: [
        { name: '在线文档', iconUrl: null, urlLan: null, urlVpn: null, urlWan: 'https://developer.mozilla.org' },
        { name: '图标素材', iconUrl: null, urlLan: null, urlVpn: null, urlWan: 'https://www.svgrepo.com' },
      ],
    },
  ],
}
