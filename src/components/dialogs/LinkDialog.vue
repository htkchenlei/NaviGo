<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ExternalLink, Globe, House, Router } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import UrlInput from '@/components/ui/UrlInput.vue'
import LinkIcon from '@/components/LinkIcon.vue'
import { useNavStore } from '@/stores/nav'
import { colorForName } from '@/utils/palette'
import { ICON_SAMPLE_URL, ICON_SITES } from '@/utils/icon'
import { joinUrl, parseStoredUrl, splitProtocol, validateHost } from '@/utils/urlProtocol'
import type { Protocol } from '@/utils/urlProtocol'
import type { LinkPayload, NavLink } from '@/api/types'

const props = defineProps<{
  open: boolean
  moduleId: number
  moduleName?: string
  /** 传入链接表示编辑，传 null 表示新建 */
  link?: NavLink | null
}>()

const emit = defineEmits<{ close: [] }>()

const nav = useNavStore()
const name = ref('')
const description = ref('')
const iconUrl = ref('')
const nameError = ref('')
const formError = ref('')
const submitting = ref(false)

/** 每种模式拆成「协议 + 主机」两段，主机为空表示不填这个模式 */
interface AddressState {
  protocol: Protocol
  host: string
}

type AddressKey = 'lan' | 'vpn' | 'wan'

/** 内网 / VPN 的私有服务绝大多数是明文 http，外网域名则默认 https */
const lan = reactive<AddressState>({ protocol: 'http', host: '' })
const vpn = reactive<AddressState>({ protocol: 'http', host: '' })
const wan = reactive<AddressState>({ protocol: 'https', host: '' })
const hostErrors = reactive<Record<AddressKey, string>>({ lan: '', vpn: '', wan: '' })

const addressOf: Record<AddressKey, AddressState> = { lan, vpn, wan }

/**
 * 新建时预填「主机 + 冒号」，光标落在冒号后面，用户接着敲端口就行。
 * 外网地址形态太杂（域名 / 公网 IP / 各种端口），不预填，留空。
 */
const PREFILL: Record<AddressKey, string> = { lan: '192.168.1.7:', vpn: '100.66.1.1:', wan: '' }

/**
 * 预填值原封未动一律按「这个模式没填」处理：否则每次新建都会莫名其妙多出一个
 * 指向 192.168.1.7 的内网地址，「至少填写一个地址」的校验也会被默认值蒙混过去。
 */
function effectiveHost(key: AddressKey): string {
  const trimmed = addressOf[key].host.trim()
  return trimmed && trimmed !== PREFILL[key] ? trimmed : ''
}

const editing = computed(() => Boolean(props.link))
const dialogTitle = computed(() => {
  if (props.link) return '编辑地址'
  return props.moduleName ? `添加到「${props.moduleName}」` : '添加地址'
})

const payload = computed<LinkPayload>(() => ({
  name: name.value.trim() || '新地址',
  description: description.value.trim() || null,
  iconUrl: iconUrl.value.trim() || null,
  urlLan: joinUrl(lan.protocol, effectiveHost('lan')),
  urlVpn: joinUrl(vpn.protocol, effectiveHost('vpn')),
  urlWan: joinUrl(wan.protocol, effectiveHost('wan')),
}))

/**
 * 输入框只绑定主机段，但如果用户直接把完整地址粘进去（https://a.b），
 * 这里会把协议头吸到左侧下拉框，否则会拼出 http://https://a.b 这种坏地址。
 */
function hostBinding(state: AddressState) {
  return computed<string>({
    get: () => state.host,
    set: (value: string) => {
      const parsed = splitProtocol(value, state.protocol)
      state.protocol = parsed.protocol
      state.host = parsed.host
    },
  })
}

const lanHost = hostBinding(lan)
const vpnHost = hostBinding(vpn)
const wanHost = hostBinding(wan)

function clearErrors(): void {
  nameError.value = ''
  formError.value = ''
  hostErrors.lan = ''
  hostErrors.vpn = ''
  hostErrors.wan = ''
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = props.link?.name ?? ''
    description.value = props.link?.description ?? ''
    Object.assign(lan, parseStoredUrl(props.link?.urlLan ?? null, 'http'))
    Object.assign(vpn, parseStoredUrl(props.link?.urlVpn ?? null, 'http'))
    Object.assign(wan, parseStoredUrl(props.link?.urlWan ?? null, 'https'))
    if (!props.link) {
      // 只有新建才预填：编辑时要显示库里真实存着的值，不能让默认值看起来像已保存的内容
      lan.host = PREFILL.lan
      vpn.host = PREFILL.vpn
    }
    iconUrl.value = props.link?.iconUrl ?? ''
    clearErrors()
    submitting.value = false
  },
)

/** 自定义图标不走下拉框，仍然要求填完整地址 */
function validateIconUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return '自定义图标必须以 http:// 或 https:// 开头'
  return null
}

