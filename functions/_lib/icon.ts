import { parseUrl } from './http'
import type { Env } from './types'

/**
 * 图标代理。
 *
 * 为什么必须有服务端代理：浏览器受同源策略限制无法读取第三方站点的 favicon；
 * 而导航页部署在 HTTPS 后，页面里的 <img src="http://192.168.1.10/favicon.ico">
 * 会被 Mixed Content 策略直接拦掉。因此公网域名走这里代理抓取，
 * 私网/VPN 地址一律交给前端的「中文首字符」兜底（Cloudflare 边缘节点也进不了私网）。
 */

const MAX_ICON_BYTES = 256 * 1024
const MAX_HTML_BYTES = 128 * 1024
const MAX_REDIRECTS = 3
const POSITIVE_TTL_SECONDS = 60 * 60 * 24 * 7
const NEGATIVE_TTL_SECONDS = 60 * 30
const FETCH_TIMEOUT_MS = 5000

export interface IconPayload {
  bytes: ArrayBuffer
  contentType: string
  cacheState: 'hit' | 'miss'
  resolvedFrom: string
}

export function normalizeDomain(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const withScheme = raw.includes('://') ? raw : `https://${raw}`
  const parsed = parseUrl(withScheme)
  if (!parsed) return null
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return null
  return parsed.port ? `${host}:${parsed.port}` : host
}

/** SSRF 防护：拒绝环回 / 私网 / 链路本地 / CGNAT / IPv6 本地地址 */
export function isBlockedHost(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '')
  const lower = bare.toLowerCase()

  if (lower === 'localhost' || lower.endsWith('.localhost')) return true
  if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.home.arpa')) return true

  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
    return false
  }

  if (lower.includes(':')) {
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    if (lower.startsWith('fe80')) return true
    const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isBlockedHost(mapped[1])
    return false
  }

  return false
}

export async function resolveIcon(env: Env, domainInput: string): Promise<IconPayload | null> {
  const domain = normalizeDomain(domainInput)
  if (!domain) return null
  const host = domain.split(':')[0]
  if (isBlockedHost(host)) {
    // 私网地址直接放弃，前端首字符兜底即可，不必浪费一次外网请求
    return null
  }

  const cacheKey = new Request(`https://navigo.internal/__icon/${encodeURIComponent(domain)}`)
  const cached = await cacheGet(cacheKey)
  if (cached) {
    return { ...cached, cacheState: 'hit' }
  }

  const negativeUntil = await readNegativeCache(env.DB, domain)
  if (negativeUntil) return null

  const found = await fetchIcon(domain)
  if (!found) {
    await writeNegativeCache(env.DB, domain)
    return null
  }

  const payload: Omit<IconPayload, 'cacheState'> = {
    bytes: found.bytes,
    contentType: found.contentType,
    resolvedFrom: found.resolvedFrom,
  }
  await cachePut(cacheKey, payload)
  await clearNegativeCache(env.DB, domain)
  return { ...payload, cacheState: 'miss' }
}

interface RawIcon {
  bytes: ArrayBuffer
  contentType: string
  resolvedFrom: string
}

async function fetchIcon(domain: string): Promise<RawIcon | null> {
  const origin = `https://${domain}`
  const host = domain.split(':')[0]

  const direct = await fetchImage(`${origin}/favicon.ico`)
  if (direct) return direct

  const html = await fetchHtml(`${origin}/`)
  if (html) {
    const href = extractIconHref(html.html, html.base)
    if (href) {
      const fromHtml = await fetchImage(href)
      if (fromHtml) return fromHtml
    }
  }

  const touch = await fetchImage(`${origin}/apple-touch-icon.png`)
  if (touch) return touch

  // 公共 favicon 服务兜底必须留在服务端：目标站点没有图标时它返回的是
  // 404 + 一张灰色占位图，而 <img> 不看状态码、只看能不能解码 —— 放在前端会被
  // 当成「加载成功」，把首字符兜底顶掉，两条不同的链接却显示成同一个图标。
  // 这里经过 safeFetch 的 response.ok 校验后会正常判为失败，落到首字符。
  const publicService = await fetchImage(`https://icons.duckduckgo.com/ip3/${host}.ico`)
  if (publicService) return publicService

  return null
}

async function fetchImage(url: string): Promise<RawIcon | null> {
  const response = await safeFetch(url, 'image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8')
  if (!response) return null
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('image/')) return null
  const bytes = await readCapped(response, MAX_ICON_BYTES)
  if (!bytes || bytes.byteLength < 32) return null
  return { bytes, contentType, resolvedFrom: url }
}

