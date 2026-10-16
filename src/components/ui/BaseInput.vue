<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { CircleAlert, Eye, EyeOff } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    type?: string
    placeholder?: string
    hint?: string
    error?: string
    autocomplete?: string
    disabled?: boolean
    maxlength?: number
    spellcheck?: boolean
  }>(),
  { type: 'text', disabled: false, spellcheck: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  enter: []
}>()

const fieldId = `nv-${useId()}`
const revealed = ref(false)
const isPassword = computed(() => props.type === 'password')
const inputType = computed(() => (isPassword.value && revealed.value ? 'text' : props.type))
const describedBy = computed(() => {
  if (props.error) return `${fieldId}-error`
  if (props.hint) return `${fieldId}-hint`
  return undefined
})

const fieldClasses = computed(() => [
  'h-12 w-full rounded-md bg-surface px-sm text-base text-ink',
  'ring-1 ring-inset transition-[box-shadow,border-color] duration-short ease-out',
  'placeholder:text-ink-3',
  'hover:ring-rule-strong',
  'focus:outline-none focus:ring-2 focus:ring-accent',
  'disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-3',
  props.error ? 'ring-2 ring-danger' : 'ring-rule',
  isPassword.value ? 'pr-12' : '',
])
</script>

<template>
  <div class="flex flex-col gap-2xs">
    <label :for="fieldId" class="text-sm font-semibold text-ink-2">{{ label }}</label>

    <div class="relative flex items-center">
      <span
        v-if="$slots.prefix"
        class="pointer-events-none absolute left-sm flex items-center text-ink-3"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>

      <input
        :id="fieldId"
        :value="modelValue"
        :type="inputType"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :maxlength="maxlength"
        :spellcheck="spellcheck"
        :class="[fieldClasses, $slots.prefix ? 'pl-10' : '']"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keyup.enter="emit('enter')"
      />

      <button
        v-if="isPassword"
        type="button"
        class="absolute right-2xs flex h-10 w-10 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
        :aria-label="revealed ? '隐藏密码' : '显示密码'"
        :title="revealed ? '隐藏密码' : '显示密码'"
        @click="revealed = !revealed"
      >
        <EyeOff v-if="revealed" :size="18" aria-hidden="true" />
        <Eye v-else :size="18" aria-hidden="true" />
      </button>
    </div>

    <p v-if="error" :id="`${fieldId}-error`" class="flex items-center gap-2xs text-xs text-danger-strong">
      <CircleAlert :size="14" aria-hidden="true" />
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${fieldId}-hint`" class="text-xs text-ink-3">{{ hint }}</p>
  </div>
</template>
