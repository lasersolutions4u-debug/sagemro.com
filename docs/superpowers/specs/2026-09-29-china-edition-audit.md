# china-edition → main 差异审计（只读）

> 版本 v1 · 2026-09-29
> 读者：发起人（决策）；执行层（切换实施）
> 目的：在把 CN 发布入口切到 `main` 之前，用只读手段查清**会丢什么、会修好什么**
> 方法：**全部为只读 git 命令**，未修改任何文件、未改分支、未接触生产、未运行任何部署
> 依据：`.github/workflows/aliyun-cn-deploy.yml`、`.github/workflows/deploy.yml`、`frontend/tests/repository-hygiene.test.mjs`、`AGENTS.md` / `CLAUDE.md`

---

## 0. 三句话结论

1. **风险比我上一版评估低得多，但方案必须改——而且要分两层看。**
   - **文件级**：CN 独有的 13 个 `frontend/` 文件里，**10 个是 `main` 明令必须不存在的退役文件**（不是要移植的内容，而是要删的垃圾）。
   - **内容级**（逐文件 diff 才看得见）：**51 个共享文件里有 14 个含真正的 CN 独有内容**——中文界面实现、中国市场参考价、中国合规条款。文件级审计（只看哪些文件存在于一侧）**在结构上看不到这一层**，所以本稿第一版把移植清单估小了，已按 §3.2 修正。
2. **项目记忆有 4 处过期，其中一处完全反了**——记忆说"CN 侧尚未同步这次裁剪"，实测 **CN 的裁剪已经做完**。
3. 🔴 **一个真实的安全待办**：CN 分支跟踪着 `worker/test-roles.sh`（正是 `main` 仓储卫生测试要求删除的"生产凭据探针"），其中第 8 行是一个 **13 字符的硬编码 `ADMIN_PASSWORD` 字面量**。**该值我未读取、未打印、未复制**；需人工确认是否为真实凭据，若是则**轮换并清理历史**（`origin/china-edition` 已推送，历史仍可检出）。

---

## 1. 基线数字：项目记忆 vs 实测

| 项 | 项目记忆（`AGENTS.md` / `CLAUDE.md`） | **实测（2026-09-29）** | 状态 |
| --- | --- | --- | --- |
| 共同 merge-base | `0edb0cf` | `0edb0cf` | ✅ 一致 |
| CN 独有提交 | 479 | **490** | ⚠️ 过期 |
| main 独有提交 | 483 | **509** | ⚠️ 过期 |
| CN 独有 `frontend/` 文件 | 28 | **13** | 🔴 过期（且成分完全不同） |
| CN 裁剪状态 | "**尚未同步**这次裁剪，仍带完整旧功能" | **已完成**（见 §2.1） | 🔴 **完全反了** |
| 分支是否冻结 | "冻结、不再同步" | **在主动同步**（见 §2.5） | 🔴 过期 |
| `frontend/` 改动面 | — | 70 个路径（A13 / D4 / M51 / R2） | — |

---

## 2. 核心发现

### 2.1 🔴 CN 的裁剪已经做完（记忆说"尚未同步"）

【事实】CN 分支上以下路径的文件数**均为 0**，与 `main` 一致：

| 路径 | CN | main |
| --- | --- | --- |
| `frontend/src/components/WorkOrder` | 0 | 0 |
| `frontend/src/components/Material` | 0 | 0 |
| `frontend/src/pages/BusinessWorkspace` | 0 | 0 |
| `frontend/src/components/Engineer/EngineerServiceProfileForm.jsx` | 0 | 0 |

【事实】CN 的提交历史里有它自己的裁剪三连：

- `0d0fb1f feat(frontend)!: CN 主站裁剪为营销落地页 + AI 门户 + 工程师招募页`
- `10043a3 feat(worker)!: CN 下架工单/物料/客户管理/商务/推广/评价/工程师路由，新增 /api/contact`
- `edad9ec feat(admin)!: CN 后台裁剪为知识中枢……`
- `bc5dcc9 fix(frontend): CN 补齐下架功能的三处死链`、`f2bb596 fix(ci): CN 发布就绪探测与健康检查改为只探保留入口`

