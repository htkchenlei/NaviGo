<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const TONES = {
  success: { icon: CircleCheck, tint: 'text-success-strong' },
  error: { icon: CircleAlert, tint: 'text-danger-strong' },
  info: { icon: Info, tint: 'text-accent-strong' },
} as const
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-md z-toast flex flex-col items-center gap-xs px-md sm:inset-x-auto sm:right-lg sm:items-end"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup name="toast">
      <div
        v-for="item in toast.items"
        :key="item.id"
        class="nv-glass pointer-events-auto flex w-full max-w-[24rem] items-start gap-sm rounded-lg px-md py-sm shadow-lift nv-hairline"
      >
        <component :is="TONES[item.tone].icon" :size="18" :class="['mt-[2px] shrink-0', TONES[item.tone].tint]" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 flex-col gap-2xs">
          <p class="text-sm font-semibold text-ink">{{ item.title }}</p>
          <p v-if="item.detail" class="text-xs break-words text-ink-2">{{ item.detail }}</p>
        </div>
        <button
          type="button"
          class="-mt-2xs -mr-2xs flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
          aria-label="关闭提示"
          @click="toast.dismiss(item.id)"
        >
          <X :size="15" aria-hidden="true" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
.toast-enter-active {
  transition: opacity var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
}
.toast-leave-active {
  transition: opacity calc(var(--dur-short) * 0.75) var(--ease-in),
    transform calc(var(--dur-short) * 0.75) var(--ease-in);
  position: absolute;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.toast-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
.toast-move {
  transition: transform var(--dur-short) var(--ease-out);
}
</style>
