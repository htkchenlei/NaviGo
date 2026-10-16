<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { PROTOCOLS } from '@/utils/urlProtocol'
import type { Protocol } from '@/utils/urlProtocol'

const props = withDefaults(defineProps<{ modelValue: Protocol; ariaLabel?: string }>(), {
  ariaLabel: '选择协议',
})

const emit = defineEmits<{ 'update:modelValue': [value: Protocol] }>()

/** 一个弹窗里会同时挂三个协议下拉，id 必须唯一，不能写成常量 */
const uid = useId()
const listId = `nv-protocol-list-${uid}`

const LAST = PROTOCOLS.length - 1
const MENU_W = 104
const MENU_H = 84

const open = ref(false)
const activeIndex = ref(0)
const trigger = ref<HTMLButtonElement | null>(null)
const anchor = ref({ left: 0, top: 0 })

function optionId(index: number): string {
  return `nv-protocol-${PROTOCOLS[index]}-${uid}`
}

function indexOfCurrent(): number {
  const index = PROTOCOLS.indexOf(props.modelValue)
  return index < 0 ? 0 : index
}

/**
 * 列表挂到 body 并用 fixed 定位。
 * 弹窗面板是 overflow-y-auto + backdrop-filter：前者会裁掉内部绝对定位的浮层，
 * 后者会把 fixed 后代的包含块换成面板自身。所以浮层必须脱离面板渲染，
 * 并且用 popover 层级盖在 modal 之上，否则会被弹窗挡住。
 */
function place(): void {
  const el = trigger.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const openUp = rect.bottom + MENU_H + 8 > window.innerHeight
  anchor.value = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_W - 8)),
    top: openUp ? Math.max(8, rect.top - MENU_H - 6) : rect.bottom + 6,
  }
}

/** 列表展开时按下 Esc 只收下拉，不该把整个弹窗连同用户填的内容一起关掉 */
function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  closeList()
}

function bindWindowListeners(on: boolean): void {
  if (on) {
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    window.addEventListener('keydown', onWindowKeydown, true)
    return
  }
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
  window.removeEventListener('keydown', onWindowKeydown, true)
}

function openList(): void {
  activeIndex.value = indexOfCurrent()
  open.value = true
  bindWindowListeners(true)
  void nextTick(place)
}

/** 关闭后把焦点还给触发器，键盘用户不会掉到页面开头 */
function closeList(restoreFocus = true): void {
  if (!open.value) return
  open.value = false
  bindWindowListeners(false)
  if (restoreFocus) void nextTick(() => trigger.value?.focus())
}

function select(protocol: Protocol): void {
  if (protocol !== props.modelValue) emit('update:modelValue', protocol)
  closeList()
}

/**
 * 键盘行为对齐原生 <select>：上下键切换、Home/End 跳首尾、
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
      else select(PROTOCOLS[activeIndex.value])
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

onBeforeUnmount(() => bindWindowListeners(false))
</script>

<template>
  <div class="flex shrink-0 items-center">
    <button
      ref="trigger"
      type="button"
      role="combobox"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="listId"
      :aria-activedescendant="open ? optionId(activeIndex) : undefined"
      :aria-label="ariaLabel"
      :title="`协议：${modelValue}`"
      class="flex h-8 items-center gap-[2px] rounded-sm px-2xs font-mono text-xs font-semibold text-ink-2 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
      @click="open ? closeList() : openList()"
      @keydown="onKeydown"
    >
      <span>{{ modelValue }}</span>
      <ChevronDown
        :size="13"
        aria-hidden="true"
        class="transition-transform duration-short ease-out"
        :class="open ? 'rotate-180' : 'rotate-0'"
      />
    </button>

    <Teleport to="body">
      <template v-if="open">
        <!-- 透明遮罩接管「点击外部关闭」，避免挂全局 click 监听 -->
        <button
          type="button"
          class="fixed inset-0 z-popover cursor-default"
          :aria-label="`关闭${ariaLabel}`"
          tabindex="-1"
          @click="closeList(false)"
        />

        <ul
          :id="listId"
          role="listbox"
          :aria-label="ariaLabel"
          class="fixed z-popover flex flex-col gap-2xs rounded-lg bg-surface p-2xs shadow-lift ring-1 ring-inset ring-rule"
          :style="{ left: `${anchor.left}px`, top: `${anchor.top}px`, width: `${MENU_W}px` }"
        >
          <li
            v-for="(item, index) in PROTOCOLS"
            :id="optionId(index)"
            :key="item"
            role="option"
            :aria-selected="item === modelValue"
            class="flex h-9 cursor-pointer items-center gap-sm rounded-sm px-sm font-mono text-sm font-semibold transition-colors duration-micro ease-out"
            :class="index === activeIndex ? 'bg-accent-wash text-ink' : 'text-ink-2'"
            @mousedown.prevent
            @mousemove="activeIndex = index"
            @click="select(item)"
          >
            <span class="flex-1">{{ item }}</span>
            <Check
              v-if="item === modelValue"
              :size="15"
              class="shrink-0 text-accent-strong"
              aria-hidden="true"
            />
          </li>
        </ul>
      </template>
    </Teleport>
  </div>
</template>
