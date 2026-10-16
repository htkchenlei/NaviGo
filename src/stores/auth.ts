import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, api } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const username = ref<string | null>(null)
  const checked = ref(false)
  const needsPasswordChange = ref(false)

  const isAuthenticated = computed(() => username.value !== null)

  /** 首次进入时向服务端确认会话，避免仅凭前端状态误判登录 */
  async function bootstrap(): Promise<void> {
    try {
      const info = await api.me()
      username.value = info.username
      needsPasswordChange.value = info.needsPasswordChange
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        console.error('[navigo] 会话校验失败', error)
      }
      username.value = null
    } finally {
      checked.value = true
    }
  }

  async function login(user: string, password: string): Promise<void> {
    const result = await api.login(user, password)
    username.value = result.username
    checked.value = true
    needsPasswordChange.value = true
  }

  async function logout(): Promise<void> {
    try {
      await api.logout()
    } catch (error) {
      console.error('[navigo] 退出登录请求失败，已清理本地状态', error)
    }
    reset()
  }

  function reset(): void {
    username.value = null
    needsPasswordChange.value = false
    checked.value = true
  }

  async function changePassword(current: string, next: string): Promise<void> {
    await api.changePassword(current, next)
    needsPasswordChange.value = false
  }

  function markPasswordChanged(): void {
    needsPasswordChange.value = false
  }

  return {
    username,
    checked,
    needsPasswordChange,
    isAuthenticated,
    bootstrap,
    login,
    logout,
    reset,
    changePassword,
    markPasswordChanged,
  }
})
