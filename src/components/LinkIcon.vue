<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { extractInitial } from '@/utils/icon'
import { colorForName, swatchOf } from '@/utils/palette'

const props = withDefaults(
  defineProps<{
    name: string
    /** 图标来源链，按优先级排列；为空则直接走首字符兜底 */
    sources?: string[]
    colorKey?: string | null
    size?: number
  }>(),
  { sources: () => [], colorKey: null, size: 40 },
)

const cursor = ref(0)
const exhausted = ref(false)

watch(
  () => props.sources,
  () => {
    cursor.value = 0
    exhausted.value = false
  },
)

const initial = computed(() => extractInitial(props.name))
const swatch = computed(() => swatchOf(props.colorKey ?? colorForName(props.name)))
const current = computed(() => (exhausted.value ? null : props.sources[cursor.value] ?? null))
const fontSize = computed(() => `${Math.round(props.size * 0.42)}px`)

/**
 * 分层降级：逐个尝试来源链（服务端代理 → 公共 favicon 服务），
 * 全部失败后落回首字符头像。首字符始终垫在底层，避免图片加载期间出现空白抖动。
 */
function handleError(): void {
  if (cursor.value + 1 < props.sources.length) {
    cursor.value += 1
    return
  }
  exhausted.value = true
}
</script>

<template>
  <span
    class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-pill ring-1 ring-inset ring-rule transition-colors duration-short ease-out"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: swatch.soft,
    }"
  >
    <span
      class="font-display font-bold leading-none text-ink"
      :style="{ fontSize }"
      aria-hidden="true"
    >
      {{ initial }}
    </span>
    <img
      v-if="current"
      :src="current"
      alt=""
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      class="absolute inset-0 h-full w-full object-contain p-[5px]"
      @error="handleError"
    />
  </span>
</template>
