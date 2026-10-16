import type { AccessMode, ModeSource } from '@/api/types'

const STORAGE_KEY = 'navigo.mode'

export const MODE_META: { key: AccessMode; label: string; hint: string }[] = [
  { key: 'lan', label: '内网', hint: '按 192.168.x.x 等私网地址访问' },
  { key: 'vpn', label: 'VPN', hint: '按 100.66.x.x 等组网地址访问' },
  { key: 'wan', label: '外网', hint: '按公网域名或地址访问' },
]

function ipv4Parts(hostname: string): number[] | null {
  const matched = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!matched) return null
  const parts = matched.slice(1).map(Number)
  return parts.some((part) => part > 255) ? null : parts
}

/** 自动识别：私网段 → 内网；100.64.0.0/10（含 100.66.x.x）→ VPN；其余 → 外网 */
export function detectMode(hostname: string): AccessMode {
  const host = hostname.toLowerCase()
  const parts = ipv4Parts(host)
  if (parts) {
    const [a, b] = parts
    if (a === 100 && b >= 64 && b <= 127) return 'vpn'
    if (a === 10 || a === 127 || a === 0) return 'lan'
    if (a === 192 && b === 168) return 'lan'
    if (a === 172 && b >= 16 && b <= 31) return 'lan'
    if (a === 169 && b === 254) return 'lan'
    return 'wan'
  }
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return 'lan'
  return 'wan'
}

export function readManualMode(): AccessMode | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'lan' || raw === 'vpn' || raw === 'wan' ? raw : null
}

export function writeManualMode(mode: AccessMode): void {
  localStorage.setItem(STORAGE_KEY, mode)
}

export function clearManualMode(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function resolveInitialMode(): { mode: AccessMode; source: ModeSource } {
  const manual = readManualMode()
  if (manual) return { mode: manual, source: 'manual' }
  return { mode: detectMode(window.location.hostname), source: 'auto' }
}
