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

export interface ModuleRow {
  id: number
  name: string
  color: string
  sort_order: number
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
}
