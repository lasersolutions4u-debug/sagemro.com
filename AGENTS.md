# SAGEMRO 项目记忆

> ⚠️ **本文件由 Codex 自动加载**作为项目级记忆（system prompt）。
> 修改本文件 = 修改 Codex 在本项目的工作认知。请遵守第六节修改规则。

## 一、项目身份
- **业务**：MRO 工业品 B2B
- **仓库**：github.com/lasersolutions4u-debug/sagemro.com

## 二、三件套部署目标

| 组件       | 域名              | 平台               | 目录              | CF 项目名       |
| ---------- | ----------------- | ------------------ | ----------------- | --------------- |
| 国际版前端 | sagemro.com       | Cloudflare Pages   | `frontend/`       | `sagemro-com`   |
| 中国版前端 | sagemro.cn        | Cloudflare Pages   | `frontend/`       | `sagemro-cn`    |
| 管理后台   | admin.sagemro.com | Cloudflare Pages   | `admin/`          | `sagemro-admin` |
| API        | api.sagemro.com   | Cloudflare Workers | `worker/`（单数） | env=production  |

> 国际版与中国版**共用同一个 API**（`api.sagemro.com`）。中国版前端走独立分支 `china-edition`。

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
     └─ deploy-frontend → wrangler pages deploy frontend/dist --project-name=sagemro-cn
        （Worker / Admin 不部署）

**关键事实**：
- 三个目标全部由 GitHub Actions 调 wrangler 部署，**不使用** Cloudflare 原生 Git 集成
- 单一 workflow 文件 `deploy.yml` 管控全部
- 测试 → 门禁 → 并行部署的强制顺序
- **PR 永远不部署**，只跑 test job（jobs 层 `if: github.event_name == 'push'` 兜底）
- **china-edition 分支只部署前端**到 `sagemro-cn`，不触发 Worker / Admin 部署
- D1 schema 迁移和 Worker secrets 设置**不在 workflow 中**，需手动执行（详见 DEPLOY.md）

## 四、目录约定
- `/frontend/` — 主站源码，构建产物 `frontend/dist/`
- `/admin/` — 管理后台源码，构建产物 `admin/dist/`
- `/worker/` — Workers 后端（含 `wrangler.toml`，**单数**）
- `/.github/workflows/deploy.yml` — 唯一 CI/CD 入口
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
