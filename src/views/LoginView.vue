<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleAlert, Lock, User } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAuthStore } from '@/stores/auth'
import { MODE_META, detectMode } from '@/utils/hostMode'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

const detected = detectMode(window.location.hostname)
const modeMeta = computed(() => MODE_META.find((item) => item.key === detected) ?? MODE_META[2])

async function submit(): Promise<void> {
  if (!username.value.trim()) {
    error.value = '请输入账号'
    return
  }
  if (!password.value) {
    error.value = '请输入密码'
    return
  }

  error.value = ''
  submitting.value = true

  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '登录失败，请稍后重试'
    submitting.value = false
  }
}
</script>

<template>
  <!-- safe center：视口够高时垂直居中，不够高时退回顶部对齐，避免卡片上半部分被裁掉且无法滚动到 -->
  <main
    class="relative z-raised flex min-h-screen justify-center px-md py-2xl [align-items:safe_center]"
  >
    <div class="w-full max-w-[26rem]">
      <div class="mb-lg flex flex-col items-center gap-xs text-center">
        <span
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-strong shadow-lift"
          aria-hidden="true"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 18V6l12 12V6"
              stroke="var(--color-accent-ink)"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <h1 class="text-display text-ink">NaviGo</h1>
        <p class="text-sm text-ink-2">内网 · VPN · 外网，一处直达</p>
      </div>

      <section class="nv-hairline relative overflow-hidden rounded-2xl bg-surface p-lg shadow-modal">
        <div class="mb-md flex items-center gap-2xs" aria-hidden="true">
          <span class="h-2.5 w-2.5 rounded-pill bg-macaron-mint" />
          <span class="h-2.5 w-2.5 rounded-pill bg-macaron-sky" />
          <span class="h-2.5 w-2.5 rounded-pill bg-macaron-coral" />
          <span class="h-2.5 w-2.5 rounded-pill bg-macaron-butter" />
        </div>

        <h2 class="text-lg text-ink">登录以继续</h2>
        <p class="mt-2xs text-sm text-ink-2">
          这是一个私有导航页，登录后才能查看内容。
        </p>

        <form class="mt-lg flex flex-col gap-md" @submit.prevent="submit">
          <BaseInput
            v-model="username"
            label="账号"
            placeholder="admin"
            autocomplete="username"
          >
            <template #prefix><User :size="16" /></template>
          </BaseInput>

          <BaseInput
            v-model="password"
            label="密码"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            @enter="submit"
          >
            <template #prefix><Lock :size="16" /></template>
          </BaseInput>

          <p
            v-if="error"
            class="flex items-start gap-2xs rounded-md bg-danger-soft px-sm py-xs text-xs text-danger-strong"
            role="alert"
          >
            <CircleAlert :size="14" class="mt-[2px] shrink-0" aria-hidden="true" />
            {{ error }}
          </p>

          <BaseButton type="submit" size="lg" block :loading="submitting">
            登录
          </BaseButton>
        </form>

        <div class="mt-lg flex flex-col gap-xs border-t border-rule pt-md">
          <p class="text-xs text-ink-3">
            首次部署的默认账号是
            <code class="nv-url rounded-xs bg-surface-3 px-[5px] py-[1px] text-ink-2">admin / admin</code>
            ，登录后请立即修改密码。
          </p>
          <p class="flex items-center gap-2xs text-xs text-ink-3">
            <span class="h-1.5 w-1.5 rounded-pill bg-macaron-mint" aria-hidden="true" />
            当前网络判定为「{{ modeMeta.label }}」，登录后将使用{{ modeMeta.hint }}。
          </p>
        </div>
      </section>
    </div>
  </main>
</template>
