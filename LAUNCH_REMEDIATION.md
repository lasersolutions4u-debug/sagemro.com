# 上线前整改跟踪（Launch Remediation）

> 2026-04-26 基于四维度（安全/代码/部署/功能）全量审计创建
> 任何时候中断，从本文档恢复；每条完成后勾选并更新 commit 引用

## 状态总览

- 🔴 上线阻断（7 项，约 3-5 天）— 必改
- 🟡 HIGH 风险（4 项，约 2-3 天）— 建议上线前
- 🟠 MEDIUM（3 项，约 3-5 天）— UX 影响
- 🟢 Post-launch（可 30 天内处理）

---

## 🔴 上线阻断项

### #2 修复读路径 IDOR（5 处）— 优先级最高 ✅ 已完成

**实施摘要（2026-04-26）：**
- 新增 `worker/src/lib/guards.js`：`assertWorkOrderAccess` / `assertConversationAccess` / `assertEngineerOrAdmin` + `GuardError`
- 新增 `worker/migrations/010_add_conversation_owner.sql`：给 `conversations` 加 `customer_id` 列 + 索引
- 修改 `handleChat`：手动解析 Authorization（因 `/api/chat` 在全局 auth 中间件之前），新对话写入 JWT 中的 userId
- 应用守卫到 7 处读路径：`handleGetWorkOrder` / `handleGetWorkOrderMessages` / `handleGetWorkOrderPricing` / `handleGetConversation` / `handleDeleteConversation` / `handleRenameConversation` / `handleGetCustomerReviews` + `handleGetEngineerReview`
- `handleGetConversations` 列表改为按 `customer_id` 过滤（admin 可查全部）
- 新增 `worker/tests/guards.test.mjs`：20 个单元测试覆盖所有守卫分支
- 扩展 `worker/tests/smoke.mjs` IDOR 组：5 个未登录场景默认必跑；5 个跨账号场景需测试数据（保持可选）
- 全部测试：40/40 passing（20 auth + 20 guards）

**上线操作：**
1. `wrangler d1 execute sagemro-db --file worker/migrations/010_add_conversation_owner.sql --env production`
2. `wrangler deploy --env production`
3. 运行 smoke.mjs 验证 IDOR 分组全 PASS

**兼容性提醒：**
- 历史 `conversations` 行的 `customer_id` 为 NULL → 只有 admin 能读；普通用户新建对话会自动写入 owner
- 如果需要保留历史会话，可在上线前用前端 localStorage 的 customer_id 做一次性回填 SQL（需人工核对）

---

**症状（原始审计）：** 任何登录用户可枚举他人 PII/财务数据。写路径已校验，读路径全系列漏掉。

**受影响端点：**
| 文件 | 行号 | 函数 | 泄漏内容 |
|------|------|------|----------|
| `worker/src/index.js` | 2189 | `handleGetWorkOrder` | 工单详情 + 客户姓名/手机 + 工程师财务字段 |
| `worker/src/index.js` | 4032 | `handleGetWorkOrderMessages` | 工单内私信 |
| `worker/src/index.js` | 4094 | `handleGetWorkOrderPricing` | 完整核价明细、平台抽成、保证金扣留 |
| `worker/src/index.js` | 1537 | `handleGetConversation` | 客户 AI 对话（含 PII）|
| `worker/src/index.js` | 1560 | `handleDeleteConversation` | 可删他人会话 |
| `worker/src/index.js` | 1574 | `handleRenameConversation` | 可改他人会话标题 |
| `worker/src/index.js` | 2467 | `handleGetCustomerReviews` | 工程师私评客户内容 |

**修复思路：**
1. 在 `worker/src/lib/auth.js` 或新建 `worker/src/lib/guards.js` 加统一 helper：
   ```js
   assertWorkOrderAccess(auth, workOrder) // admin / customer_id / engineer_id 之一
   assertConversationAccess(auth, conversation) // 自己的会话
   assertEngineerOnly(auth) // 只允许 engineer / admin
   ```
