# NaviGo · 私人导航页

一个可以自己托管、Fork 到自己 GitHub 后一键部署到 Cloudflare Pages 的导航页。

- **整站需要登录**才能看到内容，默认账号 `admin / admin`
- 每条链接可以分别填写**内网 / VPN / 外网**三个地址，按你当前的访问入口自动切换
- 内置**网页搜索**：Google（默认）/ 百度 / Bing 三选一，按 `/` 快速聚焦
- 马卡龙配色，模块化卡片，支持**拖拽排序**与**跨模块拖动**
- 图标自动抓取，抓不到时用**名称首字**生成彩色标识
- 后端是 Cloudflare Pages Functions + D1，数据落库、多端同步

---

## 目录

- [技术栈](#技术栈)
- [本地开发](#本地开发)
- [部署到 Cloudflare Pages](#部署到-cloudflare-pages)
- [内置网页搜索](#内置网页搜索)
- [三种访问模式是怎么工作的](#三种访问模式是怎么工作的)
- [图标是怎么来的](#图标是怎么来的)
- [接口一览](#接口一览)
- [数据表](#数据表)
- [常见问题](#常见问题)
- [安全说明](#安全说明)

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS |
| 拖拽 | vue-draggable-plus（SortableJS） |
| 后端 | Cloudflare Pages Functions（`functions/` 目录，原生 TS） |
| 数据库 | Cloudflare D1（SQLite） |
| 密码 | WebCrypto PBKDF2-SHA256，10 万轮迭代 + 随机盐 |
| 会话 | 32 字节随机令牌，D1 只存 SHA-256 哈希，HttpOnly Cookie |

> 没有引入任何 UI 组件库。卡片、弹窗、输入框、开关、胶囊切换、空状态插图全部自研，
> 设计令牌集中在根目录 `tokens.css`，任何颜色 / 字体 / 间距 / 时长都从那里取。

---

## 本地开发

```bash
npm install
```

**方式一：两个终端，前端热更 + 本地 D1**

```bash
# 终端 1：起 API（首次会自动在 .wrangler/state 里建一个本地 D1）
npm run build:fast
npm run dev:api          # http://127.0.0.1:8788

# 终端 2：起前端，/api 自动代理到 8788
npm run dev              # http://127.0.0.1:5173
```

**方式二：一条命令，单端口跑构建产物 + Functions**（最接近线上，推荐用来验收）

```bash
npm run cf:dev           # http://127.0.0.1:8788
```

首次访问时，`functions/_lib/db.ts` 会幂等地建表，并在 `users` 为空时自动播种
`admin / admin`。**不需要手动执行 `schema.sql`。**

其他脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run build` | 类型检查 + 构建到 `dist/` |
| `npm run typecheck` | 只跑前端 `vue-tsc` |
| `npm run typecheck:api` | 只跑 Functions 的 `tsc` |
| `npm run db:init` | 用 wrangler 对远端库执行 `schema.sql`（可选） |
| `npm run deploy` | 构建并用 wrangler 直接部署到 Pages |

---

## 部署到 Cloudflare Pages

### 前置：改掉自己仓库的地址

把下面的 `YOUR_GITHUB_USERNAME/navigo` 换成你 Fork 之后的仓库地址。

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_GITHUB_USERNAME/navigo)

> 一键部署按钮会引导你授权 GitHub、创建 Pages 项目并自动读取仓库里的构建配置。
> 但它**不会**自动帮你创建 D1 数据库 —— 数据库那一步必须手动做一次（见下）。

### 手动流程（7 步）

| 步骤 | 操作 | 会动到什么 | 为什么要做 | 做完的后果 / 失败风险 |
| --- | --- | --- | --- | --- |
| 1 | Fork 本仓库到你自己的 GitHub | 只在你账号下新建一个仓库副本 | 一键部署按钮和 Pages 都需要一个属于你的仓库 | 无风险。上游更新后你可以随时同步 |
| 2 | Dashboard → **存储和数据库（Storage & Databases）→ D1 SQL database → Create database**，名字如 `navigo-db` | 在 Cloudflare 账号里新建一个 SQLite 库 | 账号、模块、链接都要落库 | 无风险。库是空的，费用在 D1 免费额度内 |
| 3 | 复制该库的 **Database ID** | 无 | 下一步要把它写进绑定 | 无风险 |
| 4 | **Workers & Pages → Create → Pages → Connect to Git**，选中你 Fork 的仓库 | 新建一个 Pages 项目 | 由 Cloudflare 帮你构建并托管 | 免费额度足够个人使用 |
| 5 | 构建配置填：Framework preset `Vue`，Build command `npm run build`，Build output directory `dist` | 只影响构建与产物目录 | 仓库根目录的 `vite.config.ts` 输出到 `dist/` | 若输出目录填错，部署后访问会 404 |
| 6 | **Settings → Functions → D1 database bindings → Add**：Variable name 填 `DB`，选中第 2 步建的库。**或者**把 Database ID 填进 `wrangler.toml` 的 `database_id` 后重新部署 | 给 Pages 项目挂上数据库绑定 | Functions 通过 `env.DB` 访问数据库 | ⚠️ **变量名必须是 `DB`**，写错会在页面上直接看到「D1 数据库未绑定」的明确提示 |
| 7 | 部署完成后打开站点，用 `admin / admin` 登录，**立刻在「后台设置 → 修改密码」里改密码** | 更新 users 表的密码哈希，并吊销全部会话 | 默认密码是公开的 | 改完需要重新登录一次 |

### 回滚

- **代码回滚**：Cloudflare Pages → Deployments → 选中上一个成功的版本 → **Rollback**。
- **数据回滚**：后台设置 → 数据管理 → **导出配置** 得到一份完整 JSON；要恢复时用 **导入配置** 覆盖即可。
  （密码不在这份 JSON 里，导入不会影响账号。）
- **彻底删掉**：删掉 Pages 项目和 D1 数据库即可，没有其它遗留资源。

---

## 内置网页搜索

导航页正文顶部有一条网页搜索栏，和头部那条「过滤导航条目」的搜索框是两件事：

| 位置 | 作用 |
| --- | --- |
| 头部搜索框 | 在**你自己的导航数据**里筛选模块与地址，不会发任何外部请求 |
| 正文搜索栏 | 把关键词交给搜索引擎，在**新标签页**打开结果 |

- 引擎：Google（默认）、百度、Bing。搜索框左侧的下拉菜单切换，当前引擎会带一个彩色单字标记。
  选择写回服务端 `settings.search_engine`，所以在手机上选了百度，电脑上打开也是百度；导出配置时也会一起带走。
- 下拉菜单的键盘行为对齐原生 `<select>`：`↑`/`↓` 切换、`Home`/`End` 跳首尾、`Enter` 或空格展开与选中、
  `Esc` 关闭并把焦点还给触发器，`Tab` 直接离开。`aria-activedescendant` 同步给读屏软件。
- 输入关键词后按回车或点「搜索」。关键词为空时按钮是禁用状态，不会误触发。
- 任意页面按 `/` 可直接聚焦搜索框（已经在别的输入框里打字时不会抢键）。
- 搜索链接走 `window.open(..., 'noopener,noreferrer')`，新页面拿不到 `window.opener`。

> 提示：Google 与 Bing 在部分网络环境下需要代理才能访问，这与本项目无关。
> 如果主要在内网环境使用，建议把引擎固定为百度。

---

## 三种访问模式是怎么工作的

每条链接最多可以填三个地址：

| 字段 | 用途 | 典型值 |
| --- | --- | --- |
| 内网地址 | 在家里 / 公司局域网直连 | `http://192.168.1.10:5000` |
| VPN 地址 | 通过组网（Tailscale、WireGuard 等）访问 | `http://100.66.1.10:5000` |
| 外网地址 | 公网域名 | `https://nas.example.com` |

打开页面时会按**当前访问的 hostname**自动判定模式，并在顶部显示：

| 你访问的地址 | 判定结果 |
| --- | --- |
| `192.168.x.x`、`10.x.x.x`、`172.16–31.x.x`、`127.0.0.1`、`*.local` | **内网** |
| `100.64.0.0/10` 网段（含 `100.66.x.x`） | **VPN** |
| 其它域名或公网 IP | **外网** |

顶部胶囊可以手动切到别的模式（比如你想临时借用外网地址看某个服务），
手动切换结果存在浏览器本地，点旁边的 ⟳ 按钮即可回到自动识别。

**地址回退**：当前模式下没有对应地址时，如果「后台设置 → 允许回退到外网地址」是开着的，
就会用外网地址顶上，并在条目上标一个橙色「外」角标；三个地址都没有的条目会置灰、不可点击。

---

## 图标是怎么来的

浏览器同源策略不允许网页读取第三方站点的 favicon，而且当导航页跑在 HTTPS 上时，
页面里的 `<img src="http://192.168.1.10/favicon.ico">` 会被浏览器的 Mixed Content 策略直接拦掉。
所以这里做了一条三层降级链：

1. **手动指定**：在链接里填了「自定义图标」就直接用它，优先级最高。
2. **服务端代理**：`GET /api/icon?domain=example.com`，先试 `/favicon.ico`，
   再解析首页 HTML 里的 `<link rel="icon">`，最后试 `/apple-touch-icon.png`。
   命中后写进 Cache API 与 D1 的 `icon_cache`（正缓存 7 天、负缓存 30 分钟），
   同一个域名不会反复去打外网站点。代理带 SSRF 防护：只允许 http/https，
   拒绝环回 / 私网 / 链路本地 / CGNAT 地址，重定向逐跳校验，最多 3 跳，响应体限制 256KB。
3. **公共 favicon 服务**：代理没拿到时，退到 `icons.duckduckgo.com`。
4. **中文首字兜底**：以上全部失败、或者目标本来就是内网/VPN 私网地址时，
   取名称的第一个汉字渲染成彩色圆形标识（纯英文名取首字母，纯数字取首位数字）。
   颜色按名称做稳定散列，同一个名字每次进来颜色都一样。

> **内网 / VPN 条目必然走首字兜底**，这不是 bug：Cloudflare 边缘节点进不了你的私网，
> 浏览器又有 Mixed Content 限制。如果你希望内网服务也有图标，请在链接里填「自定义图标」
> 指向一张公网可访问的图片。

---

## 接口一览

除 `auth/login` 和 `health` 外，全部要求有效会话；写操作额外校验同源 Origin。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 部署自检：DB 绑定状态、版本、账号数、构建信息 |
| `POST` | `/api/auth/login` | 登录，成功后下发 HttpOnly 会话 Cookie |
| `POST` | `/api/auth/logout` | 退出当前设备 |
| `POST` | `/api/auth/logout-all` | 吊销该账号全部设备的会话 |
| `GET` | `/api/auth/me` | 当前会话信息 |
| `POST` | `/api/auth/password` | 修改密码（校验旧密码，改完吊销全部会话） |
| `GET` | `/api/nav` | 一次返回全部模块、链接与设置（导航页只有 1 次往返） |
| `POST` | `/api/modules` | 新建模块 |
| `PUT` | `/api/modules/:id` | 重命名 / 换色 |
| `DELETE` | `/api/modules/:id` | 删除模块（级联删除其链接） |
| `POST` | `/api/links` | 新建链接 |
| `PUT` | `/api/links/:id` | 修改链接（也可改所属模块） |
| `DELETE` | `/api/links/:id` | 删除链接 |
| `POST` | `/api/reorder` | 批量保存拖拽后的排序，一个事务写回 |
| `POST` | `/api/settings` | 保存站点标题 / 副标题 / 外网回退开关 |
| `GET` | `/api/export` | 导出完整配置 JSON |
| `POST` | `/api/import` | 导入配置（覆盖当前模块与链接） |
| `POST` | `/api/demo` | 载入示例数据 |
| `GET` | `/api/icon?domain=` | favicon 代理 |

---

## 数据表

见 [`schema.sql`](./schema.sql)。运行时会在每个请求前幂等建表，所以该文件主要用于查阅与手动初始化。

| 表 | 用途 |
| --- | --- |
| `users` | 账号与 PBKDF2 密码哈希 |
| `sessions` | 会话令牌哈希与过期时间 |
| `login_attempts` | 登录失败限流（按 IP，15 分钟窗口，8 次锁定） |
| `modules` | 模块名称、主题色、排序 |
| `links` | 链接名称、图标、三种地址、排序 |
| `settings` | 站点标题、副标题、外网回退开关、默认搜索引擎等 |
| `icon_cache` | 图标抓取的正 / 负缓存 |

---

## 常见问题

**页面显示「D1 数据库未绑定」**
Pages 项目缺 D1 绑定，或变量名不是 `DB`。
去 Settings → Functions → D1 database bindings 添加，变量名必须是 `DB`，然后重新部署。

**登录后所有图标都是彩色首字**
说明图标代理没抓到。先确认目标地址是公网域名（内网/VPN 地址必然抓不到），
再检查是不是目标站点响应太慢或没有 favicon。

**改完密码后别的设备被踢下线了**
这是设计如此：改密会吊销该账号全部会话，所有设备需要重新登录。

**拖拽排序没保存成功**
界面会提示「排序保存失败，已恢复原顺序」，说明 `/api/reorder` 请求失败。
检查会话是否过期、以及 D1 是否可写。

**搜索的时候不能拖拽**
搜索状态下列表是过滤后的视图，拖动会让排序结果不可预期，所以那时拖拽被禁用。
清空搜索即可继续拖动。

---

## 安全说明

已经做到的：

- 密码 PBKDF2-SHA256 / 10 万轮 / 随机盐，恒定时间比较
- 会话令牌只在响应里出现一次，库里只存 SHA-256 哈希
- Cookie 为 `HttpOnly` + `SameSite=Lax`；HTTPS 下自动追加 `Secure`
- 写操作校验同源 Origin，阻止跨站请求伪造
- 登录失败按 IP 限流
- 图标代理有 SSRF 防护、体积限制、重定向校验，返回带 `nosniff` 与 sandbox CSP
- 链接地址协议白名单，只放行 `http:` / `https:`
- Pages 项目默认单个管理员账号，没有注册入口

需要你自己注意的：

- 部署后**务必**修改默认密码 `admin / admin`
- 导航页本身是登录后才可见，但请不要把敏感凭据直接写在链接名称里
- 如果你在 Fork 的仓库里改了 `functions/` 的逻辑，记得 `npm run typecheck:api` 再推

---

## 目录结构

```
NaviGo/
├── tokens.css                 # 设计令牌（颜色 / 字体 / 间距 / 阴影 / 动效 / z 轴）
├── wrangler.toml              # Pages 配置与 D1 绑定
├── schema.sql                 # 建表 SQL（运行时自动建表，此文件供查阅）
├── functions/                 # Cloudflare Pages Functions
│   ├── api/[[path]].ts        # 路由入口：鉴权、同源校验、分发
│   └── _lib/                  # http / db / auth / repo / icon / types
└── src/
    ├── api/                   # 接口封装与类型
    ├── stores/                # auth / nav / toast
    ├── utils/                 # hostMode（模式识别）/ icon（图标降级）/ palette（色板）
    ├── views/                 # LoginView / HomeView / AdminView
    └── components/            # 头部、模块卡片、链接条目、图标、弹窗、基础控件
```

---

## License

MIT
