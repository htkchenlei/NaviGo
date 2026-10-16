<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Database,
  Download,
  KeyRound,
  LogOut,
  RefreshCw,
  Save,
  Server,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import PasswordDialog from '@/components/dialogs/PasswordDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useNavStore } from '@/stores/nav'
import { useToastStore } from '@/stores/toast'
import type { ExportBundle, HealthInfo } from '@/api/types'

const nav = useNavStore()
const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()

const form = reactive({ title: '', subtitle: '', fallback: true })
const savingSite = ref(false)
const importing = ref(false)
const health = ref<HealthInfo | null>(null)
const healthError = ref('')
const passwordDialogOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

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

const cardClass = 'flex flex-col gap-lg rounded-xl bg-surface p-lg shadow-card nv-hairline'
const dirty = computed(
  () =>
    form.title !== (nav.settings.site_title ?? '') ||
    form.subtitle !== (nav.settings.site_subtitle ?? '') ||
    String(form.fallback) !== (nav.settings.fallback_wan !== '0' ? 'true' : 'false'),
)

onMounted(async () => {
  if (!nav.loaded) await nav.load()
  syncForm()
  await loadHealth()
})

function syncForm(): void {
  form.title = nav.settings.site_title ?? 'NaviGo'
  form.subtitle = nav.settings.site_subtitle ?? ''
  form.fallback = nav.settings.fallback_wan !== '0'
}

async function loadHealth(): Promise<void> {
  healthError.value = ''
  try {
    health.value = await api.health()
  } catch (error) {
    healthError.value = error instanceof Error ? error.message : '无法获取部署信息'
  }
}

async function saveSite(): Promise<void> {
  if (!form.title.trim()) {
    toast.error('站点标题不能为空')
    return
  }
  savingSite.value = true
  const ok = await nav.updateSettings({
    site_title: form.title.trim(),
    site_subtitle: form.subtitle.trim(),
    fallback_wan: form.fallback ? '1' : '0',
  })
  savingSite.value = false
  if (ok) toast.success('站点设置已保存')
}

