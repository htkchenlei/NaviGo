import type { ColorKey } from '@/api/types'

export interface MacaronSwatch {
  key: ColorKey
  label: string
  solid: string
  soft: string
}

/** 八色马卡龙色板。solid 只用于色条与图标头像等小面积识别元素，soft 用于卡片内的浅底 */
export const MACARON: MacaronSwatch[] = [
  { key: 'mint', label: '薄荷', solid: 'var(--color-macaron-mint)', soft: 'var(--color-macaron-mint-soft)' },
  { key: 'sky', label: '天蓝', solid: 'var(--color-macaron-sky)', soft: 'var(--color-macaron-sky-soft)' },
  { key: 'coral', label: '珊瑚', solid: 'var(--color-macaron-coral)', soft: 'var(--color-macaron-coral-soft)' },
  { key: 'butter', label: '奶油', solid: 'var(--color-macaron-butter)', soft: 'var(--color-macaron-butter-soft)' },
  { key: 'lilac', label: '淡紫', solid: 'var(--color-macaron-lilac)', soft: 'var(--color-macaron-lilac-soft)' },
  { key: 'peach', label: '蜜桃', solid: 'var(--color-macaron-peach)', soft: 'var(--color-macaron-peach-soft)' },
  { key: 'rose', label: '玫瑰', solid: 'var(--color-macaron-rose)', soft: 'var(--color-macaron-rose-soft)' },
  { key: 'teal', label: '青碧', solid: 'var(--color-macaron-teal)', soft: 'var(--color-macaron-teal-soft)' },
]

const FALLBACK = MACARON[0]

export function swatchOf(key: string | undefined): MacaronSwatch {
  return MACARON.find((item) => item.key === key) ?? FALLBACK
}

/** 名称 → 色板键的稳定散列：同一个站点名每次进来颜色一致，不会随机跳色 */
export function colorForName(name: string): ColorKey {
  let hash = 2166136261
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return MACARON[Math.abs(hash) % MACARON.length].key
}

export function nextColor(current: string): ColorKey {
  const index = MACARON.findIndex((item) => item.key === current)
  return MACARON[(index + 1 + MACARON.length) % MACARON.length].key
}
