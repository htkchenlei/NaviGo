import { proxiedIconUrl } from '@/api/client'
import type { AccessMode, NavLink } from '@/api/types'

const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const LATIN = /[A-Za-z]/
const DIGIT = /[0-9]/

/**
 * 中文名取第一个汉字，纯英文名取首字母，纯数字取首位数字。
 * 这是图标抓取全部失败后的最终兜底，不依赖任何网络请求。
 */
export function extractInitial(name: string): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '·'
  return trimmed.match(HAN)?.[0] ?? trimmed.match(LATIN)?.[0]?.toUpperCase() ?? trimmed.match(DIGIT)?.[0] ?? trimmed[0]
}

export function safeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname.toLowerCase()
  } catch {
    return null
  }
}

/** 私网 / CGNAT / 环回地址：服务端代理一定抓不到，也没必要浪费一次请求 */
export function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase()
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) return true
  const matched = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!matched) return false
  const [a, b] = [Number(matched[1]), Number(matched[2])]
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

export function resolveUrlForMode(link: NavLink, mode: AccessMode): string | null {
  const map: Record<AccessMode, string | null> = {
    lan: link.urlLan,
    vpn: link.urlVpn,
    wan: link.urlWan,
  }
  return map[mode]
}

function hashKey(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash).toString(36)
}

/**
 * 图标来源链（按优先级）：
 *  1. 管理员手动指定的图标 URL —— 最高优先级，直接使用
 *  2. /api/icon 服务端代理抓取 —— 公网域名，命中后由边缘缓存
 *  3. 公共 favicon 服务 —— 代理失败时的兜底（仅公网域名）
 *  4. 调用方渲染中文首字符头像 —— 由组件在 onerror 时接管
 */
export function iconSources(link: NavLink, activeUrl: string | null): string[] {
  if (link.iconUrl) return [link.iconUrl]

  const domain = safeDomain(activeUrl) ?? safeDomain(link.urlWan) ?? safeDomain(link.urlLan) ?? safeDomain(link.urlVpn)
  if (!domain || isPrivateHost(domain)) return []

  const version = hashKey(activeUrl || domain)
  return [
    proxiedIconUrl(domain, version),
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ]
}
