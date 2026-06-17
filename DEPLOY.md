# SAGEMRO 部署指南

> 📖 配套文档：项目协作规则见 [CLAUDE.md](./CLAUDE.md)
> 本文件聚焦"如何部署 / 如何排查部署故障"
> ⚠️ 唯一事实来源是 `.github/workflows/deploy.yml`。本文与 yml 不一致时，以 yml 为准并修正本文。

---

## 1. 部署架构

### 1.1 平台总览（当前 Cloudflare 部署，中国版商业目标迁移阿里云）

| 组件       | 域名                | CF 项目 / 资源              | 工作目录              |
| ---------- | ------------------- | --------------------------- | --------------------- |
| 国际版前端 | `sagemro.com`       | Pages: `sagemro-com`        | `frontend/`           |
| 中国版前端 | `sagemro.cn`        | Pages: `sagemro-cn`         | `frontend/`（同源码） |
| 国际版后台 | `admin.sagemro.com` | Pages: `sagemro-admin`      | `admin/`              |
| 中国版后台 | `admin.sagemro.cn`  | Pages: `sagemro-admin-cn`   | `admin/`（同源码）    |
| 国际版工程师入口 | `engineer.sagemro.com` | Pages: `sagemro-engineer`（需先创建并绑定域名） | `frontend/`（Engineer 工作台） |
| 中国版工程师入口 | `engineer.sagemro.cn` | Pages: `sagemro-engineer-cn`（需先创建并绑定域名） | `frontend/`（Engineer 工作台） |
| 国际版 API | `api.sagemro.com`   | Workers: env=`production`   | `worker/`             |
| 中国版 API | `api.sagemro.cn`    | Workers: env=`production`   | `worker/`（同 Worker）|
| 国际版数据库 | —                 | D1: `sagemro-db`            | `worker/migrations/`  |
| 中国版数据库 | —                 | D1: `sagemro-db-cn`         | `worker/migrations/`  |
| 缓存       | —                   | KV namespace（绑定名 `KV`） | —                     |

中国版前台/后台在 `.cn` 域名下会自动调用 `https://api.sagemro.cn`。Worker 会按 API 域名或请求来源域名识别中国版流量，并路由到 `DB_CN`（`sagemro-db-cn`）。

`frontend/` 内已有工程师工作台入口逻辑，workflow 已补齐独立部署 `engineer.sagemro.com` / `engineer.sagemro.cn` 的 Pages job，Worker CORS 白名单也已包含这两个域名。正式启用前仍需先在 Cloudflare 创建 Pages 项目并绑定自定义域名。

> **中国区备案状态**：`sagemro.cn` 正在走阿里云备案初审。备案审核期间不要恢复 `sagemro.cn` / `www.sagemro.cn` 的 Cloudflare 解析。当前阿里云 ECS/Nginx 可用于备案接入和后续迁移准备，商业上线目标是把中国版前台、后台、工程师入口、API、数据库、对象存储和 AI 服务逐步迁移或接入国内合规服务。

> **历史说明**：前端曾同时配过 Netlify（`netlify.toml`）和 Cloudflare Pages，造成双重部署和流量分裂。现已统一到 Cloudflare Pages。原 `netlify.toml` 备份为 `netlify.toml.deprecated`，确认 Pages 稳定运行一段时间后可删除。

### 1.2 多分支部署矩阵

**关键事实**：
- `main` 分支部署国际版前台、国际版工程师入口、国际版后台和 Worker
- `china-edition` 分支部署中国版前台、中国版工程师入口和中国版后台，不部署 Worker
- 工程师入口部署目标为 `sagemro-engineer` / `sagemro-engineer-cn`，需要先在 Cloudflare 手动创建对应 Pages 项目并绑定域名
- `sagemro.com/admin.sagemro.com/engineer.sagemro.com` 调用 `api.sagemro.com`，使用 D1 `sagemro-db`
- `sagemro.cn/admin.sagemro.cn/engineer.sagemro.cn` 调用 `api.sagemro.cn`，使用 D1 `sagemro-db-cn`
- API 字段变更必须：先 PR 到 main → main 部署 Worker → 再 PR 到 china-edition；反向操作会让中国版 5xx
- PR 永远只跑测试，不部署（jobs 层用 `if: github.event_name == 'push'` 兜底）

### 1.3 触发与门禁

