<script setup lang="ts">
/**
 * API 文档页。
 *
 * 只做「查」：端点、参数示例、可复制的 curl。真正的令牌在这里生成不了，
 * 也不该生成 —— 那些动作留在后台设置里，避免把一次性明文散落在多个页面。
 */
import { ref } from 'vue'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-vue-next'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

/** 用当前访问的域名拼示例，复制出去就能直接跑，不用手工替换主机名 */
const origin = window.location.origin

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface Endpoint {
  method: Method
  path: string
  desc: string
  /** 请求体示例，写在这里同时用于生成 curl */
  body?: string
  /** 只读令牌也能调用；缺省表示需要 write 权限 */
  read?: boolean
  /** 只接受浏览器会话，令牌访问会被拒 */
  session?: boolean
}

interface Group {
  title: string
  note: string
  items: Endpoint[]
}

const GROUPS: Group[] = [
  {
    title: '模块',
    note: '模块是导航页上的一行分组标题，链接挂在模块下面',
    items: [
      {
        method: 'GET',
        path: '/api/modules',
        desc: '模块列表，每个模块带上它自己的链接',
        read: true,
      },
      {
        method: 'GET',
        path: '/api/modules/1',
        desc: '单个模块及其链接',
        read: true,
      },
      {
        method: 'POST',
        path: '/api/modules',
        desc: '新建模块。color 取值 mint / sky / coral / butter / lilac / peach / rose / teal',
        body: '{"name":"家庭服务","color":"mint"}',
      },
      {
        method: 'PUT',
        path: '/api/modules/1',
        desc: '重命名或换色，只传要改的字段',
        body: '{"name":"家庭服务"}',
      },
      {
        method: 'DELETE',
        path: '/api/modules/1',
        desc: '删除模块，连同它下面的链接一起删',
      },
    ],
  },
  {
    title: '链接',
    note: '一条链接最多有三个地址：内网 / VPN / 外网，至少填一个',
    items: [
      {
        method: 'GET',
        path: '/api/links',
        desc: '全部链接的扁平列表，每条带 moduleId',
        read: true,
      },
      {
        method: 'GET',
        path: '/api/links/1',
        desc: '单条链接',
        read: true,
      },
      {
        method: 'POST',
        path: '/api/links',
        desc: '新建链接。moduleId 必填，urlLan / urlVpn / urlWan 至少一个，必须带 http:// 或 https://',
        body: '{"moduleId":1,"name":"群晖 NAS","urlLan":"http://192.168.1.10:5000"}',
      },
      {
        method: 'PUT',
        path: '/api/links/1',
        desc: '修改链接，只传要改的字段；传 moduleId 可以挪到别的模块',
        body: '{"name":"NAS","urlWan":"https://nas.example.com"}',
      },
      {
        method: 'DELETE',
        path: '/api/links/1',
        desc: '删除链接',
      },
    ],
  },
  {
    title: '其他数据接口',
    note: '整站数据、排序与备份',
    items: [
      {
        method: 'GET',
        path: '/api/nav',
        desc: '一次返回全部模块、链接与设置，导航页首屏就靠它',
        read: true,
      },
      {
        method: 'POST',
        path: '/api/reorder',
        desc: '批量保存拖拽后的排序，一个事务写回',
        body: '{"links":[{"id":1,"moduleId":1,"sortOrder":0}]}',
      },
      {
        method: 'GET',
        path: '/api/export',
        desc: '导出完整配置 JSON',
        read: true,
      },
      {
        method: 'POST',
        path: '/api/import',
        desc: '导入配置，会覆盖当前的模块与链接',
        body: '{"version":"1.0.0","exportedAt":"","settings":{},"modules":[]}',
      },
      {
        method: 'GET',
        path: '/api/icon?domain=example.com',
        desc: 'favicon 代理，命中后写入边缘缓存',
        read: true,
      },
    ],
  },
  {
    title: '令牌与账号',
    note: '这一组只认浏览器会话，Bearer 令牌访问会返回 403 session_required',
    items: [
      {
        method: 'GET',
        path: '/api/tokens',
        desc: '令牌列表，只返回前缀与元信息，永不返回哈希',
        read: true,
        session: true,
      },
      {
        method: 'POST',
        path: '/api/tokens',
        desc: '签发令牌。响应里的 token 是明文，只出现这一次；scopes 可传 ["read"] 或 ["read","write"]',
        body: '{"name":"快捷指令","scopes":["read"],"expiresInDays":30}',
        session: true,
      },
      {
        method: 'DELETE',
        path: '/api/tokens/1',
        desc: '吊销令牌，下一次请求立即 401',
        session: true,
      },
    ],
  },
]

