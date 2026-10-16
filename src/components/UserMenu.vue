<script setup lang="ts">
import { ref } from 'vue'
import { KeyRound, LayoutGrid, LogOut, User } from 'lucide-vue-next'

defineProps<{ username: string; needsPasswordChange: boolean }>()
const emit = defineEmits<{ changePassword: []; logout: [] }>()

const open = ref(false)

function run(action: 'password' | 'logout'): void {
  open.value = false
  if (action === 'password') emit('changePassword')
  else emit('logout')
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex h-11 items-center gap-xs rounded-pill bg-surface pl-2xs pr-sm text-sm font-semibold text-ink ring-1 ring-inset ring-rule transition-[box-shadow,background-color] duration-short ease-out hover:bg-surface-2 hover:ring-rule-strong"
      :aria-expanded="open"
      :aria-label="`账号菜单：${username}`"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <span
        class="flex h-8 w-8 items-center justify-center rounded-pill bg-accent-wash text-accent-strong"
        aria-hidden="true"
      >
        <User :size="16" />
      </span>
      <span class="hidden max-w-[7rem] truncate sm:inline">{{ username }}</span>
      <span
        v-if="needsPasswordChange"
        class="h-2 w-2 rounded-pill bg-warning"
        title="仍在使用默认密码，建议尽快修改"
        aria-hidden="true"
      />
    </button>

    <template v-if="open">
      <!-- 透明遮罩接管「点击外部关闭」，避免挂全局监听 -->
      <button
        type="button"
        class="fixed inset-0 z-dropdown cursor-default"
        aria-label="关闭菜单"
        tabindex="-1"
        @click="open = false"
      />
      <div
        role="menu"
        class="absolute right-0 top-[calc(100%+0.5rem)] z-dropdown flex w-56 flex-col gap-2xs rounded-lg bg-surface p-2xs shadow-lift ring-1 ring-inset ring-rule"
      >
        <p class="px-sm py-2xs text-xs text-ink-3">已登录：{{ username }}</p>
        <RouterLink
          to="/admin"
          role="menuitem"
          class="flex h-11 items-center gap-sm rounded-sm px-sm text-sm font-semibold text-ink-2 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
          @click="open = false"
        >
          <LayoutGrid :size="16" aria-hidden="true" />
          后台设置
        </RouterLink>
        <button
          type="button"
          role="menuitem"
          class="flex h-11 items-center gap-sm rounded-sm px-sm text-sm font-semibold text-ink-2 transition-colors duration-micro ease-out hover:bg-surface-3 hover:text-ink"
          @click="run('password')"
        >
          <KeyRound :size="16" aria-hidden="true" />
          修改密码
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex h-11 items-center gap-sm rounded-sm px-sm text-sm font-semibold text-danger-strong transition-colors duration-micro ease-out hover:bg-danger-soft"
          @click="run('logout')"
        >
          <LogOut :size="16" aria-hidden="true" />
          退出登录
        </button>
      </div>
    </template>
  </div>
</template>
