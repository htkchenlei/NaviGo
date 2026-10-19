import {
  HttpError,
  assertSameOrigin,
  fail,
  missingDb,
  ok,
  optStr,
  optUrl,
  pickOne,
  readJson,
  reqId,
  reqPassword,
  reqStr,
  toResponse,
} from '../_lib/http'
import {
  DEFAULT_TOKEN_TTL_MINUTES,
  SESSION_COOKIE,
  TOKEN_SCOPES,
  authenticate,
  checkLoginThrottle,
  clearLoginFailures,
  clientIp,
  expiredSessionCookie,
  findUserByName,
  issueApiToken,
  issueSession,
  listApiTokens,
  recordLoginFailure,
  revokeAllSessions,
  revokeApiToken,
  revokeSession,
  sessionCookie,
  updatePassword,
  verifyPassword,
} from '../_lib/auth'
import type { SessionUser, TokenScope } from '../_lib/auth'
import { countUsers, ensureSchema } from '../_lib/db'
import { resolveIcon } from '../_lib/icon'
import {
  DEMO_BUNDLE,
  applyReorder,
  createLink,
  createModule,
  deleteLink,
  deleteModule,
  exportBundle,
  getLink,
  getModule,
  getNav,
  importBundle,
  listLinks,
  listModules,
  recordLinkClick,
  saveSettings,
  updateLink,
  updateModule,
} from '../_lib/repo'
import type { ExportBundle, LinkInput } from '../_lib/repo'
import { COLOR_KEYS, SEARCH_ENGINE_KEYS, SITE_VERSION } from '../_lib/types'
import type { Env } from '../_lib/types'

