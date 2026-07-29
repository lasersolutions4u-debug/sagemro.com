# SAGEMRO Engineer Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the engineer work-order experience to show the six-step progress, current-stage checklist, and full-lifecycle AI service guidance in the approved desktop and mobile positions.

**Architecture:** Reuse the existing service-readiness cache, fingerprint, lease, PII redaction, and background generation. Add a version-2 guidance schema and new compatibility API, isolate frontend fetching/polling in a hook, and keep three focused view components outside the already-large work-order detail component.

**Tech Stack:** React 19, Vite, Tailwind CSS, Cloudflare Workers/D1, OpenAI-compatible JSON model endpoint, Node.js 24 tests, Playwright.

## Global Constraints

- This plan depends on `2026-07-29-sagemro-service-standard-core.md`.
- The fixed six-step standard remains usable when AI is missing, generating, stale, failed, unconfigured, or budget-exhausted.
- Guidance generation is allowed from `assigned` through `pending_review`; `completed` is read-only.
- AI returns at most 3 next actions and 2 customer-question drafts.
- AI never sends a message automatically and never confirms a service-standard item.
- Existing version-1 readiness results remain readable during the compatibility period.
- The right rail stays 320 px on desktop and the AI card remains above Admin support.
- Do not modify Cloudflare configuration or deployment workflows.

---

## File Structure

- Create `worker/src/lib/serviceGuidance.js`: version-2 bounded input, prompt, validation, and compatibility adapter.
- Create `worker/migrations/045_service_guidance_cache.sql`: non-destructive columns on the existing readiness cache.
- Modify `worker/schema.sql`: migration-45 baseline.
- Modify `worker/src/index.js`: guidance loader, cache payload, feedback handler, background refresh, event-trigger helper, and routes.
- Create `worker/tests/service-guidance-api.test.mjs`: v2 generation, lifecycle visibility, cache, privacy, and compatibility tests.
- Create `frontend/src/hooks/useServiceGuidance.js`: read-only polling and explicit refresh orchestration.
- Create `frontend/src/components/Engineer/EngineerServiceStandardProgress.jsx`: global six-step rail.
- Create `frontend/src/components/Engineer/EngineerServiceStageChecklist.jsx`: current-step item confirmations.
- Create `frontend/src/components/Engineer/EngineerServiceGuidanceCard.jsx`: AI current priority and question drafts.
- Modify `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx`: approved A/B/C placement.
- Modify `frontend/src/services/api.js`: service-standard and service-guidance clients.
- Modify frontend contract tests and `e2e/tests/engineer-service-readiness.spec.mjs`.
- Modify `DEPLOY.md` and `worker/migrations/README.md`: migration 045 commands and verification for COM/CN.

### Task 1: Version-2 Guidance Contract

**Files:**
- Create: `worker/src/lib/serviceGuidance.js`
- Create: `worker/tests/service-guidance-api.test.mjs`

**Interfaces:**
- Consumes: `redactReadinessText`, canonical evidence rules, and service-standard snapshot from the core plan.
- Produces: `GUIDANCE_VISIBLE_STATUSES`, `GUIDANCE_GENERATION_STATUSES`, `buildServiceGuidanceInput`, `buildServiceGuidancePrompt`, `parseServiceGuidance`, and `adaptReadinessV1`.

- [ ] **Step 1: Write failing parser tests**

```js
test('v2 guidance clamps actions and customer questions', () => {
  const result = parseServiceGuidance(JSON.stringify({
    version: 2,
    step_key: 'one_visit_readiness',
    headline: 'Confirm isolation before departure',
    risk_level: 'high',
    observations: [{ priority: 'high', detail: 'Isolation is unconfirmed.', source: 'service_standard' }],
    next_actions: [
      { priority: 'high', action: 'Confirm isolation.', rationale: 'Required before work.', related_item_key: 'risk.isolation_permission' },
      { priority: 'medium', action: 'Request alarm photo.', rationale: 'Narrows diagnosis.', related_item_key: 'task.problem_and_goal' },
      { priority: 'low', action: 'Pack cleaning kit.', rationale: 'Likely useful.', related_item_key: 'ready.parts_and_consumables' },
      { priority: 'low', action: 'Extra action.', rationale: 'Must be removed.', related_item_key: '' },
    ],
    customer_questions: [
      { priority: 'high', draft: 'Can the machine be isolated?' },
      { priority: 'medium', draft: 'Please send the alarm screen.' },
      { priority: 'low', draft: 'This third question is removed.' },
    ],
    evidence_needed: ['alarm_screen'],
  }), new Set(['risk.isolation_permission', 'task.problem_and_goal', 'ready.parts_and_consumables']));
  assert.equal(result.next_actions.length, 3);
  assert.equal(result.customer_questions.length, 2);
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

```bash
cd worker
node --test tests/service-guidance-api.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the strict v2 schema**