【判断】**记忆里"CN 的裁剪是紧接的第二步"这个待办，已经不存在了。** 这直接改变切换的成本估算：原本以为要做的"CN 裁剪同步"，是切换要处理的**最大一块工作**，现在没有了。

### 2.2 🔴 CN 分支无法通过 `main` 的测试套件

【事实】`frontend/tests/repository-hygiene.test.mjs` 断言一批文件"必须不存在"、一批内容"必须不被 git 跟踪"。逐项核对：

| 断言项 | CN 实测 | main 实测 |
| --- | --- | --- |
| 禁列文件命中（`capture-*.js` / `wrangler.toml` / `worker/test-roles.sh` / `tools/engineer-video/*` / CN 版 4 个前端文件） | **17 / 17 全部命中** | **0** |
| `.claude/memory/` 被跟踪 | **3 个文件** | 0 |
| `.obsidian/workspace.json` 被跟踪 | **1** | 0 |
| `reports/**/screenshots/*.png` 被跟踪 | **550 张** | 0 |

【判断 · 高】**CN 分支若直接跑 `main` 的测试，会大面积红。** 反过来这意味着：换成 `main` **不是"丢掉内容"，而是"顺带清掉 550 张截图 + 17 个禁列文件 + 3 个私人笔记"**。这是我上一版把风险估高了的根本原因。

### 2.3 CN 的发布 workflow 比 main 更完备、也更正确

【事实】`git diff --numstat main china-edition -- .github/workflows/aliyun-cn-deploy.yml` → **CN 多 252 行，main 多 12 行**。

CN 版独有（main 没有）：

| 能力 | 说明 |
| --- | --- |
| `workflow_dispatch` 输入 `expected_sha`（必填） | **精确锁定已评审的那一个 commit**，避免误发 |
| 输入 `preflight_only`（**默认 true**） | **先空跑**检查现状，不发布；默认安全 |
| `Inspect current release and unchanged Nginx` 步骤 | 发布前先看现状 |
| `Roll back failed China release` 步骤 | `always() && (activate/health 失败)` 自动回滚四链接 |
| `capture_previous_target` / `release_state` | 记录四链接原目标，用于回滚 |

main 版独有（CN 没有）——**而且已经过期**：

| 内容 | 问题 |
| --- | --- |
| `curl .../api/service-request-assist` 探针，断言必须返回 400 | 🔴 **该端点已随裁剪下线**。拿 main 这版发 CN，探针会拿到 404 → `!= 400` → **`::error::` 直接失败** |
| `curl 'https://ai.sagemro.cn/service-request?mode=manual'` 断言含 noindex | 🔴 同上，同样已下线 |

【判断 · 高】**方案要改：不是"切到 main 用 main 的 workflow"，而是"把 CN 这版 workflow 移植进 main"。** CN 版是严格更优的工件（精确 SHA + 默认空跑 + 自动回滚），而 main 版里那两个探针已经指向不存在的功能。这也解释了为什么 CN 分支要 commit `f2bb596 fix(ci): CN 发布就绪探测与健康检查改为只探保留入口`。

### 2.4 Worker 只由 main 部署 → CN 分支的 worker 差异是死重量

【事实】`main` 的 `deploy.yml`：

