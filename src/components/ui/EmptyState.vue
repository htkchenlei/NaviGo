<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
  }>(),
  {},
)
</script>

<template>
  <div
    class="flex flex-col items-center gap-lg rounded-2xl bg-surface px-xl py-2xl text-center shadow-card nv-hairline"
  >
    <!-- 手绘 SVG 马卡龙堆叠：作为空态插图，不引入任何外部图片资源 -->
    <svg
      width="148"
      height="104"
      viewBox="0 0 148 104"
      role="img"
      aria-label="马卡龙插画"
      class="shrink-0"
    >
      <ellipse cx="74" cy="94" rx="52" ry="7" fill="var(--color-surface-3)" />
      <g>
        <path
          d="M28 78c0-9 7-16 16-16h36c9 0 16 7 16 16z"
          fill="var(--color-macaron-mint)"
          opacity="0.85"
        />
        <rect x="28" y="68" width="68" height="9" rx="4.5" fill="var(--color-macaron-butter)" />
        <path d="M28 68c0-10 8-18 18-18h32c10 0 18 8 18 18z" fill="var(--color-macaron-rose)" />
      </g>
      <g>
        <path d="M96 62c0-7 5-12 12-12h24c7 0 12 5 12 12z" fill="var(--color-macaron-sky)" />
        <rect x="96" y="54" width="48" height="8" rx="4" fill="var(--color-macaron-peach)" />
        <path d="M96 54c0-7 5-13 13-13h22c8 0 13 6 13 13z" fill="var(--color-macaron-lilac)" />
      </g>
      <g>
        <path d="M4 52c0-6 4-11 11-11h20c6 0 11 5 11 11z" fill="var(--color-macaron-teal)" />
        <rect x="4" y="45" width="42" height="7" rx="3.5" fill="var(--color-macaron-coral)" />
        <path d="M4 45c0-6 5-11 11-11h20c6 0 11 5 11 11z" fill="var(--color-macaron-butter)" />
      </g>
    </svg>

    <div class="flex max-w-prose flex-col gap-xs">
      <h3 class="text-lg text-ink">{{ title }}</h3>
      <p v-if="description" class="text-sm text-ink-2">{{ description }}</p>
    </div>

    <div v-if="$slots.action" class="flex flex-wrap items-center justify-center gap-sm">
      <slot name="action" />
    </div>
  </div>
</template>
