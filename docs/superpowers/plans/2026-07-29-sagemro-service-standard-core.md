# SAGEMRO Service Standard Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the persisted, auditable SAGEMRO six-step service standard, role-safe confirmation APIs, deterministic gates, and legacy-work-order compatibility.

**Architecture:** Keep service-standard definitions and gate calculations in a pure Worker domain module. Persist item-level progress and Admin overrides in D1, expose authenticated APIs from the existing Worker router, and insert deterministic checks into the existing start-approval and resolve transitions. AI does not participate in progress or gate decisions.

**Tech Stack:** Cloudflare Workers, D1/SQLite, JavaScript ES modules, Node.js 24 test runner.

## Global Constraints

- Use standard version `1`; step and item keys are immutable for all version-1 work orders.
- The six fixed step keys are `task_alignment`, `risk_control`, `one_visit_readiness`, `evidence_execution`, `recovery_verification`, and `transparent_handover`.
- AI output must never confirm an item, clear a gate, or create a customer-visible completion fact.
- `not_applicable` requires a non-empty reason of at most 500 characters.
- Only the assigned engineer can confirm engineer-owned items; Admin can override a gate only with a reason and an audit entry.
- Do not modify `worker/wrangler.toml`, `.github/workflows/deploy.yml`, or Cloudflare project names.
- Migration `044_service_standard_progress.sql` must be applied manually to both `sagemro-db` and `sagemro-db-cn` before deploying the Worker.
- Every task must keep `worker/schema.sql` aligned with the migration-defined production schema.

---

## File Structure

- Create `worker/src/lib/serviceStandard.js`: versioned definitions, snapshot derivation, public projection, and gate calculations; no D1 or HTTP dependencies.
- Create `worker/migrations/044_service_standard_progress.sql`: progress and gate-override tables plus legacy backfill.
- Modify `worker/schema.sql`: local baseline schema matching migration 044.
- Create `worker/tests/service-standard-domain.test.mjs`: pure definition and gate tests.
- Create `worker/tests/service-standard-sqlite.test.mjs`: migration constraints and backfill tests with `node:sqlite`.
- Create `worker/tests/service-standard-api.test.mjs`: access, confirmation, override, and lifecycle API tests.
- Modify `worker/src/index.js`: D1 loaders, API handlers, audit writes, routes, work-order initialization, and lifecycle gates.
- Modify `worker/package.json`: add new tests to `pretest`/`test`.
- Create `admin/src/components/ServiceStandardAdminPanel.jsx`: read-only progress, blockers, and reasoned Admin override.
- Create `admin/src/components/ServiceStandardAdminPanel.test.mjs`: Admin/read-only UI contracts.
- Modify `admin/src/pages/WorkOrdersPage.jsx`: place the service-standard panel in the detail drawer.
- Modify `admin/src/services/api.js`: Admin snapshot and override clients.
- Modify `admin/package.json`: register the focused component test.
- Modify `DEPLOY.md`: document migration 044 commands and pre-deploy verification.

### Task 1: Versioned Service-Standard Domain

**Files:**
- Create: `worker/src/lib/serviceStandard.js`
- Create: `worker/tests/service-standard-domain.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**
- Produces: `SERVICE_STANDARD_VERSION`, `SERVICE_STANDARD_STEPS`, `buildServiceStandardDefinition(context)`, `deriveServiceStandardSnapshot({ definition, progressRows, overrides })`, `getBlockingItems(snapshot, gateKey)`, and `buildPublicServiceMilestones(snapshot)`.
- Consumes: only plain objects; no environment bindings or requests.

- [ ] **Step 1: Write failing definition and gate tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SERVICE_STANDARD_STEPS,
  buildServiceStandardDefinition,
  deriveServiceStandardSnapshot,
  getBlockingItems,
} from '../src/lib/serviceStandard.js';

test('version 1 exposes the approved six steps in order', () => {
  assert.deepEqual(SERVICE_STANDARD_STEPS.map((step) => step.key), [
    'task_alignment',
    'risk_control',
    'one_visit_readiness',
    'evidence_execution',
    'recovery_verification',
    'transparent_handover',
  ]);
});

test('start gate remains blocked until every required item in steps 1-3 is confirmed', () => {
  const definition = buildServiceStandardDefinition({
    serviceMode: 'onsite',
    requiresPaymentBeforeStart: true,
    arrivalVerificationRequired: true,
  });
  const progressRows = definition.items.map((item) => ({
    item_key: item.key,
    state: item.stepIndex < 3 ? 'confirmed' : 'pending',
  }));
  progressRows.find((row) => row.item_key === 'risk.isolation_permission').state = 'pending';

  const snapshot = deriveServiceStandardSnapshot({ definition, progressRows, overrides: [] });
  assert.deepEqual(
    getBlockingItems(snapshot, 'start').map((item) => item.key),
    ['risk.isolation_permission'],
  );
});
```

