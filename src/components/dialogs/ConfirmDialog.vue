<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    detail?: string
    confirmLabel?: string
    tone?: 'danger' | 'primary'
    loading?: boolean
  }>(),
  { confirmLabel: '确认', tone: 'danger', loading: false },
)

const emit = defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <BaseDialog :open="open" :title="title" width="sm" @close="emit('close')">
    <div class="flex items-start gap-sm">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill"
        :class="tone === 'danger' ? 'bg-danger-soft text-danger-strong' : 'bg-accent-wash text-accent-strong'"
        aria-hidden="true"
      >
        <TriangleAlert :size="18" />
      </span>
      <div class="flex flex-col gap-xs">
        <p class="text-sm text-ink-2">{{ description }}</p>
        <p v-if="detail" class="text-xs text-ink-3">{{ detail }}</p>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
      <BaseButton :variant="tone === 'danger' ? 'danger' : 'solid'" :loading="loading" @click="emit('confirm')">
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
