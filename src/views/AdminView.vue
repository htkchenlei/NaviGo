<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  ListOrdered,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Server,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import PasswordDialog from '@/components/dialogs/PasswordDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { api } from '@/api/client'
import { swatchOf } from '@/utils/palette'
import { useAuthStore } from '@/stores/auth'
import { useNavStore } from '@/stores/nav'
import { useToastStore } from '@/stores/toast'
import type { ApiTokenMeta, ExportBundle, HealthInfo, TokenScope } from '@/api/types'

const nav = useNavStore()
const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()

const form = reactive({ title: '', subtitle: '', fallback: true, autoSort: false })
const savingSite = ref(false)
const importing = ref(false)
const health = ref<HealthInfo | null>(null)
const healthError = ref('')
const passwordDialogOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

/* ── API 令牌 ────────────────────────────────────────────────────── */
const tokens = ref<ApiTokenMeta[]>([])
const tokensLoading = ref(false)
const creatingToken = ref(false)
/** 同一时刻只展开一枚，默认全部是掩码，避免整屏明文 */
const revealedId = ref<number | null>(null)
const copiedId = ref<number | null>(null)
const tokenForm = reactive({ name: '', write: true, minutes: 15 })

/** 默认 15 分钟：够跑完一次脚本，过期后服务端直接删行，不用手动清理 */
const EXPIRY_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 60, label: '1 小时' },
  { value: 1440, label: '1 天' },
  { value: 10080, label: '7 天' },
  { value: 0, label: '永不过期' },
]

const MASK = '••••••••••••'

const pillClass = (active: boolean): string =>
  [
    'rounded-pill px-sm py-[6px] text-xs font-semibold transition-colors duration-micro ease-out',
    active
      ? 'bg-accent-strong text-accent-ink'
      : 'bg-surface text-ink-2 ring-1 ring-inset ring-rule hover:text-ink',
  ].join(' ')

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
    String(form.fallback) !== (nav.settings.fallback_wan !== '0' ? 'true' : 'false') ||
    String(form.autoSort) !== (nav.settings.auto_sort_modules === '1' ? 'true' : 'false'),
)

onMounted(async () => {
  if (!nav.loaded) await nav.load()
  syncForm()
  await loadHealth()
  void loadTokens()
})

function syncForm(): void {
  form.title = nav.settings.site_title ?? 'NaviGo'
  form.subtitle = nav.settings.site_subtitle ?? ''
  form.fallback = nav.settings.fallback_wan !== '0'
  form.autoSort = nav.settings.auto_sort_modules === '1'
}

/** 按导航页真实展示顺序列出模块，改完位次立刻能看到新排序 */
const rankedModules = computed(() => nav.orderedModules)

