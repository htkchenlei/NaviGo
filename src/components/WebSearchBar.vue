<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import SearchEngineSelect from '@/components/SearchEngineSelect.vue'
import { useNavStore } from '@/stores/nav'
import { buildSearchUrl, engineOf } from '@/utils/searchEngines'
import type { SearchEngineKey } from '@/utils/searchEngines'

const nav = useNavStore()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const engine = computed(() => engineOf(nav.settings.search_engine))
const canSubmit = computed(() => query.value.trim().length > 0)

/**
 * 引擎选择写回 settings（服务端），因此在任何设备上都保持一致；
 * 只有保存成功才会更新 store，失败时界面停在原引擎并弹提示，不会出现假的「已切换」。
 */
function onEngineChange(key: SearchEngineKey): void {
  void nav.updateSettings({ search_engine: key })
  inputRef.value?.focus()
}

function submit(): void {
  const keyword = query.value.trim()
  if (!keyword) return
  // noopener：新开的搜索页拿不到 window.opener，避免被反向控制原页面
  window.open(buildSearchUrl(engine.value, keyword), '_blank', 'noopener,noreferrer')
}

/** 按 / 快速聚焦搜索框；已经在输入框里打字时放行，不抢键 */
function onShortcut(event: KeyboardEvent): void {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
  event.preventDefault()
  inputRef.value?.focus()
}

onMounted(() => document.addEventListener('keydown', onShortcut))
onBeforeUnmount(() => document.removeEventListener('keydown', onShortcut))
</script>

<template>
  <form
    role="search"
    class="nv-hairline flex flex-wrap items-center gap-sm rounded-xl bg-surface p-sm shadow-card transition-shadow duration-short ease-out focus-within:shadow-lift"
    @submit.prevent="submit"
  >
    <!-- 引擎下拉嵌在输入框左侧，整条胶囊共用一层焦点环 -->
    <div
      class="flex h-12 min-w-[15rem] flex-1 items-center rounded-pill bg-surface-2 ring-1 ring-inset ring-rule transition-[box-shadow] duration-short ease-out hover:ring-rule-strong focus-within:ring-2 focus-within:ring-accent"
    >
      <SearchEngineSelect
        :model-value="nav.settings.search_engine"
        @update:model-value="onEngineChange"
      />

      <span class="h-6 w-px shrink-0 bg-rule" aria-hidden="true" />

      <input
        ref="inputRef"
        v-model="query"
        type="search"
        :placeholder="`${engine.placeholder}…`"
        :aria-label="`${engine.label} 搜索关键词`"
        class="h-full min-w-0 flex-1 border-0 bg-transparent px-sm text-base text-ink outline-none placeholder:text-ink-3"
      />

      <kbd
        class="mr-sm hidden shrink-0 rounded-xs bg-surface-3 px-[6px] py-[2px] font-mono text-2xs text-ink-3 lg:block"
        aria-hidden="true"
      >
        /
      </kbd>
    </div>

    <BaseButton
      type="submit"
      size="md"
      class="w-full sm:w-auto"
      :disabled="!canSubmit"
      title="在新标签页打开搜索结果"
    >
      <template #icon><Search :size="16" /></template>
      搜索
    </BaseButton>
  </form>
</template>
