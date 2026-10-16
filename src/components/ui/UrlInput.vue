<script setup lang="ts">
import { computed, useId } from 'vue'
import { CircleAlert } from 'lucide-vue-next'
import ProtocolSelect from '@/components/ui/ProtocolSelect.vue'
import type { Protocol } from '@/utils/urlProtocol'

const props = withDefaults(
  defineProps<{
    /** 主机部分（含端口），不含协议 */
    modelValue: string
    protocol: Protocol
    label: string
    placeholder?: string
    hint?: string
    error?: string
    maxlength?: number
  }>(),
  { maxlength: 2048 },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:protocol': [value: Protocol]
  enter: []
}>()

const fieldId = `nv-${useId()}`
const describedBy = computed(() => {
  if (props.error) return `${fieldId}-error`
  if (props.hint) return `${fieldId}-hint`
  return undefined
})

/** 整块一起描边：协议下拉和输入框视觉上是同一个控件，聚焦谁都要亮同一圈 */
const groupClasses = computed(() => [
  'flex h-12 items-stretch rounded-md bg-surface',
  'ring-1 ring-inset transition-[box-shadow] duration-short ease-out',
  props.error
    ? 'ring-2 ring-danger'
    : 'ring-rule hover:ring-rule-strong focus-within:ring-2 focus-within:ring-accent',
])
</script>

<template>
  <div class="flex flex-col gap-2xs">
    <label :for="fieldId" class="text-sm font-semibold text-ink-2">{{ label }}</label>

    <div :class="groupClasses">
      <span
        v-if="$slots.prefix"
        class="flex shrink-0 items-center pl-sm text-ink-3"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>

      <span :class="$slots.prefix ? 'pl-2xs' : 'pl-xs'" class="flex items-center">
        <ProtocolSelect
          :model-value="protocol"
          :aria-label="`${label}的协议`"
          @update:model-value="emit('update:protocol', $event)"
        />
      </span>

      <span class="my-xs w-px shrink-0 bg-rule" aria-hidden="true" />

      <input
        :id="fieldId"
        :value="modelValue"
        type="text"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        :spellcheck="false"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="min-w-0 flex-1 bg-transparent px-sm text-base text-ink placeholder:text-ink-3 focus:outline-none"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keyup.enter="emit('enter')"
      />
    </div>

    <p
      v-if="error"
      :id="`${fieldId}-error`"
      class="flex items-center gap-2xs text-xs text-danger-strong"
    >
      <CircleAlert :size="14" aria-hidden="true" />
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${fieldId}-hint`" class="text-xs text-ink-3">{{ hint }}</p>
  </div>
</template>
