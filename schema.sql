-- NaviGo 数据库结构（Cloudflare D1 / SQLite）
--
-- 正常情况下你不需要手动执行这个文件：
--   functions/_lib/db.ts 会在每次请求前做幂等的 CREATE TABLE IF NOT EXISTS，
--   并在 users 表为空时自动播种默认管理员 admin / admin。
--
-- 这里提供一份等价 SQL，用于：
--   1. 想自己控制建表时机的自托管场景；
--   2. 用 wrangler d1 execute 手动初始化（npm run db:init）；
--   3. 排查线上表结构是否符合预期。

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts (ip, at);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'mint',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  url_lan TEXT,
  url_vpn TEXT,
  url_wan TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_links_module ON links (module_id, sort_order);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS icon_cache (
  domain TEXT PRIMARY KEY,
  status INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- 脚本用的 Bearer 令牌。token_hash 负责查表匹配，token_plain 让后台可以随时掩码查看、
-- 复制；因为默认只活 15 分钟且过期即删，这里接受了「明文可回读」这个取舍。
-- prefix 是明文前 8 位（nvk_ab12cd34），仅用于在列表里辨认是哪一枚。
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_plain TEXT,
  user_id INTEGER NOT NULL,
  scopes TEXT NOT NULL DEFAULT 'read,write',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens (user_id);

-- ── 从 v1.0 升级上来的旧库 ────────────────────────────────────────
-- v1.1 起 links 增加了 description 列。运行时也会自动补（见 functions/_lib/db.ts），
-- 只有在你手动管理 schema 时才需要执行这一句；重复执行会报 duplicate column，属正常。
-- ALTER TABLE links ADD COLUMN description TEXT;

-- 站点默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_title', 'NaviGo');
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_subtitle', '内网 · VPN · 外网，一处直达');
INSERT OR IGNORE INTO settings (key, value) VALUES ('fallback_wan', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('password_changed', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('search_engine', 'google');
