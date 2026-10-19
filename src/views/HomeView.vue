<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, GripVertical, Plus, RefreshCw, TriangleAlert } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import AppHeader from '@/components/AppHeader.vue'
import ModuleCard from '@/components/ModuleCard.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import ImportFromNavDialog from '@/components/dialogs/ImportFromNavDialog.vue'
import LinkDialog from '@/components/dialogs/LinkDialog.vue'
import ModuleDialog from '@/components/dialogs/ModuleDialog.vue'
import PasswordDialog from '@/components/dialogs/PasswordDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonGrid from '@/components/ui/SkeletonGrid.vue'
import WebSearchBar from '@/components/WebSearchBar.vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useNavStore } from '@/stores/nav'
import { useToastStore } from '@/stores/toast'
import { nextColor } from '@/utils/palette'
import type { NavLink, NavModule, NavScope } from '@/api/types'

const nav = useNavStore()
const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const route = useRoute()

/** 同一个组件服务两条路由：/ 读 public，/private 读 private */
const scope = computed<NavScope>(() => (route.meta.scope === 'private' ? 'private' : 'public'))
const isPrivate = computed(() => scope.value === 'private')

const moduleDialogOpen = ref(false)
const editingModule = ref<NavModule | null>(null)

const linkDialogOpen = ref(false)
const linkModuleId = ref(0)
const linkModuleName = ref('')
const editingLink = ref<NavLink | null>(null)

const passwordDialogOpen = ref(false)
const importDialogOpen = ref(false)

const confirmState = reactive({
  open: false,
  title: '',
  description: '',
  detail: '',
  confirmLabel: '确认',
  tone: 'danger' as 'danger' | 'primary',
  loading: false,
  run: () => {},
})

const subtitle = computed(() => nav.settings.site_subtitle || '')
const defaultColor = computed(() => {
  const last = nav.modules[nav.modules.length - 1]
  return last ? nextColor(last.color) : 'mint'
})
const showEmpty = computed(() => !nav.loading && !nav.loadError && nav.modules.length === 0)
const showNoResult = computed(
  () => !nav.loading && !nav.loadError && nav.modules.length > 0 && nav.visibleModules.length === 0,
)

onMounted(async () => {
  nav.initMode()
  await nav.load(scope.value)
})

// 两个路由复用同一个组件时（例如站内跳转），作用域变化要重新拉对应数据
watch(scope, (next) => {
  void nav.load(next)
})

function openCreateModule(): void {
  editingModule.value = null
  moduleDialogOpen.value = true
}

function openEditModule(module: NavModule): void {
  editingModule.value = module
  moduleDialogOpen.value = true
}

function openAddLink(module: NavModule): void {
  linkModuleId.value = module.id
  linkModuleName.value = module.name
  editingLink.value = null
  linkDialogOpen.value = true
}

function openEditLink(module: NavModule, link: NavLink): void {
  linkModuleId.value = module.id
  linkModuleName.value = module.name
  editingLink.value = link
  linkDialogOpen.value = true
}

function askRemoveModule(module: NavModule): void {
  confirmState.title = `删除模块「${module.name}」`
  confirmState.description = `模块里的 ${module.links.length} 个地址会被一并删除。`
  confirmState.detail = '该操作无法撤销。如果只是想换个分组名字，请用「编辑」。'
  confirmState.confirmLabel = '删除模块'
  confirmState.tone = 'danger'
  confirmState.run = async () => {
    confirmState.loading = true
    await nav.removeModule(module.id)
    confirmState.loading = false
    confirmState.open = false
  }
  confirmState.open = true
}

function askRemoveLink(link: NavLink): void {
  confirmState.title = `删除「${link.name}」`
  confirmState.description = '这条地址会从模块里移除。'
  confirmState.detail = '该操作无法撤销。'
  confirmState.confirmLabel = '删除地址'
  confirmState.tone = 'danger'
  confirmState.run = async () => {
    confirmState.loading = true
    await nav.removeLink(link.id)
    confirmState.loading = false
    confirmState.open = false
  }
  confirmState.open = true
}