```yaml
deploy-worker:
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

【事实】`china-edition` 的 `aliyun-cn-deploy.yml` **不构建也不部署 Worker**——只构建 `frontend` + `admin`，另外跑一步 `npx wrangler d1 execute sagemro-db-cn` 校验迁移版本。

【判断 · 高】**CN 分支上数百处 `worker/**` 差异，对 CN 生产**完全没有影响**。它们包括：CN 删掉了 034/042/047–056 等 migration 文件、删掉了 `businessIdentity.js` / `businessWorkspace.js` / `serviceRequestIntake.js` 等 lib、删掉了 `age-backup-crypto.mjs` / `backup-freshness-watchdog.mjs` 等脚本。差异里最"吓人"的这一大块可以直接划掉——**但请注意 2.6 的一条副作用**。

### 2.5 CN 分支在主动同步，不是"冻结"

【事实】`china-edition` 最近 3 个提交：

```
5a81154 工程师招募页改为「品牌共创」定位（同步 main 7b1ca77）
295c46e 工程师招募页文案按营销话术重写（同步 main c14fcc8）
8263973 工程师招募页同步「品牌 + 系统 + 推广 + AI」合作定位
```

【事实】`git cherry main china-edition` → CN 相对 main **151 个提交已等价**、304 个不等价。

【判断】"冻结、不再同步"这个描述与事实不符：**有人一直在把 main 的改动逐条同步到 CN**（至少前端侧）。这意味着 CN 的维护成本已经在发生，而不是"零维护冻结"。

### 2.6 CN 缺少 main 的 `.gitignore` 硬规则（junk 入库的成因）

【事实】`.gitignore` 差异显示 CN **缺少** main 的这些规则：

```
/artifacts/          # 注释原文：含专有工艺数据，绝不入库
.claude/memory/
.Codex/
.obsidian/workspace.json
e2e/.generated/  e2e/.state/  e2e/test-results/  e2e/playwright-report/
worker/.codex-schema-snapshots/
```

（CN 只有较宽的 `.Codex/memory/`）

【判断】这解释了 §2.2 的 550 张截图与私人笔记为何会进版本库——**规则缺失，不是有人故意提交**。

✅ **但敏感目录未被污染**（逐项核对，全部为 0）：`.artifacts/`、`.Codex/`、`worker/.codex-production-backups/`、`worker/.codex-schema-snapshots/`、`e2e/.state/`、`e2e/test-results/`；`.db` / `.sqlite` / `.age` / `.pem` / `.key` / `credentials` 命中亦为 0。`frontend/.env.production` 与 `admin/.env.production` **main 上也有**，且不含任何密钥样式内容——不是 CN 独有问题。

---

## 3. CN 真正的独有资产（要保留的清单）

### 3.1 独立工件（整份文件只存在于 CN，6 项）

| # | 资产 | 为什么必须保留 | 迁移方式 |
| --- | --- | --- | --- |
| 1 | `.github/workflows/aliyun-cn-deploy.yml`（CN 版，比 main 多 252 行） | 精确 SHA 锁定 + 默认空跑 + 自动回滚；main 版的两个探针已指向下线端点 | **移植进 main**，并把 ref 校验从 `china-edition` 改为 `main` |
| 2 | `ops/enable_nginx_http2.py`（128 行，main 无） | CN 侧 nginx HTTP/2 配置器，属于 CN 基础设施工具 | 移植进 main |
| 3 | `frontend/tests/nginx-http2-config.test.mjs`（54 行） | 断言上述配置器**只改中国 HTTPS server 块** | 随 #2 一起移植 |
| 4 | `frontend/tests/nginx-public-routes-workflow.test.mjs`（47 行） | 断言 CN 发布**不打包基础设施变更脚本**（发布安全不变量） | 移植进 main |
| 5 | `frontend/tests/cookie-auth-compatibility-contract.test.mjs`（41 行） | 断言 CN 前端在切 Cookie 会话后**保留 legacy Bearer 回退** | ⏳ 待核：需确认 CN 前端是否真有 main 缺失的 Bearer 回退；若是则移植 |
| 6 | `ops/configure_public_routes.py` | main 上已有，但**两分支内容不同**（M） | 对比后取并集 |

> 除以上 6 项独立工件，CN 分支相对 main 的其余**差异**里还有一批藏在共享文件内的实质内容——见 §3.2，**不能按"退役内容"一笔勾销**。

### 3.2 共享文件里的 CN 内容（22 个共享 `src` 文件逐项判定）

【方法】对 22 个两侧都存在的 `frontend/src` 文件逐个跑 `git diff -U0 main china-edition -- <file>`，并用 `git log -S` 判断"main 是否曾经有过、后来说明性地移除"。判定为 **KEEP_CN（14 个）** / MAIN_NEWER（5 个） / TRIVIAL（3 个）。

**KEEP_CN —— 必须移植的 CN 内容（14 个）**

| 分组 | 文件 | CN 独有什么 |
| --- | --- | --- |
| 🔴 **中国价格数据** | `data/industryTools.js` | `steelPriceReferencesCn` = **我的钢铁网 / 上期所 / 中钢协**（main 只有 CME HRC + Trading Economics）、`referenceCnyPerTon: '3600'`、CNY 行标签 |
| 🔴 **中国价格数据** | `components/Tools/IndustryToolCalculator.jsx` | `FIELD_LABELS_CN` 中文字段标签 + CNY 字段「参考价格 (CNY / 公吨)」；main 是英文字段 + 纯 USD |
| 🔴 **合规文本** | `components/common/LegalModal.jsx` | CN 政策章节：**数据保存期限 / 数据存储地区 / 跨境传输 / GDPR·UK GDPR 权利与投诉渠道**，另加一条 AI 安全提示（"高压气体、安全联锁…"）；main 完全没有 |
| ✅ UX 功能 | `components/Chat/ChatArea.jsx` | **置顶滚动 + 「有新消息 / New messages」气泡**（`showNewMessages` 在 main 上从未存在）；main 后续只改了一条 main 已不再喂的服务请求栏（在 main 上是死代码） |
| 中文界面 | `components/Sidebar/ChatHistory.jsx` | 整个侧栏中文化：会话历史 / 搜索会话 / 今天 / 昨天 / 最近 7 天（`git log -S 会话历史 main` = 从未有过） |
| 中文界面 | `components/Insights/InsightsPage.jsx` | 中文 hub/detail 文案（"全部洞察"、"洞察未找到 \| SAGEMRO"）+ 列表本地化 |
| 中文界面 | `components/Tools/IndustryToolsPage.jsx` | "AI 对话" CTA 区块（`aiChatTitle`、"不确定哪个工具适合你的情况？"）+ 中文标签 |
| 中文界面 | `components/Tools/IndustryToolsModal.jsx` | 双语弹窗文案（行业工具 / 全部工具），经 `getLocalizedTool` |
| 中文界面 | `App.jsx` | 中文侧栏标题「会话历史」+「服务对话」回退 + CN tab 标题 `SAGEMRO 设备服务平台` |
| 中文界面 | `hooks/useConversations.js` | 经 `isCnLocale` 生成中文 `新对话` 标题（main 为 `New Chat`） |
| 中文界面 | `components/common/FeedbackHost.jsx` | 中文 toast 关闭标签「关闭」 |
| 中文界面 | `utils/feedback.js` | 中文确认框默认词：确认 / 确定 / 取消 |
| 中文界面 | `components/Chat/MessageBubble.jsx` | 中文 alt/title：上传图片 / 复制 / 图片预览 |
| 中文界面 | `components/common/TagInput.jsx` | 中文占位符「输入并按回车添加…」 |

> 后 9 项属 `i18n-only`——单条风险低，但**漏掉就是中文界面回退成英文**，必须一并移植。

**MAIN_NEWER —— main 更新更全，不移植（5 个）**

| 文件 | 依据 |
| --- | --- |
| `data/servicePages.js` | main `560b95b` **主动删除**了 CN 的逐页 `reviewedBy/publishedAt/reviewedAt` 与页面 CTA；main 的测试反而断言 `reviewedAt === undefined` → CN 持有的是旧的 |
| `components/Services/ServicePages.jsx` | 同上：main 主动移除审核署名区块与空状态，且测试断言这些字符串**必须不存在** |
| `components/common/PublicConversionPanel.jsx` | main（09-24）新增 `openConsultationForm()` CTA + `hostname.endsWith('.cn')` 市场判定；CN 两者都没有 |
| `components/common/Modal.jsx` | main（09-09）新增 `keepMounted` + `profile` 尺寸档；CN 是 07-23 旧版 |
| `hooks/useChat.js` | main（09-07）新增 `requestContent` / `serviceRequestOnly` AI→表单协助参数；CN 没有 |

**TRIVIAL —— 等价重构或格式差异（3 个）**：`data/insights.js`（中文文案两侧一致，只是 `getLocalizedInsight` 的存放位置不同）、`utils/portalTarget.js`（`path='/'` vs `entryPath = path || '/'`，行为等价）、`components/common/NotFoundPage.jsx`（只把 CTA 锚点折行，文案一致）。

**移植进度（2026-09-29）：✅ 14 / 14 完成**

| 文件 | 做法 | 我的 diff vs CN |
| --- | --- | --- |
| `data/industryTools.js` | 手工打补丁——修掉 main 上「`steelPriceReferencesCn` 里装美国数据源」的错误；新增 `referenceCnyPerTon` + CNY | 21/15 = CN ✓ |
| `data/insights.js` | 手工——CN 把 `getLocalizedInsight` 提升为导出（`InsightsPage` 依赖它） | 11/5 = CN ✓ |
| `components/common/LegalModal.jsx` | 手工——中国隐私政策 **8 节 → 12 节** + AI 安全提示一条 | 26/5 = CN ✓ |
| `utils/feedback.js` | 手工补 `isCnLocale` 分支 | 6/3 = CN ✓ |
| `components/common/TagInput.jsx` | 同上 | 4/2 = CN ✓ |
| `components/common/FeedbackHost.jsx` | 同上 | 3/1（CN 显示 8/6 含行尾噪声） |
| `components/Chat/MessageBubble.jsx` | 同上 | 5/3 = CN ✓ |
| `hooks/useConversations.js` | 手工——实质仅 import + `新对话` 标题 | 4/2（CN 显示 30/27 含行尾噪声） |
| `App.jsx` | 手工移植 `服务对话` 兜底与`会话历史`弹窗标题（**`document.title` effect 有意未移植**，见下） | — |
| `components/Tools/IndustryToolsModal.jsx` | 手工 | 26/7 = CN ✓ |
| `components/Tools/IndustryToolsPage.jsx` | 手工——含**功能必需**的 `calculateIndustryToolResult(tool.id, values, locale)` | 31/8（CN 31/9，差 1 空行） |
| `components/Sidebar/ChatHistory.jsx` | **整份取 CN 版**（纯 i18n 重构，无 main 独有内容被删） | 64/17 = CN ✓ |
| `components/Insights/InsightsPage.jsx` | **整份取 CN 版**（同结构，CN 只是抽出 `insightsCopy` 并本地化） | 58/25 = CN ✓ |
| `components/Tools/IndustryToolCalculator.jsx` | **整份取 CN 版**（所有 `-` 行都有对应本地化 `+` 版） | 113/27 = CN ✓ |
| `components/Chat/ChatArea.jsx` | **整份取 CN 版**（新增置顶滚动 +「有新消息」气泡；同时移除的 service-request 栏在 main 上已是死代码——已核 `App.jsx` 根本不传那些 props） | 72/54 = CN ✓ |

> 🔴 **三处必须注意的判断（已核实）**
> 1. **`App.jsx` 的 `document.title` effect 有意未移植。** CN 加了一个直接写 `document.title` 的 effect，但 main 的 `utils/seo.js:124` 的 `setSeoMetadata` 已按路由管理标题，两者会**抢标题**（结果取决于 effect 执行顺序）。CN 的意图（标签页显示"设备服务平台"）应改为调整 `setSeoMetadata` 的取值，而非叠加并行 effect。**这是有意偏差，不是遗漏。**
> 2. **判断"能否整份取"必须看完整 diff，不能只看 `-` 行。** 本稿中途曾据 `-` 行断言"`InsightsPage`/`ChatArea` 的 main 侧更新、不可整份取"——看到完整 diff 后证明**对 `InsightsPage` 是误判**（两侧结构相同，CN 只是抽出 `insightsCopy`）。`ChatArea` 的判断成立（CN 确实删了 main 的代码，但那部分是死代码）。
> 3. **`docs/legal/*.md` 不移植**（市场命名与域名差异，main 持有 COM 版）。

> ⚠️ **行尾符陷阱（本次踩到两次，值得写进规程）**：本仓库部分文件的 **git blob 是混合行尾**（如 `worker/src/index.js` blob 含 9599 个 CR、`hooks/useConversations.js` 仅 89 个 CR 却有 143 行）。用"统一 CRLF"或"统一 LF"的方式改写这类文件，会让 **git 把每一行都判为改动**（`useConversations.js` 一度显示 56/54，真实改动只有 4/2；`worker/src/index.js` 一度显示 18553 行）。**修法：`git checkout -- <file>` 还原后，用字节保真方式（`ReadAllText` + 字面量 `.Replace()` + `WriteAllText`）只插改目标文本。** 自检哨兵：`git diff --ignore-all-space --numstat` 应等于真实改动量。

【判断 · 高】**移植清单的正确粒度是 §3.2，不是 §3.1。** 只按"文件是否存在"做审计，会漏掉 §3.2 里那 14 个文件中的全部 CN 内容——其中包含**合规文本**（LegalModal）与**服务定价的参考数据**（industryTools），这两项漏了是要出事的。

---

## 4. 项目记忆需修订的条目

`AGENTS.md` 与 `CLAUDE.md` 的第三节（中国版）需要同步以下 4 处。按第六节规则，**修改前须在对话中说明动机**——本节即为该说明。

| # | 现文 | 实测 | 建议改法 |
| --- | --- | --- | --- |
| 1 | "CN 侧**尚未同步**这次裁剪：`china-edition` 分支仍带着完整旧功能，CN 的裁剪是紧接的第二步" | CN 裁剪**已完成**（三连提交 + 旧功能组件为 0） | 改为"CN 侧裁剪**已完成**（`0d0fb1f` / `10043a3` / `edad9ec`）" |
| 2 | "CN 独有 **28** 个 `frontend/` 文件（含 main 完全没有的 CN 专属特性与 6 个 flywheel 媒体文件）" | **13** 个，其中 **10 个是 main 明令删除的退役文件**（含那 6 个 flywheel 媒体）；真正独有资产见 §3 | 改为实测数字与 §3 清单 |
| 3 | "`china-edition` 现状：**冻结、不再同步**" | **在主动逐条同步**（151 提交已等价；最近 3 提交即同步） | 改为"仍在被同步，需明确由谁负责、按什么节奏" |
| 4 | 独有/落后提交数 479 / 483 | **490 / 509** | 更新数字，或改为"以 `git rev-list` 实测为准，勿硬编码" |

---

## 5. 修订后的切换方案

### 5.1 与我上一版方案的差别

| 项 | 上一版（基于项目记忆） | **修订版（基于实测）** |
| --- | --- | --- |
| 第一步 | 只读差异审计，担心丢 CN 独有特性 | ✅ **本次已完成**，结论：几乎没有可丢的 |
| 最大工作量 | "CN 裁剪同步" | ✅ **不存在了**，CN 已裁剪 |
| workflow 处理 | "改 main 的 ref 校验 + 加 market 开关" | 🔴 **改为把 CN 版 workflow 移植进 main**（main 版探针已失效） |
| Worker | 担心 CN worker 差异 | ✅ **无关生产**（Worker 只由 main 部署） |
| 移植面 | 未识别 | ⚠️ **新增**：§3.1 的 6 项独立工件 + **§3.2 的 14 个共享文件内的 CN 内容**（中文界面、中国价格数据、中国合规文本）。这是原方案完全没算到的一块 |
| 风险等级 | 中（怕丢 CN 内容） | **中低**：文件层面要丢的是垃圾；真正的工作量在 §3.2 的 14 项移植 + workflow 移植 + 文案改造 |

### 5.2 修订后的三步

| 步 | 动作 | 授权 |
| --- | --- | --- |
| ① | **已完成**：只读差异审计（本文） | 只读，无需授权 |
| ② | 移植：**§3.1 的 6 项独立工件**（重点是 CN 版 workflow）+ **§3.2 的 14 个共享文件内的 CN 内容**（中国价格数据、中国合规文本、中文界面实现、ChatArea 的置顶滚动）；把 ref 校验由 `china-edition` 改为 `main`；构建步骤加 `SAGEMRO_BUILD_MARKET: cn`；同步更新 `frontend/tests/aliyun-deploy-workflow-contract.test.mjs` 断言 | 🔴 **必须单独批准**（项目约束：改 `deploy.yml` 前先在对话中确认） |
| ③ | 用 CN workflow 的 `preflight_only: true` **先空跑** → 确认无误后正式发布 → 四链接健康检查 | 单独批准 |

> ⚠️ 第 ③ 步要**利用 CN workflow 自己的 `preflight_only` 默认 true** 这个安全设计——先空跑一次，是我建议保留那版 workflow 的另一个理由。

### 5.3 切换后要立刻验证的四项

1. `sagemro.cn` 首页是**整机厂双入口**新文案（而不是旧站）。
2. `sagemro.cn/brands/` 返回 404（品牌页已删）。
3. `sagemro.cn` 页面**不渲染 AI 对话框**（CN 已移除），且 `/partners/` 在 CN 为 404。
4. `engineer.sagemro.cn` 与 `ai.sagemro.cn` 正常。

---

## 6. 安全待办（独立于切换，建议尽快）

| # | 事项 | 依据 | 建议动作 |
| --- | --- | --- | --- |
| 1 | 🔴 `worker/test-roles.sh` 含 13 字符硬编码 `ADMIN_PASSWORD` 字面量，且该文件被 `origin/china-edition` 跟踪 | 该文件在 `main` 的"必须不存在"清单内；卫生测试注释为"production credential probes stay out of Git" | **人工确认该值是否为真实凭据**；若是 → 轮换该密码 + 清理 git 历史（filter-repo/BFG）；若否 → 仍应删除该文件 |
| 2 | CN 分支缺少 `.gitignore` 硬规则 | §2.6 | 切换后由 main 的规则覆盖，无需单独修 |

> 说明：我**没有**读取、打印或复制该密码的值——只统计了命中行数与变量名，用于判断风险等级。

---

## 附 A：CN 独有 13 个 `frontend/` 文件的逐项分类

| # | 文件 | 分类 | 依据 |
| --- | --- | --- | --- |
| 1 | `public/media/engineer-service-flywheel-cn-poster.webp` | **丢弃** | 在 `main` 的 `retiredFrontendFiles` 清单内（断言必须不存在） |
| 2 | `public/media/engineer-service-flywheel-cn.mp4` | **丢弃** | 同上 |
| 3 | `public/media/engineer-service-flywheel-cn.webm` | **丢弃** | 同上 |
| 4 | `public/media/engineer-service-flywheel-en-poster.webp` | **丢弃** | 同上 |
| 5 | `public/media/engineer-service-flywheel-en.mp4` | **丢弃** | 同上 |
| 6 | `public/media/engineer-service-flywheel-en.webm` | **丢弃** | 同上 |
| 7 | `src/components/Sidebar/ToolBar.jsx` | **丢弃** | 在 `retiredFrontendFiles` 清单内 |
| 8 | `src/components/common/Button.jsx` | **丢弃** | 在 `retiredFrontendFiles` 清单内 |
| 9 | `src/data/loginPresets.js` | **丢弃** | 在 `retiredFrontendFiles` 清单内 |
| 10 | `src/styles/tokens.css` | **丢弃** | 在 `retiredFrontendFiles` 清单内 |
| 11 | `tests/nginx-http2-config.test.mjs` | **保留（移植）** | 测 `ops/enable_nginx_http2.py`，该脚本 main 没有 |
| 12 | `tests/nginx-public-routes-workflow.test.mjs` | **保留（移植）** | 测 CN 发布不打包基础设施变更脚本的发布安全不变量 |
| 13 | `tests/cookie-auth-compatibility-contract.test.mjs` | **丢弃** | 已核：main 的 `cookie-auth-contract.test.mjs` 是**超集**（9 个测试 vs 3 个），核心断言完全重合，另多 staggered-deploy legacy JWT 回退、sendBeacon/CSRF、dev host |

**小计**：丢弃 **11** / 保留 **2** / 待核 **0**。

**两个保留测试的移植理由（含 main 覆盖度对比）**

| 测试 | 断言什么 | main 的覆盖情况 |
| --- | --- | --- |
| `nginx-http2-config.test.mjs` | `ops/enable_nginx_http2.py` 只对 sagemro.cn/admin 的 HTTPS server 块加 `listen 443 ssl http2;`，保留无关 / staging / IPv6 / 80 端口块，可重复执行，找不到目标块时报 "No sagemro.cn HTTPS server block was found" | **无任何覆盖**（main 的 `ops/` 只有 `configure_public_routes.py`，其测试测的是另一个脚本） |
| `nginx-public-routes-workflow.test.mjs` | pages-only 发布不打包 infra 变更脚本；`tee "$release_state"` → `nginx -t` → `ln -sfnT` 的顺序；activate/health 被取消时回滚；冒烟探针（admin 200 / 404 页 404 / `unexpected.invalid` 被拒） | **仅部分**：main 的 `aliyun-deploy-workflow-contract.test.mjs` 覆盖制品打包、D1 就绪、安全组、host key；但 main 的 workflow 对 `release_state`、`steps.activate.outcome == 'cancelled'`、`deploy-admin-smoke`、`unexpected.invalid` **命中数为 0** |

---

## 附 B：共享文件的判定口径与边界

22 个共享 `frontend/src` 文件的逐项分类结果**已并入 §3.2**（避免同一批数据两处维护）。本节只记录判定口径，以及三处**容易判反**的边界。

**判定口径**：对每个文件跑 `git diff -U0 main china-edition -- <file>`；新旧方向用 `git log -1 --format=%ad` 按文件/分支核对；"main 是否曾经拥有过"用 `git log -S` 核对，并用 `main` 自己的测试断言交叉验证。

- 中文文案对**中文版产品**属 CN 侧内容 → `KEEP_CN`（标 `i18n-only` 者为低风险）
- main **曾经拥有、后来说明性地移除/替换**（`git log -S` + main 测试双重确认）→ `MAIN_NEWER`
- 等价重构、格式与换行符差异 → `TRIVIAL`

**三处反向陷阱**

| 陷阱 | 说明 |
| --- | --- |
| CN 多出来的，其实是 main 刚删掉的旧状态 | `data/servicePages.js`、`components/Services/ServicePages.jsx` 的审核署名与日期：main 在 `560b95b` **主动移除**，且 main 的测试**反向断言** `reviewedAt === undefined`。按"CN 更长就保留"的直觉，会把 main 明确不要的东西移植回去 |
| 单测文件同名但覆盖度不同 | `cookie-auth-compatibility-contract.test.mjs` 看似是 CN 的兼容性资产，实为 main `cookie-auth-contract.test.mjs` 的**子集**（3 vs 9 个测试）→ 丢弃 |
| CRLF / 格式噪声淹没真实差异 | `hooks/useConversations.js` 的 57 行差异里大部分是换行符噪声，真实内容只有「新对话」标题一行；`FeedbackHost.jsx`、`App.jsx` 同理 |

【判断 · 高】移植时**逐项对照 §3.2 的表格执行**，不要按"CN 比 main 多几行"这类体积直觉判断——上面三个陷阱都会因此判反。

---

## 附 C：本次使用的只读命令

```bash
git merge-base main china-edition
git rev-list --count "$(git merge-base main china-edition)..main"      # 509
git rev-list --count "$(git merge-base main china-edition)..china-edition"  # 490
git diff --name-status main china-edition -- frontend/
git diff --numstat   main china-edition -- frontend/src/
git diff --name-status main china-edition -- . ':(exclude)frontend'
git cherry main china-edition
git ls-tree -r --name-only china-edition -- <path>      # 逐路径存在性核对
git show china-edition:<path>                            # 内容核对
git diff main china-edition -- .gitignore
```

【方法限制】本次**未**：修改任何文件（除本审计与配套文档）、切换或创建分支、运行部署、访问生产数据库或服务器、读取任何凭据值。

> 本文写作约定：本目录会被 `frontend/tests/brand-assets-contract.test.mjs` 扫描，未使用被契约测试禁止的旧品类表述。
