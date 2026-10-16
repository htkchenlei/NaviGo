import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import { MODE_META, clearManualMode, detectMode, readManualMode, writeManualMode } from '@/utils/hostMode'
import { useToastStore } from '@/stores/toast'
import type { AccessMode, LinkPayload, ModeSource, NavModule, NavSettings } from '@/api/types'

const DEFAULT_SETTINGS: NavSettings = {
  site_title: 'NaviGo',
  site_subtitle: '内网 · VPN · 外网，一处直达',
  fallback_wan: '1',
  password_changed: '0',
  search_engine: 'google',
}

function cloneModules(source: NavModule[]): NavModule[] {
  return source.map((module) => ({ ...module, links: module.links.map((link) => ({ ...link })) }))
}

export interface ResolvedLink {
  url: string | null
  degraded: boolean
}

export const useNavStore = defineStore('nav', () => {
  const modules = ref<NavModule[]>([])
  const settings = ref<NavSettings>({ ...DEFAULT_SETTINGS })
  const version = ref('1.0.0')
  const loading = ref(false)
  const loaded = ref(false)
  const loadError = ref<string | null>(null)
  const saving = ref(false)

  const initialMode = readManualMode()
  const mode = ref<AccessMode>(initialMode ?? detectMode('wan'))
  const modeSource = ref<ModeSource>(initialMode ? 'manual' : 'auto')
  const query = ref('')
  const manage = ref(false)

  /** 拖拽前的快照，写库失败时用它把界面回滚到上一个一致状态 */
  let lastGood: NavModule[] = []

  const allowWanFallback = computed(() => settings.value.fallback_wan !== '0')
  const totalLinks = computed(() => modules.value.reduce((sum, module) => sum + module.links.length, 0))

  /** 搜索命中的链接 id 集合。null 表示未搜索，全部可见。 */
  const visibleLinkIds = computed<Set<number> | null>(() => {
    const keyword = query.value.trim().toLowerCase()
    if (!keyword) return null
    const ids = new Set<number>()
    for (const module of modules.value) {
      const moduleMatches = module.name.toLowerCase().includes(keyword)
      for (const link of module.links) {
        const hit =
          moduleMatches ||
          link.name.toLowerCase().includes(keyword) ||
          Boolean(link.description?.toLowerCase().includes(keyword)) ||
          [link.urlWan, link.urlLan, link.urlVpn].some((url) => url?.toLowerCase().includes(keyword))
        if (hit) ids.add(link.id)
      }
    }
    return ids
  })

  const isFiltering = computed(() => visibleLinkIds.value !== null)

  /**
   * 过滤时依然返回 store 里的原始模块对象（绝不复制），
   * 否则编辑与拖拽会作用在副本上，用户的操作会静默丢失。
   * 具体哪些链接可见交给 visibleLinkIds 在渲染层控制。
   */
  const visibleModules = computed(() => {
    const ids = visibleLinkIds.value
    if (!ids) return modules.value
    const keyword = query.value.trim().toLowerCase()
    return modules.value.filter(
      (module) =>
        module.name.toLowerCase().includes(keyword) || module.links.some((link) => ids.has(link.id)),
    )
  })

  function syncAutoMode(): void {
    mode.value = detectMode(window.location.hostname)
    modeSource.value = 'auto'
    clearManualMode()
  }

  function setMode(next: AccessMode): void {
    mode.value = next
    modeSource.value = 'manual'
    writeManualMode(next)
  }

  function initMode(): void {
    const manual = readManualMode()
    if (manual) {
      mode.value = manual
      modeSource.value = 'manual'
      return
    }
    syncAutoMode()
  }

  /**
   * 三模式地址解析：优先当前模式专属地址；
   * 缺失时按设置回退到外网地址并标记降级，两者都没有则返回 null（界面置灰）。
   */
  function resolveLink(urlLan: string | null, urlVpn: string | null, urlWan: string | null): ResolvedLink {
    const exact = mode.value === 'lan' ? urlLan : mode.value === 'vpn' ? urlVpn : urlWan
    if (exact) return { url: exact, degraded: false }
    if (mode.value !== 'wan' && urlWan && allowWanFallback.value) {
      return { url: urlWan, degraded: true }
    }
    return { url: null, degraded: false }
  }

  async function load(): Promise<void> {
    loading.value = true
    loadError.value = null
    try {
      const payload = await api.fetchNav()
      modules.value = payload.modules
      settings.value = { ...DEFAULT_SETTINGS, ...payload.settings }
      version.value = payload.version
      lastGood = cloneModules(payload.modules)
      loaded.value = true
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '加载失败'
      console.error('[navigo] 加载导航数据失败', error)
    } finally {
      loading.value = false
    }
  }

  async function reload(): Promise<void> {
    await load()
  }

  function applyPayload(nextModules: NavModule[], nextSettings?: NavSettings): void {
    modules.value = nextModules
    if (nextSettings) settings.value = { ...DEFAULT_SETTINGS, ...nextSettings }
    lastGood = cloneModules(nextModules)
  }

  /* ── 模块 ──────────────────────────────────────────────────────── */

  async function addModule(name: string, color: string): Promise<boolean> {
    const toast = useToastStore()
    try {
      const created = await api.createModule(name, color)
      modules.value = [...modules.value, { id: created.id, name, color: created.color ?? color, links: [] }]
      lastGood = cloneModules(modules.value)
      toast.success(`已创建模块「${name}」`)
      return true
    } catch (error) {
      toast.error('创建模块失败', error instanceof Error ? error.message : undefined)
      return false
    }
  }

  async function editModule(id: number, patch: { name?: string; color?: string }): Promise<boolean> {
    const module = modules.value.find((item) => item.id === id)
    if (!module) return false
    const before = { name: module.name, color: module.color }
    Object.assign(module, patch)
    try {
      await api.updateModule(id, patch)
      lastGood = cloneModules(modules.value)
      return true
    } catch (error) {
      Object.assign(module, before)
      useToastStore().error('修改模块失败', error instanceof Error ? error.message : undefined)
      return false
    }
  }

  async function removeModule(id: number): Promise<boolean> {
    const module = modules.value.find((item) => item.id === id)
    if (!module) return false
    const snapshot = cloneModules(modules.value)
    modules.value = modules.value.filter((item) => item.id !== id)
    try {
      await api.deleteModule(id)
      lastGood = cloneModules(modules.value)
      useToastStore().success(`已删除模块「${module.name}」`)
      return true
    } catch (error) {
      modules.value = snapshot
      useToastStore().error('删除模块失败', error instanceof Error ? error.message : undefined)
      return false
    }
  }

  /* ── 链接 ──────────────────────────────────────────────────────── */

  async function addLink(moduleId: number, payload: LinkPayload): Promise<boolean> {
    try {
      const created = (await api.createLink(moduleId, payload)) as { id?: number }
      const module = modules.value.find((item) => item.id === moduleId)
      if (module) {
        module.links.push({ id: created.id ?? Date.now(), moduleId, ...payload })
        lastGood = cloneModules(modules.value)
      }
      useToastStore().success(`已添加「${payload.name}」`)
      return true
    } catch (error) {
      useToastStore().error('添加链接失败', error instanceof Error ? error.message : undefined)
      return false
    }
  }

  async function editLink(linkId: number, payload: LinkPayload): Promise<boolean> {
    const located = findLink(linkId)
    if (!located) return false
    const before = { ...located.link }
    Object.assign(located.link, payload)
    try {
      await api.updateLink(linkId, payload)
      lastGood = cloneModules(modules.value)
      return true
    } catch (error) {
      Object.assign(located.link, before)
      useToastStore().error('修改链接失败', error instanceof Error ? error.message : undefined)
      return false
    }
  }

  async function removeLink(linkId: number): Promise<boolean> {
    const located = findLink(linkId)
    if (!located) return false
    const snapshot = cloneModules(modules.value)
    located.module.links = located.module.links.filter((item) => item.id !== linkId)
    try {
      await api.deleteLink(linkId)
      lastGood = cloneModules(modules.value)
      useToastStore().success(`已删除「${located.link.name}」`)
      return true
    } catch (error) {
      modules.value = snapshot
      useToastStore().error('删除链接失败', error instanceof Error ? error.message : undefined)
      return false
    }
  }

  function findLink(linkId: number): { module: NavModule; link: NavModule['links'][number] } | null {
    for (const module of modules.value) {
      const link = module.links.find((item) => item.id === linkId)
      if (link) return { module, link }
    }
    return null
  }

  /** 「更多」菜单里的上移/下移：给触屏与键盘用户提供非拖拽的替代操作 */
  async function nudgeModule(id: number, delta: number): Promise<void> {
    const index = modules.value.findIndex((item) => item.id === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= modules.value.length) return
    const next = [...modules.value]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    modules.value = next
    await persistOrder()
  }

  async function nudgeLink(linkId: number, delta: number): Promise<void> {
    const located = findLink(linkId)
    if (!located) return
    const index = located.module.links.findIndex((item) => item.id === linkId)
    const target = index + delta
    if (target < 0 || target >= located.module.links.length) return
    const links = [...located.module.links]
    const [moved] = links.splice(index, 1)
    links.splice(target, 0, moved)
    located.module.links = links
    await persistOrder()
  }

  /* ── 排序持久化 ────────────────────────────────────────────────── */

  function buildReorderPayload(): {
    modules: { id: number; sortOrder: number }[]
    links: { id: number; moduleId: number; sortOrder: number }[]
  } {
    const modulesPayload: { id: number; sortOrder: number }[] = []
    const linksPayload: { id: number; moduleId: number; sortOrder: number }[] = []
    modules.value.forEach((module, moduleIndex) => {
      modulesPayload.push({ id: module.id, sortOrder: moduleIndex })
      module.links.forEach((link, linkIndex) => {
        link.moduleId = module.id
        linksPayload.push({ id: link.id, moduleId: module.id, sortOrder: linkIndex })
      })
    })
    return { modules: modulesPayload, links: linksPayload }
  }

  /** 拖拽结束后调用一次：乐观更新已经生效，失败则整体回滚并提示 */
  async function persistOrder(): Promise<void> {
    saving.value = true
    const payload = buildReorderPayload()
    try {
      await api.reorder(payload)
      lastGood = cloneModules(modules.value)
    } catch (error) {
      modules.value = cloneModules(lastGood)
      useToastStore().error('排序保存失败，已恢复原顺序', error instanceof Error ? error.message : undefined)
    } finally {
      saving.value = false
    }
  }

  async function updateSettings(values: Record<string, string>): Promise<boolean> {
    try {
      await api.saveSettings(values)
      settings.value = { ...settings.value, ...values }
      return true
    } catch (error) {
      useToastStore().error('保存设置失败', error instanceof Error ? error.message : undefined)
      return false
    }
  }

  function resetLocal(): void {
    modules.value = []
    settings.value = { ...DEFAULT_SETTINGS }
    loaded.value = false
    manage.value = false
    query.value = ''
  }

  return {
    modules,
    settings,
    version,
    loading,
    loaded,
    loadError,
    saving,
    mode,
    modeSource,
    query,
    manage,
    allowWanFallback,
    totalLinks,
    visibleModules,
    visibleLinkIds,
    isFiltering,
    modeMeta: computed(() => MODE_META.find((item) => item.key === mode.value) ?? MODE_META[2]),
    initMode,
    setMode,
    syncAutoMode,
    resolveLink,
    load,
    reload,
    applyPayload,
    addModule,
    editModule,
    removeModule,
    addLink,
    editLink,
    removeLink,
    findLink,
    nudgeModule,
    nudgeLink,
    persistOrder,
    updateSettings,
    resetLocal,
  }
})
