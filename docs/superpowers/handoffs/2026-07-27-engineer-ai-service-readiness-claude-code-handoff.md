# Claude Code Handoff: Engineer AI Service Readiness

**Prepared:** 2026-07-27

## Status

The Engineer AI Service Readiness Review implementation is complete locally in the isolated release worktrees. Production release is still pending: complete the final release review, verify and apply migration 043 on both production D1 databases as needed, push both release branches, wait for CI/deployments, run the Aliyun China deployment, and record the required smoke checks. Do not describe the feature as production deployed until that release gate has passed.

Read these documents in order before editing code:

1. [Approved design](../specs/2026-07-27-engineer-ai-service-readiness-design.md)
2. [Executable implementation plan](../plans/2026-07-27-engineer-ai-service-readiness.md)
3. [Deployment guide](../../../DEPLOY.md)
4. [Project operations rules](../../../.claude/skills/sagemro-ops.md)

The plan is the source of exact test cases, APIs, file edits, and commit boundaries. This handoff records the decisions that must not drift while implementing it.

## Continue In The Correct Release Worktree

| Purpose | Path | Branch | State |
| --- | --- | --- | --- |
| Main release candidate | `/private/tmp/sagemro-workorder-density.6koyaz/main` | `codex/workorder-list-density-main` | Local implementation complete; production release pending |
| China release candidate | `/private/tmp/sagemro-workorder-density.6koyaz/cn` | `codex/workorder-list-density-cn` | Local candidate exists; production release pending |

The next operator should inspect the current release-candidate diffs and complete the remaining Task 5 release gate rather than restarting Tasks 1-4.

Do not implement from `/Users/joe/Projects/sagemro.com`. It is the user's dirty worktree and contains unrelated edits and reports. Do not reset, clean, overwrite, or fold those changes into this feature.

## Product Boundary

This is an internal preparation aid for the engineer who is about to perform substantive remote, on-site, or hybrid service. It complements, but does not duplicate:

- Current Task Context: known work-order facts.
- Job Preparation: existing intake summary.
- Service Standard Checklist: fixed process standard and a separate future branded-product task.

Customer AI and Engineer AI are different roles. They use the existing Worker-held OpenAI-compatible configuration and default JSON model selection (`deepseek-chat` when no production override exists), but do not share a conversation identity, unrestricted memory, prompt, permissions, or browser-held key.

## Non-Negotiable Constraints

### Authorization and source data

- Only `auth.userType === 'engineer'` with `work_orders.engineer_id === auth.userId` may read, generate, refresh, or insert a readiness question.
- Customers, Admin, regional leads, historical engineers, and other engineers must receive neither readiness UI nor readiness API data.
- Do **not** reuse `assertWorkOrderReadAccess`; it intentionally permits regional-team access and is too broad for this feature.
- `conversation_id` is trusted only after verifying `conversations.customer_id` against the authenticated customer. Never trust a body-supplied `customer_id`.
- The existing `attachConversationImagesToWorkOrder` path currently needs that ownership check. Fix it for both manual and AI-tool work-order creation before copying attachments or storing a source conversation.
- Legacy and source-less work orders remain valid. They use work-order and public-message evidence only and must not claim that a customer AI conversation was reviewed.

### Data and cache model

- Create additive migration `043_engineer_service_readiness.sql`; migration `042_work_order_short_title` is already production-applied and must not be rerun.
- Use the internal `work_order_service_readiness` table. Do not add `source_conversation_id`, `review_json`, or readiness state to `work_orders`: existing detail responses expand `w.*` and could expose internal data.
- Stored states are only `missing`, `generating`, `ready`, and `failed`. `stale` is a runtime response state derived from the evidence fingerprint.
- Initial generation is asynchronous through `ctx.waitUntil`, with an 8-second provider timeout and a 30-second lease. A status read never calls the model.
- Fresh cache is reused. Changed evidence makes it stale; only an explicit executing-engineer action may regenerate it.
- The detail page paints independently. Only the right-rail card polls while generating, every 2 seconds for at most 20 seconds.

### Privacy, prompt, and cost controls

- Keep provider credentials entirely in the Worker. Do not add a browser key, a second provider, or a client-side provider endpoint.
- Redact and cap all model-bound free text. Treat customer evidence as untrusted reference data, never as instructions.
- Never send raw contact data, internal notes, private field-work evidence, raw media URLs, hidden prompts, or unbounded payloads to the provider.
- Version 1 sends media counts only. It does not visually analyze images or videos.
- Invalid or failed output preserves a previous valid review and affects only the readiness card. No model call may send a message, mutate the work order, or complete a checklist item.

### UI and message draft behavior

- Render the card only for the executing engineer, immediately above `Admin support` in a 320px desktop right rail. Below `lg`, both remain full-width blocks.
- Static English and Simplified Chinese copy ships together. Generated content comes from the Worker in the selected market language, not browser translation.
- `Insert into message` only switches to the existing Messages tab and pre-fills the existing composer once. It never sends automatically.
- A non-empty unsent draft requires confirmation before replacement. Cancel preserves the existing draft. Preserve the recently fixed manual chat-history scroll behavior.

## Remaining Execution Order

Tasks 1-4 are implemented locally. Follow the remaining Task 5 review, synchronization, migration, deployment, and evidence steps in the plan; do not treat local commits as production release evidence.

