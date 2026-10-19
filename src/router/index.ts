import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      /**
       * 私密页：不在任何界面里放入口，必须手动输入 /private 才能进入。
       * 与首页复用同一个组件，由 meta.scope 决定读写哪个数据域。
       */
      path: '/private',
      name: 'private',
      component: () => import('@/views/HomeView.vue'),
      meta: { scope: 'private' },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
    },
    {
      path: '/admin/api',
      name: 'api-docs',
      component: () => import('@/views/ApiDocsView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

/** 整站门禁：未登录只能停在登录页，已登录访问登录页则直接回首页 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.checked) await auth.bootstrap()

  if (to.meta.public) {
    return auth.isAuthenticated ? { name: 'home' } : true
  }
  if (!auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  return true
})

export default router
