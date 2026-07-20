# SAGEMRO 项目记忆

> ⚠️ **本文件由 Codex 自动加载**作为项目级记忆（system prompt）。
> 修改本文件 = 修改 Codex 在本项目的工作认知。请遵守第六节修改规则。

## 一、项目身份
- **业务**：MRO 工业品 B2B
- **仓库**：github.com/lasersolutions4u-debug/sagemro.com

## 二、当前生产入口与部署目标

| 组件       | 域名              | 当前生产平台       | 目录              | 说明            |
| ---------- | ----------------- | ------------------ | ----------------- | --------------- |
| 国际版前端 | sagemro.com       | Cloudflare Pages   | `frontend/`       | Pages 项目 `sagemro-com` |
| 国际版后台 | admin.sagemro.com | Cloudflare Pages   | `admin/`          | Pages 项目 `sagemro-admin` |
| 国际版 API | api.sagemro.com   | Cloudflare Workers | `worker/`（单数） | env=production，使用 D1 `sagemro-db` |
| 中国版前端 | sagemro.cn        | 阿里云 ECS + nginx | `frontend/`       | Cloudflare Pages `sagemro-cn` 仅是辅助部署目标，实际 `.cn` 生产流量走阿里云 |
| 中国版后台 | admin.sagemro.cn  | 阿里云 ECS + nginx | `admin/`          | 由 `.github/workflows/aliyun-cn-deploy.yml` 发布到 ECS |
| 中国版工程师端 | engineer.sagemro.cn | 阿里云 ECS + nginx | `frontend/`（engineer host） | ECS 上 `current/engineer` 指向同一套 frontend 构建 |
| 中国版 API | api.sagemro.cn    | Cloudflare Workers | `worker/`（单数） | 同一 Worker，按 `.cn` 域名/来源路由到 D1 `sagemro-db-cn` |

> 中国版前台、后台、工程师端当前实际生产发布必须走阿里云 ECS workflow。普通 Cloudflare Pages 部署成功不等于 `.cn` 线上已经更新。

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
 │   ├─ deploy-admin    → wrangler pages deploy admin/dist    --project-name=sagemro-admin
 │   └─ deploy-worker   → wrangler deploy --env production (cwd: worker/)
 └─ push china-edition：
     ├─ deploy-frontend → wrangler pages deploy frontend/dist --project-name=sagemro-cn
     └─ deploy-admin    → wrangler pages deploy admin/dist    --project-name=sagemro-admin-cn
        （Worker 不部署；这一步不是 `.cn` ECS 生产发布）

中国版 ECS 生产发布（手动触发）
 ↓ gh workflow run aliyun-cn-deploy.yml --ref china-edition
 GitHub Actions: .github/workflows/aliyun-cn-deploy.yml
 ↓ build frontend + admin
 ↓ 打包上传到阿里云 ECS
 ↓ 切换 `/var/www/sagemro-cn/current/{frontend,engineer,admin}` 并 reload nginx
 ↓ smoke: sagemro.cn / admin.sagemro.cn / engineer.sagemro.cn / api.sagemro.cn/health

**关键事实**：
- Cloudflare 目标由 GitHub Actions 调 wrangler 部署，**不使用** Cloudflare 原生 Git 集成
- `deploy.yml` 管控 Cloudflare Pages/Worker；`aliyun-cn-deploy.yml` 管控中国版 ECS 生产发布
- 测试 → 门禁 → 并行部署的强制顺序
- **PR 永远不部署**，只跑 test job（jobs 层 `if: github.event_name == 'push'` 兜底）
- **china-edition push 会部署 Cloudflare Pages 的中国版前台/后台，但不会部署 Worker，也不会自动发布到阿里云 ECS**
- **`.cn` 真实线上更新必须手动触发 `Deploy China Edition to Aliyun ECS` workflow**
- Worker/API/schema 变更需要同步到 `main` 并部署 Worker；`china-edition` 不部署 Worker
- D1 schema 迁移和 Worker secrets 设置**不在 workflow 中**，需手动执行（详见 DEPLOY.md）

## 四、目录约定
- `/frontend/` — 主站源码，构建产物 `frontend/dist/`
- `/admin/` — 管理后台源码，构建产物 `admin/dist/`
- `/worker/` — Workers 后端（含 `wrangler.toml`，**单数**）
- `/.github/workflows/deploy.yml` — Cloudflare Pages/Worker 部署入口
- `/.github/workflows/aliyun-cn-deploy.yml` — 中国版 ECS 生产发布入口
- `/.Codex/memory/` — Codex 跨会话笔记（坚果云同步，**不进 git**）
- `/AGENTS.md`、`/TECH-SPEC.md`、`/DEPLOY.md` — 项目文档（进 git）

## 五、协作约束
- 所有提交必须能通过完整的 `test` job（包含 Worker 测试、前端 lint/测试/构建和后台构建）
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


<claude-mem-context>
# Memory Context

# [sagemro.com] recent context, 2026-07-20 9:45am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 17 obs (3,513t read) | 760,103t work | 100% savings

### Jul 12, 2026
1978 11:44a 🔵 SAGEMRO 中文站前端国际化状态扫描
1979 11:45a 🔵 Footer.jsx 已实现中英文切换
1980 " 🔵 SAGEMRO 中文站前端国际化扫描（第一批）— 发现 3 处硬编码英文和小优化点
S738 中文站 sagemro.cn i18n 审计 — 扫描 Worker 后端和前端残留英文 (Jul 12 at 11:47 AM)
S737 中文站（sagemro.cn）i18n 审计：深入每个页面和功能架构，找出显示英文的地方 (Jul 12 at 11:47 AM)
S740 Verify China Edition deployment to Aliyun ECS succeeded (Jul 12 at 11:53 AM)
1981 11:53a ⚖️ 用户确认继续执行当前任务
1982 12:12p 🔴 Fixed two frontend contract tests that failed CI for Aliyun ECS deploy
S739 Verify and fix China Edition deployment to Aliyun ECS (Jul 12 at 12:28 PM)
1983 12:31p 🔵 中文站结算币种硬编码为 USD
1984 " ⚖️ 工单新消息通知需求确认
1985 3:29p 🟣 添加中国站国内公户付款信息
1986 6:26p ✅ Chinese version payment info to be added to euchio.com
1987 6:45p ✅ Service work order UI optimization requested
1988 7:15p ✅ Admin nav tab renamed from "派工与服务质量" to "服务工单"
### Jul 19, 2026
1989 10:40p 🔵 Sagemro frontend API service contains funnel tracking system
### Jul 20, 2026
1990 12:27a 🔵 Sagemro codebase exploration in engineer-entry-links-cn worktree
1991 12:30a ✅ Updated brand-assets-contract test to match new WelcomePage copy
1992 12:34a ✅ Updated registerCustomer test assertion to include conversation_id parameter
1993 12:36a ✅ Fixed ToolBar and IndustryToolsPage href test assertions in contract test
1994 12:37a ✅ Fixed WorkOrderDetailModal redactContactInfo assertion to match formatServiceTextForLocale wrapper

Access 760k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
