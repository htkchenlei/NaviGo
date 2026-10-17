export type ColorKey = 'mint' | 'sky' | 'coral' | 'butter' | 'lilac' | 'peach' | 'rose' | 'teal'

export type AccessMode = 'lan' | 'vpn' | 'wan'

export type ModeSource = 'auto' | 'manual'

export interface NavLink {
  id: number
  moduleId: number
  name: string
  /** 一句话说明，显示在名称下方；留空时回退显示域名 */
  description: string | null
  iconUrl: string | null
  urlLan: string | null
  urlVpn: string | null
  urlWan: string | null
}

export interface NavModule {
  id: number
  name: string
  color: ColorKey
  links: NavLink[]
}

export interface NavSettings {
  site_title: string
  site_subtitle: string
  fallback_wan: string
  password_changed: string
  [key: string]: string
}

export interface NavPayload {
  modules: NavModule[]
  settings: NavSettings
  version: string
}

export interface SessionInfo {
  username: string
  needsPasswordChange: boolean
}

export interface HealthInfo {
  db: string
  version: string
  userCount: number
  commit: string | null
  branch: string | null
  siteUrl: string | null
}

export interface ExportBundle {
  version: string
  exportedAt: string
  settings: Record<string, string>
  modules: {
    name: string
    color: string
    links: Omit<NavLink, 'id' | 'moduleId'>[]
  }[]
}

/** 脚本调接口用的 Bearer 令牌；默认 15 分钟有效，过期由服务端删行 */
export type TokenScope = 'read' | 'write'

export interface ApiTokenMeta {
  id: number
  name: string
  /** 明文前 8 位，形如 nvk_ab12cd34，用于掩码显示 */
  prefix: string
  /** 明文令牌，随时可查看/复制；旧令牌未存明文时为 null */
  token: string | null
  scopes: TokenScope[]
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
}

export interface IssuedApiToken extends ApiTokenMeta {
  token: string
}

export interface LinkPayload {
  name: string
  description: string | null
  iconUrl: string | null
  urlLan: string | null
  urlVpn: string | null
  urlWan: string | null
}