Use these exact allowed values:

```js
export const GUIDANCE_VISIBLE_STATUSES = new Set([
  'assigned', 'in_progress', 'pricing', 'pending_payment',
  'payment_review', 'in_service', 'resolved', 'pending_review', 'completed',
]);
export const GUIDANCE_GENERATION_STATUSES = new Set([
  'assigned', 'in_progress', 'pricing', 'pending_payment',
  'payment_review', 'in_service', 'resolved', 'pending_review',
]);
const PRIORITIES = new Set(['high', 'medium', 'low']);
const RISK_LEVELS = new Set(['high', 'medium', 'low', 'none']);
const SOURCES = new Set([
  'work_order', 'work_order_message', 'customer_ai_conversation',
  'service_standard', 'payment', 'material', 'field_work', 'service_report',
]);
```

Return exactly:

```js
{
  version: 2,
  step_key,
  headline,
  risk_level,
  observations: observations.slice(0, 6),
  next_actions: nextActions.slice(0, 3),
  customer_questions: questions.slice(0, 2),
  evidence_needed: evidenceNeeded.slice(0, 6),
}
```

Reject unknown priorities, sources, step keys, or `related_item_key` values.

- [ ] **Step 4: Reuse the existing redaction boundary**

`buildServiceGuidanceInput` must call `redactReadinessText` for every free-text field and include only:

```js
{
  work_order,
  source_conversation,
  public_work_order_messages,
  service_standard: {
    current_step_key,
    blocking_item_keys,
    pending_item_keys,
  },
  operational_state: {
    payment_state,
    material_request_count,
    field_day_count,
    field_report_count,
    service_report_present,
  },
  media_counts,
}
```

Do not include internal notes, protected media URLs, customer phone/email, or raw unbounded records.

- [ ] **Step 5: Test v1 compatibility and commit**

`adaptReadinessV1(review)` must map the first high-priority gap to `headline`, preserve up to two question drafts, and never create a completed standard item.

```bash
cd worker
node --test tests/service-guidance-api.test.mjs tests/service-readiness-api.test.mjs
```

Expected: both test files PASS.

```bash
git add worker/src/lib/serviceGuidance.js worker/tests/service-guidance-api.test.mjs
git commit -m "feat(worker): define lifecycle service guidance"
```

### Task 2: Guidance Cache and Compatibility API

**Files:**
- Create: `worker/migrations/045_service_guidance_cache.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.js:5510-5830`
- Modify: `worker/tests/service-guidance-api.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**
- Consumes: Task 1 guidance functions and core-plan `loadServiceStandardSnapshot`.
- Produces: `GET /api/workorders/:id/service-guidance`, `POST /api/workorders/:id/service-guidance/refresh`, and `POST /api/workorders/:id/service-guidance/feedback`.

- [ ] **Step 1: Write failing lifecycle visibility tests**

Assert:

```js
assert.equal((await guidance('wo-inservice-empty')).response.status, 200);
assert.equal((await refresh('wo-inservice-empty')).response.status, 202);
assert.equal((await refresh('wo-completed')).response.status, 409);
assert.equal((await guidance('wo-completed')).response.status, 200);
```

- [ ] **Step 2: Add non-destructive migration 045**

```sql
ALTER TABLE work_order_service_readiness ADD COLUMN guidance_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_order_service_readiness ADD COLUMN current_step_key TEXT;
ALTER TABLE work_order_service_readiness ADD COLUMN trigger_reason TEXT;
ALTER TABLE work_order_service_readiness ADD COLUMN guidance_json TEXT;

CREATE TABLE IF NOT EXISTS work_order_service_guidance_feedback (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  guidance_generated_at TEXT NOT NULL,
  action_index INTEGER NOT NULL CHECK (action_index BETWEEN 0 AND 2),
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('accepted', 'ignored', 'corrected')),
  correction_note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_guidance_feedback_work_order
  ON work_order_service_guidance_feedback(work_order_id, created_at DESC);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('045_service_guidance_cache', 'Full lifecycle engineer service guidance cache with v1 readiness compatibility');
