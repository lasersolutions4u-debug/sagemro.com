# SAGEMRO 项目记忆

> ⚠️ **本文件由 Claude Code / Cloud Code 自动加载**作为项目级记忆（system prompt）。
> 修改本文件 = 修改 Claude Code / Cloud Code 在本项目的工作认知。请遵守第六节修改规则。

## 一、项目身份
- **业务**：MRO 工业品 B2B
- **仓库**：github.com/lasersolutions4u-debug/sagemro.com

## 二、当前生产入口与部署目标

| 组件 | 域名 | 当前生产平台 | 目录 | 说明 |
| --- | --- | --- | --- | --- |
| 国际版前端 | sagemro.com | Cloudflare Pages | `frontend/` | Pages 项目 `sagemro-com` |
| 国际版后台 | admin.sagemro.com | Cloudflare Pages | `admin/` | Pages 项目 `sagemro-admin` |
| 国际版 API | api.sagemro.com | Cloudflare Workers | `worker/`（单数） | env=production，使用 D1 `sagemro-db` |
| 中国版前端 | sagemro.cn | 阿里云 ECS + nginx | `frontend/` | Cloudflare Pages `sagemro-cn` 仅是辅助部署目标，实际 `.cn` 生产流量走阿里云 |
| 中国版后台 | admin.sagemro.cn | 阿里云 ECS + nginx | `admin/` | 由 `.github/workflows/aliyun-cn-deploy.yml` 发布到 ECS |
| 中国版工程师端 | engineer.sagemro.cn | 阿里云 ECS + nginx | `frontend/`（engineer host） | ECS 上 `current/engineer` 指向同一套 frontend 构建 |
| 中国版 API | api.sagemro.cn | Cloudflare Workers | `worker/`（单数） | 同一 Worker，按 `.cn` 域名/来源路由到 D1 `sagemro-db-cn` |

> 中国版前台、后台、工程师端当前实际生产发布必须走阿里云 ECS workflow。普通 Cloudflare Pages 部署成功不等于 `.cn` 线上已经更新。

## 三、部署流程

Claude Code / Cloud Code（本地）
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
- `/.claude/memory/` — Claude Code / Cloud Code 跨会话笔记（本地私有，**不进 git**）
- `/CLAUDE.md`、`/TECH-SPEC.md`、`/DEPLOY.md` — Claude Code / Cloud Code 应优先读取的项目文档（进 git）

## 五、协作约束
- 所有提交必须能通过完整的 `test` job（包含 Worker 测试、前端 lint/测试/构建和后台构建）
- 修改 `wrangler.toml` / `deploy.yml` / `aliyun-cn-deploy.yml` / Pages 项目名 / ECS 发布路径前，先在对话中确认
- secrets 只在 GitHub Repo Settings 或服务器环境配置，绝不写入代码
- API Token 是 **Custom Token**（见 TECH-SPEC.md），**不是** "Edit Cloudflare Workers" 模板
- 🔴 **新增 migration 文件后，部署 Worker 前必须手动在生产 D1 执行。CI 不会自动跑 migration。遗漏会导致 API 500。**
  - 国际库检查命令：`wrangler d1 execute sagemro-db --env production --remote --command "SELECT version FROM _migrations ORDER BY version;"`
  - 国际库补跑命令：`wrangler d1 execute sagemro-db --env production --remote --file migrations/0XX_xxx.sql`
  - 中国库同样需要确认 `sagemro-db-cn` 是否已应用对应 migration
- 不要把 Nutstore/Jianguoyun 当作代码同步方式；项目活跃目录是 `/Users/joe/Projects/sagemro.com`，同步依赖 Git

## 六、本文件修改规则
1. 修改前在对话中说明动机
2. 一次只改一个主题
3. 提交信息格式：`docs(claude-md): 修改 X 节 - 原因`

## 七、Claude Code / Cloud Code 项目记忆架构

| 文件 | 位置 | 同步方式 | 进 git？ |
| --- | --- | --- | --- |
| `CLAUDE.md` | 项目根 | git | ✅ |
| `TECH-SPEC.md` | 项目根 | git | ✅ |
| `DEPLOY.md` | 项目根 | git | ✅ |
| `.claude/skills/*.md` | 项目内 | git | ✅ |
| `.claude/memory/*.md` | 项目内 | 本地私有 | ❌（已 gitignore） |

- `CLAUDE.md` 等文档：Claude Code / Cloud Code 自动加载 + 团队共享 → git
- `.claude/skills/`：Claude Code / Cloud Code 的项目技能与操作指南 → git
- `.claude/memory/`：跨会话私人笔记（决策草稿、未公开思路、当前状态）→ 不进 git

## 八、当前业务规则摘要
- 公开注册不再选择角色；普通注册固定创建 `customer` 账号
- 工程师账号通过工程师申请和 admin 审核，不放入普通注册流程
- admin 是内部入口
- Leads 只指整机/新设备需求，例如激光切割机、折弯机、激光焊接设备等
- 配件、易损件、维保、升级改造、自动化、工装等需求由工程师作为增值服务跟进
- 客户面对 AI 时，推荐和判断必须中立、真实、有依据；不能为了 leads 牺牲公正性和信任
- 客户可见文案避免显得像销售漏斗，不要把 Euchio 放进普通 AI 推荐话术
