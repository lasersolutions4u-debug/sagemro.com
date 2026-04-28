---
name: sagemro-ops
description: SAGEMRO website operations, maintenance, feature development, and iteration. Use when the user asks to modify, fix, deploy, or enhance the SAGEMRO platform — or when working in this project directory on any code changes.
---

# SAGEMRO Operations & Maintenance

You are maintaining the SAGEMRO platform (sagemro.com), a B2B information technology service platform for the sheet metal processing industry's equipment after-service market.

## Architecture

```
Frontend (React 18 + Vite + Tailwind CSS)
  ↓ deployed to Cloudflare Pages
Worker (Cloudflare Workers — single index.js with router)
  ↓
D1 Database (SQLite — schema at worker/migrations/)
  ↓
OpenAI API (via jiekou.ai proxy — gpt-4o-mini)
```

Admin panel at `admin/` is a separate vanilla HTML/JS app deployed to admin.sagemro.com.

## Key File Map

| Area | Files |
|------|-------|
| AI system prompt | `worker/src/index.js` — `SYSTEM_PROMPT` + role prompts (guest/customer/engineer) |
| AI function calling | `worker/src/index.js` — `TOOLS_SCHEMAS` + tool handler functions |
| Chat API | `worker/src/index.js` — `handleChat()` (SSE streaming) |
| Auth | `worker/src/index.js` — `handleLogin()`, `handleRegister*()` |
| Work orders | `worker/src/index.js` — `handleCreateTicket()`, `handleAcceptTicket()`, etc. |
| Pricing/settlement | `worker/src/index.js` — `handleSubmitWorkOrderPricing()`, `settleEngineerWallet()` |
| Worker libs | `worker/src/lib/` — auth.js, guards.js, push.js, sentry.js, summary.js, trace.js, util.js, validators.js, redact.js |
| Frontend API layer | `frontend/src/services/api.js` |
| Frontend state | `frontend/src/App.jsx` — all modal/state management in one component |
| Sidebar | `frontend/src/components/Sidebar/Sidebar.jsx`, `ToolBar.jsx` |
| Chat | `frontend/src/components/Chat/ChatArea.jsx`, `WelcomePage.jsx` |
| Auth UI | `frontend/src/components/Auth/LoginModal.jsx` |
| Work orders UI | `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`, `PricingPanels.jsx` |
| Engineer UI | `frontend/src/components/Engineer/EngineerDashboard.jsx`, `EngineerProfileModal.jsx` |
| Settings | `frontend/src/components/Settings/SettingsModal.jsx`, `CustomerHomeModal.jsx` |
| Device UI | `frontend/src/components/Device/MyDevicesModal.jsx`, `DeviceDetailPanel.jsx`, `DeviceForm.jsx` |
| Notification UI | `frontend/src/components/Notification/NotificationModal.jsx` |
| Legal UI | `frontend/src/components/common/LegalModal.jsx` |
| Legal docs | `docs/legal/` — user-agreement.md, privacy-policy.md, ai-disclaimer.md |
| Types | `frontend/src/types/index.js` |
| Hooks | `frontend/src/hooks/useChat.js`, `useConversations.js`, `useAuth.js`, etc. |
| Utils | `frontend/src/utils/helpers.js`, `feedback.js` |
| CI | `.github/workflows/deploy.yml` |

## Business Rules (CRITICAL)

### 1. Terminology
- **工程师** (engineer), never 合伙人 (partner) in any user-facing text, AI prompts, notifications, or legal docs.
- Code identifiers (`PartnerLevel`, `CommissionRates`) are OK as variable names but NOT in UI strings.

### 2. Fee Visibility (代收代付)
- Engineers see ONLY their expected payout per job. NEVER show commission rates or platform fee percentages to engineers.
- Fee breakdown (维修服务费 + 平台技术服务费) is shown ONLY on the customer pricing confirmation page.
- EngineerDashboard, SettingsModal, EngineerPricingPanel, and AI role prompts must NOT mention commission rates.

### 3. AI System Prompt
- The system prompt and role prompts in `worker/src/index.js` are PRODUCT decisions, not just code.
- Any change to these prompts changes how 小智 behaves for all users. Treat with care.
- Never remove safety warnings from the prompt.

### 4. CLAUDE.md
- This file is append-only. Do NOT delete or rewrite existing content without asking the user first.
- New information gets appended to the relevant section or as a new section.

### 5. Git Conventions
- Separate formatting from substance: use `git diff --ignore-all-space` to classify before committing.
- Commit messages in conventional format: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`
- Never skip hooks (`--no-verify`) without asking.

## Making Changes

### Before any code change:
1. Read the relevant files first — never edit blindly
2. Check if the change affects AI prompts (worker) or user-facing text (frontend)
3. Verify it respects the business rules above
4. Check for side effects: frontend changes may need matching worker changes, and vice versa

### Frontend changes:
- Run `cd frontend && npm run build` to verify no build errors
- Test dark mode and mobile viewport if changing layout
- Check that `App.jsx` prop drilling is consistent

### Worker changes:
- Run `cd worker && npm test` if tests exist for the area
- Migration files in `worker/migrations/` must be idempotent
- New API routes must handle CORS and auth

### Legal/documentation changes:
- Legal docs in `docs/legal/` and `frontend/src/components/common/LegalModal.jsx` must stay in sync
- When updating legal terms, update both the markdown source AND the JSX string

## Deployment

- **Auto-deploy**: push/merge to `main` triggers `.github/workflows/deploy.yml` — deploys frontend, worker, and admin
- **Manual worker deploy**: `cd worker && npx wrangler deploy`
- **Secrets**: managed via `wrangler secret put` — never in code or config files

## Common Tasks

### Adding a new notification type:
1. Add notification creation in `worker/src/index.js` handler
2. Ensure `createNotification()` is called with correct `user_type`, `type`, `title`, `body`
3. Verify the notification renders correctly in `NotificationModal.jsx`

### Modifying the pricing flow:
1. Worker: `handleSubmitWorkOrderPricing()`, `settleEngineerWallet()`, `handleConfirmWorkOrderPricing()`
2. Frontend: `PricingPanels.jsx` (both EngineerPricingPanel and CustomerPricingPanel)
3. Remember: engineer sees only payout, customer sees full breakdown

### Adding a new AI tool:
1. Add tool definition to `TOOLS_SCHEMAS` array in `worker/src/index.js`
2. Add tool handler function in the tool dispatch section
3. Update role prompts if the tool changes AI behavior
4. Test with real conversations

### Debugging:
- Frontend: check browser console + Network panel
- Worker: `wrangler tail` for live logs, check Sentry dashboard for errors
- AI issues: the worker logs AI tool calls via `logToolCall()` — check worker logs
- Auth issues: check token in localStorage, verify JWT_SECRET is set in worker secrets

## Learning from the Codebase

When you encounter something undocumented:
1. Read the worker route handler to understand the API contract
2. Check `frontend/src/services/api.js` to see how the frontend calls it
3. Check the database schema in `worker/migrations/` for data model
4. Check `CLAUDE.md` for business context

## Output Style

When making changes:
- Be concise about WHAT changed and WHY
- Show git diff stats after changes
- If the change affects business logic, explicitly confirm it respects the business rules
- Don't explain what well-named functions do — the code is self-documenting
