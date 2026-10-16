<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()

const current = ref('')
const next = ref('')
const repeat = ref('')
const error = ref('')
const submitting = ref(false)

const tooShort = computed(() => next.value.length > 0 && next.value.length < 6)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    current.value = ''
    next.value = ''
    repeat.value = ''
    error.value = ''
    submitting.value = false
  },
)

async function submit(): Promise<void> {
  if (!current.value) {
    error.value = '请输入当前密码'
    return
  }
  if (next.value.length < 6) {
    error.value = '新密码至少 6 位'
    return
  }
  if (next.value !== repeat.value) {
    error.value = '两次输入的新密码不一致'
    return
  }
  if (next.value === current.value) {
    error.value = '新密码不能与当前密码相同'
    return
  }

  submitting.value = true
  try {
    await auth.changePassword(current.value, next.value)
    toast.success('密码已修改', '出于安全考虑，所有设备都需要重新登录')
    emit('close')
    // 服务端已吊销全部会话，本地同步登出并回到登录页
    auth.reset()
    await router.replace({ name: 'login' })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '修改失败，请稍后重试'
    submitting.value = false
  }
}
</script>

<template>
  <BaseDialog
    :open="open"
    title="修改密码"
    description="改密后当前设备与其它设备的登录状态都会失效，需要重新登录。"
    width="sm"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-lg" @submit.prevent="submit">
      <BaseInput
        v-model="current"
        label="当前密码"
        type="password"
        autocomplete="current-password"
        :error="error"
      />
      <BaseInput
        v-model="next"
        label="新密码"
        type="password"
        autocomplete="new-password"
        :maxlength="128"
        hint="至少 6 位，建议混合大小写与数字"
      />
      <BaseInput
        v-model="repeat"
        label="确认新密码"
        type="password"
        autocomplete="new-password"
        :error="tooShort ? '新密码至少 6 位' : ''"
        @enter="submit"
      />

      <p class="flex items-start gap-2xs rounded-md bg-accent-wash px-sm py-xs text-xs text-ink-2">
        <ShieldCheck :size="14" class="mt-[2px] shrink-0 text-accent-strong" aria-hidden="true" />
        密码以 PBKDF2-SHA256 加盐哈希存储，服务端不保存明文。
      </p>
    </form>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
      <BaseButton :loading="submitting" @click="submit">确认修改</BaseButton>
    </template>
  </BaseDialog>
</template>