```

Add the same columns to `worker/schema.sql`.

- [ ] **Step 3: Implement a single cache payload builder**

```js
function serviceGuidancePayload(cacheRow, currentFingerprint) {
  const storedGuidance = safeParseStoredGuidance(cacheRow?.guidance_json);
  const legacyReview = safeParseStoredReadinessReview(cacheRow?.review_json);
  const guidance = storedGuidance || adaptReadinessV1(legacyReview);
  const stored = cacheRow?.generation_state || 'missing';
  const state = stored === 'generating' || stored === 'failed'
    ? stored
    : !guidance ? 'missing'
    : cacheRow.input_fingerprint === currentFingerprint ? 'ready' : 'stale';
  return {
    state,
    guidance,
    generated_at: cacheRow?.generated_at || null,
    guidance_version: storedGuidance ? 2 : legacyReview ? 1 : null,
  };
}
```

- [ ] **Step 4: Add GET and non-blocking refresh handlers**

Follow the existing readiness route contract:

- GET performs D1 reads and fingerprint calculation only.
- POST validates `{ force: boolean }`.
- POST uses one conditional lease update.
- model timeout remains 8 seconds;
- the old valid guidance stays in the response while a refresh generates;
- late or expired tasks cannot overwrite a newer lease.

Store v2 JSON in `guidance_json`; do not overwrite `review_json`.

- [ ] **Step 5: Add bounded engineer feedback**

The feedback endpoint is assigned-engineer-only and accepts:

```js
{
  guidance_generated_at: '2026-07-29T03:00:00.000Z',
  action_index: 0,
  feedback_type: 'accepted' | 'ignored' | 'corrected',
  correction_note: '',
}
```

Reject feedback when the timestamp does not match the currently stored guidance, the indexed action does not exist in the stored guidance JSON, the work order is completed, or the caller is not the assigned engineer. Require a 1–500 character `correction_note` only for `corrected`; force it to `NULL` otherwise. Insert the feedback and `service_guidance_feedback_recorded` audit row in one `env.DB.batch`.

Return `202` after persistence. This action records engineer judgment and marks the guidance stale, but it must not update any service-standard item or work-order status.

Register the exact route before generic work-order detail:

```js
if (path.match(/^\/api\/workorders\/[^/]+\/service-guidance\/feedback$/)
  && request.method === 'POST') {
  return handleServiceGuidanceFeedback(request, env);
}
```

Test the assigned engineer success path plus foreign engineer, regional read-only, customer, stale timestamp, invalid action index, and completed-work-order rejection.

- [ ] **Step 6: Include bounded feedback in the next AI input**

Load at most the 10 most recent feedback rows. Include only:

```js
{
  action_index,
  feedback_type,
  correction_note,
  created_at,
}
```

Apply the same PII redaction and length limits to `correction_note`. Include these rows in the evidence fingerprint so a new correction creates a new guidance input.

- [ ] **Step 7: Keep old endpoints compatible**

Existing `/service-readiness` tests must continue passing. The old GET returns v1 review semantics; new UI uses only `/service-guidance`.

- [ ] **Step 8: Run focused Worker tests and commit**

```bash
cd worker
node --test tests/service-guidance-api.test.mjs tests/service-readiness-api.test.mjs
```

Expected: all tests PASS.

Add `tests/service-guidance-api.test.mjs` to `worker/package.json`.

```bash
git add worker/migrations/045_service_guidance_cache.sql worker/schema.sql worker/src/index.js worker/tests/service-guidance-api.test.mjs worker/package.json
git commit -m "feat(worker): add service guidance cache API"
```

### Task 3: Event-Driven Guidance Refresh

**Files:**
- Modify: `worker/src/index.js:6146-6205`
- Modify: `worker/src/index.js:6883-7265`
- Modify: `worker/src/index.js:12120-12320`
- Modify: `worker/src/index.js:14878-15031`
- Modify: `worker/src/index.js:15204-15320`
- Modify: `worker/src/index.js:17713-17952`
- Modify: `worker/tests/service-guidance-api.test.mjs`

**Interfaces:**
- Consumes: Task 2 cache generator.
- Produces: `scheduleServiceGuidanceRefresh(request, env, workOrderId, triggerReason)`.

- [ ] **Step 1: Write a failing deduplication test**

After two public-message events with identical normalized evidence, assert:

```js
assert.equal(env.__fetchCalls, 1);
const cache = sqlite.prepare(
  'SELECT trigger_reason, guidance_version FROM work_order_service_readiness WHERE work_order_id = ?',
).get('wo-guidance');
assert.equal(cache.trigger_reason, 'public_message');
assert.equal(cache.guidance_version, 2);
```

- [ ] **Step 2: Implement the scheduling helper**

```js
function scheduleServiceGuidanceRefresh(request, env, workOrderId, triggerReason) {
  const task = refreshServiceGuidanceIfChanged(env, {
    workOrderId,
    triggerReason,
    market: getRequestMarket(request),
  });
  if (request._ctx?.waitUntil) request._ctx.waitUntil(task);
  else void task.catch((error) => console.error('service guidance refresh failed', error));
}
```

`refreshServiceGuidanceIfChanged` must return without a provider call when:

- status is not in `GUIDANCE_GENERATION_STATUSES`;
- the current fingerprint equals the stored fingerprint;
- another generation lease is active.

- [ ] **Step 3: Trigger after high-signal committed events**

Call the helper only after successful persistence for:

- public work-order message: `public_message`;
- service-standard item confirmation: `service_standard`;
- guidance accepted, ignored, or corrected: `engineer_feedback`;
- attachment add/delete or customer device-information change: `evidence_changed`;
- repair record save: `service_report`;
- material request create/update: `material`;
- field-day check-in or report: `field_work`;
- payment-start request or approval: `payment`;
- work-order resolve: `status_change`.

Never schedule on read-only GET requests or internal-only notes. Feedback refresh must be scheduled only after its feedback and audit batch succeeds.

- [ ] **Step 4: Verify failures do not affect business writes**

Mock the provider to reject. Assert the public message, field report, and repair record still persist, while cache state becomes `failed`.

- [ ] **Step 5: Run focused tests and commit**

```bash
cd worker
node --test tests/service-guidance-api.test.mjs tests/work-order-messages.test.mjs tests/field-work-api.test.mjs
```

Expected: all tests PASS.

```bash
git add worker/src/index.js worker/tests/service-guidance-api.test.mjs
git commit -m "feat(worker): refresh guidance from service events"
```

### Task 4: Frontend API and Focused Components

**Files:**
- Modify: `frontend/src/services/api.js:569-588`
- Create: `frontend/src/hooks/useServiceGuidance.js`
- Create: `frontend/src/components/Engineer/EngineerServiceStandardProgress.jsx`
- Create: `frontend/src/components/Engineer/EngineerServiceStageChecklist.jsx`
- Create: `frontend/src/components/Engineer/EngineerServiceGuidanceCard.jsx`
- Create: `frontend/tests/engineer-service-guidance-contract.test.mjs`

**Interfaces:**
- Consumes: core service-standard and new service-guidance APIs.
- Produces: `useServiceGuidance({ workOrderId, enabled, canGenerate })` and three view components.

- [ ] **Step 1: Write failing frontend contract tests**

Assert exact imports and boundaries:

```js
assert.match(api, /export async function getWorkOrderServiceStandard/);
assert.match(api, /export async function confirmWorkOrderServiceStandardItem/);
assert.match(api, /export async function getWorkOrderServiceGuidance/);
assert.match(api, /export async function submitWorkOrderServiceGuidanceFeedback/);
assert.match(hook, /setInterval\(checkGuidance, 15000\)/);
assert.doesNotMatch(guidanceCard, /postWorkOrderMessage/);
assert.match(stageChecklist, /not_applicable/);
```

- [ ] **Step 2: Add API clients**

```js
export async function getWorkOrderServiceStandard(workOrderId) {
  const response = await fetch(
    `${API_BASE}/api/workorders/${encodeURIComponent(workOrderId)}/service-standard`,
    { headers: authHeaders() },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(
    new Error(data.error || `HTTP ${response.status}`),
    { status: response.status, data },
  );
  return data;
}

export async function confirmWorkOrderServiceStandardItem(workOrderId, itemKey, payload) {
  const response = await fetch(
    `${API_BASE}/api/workorders/${encodeURIComponent(workOrderId)}/service-standard/items/${encodeURIComponent(itemKey)}/confirm`,
    { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(
    new Error(data.error || `HTTP ${response.status}`),
    { status: response.status, data },
  );
  return data;
}

export async function getWorkOrderServiceGuidance(workOrderId) {
  const response = await fetch(
    `${API_BASE}/api/workorders/${encodeURIComponent(workOrderId)}/service-guidance`,
    { headers: authHeaders() },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(
    new Error(data.error || `HTTP ${response.status}`),
    { status: response.status, data },
  );
  return data;
}

export async function refreshWorkOrderServiceGuidance(workOrderId, { force = false } = {}) {
  const response = await fetch(
    `${API_BASE}/api/workorders/${encodeURIComponent(workOrderId)}/service-guidance/refresh`,
    {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ force }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(
    new Error(data.error || `HTTP ${response.status}`),
    { status: response.status, data },
  );
  return data;
}

export async function submitWorkOrderServiceGuidanceFeedback(workOrderId, payload) {
  const response = await fetch(
    `${API_BASE}/api/workorders/${encodeURIComponent(workOrderId)}/service-guidance/feedback`,
    { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(
    new Error(data.error || `HTTP ${response.status}`),
    { status: response.status, data },
  );
  return data;
}
```

Use the existing authenticated fetch/error conventions in `api.js`; do not add a second transport wrapper.

- [ ] **Step 3: Implement the hook**

The hook must:

- load cached guidance immediately;
- refresh missing/failed guidance only when `canGenerate`;
- poll every 2 seconds only while `generating`, at most 10 attempts;
- check the read-only GET every 15 seconds while the engineer detail is visible;
- auto-refresh when a read-only check returns `stale`;
- preserve previous guidance on errors.

Return:

```js
{
  guidanceState,
  guidance,
  generatedAt,
  pollingExpired,
  refresh,
}
```

- [ ] **Step 4: Implement the three presentational components**

`EngineerServiceStandardProgress` props:

```js
{ isCn, steps, currentStepIndex, onToggleAll }
```

`EngineerServiceStageChecklist` props:

```js
{ isCn, step, savingItemKey, onConfirm, onMarkNotApplicable }
```

`EngineerServiceGuidanceCard` props:

```js
{
  isCn, state, guidance, generatedAt, pollingExpired, canRefresh,
  onRefresh, onInsertQuestion, onActionFeedback,
}
```

All visible copy must have English and Chinese variants. Each AI action exposes “Use,” “Ignore,” and “Correct”; correction requires a short editable note and explicit submit. Feedback updates AI evidence and requests a refresh, but never checks a standard item. Keep customer-question insertion as an unsent draft using the existing `messageDraftRequest` flow.

- [ ] **Step 5: Run frontend contracts and commit**

```bash
cd frontend
node --test tests/engineer-service-guidance-contract.test.mjs tests/engineer-service-readiness-contract.test.mjs
```

Expected: all tests PASS.

```bash
git add frontend/src/services/api.js frontend/src/hooks/useServiceGuidance.js frontend/src/components/Engineer/EngineerServiceStandardProgress.jsx frontend/src/components/Engineer/EngineerServiceStageChecklist.jsx frontend/src/components/Engineer/EngineerServiceGuidanceCard.jsx frontend/tests/engineer-service-guidance-contract.test.mjs
git commit -m "feat(frontend): add engineer service guidance components"
```

### Task 5: Approved Engineer-Detail Placement

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx:98-344`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`
- Modify: `frontend/tests/engineer-service-readiness-contract.test.mjs`

**Interfaces:**
- Consumes: Task 4 hook/components.
- Produces: approved A/B/C desktop placement and mobile order.

- [ ] **Step 1: Update failing placement contracts**

Require this DOM order:

```js
assert.match(detail, /<EngineerServiceStandardProgress[\s\S]*role="tablist"/);
assert.match(detail, /<EngineerServiceStageChecklist/);
assert.match(detail, /<EngineerServiceGuidanceCard[\s\S]*copy\.support/);
assert.doesNotMatch(detail, /const CHECKLIST =/);
```

- [ ] **Step 2: Place the global six-step rail**

Render `EngineerServiceStandardProgress` immediately after the existing work-order summary section and before the two-column main/right-rail grid.

- [ ] **Step 3: Replace the old static checklist**

Remove `CHECKLIST`, `checkedChecklistItems`, and `toggleChecklistItem`. In the Overview panel, render only the current step through `EngineerServiceStageChecklist`.

On confirmation success:

```js
await confirmWorkOrderServiceStandardItem(detail.id, itemKey, payload);
await loadServiceStandard();
```

Show the server-returned blocking reason; do not infer gate state from local checkbox state.

Wire `onActionFeedback` to `submitWorkOrderServiceGuidanceFeedback`. After a successful response, keep the current guidance visible as stale while the hook refreshes it. Do not remove or visually complete the corresponding fixed checklist item.

- [ ] **Step 4: Upgrade the right rail**

Replace `EngineerServiceReadinessCard` with `EngineerServiceGuidanceCard` above Admin support. Keep:

```jsx
<aside className="space-y-3 self-start lg:sticky lg:top-4">
```

On mobile, CSS source order must be summary → progress → AI card → tabbed content. Use a shared component instance and responsive grid areas rather than rendering duplicate cards.

- [ ] **Step 5: Run lint, contracts, and build**

```bash
cd frontend
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx frontend/tests/engineer-work-order-experience-contract.test.mjs frontend/tests/engineer-service-readiness-contract.test.mjs
git commit -m "feat(frontend): integrate precision service loop"
```

### Task 6: Migration 045 Runbook

**Files:**
- Modify: `DEPLOY.md`
- Modify: `worker/migrations/README.md`

**Interfaces:**
- Consumes: `worker/migrations/045_service_guidance_cache.sql`.
- Produces: exact COM/CN migration order and verification before Worker deployment.

- [ ] **Step 1: Document both production migrations**

```bash
cd worker
wrangler d1 execute sagemro-db --env production --remote \
  --file migrations/045_service_guidance_cache.sql
wrangler d1 execute sagemro-db-cn --env production --remote \
  --file migrations/045_service_guidance_cache.sql
```

Record that migration 044 from the core plan must already be present.

- [ ] **Step 2: Add verification**

```bash
wrangler d1 execute sagemro-db --env production --remote \
  --command "SELECT version FROM _migrations WHERE version IN ('044_service_standard_progress', '045_service_guidance_cache') ORDER BY version;"
wrangler d1 execute sagemro-db-cn --env production --remote \
  --command "SELECT version FROM _migrations WHERE version IN ('044_service_standard_progress', '045_service_guidance_cache') ORDER BY version;"
```

Expected: both databases return both versions before the Worker is deployed.

- [ ] **Step 3: Commit**

```bash
git add DEPLOY.md worker/migrations/README.md
git commit -m "docs: add service guidance migration runbook"
```

### Task 7: Engineer Lifecycle E2E and Full Verification

**Files:**
- Modify: `e2e/tests/engineer-service-readiness.spec.mjs`
- Modify: `e2e/tests/service-order-lifecycle.spec.mjs`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: desktop/mobile visual and lifecycle proof.

- [ ] **Step 1: Add an in-service-no-cache E2E scenario**

Create an `in_service` work order with no cached guidance. Assert:

```js
await expect(page.getByRole('heading', { name: 'AI Service Guidance' })).toBeVisible();
await expect(page.getByText('Preparing service guidance…')).toBeVisible();
```

This locks the regression that previously hid the Chinese/in-service card.

- [ ] **Step 2: Add standard progress and gate interaction**

Seed required step-1 to step-3 items, leave one risk item pending, and assert:

```js
await expect(page.getByText('Step 2 · Risk Control')).toBeVisible();
await expect(page.getByText('1 required item blocks service start')).toBeVisible();
```

Confirm the item and verify the progress rail updates without a page reload.

- [ ] **Step 3: Verify unsent customer-question drafts**

Click “Insert into message,” assert the existing composer contains the question, and query D1 to prove no work-order message row was created until the engineer clicks Send.

- [ ] **Step 4: Verify engineer correction feedback**

Correct one AI action. Assert the feedback row and audit row are stored, the fixed checklist is unchanged, guidance becomes stale, and exactly one background refresh is scheduled.

- [ ] **Step 5: Capture both viewports**

Use existing `captureBothViewports` for:

- engineer progress rail;
- current-stage checklist;
- AI guidance ready;
- AI guidance failed with fixed standard still visible.

- [ ] **Step 6: Run focused E2E**

```bash
cd e2e
npm run prepare:local
E2E_TEST_SECRET=local-e2e-secret-32-characters \
  npx playwright test tests/engineer-service-readiness.spec.mjs tests/service-order-lifecycle.spec.mjs
```

Expected: both specs PASS.

- [ ] **Step 7: Run complete repository verification**

```bash
cd worker && npm test
cd ../frontend && npm run lint && npm test && npm run build
cd ../admin && npm test && npm run build
cd ../e2e && npm test
```

Expected: every command exits 0.

- [ ] **Step 8: Commit**

```bash
git add e2e/tests/engineer-service-readiness.spec.mjs e2e/tests/service-order-lifecycle.spec.mjs
git commit -m "test(e2e): cover engineer service guidance lifecycle"
```
