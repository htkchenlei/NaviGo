<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { MACARON } from '@/utils/palette'

defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="flex flex-col gap-xs">
    <span class="text-sm font-semibold text-ink-2">模块主题色</span>
    <div class="flex flex-wrap gap-xs" role="radiogroup" aria-label="模块主题色">
      <button
        v-for="swatch in MACARON"
        :key="swatch.key"
        type="button"
        role="radio"
        :aria-checked="modelValue === swatch.key"
        :aria-label="swatch.label"
        :title="swatch.label"
        class="flex h-11 w-11 items-center justify-center rounded-pill ring-1 ring-inset ring-rule transition-[transform,box-shadow,background-color] duration-short ease-out hover:-translate-y-px hover:shadow-card"
        :style="{ backgroundColor: swatch.solid }"
        @click="emit('update:modelValue', swatch.key)"
      >
        <Check v-if="modelValue === swatch.key" :size="20" class="text-ink" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