const METHOD_CLASS: Record<Method, string> = {
  GET: 'bg-macaron-mint-soft text-success-strong',
  POST: 'bg-macaron-sky-soft text-accent-strong',
  PUT: 'bg-macaron-butter-soft text-warning-strong',
  DELETE: 'bg-danger-soft text-danger-strong',
}

const copiedKey = ref('')

/** 最短调用示例，直接给整段，复制就能跑 */
const quickCurl = `TOKEN=nvk_xxx\ncurl -H "Authorization: Bearer $TOKEN" '${origin}/api/modules'`

function keyOf(endpoint: Endpoint): string {
  return `${endpoint.method} ${endpoint.path}`
}

function curlOf(endpoint: Endpoint): string {
  const lines = [
    `curl -X ${endpoint.method} '${origin}${endpoint.path}'`,
    '  -H "Authorization: Bearer $TOKEN"',
  ]
  if (endpoint.body) {
    lines.push(`  -H 'content-type: application/json'`)
    lines.push(`  -d '${endpoint.body}'`)
  }
  return lines.join(' \\\n')
}

async function copy(text: string, key: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    window.setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = ''
    }, 1600)
  } catch {
    toast.error('自动复制被浏览器拦下了，请手动选中复制')
  }
}
</script>

<template>
  <div class="relative z-raised">
    <header class="nv-glass fixed inset-x-0 top-0 z-sticky border-b border-rule">
      <div class="nv-shell flex h-14 items-center gap-sm">
        <RouterLink
          to="/admin"
          class="flex items-center gap-2xs text-xs font-semibold text-ink-3 transition-colors duration-micro ease-out hover:text-accent-strong"
        >
          <ArrowLeft :size="13" aria-hidden="true" />
          后台设置
        </RouterLink>
        <span class="h-4 w-px bg-rule" aria-hidden="true" />
        <span class="text-sm font-semibold text-ink">API 文档</span>
      </div>
    </header>

    <main class="pt-[4.5rem] pb-2xl">
      <div class="nv-shell flex max-w-[64rem] flex-col gap-lg">
        <header class="flex flex-col gap-2xs">
          <h1 class="text-display-s text-ink">API 文档</h1>
          <p class="text-sm text-ink-2">
            所有接口都在 <code class="nv-url">{{ origin }}/api/</code> 下，返回结构统一。
            想生成令牌去 <RouterLink to="/admin" class="font-semibold text-accent-strong hover:text-accent">后台设置 → API 访问</RouterLink>。
          </p>
        </header>

        <section class="flex flex-col gap-md rounded-xl bg-surface p-lg shadow-card nv-hairline">
          <div class="flex flex-col gap-2xs">
            <h2 class="text-md text-ink">鉴权</h2>
            <p class="text-xs text-ink-3">
              请求头带上 <code class="nv-url">Authorization: Bearer &lt;令牌&gt;</code> 即可免登录调用。
              没带这个头时，服务端回落到 HttpOnly 会话 Cookie。
            </p>
          </div>

          <div class="flex flex-col gap-xs rounded-md bg-surface-2 px-md py-sm">
            <div class="flex items-center justify-between gap-sm">
              <span class="nv-label">最短的一次调用</span>
              <button
                type="button"
                class="flex items-center gap-2xs rounded-pill px-2xs py-[3px] text-xs font-semibold text-ink-3 transition-colors duration-micro ease-out hover:text-accent-strong"
                @click="copy(quickCurl, 'quick')"
              >
                <Check v-if="copiedKey === 'quick'" :size="13" aria-hidden="true" />
                <Copy v-else :size="13" aria-hidden="true" />
                {{ copiedKey === 'quick' ? '已复制' : '复制' }}
              </button>
            </div>
            <pre class="overflow-x-auto text-xs leading-relaxed text-ink-2"><code>TOKEN=nvk_xxx