type Ctx = EventContext<Env, string, Record<string, unknown>>

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const url = new URL(request.url)
  const segments = Array.isArray(params.path) ? (params.path as string[]) : []
  const route = segments.join('/')
  const method = request.method.toUpperCase()

  if (!env.DB) return missingDb()

  try {
    await ensureSchema(env.DB)
  } catch (error) {
    console.error('[navigo] 数据库初始化失败，请确认 D1 绑定变量名为 DB', error)
    return fail('数据库不可用，请检查 D1 绑定与迁移状态', 503, 'db_unavailable')
  }

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'GET,POST,PUT,DELETE,OPTIONS' } })
  }

  try {
    if (route === 'health' && method === 'GET') return await handleHealth(env)
    if (route === 'auth/login' && method === 'POST') return await handleLogin(env, request)

    const authz = await authenticate(env.DB, request)
    if (!authz) return fail('未登录或令牌无效', 401, 'unauthorized')
    const user = authz.user
    const viaToken = authz.via === 'token'

    // 令牌是脚本自己加的头，浏览器不会自动携带，不存在 CSRF；
    // 同源校验只对 Cookie 会话有意义，脚本也就不必为了过校验去伪造 Origin。
    if (WRITE_METHODS.has(method) && !viaToken) {
      const originError = assertSameOrigin(request)
      if (originError) return originError
    }

    // 令牌只能碰数据：账号安全与令牌管理必须由浏览器会话操作，
    // 否则一枚泄漏的令牌就能改密码、也能给自己续命。
    const sessionOnly = route.startsWith('auth/') || route === 'tokens' || route.startsWith('tokens/')
    if (viaToken && sessionOnly) {
      return fail('该接口只接受登录会话，不支持 API 令牌', 403, 'session_required')
    }

    if (viaToken && WRITE_METHODS.has(method) && !authz.scopes.includes('write')) {
      return fail('该令牌只有只读权限', 403, 'token_read_only')
    }

    if (route === 'auth/me' && method === 'GET') return await handleMe(env, user.username)
    if (route === 'auth/logout' && method === 'POST') return await handleLogout(env, request)
    if (route === 'auth/logout-all' && method === 'POST') {
      await revokeAllSessions(env.DB, user.id)
      console.log('[navigo] 已吊销全部设备的会话', user.username)
      return ok({ revoked: true }, { 'set-cookie': expiredSessionCookie(request) })
    }
    if (route === 'auth/password' && method === 'POST') {
      return await handlePasswordChange(env, request, user)
    }

    if (route === 'tokens' && method === 'GET') return await handleTokenList(env, user)
    if (route === 'tokens' && method === 'POST') return await handleTokenCreate(env, request, user)
    const tokenId = matchId(route, 'tokens')
    if (tokenId !== null && method === 'DELETE') {
      const removed = await revokeApiToken(env.DB, user.id, tokenId)
      return removed ? ok({ id: tokenId }) : fail('令牌不存在', 404, 'not_found')
    }

    if (route === 'nav' && method === 'GET') return ok(await getNav(env.DB))
    if (route === 'settings' && method === 'POST') return await handleSettings(env, request)
    if (route === 'reorder' && method === 'POST') {
      const body = await readJson(context.request)
      const count = await applyReorder(env.DB, body as never)
      return ok({ updated: count })
    }

    if (route === 'modules' && method === 'GET') return ok({ modules: await listModules(env.DB) })
    if (route === 'modules' && method === 'POST') return await handleModuleCreate(env, request)

    const moduleId = matchId(route, 'modules')
    if (moduleId !== null) {
      if (method === 'GET') {
        const found = await getModule(env.DB, moduleId)
        return found ? ok(found) : fail('模块不存在', 404, 'not_found')
      }
      if (method === 'PUT') return await handleModuleUpdate(env, request, moduleId)
      if (method === 'DELETE') {
        const removed = await deleteModule(env.DB, moduleId)
        return removed ? ok({ id: moduleId }) : fail('模块不存在', 404, 'not_found')
      }
    }

    if (route === 'links' && method === 'GET') return ok({ links: await listLinks(env.DB) })
    if (route === 'links' && method === 'POST') return await handleLinkCreate(env, request)

    // 点击上报：只累计所属模块的热度，不改变其它任何数据
    const clickedId = route.match(/^links\/(\d+)\/click$/)?.[1]
    if (clickedId && method === 'POST') {
      const counted = await recordLinkClick(env.DB, Number(clickedId))
      return counted
        ? ok({ moduleId: counted.moduleId, clicks: counted.clicks })
        : fail('链接不存在', 404, 'not_found')
    }

    const linkId = matchId(route, 'links')
    if (linkId !== null) {
      if (method === 'GET') {
        const found = await getLink(env.DB, linkId)
        return found ? ok(found) : fail('链接不存在', 404, 'not_found')
      }
      if (method === 'PUT') return await handleLinkUpdate(env, request, linkId)
      if (method === 'DELETE') {
        const removed = await deleteLink(env.DB, linkId)
        return removed ? ok({ id: linkId }) : fail('链接不存在', 404, 'not_found')
      }
    }

    if (route === 'export' && method === 'GET') return ok(await exportBundle(env.DB))
    if (route === 'import' && method === 'POST') return await handleImport(env, request)
    if (route === 'demo' && method === 'POST') {
      await importBundle(env.DB, DEMO_BUNDLE)
      return ok(await getNav(env.DB))
    }

    if (route === 'icon' && method === 'GET') return await handleIcon(env, url)

    return fail(`未知接口：${method} /api/${route}`, 404, 'not_found')
  } catch (error) {
    return toResponse(error)
  }
}

function matchId(route: string, prefix: string): number | null {
  const matched = route.match(new RegExp(`^${prefix}/(\\d+)$`))
  return matched ? Number(matched[1]) : null
}

/* ── 账号 ────────────────────────────────────────────────────────── */

async function handleHealth(env: Env): Promise<Response> {
  const users = await countUsers(env.DB)
  return ok({
    db: 'ok',
    version: SITE_VERSION,
    userCount: users,
    commit: env.CF_PAGES_COMMIT_SHA ?? null,
    branch: env.CF_PAGES_BRANCH ?? null,
    siteUrl: env.CF_PAGES_URL ?? null,
  })
}

async function handleMe(env: Env, username: string): Promise<Response> {
  const nav = await getNav(env.DB)
  return ok({
    username,
    needsPasswordChange: nav.settings.password_changed !== '1',
  })
}

