<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LoaderCircle } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import { api } from '@/api/client'
import { useNavStore } from '@/stores/nav'
import { useToastStore } from '@/stores/toast'
import { swatchOf } from '@/utils/palette'
import type { LinkPayload, NavModule } from '@/api/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const nav = useNavStore()
const toast = useToastStore()

const modules = ref<NavModule[]>([])
const selected = ref<Set<number>>(new Set())
const loading = ref(false)
const importing = ref(false)
const error = ref('')

const selectedCount = computed(() => selected.value.size)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    loading.value = true
    error.value = ''
    selected.value = new Set()
    try {
      // 只读首页数据，不占用 store，避免把私密页的数据冲掉
      const payload = await api.fetchNav('public')
      modules.value = payload.modules
    } catch (err) {
      error.value = err instanceof Error ? err.message : '读取首页数据失败'
    } finally {
      loading.value = false
    }
  },
)

function isLinkSelected(id: number): boolean {
  return selected.value.has(id)
}

function moduleAllSelected(module: NavModule): boolean {
  return module.links.length > 0 && module.links.every((link) => selected.value.has(link.id))
}

function toggleLink(id: number): void {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleModule(module: NavModule): void {
  const next = new Set(selected.value)
  const all = moduleAllSelected(module)
  for (const link of module.links) {
    if (all) next.delete(link.id)
    else next.add(link.id)
  }
  selected.value = next
}

function toPayload(module: NavModule): { name: string; color: string; links: LinkPayload[] } {
  return {
    name: module.name,
    color: module.color,
    links: module.links
      .filter((link) => selected.value.has(link.id))
      .map(({ name, description, iconUrl, urlLan, urlVpn, urlWan }) => ({
        name,
        description,
        iconUrl,
        urlLan,
        urlVpn,
        urlWan,
      })),
  }
}

async function submit(): Promise<void> {
  if (selectedCount.value === 0 || importing.value) return
  const groups = modules.value.map(toPayload).filter((group) => group.links.length > 0)
  importing.value = true
  const ok = await nav.importGroups(groups)
  importing.value = false
  if (!ok) return
  toast.success(`已导入 ${selectedCount.value} 个地址`, '内容只出现在 /private 页面')
  emit('close')
}
</script>

<template>
  <BaseDialog
    :open="open"
    title="从导航页导入"
    description="勾选要复制到私密页的模块或单个网址；同名模块会直接追加进去。"
    width="md"
    @close="emit('close')"
  >
    <div v-if="loading" class="flex items-center gap-sm py-lg text-sm text-ink-2" role="status">
      <LoaderCircle :size="16" class="animate-spin" aria-hidden="true" />
      正在读取首页数据…
    </div>

    <p
      v-else-if="error"
      class="rounded-md bg-danger-soft px-md py-sm text-xs font-semibold text-danger-strong"
    >
      {{ error }}
    </p>

    <p v-else-if="modules.length === 0" class="text-sm text-ink-2">
      首页还没有任何模块，先去首页建好内容再来导入。
    </p>

    <ul v-else class="flex max-h-[52vh] flex-col gap-sm overflow-y-auto pr-2xs">
      <li v-for="module in modules" :key="module.id" class="rounded-md bg-surface-2 p-sm">
        <label class="flex items-center gap-sm">
          <input
            type="checkbox"
            class="h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-[var(--color-accent-strong)]"
            :checked="moduleAllSelected(module)"
            :disabled="module.links.length === 0"
            @change="toggleModule(module)"
          />
          <span
            class="h-3.5 w-1.5 shrink-0 rounded-pill"
            :style="{ backgroundColor: swatchOf(module.color).solid }"
            aria-hidden="true"
          />
          <span class="min-w-0 truncate text-sm font-semibold text-ink">{{ module.name }}</span>
          <span class="ml-auto shrink-0 text-xs text-ink-3">{{ module.links.length }} 个地址</span>
        </label>

        <ul v-if="module.links.length" class="mt-2xs flex flex-col gap-[2px] pl-6">
          <li v-for="link in module.links" :key="link.id">
            <label
              class="flex cursor-pointer items-center gap-sm rounded-sm px-xs py-[3px] transition-colors duration-micro ease-out hover:bg-surface-3"
            >
              <input
                type="checkbox"
                class="h-3.5 w-3.5 shrink-0 cursor-pointer rounded-sm accent-[var(--color-accent-strong)]"
                :checked="isLinkSelected(link.id)"
                @change="toggleLink(link.id)"
              />
              <span class="min-w-0 truncate text-xs text-ink">{{ link.name }}</span>
              <span v-if="link.description" class="ml-auto min-w-0 truncate text-2xs text-ink-3">
                {{ link.description }}
              </span>
            </label>
          </li>
        </ul>
      </li>
    </ul>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
      <BaseButton
        :loading="importing"
        :disabled="selectedCount === 0"
        @click="submit"
      >
        导入所选{{ selectedCount ? `（${selectedCount}）` : '' }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
