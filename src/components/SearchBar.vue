<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'

const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="relative flex items-center">
    <Search class="pointer-events-none absolute left-sm text-ink-3" :size="17" aria-hidden="true" />
    <input
      :value="modelValue"
      type="search"
      role="searchbox"
      :placeholder="placeholder ?? '搜索模块或网址'"
      aria-label="搜索模块或网址"
      class="h-11 w-full rounded-pill bg-surface pl-10 pr-10 text-sm text-ink ring-1 ring-inset ring-rule transition-[box-shadow] duration-short ease-out placeholder:text-ink-3 hover:ring-rule-strong focus:outline-none focus:ring-2 focus:ring-accent"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.escape="emit('update:modelValue', '')"
    />
    <button
      v-if="props.modelValue"
      type="button"
      class="absolute right-2xs flex h-9 w-9 items-center justify-center rounded-pill text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
      aria-label="清空搜索"
      title="清空搜索"
      @click="emit('update:modelValue', '')"
    >
      <X :size="15" aria-hidden="true" />
    </button>
  </div>
</template>
