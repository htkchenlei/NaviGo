<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    width?: 'sm' | 'md'
  }>(),
  { width: 'md' },
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
let restoreFocus: HTMLElement | null = null

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
  }
}

function lock(on: boolean): void {
  document.body.style.overflow = on ? 'hidden' : ''
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      restoreFocus = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown, true)
      lock(true)
      requestAnimationFrame(() => {
        const target =
          panel.value?.querySelector<HTMLElement>('input, textarea, select, button') ?? panel.value
        target?.focus()
      })
    } else {
      document.removeEventListener('keydown', onKeydown, true)
      lock(false)
      restoreFocus?.focus?.()
      restoreFocus = null
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true)
  lock(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog" appear>
      <div
        v-if="open"
        class="fixed inset-0 z-modal flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-md"
      >
        <div
          class="fixed inset-0 bg-ink/25 backdrop-blur-[3px]"
          aria-hidden="true"
          @click="emit('close')"
        />

        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          :class="[
            'nv-glass relative w-full rounded-t-2xl border-t-2 border-accent-3 shadow-modal sm:rounded-2xl sm:border-t-0',
            'nv-hairline max-h-[92vh] overflow-y-auto',
            width === 'sm' ? 'sm:max-w-[26rem]' : 'sm:max-w-[34rem]',
          ]"
        >
          <header class="flex items-start justify-between gap-md px-lg pt-lg pb-md">
            <div class="flex flex-col gap-2xs">
              <h2 class="text-lg text-ink">{{ title }}</h2>
              <p v-if="description" class="text-sm text-ink-2">{{ description }}</p>
            </div>
            <button
              type="button"
              class="-mr-2xs -mt-2xs flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
              aria-label="关闭"
              title="关闭"
              @click="emit('close')"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <div class="px-lg pb-lg">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="flex flex-col-reverse gap-sm px-lg pb-lg sm:flex-row sm:justify-end">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.dialog-enter-active {
  transition: opacity var(--dur-long) var(--ease-out);
}
.dialog-leave-active {
  transition: opacity calc(var(--dur-long) * 0.75) var(--ease-in);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-active [role='dialog'] {
  animation: pop-in var(--dur-long) var(--ease-out) both;
}
</style>