2. 7 处调用点分别调用，失败返回 403
3. conversations 表缺 `customer_id/engineer_id` 列需 migration 010 补（由 Task #12 合并）
4. 扩展 `worker/tests/smoke.mjs` 的 IDOR 组，使之不再依赖可选 env var（默认必跑）

**提交计划：** 单个 commit，`fix(security): enforce ownership on read paths`

---

### #3 重写 cleanup 脚本为白名单 ✅ 已完成

**实施摘要（2026-04-26）：**

- `worker/migrations/data_fixes/cleanup_test_accounts.sql` — 完全重写
  - 删除所有 `LIKE '1380000%'` / `LIKE '%test%'` / `LIKE '%测试%'` 模糊匹配
  - 改为 `__cleanup_targets` TEMP TABLE + 显式 INSERT 白名单（scope=customer/engineer/conversation，identifier=phone 或 conv_id）
  - INSERT 语句默认注释掉：**未填白名单的情况下本脚本不删任何数据**（safe by default）
  - 级联删除逻辑改为 JOIN 白名单 → 精确匹配，不再有误伤
  - 补上客户对话级联删除（之前只清理孤儿对话，漏删了真实客户的对话/消息）

- `worker/migrations/data_fixes/cleanup_test_accounts_preflight.sql` — 配套重写
  - 共享相同的 `__cleanup_targets` 白名单结构（注释要求与 cleanup 保持一致）
  - 新增 "not_found" 诊断查询：列出白名单中在库里找不到的手机号/对话 id（排错用）
  - 返回每个级联表的受影响行数供负责人签字

- 文件头部新增"使用方法"注释：明确要求先跑 preflight 人工签字 → 再跑 cleanup

**安全性改进：**
- 138 开头的真实中国移动号段不会再被误伤
- 姓名含 "test" 的真实用户不会再被误伤
- D1 删除前要求显式列出账号，评审可追溯
- 默认空白名单 = 默认零删除，最坏情况也只是 no-op

### #4 Admin 登录加限速 + ADMIN_PHONE 改 env ✅ 已完成

**实施摘要（2026-04-26）：**

- `worker/src/index.js` L38-41 — 删除硬编码 `const ADMIN_PHONE = '13800000000'`
  - 注释改为明确提示必须通过 `wrangler secret put ADMIN_PHONE / ADMIN_PASSWORD --env production`
- `handleAdminLogin` L3151+ — 完整重写
  - `env.ADMIN_PHONE` + `env.ADMIN_PASSWORD` 任一缺失 → 500 "管理员账号未配置"，不降级到任何默认值
  - 失败计数：`admin_login_fail_phone_{phone}` + `admin_login_fail_ip_{ip}` 双计数器
    - phone 限速防单账号爆破
    - IP 限速防同 IP 对管理员 DoS（单 IP 撞爆 5 次即被锁，其他管理员 IP 仍可登录）
  - 15 分钟 TTL，5 次封禁（与客户登录一致）
  - 成功登录：并行清零两个计数器
  - JWT payload 中的 phone 改为从 env 动态读取

- `worker/wrangler.toml` — 在 `[vars]` 注释块列出所有必须通过 secret 注入的变量（ADMIN_PHONE / ADMIN_PASSWORD / JWT_SECRET / OPENAI_API_KEY / OPENAI_API_ENDPOINT / ONESIGNAL_* 等）

**上线操作：**
```bash
wrangler secret put ADMIN_PHONE --env production     # 输入真实管理员手机号
wrangler secret put ADMIN_PASSWORD --env production  # 输入强密码
wrangler deploy --env production
```

**验证：**
- `node --check` 通过
- `npm test` — 40/40 passing

### #5 CI 工作流收紧 ✅ 已完成

**实施摘要（2026-04-26）：**

