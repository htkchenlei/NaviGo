import { buildCookie, isSecureRequest, readCookie } from './http'
import type { UserRow } from './types'

export const SESSION_COOKIE = 'navigo_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const PBKDF2_ITERATIONS = 100_000
const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_MAX_FAILURES = 8

const textEncoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations },
    material,
    256,
  )
  return new Uint8Array(bits)
}

/** 自描述哈希串：pbkdf2$sha256$迭代次数$盐$哈希，方便日后平滑升级参数 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  return ['pbkdf2', 'sha256', String(PBKDF2_ITERATIONS), toBase64Url(salt), toBase64Url(derived)].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') {
    console.error('[navigo] 密码哈希格式无法识别')
    return false
  }
  const iterations = Number(parts[2])
  if (!Number.isInteger(iterations) || iterations <= 0) return false
  try {
    const expected = fromBase64Url(parts[4])
    const actual = await deriveKey(password, fromBase64Url(parts[3]), iterations)
    return timingSafeEqual(expected, actual)
  } catch (error) {
    console.error('[navigo] 密码校验异常', error)
    return false
  }
}

/** 恒定时间比较，避免通过响应耗时侧信道推断哈希前缀 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** 会话令牌只在响应里出现一次，库里仅存哈希：拖库也无法直接冒用 */
export async function issueSession(db: D1Database, userId: number): Promise<string> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256Hex(token)
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, expiresAt)
    .run()
  return token
}

export interface SessionUser {
  id: number
  username: string
}

