<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { SEARCH_ENGINES, engineOf } from '@/utils/searchEngines'
import type { SearchEngineKey } from '@/utils/searchEngines'

const props = withDefaults(defineProps<{ modelValue: string; disabled?: boolean }>(), {
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: SearchEngineKey] }>()

const LIST_ID = 'nv-engine-listbox'
const LAST = SEARCH_ENGINES.length - 1

const open = ref(false)
const activeIndex = ref(0)
const trigger = ref<HTMLButtonElement | null>(null)

const current = computed(() => engineOf(props.modelValue))

function optionId(index: number): string {
  return `nv-engine-option-${SEARCH_ENGINES[index].key}`
}

function indexOfCurrent(): number {
  const index = SEARCH_ENGINES.findIndex((engine) => engine.key === current.value.key)
  return index < 0 ? 0 : index
}

function openList(): void {
  open.value = true
  activeIndex.value = indexOfCurrent()
}

/** 关闭后把焦点还给触发器，键盘用户不会掉到页面开头 */
function closeList(restoreFocus = true): void {
  open.value = false
  if (restoreFocus) void nextTick(() => trigger.value?.focus())
}

function select(key: SearchEngineKey): void {
  if (key !== current.value.key) emit('update:modelValue', key)
  closeList()
}

/**
 * 键盘行为刻意对齐原生 <select>：上下键切换、Home/End 跳首尾、
 * Enter/空格 展开或选中、Esc 关闭。焦点始终留在触发器上，
 * 用 aria-activedescendant 告诉读屏软件当前高亮项。
 */
function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!open.value) openList()
      else activeIndex.value = activeIndex.value >= LAST ? 0 : activeIndex.value + 1
      return
    case 'ArrowUp':
      event.preventDefault()
      if (!open.value) openList()
      else activeIndex.value = activeIndex.value <= 0 ? LAST : activeIndex.value - 1
      return
    case 'Home':
      if (!open.value) return
      event.preventDefault()
      activeIndex.value = 0
      return
    case 'End':
      if (!open.value) return
      event.preventDefault()
      activeIndex.value = LAST
      return
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!open.value) openList()
      else select(SEARCH_ENGINES[activeIndex.value].key)
      return
    case 'Escape':
      if (!open.value) return
      event.preventDefault()
      closeList()
      return
    case 'Tab':
      if (open.value) closeList(false)
      return
    default:
  }
}

watch(
  () => props.modelValue,
  () => {
    if (open.value) activeIndex.value = indexOfCurrent()
  },
)
</script>

<template>
  <div class="relative shrink-0">
    <button
      ref="trigger"
      type="button"
      role="combobox"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="LIST_ID"
      :aria-activedescendant="open ? optionId(activeIndex) : undefined"
      :disabled="disabled"
      aria-label="选择搜索引擎"
      :title="`当前搜索引擎：${current.label}`"
      class="my-2xs ml-2xs flex h-9 items-center gap-2xs rounded-pill pl-2xs pr-xs text-xs font-semibold text-ink-2 transition-colors duration-short ease-out hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
      @click="open ? closeList() : openList()"
      @keydown="onKeydown"
    >
      <span
        :class="[
          'flex h-7 w-7 items-center justify-center rounded-pill font-display text-xs font-bold',
          current.markClass,
        ]"
        aria-hidden="true"
      >
        {{ current.mark }}
      </span>
      <span class="hidden max-w-[5.5rem] truncate sm:inline">{{ current.label }}</span>
      <ChevronDown
        :size="14"
        aria-hidden="true"
        class="transition-transform duration-short ease-out"
        :class="open ? 'rotate-180' : 'rotate-0'"
      />
    </button>

    <template v-if="open">
      <!-- 透明遮罩接管「点击外部关闭」，避免挂全局监听 -->
      <button
        type="button"
        class="fixed inset-0 z-dropdown cursor-default"
        aria-label="关闭引擎列表"
        tabindex="-1"
        @click="closeList(false)"
      />

      <ul
        :id="LIST_ID"
        role="listbox"
        aria-label="搜索引擎"
        class="absolute left-0 top-[calc(100%+0.5rem)] z-dropdown flex w-[12.5rem] flex-col gap-2xs rounded-lg bg-surface p-2xs shadow-lift ring-1 ring-inset ring-rule"
      >
        <li
          v-for="(item, index) in SEARCH_ENGINES"
          :id="optionId(index)"
          :key="item.key"
          role="option"
          :aria-selected="item.key === modelValue"
          :class="[
            'flex h-11 cursor-pointer items-center gap-sm rounded-sm px-sm text-sm font-semibold',
            'transition-colors duration-micro ease-out',
            index === activeIndex ? 'bg-accent-wash text-ink' : 'text-ink-2',
          ]"
          @mousedown.prevent
          @mousemove="activeIndex = index"
          @click="select(item.key)"
        >
          <span
            :class="[
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-pill font-display text-xs font-bold',
              item.markClass,
            ]"
            aria-hidden="true"
          >
            {{ item.mark }}
          </span>
          <span class="flex-1 truncate">{{ item.label }}</span>
          <Check
            v-if="item.key === modelValue"
            :size="15"
            class="shrink-0 text-accent-strong"
            aria-hidden="true"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