- `.github/workflows/deploy.yml` 重写
  - 新增 `test` job 作为部署的必须前置（`needs: test`）
    - Worker: `npm install && npm test`（40/40 tests 必须通过）
    - Frontend: `npm ci && npm run lint --if-present && npm run build`
    - Admin: `npm ci && npm run build`
  - 所有 deploy job 加 `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
    - PR 事件只跑 test job，不触发任何部署
  - 新增 `deploy-admin` job（部署 `admin.sagemro.com` 到 Cloudflare Pages `sagemro-admin` 项目）
  - 所有 deploy job 绑定 `environment: production` → GitHub Settings → Environments → production 可配置 required reviewer 二次确认

**对手动误部署的防护：**
- 误推 feature 分支：`refs/heads/main` 门禁挡掉
- 误在 PR 触发：`github.event_name == 'push'` 门禁挡掉
- 误部署未测代码：`needs: test` 门禁挡掉
- 生产部署需 required reviewer 审批（需在 GitHub UI 侧配置 Environment）

### #6 轮换 jiekou.ai Key + 清 git 历史
- 泄漏点：`CLAUDE.md` L60-61 + §6.3（自 commit 520a43f 起）
- 需轮换 2 个 key → wrangler secret put → git filter-repo → force push → 通知协作者

### #7 OpenAI 成本保护 ✅ 已完成

**实施摘要（2026-04-26）：**

1. **新增 `enforceOpenAIBudget(env, { userKey, tag })` 网关函数**（handleChat 上方）
   - 三维度配额：per-user（默认 200/日）/ platform total（默认 5000/日）/ 保留短窗口 IP 限流
   - 配额值可用 `env.OPENAI_DAILY_PER_USER` / `env.OPENAI_DAILY_TOTAL` 覆盖
   - 按 UTC 日期分桶（`openai_quota_user_{YYYYMMDD}_{userKey}` / `openai_quota_total_{YYYYMMDD}`），TTL 25h 自动清理
   - **先计数再调用**：即使 OpenAI 调用失败也计数，防止失败重试把配额打穿
   - 超限抛 `BudgetError` → 外层 429 响应
   - 友好文案：平台/个人上限分别提示

2. **handleChat 入口强制配额**（L1290+）
   - JWT 解析拿 userId → userKey=`customer:xxx` / `engineer:xxx`；访客 fallback 为 `guest:<IP>`
   - 保留原有访客 IP 小时级 30 条限流（短窗口防刷）

3. **后台系统调用也计入全平台总量**
   - `generateWorkOrderSummary` → userKey=`system:summary`
   - `generatePricingAINote` → userKey=`system:pricing_note`
   - 超限静默返回 null，不影响主流程

4. **所有 4 处 OpenAI 调用加 `max_tokens`**：
   - 主对话 L~1340：`MAX_TOKENS.chat = 2000`
   - Tool 后续轮 L~1481：`MAX_TOKENS.chat_tool_followup = 2000`
   - 工单摘要 L~1710：`MAX_TOKENS.summary = 500`
   - 核价点评 L~4410：`MAX_TOKENS.note = 400`

**防爆破场景：**
- 单登录账号狂刷 → 到 200 次即锁，次日重置
- 全平台被薅 → 到 5000 次即熔断，友好 429 提示
- 单次响应失控长度 → max_tokens 硬切
- 访客短时间连发 → 保留的小时级 30/IP 先挡掉

### #8 Engineer status 越权 + reject 写错表 ✅ 已完成

**实施摘要（2026-04-26）：**

三个相关 bug 都在 `worker/src/index.js` 修复：

1. **`handleUpdateEngineerStatus`（L2705）** — 完整重写
   - 目标 engineer_id 改从 JWT `request._auth.userId` 取，**不再接受 body 传入**
   - 未登录 → 401；非 engineer/admin → 403
   - status 白名单分角色：
     - `ENGINEER_STATUS_SELF = {available, paused, offline}` — 工程师自己改
     - `ENGINEER_STATUS_ADMIN = {available, paused, offline, pending_approval}` — 仅 admin 可设 pending_approval
   - admin 调用可传 body.engineer_id（管理用途）；engineer 调用 body.engineer_id 被忽略
   - UPDATE `changes === 0` → 404（工程师不存在）

2. **`handleRejectTicket`（L2654）** — 改写目标表
   - 原实现把 `rejected_engineers` 写入 `engineers` 表（该表没有这个列，SQLite 静默失败 or 报错）
   - 修复：读写 `work_orders.rejected_engineers`（每个工单记录拒过它的工程师列表）
   - JSON 数组解析加 try/catch 兜底 + dedupe（同一工程师不重复加入）

3. **`handleGetEngineerTickets`（L2557）** — 修复过滤读取源
   - grep 时发现该函数**也**在从 `engineers.rejected_engineers` 读取过滤名单（同一历史 bug 的第三处）
   - 改为 SQLite JSON 子查询：`NOT EXISTS (SELECT 1 FROM json_each(COALESCE(w.rejected_engineers, '[]')) WHERE value = ?)`
   - 工程师拒过的工单不再出现在"待接工单"列表

**验证：**
- `node --check worker/src/index.js` 通过
- `npm test` — 40/40 passing（20 auth + 20 guards，Task #8 不影响既有测试）

**提交计划：** 单个 commit，`fix(engineer): enforce self-only status update & correct rejected_engineers table`

---

## 🟡 HIGH 风险

### #9 ENVIRONMENT gate 改默认拒绝 ✅ 已完成

**实施摘要（2026-04-26）：**

三处 ENVIRONMENT 判断全部反转为默认拒绝（env 缺失或非 'development' 值均视作生产锁定）：

1. 测试/调试路由网关 L4735
   - 原：`if (env.ENVIRONMENT === 'production') return 404`
   - 改：`if (env.ENVIRONMENT !== 'development') return 404`
2. 验证码回传 L769 / L1033
   - 原：`if (env.ENVIRONMENT !== 'production') response.code = code`
   - 改：`if (env.ENVIRONMENT === 'development') response.code = code`

**安全性改进：** staging / 空字符串 / 未设置 ENVIRONMENT 等异常值不再暴露测试路由或泄露验证码。

### #10 Admin 删除用户包 D1 batch ✅ 已完成

**实施摘要（2026-04-26）：**

`handleAdminDeleteUser`（L3181）完整重写，取消 N 条独立 `.run()`，改为单次 `env.DB.batch([...])`：

- 先并行 SELECT 收集需要按 id 级联的 `work_orders.id` + `conversations.id`（batch 不能混合 bind 子查询）
- 把所有 DELETE 语句 push 进 `statements` 数组：
  - 客户路径：ratings / work_order_logs（按 wo id）→ messages（按 conv id）→ work_orders / conversations / devices / customers
  - 工程师路径：ratings / work_order_logs（按 wo id）→ messages（按 conv id）→ work_orders / conversations / ratings(engineer_id) / engineers
- 一次 `env.DB.batch(statements)` 触发：D1 在隐式事务内执行，任一失败整体回滚
- 补上了原实现漏删的 `conversations` + `messages` 级联（migration 010 后 conversations 新增 customer_id 列）

**修复的故障场景：**
- 原代码 5 条独立 `.run()` 中第 4 条失败 → 工单已删、客户未删 → 数据库被半删状态，后续 SELECT 显示"客户不存在但工单还在"
- 现改为 batch → 原子成功或原子回滚

**验证：** `node --check` 通过；`npm test` — 40/40 passing

---

### #11 可观测性
- 接 Sentry 或 Workers Logpush → R2
- `/health` 已有（`worker/src/index.js:4582`）→ 接 UptimeRobot

### #12 schema.sql 漂移消除 ✅ 已完成

**实施摘要（2026-04-26）：**

1. **新增 migration 011_create_migrations_tracking.sql**
   - 建立 `_migrations` 跟踪表（version PK + applied_at + note）
   - 回填 000-010 已执行过的版本记录（`INSERT OR IGNORE` 幂等）
   - 后续 deploy 脚本可在执行每个 migration 后写入一条，保证不重复跑

2. **重写 `worker/schema.sql` 为全量当前状态快照**
   - 把 migrations 000-011 的所有列/表/索引全部合并写入
   - 修复历史漂移：conversations.customer_id（010）/ engineers.onesignal_player_id（003）/ devices.name/status/photo_url/notes（004）/ customers/engineers 公司信息 + auth_status（005）/ notifications 表（006）/ engineer_reviews 表（007）/ customers.onesignal_player_id（009）
   - 头部明确声明真相源政策：migrations/ 是唯一真相，schema.sql 是同步累积快照
   - 结尾 INSERT 回填 `_migrations` 行，使 `wrangler d1 execute --file schema.sql` 新建库后 `_migrations` 表也是满的

3. **`worker/migrations/README.md` 补齐**
   - 新增"🔑 真相源政策"一节
   - 表格追加 010 / 011 两行
   - 新增"如何加一个迁移"的 5 步操作手册（文件命名 → 幂等写法 → _migrations INSERT → 同步 schema.sql → 更新 README）

**上线操作：**
```bash
wrangler d1 execute sagemro-db --file worker/migrations/011_create_migrations_tracking.sql --env production
```

**验证：** `npm test` — 40/40 passing（纯 schema/docs 改动，不影响运行时）

---

---

## 🟠 MEDIUM（UX）

### #13 替换 22×alert + 3×confirm → toast / Modal ✅ 已完成

**实施摘要（2026-04-26）：**

1. **新增 `frontend/src/utils/feedback.js`（57 行）** — 统一 API：
   - `toast(message, { type, duration })` + 语义快捷方法：`toastSuccess` / `toastError` / `toastInfo` / `toastWarning`
   - `confirmDialog(message, { title, confirmText, cancelText, danger })` 返回 `Promise<boolean>`
   - 基于 **CustomEvent 全局事件总线**（`sagemro:toast` / `sagemro:confirm` / `sagemro:confirm-result`），跨组件/异步回调零耦合
   - Promise 相关 id 机制：confirm 请求带 id，result 事件匹配 id，one-shot listener 自动清理

2. **新增 `frontend/src/components/common/FeedbackHost.jsx`（175 行）** — 宿主组件：
   - `ToastItem`：Framer Motion spring 入场动画 + lucide-react 图标（CheckCircle2 / XCircle / Info / AlertTriangle），按类型着色，右上角 X 手动关闭
   - `ConfirmDialog`：全屏遮罩 + 居中对话框，autoFocus 到确认按钮，`danger` 模式红色 CTA
   - `FeedbackHost`：订阅两条事件，toasts 按 duration 自动消失，confirms 栈式管理，ESC 关闭顶层（视为 cancel）
   - z-index：toast 70 / confirm 60-61，确保覆盖 Modal

3. **`frontend/src/App.jsx`** — 挂载 `<FeedbackHost />`（紧邻根 div 关闭标签）

4. **22 处 alert() + 3 处 confirm() 全部替换**（9 个文件）：
   - `Device/DeviceDetailPanel.jsx` — 1 alert
   - `Device/MyDevicesModal.jsx` — 1 alert + 1 confirm（`danger: true`）
   - `Sidebar/ChatHistory.jsx` — 1 alert + 1 confirm（`danger: true`）
   - `Sidebar/WorkOrderModal.jsx` — 2 alert（warning + error）
   - `WorkOrder/MessagePanel.jsx` — 1 alert
   - `WorkOrder/PricingPanels.jsx` — 7 alert（3 success + 3 error + 1 warning）
   - `WorkOrder/WorkOrderDetailModal.jsx` — 6 alert + 1 confirm
   - `Auth/LoginModal.jsx` — 1 alert
   - `hooks/usePushNotification.js` — 2 alert

**设计决策：为什么选 CustomEvent 全局总线而非 React Context？**
- 多数 alert/confirm 出现在 Promise 回调/useEffect 异步分支中，远离 React 树，用 Context 需要显式传递/包装
- CustomEvent 提供命令式 API（`toast()` / `await confirmDialog()`），是现有 alert/confirm 的 drop-in 替代，改动最小
- 代价是单例宿主组件，但这正是正确的 UX（全局唯一 toast 区 + confirm 弹层）

**验证：** `npm run build` 通过（642 KB gzip 193 KB，无回归），`grep -r '\balert\|confirm\s*(' frontend/src` 返回 0 命中。

### #14 前端 401 统一拦截 ✅ 已完成

**实施摘要（2026-04-26）：**

1. **`frontend/src/services/api.js`** — 顶部新增 20 行：
   - `triggerAuthFailure()` 清理 5 个 localStorage auth key + 派发 `sagemro:auth-expired` CustomEvent
   - Debounce 机制：`__authFailureTriggered` + 500ms 重置，并发 401 只触发一次登出
   - `window.fetch` 猴子补丁，幂等保护（`window.__sagemroFetchPatched`），只对 API_BASE 前缀请求生效，避免干扰 OneSignal 等第三方 SDK
   - **零业务代码改动**：现有 40+ 处 `fetch(${API_BASE}/...)` 调用无需逐个替换

2. **`frontend/src/App.jsx`** — `handleLogout` 后新增订阅 useEffect：
   - 监听 `sagemro:auth-expired` → 重置 React 状态（user/type/unreadCount=0）+ 打开 LoginModal
   - unmount 时清理监听器，避免内存泄漏

**触发链路：**
```
token 过期 → 任意 fetch → 后端 401
            → api.js 拦截器检测到 response.status === 401
            → 清 localStorage + dispatch CustomEvent
            → App.jsx 监听器清 React 状态 + 弹 LoginModal
            → 用户重新登录
