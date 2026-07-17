---
name: ui-copy-launch-review
description: Full UI copy audit and launch readiness fixes for SAGEMRO frontend (EN + CN, 2026-07-17)
metadata:
  type: project
  scope: frontend
---

# SAGEMRO UI Copy Launch Review

Date: 2026-07-17

## What was analyzed

All English and Chinese UI copy across the SAGEMRO frontend:
- WelcomePage (first screen / landing)
- ChatArea header, subtitle, AI notice
- Sidebar navigation
- InputArea placeholder
- Login / Registration modal
- WorkOrderModal (service request form)
- WorkOrderDetailModal (status tracking, ratings)
- EngineerDashboard / EngineerWorkspace
- EngineerRecruitingPage
- CustomerHomeModal (company settings)
- MyWorkOrdersModal / MyDevicesModal / NotificationModal (list empty states)
- AboutModal
- NotFoundPage
- Footer
- IndustryToolsPage (tools hub)
- InsightsPage
- App.jsx (page title)
- All associated test files

## P0 fixes applied

- **Page title**: `'SAGEMRO Equipment Service'` → `'SAGEMRO — AI-Powered Equipment Service Platform'`
- **English headline**: `'Type the problem. Get a clear service brief in seconds.'` → `'3 minutes of AI chat. Get your solution and next steps.'`
- **Chinese headline**: `'描述问题，三分钟拿到结构化服务简报。'` → `'跟 AI 聊三分钟，获取设备问题解决方案和下一步。'`

## P1 fixes applied

- **Empty states**: MyWorkOrders, Notifications, EngineerDashboard, EngineerWorkspace — all now include actionable hints
- **404 page**: Friendlier English copy with explicit CTA `'Go to AI Chat'`

## P2 fixes applied

- **AboutModal**: `'What The Chat Can Help Clarify'` → `'What SAGEMRO AI Can Help Clarify'`
- **LoginModal**: `'AI-assisted support'` → `'AI-driven service support'`
- **EngineerDashboard**: `'Pending Dispatch'` → `'Awaiting Dispatch'`
- **EngineerWorkspace**: `'No active task selected'` → `'Select a task to view job details and service preparation.'`

## CN-specific fixes applied

- **CustomerHomeModal**: Added comprehensive Chinese copy (was entirely English)
- **EngineerRecruitingPage CN**: Fixed 13 English remnants (heroStats, joinItems, lookForItems, leadText, process, faqs, modalTitle, note)

## Layout fix

- **InsightShell / ToolPageShell**: Added `flex min-h-[100dvh] flex-col` + `flex-1` wrapper around children to keep footer at bottom regardless of content height

## Deployment targets

| Target | Branch | Platform | URL |
|--------|--------|----------|-----|
| International | `main` | Cloudflare Pages | https://sagemro.com |
| China | `china-edition` | Aliyun ECS | https://sagemro.cn |

## Launch readiness assessment

**文案层面：可以上线。**
**产品层面：需验证 AI 对话、工单提交流程、注册登录链路的实际可用性。**

### 上线前必须确认
1. AI 对话是否能正常返回有意义的答复
2. 工单提交后 Admin 能否收到通知
3. 验证码发送是否正常（SMS/Email 服务商配置）
4. Terms / Privacy / AI Notice 法律文档是否填写完成

### 加分项（可上线后补）
- 首页 `<meta name="description">`
- Open Graph 标签（社交分享预览）
- favicon 多尺寸
- sitemap.xml
- 上线引导 / Welcome 首次提示

## Related files modified

See `frontend/src/components/*.jsx`, `frontend/tests/*.test.mjs`, and commit messages for the full list.
