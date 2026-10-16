<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ColorSwatches from '@/components/ui/ColorSwatches.vue'
import { useNavStore } from '@/stores/nav'
import type { NavModule } from '@/api/types'

const props = defineProps<{
  open: boolean
  /** 传入模块表示编辑，传 null 表示新建 */
  module?: NavModule | null
  defaultColor: string
}>()

const emit = defineEmits<{ close: [] }>()

const nav = useNavStore()
const name = ref('')
const color = ref('mint')
const error = ref('')
const submitting = ref(false)

const editing = () => Boolean(props.module)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = props.module?.name ?? ''
    color.value = props.module?.color ?? props.defaultColor
    error.value = ''
    submitting.value = false
  },
)

async function submit(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '请填写模块名称'
    return
  }
  if (trimmed.length > 32) {
    error.value = '模块名称不要超过 32 个字符'
    return
  }

  submitting.value = true
  const ok = props.module
    ? await nav.editModule(props.module.id, { name: trimmed, color: color.value })
    : await nav.addModule(trimmed, color.value)
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
    :title="editing() ? '编辑模块' : '新建模块'"
    :description="editing() ? '可以重命名模块，或换一个马卡龙主题色。' : '模块用来把一组地址收在一起，例如「家庭服务」。'"
    width="sm"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-lg" @submit.prevent="submit">
      <BaseInput
        v-model="name"
        label="模块名称"
        placeholder="例如：家庭服务"
        :maxlength="32"
        :error="error"
        hint="最多 32 个字符"
        @enter="submit"
      />
      <ColorSwatches v-model="color" />
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
      <BaseButton :loading="submitting" @click="submit">
        {{ editing() ? '保存修改' : '创建模块' }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
