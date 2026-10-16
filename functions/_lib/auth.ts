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