| 事件 | test | deploy-frontend | deploy-engineer | deploy-worker | deploy-admin |
|------|:----:|:---------------:|:---------------:|:-------------:|:------------:|
| PR → main | ✅ | ❌ | ❌ | ❌ | ❌ |
| push → main | ✅ | ✅ (sagemro-com) | ✅ (sagemro-engineer) | ✅ | ✅ (sagemro-admin) |
| push → china-edition | ✅ | ✅ (sagemro-cn) | ✅ (sagemro-engineer-cn) | ❌ | ✅ (sagemro-admin-cn) |

工程师入口已有独立 deploy job。Cloudflare Pages 项目和自定义域名未创建前，job 会失败或部署到错误目标，所以首次启用前必须先完成第 2.6 和 2.8 节。

所有 deploy job 都声明了 `environment: production`。可在 GitHub repo → Settings → Environments → `production` 里加 required reviewers，作为人工审批门禁。

---

## 2. 首次部署初始化

> 这一节是**初始化操作**，仅在项目第一次上线时做一遍。日常部署见第 3 节。

### 2.1 创建 Cloudflare API Token

CF Dashboard → My Profile → API Tokens → Create Custom Token，**逐项**勾选：

| 作用域 | 权限 | 用途 |
|--------|------|------|
| Account → Workers Scripts | Edit | 部署 API Worker |
| Account → D1 | Edit | 数据库迁移、绑定 |
| Account → KV Namespaces | Edit | KV 操作 |
| Zone → Cloudflare Pages | Edit | 部署 frontend / admin |
| Zone → Zone Settings | Read | wrangler 读取域配置 |
| Zone → DNS | Edit | 自定义域绑定 |

⚠️ **不要用 "Edit Cloudflare Workers" 模板**：缺 Pages / D1 / KV 权限。

### 2.2 配置 GitHub Secrets

`https://github.com/lasersolutions4u-debug/sagemro.com/settings/secrets/actions`

| Secret | 值来源 |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | 上一步创建的 token |
| `CLOUDFLARE_ACCOUNT_ID` | CF Dashboard 右侧栏 |

### 2.3 创建 D1 数据库

```bash
cd worker
npx wrangler login
npx wrangler d1 create sagemro-db
# 复制输出的 database_id
~~~



把 `database_id` 填进 `worker/wrangler.toml`：

toml

```text
[[d1_databases]]
binding = "DB"
database_name = "sagemro-db"
database_id = "你复制的 database_id"
```



### 2.4 创建 KV Namespace

bash

```bash
npx wrangler kv:namespace create "SAGEMRO_KV"
```



把返回的 `id` 填进 `worker/wrangler.toml`：

toml

```text
[[kv_namespaces]]
binding = "KV"
id = "你复制的 KV id"
```



### 2.5 设置 Worker secrets（敏感配置）

`wrangler.toml` 里**不能**放敏感密钥。以下值必须用 `wrangler secret put` 单独设置：

bash

```bash
cd worker
npx wrangler secret put OPENAI_API_KEY --env production
npx wrangler secret put OPENAI_API_ENDPOINT --env production
npx wrangler secret put OPENAI_CHAT_MODEL --env production   # 例如 deepseek-chat / gpt-4o-mini / 兼容端点支持的聊天模型
npx wrangler secret put OPENAI_JSON_MODEL --env production   # 可选；摘要/报价点评等 JSON 任务模型，不设则回退聊天模型
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put ONESIGNAL_REST_API_KEY --env production
```



⚠️ **GitHub Actions workflow 不会自动设置这些 secrets**。一次性手动配置后存活在 CF 上，除非你主动改。但**轮换密钥时**必须手动重跑这几条命令。

### 2.6 创建 Pages 项目（空壳）

由于不用 CF 原生 Git 集成，需要先在 CF 上**手动建四个已启用的 Pages 项目**：

CF Dashboard → Workers & Pages → Create application → Pages → **Direct Upload**，分别建：

- `sagemro-com`
- `sagemro-cn`
- `sagemro-admin`
- `sagemro-admin-cn`

工程师入口已写入 `.github/workflows/deploy.yml`，因此还需要手动新增两个 Pages 项目：

- `sagemro-engineer`
- `sagemro-engineer-cn`

⚠️ **项目名必须和 deploy.yml 里写的完全一致**。如果不一致，`wrangler pages deploy` 会自动创建一个新项目（名字对得上 yml），导致出现孤儿项目——部署成功了但访问的是另一个 URL。

### 2.7 跑首次数据库迁移

bash

```bash
cd worker
npx wrangler d1 migrations apply sagemro-db --remote --env production
```



### 2.8 配置自定义域名

| 项目                   | 自定义域名                                                   |
| ---------------------- | ------------------------------------------------------------ |
| Pages: `sagemro-com`   | `sagemro.com`、`www.sagemro.com`                             |
| Pages: `sagemro-cn`    | `sagemro.cn`、`www.sagemro.cn`                               |
| Pages: `sagemro-admin` | `admin.sagemro.com`                                          |
| Pages: `sagemro-admin-cn` | `admin.sagemro.cn`                                       |
| Pages: `sagemro-engineer` | `engineer.sagemro.com`（待创建）                         |
| Pages: `sagemro-engineer-cn` | `engineer.sagemro.cn`（待创建）                      |
| Worker: `sagemro-api`  | `api.sagemro.com`、`api.sagemro.cn`（在 Worker → Triggers → Custom Domains 里加） |

CF 自动签发 SSL 证书。

⚠️ `sagemro.cn` / `www.sagemro.cn` 当前为阿里云备案需要，不能在初审期间恢复到 Cloudflare。待备案通过后，再按阿里云接入和正式迁移方案恢复或调整解析。

------

## 3. 日常部署流程

### 🔴 部署前必做：检查 migration 是否遗漏

**每次 Worker 部署前（无论 CI 还是手动），必须确认所有新 migration 文件已在生产 D1 执行过。**

CI 不会自动跑 D1 migration，Worker 部署成功后如果缺列/缺表，API 会直接 500。

检查方法：
```bash
# 对比本地 migration 文件和生产 D1 已执行的记录
cd worker
npx wrangler d1 execute sagemro-db --env production --remote \
  --command "SELECT version FROM _migrations ORDER BY version;"

