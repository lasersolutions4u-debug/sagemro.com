# SAGEMRO 开发团队修复验证报告

**日期**: 2026-05-03
**测试工程师**: E2E 自动化测试系统
**测试环境**: sagemro.com (生产环境) / sagemro-api.lasersolutions4u.workers.dev
**测试工具**: Playwright (Chromium headful, 1920×1080, zh-CN locale)

---

## 一、执行摘要

对开发团队声称已部署上线的 4 项修复进行了实际端到端验证。结果：**2 项确认修复 (Fix #1, #4)，1 项未部署 (Fix #2)，1 项无法验证 (Fix #3)**。

**关键问题：Fix #2 (AI create_work_order) 未上线导致整个工单生命周期无法测试。** AI 明确回复"目前我无法直接创建维修工单"，说明 function calling tool 未在生产环境激活。

---

## 二、测试覆盖范围

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 访客模式 | ✅ | 首页加载正常 |
| 客户注册 | ✅ | 完整流程通过 |
| 工程师注册 (含背景信息) | ✅ | 完整流程通过 |
| SMS 验证码 | ✅ | 888888 可用 |
| AI 对话 (已认证) | ✅ | 多轮对话正常 |
| AI 创建工单 | ❌ | function calling 未激活 |
| 手动创建工单 | ❌ | "新建工单"按钮无响应 |
| 工程师接单 | ⚠️ | 无工单可接 |
| 核价/确认/完成/评价 | ⚠️ | 依赖工单创建 |
| 性能 (FCP) | ✅ | 584ms 🟢 |
| 深色模式 | ⚠️ | 未测试 (非本次目标) |
| 法律文档 | ⚠️ | 未测试 (非本次目标) |

---

## 三、逐项修复验证

### Fix #1: LoginModal React Error #306 — ✅ VERIFIED

**问题描述**: LoginModal 使用 `React.lazy()` 动态导入，Rolldown 代码分割导致 "Error #306"。

**修复方案**: 将 lazy import 改为直接 import。

**验证方法**:
1. 注册新客户 (完整流程: 填写表单 → SMS → 身份选择 → 认证确认)
2. 注册新工程师 (含背景信息表单)
3. 监控浏览器 Console 错误

**验证结果**: ✅ **修复确认**
- 客户注册成功 (API: `POST /api/auth/register/customer` → 200)
- 工程师注册成功 (API: `POST /api/auth/register/engineer` → 200，含背景信息提交)
- 浏览器 Console 无 React 错误
- 注册后用户正确登录 (`登录/注册` 按钮消失)

**证据**:
- `day99-cust1-04-done.png` — 客户注册完成
- `day99-eng2-04-done.png` — 工程师注册完成
- API log: `[200] /api/auth/register/customer`, `[200] /api/auth/register/engineer`

---

### Fix #2: AI create_work_order Function Calling — ❌ NOT DEPLOYED

**问题描述**: AI 缺少 `create_work_order` function calling tool，导致 AI 可以讨论工单但无法实际创建。

**修复方案**: 为 AI 添加 `create_work_order` function calling 工具。

**验证方法**:
1. 以已认证客户身份与 AI 对话
2. 发送详细工单创建请求 (设备/故障/紧急程度/地址/联系人/时间)
3. AI 收集、汇总信息并请求确认后，观察是否实际创建工单
4. 同时监控 API 调用 (寻找 work-order 相关 endpoint)
5. 在"我的工单"页面验证工单是否存在

**验证结果**: ❌ **修复未部署**

完整对话流程:

```
用户: 请帮我创建一个维修工单：
- 设备：大族激光6020，6000W光纤激光切割机，2023年购入
- 故障：切割12mm碳钢时毛刺多、断面粗糙，持续一个月
- 紧急程度：一般
- 地址：苏州市相城区漕湖工业园
- 期望时间：下周内

AI:   好的，帮您汇总一下工单信息，确认无误后我就提交：
      设备：大族激光6020，6000W光纤激光切割机
      问题：切割12mm碳钢时毛刺多、断面粗糙，持续一个月，最近加重
      紧急程度：普通
      地址：苏州市相城区漕湖工业园
      期望时间：下周内
      确认无误吗？

用户: 确认无误，请提交

AI:   请确认这些信息是否正确？如果没问题，我将为您创建工单。

用户: 确认无误，请提交

AI:   目前我无法直接创建维修工单。建议您通过平台的报修功能进行提交，
      或者我可以提供一些指导帮助您完成报修流程。
```

**关键发现**:
- AI 能正确理解工单创建意图 ✅
- AI 能收集和汇总工单信息 ✅
- AI 请求用户确认后再创建 ✅
- AI **无法实际调用 create_work_order** ❌
- 整个对话过程中仅调用 `/api/chat` (SSE streaming)，无 work-order 相关 API 调用
- "新建工单" UI 按钮 (`data-testid="tool-create-work-order"`) 点击后不打开任何表单 → 进一步证实工单创建链路未接通

**API 监控**: 整个测试会话中调用的全部 API endpoints:
```
/api/auth/send-code
/api/auth/register/customer
/api/auth/register/engineer
/api/auth/login
/api/chat
/api/notifications/unread-count
```
无任何 work-order/create-order 相关 endpoint 被调用。

**证据**:
- `day99-wo-01-ai-create.png` — AI 对话完整截图
- `day99-wo-new-clicked.png` — 点击"新建工单"后页面无变化
- `day99-wo-customer-orders.png` — 客户"我的工单"为空
- `day99-wo-engineer-orders.png` — 工程师"我的工单"为空

---

### Fix #3: WorkOrderDetailModal Cache — ⚠️ CANNOT VERIFY

**问题描述**: WorkOrderDetailModal 显示缓存的 `workOrder.status` 而非刷新后的 `detail.status`。

**修复方案**: 修改 Modal 读取来源为最新数据。

**验证状态**: ⚠️ **无法验证**

**原因**: 工单创建 (Fix #2) 未上线，系统中不存在任何工单。以下测试路径均不可用：
- 客户"我的工单" → 空列表
- 工程师"我的工单" → 空列表
- 无工单 ID 可传入 WorkOrderDetailModal

**依赖关系**: Fix #3 的验证完全依赖于 Fix #2 的部署。部署 Fix #2 后可立即验证本项。

**验证计划** (待 Fix #2 上线后):
1. 创建工单 → 修改状态
2. 打开 WorkOrderDetailModal
3. 对比 Modal 显示状态与实际状态是否一致

---

### Fix #4: Google Fonts FCP Performance — ✅ VERIFIED

**问题描述**: Google Fonts 同步加载阻塞首次内容渲染 (FCP)，导致页面加载缓慢。

**修复方案**: 将 Google Fonts 改为异步非阻塞加载。

**验证方法**: 使用 Performance API 测量 FCP、DOM Ready、Load Complete。

**验证结果**: ✅ **修复确认**

| 指标 | 数值 | 评级 |
|------|------|------|
| DOM Ready | 327ms | 🟢 |
| Load Complete | 411ms | 🟢 |
| First Contentful Paint (FCP) | 584ms | 🟢 |

多次测试 FCP 均在 500-750ms 范围内，远低于 2000ms 阈值。页面加载流畅，无字体阻塞渲染的迹象。

---

## 四、测试过程中发现并修复的 E2E 框架问题

在测试过程中发现并修复了多个测试框架自身的问题：

### 4.1 API 监控 filter 错误
- **问题**: `api_monitor()` 使用 `"api.sagemro"` 过滤，但实际 API 域名为 `sagemro-api.lasersolutions4u.workers.dev`
- **修复**: 改为 `"sagemro-api"` (utils.py:32)

### 4.2 SMS 验证码更新
- **问题**: 验证码 "123456" 被 API 拒绝 (`"验证码错误或已过期"`)
- **修复**: 改为 "888888" — 确认为生产环境开发绕过后门 (utils.py:189)

### 4.3 注册成功检测误判
- **问题**: `register_user()` 使用 `"小智" in body` 判断登录成功 — "小智"始终在页面上因此始终返回 True (假阳性)
- **修复**: 改为 `"登录/注册" not in body` — 真正检测登录状态 (utils.py:243)

### 4.4 工程师注册缺少背景信息步骤
- **问题**: 工程师注册相比客户多一个背景信息表单，但 `register_user()` 未处理此差异
- **修复**: 新增 `_fill_engineer_background()` 函数 (utils.py:43-141)，处理：
  - 设备专长标签选择
  - 品牌经验标签选择
  - 服务项目输入
  - 服务地区输入
  - 自我介绍填写
  - 提交按钮 (`register-engineer-button`)

### 4.5 Engineer 背景表单导航失败
- **问题**: `get_by_text("填写背景信息")` 无法正确定位导航按钮"下一步：填写背景信息"
- **修复**: 改用 `locator('button[data-testid="auth-confirm-button"]')` 精确定位

---

## 五、关键 UI 元素 data-testid 映射

供开发参考，以下为测试中发现的按钮及其 data-testid：

| 按钮文本 | data-testid | 位置 |
|---------|-------------|------|
| 新建对话 | `new-chat-button` | 侧边栏 |
| 深色模式 | `theme-toggle-button` | 侧边栏 |
| 关于小智 | `about-xiaozhi-button` | 侧边栏 |
| 登录/注册 | `sidebar-login-button` | 侧边栏 |
| 新建工单 | `tool-create-work-order` | 侧边栏 (已登录) |
| 我的工单 | `tool-my-work-orders` | 侧边栏 (已登录) |
| 我的设备 | `tool-my-devices` | 侧边栏 (已登录) |
| 消息通知 | `tool-notifications` | 侧边栏 (已登录) |
| 用户头像 | `user-avatar-button` | 侧边栏 (已登录) |
| 退出登录 | `logout-button` | 侧边栏 (已登录) |
| 完成认证/下一步 | `auth-confirm-button` | 注册流程 |
| 注册成为工程师 | `register-engineer-button` | 背景信息表单 |

---

## 六、API Endpoints 清单

测试中观察到的 API endpoints:

| Endpoint | Method | 用途 |
|----------|--------|------|
| `/api/auth/send-code` | POST | 发送 SMS 验证码 |
| `/api/auth/register/customer` | POST | 客户注册 |
| `/api/auth/register/engineer` | POST | 工程师注册 |
| `/api/auth/login` | POST | 登录 |
| `/api/chat` | SSE | AI 对话 (流式) |
| `/api/notifications/unread-count` | GET | 未读通知数 |

**未观察到的预期 endpoints**:
- `/api/work-order/create` (或类似) — 未调用，需 Fix #2
- `/api/work-order/accept` — 未调用，依赖工单创建
- `/api/work-order/price` — 未调用，依赖工单创建

---

## 七、建议与下一步

### P0 — 阻塞项
1. **部署 Fix #2 (AI create_work_order)**: AI function calling tool 需部署到生产环境。AI 对话流程已完成 (信息收集→汇总→确认)，仅缺少最后的 tool invocation 环节。

### P1 — 应修复
2. **"新建工单"按钮无响应**: `tool-create-work-order` 按钮点击后不打开任何表单。如果这是独立于 AI 的创建入口，需检查事件绑定。

### P2 — 建议
3. **补充工单创建 API**: 建议为工单相关操作建立明确的 REST API endpoints，便于前端调用和 E2E 测试。

### 验证计划
- Fix #2 部署后，立即重新运行 `verify_fix.py` 进行全流程验证
- Fix #2 部署后，可验证 Fix #3 (WorkOrderDetailModal)
- 全流程验证通过后，恢复每日自动化测试 (Day 8+)

---

## 八、附录

### A. 测试脚本
- `verify_fix.py` — 最终版验证脚本
- `shared/utils.py` — 核心工具库 (含本次所有修复)

### B. 截图清单

| 文件 | 内容 |
|------|------|
| `day99-cust1-01-form.png` | 客户注册表单 |
| `day99-cust1-02-identity.png` | 客户身份选择 |
| `day99-cust1-03-role.png` | 客户选择后确认页 |
| `day99-cust1-04-done.png` | 客户注册完成 |
| `day99-eng2-01-form.png` | 工程师注册表单 |
| `day99-eng2-02-identity.png` | 工程师身份选择 |
| `day99-eng2-03-role.png` | 工程师选择后 |
| `day99-eng2-bg-form.png` | 工程师背景表单 |
| `day99-eng2-04-done.png` | 工程师注册完成 |
| `day99-wo-01-ai-create.png` | AI 工单创建对话 |
| `day99-wo-new-clicked.png` | 点击"新建工单"后无变化 |
| `day99-wo-customer-orders.png` | 客户我的工单 (空) |
| `day99-wo-engineer-orders.png` | 工程师我的工单 (空) |

### C. Git 变更摘要

`shared/utils.py` 主要变更:
- `api_monitor()` filter 修正
- SMS 验证码更新: `123456` → `888888`
- 注册成功检测修正: `"小智" in body` → `"登录/注册" not in body`
- 新增 `_fill_engineer_background()`: 处理工程师背景信息表单
- 注册流程重构: 区分 customer/engineer 路径
- 新增工单全流程函数: `create_work_order`, `accept_work_order`, `submit_pricing`, `confirm_pricing`, `complete_work_order`, `submit_review`
- 新增 `_click_action_button()`: 通用按钮定位 helper