curl -H "Authorization: Bearer $TOKEN" '{{ origin }}/api/modules'</code></pre>
          </div>

          <div class="grid gap-md sm:grid-cols-2">
            <div class="flex flex-col gap-2xs rounded-md bg-surface-2 px-md py-sm">
              <span class="nv-label">成功</span>
              <code class="nv-url break-all text-ink-2">{ "ok": true, "data": … }</code>
            </div>
            <div class="flex flex-col gap-2xs rounded-md bg-surface-2 px-md py-sm">
              <span class="nv-label">失败</span>
              <code class="nv-url break-all text-ink-2">{ "ok": false, "error": "…", "code": "…" }</code>
            </div>
          </div>

          <div class="flex flex-col gap-2xs">
            <span class="nv-label">常见错误码</span>
            <dl class="grid grid-cols-[auto_1fr] gap-x-md gap-y-xs text-xs">
              <dt class="font-mono text-ink-3">401</dt>
              <dd class="text-ink-2"><code class="nv-url">unauthorized</code> 未登录、令牌无效或已吊销</dd>
              <dt class="font-mono text-ink-3">403</dt>
              <dd class="text-ink-2"><code class="nv-url">token_read_only</code> 只读令牌做了写操作</dd>
              <dt class="font-mono text-ink-3">403</dt>
              <dd class="text-ink-2"><code class="nv-url">session_required</code> 令牌访问了只认会话的接口</dd>
              <dt class="font-mono text-ink-3">403</dt>
              <dd class="text-ink-2"><code class="nv-url">cross_origin</code> Cookie 会话的跨站写请求</dd>
            </dl>
          </div>
        </section>

        <section
          v-for="group in GROUPS"
          :key="group.title"
          class="flex flex-col gap-md rounded-xl bg-surface p-lg shadow-card nv-hairline"
        >
          <div class="flex flex-col gap-2xs">
            <h2 class="text-md text-ink">{{ group.title }}</h2>
            <p class="text-xs text-ink-3">{{ group.note }}</p>
          </div>

          <ul class="flex flex-col gap-xs">
            <li
              v-for="endpoint in group.items"
              :key="`${endpoint.method} ${endpoint.path}`"
              class="flex flex-col gap-xs rounded-md bg-surface-2 px-md py-sm"
            >
              <div class="flex flex-wrap items-center gap-sm">
                <span
                  class="rounded-sm px-2xs py-[2px] font-mono text-[11px] font-bold tracking-wide"
                  :class="METHOD_CLASS[endpoint.method]"
                >
                  {{ endpoint.method }}
                </span>
                <code class="nv-url min-w-0 flex-1 truncate text-sm text-ink">{{ endpoint.path }}</code>
                <span
                  v-if="endpoint.session"
                  class="rounded-pill bg-surface px-2xs py-[1px] text-[11px] font-semibold text-ink-3"
                >
                  仅会话
                </span>
                <span
                  v-else-if="!endpoint.read"
                  class="rounded-pill bg-surface px-2xs py-[1px] text-[11px] font-semibold text-ink-3"
                >
                  需 write
                </span>
                <button
                  type="button"
                  class="flex items-center gap-2xs rounded-pill px-2xs py-[3px] text-xs font-semibold text-ink-3 transition-colors duration-micro ease-out hover:text-accent-strong"
                  :aria-label="`复制 ${endpoint.method} ${endpoint.path} 的 curl`"
                  @click="copy(curlOf(endpoint), keyOf(endpoint))"
                >
                  <Check v-if="copiedKey === keyOf(endpoint)" :size="13" aria-hidden="true" />
                  <Copy v-else :size="13" aria-hidden="true" />
                  {{ copiedKey === keyOf(endpoint) ? '已复制' : '复制 curl' }}
                </button>
              </div>
              <p class="text-xs text-ink-3">{{ endpoint.desc }}</p>
              <pre
                v-if="endpoint.body"
                class="overflow-x-auto rounded-sm bg-surface px-sm py-2xs text-[11px] leading-relaxed text-ink-2"
              ><code>{{ endpoint.body }}</code></pre>
            </li>
          </ul>
        </section>

        <section class="flex flex-wrap items-center gap-sm rounded-xl bg-surface px-lg py-md shadow-card nv-hairline">
          <p class="min-w-0 flex-1 text-xs text-ink-3">
            令牌等同于账号密码：只走 HTTPS，别塞进 URL（会留在访问日志和 Referer 里），别提交进 Git。
            怀疑泄漏就去后台吊销，不用改密码，也不影响其他设备。
          </p>
          <a
            href="https://github.com/htkchenlei/NaviGo#用令牌调-api"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2xs text-xs font-semibold text-accent-strong transition-colors duration-micro ease-out hover:text-accent"
          >
            README 里的 curl 示例
            <ExternalLink :size="12" aria-hidden="true" />
          </a>
        </section>
      </div>
    </main>
  </div>
</template>
