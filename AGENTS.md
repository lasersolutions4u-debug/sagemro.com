# SAGEMRO 项目记忆

> ⚠️ **本文件由 Codex 自动加载**作为项目级记忆（system prompt）。
> 修改本文件 = 修改 Codex 在本项目的工作认知。请遵守第六节修改规则。

## 一、项目身份
- **业务**：MRO 工业品 B2B
- **仓库**：github.com/lasersolutions4u-debug/sagemro.com

## 二、三件套部署目标

| 组件                          | 域名                                                    | 实际平台                            | 目录                     | 部署目标                                                    |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------- | ------------------------ | ----------------------------------------------------------- |
| 国际版前端                    | sagemro.com                                             | Cloudflare Pages                    | `frontend/`（dist）      | `sagemro-com`                                               |
| 国际版 AI 门户                | ai.sagemro.com                                          | Cloudflare Pages                    | `frontend/`（dist-portal） | `sagemro-ai`                                              |
| 国际版管理后台                | admin.sagemro.com                                       | Cloudflare Pages                    | `admin/`                 | `sagemro-admin`                                             |
| 国际版 API                    | api.sagemro.com                                         | Cloudflare Workers                  | `worker/`（单数）        | env=production                                              |
| **中国版全部**（公开站 / AI 门户 / 后台 / 工程师端） | sagemro.cn · `ai.` · `admin.` · `engineer.sagemro.cn` | **阿里云 ECS + nginx**              | `frontend/`、`admin/`    | `/var/www/sagemro-cn/current/{frontend,ai,admin,engineer}`   |
| 中国版 API                    | api.sagemro.cn                                          | 同上（经阿里云 nginx 前置到共用 Worker） | —                    | —                                                           |

> **平台口径以实测为准（2026-09-15 复核）**：`sagemro.cn`、`www.sagemro.cn`、`ai.sagemro.cn`、`admin.sagemro.cn`、`engineer.sagemro.cn`、`api.sagemro.cn` 的响应头全部是 `nginx/1.18.0 (Ubuntu)`；COM 侧全部是 `cloudflare`。**CN 目前不在 Cloudflare 上服务。**
> 国际版与中国版**共用同一个 Worker**，分别绑定 COM / CN 两套 D1。中国版源码走独立分支 `china-edition`。

## 三、部署流程

### 国际版（COM）：push `main` 自动部署

Codex（本地）
 ↓ git push origin main
 GitHub Actions: .github/workflows/deploy.yml
 ↓
 [test job]（PR 也跑，但只跑测试，不进入下面任何部署）
 ↓ needs: test + environment: production 审批门禁
 ├─ deploy-worker      → wrangler deploy --env production (cwd: worker/)
 ├─ deploy-ai-frontend → wrangler pages deploy frontend/dist-portal --project-name=sagemro-ai
 ├─ deploy-frontend    → wrangler pages deploy frontend/dist        --project-name=sagemro-com
 └─ deploy-admin       → wrangler pages deploy admin/dist           --project-name=sagemro-admin

### 中国版（CN）：独立链路，**只能手动触发**

 push `china-edition` 只跑测试；`deploy.yml` 上仍会执行
 deploy-frontend → CF Pages `sagemro-cn` 与 deploy-admin → CF Pages `sagemro-admin-cn`
 ⚠️ 这两条 CF Pages 发布**不是** CN 线上服务的来源

 CN 真正的生产发布：
   Actions 页面手动 dispatch `Deploy China Edition to Aliyun ECS`
   （`.github/workflows/aliyun-cn-deploy.yml`）
   → workflow 硬校验 `GITHUB_REF_NAME == china-edition`，不满足直接失败
   → 构建 frontend(public) + frontend(portal) + admin
   → scp 到阿里云 ECS，解包到 /var/www/sagemro-cn/releases/<sha12>-<run>
   → 切换 current/{frontend,ai,admin,engineer} 符号链接 → nginx -t → reload nginx
   → 健康检查 sagemro.cn / ai / admin / engineer / api.sagemro.cn/health

**关键事实**：
- **CN 生产发布必须手动 dispatch，且只能从 `china-edition` 触发**；不发布就不会更新
- `deploy.yml` 在 `china-edition` 上确实会发布前端与 Admin 到 CF Pages（`sagemro-cn` / `sagemro-admin-cn`），但 CN 线上由阿里云 nginx 提供，两者不是一回事
- Worker 与 AI 门户**只在 `main` 上部署**
- COM 侧由 GitHub Actions 调 wrangler 部署，**不使用** Cloudflare 原生 Git 集成
- **PR 永远不部署**，只跑 test job（jobs 层 `if: github.event_name == 'push'` 兜底）
- D1 schema 迁移和 Worker secrets 设置**不在 workflow 中**，需手动执行（详见 DEPLOY.md）

## 四、目录约定
- `/frontend/` — 主站源码，构建产物 `frontend/dist/`
- `/admin/` — 管理后台源码，构建产物 `admin/dist/`
- `/worker/` — Workers 后端（含 `wrangler.toml`，**单数**）
- `/.github/workflows/deploy.yml` — COM（Cloudflare）CI/CD 入口
- `/.github/workflows/aliyun-cn-deploy.yml` — CN 生产发布入口（**仅手动 dispatch，仅允许 `china-edition`**）
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