- [ ] **Step 2: Run the domain test and verify the import fails**

Run:

```bash
cd worker
node --test tests/service-standard-domain.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/serviceStandard.js`.

- [ ] **Step 3: Implement the immutable definition and derived snapshot**

```js
export const SERVICE_STANDARD_VERSION = 1;

export const SERVICE_STANDARD_STEPS = Object.freeze([
  { key: 'task_alignment', index: 0, gate: 'alignment' },
  { key: 'risk_control', index: 1, gate: 'risk' },
  { key: 'one_visit_readiness', index: 2, gate: 'start' },
  { key: 'evidence_execution', index: 3, gate: 'execution' },
  { key: 'recovery_verification', index: 4, gate: 'resolve' },
  { key: 'transparent_handover', index: 5, gate: 'handover' },
]);

const BASE_ITEMS = Object.freeze([
  ['task.device_identity', 0, 'engineer', true],
  ['task.problem_and_goal', 0, 'engineer', true],
  ['task.contact_and_window', 0, 'engineer', true],
  ['risk.hazards_reviewed', 1, 'engineer', true],
  ['risk.isolation_permission', 1, 'engineer', true],
  ['risk.ppe_and_access', 1, 'engineer', true],
  ['ready.tools_and_documents', 2, 'engineer', true],
  ['ready.parts_and_consumables', 2, 'engineer', false],
  ['ready.start_conditions', 2, 'admin', true],
  ['execute.baseline_evidence', 3, 'engineer', true],
  ['execute.actions_recorded', 3, 'engineer', true],
  ['execute.scope_authorized', 3, 'engineer', true],
  ['verify.functional_test', 4, 'engineer', true],
  ['verify.safety_restored', 4, 'engineer', true],
  ['verify.residual_risk', 4, 'engineer', true],
  ['handover.service_report', 5, 'system', true],
  ['handover.customer_confirmation', 5, 'customer', true],
  ['handover.follow_up', 5, 'engineer', false],
]);

export function buildServiceStandardDefinition(context = {}) {
  const items = BASE_ITEMS.map(([key, stepIndex, owner, required]) => ({
    key,
    stepKey: SERVICE_STANDARD_STEPS[stepIndex].key,
    stepIndex,
    owner,
    required,
    applicable: true,
  }));
  if (context.serviceMode === 'remote') {
    const ppe = items.find((item) => item.key === 'risk.ppe_and_access');
    ppe.required = false;
  }
  if (!context.requiresPaymentBeforeStart) {
    const start = items.find((item) => item.key === 'ready.start_conditions');
    start.owner = 'engineer';
  }
  return { version: SERVICE_STANDARD_VERSION, items };
}

export function deriveServiceStandardSnapshot({ definition, progressRows = [], overrides = [] }) {
  const nonBlockingStates = new Set(['confirmed', 'not_applicable', 'legacy_not_recorded']);
  const progress = new Map(progressRows.map((row) => [row.item_key, row]));
  const items = definition.items.map((item) => ({
    ...item,
    state: progress.get(item.key)?.state || 'pending',
    confirmedAt: progress.get(item.key)?.confirmed_at || null,
  }));
  const completedThrough = SERVICE_STANDARD_STEPS.findIndex((step) =>
    items.some((item) => item.stepIndex === step.index && item.required
      && !nonBlockingStates.has(item.state)));
  return {
    standardVersion: definition.version,
    currentStepIndex: completedThrough === -1 ? 5 : completedThrough,
    steps: SERVICE_STANDARD_STEPS.map((step) => ({
      ...step,
      items: items.filter((item) => item.stepIndex === step.index),
    })),
    items,
    overrides,
  };
}

const GATE_MAX_STEP = Object.freeze({ start: 2, resolve: 4, handover: 5 });

export function getBlockingItems(snapshot, gateKey, satisfiedItemKeys = []) {
  const maxStep = GATE_MAX_STEP[gateKey];
  if (!Number.isInteger(maxStep)) throw new TypeError(`Unknown service-standard gate: ${gateKey}`);
  if (snapshot.overrides.some((override) => override.gate_key === gateKey && !override.revoked_at)) return [];
  const satisfied = new Set(satisfiedItemKeys);
  return snapshot.items.filter((item) =>
    item.required && item.stepIndex <= maxStep
      && !satisfied.has(item.key)
      && !['confirmed', 'not_applicable', 'legacy_not_recorded'].includes(item.state));
}

export function buildPublicServiceMilestones(snapshot) {
  return snapshot.steps.map((step) => ({
    key: step.key,
    state: step.items.some((item) => item.state === 'legacy_not_recorded')
      ? 'legacy_not_recorded'
      : step.items.filter((item) => item.required)
        .every((item) => ['confirmed', 'not_applicable'].includes(item.state))
        ? 'completed'
        : step.index === snapshot.currentStepIndex ? 'current' : 'upcoming',
  }));
}
```

