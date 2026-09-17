# SAGEMRO 项目记忆

> ⚠️ **本文件由 Claude Code 自动加载**作为项目级记忆（system prompt）。
> 修改本文件 = 修改 Claude Code 在本项目的工作认知。请遵守第六节修改规则。

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

Claude Code（本地）
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

### CN 构建方式（构建脚本已支持市场维度，**发布入口尚未切换**）

构建脚本已能用市场开关从**同一套 main 代码**产出 CN 产物：

```
SAGEMRO_BUILD_MARKET=cn   →   npm run build:public:cn / npm run build:portal:cn
```

market 决定 locale，locale 决定**预渲染语言 / sitemap 与 llms.txt 域名 / Baiduspider 策略**。
market **默认 `com`**，所有现有调用方式行为不变。国内版专属静态资产放在 `frontend/public-cn/`，
**只在 market=cn 时叠加**——因此 CN 的文件不可能改变国际版产物的任何一个字节。

⚠️ **但 CN 现在仍由 `china-edition` 分支构建，不是 main。** `aliyun-cn-deploy.yml` 硬校验
`GITHUB_REF_NAME == china-edition`，构建步骤是 `npm run build:public` / `build:portal`（未加市场开关）。
这一状态**今天是正确的**，原因是 **`china-edition` 早于市场维度存在**：
该分支没有 `frontend/scripts/markets.mjs`，其 `runBuild` 调用 `buildPublicPages({ distDir })` **不传 locale**，
于是走模板兜底 `localeFromTemplate()`，读到该分支 `index.html` 的 `lang="zh-CN"` → 中文产物。
**这份正确性是历史巧合，不是设计保证。**

⚠️ **它与 main 是双向分叉，不是「落后」。** 2026-09-17 核对：共同 merge-base `0edb0cf`，
CN 独有提交 **479** 个、main 独有提交 **483** 个；CN 分支独有 28 个 `frontend/` 文件
（含 main 完全没有的 CN 专属特性与 6 个 flywheel 媒体文件），测试文件 66 个 vs main 60 个。
**因此「把 CN 切到 main」不等于切换开关，而会丢掉 CN 分支独有的内容**——必须先做逐项审计与移植。

🔴 **把阿里云发布入口切到 main 时，三件必须同时改**——只改 ref 校验会静默产出 COM 产物并发到 CN：

1. `aliyun-cn-deploy.yml` 的 ref 校验（当前强制 `china-edition`）
2. 构建步骤加 `SAGEMRO_BUILD_MARKET: cn`，或改用 `build:public:cn` / `build:portal:cn`
3. `frontend/tests/aliyun-deploy-workflow-contract.test.mjs` 中对应的断言

失败机制（已逐行核对代码）：main 上 `runBuild` **总是**把 market 推导出的 locale 显式传给
`buildPublicPages`（`MARKETS[selected].locale`，默认 `com` → `en`），所以 `buildPublicPages:81` 的
模板兜底分支**在 main 上是死代码**。在 main 上不加开关构建 CN，会得到英文预渲染 +
sitemap/llms.txt 指向 `sagemro.com` + `Baiduspider: Disallow: /`，且不叠加 `public-cn/`。

**`china-edition` 现状：冻结、不再同步，但仍是 CN 的唯一构建来源（见上）。**
CN 的最终形态（继续冻结 / 正式并入 main / 关停）**尚未决定**——在决定前，不要把它当成待同步的分支。

**关键事实**：
- **CN 生产发布必须手动 dispatch，且只能从 `china-edition` 触发**（ref 硬校验）；不发布就不会更新。
  切到 main 前必须先完成上一节的三件改动
- `deploy.yml` 在 `china-edition` 上确实会发布前端与 Admin 到 CF Pages（`sagemro-cn` / `sagemro-admin-cn`），但 CN 线上由阿里云 nginx 提供，两者不是一回事
- Worker 与 AI 门户**只在 `main` 上部署**
- COM 侧由 GitHub Actions 调 wrangler 部署，**不使用** Cloudflare 原生 Git 集成
- **PR 永远不部署**，只跑 test job（jobs 层 `if: github.event_name == 'push'` 兜底）
- D1 schema 迁移和 Worker secrets 设置**不在 workflow 中**，需手动执行（详见 DEPLOY.md）

## 四、目录约定
- `/frontend/` — 主站源码，构建产物 `frontend/dist/`
- `/frontend/public-cn/` — 中国版专属静态资产（仅 `market=cn` 时叠加，不进国际版产物）
- `/admin/` — 管理后台源码，构建产物 `admin/dist/`
- `/worker/` — Workers 后端（含 `wrangler.toml`，**单数**）
- `/.github/workflows/deploy.yml` — COM（Cloudflare）CI/CD 入口
- `/.github/workflows/aliyun-cn-deploy.yml` — CN 生产发布入口（**仅手动 dispatch，仅允许 `china-edition`**）
- `/.claude/memory/` — Claude 跨会话笔记（坚果云同步，**不进 git**）
- `/CLAUDE.md`、`/TECH-SPEC.md`、`/DEPLOY.md` — 项目文档（进 git）

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
3. 提交信息格式：`docs(claude-md): 修改 X 节 - 原因`

## 七、Claude Code 项目记忆架构

| 文件                  | 位置   | 同步方式 | 进 git？          |
| --------------------- | ------ | -------- | ----------------- |
| `CLAUDE.md`           | 项目根 | git      | ✅                 |
| `TECH-SPEC.md`        | 项目根 | git      | ✅                 |
| `DEPLOY.md`           | 项目根 | git      | ✅                 |
| `.claude/memory/*.md` | 项目内 | 坚果云   | ❌（已 gitignore） |

- `CLAUDE.md` 等文档：Claude Code 自动加载 + 团队共享 → git
- `.claude/memory/`：跨会话私人笔记（决策草稿、未公开思路）→ 坚果云

## 八、Client copy principle: AI-first

- SAGEMRO 客户端的第一价值主张是 AI 辅助设备服务，不只是普通工单或资料整理平台。
- 用户端首屏、入口标题、欢迎页、工具回流聊天等关键文案，应明确突出 SAGEMRO AI 会先整理设备问题、追问缺失信息、提示风险、生成服务简报和下一步建议。
- 文案必须中英文同步。英文使用专业 B2B 工业服务语气；中文直接说明“AI 设备问题分析 / AI 先整理服务简报”。
- 不夸大 AI 能力。最终诊断、报价、采购、现场安全和维修决策仍需合格人员或 SAGEMRO 服务流程确认。
- 避免把客户端描述成单纯的“设备服务平台”“工单入口”或“公开资源集合”。这些可以存在，但不能盖过 AI 核心体验。

## 九、Current Handoff (2026-07-27)

- Before implementing Engineer AI Service Readiness Review, read [the Claude Code handoff](docs/superpowers/handoffs/2026-07-27-engineer-ai-service-readiness-claude-code-handoff.md), its linked approved design, and its executable plan. The handoff contains the authoritative feature-specific access, privacy, cache, migration, and COM/CN release constraints.
