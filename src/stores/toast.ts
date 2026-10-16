import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  detail?: string
}

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])
  let seq = 0

  function dismiss(id: number): void {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function push(tone: ToastTone, title: string, detail?: string): void {
    seq += 1
    const id = seq
    items.value = [...items.value, { id, tone, title, detail }].slice(-4)
    window.setTimeout(() => dismiss(id), tone === 'error' ? 5200 : 2600)
  }

  return {
    items,
    dismiss,
    success: (title: string, detail?: string) => push('success', title, detail),
    error: (title: string, detail?: string) => push('error', title, detail),
    info: (title: string, detail?: string) => push('info', title, detail),
  }
})