- [ ] **Step 4: Add tests for remote applicability, legacy state, override, and public projection**

Add explicit assertions that:

```js
assert.equal(remoteDefinition.items.find((item) => item.key === 'risk.ppe_and_access').required, false);
assert.deepEqual(getBlockingItems(overriddenSnapshot, 'start'), []);
assert.equal(legacyMilestones[0].state, 'legacy_not_recorded');
assert.deepEqual(getBlockingItems(legacySnapshot, 'start'), []);
assert.equal(
  getBlockingItems(startSnapshot, 'start', ['ready.start_conditions'])
    .some((item) => item.key === 'ready.start_conditions'),
  false,
);
assert.equal(publicMilestones.some((milestone) => 'items' in milestone), false);
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
cd worker
node --test tests/service-standard-domain.test.mjs
```

Expected: all service-standard domain tests PASS.

- [ ] **Step 6: Register the test and commit**

Add `tests/service-standard-domain.test.mjs` to `pretest` in `worker/package.json`.

```bash
git add worker/src/lib/serviceStandard.js worker/tests/service-standard-domain.test.mjs worker/package.json
git commit -m "feat(worker): define six-step service standard"
```

### Task 2: D1 Progress, Override, and Legacy Backfill

**Files:**
- Create: `worker/migrations/044_service_standard_progress.sql`
- Modify: `worker/schema.sql`
- Create: `worker/tests/service-standard-sqlite.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**
- Produces: tables `work_order_service_standard_progress` and `work_order_service_gate_overrides`.
- Consumes: immutable item keys from Task 1.

- [ ] **Step 1: Write a failing SQLite schema test**

```js
test('schema stores item progress and one active override per work order gate', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schemaSql);
  const columns = sqlite.prepare(
    "SELECT name FROM pragma_table_info('work_order_service_standard_progress') ORDER BY cid",
  ).all().map((row) => row.name);
  assert.deepEqual(columns, [
    'work_order_id', 'standard_version', 'step_key', 'item_key', 'state',
    'is_required', 'owner_type', 'confirmed_by_type', 'confirmed_by_id',
    'confirmed_at', 'evidence_type', 'evidence_id', 'not_applicable_reason',
    'created_at', 'updated_at',
  ]);
});
```

- [ ] **Step 2: Run the SQLite test and verify the table is missing**

Run:

```bash
cd worker
node --test tests/service-standard-sqlite.test.mjs
```

Expected: FAIL because `pragma_table_info` returns no columns.

- [ ] **Step 3: Add migration 044 and matching baseline schema**

Use this table contract in both files:

```sql
CREATE TABLE IF NOT EXISTS work_order_service_standard_progress (
  work_order_id TEXT NOT NULL,
  standard_version INTEGER NOT NULL DEFAULT 1,
  step_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'confirmed', 'not_applicable', 'legacy_not_recorded')),
  is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('engineer', 'admin', 'customer', 'system')),
  confirmed_by_type TEXT,
  confirmed_by_id TEXT,
  confirmed_at TEXT,
  evidence_type TEXT,
  evidence_id TEXT,
  not_applicable_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (work_order_id, standard_version, item_key),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_standard_work_order_step
  ON work_order_service_standard_progress(work_order_id, standard_version, step_key);

