---
name: sagemro-ops
description: SAGEMRO 网站运营、维护、功能开发和迭代。当用户要求修改、修复、部署或增强 SAGEMRO 平台时使用此 skill——或者在此项目目录下进行任何代码改动时自动生效。
---

# SAGEMRO 运营与维护

你正在维护 SAGEMRO 平台（sagemro.com）——一个面向钣金加工行业设备后服务市场的 B2B 信息技术服务平台。

## 架构概览

```
前端（React 18 + Vite + Tailwind CSS）
  ↓ 部署至 Cloudflare Pages
Worker（Cloudflare Workers — 单文件 index.js 内含路由分发）
  ↓
D1 数据库（SQLite — schema 文件在 worker/migrations/）
  ↓
OpenAI API（通过 api.jiekou.ai 中转 — 模型 gpt-4o-mini）
```

管理后台 `admin/` 是一个独立的原生 HTML/JS 应用，部署至 admin.sagemro.com。

## 关键文件地图

| 模块 | 文件 |
|------|------|
| AI 系统提示词 | `worker/src/index.js` — `SYSTEM_PROMPT` + 角色分层提示词（访客/客户/工程师）|
| AI 工具调用 | `worker/src/index.js` — `TOOLS_SCHEMAS` + 各工具处理函数 |
| 对话 API | `worker/src/index.js` — `handleChat()`（SSE 流式）|
| 认证 | `worker/src/index.js` — `handleLogin()`、`handleRegister*()` |
| 工单 | `worker/src/index.js` — `handleCreateTicket()`、`handleAcceptTicket()` 等 |
| 核价/结算 | `worker/src/index.js` — `handleSubmitWorkOrderPricing()`、`settleEngineerWallet()` |
| Worker 工具库 | `worker/src/lib/` — auth.js、guards.js、push.js、sentry.js、summary.js、trace.js、util.js、validators.js、redact.js |
| 前端 API 层 | `frontend/src/services/api.js` |
| 前端全局状态 | `frontend/src/App.jsx` — 所有弹窗和状态管理集中在此文件 |
| 侧边栏 | `frontend/src/components/Sidebar/Sidebar.jsx`、`ToolBar.jsx` |
| 对话 | `frontend/src/components/Chat/ChatArea.jsx`、`WelcomePage.jsx` |
| 认证界面 | `frontend/src/components/Auth/LoginModal.jsx` |
| 工单界面 | `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`、`PricingPanels.jsx` |
| 工程师界面 | `frontend/src/components/Engineer/EngineerDashboard.jsx`、`EngineerProfileModal.jsx` |
| 设置 | `frontend/src/components/Settings/SettingsModal.jsx`、`CustomerHomeModal.jsx` |
| 设备界面 | `frontend/src/components/Device/MyDevicesModal.jsx`、`DeviceDetailPanel.jsx`、`DeviceForm.jsx` |
| 通知界面 | `frontend/src/components/Notification/NotificationModal.jsx` |
| 法律合规界面 | `frontend/src/components/common/LegalModal.jsx` |
| 法律文档 | `docs/legal/` — user-agreement.md、privacy-policy.md、ai-disclaimer.md |
| 类型定义 | `frontend/src/types/index.js` |
| Hooks | `frontend/src/hooks/useChat.js`、`useConversations.js`、`useAuth.js` 等 |
| 工具函数 | `frontend/src/utils/helpers.js`、`feedback.js` |
| CI/CD | `.github/workflows/deploy.yml` |

## 业务规则（必须遵守）

### 1. 术语
- 所有用户可见文案、AI 提示词、通知、法律文档中，使用**"工程师"**，绝不用"合伙人"。
- 代码中的标识符（`PartnerLevel`、`CommissionRates`）可保留，但 UI 字符串必须用"工程师"。