async function submit(): Promise<void> {
  clearErrors()

  const trimmed = name.value.trim()
  if (!trimmed) {
    nameError.value = '请填写地址名称'
    return
  }

  hostErrors.lan = validateHost(lan.host, '内网地址') ?? ''
  hostErrors.vpn = validateHost(vpn.host, 'VPN 地址') ?? ''
  hostErrors.wan = validateHost(wan.host, '外网地址') ?? ''
  if (hostErrors.lan || hostErrors.vpn || hostErrors.wan) return

  const iconProblem = validateIconUrl(iconUrl.value)
  if (iconProblem) {
    formError.value = iconProblem
    return
  }

  if (!payload.value.urlLan && !payload.value.urlVpn && !payload.value.urlWan) {
    formError.value = '至少填写一个地址，否则这个条目无法点击'
    return
  }

  submitting.value = true
  const ok = props.link
    ? await nav.editLink(props.link.id, { ...payload.value, name: trimmed })
    : await nav.addLink(props.moduleId, { ...payload.value, name: trimmed })
  submitting.value = false

  if (!ok) {
    formError.value = '保存失败，请稍后重试'
    return
  }
  emit('close')
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="dialogTitle"
    description="三种模式各填一份地址：在家里走内网，在外走 VPN 或公网。地址只填主机和端口，协议用左侧下拉框选；留空的模式会按设置回退到外网地址。"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-lg" @submit.prevent="submit">
      <div class="flex items-center gap-md rounded-lg bg-surface-2 p-md">
        <LinkIcon
          :name="payload.name"
          :sources="[]"
          :color-key="colorForName(payload.name)"
          :size="46"
        />
        <div class="flex min-w-0 flex-col gap-[2px]">
          <p class="truncate text-sm font-semibold text-ink">{{ payload.name }}</p>
          <p class="text-xs text-ink-3">
            抓不到目标图标时会用名称首字生成这个彩色标识
          </p>
        </div>
      </div>

      <BaseInput
        v-model="name"
        label="名称"
        placeholder="例如：群晖 NAS"
        :maxlength="32"
        :error="nameError"
        @enter="submit"
      />

      <BaseInput
        v-model="description"
        label="描述（可选）"
        placeholder="例如：文件、相册与套件中心"
        hint="显示在名称下方；留空的话这里会显示域名"
        :maxlength="120"
        @enter="submit"
      />

      <div class="flex flex-col gap-md">
        <UrlInput
          v-model="lanHost"
          :protocol="lan.protocol"
          label="内网地址（192.168.x.x）"
          placeholder="192.168.1.10:5000"
          :prefill="PREFILL.lan"
          :error="hostErrors.lan"
          @update:protocol="(value) => (lan.protocol = value)"
          @enter="submit"
        >
          <template #prefix><House :size="16" /></template>
        </UrlInput>

        <UrlInput
          v-model="vpnHost"
          :protocol="vpn.protocol"
          label="VPN 地址（100.66.x.x）"
          placeholder="100.66.1.10:5000"
          :prefill="PREFILL.vpn"
          :error="hostErrors.vpn"
          @update:protocol="(value) => (vpn.protocol = value)"
          @enter="submit"
        >
          <template #prefix><Router :size="16" /></template>
        </UrlInput>

        <UrlInput
          v-model="wanHost"
          :protocol="wan.protocol"
          label="外网地址"
          placeholder="nas.example.com"
          :error="hostErrors.wan"
          @update:protocol="(value) => (wan.protocol = value)"
          @enter="submit"
        >
          <template #prefix><Globe :size="16" /></template>
        </UrlInput>
      </div>

      <div class="flex flex-col gap-2xs">
        <BaseInput
          v-model="iconUrl"
          label="自定义图标（可选）"
          placeholder="https://cdn.simpleicons.org/synology"
          hint="填了就用它，不再自动抓取"
        />

        <div class="flex flex-wrap items-center gap-2xs">
          <span class="text-xs text-ink-3">去这里找图标：</span>
          <a
            v-for="site in ICON_SITES"
            :key="site.href"
            :href="site.href"
            target="_blank"
            rel="noopener noreferrer"
            :title="`${site.note}；直链形如 ${site.sample}`"
            class="flex items-center gap-2xs rounded-pill bg-surface-2 px-sm py-[5px] text-xs font-semibold text-ink-2 ring-1 ring-inset ring-rule transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-accent-strong"
          >
            {{ site.label }}
            <ExternalLink :size="11" aria-hidden="true" />
          </a>
        </div>

        <p class="text-xs text-ink-3">
          复制的地址要能直接打开看到图，形如
          <a
            :href="ICON_SAMPLE_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-accent-strong transition-colors duration-micro ease-out hover:text-accent"
          >
            {{ ICON_SAMPLE_URL }}
          </a>
        </p>
      </div>

      <p
        v-if="formError"
        class="flex items-center gap-2xs rounded-md bg-danger-soft px-sm py-xs text-sm text-danger-strong"
        role="alert"
      >
        {{ formError }}
      </p>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
      <BaseButton :loading="submitting" @click="submit">
        {{ editing ? '保存修改' : '添加地址' }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