async function pinModule(id: number, event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement
  const raw = select.value
  const name = nav.modules.find((module) => module.id === id)?.name ?? ''
  const ok = await nav.setModulePin(id, raw ? Number(raw) : null)
  if (!ok) {
    // 保存失败时把下拉框拨回库里的真实值
    const current = nav.modules.find((module) => module.id === id)
    select.value = current?.pinnedRank ? String(current.pinnedRank) : ''
    return
  }
  if (raw && !nav.autoSortEnabled) {
    // 位次已经写库，但自动排序没开时它不会改变任何显示顺序，必须说清楚
    toast.info(
      `已记录「${name}」固定在第 ${raw} 位`,
      '但「自动调整模块顺序」还没开启并保存，现在排序不会变化。',
    )
    return
  }
  toast.success(raw ? `已把「${name}」固定在第 ${raw} 位` : `「${name}」已取消固定`)
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
    auto_sort_modules: form.autoSort ? '1' : '0',
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

/* ── API 令牌 ────────────────────────────────────────────────────── */

async function loadTokens(): Promise<void> {
  tokensLoading.value = true
  try {
    tokens.value = (await api.listTokens()).tokens
  } catch (error) {
    toast.error('读取令牌列表失败', error instanceof Error ? error.message : undefined)
  }
  tokensLoading.value = false
}

async function createToken(): Promise<void> {
  if (!tokenForm.name.trim()) {
    toast.error('先给令牌起个名字，日后才认得出是哪台设备在用')
    return
  }
  creatingToken.value = true
  try {
    const scopes: TokenScope[] = tokenForm.write ? ['read', 'write'] : ['read']
    const issued = await api.createToken({
      name: tokenForm.name.trim(),
      scopes,
      expiresInMinutes: tokenForm.minutes || null,
    })
    tokenForm.name = ''
    await loadTokens()
    // 刚生成的那枚自动展开方便立刻复制，其余保持掩码
    revealedId.value = issued.id
    toast.success(
      '令牌已生成',
      tokenForm.minutes ? `${tokenForm.minutes} 分钟后自动失效并清理` : '永不过期，用完记得吊销',
    )
  } catch (error) {
    toast.error('生成令牌失败', error instanceof Error ? error.message : undefined)
  }
  creatingToken.value = false
}

/** 列表里默认只露前缀，后面一律掩码 */
function maskOf(token: ApiTokenMeta): string {
  return `${token.prefix}${MASK}`
}

function toggleReveal(token: ApiTokenMeta): void {
  if (!token.token) {
    toast.error('这枚令牌签发于旧版本，库里没有可回读的明文，吊销后重新生成即可')
    return
  }
  revealedId.value = revealedId.value === token.id ? null : token.id
}

async function copyToken(token: ApiTokenMeta): Promise<void> {
  if (!token.token) {
    toast.error('这枚令牌没有可回读的明文，吊销后重新生成即可')
    return
  }
  try {
    await navigator.clipboard.writeText(token.token)
    copiedId.value = token.id
    window.setTimeout(() => {
      if (copiedId.value === token.id) copiedId.value = null
    }, 1600)
  } catch {
    // 非安全上下文或拒绝剪贴板权限时，让用户点眼睛展开后自己选中
    toast.error('自动复制被浏览器拦下了，请展开后手动选中复制')
  }
}

function askRevokeToken(token: ApiTokenMeta): void {
  confirmState.title = `吊销「${token.name}」`
  confirmState.description = `以 ${token.prefix} 开头的令牌会立即失效，正在用它的脚本下次请求就会收到 401。`
  confirmState.detail = '吊销无法撤销，需要时只能重新生成一枚。'
  confirmState.confirmLabel = '吊销令牌'
  confirmState.tone = 'danger'
  confirmState.run = async () => {
    confirmState.loading = true
    try {
      await api.revokeToken(token.id)
      await loadTokens()
      toast.success('令牌已吊销')
    } catch (error) {
      toast.error('吊销失败', error instanceof Error ? error.message : undefined)
    }
    confirmState.loading = false
    confirmState.open = false
  }
  confirmState.open = true
}

function formatTime(seconds: number | null): string {
  if (!seconds) return '从未'
  return new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false })
}

