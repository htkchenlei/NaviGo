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

export interface IconSite {
  label: string
  href: string
  /** 该站点给出的直链长什么样，鼠标悬停在按钮上能看到 */
  sample: string
  note: string
}

/**
 * 自定义图标去哪里找。
 * 只收录「页面上能直接复制到可外链图片地址」的站点 —— 自定义图标是直接塞进 <img src> 的，
 * 不能外链的地址贴进来只会显示成空白。三个直链格式都实测返回 image/svg+xml。
 */
export const ICON_SITES: IconSite[] = [
  {
    label: 'Simple Icons',
    href: 'https://simpleicons.org/',
    sample: 'https://cdn.simpleicons.org/synology',
    note: '品牌与应用 logo，直链最短',
  },
  {
    label: 'Iconify',
    href: 'https://icon-sets.iconify.design/',
    sample: 'https://api.iconify.design/mdi/home.svg',
    note: '150+ 图标集、20 万+ 图标',
  },
  {
    label: 'Font Awesome',
    href: 'https://fontawesome.com/search?o=r&m=free',
    sample: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/brands/github.svg',
    note: '经典图标库，走 jsDelivr 直链',
  },
]

/** 示例直链：直接放在提示语里给用户抄格式，点开就能看到它长什么样 */
export const ICON_SAMPLE_URL = 'https://cdn.simpleicons.org/synology'

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
 *  2. /api/icon 服务端代理 —— 公网域名；favicon 解析与公共 favicon 服务兜底都在服务端完成，
 *     命中后由边缘缓存。浏览器侧只认这一个源。
 *  3. 调用方渲染中文首字符头像 —— 由组件在 onerror 时接管
 *
 * 公共 favicon 服务刻意不走浏览器：DDG 对收录不到的站点返回的是 404 + 灰色占位图，
 * 而 <img> 不看状态码、只看能不能解码，于是占位图会被当成「加载成功」，
 * 把首字符兜底顶掉 —— 表现为一堆不同链接顶着同一个来路不明的图标。
 */
export function iconSources(link: NavLink, activeUrl: string | null): string[] {
  if (link.iconUrl) return [link.iconUrl]

  const domain = safeDomain(activeUrl) ?? safeDomain(link.urlWan) ?? safeDomain(link.urlLan) ?? safeDomain(link.urlVpn)
  if (!domain || isPrivateHost(domain)) return []

  return [proxiedIconUrl(domain, hashKey(activeUrl || domain))]
}