async function handleLogin(env: Env, request: Request): Promise<Response> {
  const originError = assertSameOrigin(request)
  if (originError) return originError

  const ip = clientIp(request)
  const throttle = await checkLoginThrottle(env.DB, ip)
  if (throttle.blocked) {
    return fail('登录失败次数过多，请 15 分钟后重试', 429, 'too_many_attempts')
  }

  const body = await readJson<{ username?: unknown; password?: unknown }>(request)
  const username = reqStr(body.username, 'username', 64)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) throw new HttpError('密码不能为空')

  const user = await findUserByName(env.DB, username)
  const valid = user ? await verifyPassword(password, user.password_hash) : false
  if (!user || !valid) {
    await recordLoginFailure(env.DB, ip)
    return fail('账号或密码不正确', 401, 'invalid_credentials')
  }

  await clearLoginFailures(env.DB, ip)
  const token = await issueSession(env.DB, user.id)
  console.log('[navigo] 登录成功', username)
  return ok({ username: user.username }, { 'set-cookie': sessionCookie(request, token) })
}

async function handleLogout(env: Env, request: Request): Promise<Response> {
  await revokeSession(env.DB, request)
  return ok({ ok: true }, { 'set-cookie': expiredSessionCookie(request), 'x-clear-cookie': SESSION_COOKIE })
}

async function handlePasswordChange(
  env: Env,
  request: Request,
  session: { id: number; username: string },
): Promise<Response> {
  const body = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(request)
  const current = reqPassword(body.currentPassword, 'currentPassword')
  const next = reqPassword(body.newPassword, 'newPassword')

  const user = await findUserByName(env.DB, session.username)
  if (!user || !(await verifyPassword(current, user.password_hash))) {
    return fail('当前密码不正确', 403, 'invalid_password')
  }

  await updatePassword(env.DB, session.id, next)
  // 改密后强制所有设备重新登录，同时清掉「首次登录」提醒
  await revokeAllSessions(env.DB, session.id)
  await saveSettings(env.DB, { password_changed: '1' })
  console.log('[navigo] 已更新密码并吊销全部会话', session.username)
  return ok({ changed: true })
}

/* ── API 令牌 ────────────────────────────────────────────────────── */

async function handleTokenList(env: Env, user: SessionUser): Promise<Response> {
  return ok({ tokens: await listApiTokens(env.DB, user.id) })
}

async function handleTokenCreate(env: Env, request: Request, user: SessionUser): Promise<Response> {
  const body = await readJson<{ name?: unknown; scopes?: unknown; expiresInMinutes?: unknown }>(request)
  const name = reqStr(body.name, 'name', 40)

  // 不传 scopes 就是读写；传了才按白名单过滤，避免写进未知权限位
  const scopes: TokenScope[] = Array.isArray(body.scopes)
    ? TOKEN_SCOPES.filter((scope) => (body.scopes as unknown[]).includes(scope))
    : [...TOKEN_SCOPES]
  if (scopes.length === 0) throw new HttpError('scopes 至少要包含 read 或 write')

  // 不传就是 15 分钟；显式传 null 表示永不过期
  const expiresInMinutes =
    body.expiresInMinutes === undefined
      ? DEFAULT_TOKEN_TTL_MINUTES
      : body.expiresInMinutes === null
        ? null
        : reqId(body.expiresInMinutes, 'expiresInMinutes')
  if (expiresInMinutes !== null && expiresInMinutes > 525_600) {
    throw new HttpError('expiresInMinutes 最多 525600 分钟（一年）')
  }

  const issued = await issueApiToken(env.DB, user.id, { name, scopes, expiresInMinutes })
  console.log(
    '[navigo] 已签发 API 令牌',
    issued.prefix,
    `(${scopes.join(',')}, ${expiresInMinutes ?? '永久'}分钟)`,
  )
  return ok(issued)
}

/* ── 模块与链接 ──────────────────────────────────────────────────── */

async function handleModuleCreate(env: Env, request: Request): Promise<Response> {
  const body = await readJson<{ name?: unknown; color?: unknown }>(request)
  const name = reqStr(body.name, 'name', 32)
  const color = pickOne(body.color, COLOR_KEYS, 'mint')
  const id = await createModule(env.DB, name, color)
  return ok({ id, name, color })
}