### 2. 佣金可见性（代收代付模式）
- 工程师端：**仅显示**每单预计实得金额。绝不出示提成比例或平台费率。
- 费用拆分（维修服务费 + 平台技术服务费）**仅在客户端报价确认页**展示。
- EngineerDashboard、SettingsModal、EngineerPricingPanel、AI 角色提示词中不得出现佣金比例。

### 3. AI 系统提示词
- `worker/src/index.js` 中的系统提示词和角色提示词属于**产品决策**，不是纯技术代码。
- 修改提示词会改变小智对所有用户的行为方式。必须谨慎处理。
- 绝不能移除提示词中的安全提醒内容。

### 4. CLAUDE.md
- 此文件只增不删。未经用户明确同意，不得删除或改写已有内容。
- 新信息追加到相关章节末尾或作为新章节。

### 5. Git 约定
- 格式化与实质改动分开提交：提交前用 `git diff --ignore-all-space` 分类。
- 提交信息格式：`feat:` / `fix:` / `refactor:` / `style:` / `chore:`
- 禁止跳过 hooks（`--no-verify`），除非用户明确要求。

## 修改代码

### 改代码前：
1. 先读相关文件——绝不盲改
2. 判断改动是否影响 AI 提示词（worker）或用户可见文案（前端）
3. 确认符合上述业务规则
4. 检查副作用：前端改动可能需要同步 worker，反之亦然

### 前端改动：
- 跑 `cd frontend && npm run build` 确认无构建错误
- 改布局时必须检查深色模式和移动端适配
- 确保 `App.jsx` 的 prop 传递链路完整

### Worker 改动：
- 如有测试：`cd worker && npm test`
- `worker/migrations/` 中的迁移文件必须幂等
- 新增 API 路由需处理 CORS 和认证

### 法律/文档改动：
- `docs/legal/` 和 `LegalModal.jsx` 中的法律文本必须保持同步
- 更新法律条款时，同时改 markdown 源文件和 JSX 字符串

## 部署

- **自动部署**：push/merge 到 `main` 触发 `.github/workflows/deploy.yml`——部署前端、worker、admin
- **手动部署 worker**：`cd worker && npx wrangler deploy`
- **密钥管理**：通过 `wrangler secret put` 注入——绝不出现在代码或配置文件中

## 常见维护任务

### 新增通知类型：
1. 在 `worker/src/index.js` 对应 handler 中添加通知创建逻辑
2. 确保 `createNotification()` 的 `user_type`、`type`、`title`、`body` 参数正确
3. 验证 `NotificationModal.jsx` 能正确渲染该类型通知

### 修改核价流程：
1. Worker：`handleSubmitWorkOrderPricing()`、`settleEngineerWallet()`、`handleConfirmWorkOrderPricing()`
2. 前端：`PricingPanels.jsx`（EngineerPricingPanel + CustomerPricingPanel 都要改）
3. 牢记：工程师只看实得，客户看完整拆分

### 新增 AI 工具：
1. 在 `worker/src/index.js` 的 `TOOLS_SCHEMAS` 数组中添加工具定义
2. 在工具分发逻辑中添加处理函数
3. 如工具改变了 AI 行为，同步更新角色提示词
4. 用真实对话测试工具调用效果

### 调试：
- 前端：浏览器控制台 + Network 面板
- Worker：`wrangler tail` 查看实时日志，Sentry 看错误面板
- AI 问题：worker 通过 `logToolCall()` 记录工具调用——查 worker 日志
- 认证问题：检查 localStorage 中的 token，确认 worker secret 中 JWT_SECRET 已设置

## 探索未知代码

当遇到文档未覆盖的内容时：
1. 读 worker 路由 handler 理解 API 契约
2. 查 `frontend/src/services/api.js` 看前端如何调用
3. 查 `worker/migrations/` 了解数据模型
4. 查 `CLAUDE.md` 找业务背景

## 输出风格

改动完成后：
- 简洁说明改了什么、为什么改
- 附 git diff 统计
- 如涉及业务逻辑，明确确认符合业务规则
- 不解释命名良好的函数做了什么——代码本身已说明
