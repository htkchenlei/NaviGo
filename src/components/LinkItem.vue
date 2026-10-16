<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, ExternalLink, Globe, GripVertical, Pencil, Trash2 } from 'lucide-vue-next'
import LinkIcon from '@/components/LinkIcon.vue'
import { useNavStore } from '@/stores/nav'
import { iconSources, safeDomain } from '@/utils/icon'
import type { NavLink } from '@/api/types'

const props = defineProps<{ link: NavLink; manage: boolean; colorKey: string }>()
const emit = defineEmits<{ edit: []; remove: []; move: [step: number] }>()

const nav = useNavStore()

const resolved = computed(() => nav.resolveLink(props.link.urlLan, props.link.urlVpn, props.link.urlWan))
const url = computed(() => resolved.value.url)
const degraded = computed(() => resolved.value.degraded)
const sources = computed(() => iconSources(props.link, url.value ?? props.link.urlWan))
const domain = computed(() => safeDomain(url.value) ?? '')

/** 管理模式或当前模式无可用地址时都不能当链接点，避免把用户送到错误地址 */
const clickable = computed(() => Boolean(url.value) && !props.manage)
const summary = computed(() => domain.value || '当前模式无可用地址')
</script>

<template>
  <li
    class="group relative flex items-center gap-2xs rounded-md px-xs py-xs transition-colors duration-short ease-out"
    :class="clickable || manage ? 'hover:bg-surface-3' : 'opacity-55'"
  >
    <button
      v-if="manage"
      type="button"
      class="nv-grip flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface hover:text-accent-strong active:cursor-grabbing"
      :aria-label="`拖动排序：${link.name}`"
      :title="`拖动排序：${link.name}`"
    >
      <GripVertical :size="16" aria-hidden="true" />
    </button>

    <component
      :is="clickable ? 'a' : 'div'"
      :href="clickable ? url : undefined"
      :target="clickable ? '_blank' : undefined"
      :rel="clickable ? 'noopener noreferrer' : undefined"
      :title="url ? `${link.name} — ${url}` : `${link.name}（当前模式无可用地址）`"
      class="flex min-w-0 flex-1 items-center gap-sm"
    >
      <LinkIcon :name="link.name" :sources="sources" :color-key="colorKey" :size="38" />
      <span class="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span class="flex items-center gap-2xs">
          <span class="truncate text-sm font-semibold text-ink">{{ link.name }}</span>
          <span
            v-if="degraded"
            class="flex shrink-0 items-center gap-[2px] rounded-pill bg-warning-soft px-[6px] py-[1px] text-2xs font-semibold text-warning-strong"
            title="当前模式没有专属地址，已回退到外网地址"
          >
            <Globe :size="10" aria-hidden="true" />
            外
          </span>
        </span>
        <span class="nv-url truncate text-ink-3">{{ summary }}</span>
      </span>
    </component>

    <template v-if="manage">
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface hover:text-ink"
        :aria-label="`上移 ${link.name}`"
        title="上移"
        @click="emit('move', -1)"
      >
        <ArrowUp :size="15" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface hover:text-ink"
        :aria-label="`下移 ${link.name}`"
        title="下移"
        @click="emit('move', 1)"
      >
        <ArrowDown :size="15" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface hover:text-accent-strong"
        :aria-label="`编辑 ${link.name}`"
        title="编辑"
        @click="emit('edit')"
      >
        <Pencil :size="15" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-danger-soft hover:text-danger-strong"
        :aria-label="`删除 ${link.name}`"
        title="删除"
        @click="emit('remove')"
      >
        <Trash2 :size="15" aria-hidden="true" />
      </button>
    </template>

    <ExternalLink
      v-else-if="clickable"
      :size="15"
      class="shrink-0 text-accent-strong opacity-0 transition-opacity duration-short ease-out group-hover:opacity-100"
      aria-hidden="true"
    />
  </li>
</template>
