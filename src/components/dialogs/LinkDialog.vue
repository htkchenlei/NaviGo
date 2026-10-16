<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Globe, House, Router } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import LinkIcon from '@/components/LinkIcon.vue'
import { useNavStore } from '@/stores/nav'
import { colorForName } from '@/utils/palette'
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
const urlLan = ref('')
const urlVpn = ref('')
const urlWan = ref('')
const iconUrl = ref('')
const error = ref('')
const submitting = ref(false)

const editing = computed(() => Boolean(props.link))
const dialogTitle = computed(() => {
  if (props.link) return '编辑地址'
  return props.moduleName ? `添加到「${props.moduleName}」` : '添加地址'
})

const preview = computed<LinkPayload>(() => ({
  name: name.value.trim() || '新地址',
  description: description.value.trim() || null,
  iconUrl: iconUrl.value.trim() || null,
  urlLan: urlLan.value.trim() || null,
  urlVpn: urlVpn.value.trim() || null,
  urlWan: urlWan.value.trim() || null,
}))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = props.link?.name ?? ''
    description.value = props.link?.description ?? ''
    urlLan.value = props.link?.urlLan ?? ''
    urlVpn.value = props.link?.urlVpn ?? ''
    urlWan.value = props.link?.urlWan ?? ''
    iconUrl.value = props.link?.iconUrl ?? ''
    error.value = ''
    submitting.value = false
  },
)

function validateUrl(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return `${label}必须以 http:// 或 https:// 开头`
  return null
}

async function submit(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '请填写地址名称'
    return
  }
  const problems = [
    validateUrl(urlWan.value, '外网地址'),
    validateUrl(urlLan.value, '内网地址'),
    validateUrl(urlVpn.value, 'VPN 地址'),
    validateUrl(iconUrl.value, '自定义图标'),
  ].filter(Boolean) as string[]
  if (problems.length > 0) {
    error.value = problems[0]
    return
  }
  if (!preview.value.urlLan && !preview.value.urlVpn && !preview.value.urlWan) {
    error.value = '至少填写一个地址，否则这个条目无法点击'
    return
  }

  submitting.value = true
  const ok = props.link
    ? await nav.editLink(props.link.id, { ...preview.value, name: trimmed })
    : await nav.addLink(props.moduleId, { ...preview.value, name: trimmed })
  submitting.value = false

  if (!ok) {
    error.value = '保存失败，请稍后重试'
    return
  }
  emit('close')
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="dialogTitle"
    description="三种模式各填一份地址：在家里走内网，在外走 VPN 或公网。留空的模式会按设置回退到外网地址。"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-lg" @submit.prevent="submit">
      <div class="flex items-center gap-md rounded-lg bg-surface-2 p-md">
        <LinkIcon
          :name="preview.name"
          :sources="[]"
          :color-key="colorForName(preview.name)"
          :size="46"
        />
        <div class="flex min-w-0 flex-col gap-[2px]">
          <p class="truncate text-sm font-semibold text-ink">{{ preview.name }}</p>
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
        :error="error"
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
        <BaseInput v-model="urlLan" label="内网地址（192.168.x.x）" placeholder="http://192.168.1.10:5000">
          <template #prefix><House :size="16" /></template>
        </BaseInput>
        <BaseInput v-model="urlVpn" label="VPN 地址（100.66.x.x）" placeholder="http://100.66.1.10:5000">
          <template #prefix><Router :size="16" /></template>
        </BaseInput>
        <BaseInput v-model="urlWan" label="外网地址" placeholder="https://nas.example.com">
          <template #prefix><Globe :size="16" /></template>
        </BaseInput>
      </div>

      <BaseInput
        v-model="iconUrl"
        label="自定义图标（可选）"
        placeholder="https://example.com/logo.png"
        hint="填了就用它，不再自动抓取"
      />
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
      <BaseButton :loading="submitting" @click="submit">
        {{ editing ? '保存修改' : '添加地址' }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
