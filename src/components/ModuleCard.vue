<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import LinkItem from '@/components/LinkItem.vue'
import { useNavStore } from '@/stores/nav'
import { swatchOf } from '@/utils/palette'
import type { NavLink, NavModule } from '@/api/types'

const props = defineProps<{
  module: NavModule
  manage: boolean
  index: number
  total: number
  /** 搜索命中的链接 id；null 表示未搜索 */
  visibleLinkIds?: Set<number> | null
}>()

const emit = defineEmits<{
  edit: []
  remove: []
  addLink: []
  editLink: [link: NavLink]
  removeLink: [link: NavLink]
}>()

const nav = useNavStore()
const swatch = computed(() => swatchOf(props.module.color))
const empty = computed(() => props.module.links.length === 0)

/** 搜索与拖拽不能同时用：隐藏的条目仍在 DOM 里，拖动会让排序结果变得不可预期 */
const dragDisabled = computed(() => !props.manage || nav.isFiltering)

function isVisible(link: NavLink): boolean {
  return !props.visibleLinkIds || props.visibleLinkIds.has(link.id)
}
</script>

<template>
  <section class="flex flex-col gap-sm">
    <header class="flex items-center gap-sm">
      <button
        v-if="manage"
        type="button"
        class="nv-module-grip flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-accent-strong active:cursor-grabbing"
        :aria-label="`拖动排序：${module.name}`"
        :title="`拖动排序：${module.name}`"
      >
        <GripVertical :size="16" aria-hidden="true" />
      </button>

      <span
        class="h-5 w-1.5 shrink-0 rounded-pill"
        :style="{ backgroundColor: swatch.solid }"
        aria-hidden="true"
      />

      <h2 class="min-w-0 truncate text-md text-ink">{{ module.name }}</h2>
      <span
        class="shrink-0 rounded-pill bg-surface-3 px-xs py-[2px] text-2xs font-semibold text-ink-2"
        :title="`共 ${module.links.length} 个地址`"
      >
        {{ module.links.length }}
      </span>

      <div v-if="manage" class="ml-auto flex shrink-0 items-center gap-2xs">
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="index === 0"
          :aria-label="`上移模块 ${module.name}`"
          title="上移模块"
          @click="nav.nudgeModule(module.id, -1)"
        >
          <ArrowUp :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="index >= total - 1"
          :aria-label="`下移模块 ${module.name}`"
          title="下移模块"
          @click="nav.nudgeModule(module.id, 1)"
        >
          <ArrowDown :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-accent-strong"
          :aria-label="`编辑模块 ${module.name}`"
          title="重命名 / 换色"
          @click="emit('edit')"
        >
          <Pencil :size="15" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-danger-soft hover:text-danger-strong"
          :aria-label="`删除模块 ${module.name}`"
          title="删除模块"
          @click="emit('remove')"
        >
          <Trash2 :size="15" aria-hidden="true" />
        </button>
      </div>
    </header>

    <VueDraggable
      v-model="props.module.links"
      tag="ul"
      :group="{ name: 'nav-links' }"
      handle=".nv-grip"
      :disabled="dragDisabled"
      :animation="180"
      ghost-class="nv-drop-target"
      chosen-class="nv-dragging"
      class="grid grid-cols-1 items-stretch gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      @end="nav.persistOrder()"
    >
      <LinkItem
        v-for="link in module.links"
        v-show="isVisible(link)"
        :key="link.id"
        :link="link"
        :manage="manage"
        :color-key="module.color"
        @edit="emit('editLink', link)"
        @remove="emit('removeLink', link)"
        @move="(step: number) => nav.nudgeLink(link.id, step)"
      />
      <!--
        虚拟的「添加」卡片，固定占在网格最后一位，代替原来模块底部那条整行按钮。
        它没有 .nv-grip，所以 handle 限定下拖不动；搜索过滤时隐藏，避免和筛选结果混在一起。
      -->
      <li v-if="manage && !nav.isFiltering" class="flex">
        <button
          type="button"
          class="flex h-full min-h-[5rem] w-full flex-col items-center justify-center gap-2xs rounded-lg border-2 border-dashed border-rule-strong text-sm font-semibold text-ink-2 transition-colors duration-short ease-out hover:border-accent-3 hover:bg-accent-wash hover:text-accent-strong"
          :aria-label="`向「${module.name}」添加链接`"
          @click="emit('addLink')"
        >
          <Plus :size="18" aria-hidden="true" />
          {{ empty ? '添加第一个链接' : '添加链接' }}
        </button>
      </li>
    </VueDraggable>
  </section>
</template>
