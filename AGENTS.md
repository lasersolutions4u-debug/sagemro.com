# SAGEMRO 项目记忆

> ⚠️ **本文件由 Codex 自动加载**作为项目级记忆（system prompt）。
> 修改本文件 = 修改 Codex 在本项目的工作认知。请遵守第六节修改规则。

## 一、项目身份
- **业务**：MRO 工业品 B2B
- **仓库**：github.com/lasersolutions4u-debug/sagemro.com

## 二、六入口部署与运营目标

| 组件       | 域名              | 平台               | 目录              | CF 项目名       |
| ---------- | ----------------- | ------------------ | ----------------- | --------------- |
| 国际版前端 | sagemro.com       | Cloudflare Pages   | `frontend/`       | `sagemro-com`   |
| 中国版前端 | sagemro.cn        | Cloudflare Pages   | `frontend/`       | `sagemro-cn`    |
| 国际版后台 | admin.sagemro.com | Cloudflare Pages   | `admin/`          | `sagemro-admin` |
| 中国版后台 | admin.sagemro.cn  | Cloudflare Pages   | `admin/`          | `sagemro-admin-cn` |
| 国际版工程师端 | engineer.sagemro.com | Cloudflare Pages | `frontend/`（engineer host） | `sagemro-engineer`（需先在 CF 创建并绑定域名） |
| 中国版工程师端 | engineer.sagemro.cn | Cloudflare Pages / 阿里云迁移目标 | `frontend/`（engineer host） | `sagemro-engineer-cn`（需先在 CF 创建并绑定域名） |
| 国际版 API  | api.sagemro.com   | Cloudflare Workers | `worker/`（单数） | env=production  |
| 中国版 API  | api.sagemro.cn    | Cloudflare Workers / 阿里云迁移目标 | `worker/`（单数） | env=production  |

> 当前国际版与中国版使用同一套前端/后台/Worker 代码，但按域名切换 API 和数据库。`.cn` 域名默认调用 `api.sagemro.cn`，Worker 按 `.cn` API 域名或来源域名路由到 `DB_CN`。中国版正式商用目标是逐步迁移到阿里云可备案接入环境。

## 三、部署流程

Codex（本地）
 ↓ git push origin main / china-edition
 GitHub Actions: .github/workflows/deploy.yml
 ↓
 [test job]（PR 也跑，但只跑测试，不进入下面任何部署）
 ↓ needs: test + environment: production 门禁
 ↓ 按分支分发
 ├─ push main：
 │   ├─ deploy-frontend → wrangler pages deploy frontend/dist --project-name=sagemro-com
 │   ├─ deploy-engineer → wrangler pages deploy frontend/dist --project-name=sagemro-engineer
 │   ├─ deploy-admin    → wrangler pages deploy admin/dist    --project-name=sagemro-admin
 │   └─ deploy-worker   → wrangler deploy --env production (cwd: worker/)
 └─ push china-edition：
     ├─ deploy-frontend → wrangler pages deploy frontend/dist --project-name=sagemro-cn
     ├─ deploy-engineer → wrangler pages deploy frontend/dist --project-name=sagemro-engineer-cn
     └─ deploy-admin    → wrangler pages deploy admin/dist    --project-name=sagemro-admin-cn
        （Worker 不部署）

**关键事实**：
- Cloudflare 目标全部由 GitHub Actions 调 wrangler 部署，**不使用** Cloudflare 原生 Git 集成
- 单一 workflow 文件 `deploy.yml` 管控全部
- 测试 → 门禁 → 并行部署的强制顺序
- **PR 永远不部署**，只跑 test job（jobs 层 `if: github.event_name == 'push'` 兜底）
- **china-edition 分支部署中国版前端、中国版工程师端和中国版后台**，不触发 Worker 部署
- **工程师端代码入口、CORS 白名单和 CI 部署 job 已补齐**；正式访问还需要先在 Cloudflare 创建 Pages 项目并绑定 `engineer.*` 自定义域名
- **中国版正式商用目标是阿里云接入**；备案通过前不得恢复 `sagemro.cn` / `www.sagemro.cn` 对外解析，不得正式上线中国版业务功能
- D1 schema 迁移和 Worker secrets 设置**不在 workflow 中**，需手动执行（详见 DEPLOY.md）；workflow 只在部署前检查 `sagemro-db` 和 `sagemro-db-cn` 是否缺 migration

## 四、目录约定
- `/frontend/` — 主站源码，构建产物 `frontend/dist/`
- `/frontend/src/components/Engineer/` — 工程师工作台源码（当前与主站共用构建）
- `/admin/` — 管理后台源码，构建产物 `admin/dist/`
- `/worker/` — Workers 后端（含 `wrangler.toml`，**单数**）
- `/.github/workflows/deploy.yml` — 唯一 CI/CD 入口
- `/.Codex/memory/` — Codex 跨会话笔记（坚果云同步，**不进 git**）
- `/AGENTS.md`、`/TECH-SPEC.md`、`/DEPLOY.md` — 项目文档（进 git）

## 五、协作约束
- 所有提交必须能通过 `test` job
- 修改 `wrangler.toml` / `deploy.yml` / Pages 项目名前，先在对话中确认
- secrets 只在 GitHub Repo Settings 配置，绝不写入代码
- API Token 是 **Custom Token**（见 TECH-SPEC.md），**不是** "Edit Cloudflare Workers" 模板
- 🔴 **新增 migration 文件后，部署 Worker 前必须手动在生产 D1 执行。CI 不会自动跑 migration。遗漏会导致 API 500。**
  - 检查命令：`wrangler d1 execute sagemro-db --env production --remote --command "SELECT version FROM _migrations ORDER BY version;"`
  - 补跑命令：`wrangler d1 execute sagemro-db --env production --remote --file migrations/0XX_xxx.sql`

## 六、本文件修改规则
1. 修改前在对话中说明动机
2. 一次只改一个主题
3. 提交信息格式：`docs(Codex-md): 修改 X 节 - 原因`

## 七、Codex 项目记忆架构

| 文件                  | 位置   | 同步方式 | 进 git？          |
| --------------------- | ------ | -------- | ----------------- |
| `AGENTS.md`           | 项目根 | git      | ✅                 |
| `TECH-SPEC.md`        | 项目根 | git      | ✅                 |
| `DEPLOY.md`           | 项目根 | git      | ✅                 |
| `.Codex/memory/*.md` | 项目内 | 坚果云   | ❌（已 gitignore） |

- `AGENTS.md` 等文档：Codex 自动加载 + 团队共享 → git
- `.Codex/memory/`：跨会话私人笔记（决策草稿、未公开思路）→ 坚果云
