import { hashPassword } from './auth'
import { SETTING_DEFAULTS } from './types'

/**
 * 幂等建表 + 首次播种。
 * 目的是把「一键部署」的门槛压到最低：用户只需要创建 D1 并绑定 DB，
 * 不需要手工执行 schema.sql（仓库仍提供该文件供查阅与手动执行）。
 */

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
     ip TEXT NOT NULL,
     at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts (ip, at)`,
  `CREATE TABLE IF NOT EXISTS modules (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     color TEXT NOT NULL DEFAULT 'mint',
     sort_order INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS links (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     module_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     icon_url TEXT,
     url_lan TEXT,
     url_vpn TEXT,
     url_wan TEXT,
     sort_order INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS idx_links_module ON links (module_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS icon_cache (
     domain TEXT PRIMARY KEY,
     status INTEGER NOT NULL,
     fetched_at INTEGER NOT NULL
   )`,
]

let schemaReady = false

export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return
  await db.batch(SCHEMA_STATEMENTS.map((sql) => db.prepare(sql)))
  await seedDefaults(db)
  schemaReady = true
}

async function seedDefaults(db: D1Database): Promise<void> {
  const [userCount, ...settingRows] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM users'),
    ...Object.entries(SETTING_DEFAULTS).map(([key, value]) =>
      db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, value),
    ),
  ])

  const total = (userCount.results?.[0] as { n?: number } | undefined)?.n ?? 0
  void settingRows

  if (total > 0) return

  const hash = await hashPassword('admin')
  await db
    .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
    .bind('admin', hash, Math.floor(Date.now() / 1000))
    .run()
  console.log('[navigo] 已播种默认管理员账号 admin/admin，请在首次登录后立即修改密码')
}

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
  return row?.n ?? 0
}