async function handleModuleUpdate(env: Env, request: Request, id: number): Promise<Response> {
  const body = await readJson<{ name?: unknown; color?: unknown; pinnedRank?: unknown }>(request)
  const patch: { name?: string; color?: string; pinnedRank?: number | null } = {}
  if (body.name !== undefined) patch.name = reqStr(body.name, 'name', 32)
  if (body.color !== undefined) patch.color = pickOne(body.color, COLOR_KEYS, 'mint')
  if (body.pinnedRank !== undefined) {
    // null 表示取消固定；数字是 1 起的固定位次
    if (body.pinnedRank === null) {
      patch.pinnedRank = null
    } else {
      const rank = reqId(body.pinnedRank, 'pinnedRank')
      if (rank > 500) throw new HttpError('pinnedRank 最大 500')
      patch.pinnedRank = rank
    }
  }
  const updated = await updateModule(env.DB, id, patch)
  return updated ? ok({ id, ...patch }) : fail('模块不存在或没有变化', 404, 'not_found')
}

async function handleLinkCreate(env: Env, request: Request): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request)
  const moduleId = reqId(body.moduleId, 'moduleId')
  const input = readLinkInput(body, true)
  const id = await createLink(env.DB, moduleId, input)
  return ok({ id, moduleId, ...input })
}

async function handleLinkUpdate(env: Env, request: Request, id: number): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request)
  const patch = readLinkInput(body, false)
  const updated = await updateLink(env.DB, id, patch)
  return updated ? ok({ id, ...patch }) : fail('链接不存在', 404, 'not_found')
}

/** 新建时 name 必填；编辑时只校验传了的字段，未传的保持原值 */
function readLinkInput(body: Record<string, unknown>, requireName: boolean): LinkInput {
  const name = requireName ? reqStr(body.name, 'name', 32) : optStr(body.name, 'name', 32)
  if (name === null) throw new HttpError('字段 name 不能为空')
  return {
    name,
    description: optStr(body.description, 'description', 120),
    iconUrl: optUrl(body.iconUrl, 'iconUrl'),
    urlLan: optUrl(body.urlLan, 'urlLan'),
    urlVpn: optUrl(body.urlVpn, 'urlVpn'),
    urlWan: optUrl(body.urlWan, 'urlWan'),
  }
}

/**
 * 前端把开关序列化成 '1' / '0' 字符串，而 '0' 在 JS 里也是真值，
 * 不能直接用三目判断，否则「关闭」会被存成「开启」。
 */
function isFlagOn(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

async function handleSettings(env: Env, request: Request): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request)
  const values: Record<string, string> = {}
  if (body.site_title !== undefined) values.site_title = reqStr(body.site_title, 'site_title', 40)
  if (body.site_subtitle !== undefined) {
    values.site_subtitle = optStr(body.site_subtitle, 'site_subtitle', 80) ?? ''
  }
  if (body.fallback_wan !== undefined) values.fallback_wan = isFlagOn(body.fallback_wan) ? '1' : '0'
  if (body.search_engine !== undefined) {
    values.search_engine = pickOne(body.search_engine, SEARCH_ENGINE_KEYS, 'google')
  }
  if (body.auto_sort_modules !== undefined) {
    values.auto_sort_modules = isFlagOn(body.auto_sort_modules) ? '1' : '0'
  }
  await saveSettings(env.DB, values)
  return ok(values)
}

async function handleImport(env: Env, request: Request): Promise<Response> {
  const body = await readJson<ExportBundle>(request)
  if (!body || !Array.isArray(body.modules)) {
    throw new HttpError('导入文件格式不正确，应为 NaviGo 导出的 JSON')
  }
  if (body.modules.length > 200) throw new HttpError('模块数量过多（上限 200）')
  await importBundle(env.DB, body)
  return ok(await getNav(env.DB))
}

/* ── 图标 ────────────────────────────────────────────────────────── */

async function handleIcon(env: Env, url: URL): Promise<Response> {
  const domain = url.searchParams.get('domain') || ''
  const payload = await resolveIcon(env, domain)
  if (!payload) {
    // 返回 404 而不是空图，前端 <img> 的 onerror 才能触发首字符兜底
    return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  return new Response(payload.bytes, {
    status: 200,
    headers: {
      'content-type': payload.contentType,
      'cache-control': 'public, max-age=2592000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'x-icon-cache': payload.cacheState,
      'x-icon-source': payload.resolvedFrom,
    },
  })
}