export async function resolveSession(db: D1Database, request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const row = await db
    .prepare(
      `SELECT u.id AS id, u.username AS username, s.expires_at AS expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ id: number; username: string; expires_at: number }>()
  if (!row) return null
  if (row.expires_at <= Math.floor(Date.now() / 1000)) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    return null
  }
  return { id: row.id, username: row.username }
}

export async function revokeSession(db: D1Database, request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run()
}

export async function revokeAllSessions(db: D1Database, userId: number): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}

export function sessionCookie(request: Request, token: string): string {
  return buildCookie(SESSION_COOKIE, token, {
    maxAge: SESSION_TTL_SECONDS,
    secure: isSecureRequest(request),
  })
}

export function expiredSessionCookie(request: Request): string {
  return buildCookie(SESSION_COOKIE, '', { expired: true, secure: isSecureRequest(request) })
}

/* ── 登录失败限流（按 IP，15 分钟窗口） ─────────────────────────── */

export interface ThrottleResult {
  blocked: boolean
  remaining: number
}

export async function checkLoginThrottle(db: D1Database, ip: string): Promise<ThrottleResult> {
  const windowStart = Math.floor(Date.now() / 1000) - LOGIN_WINDOW_SECONDS
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?')
    .bind(ip, windowStart)
    .first<{ n: number }>()
  const failures = row?.n ?? 0
  return { blocked: failures >= LOGIN_MAX_FAILURES, remaining: Math.max(0, LOGIN_MAX_FAILURES - failures) }
}

export async function recordLoginFailure(db: D1Database, ip: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db.batch([
    db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(now - LOGIN_WINDOW_SECONDS * 4),
    db.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(ip, now),
  ])
}

export async function clearLoginFailures(db: D1Database, ip: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export async function findUserByName(db: D1Database, username: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>()
}

export async function updatePassword(db: D1Database, userId: number, password: string): Promise<void> {
  const hash = await hashPassword(password)
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, userId).run()
}

/* ── API 令牌（Bearer） ──────────────────────────────────────────── */

/**
 * 脚本、快捷指令、Home Assistant 这类客户端没法走登录表单，给它们发令牌。
 *
 * 存储上有两个取舍：
 *  1. token_hash 负责查表匹配，token_plain 让后台可以随时「掩码显示 / 点开查看 / 直接复制」；
 *  2. 默认只活 15 分钟，过期即从库里删行 —— 生命周期短到足以抵消「明文可回读」的风险，
 *     也省得用户事后手动清理一堆一次性令牌。
 *
 * 令牌可命名、可单独吊销、可设过期，也能限成只读 —— 这些是环境变量式静态密钥做不到的。
 */
export const API_TOKEN_PREFIX = 'nvk_'
export const TOKEN_SCOPES = ['read', 'write'] as const
export type TokenScope = (typeof TOKEN_SCOPES)[number]

/** 不传有效期时的默认寿命：够跑完一次脚本，又不至于留在库里 */
export const DEFAULT_TOKEN_TTL_MINUTES = 15
const MAX_TOKEN_TTL_MINUTES = 525_600

const TOKEN_PREFIX_DISPLAY = 8
const LAST_USED_THROTTLE_SECONDS = 5 * 60

export interface ApiTokenMeta {
  id: number
  name: string
  /** 明文前 8 位，形如 nvk_ab12cd34；不参与鉴权，只用于掩码显示与辨认 */
  prefix: string
  /** 明文令牌，供后台随时查看/复制；旧版本签发、未存明文的行是 null */
  token: string | null
  scopes: TokenScope[]
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
}

export interface IssuedApiToken extends ApiTokenMeta {
  token: string
}

export interface AuthContext {
  user: SessionUser
  /** cookie = 浏览器会话；token = 脚本持有的 Bearer */
  via: 'cookie' | 'token'
  scopes: TokenScope[]
  tokenId?: number
}

interface ApiTokenRow {
  id: number
  name: string
  prefix: string
  token_hash: string
  token_plain: string | null
  user_id: number
  scopes: string
  created_at: number
  last_used_at: number | null
  expires_at: number | null
}

function parseScopes(raw: string): TokenScope[] {
  const wanted = raw.split(',').map((item) => item.trim())
  return TOKEN_SCOPES.filter((scope) => wanted.includes(scope))
}

function metaOf(row: ApiTokenRow): ApiTokenMeta {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    token: row.token_plain ?? null,
    scopes: parseScopes(row.scopes),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? null,
    expiresAt: row.expires_at ?? null,
  }
}

/** 过期即删行：令牌默认只活 15 分钟，不该留下任何需要用户手动清理的残留 */
async function purgeExpiredTokens(db: D1Database): Promise<void> {
  await db
    .prepare('DELETE FROM api_tokens WHERE expires_at IS NOT NULL AND expires_at <= ?')
    .bind(Math.floor(Date.now() / 1000))
    .run()
}

export async function issueApiToken(
  db: D1Database,
  userId: number,
  input: { name: string; scopes: TokenScope[]; expiresInMinutes: number | null },
): Promise<IssuedApiToken> {
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const token = `${API_TOKEN_PREFIX}${secret}`
  const prefix = `${API_TOKEN_PREFIX}${secret.slice(0, TOKEN_PREFIX_DISPLAY)}`
  const now = Math.floor(Date.now() / 1000)
  const scopes = TOKEN_SCOPES.filter((scope) => input.scopes.includes(scope))
  const minutes = input.expiresInMinutes
  if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_TOKEN_TTL_MINUTES)) {
    throw new Error(`令牌有效期不合法：${minutes}`)
  }
  const expiresAt = minutes === null ? null : now + minutes * 60

  await purgeExpiredTokens(db)
  const result = await db
    .prepare(
      `INSERT INTO api_tokens (name, prefix, token_hash, token_plain, user_id, scopes, created_at, last_used_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .bind(input.name, prefix, await sha256Hex(token), token, userId, scopes.join(','), now, expiresAt)
    .run()

  return {
    id: Number(result.meta.last_row_id ?? 0),
    name: input.name,
    prefix,
    token,
    scopes,
    createdAt: now,
    lastUsedAt: null,
    expiresAt,
  }
}

export async function listApiTokens(db: D1Database, userId: number): Promise<ApiTokenMeta[]> {
  await purgeExpiredTokens(db)
  const result = await db
    .prepare('SELECT * FROM api_tokens WHERE user_id = ? ORDER BY id DESC')
    .bind(userId)
    .all<ApiTokenRow>()
  return ((result.results ?? []) as ApiTokenRow[]).map(metaOf)
}

/** 只能吊销自己的令牌；返回值表示是否真的删掉了一行 */
export async function revokeApiToken(db: D1Database, userId: number, id: number): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()
  return (result.meta.changes ?? 0) > 0
}

/**
 * 按哈希查表。过期令牌顺手删掉；last_used_at 做节流写回 ——
 * 否则每个 GET 都要多打一次 D1，读接口的延迟全被这个副作用吃掉。
 */
export async function resolveApiToken(db: D1Database, raw: string): Promise<AuthContext | null> {
  if (!raw.startsWith(API_TOKEN_PREFIX)) return null
  const row = await db
    .prepare(
      `SELECT t.*, u.username AS username
       FROM api_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?`,
    )
    .bind(await sha256Hex(raw))
    .first<ApiTokenRow & { username: string }>()
  if (!row) return null

  const now = Math.floor(Date.now() / 1000)
  if (row.expires_at && row.expires_at <= now) {
    await db.prepare('DELETE FROM api_tokens WHERE id = ?').bind(row.id).run()
    return null
  }
  if (!row.last_used_at || now - row.last_used_at >= LAST_USED_THROTTLE_SECONDS) {
    await db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').bind(now, row.id).run()
  }

  return {
    user: { id: row.user_id, username: row.username },
    via: 'token',
    scopes: parseScopes(row.scopes),
    tokenId: row.id,
  }
}

export function readBearer(request: Request): { present: boolean; token: string | null } {
  const header = request.headers.get('authorization')
  if (!header) return { present: false, token: null }
  const matched = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return { present: true, token: matched ? matched[1] : null }
}

/**
 * 全站鉴权入口：带了 Authorization 头就只认令牌（令牌无效直接 401，不回落到 Cookie，
 * 免得半失效的令牌被会话悄悄顶上）；没带才回落到 HttpOnly 会话。
 */
export async function authenticate(db: D1Database, request: Request): Promise<AuthContext | null> {
  const bearer = readBearer(request)
  if (bearer.present) return bearer.token ? await resolveApiToken(db, bearer.token) : null
  const user = await resolveSession(db, request)
  return user ? { user, via: 'cookie', scopes: [...TOKEN_SCOPES] } : null
}
