import type { ApiErr, ApiOk } from './types'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

export function ok<T>(data: T, extraHeaders: Record<string, string> = {}): Response {
  const body: ApiOk<T> = { ok: true, data }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
}

export function fail(message: string, status = 400, code = 'bad_request', extraHeaders: Record<string, string> = {}): Response {
  const body: ApiErr = { ok: false, error: message, code }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
}

/** D1 未绑定是本项目最常见的部署事故，单独给一条可执行的提示 */
export function missingDb(): Response {
  return fail(
    'D1 数据库未绑定。请在 Cloudflare Pages 项目 → Settings → Functions → D1 database bindings 中添加绑定，变量名必须是 DB。',
    503,
    'db_not_bound',
  )
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie')
  if (!raw) return null
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return null
}

export function buildCookie(
  name: string,
  value: string,
  opts: { maxAge?: number; secure?: boolean; expired?: boolean } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (opts.expired) {
    parts.push('Max-Age=0')
  } else if (typeof opts.maxAge === 'number') {
    parts.push(`Max-Age=${opts.maxAge}`)
  }
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

/**
 * 写操作的同源校验：阻止第三方站点利用用户已登录的 Cookie 发起跨站写入。
 * 缺少 Origin 的同源导航请求（部分老浏览器）放行，但 Method 为写时会因缺 header 走 Referer 兜底。
 */
export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin')
  const self = new URL(request.url)
  if (!origin) {
    const referer = request.headers.get('referer')
    if (!referer) return null
    if (safeHost(referer) === self.host) return null
    return fail('跨站请求被拒绝', 403, 'cross_origin')
  }
  if (origin === 'null') return fail('跨站请求被拒绝', 403, 'cross_origin')
  if (safeHost(origin) === self.host) return null
  return fail('跨站请求被拒绝', 403, 'cross_origin')
}

function safeHost(value: string): string | null {
  return parseUrl(value)?.host ?? null
}

/** 用 try/catch 兜底，避免依赖尚未普及的 URL.parse 静态方法 */
export function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
  const type = request.headers.get('content-type') || ''
  if (!type.includes('application/json')) {
    throw new HttpError('请求体必须是 application/json', 415, 'unsupported_media_type')
  }
  const text = await request.text()
  if (text.length > 512 * 1024) {
    throw new HttpError('请求体过大（上限 512KB）', 413, 'payload_too_large')
  }
  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error('[navigo] JSON 解析失败', error)
    throw new HttpError('JSON 格式错误', 400, 'invalid_json')
  }
}

export class HttpError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = 'bad_request') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function toResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return fail(error.message, error.status, error.code)
  }
  console.error('[navigo] 未捕获异常', error)
  return fail('服务器内部错误', 500, 'internal_error')
}

/* ── 输入校验 ─────────────────────────────────────────────────────── */

export function reqStr(value: unknown, field: string, max = 64): string {
  if (typeof value !== 'string') throw new HttpError(`字段 ${field} 必须是字符串`)
  const trimmed = value.trim()
  if (!trimmed) throw new HttpError(`字段 ${field} 不能为空`)
  if (trimmed.length > max) throw new HttpError(`字段 ${field} 超过 ${max} 个字符`)
  return trimmed
}

export function optStr(value: unknown, field: string, max = 512): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new HttpError(`字段 ${field} 必须是字符串`)
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) throw new HttpError(`字段 ${field} 超过 ${max} 个字符`)
  return trimmed
}

/** 只放行 http/https，挡掉 javascript: / data: 之类会变成 XSS 载体的协议 */
export function optUrl(value: unknown, field: string): string | null {
  const raw = optStr(value, field, 2048)
  if (!raw) return null
  const parsed = parseUrl(raw)
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    throw new HttpError(`字段 ${field} 必须是 http:// 或 https:// 开头的地址`)
  }
  return raw
}

/** 白名单枚举取值：只接受 allowed 里的字符串，其余一律回退到默认值，避免写库任意内容 */
export function pickOne(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback
}

export function reqId(value: unknown, field = 'id'): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new HttpError(`字段 ${field} 不是合法的正整数`)
  return parsed
}

export function reqPassword(value: unknown, field = 'password'): string {
  if (typeof value !== 'string') throw new HttpError(`字段 ${field} 必须是字符串`)
  if (value.length < 4) throw new HttpError('密码至少 4 位')
  if (value.length > 128) throw new HttpError('密码不能超过 128 位')
  return value
}