function askLogout(): void {
  confirmState.title = '退出登录'
  confirmState.description = `确定要退出当前账号「${auth.username ?? ''}」吗？`
  confirmState.detail = '退出后需要重新输入账号密码，导航数据不受影响。'
  confirmState.confirmLabel = '退出登录'
  confirmState.tone = 'primary'
  confirmState.run = async () => {
    confirmState.loading = true
    await auth.logout()
    nav.resetLocal()
    confirmState.loading = false
    confirmState.open = false
    await router.replace({ name: 'login' })
  }
  confirmState.open = true
}

async function loadDemo(): Promise<void> {
  try {
    const payload = await api.loadDemo()
    nav.applyPayload(payload.modules, payload.settings)
    toast.success('已载入示例数据', '可以直接改成你自己的地址')
  } catch (error) {
    toast.error('载入示例数据失败', error instanceof Error ? error.message : undefined)
  }
}
</script>

<template>
  <div class="relative z-raised">
    <AppHeader @change-password="passwordDialogOpen = true" @logout="askLogout" />

    <main class="pt-[8.75rem] pb-2xl lg:pt-[6rem]">
      <div class="nv-shell flex flex-col gap-lg">
        <section class="flex flex-wrap items-end justify-between gap-md">
          <div class="flex min-w-0 flex-col gap-2xs">
            <h1 class="text-display text-ink">{{ nav.settings.site_title || 'NaviGo' }}</h1>
            <p v-if="subtitle" class="text-sm text-ink-2">{{ subtitle }}</p>
          </div>

          <div class="flex flex-wrap items-center gap-xs">
            <span
              class="rounded-pill bg-surface px-sm py-[6px] text-xs font-semibold text-ink-2 ring-1 ring-inset ring-rule"
            >
              {{ nav.modules.length }} 个模块 · {{ nav.totalLinks }} 个地址
            </span>
            <span
              class="flex items-center gap-2xs rounded-pill bg-surface px-sm py-[6px] text-xs font-semibold text-ink-2 ring-1 ring-inset ring-rule"
              :title="nav.modeMeta.hint"
            >
              <span class="h-1.5 w-1.5 rounded-pill bg-macaron-teal" aria-hidden="true" />
              {{ nav.modeMeta.label }}
            </span>
            <BaseButton
              v-if="nav.manage && isPrivate"
              variant="outline"
              size="sm"
              @click="importDialogOpen = true"
            >
              <template #icon><Download :size="15" /></template>
              从导航页导入
            </BaseButton>
            <BaseButton v-if="nav.manage" size="sm" @click="openCreateModule">
              <template #icon><Plus :size="15" /></template>
              新增模块
            </BaseButton>
          </div>
        </section>

        <WebSearchBar />

        <p
          v-if="auth.needsPasswordChange"
          class="flex flex-wrap items-center gap-sm rounded-lg bg-warning-soft px-md py-sm text-sm text-warning-strong"
          role="status"
        >
          <TriangleAlert :size="16" class="shrink-0" aria-hidden="true" />
          <span class="flex-1">你仍在使用默认密码 admin / admin，建议立即修改。</span>
          <button
            type="button"
            class="rounded-pill bg-surface px-sm py-[5px] text-xs font-semibold text-warning-strong ring-1 ring-inset ring-rule transition-colors duration-micro ease-out hover:bg-surface-2"
            @click="passwordDialogOpen = true"
          >
            去修改
          </button>
        </p>

        <p
          v-if="nav.manage && !nav.isFiltering"
          class="flex items-center gap-2xs rounded-lg bg-accent-wash px-md py-sm text-sm text-ink-2"
        >
          <GripVertical :size="15" class="shrink-0 text-accent-strong" aria-hidden="true" />
          <span v-if="isPrivate">
            私密页管理模式：这里的增删改只影响 /private，不会动到首页。可以用「从导航页导入」把首页的整个模块或单个网址复制过来。
          </span>
          <span v-else-if="nav.autoSortEnabled">
            自动排序已开启：模块按累计点击次数排列，拖拽暂时停用。想把某个模块钉在指定位次，请到「后台设置 → 模块排序」调整。
          </span>
          <span v-else>
            管理模式已开启：拖动手柄可以给模块和地址排序，排序结果会自动保存。
          </span>
        </p>

        <SkeletonGrid v-if="nav.loading && !nav.loaded" />

        <div
          v-else-if="nav.loadError"
          class="flex flex-wrap items-center justify-between gap-md rounded-xl bg-danger-soft px-lg py-lg"
        >
          <div class="flex flex-col gap-2xs">
            <p class="text-sm font-semibold text-danger-strong">加载导航数据失败</p>
            <p class="text-xs text-danger-strong">{{ nav.loadError }}</p>
          </div>
          <BaseButton variant="outline" @click="nav.load(scope)">
            <template #icon><RefreshCw :size="15" /></template>
            重试
          </BaseButton>
        </div>

        <EmptyState
          v-else-if="showEmpty"
          :title="isPrivate ? '私密页还没有内容' : '还没有任何模块'"
          :description="
            isPrivate
              ? '开启管理模式后，用「从导航页导入」把首页的整个模块或单个网址复制过来；也可以直接新建模块。'
              : '先建一个模块，把同一类地址放进去；也可以先载入一份示例数据找找感觉。'
          "
        >
          <template #action>
            <BaseButton @click="openCreateModule">
              <template #icon><Plus :size="16" /></template>
              创建第一个模块
            </BaseButton>
            <BaseButton v-if="!isPrivate" variant="outline" @click="loadDemo">载入示例数据</BaseButton>
          </template>
        </EmptyState>

        <EmptyState
          v-else-if="showNoResult"
          title="没有匹配的结果"
          :description="`没有找到与「${nav.query}」相关的模块或地址。`"
        >
          <template #action>
            <BaseButton variant="outline" @click="nav.query = ''">清空搜索</BaseButton>
          </template>
        </EmptyState>

        <VueDraggable
          v-else
          v-model="nav.modules"
          tag="div"
          handle=".nv-module-grip"
          :disabled="!nav.manage || nav.isFiltering || nav.autoSortEnabled"
          :animation="200"
          ghost-class="nv-drop-target"
          class="flex flex-col gap-xl"
          @end="nav.persistOrder()"
        >
          <ModuleCard
            v-for="(module, index) in nav.visibleModules"
            :key="module.id"
            :module="module"
            :manage="nav.manage"
            :index="index"
            :total="nav.visibleModules.length"
            :visible-link-ids="nav.visibleLinkIds"
            @edit="openEditModule(module)"
            @remove="askRemoveModule(module)"
            @add-link="openAddLink(module)"
            @edit-link="(link: NavLink) => openEditLink(module, link)"
            @remove-link="askRemoveLink"
          />
        </VueDraggable>

        <footer class="pt-md text-center text-xs text-ink-3">
          图标优先自动抓取，抓不到时用名称首字生成彩色标识 ——
          <RouterLink
            to="/admin"
            class="font-semibold text-accent-strong transition-colors duration-micro ease-out hover:text-accent"
          >
            前往后台设置
          </RouterLink>
        </footer>
      </div>
    </main>

    <ModuleDialog
      :open="moduleDialogOpen"
      :module="editingModule"
      :default-color="defaultColor"
      @close="moduleDialogOpen = false"
    />

    <LinkDialog
      :open="linkDialogOpen"
      :module-id="linkModuleId"
      :module-name="linkModuleName"
      :link="editingLink"
      @close="linkDialogOpen = false"
    />

    <ConfirmDialog
      :open="confirmState.open"
      :title="confirmState.title"
      :description="confirmState.description"
      :detail="confirmState.detail"
      :confirm-label="confirmState.confirmLabel"
      :tone="confirmState.tone"
      :loading="confirmState.loading"
      @close="confirmState.open = false"
      @confirm="confirmState.run"
    />

    <ImportFromNavDialog :open="importDialogOpen" @close="importDialogOpen = false" />

    <PasswordDialog :open="passwordDialogOpen" @close="passwordDialogOpen = false" />
  </div>
</template>
