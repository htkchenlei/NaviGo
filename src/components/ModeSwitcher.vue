<script setup lang="ts">
import { Wifi, Router, Globe, RefreshCw } from 'lucide-vue-next'
import { MODE_META } from '@/utils/hostMode'
import type { AccessMode, ModeSource } from '@/api/types'

const props = defineProps<{ mode: AccessMode; source: ModeSource }>()
const emit = defineEmits<{ select: [mode: AccessMode]; auto: [] }>()

const ICONS: Record<AccessMode, typeof Wifi> = {
  lan: Wifi,
  vpn: Router,
  wan: Globe,
}

function titleOf(key: AccessMode, hint: string): string {
  return props.mode === key && props.source === 'auto' ? `${hint}（当前为自动识别结果）` : hint
}
</script>

<template>
  <div class="flex items-center gap-2xs">
    <div
      class="flex items-center gap-2xs rounded-pill bg-surface-3 p-2xs ring-1 ring-inset ring-rule"
      role="radiogroup"
      aria-label="访问模式"
    >
      <button
        v-for="item in MODE_META"
        :key="item.key"
        type="button"
        role="radio"
        :aria-checked="mode === item.key"
        :title="titleOf(item.key, item.hint)"
        :class="[
          'flex h-9 items-center gap-2xs rounded-pill px-sm text-xs font-semibold whitespace-nowrap',
          'transition-[background-color,color,box-shadow] duration-short ease-out',
          mode === item.key
            ? 'bg-accent-strong text-accent-ink shadow-whisper'
            : 'text-ink-2 hover:bg-surface hover:text-ink',
        ]"
        @click="emit('select', item.key)"
      >
        <component :is="ICONS[item.key]" :size="15" aria-hidden="true" />
        <span class="hidden sm:inline">{{ item.label }}</span>
        <span class="sr-only sm:hidden">{{ item.label }}</span>
      </button>
    </div>

    <button
      v-if="source === 'manual'"
      type="button"
      class="flex h-10 w-10 items-center justify-center rounded-pill text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-accent-strong"
      title="恢复为按访问地址自动识别"
      aria-label="恢复为按访问地址自动识别"
      @click="emit('auto')"
    >
      <RefreshCw :size="15" aria-hidden="true" />
    </button>
  </div>
</template>