CREATE TABLE IF NOT EXISTS work_order_service_gate_overrides (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  gate_key TEXT NOT NULL CHECK (gate_key IN ('start', 'resolve', 'handover')),
  reason TEXT NOT NULL,
  overridden_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_gate_active_override
  ON work_order_service_gate_overrides(work_order_id, gate_key)
  WHERE revoked_at IS NULL;
```

End the migration with:

```sql
INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('044_service_standard_progress', 'Persisted SAGEMRO six-step service standard progress and audited gate overrides');
```

- [ ] **Step 4: Add explicit legacy-backfill SQL**

In migration 044, insert the 18 immutable item keys for every existing work order. Derive `legacy_not_recorded` only for steps earlier than the work order's current stage; leave the current and future steps `pending`. Use a `WITH standard_items(...) AS (VALUES ...)` CTE and this stage mapping:

```sql
CASE
  WHEN status IN ('completed') THEN 6
  WHEN status IN ('resolved', 'pending_review') THEN 5
  WHEN status = 'in_service' THEN 4
  WHEN status IN ('pricing', 'pending_payment', 'payment_review') THEN 3
  WHEN status IN ('assigned', 'in_progress') THEN 1
  ELSE 0
END
```

The insert state expression must be:

```sql
CASE WHEN item.step_index < existing.current_step
  THEN 'legacy_not_recorded'
  ELSE 'pending'
END
```

- [ ] **Step 5: Test constraints, cascade, active-override uniqueness, and backfill**

Apply migration 044 to an in-memory database containing one `in_service` and one `completed` work order. Assert:

```js
assert.equal(inServiceRows.length, 18);
assert.equal(inServiceRows.filter((row) => row.state === 'legacy_not_recorded').length, 12);
assert.equal(completedRows.every((row) => row.state === 'legacy_not_recorded'), true);
assert.throws(() => insertSecondActiveStartOverride(), /UNIQUE constraint failed/);
```

- [ ] **Step 6: Run focused tests and commit**

```bash
cd worker
node --test tests/service-standard-domain.test.mjs tests/service-standard-sqlite.test.mjs
```

Expected: all tests PASS.

Add the SQLite test to `pretest`, then:

```bash
git add worker/migrations/044_service_standard_progress.sql worker/schema.sql worker/tests/service-standard-sqlite.test.mjs worker/package.json
git commit -m "feat(worker): persist service standard progress"
```

### Task 3: Authenticated Progress and Override APIs

**Files:**
- Modify: `worker/src/index.js:428-460`
- Modify: `worker/src/index.js:5510-5830`
- Modify: `worker/src/index.js:18780-19190`
- Create: `worker/tests/service-standard-api.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**
- Consumes: Task 1 domain functions and Task 2 tables.
- Produces: `loadServiceStandardSnapshot(env, workOrder)`, `GET /api/workorders/:id/service-standard`, `POST /api/workorders/:id/service-standard/items/:itemKey/confirm`, and `POST /api/admin/workorders/:id/service-standard/override`.

- [ ] **Step 1: Write failing access and confirmation API tests**

Seed an assigned engineer, a different engineer, an Admin token, and one assigned work order. Assert:

```js
const own = await api(env, '/api/workorders/wo-1/service-standard', {
  userId: 'engineer-1', userType: 'engineer',
});
assert.equal(own.response.status, 200);
assert.equal(own.json.standard_version, 1);

const foreign = await api(env, '/api/workorders/wo-1/service-standard', {
  userId: 'engineer-2', userType: 'engineer',
});
assert.equal(foreign.response.status, 403);

const missingReason = await api(env, '/api/workorders/wo-1/service-standard/items/risk.ppe_and_access/confirm', {
  method: 'POST', userId: 'engineer-1', userType: 'engineer',
  body: { state: 'not_applicable', reason: '' },
});
assert.equal(missingReason.response.status, 400);
```

- [ ] **Step 2: Run the API test and verify the routes return 404**

Run:

```bash
cd worker
node --test tests/service-standard-api.test.mjs
```

Expected: FAIL because the service-standard routes do not exist.

- [ ] **Step 3: Implement progress initialization and snapshot loading**

Add imports from `./lib/serviceStandard.js`, then add:

```js
async function ensureServiceStandardRows(env, workOrder) {
  const definition = buildServiceStandardDefinition({
    serviceMode: workOrder.service_mode,
    requiresPaymentBeforeStart: Number(workOrder.active_quote_version || 0) >= 1,
    arrivalVerificationRequired: Boolean(workOrder.arrival_verification_required),
  });
  const statements = definition.items.map((item) => env.DB.prepare(`
    INSERT OR IGNORE INTO work_order_service_standard_progress (
      work_order_id, standard_version, step_key, item_key, state,
      is_required, owner_type
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).bind(
    workOrder.id, definition.version, item.stepKey, item.key,
    item.required ? 1 : 0, item.owner,
  ));
  if (statements.length) await env.DB.batch(statements);
  return definition;
}