async function exportData(): Promise<void> {
  try {
    const bundle = await api.exportData()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `navigo-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(href)
    toast.success('已导出配置文件', '这份 JSON 就是你的完整备份')
  } catch (error) {
    toast.error('导出失败', error instanceof Error ? error.message : undefined)
  }
}

function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importing.value = true
  try {
    const text = await file.text()
    const bundle = JSON.parse(text) as ExportBundle
    const payload = await api.importData(bundle)
    nav.applyPayload(payload.modules, payload.settings)
    syncForm()
    toast.success('已导入配置', `恢复 ${payload.modules.length} 个模块`)
  } catch (error) {
    toast.error('导入失败', error instanceof Error ? error.message : '文件不是合法的 NaviGo 备份')
  } finally {
    importing.value = false
  }
}

function askDemo(): void {
  confirmState.title = '载入示例数据'
  confirmState.description = '会用一份示例配置覆盖当前的模块与地址。'
  confirmState.detail = '建议先「导出配置」做一份备份，覆盖后无法撤销。'
  confirmState.confirmLabel = '覆盖并载入'
  confirmState.tone = 'primary'
  confirmState.run = async () => {
    confirmState.loading = true
    try {
      const payload = await api.loadDemo()
      nav.applyPayload(payload.modules, payload.settings)
      syncForm()
      toast.success('已载入示例数据')
    } catch (error) {
      toast.error('载入失败', error instanceof Error ? error.message : undefined)
    }
    confirmState.loading = false
    confirmState.open = false
  }
  confirmState.open = true
}

function askReset(): void {
  confirmState.title = '清空全部模块'
  confirmState.description = '所有模块与地址都会被删除，账号与设置保留。'
  confirmState.detail = '该操作无法撤销，请先导出备份。'
  confirmState.confirmLabel = '清空数据'
  confirmState.tone = 'danger'
  confirmState.run = async () => {
    confirmState.loading = true
    try {
      const bundle: ExportBundle = {
        version: nav.version,
        exportedAt: new Date().toISOString(),
        settings: { ...nav.settings },
        modules: [],
      }
      const payload = await api.importData(bundle)
      nav.applyPayload(payload.modules, payload.settings)
      toast.success('已清空全部模块')
    } catch (error) {
      toast.error('清空失败', error instanceof Error ? error.message : undefined)
    }
    confirmState.loading = false
    confirmState.open = false
  }
  confirmState.open = true
}

function askLogoutAll(): void {
  confirmState.title = '退出全部设备'
  confirmState.description = '所有设备上的登录状态都会立即失效，包括当前这台。'
  confirmState.detail = '之后需要重新输入账号密码登录。'
  confirmState.confirmLabel = '全部退出'
  confirmState.tone = 'danger'
  confirmState.run = async () => {
    confirmState.loading = true
    try {
      await api.logoutAll()
    } catch (error) {
      console.error('[navigo] 退出全部设备失败', error)
    }
    auth.reset()
    nav.resetLocal()
    confirmState.loading = false
    confirmState.open = false
    await router.replace({ name: 'login' })
  }
  confirmState.open = true
}

function askLogout(): void {
  confirmState.title = '退出登录'
  confirmState.description = `确定要退出当前账号「${auth.username ?? ''}」吗？`
  confirmState.detail = ''
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
</script>

<template>
  <div class="relative z-raised">
    <AppHeader @change-password="passwordDialogOpen = true" @logout="askLogout" />

    <main class="pt-[8.75rem] pb-2xl lg:pt-[6rem]">
      <div class="nv-shell flex max-w-[64rem] flex-col gap-lg">
        <header class="flex flex-wrap items-center justify-between gap-md">
          <div class="flex flex-col gap-2xs">
            <RouterLink
              to="/"
              class="flex items-center gap-2xs text-xs font-semibold text-ink-3 transition-colors duration-micro ease-out hover:text-accent-strong"
            >
              <ArrowLeft :size="13" aria-hidden="true" />
              返回导航
            </RouterLink>
            <h1 class="text-display-s text-ink">后台设置</h1>
            <p class="text-sm text-ink-2">站点信息、账号安全与数据备份都在这里。</p>
          </div>
          <span
            v-if="dirty"
            class="rounded-pill bg-warning-soft px-sm py-[6px] text-xs font-semibold text-warning-strong"
          >
            有未保存的改动
          </span>
        </header>

        <div class="grid grid-cols-1 items-start gap-lg lg:grid-cols-2">
          <section :class="cardClass">
            <div class="flex items-center gap-sm">
              <span class="flex h-10 w-10 items-center justify-center rounded-md bg-accent-wash text-accent-strong" aria-hidden="true">
                <Save :size="18" />
              </span>
              <div class="flex flex-col">
                <h2 class="text-md text-ink">站点设置</h2>
                <p class="text-xs text-ink-3">展示在导航页顶部的标题与副标题</p>
              </div>
            </div>

            <BaseInput v-model="form.title" label="站点标题" placeholder="NaviGo" :maxlength="40" />
            <BaseInput
              v-model="form.subtitle"
              label="站点副标题"
              placeholder="内网 · VPN · 外网，一处直达"
              :maxlength="80"
              hint="留空则不显示"
            />

            <div class="flex items-start justify-between gap-md rounded-md bg-surface-2 px-md py-sm">
              <div class="flex flex-col gap-2xs">
                <span class="text-sm font-semibold text-ink-2">允许回退到外网地址</span>
                <span class="text-xs text-ink-3">
                  内网 / VPN 模式下缺少专属地址时，改用外网地址并标注「外」。
                </span>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="form.fallback"
                aria-label="允许回退到外网地址"
                class="relative mt-2xs h-7 w-12 shrink-0 rounded-pill transition-colors duration-short ease-out"
                :class="form.fallback ? 'bg-accent-strong' : 'bg-rule-strong'"
                @click="form.fallback = !form.fallback"
              >
                <span
                  class="absolute top-[3px] h-[22px] w-[22px] rounded-pill bg-surface shadow-whisper transition-transform duration-short ease-out"
                  :style="{ left: '3px', transform: form.fallback ? 'translateX(20px)' : 'translateX(0)' }"
                />
              </button>
            </div>

            <BaseButton :loading="savingSite" @click="saveSite">
              <template #icon><Save :size="16" /></template>
              保存站点设置
            </BaseButton>
          </section>

          <section :class="cardClass">
            <div class="flex items-center gap-sm">
              <span class="flex h-10 w-10 items-center justify-center rounded-md bg-macaron-mint-soft text-success-strong" aria-hidden="true">
                <KeyRound :size="18" />
              </span>
              <div class="flex flex-col">
                <h2 class="text-md text-ink">账号安全</h2>
                <p class="text-xs text-ink-3">当前账号：{{ auth.username }}</p>
              </div>
            </div>

            <p class="rounded-md bg-surface-2 px-md py-sm text-xs text-ink-2">
              密码使用 PBKDF2-SHA256 加 10 万轮迭代加盐哈希后存入 D1，库里看不到明文；
              会话令牌同样只存哈希，并且是 HttpOnly Cookie。
            </p>

            <div class="flex flex-wrap gap-sm">
              <BaseButton variant="outline" @click="passwordDialogOpen = true">
                <template #icon><KeyRound :size="16" /></template>
                修改密码
              </BaseButton>
              <BaseButton variant="danger" @click="askLogoutAll">
                <template #icon><LogOut :size="16" /></template>
                退出全部设备
              </BaseButton>
            </div>
          </section>

          <section :class="cardClass">
            <div class="flex items-center gap-sm">
              <span class="flex h-10 w-10 items-center justify-center rounded-md bg-macaron-sky-soft text-accent-strong" aria-hidden="true">
                <Database :size="18" />
              </span>
              <div class="flex flex-col">
                <h2 class="text-md text-ink">数据管理</h2>
                <p class="text-xs text-ink-3">导出即备份，导入会覆盖当前配置</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-sm">
              <BaseButton variant="outline" @click="exportData">
                <template #icon><Download :size="16" /></template>
                导出配置
              </BaseButton>
              <BaseButton variant="outline" :loading="importing" @click="pickFile">
                <template #icon><Upload :size="16" /></template>
                导入配置
              </BaseButton>
              <BaseButton variant="ghost" @click="askDemo">
                <template #icon><Sparkles :size="16" /></template>
                载入示例数据
              </BaseButton>
              <BaseButton variant="danger" @click="askReset">
                <template #icon><Trash2 :size="16" /></template>
                清空全部模块
              </BaseButton>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept="application/json,.json"
              class="hidden"
              @change="onFileChange"
            />
          </section>

          <section :class="cardClass">
            <div class="flex items-center justify-between gap-sm">
              <div class="flex items-center gap-sm">
                <span class="flex h-10 w-10 items-center justify-center rounded-md bg-macaron-lilac-soft text-accent-strong" aria-hidden="true">
                  <Server :size="18" />
                </span>
                <div class="flex flex-col">
                  <h2 class="text-md text-ink">部署信息</h2>
                  <p class="text-xs text-ink-3">来自运行时的实时自检</p>
                </div>
              </div>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-md text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
                aria-label="刷新部署信息"
                title="刷新"
                @click="loadHealth"
              >
                <RefreshCw :size="16" aria-hidden="true" />
              </button>
            </div>

            <p v-if="healthError" class="rounded-md bg-danger-soft px-md py-sm text-xs text-danger-strong">
              {{ healthError }}
            </p>

            <dl v-else class="grid grid-cols-[auto_1fr] gap-x-md gap-y-xs text-xs">
              <dt class="text-ink-3">数据库</dt>
              <dd class="font-semibold text-success-strong">D1 已绑定（DB）</dd>
              <dt class="text-ink-3">版本</dt>
              <dd class="nv-url text-ink-2">{{ health?.version ?? nav.version }}</dd>
              <dt class="text-ink-3">账号数</dt>
              <dd class="nv-url text-ink-2">{{ health?.userCount ?? '—' }}</dd>
              <dt class="text-ink-3">构建提交</dt>
              <dd class="nv-url truncate text-ink-2">{{ health?.commit?.slice(0, 12) ?? '本地开发' }}</dd>
              <dt class="text-ink-3">分支</dt>
              <dd class="nv-url text-ink-2">{{ health?.branch ?? '—' }}</dd>
            </dl>

            <div class="flex flex-col gap-xs rounded-md bg-surface-2 px-md py-sm">
              <span class="nv-label">本地联调</span>
              <code class="nv-url text-ink-2">npm run cf:dev</code>
              <span class="nv-label">手动建表</span>
              <code class="nv-url text-ink-2">npm run db:init</code>
            </div>
          </section>
        </div>
      </div>
    </main>

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

    <PasswordDialog :open="passwordDialogOpen" @close="passwordDialogOpen = false" />
  </div>
</template>