npx wrangler d1 execute sagemro-db-cn --env production --remote \
  --command "SELECT version FROM _migrations ORDER BY version;"

# 与 migrations/ 目录对比，找出缺失的
ls migrations/*.sql
```

补跑缺失的 migration：
```bash
npx wrangler d1 execute sagemro-db --env production --remote --file migrations/0XX_xxx.sql
npx wrangler d1 execute sagemro-db-cn --env production --remote --file migrations/0XX_xxx.sql
```

---

完成初始化后，日常部署只有一个动作：

```bash
git push origin main             # 部署 frontend (sagemro-com) + worker + admin (sagemro-admin)
git push origin china-edition    # 部署 frontend (sagemro-cn) + admin (sagemro-admin-cn)
```

GitHub Actions 自动：

1. 跑 `test` job（worker 单测、frontend/admin build 校验）
2. 通过后进入 `production` environment（如配置 reviewers，等待审批）
3. 按上面的"部署矩阵"分发到对应目标

进度查看：`https://github.com/lasersolutions4u-debug/sagemro.com/actions`

### ⚠️ 不会自动做的事

| 操作                               | 触发方式                                                     | 说明                                                         |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| D1 schema 迁移                     | **手动**：逐个文件执行 `wrangler d1 execute sagemro-db --remote --env production --file migrations/0XX.sql` | ⚠️ **最易遗漏**。Worker 部署成功但运行时 `no such column` 或 `no such table`，就是迁移没跑 |
| Worker secrets 轮换                | **手动**：`wrangler secret put XXX --env production`         | 见 2.5 节                                                    |
| `wrangler.toml` 中的 D1/KV ID 变更 | **手动**：改文件后 commit & push                             | 这个会随 worker 部署生效，但要确认 CF 上对应资源真存在       |

------

## 4. 应急本地部署（CI 不可用时）

GitHub Actions 挂了或 token 失效来不及修，但又必须发版：

bash

```bash
# 部署 Worker
cd worker
npx wrangler deploy --env production

# 部署国际版前端
cd ../frontend
npm ci && npm run build
cd ..
npx wrangler pages deploy frontend/dist --project-name=sagemro-com --branch=main

# 部署中国版前端（在 china-edition 分支上）
git checkout china-edition
cd frontend && npm ci && npm run build && cd ..
npx wrangler pages deploy frontend/dist --project-name=sagemro-cn --branch=china-edition

# 部署国际版 Admin
cd admin
npm ci && npm run build
cd ..
npx wrangler pages deploy admin/dist --project-name=sagemro-admin --branch=main

# 部署中国版 Admin（在 china-edition 分支上）
git checkout china-edition
cd admin && npm ci && npm run build && cd ..
npx wrangler pages deploy admin/dist --project-name=sagemro-admin-cn --branch=china-edition
```



⚠️ 应急部署**绕过了 test job**，事后必须把对应 commit 也走一次正常 CI 验证。

------

## 5. 部署后验证

| 检查项      | URL                                                       | 期望          |
| ----------- | --------------------------------------------------------- | ------------- |
| 国际版首页  | `https://sagemro.com`                                     | 200，正常加载 |
| 中国版首页  | `https://sagemro.cn`                                      | 200，正常加载 |
| 国际版后台  | `https://admin.sagemro.com`                               | 登录页        |
| 中国版后台  | `https://admin.sagemro.cn`                                | 登录页        |
| 国际版工程师入口 | `https://engineer.sagemro.com`                       | 登录页或工程师工作台 |
| 中国版工程师入口 | `https://engineer.sagemro.cn`                        | 备案通过和域名绑定后验证 |
| 国际版 Worker 健康 | `https://api.sagemro.com/health`                   | 200 OK        |
| 中国版 Worker 健康 | `https://api.sagemro.cn/health`                    | 200 OK        |
| 国际版 API 烟测 | `https://api.sagemro.com/api/workorders?customer_id=test` | JSON 响应 |
| 中国版 API 烟测 | `https://api.sagemro.cn/api/workorders?customer_id=test` | JSON 响应 |

------

## 6. 回滚

| 目标                    | 方式                                                         |
| ----------------------- | ------------------------------------------------------------ |
| 前端（任一 Pages 项目） | CF Dashboard → 该项目 → Deployments → 选历史版本 → **Rollback** |
| Admin                   | 同上                                                         |
| Worker                  | CF Dashboard → Workers → `sagemro-api` → Deployments → 选历史版本 → Rollback；或 `git revert` 后 push（推荐，状态可追溯） |
| D1 schema               | **没有自动回滚**。Migration 一旦应用就只能写反向 migration 修复。重要 schema 变更前先 `wrangler d1 export` 备份 |

------

## 7. 故障排查

### 7.1 GitHub Actions 部署失败

先看挂在哪个 job：

- `test` 失败 → 代码问题，本地复现修
- `deploy-*` 失败 → 多半是 token 权限或资源 ID 问题

常见错误：

- `Authentication error [code: 10000]` → token 缺权限，回到 2.1 节对照表逐项检查
- `Project not found` → CF 上对应 Pages 项目不存在或名字拼错（见 2.6 节）
- `D1_ERROR: no such table` → 生产库没跑迁移（见 3 节"不会自动做的事"）
- `binding XXX not found` → `wrangler.toml` 里的绑定名和代码里 `env.XXX` 不一致

### 7.2 Worker 调试

bash

```bash
cd worker
npx wrangler dev                      # 本地启动
npx wrangler tail --env production    # 看生产实时日志
```



### 7.3 D1 连接失败

- `wrangler.toml` 里 `database_id` 是不是生产库的 ID（不是 local 的）
- 绑定名是不是 `DB`（代码里 `env.DB` 必须对得上）
- 迁移有没有跑过 `--remote` 模式

### 7.4 前端连不上 API

- `frontend/src/services/api.js` / `admin/src/services/api.js` 是否按 `.cn` 域名自动选择 `api.sagemro.cn`
- DevTools → Network 看请求是否被 CORS 拦截
- Worker 端 `Access-Control-Allow-Origin` 是否设置正确
- 工程师独立入口启用前，要确认 Worker CORS 已加入 `engineer.sagemro.com` 和 `engineer.sagemro.cn`

### 7.5 Pages 部署成功但 404

- `wrangler pages deploy` 的 `--project-name` 在 CF 上是否真存在
- 自定义域名 DNS 还没生效（一般几分钟，最长 24h）
- Build output directory 不对（应是 `frontend/dist` / `admin/dist`）

### 7.6 china-edition 部署后中国版报 5xx

很可能是"china-edition 调用了 main 还没合并的 API"，或 `api.sagemro.cn` 未绑定到 Worker。
解决：先把 API 变更 PR 到 main → 等 worker 部署 → 确认 Worker 自定义域名含 `api.sagemro.cn` → 再让 china-edition 上线。