async function loadServiceStandardSnapshot(env, workOrder) {
  const definition = await ensureServiceStandardRows(env, workOrder);
  const [progress, overrides] = await Promise.all([
    env.DB.prepare(`
      SELECT * FROM work_order_service_standard_progress
      WHERE work_order_id = ? AND standard_version = ?
      ORDER BY step_key, item_key
    `).bind(workOrder.id, definition.version).all(),
    env.DB.prepare(`
      SELECT * FROM work_order_service_gate_overrides
      WHERE work_order_id = ? AND revoked_at IS NULL
    `).bind(workOrder.id).all(),
  ]);
  return deriveServiceStandardSnapshot({
    definition,
    progressRows: progress.results || [],
    overrides: overrides.results || [],
  });
}
```

- [ ] **Step 4: Implement GET and item-confirmation handlers**

The confirmation handler must:

```js
const allowedStates = new Set(['confirmed', 'not_applicable']);
if (!allowedStates.has(body.state)) return errorResponse(localizedInvalidState, 400);
const reason = String(body.reason || '').trim();
if (body.state === 'not_applicable' && !reason) return errorResponse(localizedReasonRequired, 400);
if (reason.length > 500) return errorResponse(localizedReasonTooLong, 400);
if (item.owner_type === 'admin' && auth.userType !== 'admin') return errorResponse(localizedAdminOnly, 403);
if (item.owner_type === 'engineer' && workOrder.engineer_id !== auth.userId) return errorResponse(localizedAssignedOnly, 403);
```

Persist the item update and a `service_standard_item_confirmed` or `service_standard_item_not_applicable` audit statement in one `env.DB.batch`.

- [ ] **Step 5: Implement Admin override handler**

Accept only `{ gate: 'start' | 'resolve' | 'handover', reason }`; require an Admin role and a reason of 1–500 characters. Insert the active override and an audit log in the same batch:

```js
await env.DB.batch([
  env.DB.prepare(`
    INSERT INTO work_order_service_gate_overrides
      (id, work_order_id, gate_key, reason, overridden_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(generateId(), workOrderId, gate, reason, auth.staffId || auth.userId),
  buildAuditLogStatement(env, request, {
    targetType: 'work_order',
    targetId: workOrderId,
    action: 'service_standard_gate_overridden',
    afterState: { gate, reason },
  }),
]);
```

- [ ] **Step 6: Register routes and test the permission matrix**

Register exact routes before the generic `/api/workorders/:id` handler:

```js
if (path.match(/^\/api\/workorders\/[^/]+\/service-standard$/) && request.method === 'GET') {
  return handleGetWorkOrderServiceStandard(request, env);
}
if (path.match(/^\/api\/workorders\/[^/]+\/service-standard\/items\/[^/]+\/confirm$/)
  && request.method === 'POST') {
  return handleConfirmWorkOrderServiceStandardItem(request, env);
}
if (path.match(/^\/api\/admin\/workorders\/[^/]+\/service-standard\/override$/)
  && request.method === 'POST') {
  return handleAdminOverrideServiceStandardGate(request, env);
}
```

Test assigned engineer, foreign engineer, regional management read-only access, Admin confirmation, customer rejection with no internal snapshot, duplicate active override, and audit row creation. Return a localized `409` for a duplicate active gate override instead of leaking the SQLite unique-index error.

- [ ] **Step 7: Run focused tests and commit**

```bash
cd worker
node --test tests/service-standard-domain.test.mjs tests/service-standard-sqlite.test.mjs tests/service-standard-api.test.mjs
```

Expected: all tests PASS.

Add the API test to `worker/package.json`, then:

```bash
git add worker/src/index.js worker/tests/service-standard-api.test.mjs worker/package.json
git commit -m "feat(worker): expose service standard APIs"
```

### Task 4: Deterministic Lifecycle Gates

**Files:**
- Modify: `worker/src/index.js:14878-15031`
- Modify: `worker/src/index.js:7720-7830`
- Modify: `worker/src/index.js:17832-17952`
- Modify: `worker/tests/service-standard-api.test.mjs`
- Modify: `worker/tests/payment-approval-flow.test.mjs`
- Modify: `worker/tests/field-work-api.test.mjs`

**Interfaces:**
- Consumes: `loadServiceStandardSnapshot` and `getBlockingItems`.
- Produces: `getServiceStandardGateBlock(env, workOrder, gateKey)` and deterministic start/resolve blocking responses.

- [ ] **Step 1: Write failing lifecycle-gate tests**

For Admin start approval:

```js
const blocked = await api(env, '/api/admin/workorders/wo-payment/payment/approve-start', {
  method: 'POST', userType: 'admin', userId: 'admin',
  body: { note: 'Payment received.' },
});
assert.equal(blocked.response.status, 409);
assert.equal(blocked.json.code, 'service_standard_gate_blocked');
assert.deepEqual(blocked.json.blocking_items, [
  'task.device_identity',
  'task.problem_and_goal',
  'task.contact_and_window',
]);
```

For resolve and customer completion:

```js
assert.equal(resolveBeforeVerification.response.status, 409);
assert.equal(resolveBeforeVerification.json.gate, 'resolve');
assert.equal(completeBeforeHandover.response.status, 409);
assert.equal(completeBeforeHandover.json.gate, 'handover');
```

- [ ] **Step 2: Run focused tests and verify the lifecycle still advances**

Run:

```bash
cd worker
node --test tests/service-standard-api.test.mjs tests/payment-approval-flow.test.mjs
```

Expected: new gate assertions FAIL because current transitions do not inspect progress.

- [ ] **Step 3: Implement the gate helper**

```js
async function getServiceStandardGateBlock(
  env,
  workOrder,
  gateKey,
  satisfiedItemKeys = [],
) {
  const snapshot = await loadServiceStandardSnapshot(env, workOrder);
  const blocking = getBlockingItems(snapshot, gateKey, satisfiedItemKeys);
  if (!blocking.length) return null;
  return {
    gate: gateKey,
    blocking_items: blocking.map((item) => item.key),
  };
}

function serviceStandardGateBlockedResponse(block, market) {
  return jsonResponse({
    error: market === 'cn'
      ? '请先完成当前服务标准必做项'
      : 'Complete the required service-standard items first',
    code: 'service_standard_gate_blocked',
    ...block,
  }, 409);
}
```

- [ ] **Step 4: Gate Admin start approval**

In `handleAdminApprovePaymentStart`, call:

```js
const startGateBlock = await getServiceStandardGateBlock(
  env,
  wo,
  'start',
  ['ready.start_conditions'],
);
if (startGateBlock) return serviceStandardGateBlockedResponse(startGateBlock, market);
```

after payment readiness validation but before either versioned or legacy `UPDATE work_orders SET status = 'in_service'`. The approving action itself satisfies `ready.start_conditions`; after the gate passes, persist that item confirmation in the same successful D1 batch as the status transition and audit write. Never pre-confirm it before the remaining blockers have passed.

- [ ] **Step 5: Gate engineer resolution**

In `handleResolveWorkOrder`, expand the initial work-order query to include `id`, `service_mode`, `active_quote_version`, and call:

```js
const resolveGateBlock = await getServiceStandardGateBlock(
  env,
  { id: workOrderId, ...wo },
  'resolve',
);
if (resolveGateBlock) return serviceStandardGateBlockedResponse(resolveGateBlock, market);
```

after existing arrival, field-day, extension, and repair-record checks, but before the conditional status update. This preserves existing domain-specific errors and adds the SAGEMRO gate as the final quality check.

- [ ] **Step 6: Add automatic system confirmations**

Use one event-statement helper that confirms only the named owner or a system-owned row and can participate in the lifecycle handler's D1 batch:

```js
function buildServiceStandardEventConfirmationStatement(
  env,
  workOrderId,
  itemKey,
  actorType,
  actorId,
  evidenceType,
  evidenceId = null,
) {
  return env.DB.prepare(`
    UPDATE work_order_service_standard_progress
    SET state = 'confirmed', confirmed_by_type = ?, confirmed_by_id = ?,
        confirmed_at = datetime('now'), evidence_type = ?, evidence_id = ?,
        updated_at = datetime('now')
    WHERE work_order_id = ? AND standard_version = 1 AND item_key = ?
      AND owner_type IN (?, 'system') AND state = 'pending'
  `).bind(
    actorType, actorId, evidenceType, evidenceId,
    workOrderId, itemKey, actorType,
  );
}
```

Call it when:

- the resolve handler has already validated that a service report exists: confirm `handover.service_report` as `system`;
- Admin approves start: confirm `ready.start_conditions` as `admin`;
- `handleSubmitRating` accepts the owning customer's completion/evaluation: confirm `handover.customer_confirmation` as `customer`.

Do not confirm `handover.service_report` on an incomplete draft save, and add audit assertions for all three event confirmations.

- [ ] **Step 7: Gate customer completion**

In `handleSubmitRating`, after customer ownership and existing rating validation but before a status change to `completed`, evaluate:

```js
const handoverGateBlock = await getServiceStandardGateBlock(
  env,
  workOrder,
  'handover',
  ['handover.customer_confirmation'],
);
if (handoverGateBlock) {
  return serviceStandardGateBlockedResponse(handoverGateBlock, market);
}
```

The customer's accepted completion/evaluation action itself satisfies `handover.customer_confirmation`. Persist that confirmation, the completion transition, and the existing rating write as one successful unit; a rejected write must not leave the item confirmed.

- [ ] **Step 8: Run lifecycle tests and commit**

```bash
cd worker
node --test tests/service-standard-api.test.mjs tests/payment-approval-flow.test.mjs tests/field-work-api.test.mjs
```

Expected: all focused lifecycle tests PASS.

```bash
git add worker/src/index.js worker/tests/service-standard-api.test.mjs worker/tests/payment-approval-flow.test.mjs worker/tests/field-work-api.test.mjs
git commit -m "feat(worker): enforce service standard gates"
```

### Task 5: Admin Progress and Reasoned Override

**Files:**
- Create: `admin/src/components/ServiceStandardAdminPanel.jsx`
- Create: `admin/src/components/ServiceStandardAdminPanel.test.mjs`
- Modify: `admin/src/pages/WorkOrdersPage.jsx:26-50`
- Modify: `admin/src/pages/WorkOrdersPage.jsx:1521-1575`
- Modify: `admin/src/services/api.js:150-190`
- Modify: `admin/package.json`

**Interfaces:**
- Consumes: `GET /api/workorders/:id/service-standard` and `POST /api/admin/workorders/:id/service-standard/override`.
- Produces: full six-step operations visibility, blocker display, and Admin-only reasoned override.

- [ ] **Step 1: Write failing Admin UI contracts**

Assert that:

```js
assert.match(page, /<ServiceStandardAdminPanel/);
assert.match(panel, /blocking_items/);
assert.match(panel, /overrideAdminWorkOrderServiceStandardGate/);
assert.match(panel, /reason/);
assert.match(panel, /readOnly/);
assert.doesNotMatch(panel, /confirmWorkOrderServiceStandardItem/);
```

- [ ] **Step 2: Add Admin API clients**

Use the existing `request` helper:

```js
export async function getAdminWorkOrderServiceStandard(workOrderId) {
  return request(`/api/workorders/${encodeURIComponent(workOrderId)}/service-standard`);
}

export async function overrideAdminWorkOrderServiceStandardGate(workOrderId, gate, reason) {
  return request(`/api/admin/workorders/${encodeURIComponent(workOrderId)}/service-standard/override`, {
    method: 'POST',
    body: JSON.stringify({ gate, reason }),
  });
}
```

- [ ] **Step 3: Implement the Admin panel**

`ServiceStandardAdminPanel` props:

```js
{ workOrderId, readOnly, onRefresh }
```

Load the snapshot when the detail drawer opens. Show all six stages, item state/owner, active blockers, and existing overrides. Only full Admin users see the override action; `readOnly` regional/operations viewers see the same facts without mutation controls. Require a 1–500 character reason before submitting, show the server error verbatim, and reload both the panel and work-order detail after success.

- [ ] **Step 4: Place it before lifecycle controls**

Import the panel in `WorkOrdersPage.jsx` and render it immediately before `QuoteExecutionAdminPanel` and payment-start approval. This lets Admin see the same blockers before attempting a lifecycle action.

- [ ] **Step 5: Run Admin tests and build**

```bash
cd admin
node --test src/components/ServiceStandardAdminPanel.test.mjs
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add admin/src/components/ServiceStandardAdminPanel.jsx admin/src/components/ServiceStandardAdminPanel.test.mjs admin/src/pages/WorkOrdersPage.jsx admin/src/services/api.js admin/package.json
git commit -m "feat(admin): manage service standard gates"
```

### Task 6: Migration Runbook and Full Verification

**Files:**
- Modify: `DEPLOY.md`
- Modify: `worker/migrations/README.md`

**Interfaces:**
- Consumes: migration 044 and all Worker tests.
- Produces: exact COM/CN migration and verification procedure.

- [ ] **Step 1: Add the migration commands**

Document:

```bash
cd worker
wrangler d1 execute sagemro-db --env production --remote \
  --file migrations/044_service_standard_progress.sql
wrangler d1 execute sagemro-db-cn --env production --remote \
  --file migrations/044_service_standard_progress.sql
```

Add the verification query:

```bash
wrangler d1 execute sagemro-db --env production --remote \
  --command "SELECT version FROM _migrations WHERE version = '044_service_standard_progress';"
wrangler d1 execute sagemro-db-cn --env production --remote \
  --command "SELECT version FROM _migrations WHERE version = '044_service_standard_progress';"
```

- [ ] **Step 2: Run schema and focused tests**

```bash
cd worker
node --test \
  tests/service-standard-domain.test.mjs \
  tests/service-standard-sqlite.test.mjs \
  tests/service-standard-api.test.mjs \
  tests/payment-approval-flow.test.mjs \
  tests/field-work-api.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 3: Run the complete Worker gate**

```bash
cd worker
npm test
```

Expected: exit code 0 with no failed tests.

- [ ] **Step 4: Check migration and schema consistency**

```bash
git diff --check
rg -n "044_service_standard_progress" worker/migrations/044_service_standard_progress.sql DEPLOY.md worker/migrations/README.md
```

Expected: no whitespace errors; all three files contain the exact migration version.

- [ ] **Step 5: Commit documentation**

```bash
git add DEPLOY.md worker/migrations/README.md
git commit -m "docs: add service standard migration runbook"
```