1. **Trusted source linkage and schema**: add migration 043 and the internal cache row; derive manual creation identity from JWT; validate source conversation ownership; cover manual and AI-tool creation.
2. **Worker evidence, cache, and routes**: build bounded/redacted evidence and fingerprinting; add direct executing-engineer guards; implement non-blocking `GET /service-readiness` and `POST /service-readiness/refresh` with leases, stale behavior, provider timeout, and tagged usage accounting.
3. **Engineer UI and safe draft handoff**: add the card, delayed loading, bounded polling, 320px rail, bilingual copy, and the one-time draft prop path through `WorkOrderDetailContent` to `MessagePanel`.
4. **End-to-end proof and release documentation**: add the local seeded Playwright journey, preserve existing lifecycle coverage, and update `DEPLOY.md` with the migration 043 dual-market gate.
5. **Integration, review, China synchronization, and release**: run the security review questions in the plan, synchronize only reviewed commits to the clean China worktree, and release in the required order.

## Important Touchpoints

| Area | Current location | Required direction |
| --- | --- | --- |
| Work-order creation and attachments | `worker/src/index.js` near `attachConversationImagesToWorkOrder` and `handleCreateWorkOrder` | Verify conversation ownership before attachment copying; use authenticated customer identity; create the internal cache row. |
| AI-tool work-order creation | `worker/src/index.js` near `toolCreateWorkOrder` | Persist the same trusted source relationship using its already trusted customer ID. |
| Readiness Worker API | `worker/src/index.js` plus new `worker/src/lib/serviceReadiness.js` | Use narrow access guards and non-blocking background generation; do not broaden general work-order access. |
| Database | `worker/migrations/043_engineer_service_readiness.sql`, `worker/schema.sql` | Add only the internal table and migration marker. |
| Engineer UI | `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx` | Own readiness load/poll/draft state without adding it to primary detail loading. |
| Card | new `frontend/src/components/Engineer/EngineerServiceReadinessCard.jsx` | Presentation-only component; no network calls and no `postWorkOrderMessage`. |
| Composer handoff | `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`, `MessagePanel.jsx` | Carry optional one-time draft props only to the existing message composer. |
| Customer manual work-order input | `frontend/src/App.jsx` | Send active `conversation_id` only from an authenticated customer flow. |

## Verification Gate

Run the focused RED/GREEN commands and task checks listed in the plan before moving to the next task. Before release, run the complete checks from Task 4:

```bash
cd e2e && npm test
cd ../worker && npm test
cd ../frontend && npm test && npm run lint && npm run build
cd ../admin && npm test && npm run build
```

Also review desktop and mobile Playwright artifacts. Required visible checks include card placement above `Admin support`, readable widened rail, no mobile horizontal overflow, draft insertion into Messages, no automatic send, and existing manual history-scroll behavior.

## Release Gate

`DEPLOY.md` and the GitHub workflow files are the deployment authority. The older deployment wording in this worktree's top-level `CLAUDE.md` is not sufficient for the current China topology; do not use it to decide a release path.

Before deploying Worker code that reads the new table, manually apply and verify migration 043 on **both** production D1 databases:

```bash
cd worker
npx wrangler d1 execute sagemro-db --env production --remote --file migrations/043_engineer_service_readiness.sql
npx wrangler d1 execute sagemro-db-cn --env production --remote --file migrations/043_engineer_service_readiness.sql
npx wrangler d1 execute sagemro-db --env production --remote --command "SELECT version FROM _migrations WHERE version = '043_engineer_service_readiness';"
npx wrangler d1 execute sagemro-db-cn --env production --remote --command "SELECT version FROM _migrations WHERE version = '043_engineer_service_readiness';"
```

Release sequence:

1. Confirm COM and CN backups, then apply and verify migration 043 on both databases.
2. Push reviewed `main`; wait for the full test job, production gate, Worker, international frontend, and international Admin deployments.
3. Verify the executing-engineer workflow on `engineer.sagemro.com`.
4. Verify the reviewed source and any scoped release fixes are present in the China release worktree; run its required checks.
5. Push `china-edition`. It must not deploy a second Worker.
6. Manually run `gh workflow run aliyun-cn-deploy.yml --ref china-edition`, wait for success, then verify the Chinese engineer flow on `engineer.sagemro.cn`.

Stop if either production D1 database lacks 043, the Worker deployment fails, or the Aliyun workflow or either required smoke check fails. Roll back code if necessary, but do not down-migrate the additive table or delete readiness history; forward-fix the data layer.

## Handoff Evidence and Secret Hygiene

At final release, record migration verification output, deployment workflow URLs/statuses, Aliyun status, and the two manual engineer-flow checks. Do not put provider keys, JWTs, cookies, passwords, real contacts, production customer data, or full review evidence in commits, tests, screenshots, prompts, or handoff notes.

## Suggested First Claude Code Instruction

```text
Read docs/superpowers/handoffs/2026-07-27-engineer-ai-service-readiness-claude-code-handoff.md,
the linked approved design, and the full implementation plan. Work only in the isolated
release worktrees, inspect the current diffs, and complete the remaining Task 5 release gate.
Do not modify the user's root worktree or describe the feature as production released until
migration, deployment, and smoke evidence is recorded.
```