```

**用户体验改进：**
- 之前：token 过期后用户看到一堆 "HTTP 401" 红字 alert，但侧边栏还显示已登录
- 现在：token 过期触发第一个 401 即静默清理 + 弹登录框，用户感知为"session 过期，请重新登录"

**验证：** `npm run build` — 通过（637 KB gzip 192 KB，与历史一致）

### #15 输入长度 + photo_url 协议白名单 ✅ 已完成

**实施摘要（2026-04-26）：**

1. **新增 `worker/src/lib/validators.js`（150 行）**
   - `ValidationError` 类（带 status，默认 400）
   - `LIMITS` 常量字典：长文本 4000/中等 100-500/短文本 20-100
   - `assertMaxLength(value, field, max)`：null/undefined 宽松放行，非字符串抛错（防数组/对象注入），超限抛错
   - `assertFieldLimits(body, fieldLimits)`：批量字段检查
   - `validateImageUrl(value, field)`：https + host 白名单 + 长度 + URL 合法性，empty 返回 null
   - `validationErrorToResponse(err, errorResponse)`：统一 400 响应转换

2. **白名单域名**（精确匹配或 `.suffix` 结尾，防 `evil.imagedelivery.net.attacker.com` 混淆）：
   - Cloudflare：`imagedelivery.net` / `r2.dev` / `lasersolutions4u.workers.dev`
   - 自家：`sagemro.com` / `sagemro.cn`
   - 腾讯 COS：`cos.ap-{shanghai,guangzhou,beijing}.myqcloud.com`
   - 阿里 OSS：`oss-cn-{hangzhou,shanghai,beijing}.aliyuncs.com`

3. **应用到 14 个写路径 handler**：
   - 工单：`handleCreateWorkOrder`（description/type）/ `handlePostWorkOrderMessage`（content）/ `handleSubmitWorkOrderPricing`（parts_detail）
   - 评价：`handleSubmitRating` / `handleSubmitPlatformRating` / `handleSubmitCustomerRating` / `handleSubmitEngineerReview`（comment 字段）/ `handleAdminReplyRating`（admin_reply）
   - 设备：`handleCreateDevice` / `handleUpdateDevice`（批量字段 + photo_url 协议白名单）
   - 用户：`handleUpdateCustomerProfile`（多字段 + logo_url 白名单）/ `handleUpdateEngineerProfile`（name/bio/service_region）
   - 对话：`handleRenameConversation`（title，放在 `.slice(0, 50)` 之前）/ `handleChat`（message 主对话）

4. **新增 `worker/tests/validators.test.mjs`（39 个测试）**
   - `assertMaxLength`：null/undefined 放行、数组/对象/数字抛错、恰好等上限放行、超限错误含字段名和上限
   - `assertFieldLimits`：body 非对象 no-op、多字段一个超限正确报字段名、跳过未定义字段
   - `validateImageUrl`：null/空串/全空白 → null、http/javascript:/data:/ftp: 全拒绝、非法 URL 抛错、精确白名单匹配放行、四个 CDN 后缀匹配放行、子域混淆攻击（`imagedelivery.net.evil.com`）拒绝、前缀混淆（`evilimagedelivery.net`）拒绝、其他域名拒绝、超长 URL 抛错、前后空白修剪、host 大小写不敏感
   - `validationErrorToResponse`：ValidationError 转响应、自定义 status 透传、其他 Error 返回 null

5. **`worker/package.json` 更新 test 脚本**把 `validators.test.mjs` 纳入默认 `npm test`

**防御的攻击场景：**
- 客户端跳过校验粘贴 MB 级文本 → D1 不会收到
- `photo_url` 注入 `javascript:alert(1)` → 解析协议阶段拒绝
- `photo_url` 注入 `data:` base64 泵入大量数据 → 协议拒绝
- `photo_url` 指向 `imagedelivery.net.attacker.com`（子域混淆）→ host 后缀检查拒绝
- `photo_url` 指向 `evilimagedelivery.net`（前缀混淆）→ 精确边界拒绝
- `photo_url` 指向 CDN 之外的自家域（信息泄露 Referer/IP）→ 白名单拒绝
- body 里塞数组/对象代替字符串 → typeof 检查拒绝

**验证：**
- `node --check worker/src/index.js` / `node --check worker/src/lib/validators.js` — SYNTAX OK
- `npm test` — **79/79 passing**（20 auth + 20 guards + 39 validators）
- 前端 `npm run build` — 不受影响

---

## 🎨 前端设计一致性

### #16 统一 Button 组件 ✅ 已完成

- 新增 `frontend/src/components/common/Button.jsx`，支持 `primary / secondary / ghost / danger` 变体与 `sm / md / lg` 尺寸
- 替换关键入口的原生 `<button>` 为统一组件

### #17 替换硬编码颜色为 CSS token ✅ 已完成

**实施摘要（2026-04-27）：**
- 全量扫描 `frontend/src/**/*.jsx`，将 68+ 处硬编码 hex 颜色替换为 CSS 变量
- 统一规则：
  - `bg-white dark:bg-[#2a2a3c]` → `bg-[var(--color-input-bg)]`
  - `border-[#e5e4e7] dark:border-[#3a3a4c]` → `border-[var(--color-input-border)]` / `border-[var(--color-border)]`
  - `text-[#08060d] dark:text-[#f3f4f6]` → `text-[var(--color-text-primary)]`
  - `text-[#6b6375]` → `text-[var(--color-text-secondary)]`
  - `text-[#f59e0b]` / `bg-[#f59e0b]` → `text-[var(--color-primary)]` / `bg-[var(--color-primary)]`
  - `hover:bg-[#fbbf24]` → `hover:bg-[var(--color-primary-hover)]`
- 清理的文件：MyDevicesModal / LoginModal / EngineerProfileModal / EngineerDashboard / MyWorkOrdersModal / RatingModal / EngineerReviewModal / Sidebar / ToolBar / RegionInput / PushNotificationBanner / SettingsModal / AboutModal / WelcomePage
- 结果：0 hex literal remaining across all `.jsx`
- `npm run build` — PASS

### #18 WelcomePage 增加三张优势卡片 ✅ 已完成

- 在欢迎页标题与快捷提问之间插入三张价值卡片：报价透明 / 精准匹配 / 全程记录
- 响应式布局（1 列移动端 → 3 列桌面端）
- 使用 token 色系，图标来自 lucide-react：Receipt / Sparkles / ClipboardCheck

### #19 AboutModal 重做为结构化平台亮点页 ✅ 已完成

- 由短介绍页重构为 size="md" 结构化页面，内容来源：CLAUDE.md §16
- 五个 section：
  1. Hero（logo + 一句话定位）
  2. 痛点 3 卡（找合伙人难 / 价格不透明 / 质量无保障）
  3. 解决方案流程图（客户 → 小智 → 平台 → 合伙人 → 核价 → 服务 → 评价）
  4. 传统方式 vs SAGEMRO 对比表（5 个维度）
  5. 数据飞轮 + 双端价值（对客户 / 对合伙人 各 3 条）
- 保留原有 Slogan「让天下没有难做的售后服务」与版权

---

## 🟢 Post-launch（30 天内）

- JWT 迁 HttpOnly cookie（当前 localStorage）
- 路由重构（400 行 if-else → 表驱动）
- 前端 bundle 代码分割（636 KB 单 chunk）
- 扩展 smoke 测试（pricing / wallet / withdrawal）
- 工程师端"推荐工单"UI Tab
- deposit_balance UI 隐藏或"即将开放"标签

---

## 进度记录

| 任务 | 状态 | Commit | 完成日期 |
|------|------|--------|----------|
| #1 OneSignal SDK 时序 | ✅ | 未提交（工作区） | 2026-04-26 |
| #2 读路径 IDOR | ✅ | 未提交（工作区） | 2026-04-26 |
| #3 cleanup 脚本白名单 | ✅ | 未提交（工作区） | 2026-04-26 |
| #4 Admin 登录限速 + env | ✅ | 未提交（工作区） | 2026-04-26 |
| #5 CI 工作流收紧 | ✅ | 未提交（工作区） | 2026-04-26 |
| #6 轮换 Key + 清历史 | ⏳ | - | - |
| #7 OpenAI 成本保护 | ✅ | 未提交（工作区） | 2026-04-26 |
| #8 Engineer status + reject | ✅ | 未提交（工作区） | 2026-04-26 |
| #9 ENVIRONMENT gate | ✅ | 未提交（工作区） | 2026-04-26 |
| #10 删用户 D1 batch | ✅ | 未提交（工作区） | 2026-04-26 |
| #11 可观测性 | ⏳ | - | - |
| #12 schema 漂移 | ✅ | 未提交（工作区） | 2026-04-26 |
| #13 alert/confirm 替换 | ✅ | 未提交（工作区） | 2026-04-26 |
| #14 401 拦截 | ✅ | 未提交（工作区） | 2026-04-26 |
| #15 输入校验 | ✅ | 未提交（工作区） | 2026-04-26 |
| #16 统一 Button 组件 | ✅ | 未提交（工作区） | 2026-04-27 |
| #17 CSS token 替换 hex | ✅ | 未提交（工作区） | 2026-04-27 |
| #18 WelcomePage 价值卡片 | ✅ | 未提交（工作区） | 2026-04-27 |
| #19 AboutModal 结构化重做 | ✅ | 未提交（工作区） | 2026-04-27 |

---

## 恢复指南（中断后）

1. `git status` 看工作区
2. `cat LAUNCH_REMEDIATION.md` 找当前 🚧 任务
3. 读对应行号文件，继续实施
4. 完成后更新本表 + commit