async function fetchHtml(url: string): Promise<{ html: string; base: string } | null> {
  const response = await safeFetch(url, 'text/html,application/xhtml+xml')
  if (!response) return null
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  if (contentType && !contentType.includes('html')) return null
  const bytes = await readCapped(response, MAX_HTML_BYTES)
  if (!bytes) return null
  // 默认 fatal=false：遇到乱码字符不会抛异常，HTML 解析失败也只是降级到首字符兜底
  const html = new TextDecoder('utf-8').decode(bytes)
  const baseTag = html.match(/<base\b[^>]*href\s*=\s*["']([^"']+)["']/i)
  return { html, base: baseTag ? baseTag[1] : url }
}

/** 逐跳校验 Location，避免被 302 重定向到内网地址绕过 SSRF 检查 */
async function safeFetch(url: string, accept: string): Promise<Response | null> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const parsed = parseUrl(current)
    if (!parsed) return null
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (isBlockedHost(parsed.hostname.toLowerCase())) return null

    let response: Response
    try {
      response = await fetch(current, {
        redirect: 'manual',
        headers: { accept, 'user-agent': 'NaviGo-icon-proxy/1.0 (+https://github.com/)' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch (error) {
      console.error('[navigo] 图标抓取失败', parsed.hostname, error)
      return null
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return null
      current = new URL(location, current).toString()
      continue
    }
    return response.ok ? response : null
  }
  return null
}

async function readCapped(response: Response, limit: number): Promise<ArrayBuffer | null> {
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared && declared > limit) {
    await response.body?.cancel()
    return null
  }
  const buffer = await response.arrayBuffer()
  return buffer.byteLength > limit ? null : buffer
}

export function extractIconHref(html: string, base: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? []
  const candidates: { href: string; weight: number }[] = []
  for (const tag of tags) {
    const relMatch = tag.match(/rel\s*=\s*["']?([^"'>]+)/i)
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i)
    if (!relMatch || !hrefMatch) continue
    const rel = relMatch[1].toLowerCase()
    if (!rel.includes('icon')) continue
    let weight = 1
    if (rel.includes('apple-touch')) weight = 0
    if (rel.includes('mask-icon')) weight = 0
    if (/sizes\s*=\s*["']?32x32/i.test(tag)) weight = 3
    if (/sizes\s*=\s*["']?16x16/i.test(tag)) weight = 2
    candidates.push({ href: hrefMatch[1], weight })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.weight - a.weight)
  const resolved = new URL(candidates[0].href, base).toString()
  const parsed = parseUrl(resolved)
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) return null
  return resolved
}

/* ── 缓存 ────────────────────────────────────────────────────────── */

async function cacheGet(key: Request): Promise<Omit<IconPayload, 'cacheState'> | null> {
  const cache = typeof caches === 'undefined' ? undefined : caches.default
  if (!cache) return null
  const hit = await cache.match(key)
  if (!hit) return null
  const bytes = await hit.arrayBuffer()
  return {
    bytes,
    contentType: hit.headers.get('content-type') || 'image/x-icon',
    resolvedFrom: hit.headers.get('x-resolved-from') || '',
  }
}

async function cachePut(key: Request, payload: Omit<IconPayload, 'cacheState'>): Promise<void> {
  const cache = typeof caches === 'undefined' ? undefined : caches.default
  if (!cache) return
  await cache.put(
    key,
    new Response(payload.bytes, {
      headers: {
        'content-type': payload.contentType,
        'cache-control': `public, max-age=${POSITIVE_TTL_SECONDS}`,
        'x-resolved-from': payload.resolvedFrom,
      },
    }),
  )
}

async function readNegativeCache(db: D1Database, domain: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT fetched_at FROM icon_cache WHERE domain = ? AND status = 0')
    .bind(domain)
    .first<{ fetched_at: number }>()
  if (!row) return false
  return Math.floor(Date.now() / 1000) - row.fetched_at < NEGATIVE_TTL_SECONDS
}

async function writeNegativeCache(db: D1Database, domain: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO icon_cache (domain, status, fetched_at) VALUES (?, 0, ?)
       ON CONFLICT(domain) DO UPDATE SET status = 0, fetched_at = excluded.fetched_at`,
    )
    .bind(domain, Math.floor(Date.now() / 1000))
    .run()
}

async function clearNegativeCache(db: D1Database, domain: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO icon_cache (domain, status, fetched_at) VALUES (?, 1, ?)
       ON CONFLICT(domain) DO UPDATE SET status = 1, fetched_at = excluded.fetched_at`,
    )
    .bind(domain, Math.floor(Date.now() / 1000))
    .run()
}
