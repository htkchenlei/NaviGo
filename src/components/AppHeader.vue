<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle, Pencil } from 'lucide-vue-next'
import ModeSwitcher from '@/components/ModeSwitcher.vue'
import SearchBar from '@/components/SearchBar.vue'
import UserMenu from '@/components/UserMenu.vue'
import { useAuthStore } from '@/stores/auth'
import { useNavStore } from '@/stores/nav'

const emit = defineEmits<{ changePassword: []; logout: [] }>()

const nav = useNavStore()
const auth = useAuthStore()

const title = computed(() => nav.settings.site_title || 'NaviGo')
const subtitle = computed(() => nav.settings.site_subtitle || '')

const MANAGE_CLASSES = [
  'flex h-11 items-center gap-2xs rounded-pill px-sm text-sm font-semibold',
  'transition-[background-color,color,box-shadow] duration-short ease-out',
]
</script>

<template>
  <header class="nv-glass fixed inset-x-0 top-0 z-sticky border-b border-rule">
    <div class="nv-shell">
      <!-- 第一行：品牌 / 桌面端搜索 / 模式与用户 -->
      <div class="flex h-header items-center gap-sm">
        <RouterLink
          to="/"
          class="flex min-w-0 items-center gap-xs"
          aria-label="返回导航首页"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-strong shadow-card"
            aria-hidden="true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 18V6l12 12V6"
                stroke="var(--color-accent-ink)"
                stroke-width="2.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate font-display text-md font-extrabold leading-tight text-ink">
              {{ title }}
            </span>
            <span v-if="subtitle" class="hidden truncate text-2xs text-ink-3 sm:block">
              {{ subtitle }}
            </span>
          </span>
        </RouterLink>

        <SearchBar
          v-model="nav.query"
          class="mx-auto hidden w-full max-w-[20rem] lg:flex"
        />

        <div class="ml-auto flex shrink-0 items-center gap-xs">
          <ModeSwitcher
            class="hidden lg:flex"
            :mode="nav.mode"
            :source="nav.modeSource"
            @select="nav.setMode($event)"
            @auto="nav.syncAutoMode()"
          />

          <span
            v-if="nav.saving"
            class="hidden items-center gap-2xs text-xs text-ink-3 sm:flex"
            role="status"
          >
            <LoaderCircle :size="14" class="animate-spin" aria-hidden="true" />
            保存中
          </span>

          <button
            type="button"
            :class="[
              MANAGE_CLASSES,
              nav.manage
                ? 'bg-accent-strong text-accent-ink shadow-whisper'
                : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
            ]"
            :aria-pressed="nav.manage"
            :title="nav.manage ? '退出管理模式' : '进入管理模式：可拖拽排序与增删改'"
            @click="nav.manage = !nav.manage"
          >
            <Pencil :size="15" aria-hidden="true" />
            <span class="hidden xl:inline">{{ nav.manage ? '退出管理' : '管理模式' }}</span>
          </button>

          <UserMenu
            v-if="auth.username"
            :username="auth.username"
            :needs-password-change="auth.needsPasswordChange"
            @change-password="emit('changePassword')"
            @logout="emit('logout')"
          />
        </div>
      </div>

      <!-- 第二行：仅移动端，搜索 + 模式切换 -->
      <div class="flex items-center gap-sm pb-sm lg:hidden">
        <SearchBar v-model="nav.query" class="min-w-0 flex-1" />
        <ModeSwitcher
          :mode="nav.mode"
          :source="nav.modeSource"
          @select="nav.setMode($event)"
          @auto="nav.syncAutoMode()"
        />
      </div>
    </div>
  </header>
</template>
