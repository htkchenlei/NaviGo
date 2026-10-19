import type {
  ApiTokenMeta,
  ExportBundle,
  HealthInfo,
  IssuedApiToken,
  LinkPayload,
  NavModule,
  NavPayload,
  NavScope,
  SessionInfo,
  TokenScope,
} from './types'

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

let unauthorizedHandler: (() => void) | null = null

/** 会话失效时由 client 统一通知上层跳登录，避免每个 store 各写一遍 */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: 'include',
    headers: init.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  })

  if (response.status === 401) {
    unauthorizedHandler?.()
    throw new ApiError('登录状态已失效，请重新登录', 401, 'unauthorized')
  }

  const text = await response.text()
  let parsed: { ok?: boolean; data?: T; error?: string; code?: string } = {}
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[navigo] 服务端返回了非 JSON 内容', response.status, text.slice(0, 200))
      throw new ApiError(`服务端返回异常（HTTP ${response.status}）`, response.status, 'invalid_response')
    }
  }

  if (!response.ok || parsed.ok === false) {
    throw new ApiError(parsed.error || `请求失败（HTTP ${response.status}）`, response.status, parsed.code || 'error')
  }

  return parsed.data as T
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body === undefined ? '{}' : JSON.stringify(body) })
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export const api = {
  health: () => request<HealthInfo>('health'),

  login: (username: string, password: string) =>
    request<{ username: string }>('auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => post<{ ok: boolean }>('auth/logout'),
  logoutAll: () => post<{ revoked: boolean }>('auth/logout-all'),
  me: () => request<SessionInfo>('auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ changed: boolean }>('auth/password', { currentPassword, newPassword }),

  fetchNav: (scope: NavScope = 'public') =>
    request<NavPayload>(scope === 'private' ? 'nav?scope=private' : 'nav'),

  createModule: (name: string, color: string, scope: NavScope = 'public') =>
    post<NavModule>('modules', { name, color, scope }),
  updateModule: (
    id: number,
    patch: { name?: string; color?: string; pinnedRank?: number | null },
  ) => put<unknown>(`modules/${id}`, patch),
  deleteModule: (id: number) => request<unknown>(`modules/${id}`, { method: 'DELETE' }),

  createLink: (moduleId: number, payload: LinkPayload) => post<unknown>('links', { moduleId, ...payload }),
  updateLink: (id: number, payload: Partial<LinkPayload>) => put<unknown>(`links/${id}`, payload),
  deleteLink: (id: number) => request<unknown>(`links/${id}`, { method: 'DELETE' }),
  /** 点击热度上报：只累加所属模块的计数 */
  trackLinkClick: (id: number) =>
    post<{ moduleId: number; clicks: number }>(`links/${id}/click`),

  reorder: (payload: {
    modules?: { id: number; sortOrder: number }[]
    links?: { id: number; moduleId: number; sortOrder: number }[]
  }) => post<{ updated: number }>('reorder', payload),

  saveSettings: (values: Record<string, string>) => post<Record<string, string>>('settings', values),

  listTokens: () => request<{ tokens: ApiTokenMeta[] }>('tokens'),
  /** 不传 expiresInMinutes 就等于默认 15 分钟；传 null 表示永不过期 */
  createToken: (input: { name: string; scopes: TokenScope[]; expiresInMinutes: number | null }) =>
    post<IssuedApiToken>('tokens', input),
  revokeToken: (id: number) => request<unknown>(`tokens/${id}`, { method: 'DELETE' }),

  exportData: () => request<ExportBundle>('export'),
  importData: (bundle: ExportBundle) => post<NavPayload>('import', bundle),
  loadDemo: () => post<NavPayload>('demo'),
}

/** 图标代理地址。v 参数由图标 URL 派生，图标换源时自动击穿浏览器缓存 */
export function proxiedIconUrl(domain: string, version: string): string {
  return `/api/icon?domain=${encodeURIComponent(domain)}&v=${encodeURIComponent(version)}`
}
