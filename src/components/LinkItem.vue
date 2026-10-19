<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Globe,
  GripVertical,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
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

/**
 * 有描述就显示描述，没填就退回显示域名。
 * 兜底文案保证每张卡片都是两行，网格里不会出现高低错落。
 */
const summary = computed(
  () => props.link.description || domain.value || '当前模式无可用地址',
)
/** 摘要显示的是域名（而非描述）时用等宽字体，让地址更易扫读 */
const summaryIsDomain = computed(() => !props.link.description && Boolean(domain.value))
const tooltip = computed(() =>
  url.value ? `${props.link.name} — ${url.value}` : `${props.link.name}（当前模式无可用地址）`,
)

/** 只做热度上报，不拦截跳转；失败也静默，绝不能影响打开地址 */
function onClick(): void {
  if (clickable.value) nav.trackClick(props.link.id)
}
</script>

<template>
  <!-- 管理模式：卡片不可点击，底部让出一排操作按钮；不依赖 hover，触屏也能用 -->
  <li
    v-if="manage"
    class="flex h-full flex-col gap-xs rounded-lg bg-surface p-sm ring-1 ring-inset ring-rule shadow-whisper"
  >
    <div class="flex items-center gap-sm">
      <button
        type="button"
        class="nv-grip flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-accent-strong active:cursor-grabbing"
        :aria-label="`拖动排序：${link.name}`"
        :title="`拖动排序：${link.name}`"
      >
        <GripVertical :size="16" aria-hidden="true" />
      </button>

      <LinkIcon :name="link.name" :sources="sources" :color-key="colorKey" :size="38" />

      <div class="flex min-w-0 flex-1 flex-col gap-3xs">
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
        <span
          class="truncate text-xs text-ink-3"
          :class="summaryIsDomain ? 'nv-url' : ''"
          :title="summary"
        >
          {{ summary }}
        </span>
      </div>
    </div>

    <div class="mt-auto flex items-center justify-end gap-2xs border-t border-rule pt-2xs">
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
        :aria-label="`上移 ${link.name}`"
        title="上移"
        @click="emit('move', -1)"
      >
        <ArrowUp :size="15" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
        :aria-label="`下移 ${link.name}`"
        title="下移"
        @click="emit('move', 1)"
      >
        <ArrowDown :size="15" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-accent-strong"
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
    </div>
  </li>

  <!-- 浏览模式：整块就是链接 -->
  <li v-else class="group flex">
    <component
      :is="clickable ? 'a' : 'div'"
      :href="clickable ? url : undefined"
      :target="clickable ? '_blank' : undefined"
      :rel="clickable ? 'noopener noreferrer' : undefined"
      :title="tooltip"
      @click="onClick"
      class="flex h-full w-full items-center gap-sm rounded-lg bg-surface p-sm ring-1 ring-inset ring-rule shadow-whisper transition-[box-shadow,transform] duration-short ease-out"
      :class="clickable ? 'hover:-translate-y-0.5 hover:shadow-card' : 'opacity-55'"
    >
      <LinkIcon :name="link.name" :sources="sources" :color-key="colorKey" :size="40" />

      <span class="flex min-w-0 flex-1 flex-col gap-3xs">
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
        <span
          class="truncate text-xs text-ink-3"
          :class="summaryIsDomain ? 'nv-url' : ''"
          :title="summary"
        >
          {{ summary }}
        </span>
      </span>

      <ExternalLink
        v-if="clickable"
        :size="15"
        class="shrink-0 text-accent-strong opacity-0 transition-opacity duration-short ease-out group-hover:opacity-100"
        aria-hidden="true"
      />
    </component>
  </li>
</template>