function expiryOf(token: ApiTokenMeta): string {
  return token.expiresAt ? formatTime(token.expiresAt) : '永不过期'
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

            <div class="flex items-start justify-between gap-md rounded-md bg-surface-2 px-md py-sm">
              <div class="flex flex-col gap-2xs">
                <span class="text-sm font-semibold text-ink-2">自动调整模块顺序</span>
                <span class="text-xs text-ink-3">
                  按模块的累计点击次数排序，点得越多越靠前；开启后可在导航页管理模式里把某个模块固定到指定位置。
                </span>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="form.autoSort"
                aria-label="自动调整模块顺序"
                class="relative mt-2xs h-7 w-12 shrink-0 rounded-pill transition-colors duration-short ease-out"
                :class="form.autoSort ? 'bg-accent-strong' : 'bg-rule-strong'"
                @click="form.autoSort = !form.autoSort"
              >
                <span
                  class="absolute top-[3px] h-[22px] w-[22px] rounded-pill bg-surface shadow-whisper transition-transform duration-short ease-out"
                  :style="{ left: '3px', transform: form.autoSort ? 'translateX(20px)' : 'translateX(0)' }"
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

          <section :class="[cardClass, 'lg:col-span-2']">
            <div class="flex items-center gap-sm">
              <span class="flex h-10 w-10 items-center justify-center rounded-md bg-macaron-lilac-soft text-accent-strong" aria-hidden="true">
                <ListOrdered :size="18" />
              </span>
              <div class="flex flex-col">
                <h2 class="text-md text-ink">模块排序</h2>
                <p class="text-xs text-ink-3">
                  按累计点击数自动排列；也可以把某个模块钉死在指定位次，改完立即生效
                </p>
              </div>
            </div>

            <p
              v-if="!nav.autoSortEnabled"
              class="rounded-md bg-warning-soft px-md py-sm text-xs text-warning-strong"
            >
              当前「自动调整模块顺序」是关闭的，固定位次不会生效。到上方「站点设置」打开开关并保存后，这里的选择才会起作用。
            </p>

            <ul v-if="rankedModules.length" class="flex flex-col gap-2xs">
              <li
                v-for="(module, index) in rankedModules"
                :key="module.id"
                class="flex flex-wrap items-center gap-sm rounded-md bg-surface-2 px-md py-sm"
              >
                <span
                  class="w-6 shrink-0 text-center text-sm font-semibold text-ink-2"
                  :title="`当前实际排第 ${index + 1} 位`"
                >
                  {{ index + 1 }}
                </span>
                <span
                  class="h-4 w-1.5 shrink-0 rounded-pill"
                  :style="{ backgroundColor: swatchOf(module.color).solid }"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {{ module.name }}
                </span>
                <span class="shrink-0 text-xs text-ink-3">点击 {{ module.clicks }}</span>
                <select
                  :value="module.pinnedRank ?? ''"
                  class="h-9 shrink-0 rounded-sm bg-surface px-xs text-xs text-ink ring-1 ring-inset ring-rule-strong transition-colors duration-micro ease-out hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent-3"
                  :aria-label="`固定「${module.name}」的排序位置`"
                  @change="pinModule(module.id, $event)"
                >
                  <option value="">不固定</option>
                  <option v-for="n in nav.modules.length" :key="n" :value="n">第 {{ n }} 位</option>
                </select>
              </li>
            </ul>
            <p v-else class="text-xs text-ink-3">还没有模块，先去导航页创建模块。</p>
          </section>

          <section :class="[cardClass, 'lg:col-span-2']">
            <div class="flex items-center gap-sm">
              <span class="flex h-10 w-10 items-center justify-center rounded-md bg-macaron-butter-soft text-warning-strong" aria-hidden="true">
                <Terminal :size="18" />
              </span>
              <div class="flex flex-col">
                <h2 class="text-md text-ink">API 访问</h2>
                <p class="text-xs text-ink-3">脚本、快捷指令、自动化平台用 Bearer 令牌调用 /api</p>
              </div>
              <RouterLink
                to="/admin/api"
                class="ml-auto flex items-center gap-2xs rounded-pill bg-surface-2 px-sm py-[6px] text-xs font-semibold text-ink-2 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-accent-strong"
              >
                <Terminal :size="13" aria-hidden="true" />
                接口文档
              </RouterLink>
            </div>

            <p class="rounded-md bg-surface-2 px-md py-sm text-xs text-ink-2">
              请求带上 <code class="nv-url">Authorization: Bearer &lt;令牌&gt;</code> 就能免登录调用，
              可对模块与地址增删改查。令牌只能碰数据：改密码、管理令牌仍然只能在浏览器里操作。
              默认 <span class="font-semibold text-ink-2">15 分钟</span>后失效，过期即从库里删掉，不用手动清理；
              列表里默认是掩码，随时可以点眼睛查看、或直接复制。
            </p>

            <div class="flex flex-col gap-sm rounded-md bg-surface-2 p-md">
              <BaseInput
                v-model="tokenForm.name"
                label="令牌名称"
                placeholder="例如：快捷指令 / 群晖计划任务"
                :maxlength="40"
              />
              <div class="flex flex-wrap items-end gap-md">
                <div class="flex flex-col gap-2xs">
                  <span class="nv-label">权限</span>
                  <div class="flex gap-2xs">
                    <button type="button" :class="pillClass(!tokenForm.write)" @click="tokenForm.write = false">
                      只读
                    </button>
                    <button type="button" :class="pillClass(tokenForm.write)" @click="tokenForm.write = true">
                      读写
                    </button>
                  </div>
                </div>
                <div class="flex flex-col gap-2xs">
                  <span class="nv-label">有效期</span>
                  <div class="flex flex-wrap gap-2xs">
                    <button
                      v-for="option in EXPIRY_OPTIONS"
                      :key="option.value"
                      type="button"
                      :class="pillClass(tokenForm.minutes === option.value)"
                      @click="tokenForm.minutes = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
                <BaseButton :loading="creatingToken" @click="createToken">
                  <template #icon><Plus :size="16" /></template>
                  生成令牌
                </BaseButton>
              </div>
            </div>

            <div class="flex flex-col gap-sm">
              <div class="flex items-center justify-between gap-sm">
                <span class="nv-label">已签发的令牌</span>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-sm text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
                  aria-label="刷新令牌列表"
                  title="刷新"
                  :disabled="tokensLoading"
                  @click="loadTokens"
                >
                  <RefreshCw :size="14" :class="tokensLoading ? 'animate-spin' : ''" aria-hidden="true" />
                </button>
              </div>

              <p v-if="tokens.length === 0" class="text-xs text-ink-3">
                还没有令牌。生成一枚之后，脚本就能带着它增删改查。
              </p>

              <ul v-else class="flex flex-col gap-xs">
                <li
                  v-for="token in tokens"
                  :key="token.id"
                  class="flex flex-wrap items-center justify-between gap-sm rounded-md bg-surface-2 px-md py-sm"
                >
                  <div class="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span class="flex items-center gap-2xs text-sm font-semibold text-ink">
                      {{ token.name }}
                      <span class="rounded-pill bg-surface px-2xs py-[1px] text-[11px] font-semibold text-ink-3">
                        {{ token.scopes.includes('write') ? '读写' : '只读' }}
                      </span>
                    </span>
                    <code class="nv-url break-all text-xs text-ink-2">
                      {{ revealedId === token.id && token.token ? token.token : maskOf(token) }}
                    </code>
                    <span class="nv-url truncate text-[11px] text-ink-3">
                      创建于 {{ formatTime(token.createdAt) }} · 最后使用 {{ formatTime(token.lastUsedAt) }} ·
                      到期 {{ expiryOf(token) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2xs">
                    <button
                      type="button"
                      class="flex h-8 items-center gap-2xs rounded-pill px-sm text-xs font-semibold text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
                      :aria-label="revealedId === token.id ? '隐藏令牌明文' : '查看令牌明文'"
                      @click="toggleReveal(token)"
                    >
                      <EyeOff v-if="revealedId === token.id" :size="14" aria-hidden="true" />
                      <Eye v-else :size="14" aria-hidden="true" />
                      {{ revealedId === token.id ? '隐藏' : '查看' }}
                    </button>
                    <button
                      type="button"
                      class="flex h-8 items-center gap-2xs rounded-pill px-sm text-xs font-semibold text-ink-3 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
                      aria-label="复制令牌"
                      @click="copyToken(token)"
                    >
                      <Check v-if="copiedId === token.id" :size="14" aria-hidden="true" />
                      <Copy v-else :size="14" aria-hidden="true" />
                      {{ copiedId === token.id ? '已复制' : '复制' }}
                    </button>
                    <BaseButton variant="danger" size="sm" @click="askRevokeToken(token)">
                      <template #icon><Trash2 :size="14" /></template>
                      吊销
                    </BaseButton>
                  </div>
                </li>
              </ul>
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
