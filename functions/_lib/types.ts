/** 服务端共享类型。前端在 src/api/types.ts 里持有结构一致的镜像定义。 */

export interface Env {
  DB: D1Database
  /** 可选：Cloudflare Pages 部署时由平台注入，用于后台「部署信息」自查 */
  CF_PAGES_COMMIT_SHA?: string
  CF_PAGES_BRANCH?: string
  CF_PAGES_URL?: string
}

export interface UserRow {
  id: number
  username: string
  password_hash: string
  created_at: number
}

/** 数据域：public 对应首页，private 对应手动访问的 /private 私密页 */
export type NavScope = 'public' | 'private'

export interface ModuleRow {
  id: number
  name: string
  color: string
  sort_order: number
  scope: NavScope
  /** 该模块下所有地址被点开的累计次数，自动排序的依据 */
  click_count: number
  /** 固定到第几位（1 起）；null 表示跟随点击热度排 */
  pinned_rank: number | null
}

export interface LinkRow {
  id: number
  module_id: number
  name: string
  description: string | null
  icon_url: string | null
  url_lan: string | null
  url_vpn: string | null
  url_wan: string | null
  sort_order: number
}

export interface Module {
  id: number
  name: string
  color: string
  /** 累计点击数，自动排序开启时前端也会展示出来 */
  clicks: number
  /** 固定位置（1 起）；null 表示不固定 */
  pinnedRank: number | null
  links: Link[]
}

export interface Link {
  id: number
  moduleId: number
  name: string
  description: string | null
  iconUrl: string | null
  urlLan: string | null
  urlVpn: string | null
  urlWan: string | null
}

export interface NavPayload {
  modules: Module[]
  settings: Record<string, string>
  version: string
}

export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiErr {
  ok: false
  error: string
  code: string
}

export interface ReorderItem {
  id: number
  sortOrder: number
  moduleId?: number
}

export const SITE_VERSION = '1.0.0'

/** 允许作为模块主题色的色板键，白名单校验，避免写库任意值 */
export const COLOR_KEYS = [
  'mint',
  'sky',
  'coral',
  'butter',
  'lilac',
  'peach',
  'rose',
  'teal',
] as const

export type ColorKey = (typeof COLOR_KEYS)[number]

/** 内置搜索引擎白名单。默认 google。 */
export const SEARCH_ENGINE_KEYS = ['google', 'baidu', 'bing'] as const

export const SETTING_DEFAULTS: Record<string, string> = {
  site_title: 'NaviGo',
  site_subtitle: '内网 · VPN · 外网，一处直达',
  fallback_wan: '1',
  password_changed: '0',
  search_engine: 'google',
  /** 1 = 模块按点击数自动排序；0 = 按手动拖拽的 sort_order */
  auto_sort_modules: '0',
}
