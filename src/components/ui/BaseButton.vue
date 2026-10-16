<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle } from 'lucide-vue-next'

type Variant = 'solid' | 'soft' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    block?: boolean
    ariaLabel?: string
    title?: string
  }>(),
  { variant: 'solid', size: 'md', type: 'button', loading: false, disabled: false, block: false },
)

/* 六种状态：default / hover / focus-visible（全局环）/ active / disabled / loading
   hover 只改阴影与位移，不改底色 —— 实心按钮的底色一旦变亮，标签对比度就会掉到 AA 以下 */
const VARIANTS: Record<Variant, string> = {
  solid:
    'bg-accent-strong text-accent-ink shadow-card hover:shadow-lift hover:-translate-y-px active:translate-y-0 active:shadow-whisper',
  soft: 'bg-accent-wash text-accent hover:bg-accent-3 hover:text-ink active:translate-y-0',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink active:translate-y-0',
  outline:
    'bg-surface text-ink ring-1 ring-inset ring-rule-strong hover:ring-accent-3 hover:text-accent-strong active:translate-y-0',
  danger: 'bg-danger-soft text-danger-strong hover:bg-danger hover:text-accent-ink active:translate-y-0',
}

const SIZES: Record<Size, string> = {
  sm: 'h-10 px-sm text-sm rounded-sm gap-2xs sm:h-9',
  md: 'h-11 px-md text-sm rounded-md gap-xs',
  lg: 'h-12 px-lg text-base rounded-md gap-xs',
}

const classes = computed(() => [
  'inline-flex items-center justify-center font-semibold whitespace-nowrap',
  'transition-[transform,box-shadow,background-color,color] duration-short ease-out',
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:translate-y-0',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    :title="title"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading" :size="16" class="animate-spin" aria-hidden="true" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
