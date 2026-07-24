# Quote Execution Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one reviewed and customer-confirmed quote version control fees, onsite workday allowance, optional 1-to-6-installment collection, service-start authorization, and financial closure in both markets.

**Architecture:** Add a focused `quoteExecution` domain module for deterministic validation and status projections, while existing Worker handlers remain responsible for authorization, D1 transactions, notifications, and audit writes. Persist immutable quote-version schedules separately from operational installments and receipt claims; expose one normalized execution summary to the engineer, customer, and Admin clients. Preserve legacy advance/balance records as read-only compatibility input while all newly submitted quotes use the versioned model.

**Tech Stack:** Cloudflare Workers, D1/SQLite, JavaScript ES modules, Node test runner, React/Vite, Tailwind CSS, existing authenticated R2 attachment/evidence services.

---

## File Map

### Worker and database

- Create `worker/src/lib/quoteExecution.js`: pure quote, installment, receipt, start-gate, closure-gate, and workday calculations.
- Create `worker/tests/quote-execution-domain.test.mjs`: exhaustive pure-domain tests.
- Create `worker/migrations/041_quote_execution_baseline.sql`: quote snapshot fields, immutable schedules, operational installments, receipt claims, private receipt-evidence metadata, constraints, and indexes.
- Modify `worker/schema.sql`: mirror migration 041 and register it in `_migrations`.
- Create `worker/tests/quote-execution-sqlite.test.mjs`: apply schema to SQLite and verify constraints/legacy compatibility.
- Create `worker/tests/quote-execution-api.test.mjs`: request-level quote, activation, collection, receipt, start, and archive tests.
- Modify `worker/src/index.js`: wire quote version submission/review/confirmation, detail projections, collection APIs, Admin receipt decisions, workday allowance, start/archive gates, notifications, and CN localization.
- Modify `worker/package.json`: include the new domain, SQLite, and API tests in the normal Worker suite.
- Modify `worker/tests/routes.test.mjs`: document the new protected route contracts.
- Modify `worker/tests/payment-approval-flow.test.mjs`: replace fixed advance/balance expectations for new quotes while retaining legacy coverage.
- Modify `worker/tests/field-work-domain.test.mjs`: cover quote-derived allowance and actual-workday counting.
- Modify `worker/tests/field-work-api.test.mjs`: cover check-in blocking at exhausted allowance and hybrid activation.

### Engineer and customer frontend

- Modify `frontend/src/components/WorkOrder/pricingDraft.js`: draft normalization and exact schedule-total helpers.
- Modify `frontend/tests/pricing-draft.test.mjs`: draft and payment-plan unit tests.
- Create `frontend/src/components/WorkOrder/PaymentScheduleEditor.jsx`: engineer installment editor.
- Create `frontend/src/components/WorkOrder/PaymentScheduleSummary.jsx`: shared customer/engineer schedule and balance view.
- Create `frontend/src/components/WorkOrder/CollectionPanel.jsx`: engineer collection and receipt-claim actions.
- Modify `frontend/src/components/WorkOrder/PricingPanels.jsx`: conditional workday field, schedule editor, and unified customer confirmation.
- Modify `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`: collection tab/action and outstanding-balance status.
- Modify `frontend/src/components/WorkOrder/FieldWorkPanel.jsx`: allowance summary, extension-only overflow path, and localized time-zone display.
- Modify `frontend/src/components/Payment/PaymentModal.jsx`: operate on one installment instead of the old fixed stage.
- Modify `frontend/src/services/api.js`: installment collection and receipt-claim calls.
- Create `frontend/tests/quote-execution-contract.test.mjs`: component/API/copy contract tests.
- Modify `frontend/tests/pricing-panels-copy.test.mjs`: payment and workday bilingual copy.
- Modify `frontend/tests/field-work-contract.test.mjs`: quote allowance and localized time-zone contracts.

### Admin

- Create `admin/src/components/QuoteExecutionAdminPanel.jsx`: combined quote/workday/payment-plan review and receipt decisions.
- Create `admin/src/components/QuoteExecutionAdminPanel.test.mjs`: Admin panel behavior and copy contracts.
- Modify `admin/src/pages/WorkOrdersPage.jsx`: use the focused panel and show payment-state indicators.
- Modify `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`: enforce detail-only review and receipt permissions.
- Modify `admin/src/components/FieldWorkAdminPanel.jsx`: replace normal plan editing with quote-baseline summary while retaining exception controls.
- Modify `admin/src/components/FieldWorkAdminPanel.test.mjs`: updated responsibility and localized time-zone assertions.
- Modify `admin/src/services/api.js`: quote review and receipt-decision API calls.
- Modify `admin/package.json`: include the new Admin component test.

### End-to-end and operations

- Create `worker/scripts/quote-execution-production-smoke.mjs`: three-role temporary-data smoke with guaranteed cleanup.
- Create `worker/tests/quote-execution-production-smoke-script.test.mjs`: static safety contract for the smoke script.
- Modify `worker/package.json`: expose the smoke command and include its safety test.
- Modify `DEPLOY.md`: migration 041 order, COM/CN verification queries, deployment order, and rollback boundary.

## API Contract

Keep existing quote endpoints and extend their payloads. Add installment-specific actions:

```text
POST /api/workorders/:id/pricing
  { fees..., expected_service_days, payment_plan_mode, payment_schedule[] }

POST /api/workorders/:id/pricing/confirm
  { quote_version }

POST /api/workorders/:id/installments/:installmentId/collect
  { note }

POST /api/workorders/:id/installments/:installmentId/payment-method
  { payment_method }

POST /api/workorders/:id/installments/:installmentId/receipt-claims
  multipart { claimed_amount, transaction_reference, evidence?, note, idempotency_key }

GET /api/workorders/:id/receipt-evidence/:evidenceId
  authenticated private stream

POST /api/admin/workorders/:id/installments/:installmentId/receipt-claims/:claimId/decision
  { decision: "confirmed" | "rejected", confirmed_amount, reason, idempotency_key }
```

Every work-order detail returns:

```js
{
  quote_execution: {
    quote_version: 3,
    payment_plan_mode: 'installments',
    expected_service_days: 4,
    initial_workdays: 4,
    approved_extension_days: 1,
    consumed_workdays: 2,
    remaining_workdays: 3,
    total_amount: 12000,
    received_amount: 5000,
    outstanding_amount: 7000,
    payment_state: 'partially_received',
    start_ready: true,
    financially_settled: false,
    installments: [],
  },
}
```

## Task 1: Pure Quote-Execution Domain

**Files:**
- Create: `worker/src/lib/quoteExecution.js`
- Create: `worker/tests/quote-execution-domain.test.mjs`
- Modify: `worker/package.json`

- [ ] **Step 1: Write failing tests for the default schedule and service-day rules**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultPaymentSchedule,
  validateQuoteExecution,
} from '../src/lib/quoteExecution.js';

test('default quote is one 100% before-start installment', () => {
  assert.deepEqual(buildDefaultPaymentSchedule(12000, 'CNY'), [{
    sequence: 1,
    amount: 12000,
    currency: 'CNY',
    trigger_type: 'before_start',
    due_date: null,
    description: '',
    required_before_start: true,
  }]);
});

test('onsite and hybrid require workdays while remote clears them', () => {
  assert.equal(validateQuoteExecution({ service_mode: 'onsite', total_amount: 100, expected_service_days: null }).code, 'expected_service_days_required');
  assert.equal(validateQuoteExecution({ service_mode: 'hybrid', total_amount: 100, expected_service_days: 0 }).code, 'expected_service_days_required');
  assert.equal(validateQuoteExecution({ service_mode: 'remote', total_amount: 100, expected_service_days: 9 }).value.expected_service_days, null);
});
```

- [ ] **Step 2: Run the domain test and verify the missing module failure**

Run: `cd worker && node --test tests/quote-execution-domain.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/quoteExecution.js`.

- [ ] **Step 3: Implement schedule normalization and deterministic validation**

```js
export const PAYMENT_TRIGGER_TYPES = new Set([
  'before_start', 'on_arrival', 'milestone', 'on_completion', 'on_acceptance', 'fixed_date',
]);

export function buildDefaultPaymentSchedule(totalAmount, currency) {
  return [{ sequence: 1, amount: totalAmount, currency, trigger_type: 'before_start', due_date: null, description: '', required_before_start: true }];
}

export function validateQuoteExecution(input) {
  const total = Number(input.total_amount);
  const onsiteDays = Number(input.expected_service_days);
  if (['onsite', 'hybrid'].includes(input.service_mode) && (!Number.isInteger(onsiteDays) || onsiteDays < 1)) {
    return { code: 'expected_service_days_required' };
  }
  const schedule = input.payment_plan_mode === 'installments'
    ? input.payment_schedule
    : buildDefaultPaymentSchedule(total, input.currency);
  // Normalize each line, validate count/amount/trigger/date/sequence/start gate,
  // and require the integer-minor-unit sum to equal total exactly.
  return { value: { expected_service_days: input.service_mode === 'remote' ? null : onsiteDays, payment_schedule: schedule } };
}
```

Use integer minor units already used by the quote tables. Do not introduce floating-point comparisons.

- [ ] **Step 4: Add failing tests for schedule errors and derived execution state**

Cover 1-line custom plans, 7 lines, non-positive amounts, duplicate sequence, unknown trigger, milestone without description, fixed date without date, mismatched total, no start prerequisite, partial receipts, all prerequisite installments received, outstanding balance, and consumed distinct reported dates.

```js
assert.deepEqual(summarizeQuoteExecution({
  total_amount: 10000,
  installments: [{ amount: 4000, received_amount: 4000, required_before_start: 1 }, { amount: 6000, received_amount: 1000, required_before_start: 0 }],
  initial_workdays: 3,
  extension_days: 1,
  reported_dates: ['2026-07-24', '2026-07-24', '2026-07-25'],
}), {
  received_amount: 5000,
  outstanding_amount: 5000,
  start_ready: true,
  financially_settled: false,
  consumed_workdays: 2,
  remaining_workdays: 2,
});
```

- [ ] **Step 5: Implement state, gate, and time-zone helpers**

Export:

```js
validatePaymentSchedule(schedule, { totalAmount, currency })
deriveInstallmentState(installment, now)
summarizeQuoteExecution(input)
canCreateFieldDay(summary)
canFinanciallyArchive(summary)
formatSiteTimezone(timezone, market)
```

`formatSiteTimezone('Asia/Shanghai', 'cn')` must return `中国标准时间（上海）`; unknown valid identifiers return their identifier rather than a false localized name.

- [ ] **Step 6: Run the focused tests**

Run: `cd worker && node --test tests/quote-execution-domain.test.mjs`

Expected: PASS.

- [ ] **Step 7: Register the test and commit**

Add `tests/quote-execution-domain.test.mjs` to `test:unit` and `test`, then rerun the focused command from Step 6.

```bash
git add worker/src/lib/quoteExecution.js worker/tests/quote-execution-domain.test.mjs worker/package.json
git commit -m "feat(worker): add quote execution domain rules"
```

## Task 2: Migration 041 And SQLite Constraints

**Files:**
- Create: `worker/migrations/041_quote_execution_baseline.sql`
- Create: `worker/tests/quote-execution-sqlite.test.mjs`
- Modify: `worker/schema.sql`
- Modify: `worker/package.json`

- [ ] **Step 1: Write a failing SQLite migration test**

Use the existing `field-work-sqlite.test.mjs` harness pattern. Assert that applying schema plus migration 041 creates:

```text
work_order_payment_schedule
work_order_installments
work_order_receipt_claims
work_order_receipt_evidence
```

Also assert unique `(pricing_id, quote_version, sequence)`, unique receipt idempotency key, positive scheduled/claimed amounts, one evidence record per object key, and rejection of duplicate operational installment sequence.

- [ ] **Step 2: Run the SQLite test and verify missing-table failure**

Run: `cd worker && node --test tests/quote-execution-sqlite.test.mjs`

Expected: FAIL because migration 041 and its tables do not exist.

- [ ] **Step 3: Add the forward-only migration**

Use these columns and constraints:

```sql
ALTER TABLE work_order_pricing ADD COLUMN quote_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE work_order_pricing ADD COLUMN expected_service_days INTEGER;
ALTER TABLE work_order_pricing ADD COLUMN payment_plan_mode TEXT NOT NULL DEFAULT 'single';

ALTER TABLE work_order_pricing_history ADD COLUMN expected_service_days INTEGER;
ALTER TABLE work_order_pricing_history ADD COLUMN payment_plan_mode TEXT NOT NULL DEFAULT 'single';
ALTER TABLE work_order_pricing_history ADD COLUMN quote_kind TEXT NOT NULL DEFAULT 'baseline';
ALTER TABLE work_order_pricing_history ADD COLUMN parent_quote_version INTEGER;
ALTER TABLE work_order_pricing_history ADD COLUMN status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE work_order_pricing_history ADD COLUMN approved_at TEXT;
ALTER TABLE work_order_pricing_history ADD COLUMN confirmed_at TEXT;

ALTER TABLE work_orders ADD COLUMN quote_expected_service_days INTEGER;
ALTER TABLE work_orders ADD COLUMN approved_extension_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN active_quote_version INTEGER;

CREATE TABLE work_order_payment_schedule (
  id TEXT PRIMARY KEY,
  pricing_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  quote_version INTEGER NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 6),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('before_start','on_arrival','milestone','on_completion','on_acceptance','fixed_date')),
  due_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  required_before_start INTEGER NOT NULL DEFAULT 0 CHECK (required_before_start IN (0,1)),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (pricing_id, quote_version, sequence)
);

CREATE TABLE work_order_installments (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL UNIQUE,
  work_order_id TEXT NOT NULL,
  quote_version INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  due_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  required_before_start INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled',
  payment_method TEXT,
  collection_started_at TEXT,
  received_amount INTEGER NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (work_order_id, quote_version, sequence)
);

CREATE TABLE work_order_receipt_claims (
  id TEXT PRIMARY KEY,
  installment_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  claimed_amount INTEGER NOT NULL CHECK (claimed_amount > 0),
  transaction_reference TEXT,
  engineer_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  confirmed_amount INTEGER CHECK (confirmed_amount >= 0),
  decision_reason TEXT,
  decided_by TEXT,
  decided_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  decision_idempotency_key TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE work_order_receipt_evidence (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  uploader_type TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Add foreign keys and indexes for work-order/version/status queries, plus `_migrations` entry `041_quote_execution_baseline`. Receipt evidence uses the already configured private `FIELD_EVIDENCE` R2 binding; do not add or modify a Wrangler binding.

After adding the history columns, update only future submissions to `pending_review`; leave migrated rows as `legacy`. Do not backfill approval/confirmation timestamps or actor identities.

- [ ] **Step 4: Mirror the schema and add legacy projection assertions**

Update `worker/schema.sql` with identical columns/tables. In SQLite tests, insert a historical confirmed quote with no schedule and an old `work_order_payments` record; assert the data remains queryable and is not rewritten with fabricated Admin metadata.

- [ ] **Step 5: Run focused migration tests**

Run: `cd worker && node --test tests/quote-execution-sqlite.test.mjs tests/d1-operations.test.mjs`

Expected: PASS.

- [ ] **Step 6: Register and commit**

Add the SQLite test to `pretest`, then:

```bash
git add worker/migrations/041_quote_execution_baseline.sql worker/schema.sql worker/tests/quote-execution-sqlite.test.mjs worker/package.json
git commit -m "feat(db): add quote execution baseline schema"
```

## Task 3: Versioned Quote Submission And Admin Review

**Files:**
- Create: `worker/tests/quote-execution-api.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `worker/package.json`

- [ ] **Step 1: Add failing request tests for submission**

Build the same lightweight D1/request harness used by `payment-approval-flow.test.mjs`. Test:

```js
await submitQuote({
  service_mode: 'onsite',
  labor_fee: 9000,
  parts_fee: 2000,
  travel_fee: 1000,
  expected_service_days: 3,
  payment_plan_mode: 'installments',
  payment_schedule: [
    { sequence: 1, amount: 6000, trigger_type: 'before_start', required_before_start: true, description: '开工款' },
    { sequence: 2, amount: 6000, trigger_type: 'on_acceptance', required_before_start: false, description: '验收款' },
  ],
});
```

Assert quote version `1`, two immutable schedule rows, pending review, and one audit snapshot containing version/workdays/payment mode.

- [ ] **Step 2: Run and verify payload is not persisted**

Run: `cd worker && node --test tests/quote-execution-api.test.mjs`

Expected: FAIL because expected days and payment schedule are ignored.

- [ ] **Step 3: Wire domain validation and atomic version submission**

In `handleSubmitWorkOrderPricing`:

```js
const validation = validateQuoteExecution({
  service_mode: wo.service_mode,
  total_amount: subtotal,
  expected_service_days: body.expected_service_days,
  payment_plan_mode: body.payment_plan_mode,
  payment_schedule: body.payment_schedule,
  currency: market === 'cn' ? 'CNY' : 'USD',
});
if (validation.code) return quoteExecutionError(validation.code, market);
```

Compute `nextVersion` once. Use `env.DB.batch` for pricing projection, pricing-history snapshot, schedule inserts, work-order review state, and audit statement. Delete only draft/pending schedule rows for the new version on a safe retry; never mutate an approved/confirmed version.

- [ ] **Step 4: Add failing Admin review tests**

Assert Admin approval approves the exact version and returns its fees/workdays/schedule; rejection requires a reason and returns that version to engineer correction. A stale action carrying the wrong `quote_version` must return `409`.

Also assert a baseline quote cannot be replaced after any confirmed receipt. In that state, additional parts or expanded scope must be submitted with `quote_kind: 'supplemental'` and `parent_quote_version` equal to the active baseline version; it receives its own Admin approval, customer confirmation, schedule, and receipts without changing the baseline rows.

- [ ] **Step 5: Implement version-aware Admin review**

Require `{ quote_version, note }` in the review body. Include the complete schedule in the Admin detail response and in the audit before/after state. Localize messages using `getRequestMarket` instead of hard-coded Chinese strings.

Persist submitted version status on `work_order_pricing_history`. The mutable `work_order_pricing` row remains a compatibility projection of the latest version, while review and confirmation target the immutable history version. Supplemental versions add to the active commercial total and must never overwrite baseline fee or receipt history.

Insert each new immutable history row explicitly with `status = 'pending_review'`; do not rely on the `legacy` column default reserved for migrated rows.

- [ ] **Step 6: Run API tests and commit**

Run: `cd worker && node --test tests/quote-execution-api.test.mjs`

Expected: submission and Admin review tests PASS.

```bash
git add worker/src/index.js worker/tests/quote-execution-api.test.mjs worker/package.json
git commit -m "feat(worker): version quote execution terms"
```

## Task 4: Customer Activation And Legacy Projection

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/quote-execution-api.test.mjs`
- Modify: `worker/tests/payment-approval-flow.test.mjs`

- [ ] **Step 1: Add failing customer-confirmation tests**

Assert confirmation requires the approved current version, atomically:

- marks it confirmed;
- sets `active_quote_version`;
- copies onsite workdays to `quote_expected_service_days` and normal execution projection;
- leaves hybrid allowance dormant while `service_mode = 'hybrid'`;
- creates one operational installment per schedule row;
- marks every `before_start` installment `due`;
- keeps other installments `scheduled`;
- returns `409` for stale version retries without duplicate installments.

- [ ] **Step 2: Run and verify activation failure**

Run: `cd worker && node --test tests/quote-execution-api.test.mjs`

Expected: FAIL because confirmation does not create installment records.

- [ ] **Step 3: Implement transactional activation**

Use one D1 batch guarded by `WHERE quote_version = ? AND status = 'submitted'`. Follow it with a changes assertion in the batch, matching established atomic-guard patterns. Insert installments with deterministic IDs or unique schedule IDs so retries are idempotent.

- [ ] **Step 4: Add and implement normalized detail projection**

Add a loader in `index.js` that returns `quote_execution` for all roles. For new quotes it reads schedules/installments/claims and calls `summarizeQuoteExecution`. For historical quotes without schedule rows it projects one legacy installment from the quote total and existing `work_order_payments` without creating new rows or Admin identities.

- [ ] **Step 5: Retain explicit legacy tests**

Update `payment-approval-flow.test.mjs` so fixed advance/balance behavior is tested only for pre-041 quotes. Add an assertion that new quote version `>= 1` never calls `computeServicePaymentPolicy`.

- [ ] **Step 6: Run and commit**

Run: `cd worker && node --test tests/quote-execution-api.test.mjs tests/payment-approval-flow.test.mjs`

Expected: PASS.

```bash
git add worker/src/index.js worker/tests/quote-execution-api.test.mjs worker/tests/payment-approval-flow.test.mjs
git commit -m "feat(worker): activate confirmed quote schedules"
```

## Task 5: Installment Collection And Admin Receipt Decisions

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/quote-execution-api.test.mjs`
- Modify: `worker/tests/routes.test.mjs`

- [ ] **Step 1: Add failing authorization and lifecycle tests**

Test the new collection routes for:

- only the assigned engineer can start collection;
- only the owning customer can choose or change the payment method for an open installment;
- only `due`, `partially_received`, or `overdue` installments can be collected;
- customer ownership is enforced when payment method is selected;
- receipt claim requires a positive amount and idempotency key, and accepts an optional image/PDF evidence file through multipart upload;
- receipt evidence is accessible only to the owning customer, assigned engineer, and authorized Admin staff through the protected stream route;
- evidence upload failure leaves no claim, and a D1 failure after upload deletes the private object or queues it in `field_evidence_cleanup_queue`;
- Admin can confirm a full or partial amount;
- duplicate Admin decision idempotency key does not increment twice;
- over-confirmation is rejected;
- rejection requires a reason and returns the installment to its prior collection state;
- all actions write audit records and market-aware notifications.

- [ ] **Step 2: Run and verify missing-route failures**

Run: `cd worker && node --test tests/quote-execution-api.test.mjs`

Expected: FAIL with route not found or unchanged installment state.

- [ ] **Step 3: Implement collection and receipt-claim handlers**

Add handlers named:

```js
handleStartInstallmentCollection
handleSelectInstallmentPaymentMethod
handleSubmitReceiptClaim
handleAdminDecideReceiptClaim
```

Validate evidence MIME type and size before uploading it to `FIELD_EVIDENCE`. Insert `work_order_receipt_evidence` in the same logical operation as the claim; if D1 fails, delete the uploaded object and use the existing cleanup queue when deletion cannot be confirmed. The private stream handler derives authorization from the work order and never returns an R2 URL. Use a conditional update:

```sql
UPDATE work_order_installments
SET received_amount = received_amount + ?, updated_at = datetime('now')
WHERE id = ? AND received_amount + ? <= amount
```

The same D1 batch must update the claim decision, installment amount/status, audit log, and any state transition. Assert exactly one decision row changed.

- [ ] **Step 4: Add route classification assertions**

Add exact examples for collect, receipt claim, receipt-evidence stream, and Admin decision paths to `routes.test.mjs`; all remain protected through the existing `/api/workorders/` and `/api/admin/` classifiers.

- [ ] **Step 5: Run and commit**

Run: `cd worker && node --test tests/quote-execution-api.test.mjs tests/routes.test.mjs`

Expected: PASS.

```bash
git add worker/src/index.js worker/tests/quote-execution-api.test.mjs worker/tests/routes.test.mjs
git commit -m "feat(worker): add installment receipt workflow"
```

## Task 6: Start, Completion, Archive, And Workday Gates

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/src/lib/field-work.js`
- Modify: `worker/tests/quote-execution-api.test.mjs`
- Modify: `worker/tests/field-work-domain.test.mjs`
- Modify: `worker/tests/field-work-api.test.mjs`

- [ ] **Step 1: Add failing start and archive tests**

Assert:

```js
assert.equal(summary.start_ready, false); // one prerequisite still partial
assert.equal(summary.financially_settled, false); // later milestone unpaid
```

The engineer start request must fail until all prerequisite installments are received. Admin financial archive must fail while any active installment has a remaining balance. Final service completion remains allowed with an outstanding later installment.

- [ ] **Step 2: Add failing workday allowance tests**

Cover distinct `report_submitted` and `late_report_submitted` local dates, exclude `checked_in`, `report_overdue`, revisions, and duplicates, and assert the next check-in is blocked when consumed equals initial plus approved extension days.

- [ ] **Step 3: Implement independent payment and service gates**

Replace new-quote uses of advance/balance stage checks with `quote_execution.start_ready` and `quote_execution.financially_settled`. Do not add new overloaded values to `work_orders.status`; expose `payment_state` independently in detail/list responses.

- [ ] **Step 4: Implement quote-derived field allowance**

Add to `field-work.js`:

```js
export function countConsumedFieldDays(fieldDays) {
  return new Set(fieldDays
    .filter((day) => ['report_submitted', 'late_report_submitted'].includes(day.status))
    .map((day) => day.site_local_date)).size;
}
```

Before normal check-in, load the active quote allowance plus approved extension days. Return `409 workday_allowance_exhausted` when full. On extension approval, increment `approved_extension_days`; do not mutate pricing or payment rows. On hybrid-to-onsite confirmation, copy the dormant active quote allowance into the executable projection.

- [ ] **Step 5: Remove normal Admin plan mutation for new quotes**

Keep `PATCH /field-plan` only for legacy records and audited exceptions. For an active quote version, return `409 quote_driven_field_plan`; expected days cannot be manually overwritten.

- [ ] **Step 6: Run and commit**

Run: `cd worker && node --test tests/quote-execution-api.test.mjs tests/field-work-domain.test.mjs tests/field-work-api.test.mjs`

Expected: PASS.

```bash
git add worker/src/index.js worker/src/lib/field-work.js worker/tests/quote-execution-api.test.mjs worker/tests/field-work-domain.test.mjs worker/tests/field-work-api.test.mjs
git commit -m "feat(worker): enforce payment and workday gates"
```

## Task 7: Engineer Quote Editor And Customer Confirmation

**Files:**
- Modify: `frontend/src/components/WorkOrder/pricingDraft.js`
- Modify: `frontend/tests/pricing-draft.test.mjs`
- Create: `frontend/src/components/WorkOrder/PaymentScheduleEditor.jsx`
- Create: `frontend/src/components/WorkOrder/PaymentScheduleSummary.jsx`
- Modify: `frontend/src/components/WorkOrder/PricingPanels.jsx`
- Modify: `frontend/tests/pricing-panels-copy.test.mjs`
- Create: `frontend/tests/quote-execution-contract.test.mjs`

- [ ] **Step 1: Write failing draft helper tests**

```js
assert.deepEqual(createDefaultPricingForm(), {
  labor_fee: '', parts_fee: '', travel_fee: '', other_fee: '', other_fee_note: '',
  expected_service_days: '',
  payment_plan_mode: 'single',
  payment_schedule: [],
});

assert.deepEqual(scheduleTotals([{ amount: '6000' }, { amount: '4000' }], 10000), {
  scheduled: 10000, difference: 0,
});
```

Also test quote-to-form hydration and remote-mode clearing.

- [ ] **Step 2: Run and verify helper failures**

Run: `cd frontend && node --test tests/pricing-draft.test.mjs`

Expected: FAIL because schedule fields/helpers are missing.

- [ ] **Step 3: Implement minimal draft helpers**

Keep string values in React form state and convert to integer amounts only in `buildPricingPayload`. Export `createDefaultInstallment(sequence)` and `scheduleTotals` for testability.

- [ ] **Step 4: Write contract tests for the editor and summary**

Assert the editor:

- defaults to a segmented single/installment choice;
- permits 2–6 rows;
- uses icon buttons with accessible labels for add/remove/reorder;
- keeps amount and trigger controls in stable responsive grid tracks;
- renders a total/difference summary;
- uses `whitespace-nowrap` for compact action labels.

Assert the customer summary renders fees, expected onsite workdays, every installment, and one complete-version confirmation action.

- [ ] **Step 5: Implement the focused components and integrate them**

`PricingPanels.jsx` passes `serviceMode`, total, form schedule, and localized copy to `PaymentScheduleEditor`. Show expected days only for `onsite`/`hybrid`. Include `quote_version` when the customer confirms. Disable submit/confirm while totals or required fields are invalid. The editor uses existing Lucide icons for row actions and tooltips/accessible labels for unfamiliar controls.

- [ ] **Step 6: Run frontend tests and commit**

Run:

```bash
cd frontend
node --test tests/pricing-draft.test.mjs tests/pricing-panels-copy.test.mjs tests/quote-execution-contract.test.mjs
```

Expected: PASS.

```bash
git add frontend/src/components/WorkOrder/pricingDraft.js frontend/src/components/WorkOrder/PaymentScheduleEditor.jsx frontend/src/components/WorkOrder/PaymentScheduleSummary.jsx frontend/src/components/WorkOrder/PricingPanels.jsx frontend/tests/pricing-draft.test.mjs frontend/tests/pricing-panels-copy.test.mjs frontend/tests/quote-execution-contract.test.mjs
git commit -m "feat(frontend): add quote workdays and payment plans"
```

## Task 8: Collection Workspace And Customer Payment Interaction

**Files:**
- Create: `frontend/src/components/WorkOrder/CollectionPanel.jsx`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `frontend/src/components/Payment/PaymentModal.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/tests/quote-execution-contract.test.mjs`

- [ ] **Step 1: Add failing API and UI contract tests**

Assert API functions use installment IDs, not `payment_stage`:

```js
startInstallmentCollection(workOrderId, installmentId, { note })
selectInstallmentPaymentMethod(workOrderId, installmentId, { payment_method })
submitInstallmentReceiptClaim(workOrderId, installmentId, payload)
```

Assert due/partial/overdue installments render collection actions, received installments are read-only, pending claims show waiting state, and outstanding collection remains accessible after service completion.

- [ ] **Step 2: Run and verify missing component/API failures**

Run: `cd frontend && node --test tests/quote-execution-contract.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement installment collection APIs and panel**

The engineer's `发起本期收款` action opens the installment without selecting a customer payment method. Reuse `PaymentModal` on the customer side and pass `{ installmentId, amount, trigger }`; the customer selects the method for that installment. Do not compute advance/balance locally. `CollectionPanel` accepts normalized `quote_execution`, opens due installments, and submits receipt claim amount/reference/optional image-or-PDF evidence/note/idempotency key as `FormData`.

- [ ] **Step 4: Integrate independent service/payment status**

In `WorkOrderDetailModal`, show a compact status line such as `服务已完成 · 待收尾款` / `Service complete · Payment outstanding`. Keep collection available in `resolved`, `pending_review`, and `completed` when `financially_settled` is false.

- [ ] **Step 5: Run and commit**

Run: `cd frontend && node --test tests/quote-execution-contract.test.mjs tests/cookie-auth-contract.test.mjs`

Expected: PASS.

```bash
git add frontend/src/components/WorkOrder/CollectionPanel.jsx frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/src/components/Payment/PaymentModal.jsx frontend/src/services/api.js frontend/tests/quote-execution-contract.test.mjs
git commit -m "feat(frontend): add installment collection workspace"
```

## Task 9: Admin Combined Review And Receipt Operations

**Files:**
- Create: `admin/src/components/QuoteExecutionAdminPanel.jsx`
- Create: `admin/src/components/QuoteExecutionAdminPanel.test.mjs`
- Modify: `admin/src/pages/WorkOrdersPage.jsx`
- Modify: `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`
- Modify: `admin/src/services/api.js`
- Modify: `admin/package.json`

- [ ] **Step 1: Write failing Admin component tests**

Assert the panel shows:

- fee lines, quote version, expected onsite days, and full payment schedule before approval;
- approve and return actions only inside the detail drawer;
- each pending receipt claim with scheduled, previously received, claimed, remaining, evidence/reference, and engineer note;
- separate full/partial confirm and reject actions;
- mandatory rejection/adjustment reason;
- read-only behavior for operations staff;
- English and Chinese copy with no raw enum labels.

- [ ] **Step 2: Run and verify missing panel failure**

Run: `cd admin && node --test src/components/QuoteExecutionAdminPanel.test.mjs`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Add Admin API functions**

```js
export function reviewWorkOrderQuote(workOrderId, action, quoteVersion, note) { /* existing route, versioned body */ }
export function decideInstallmentReceipt(workOrderId, installmentId, claimId, payload) { /* POST decision route */ }
```

- [ ] **Step 4: Implement and integrate the panel**

Keep `WorkOrdersPage` responsible for drawer/list loading only. Pass `detail`, `readOnly`, and `onRefresh` to the panel. Use the existing controlled operation dialog pattern; do not introduce `window.prompt`.

- [ ] **Step 5: Add payment-state list indicators**

Admin list/detail displays `payment_state`, received amount, outstanding amount, and pending receipt-review count without replacing service status.

- [ ] **Step 6: Register tests, run, and commit**

Run: `cd admin && npm test`

Expected: PASS.

```bash
git add admin/src/components/QuoteExecutionAdminPanel.jsx admin/src/components/QuoteExecutionAdminPanel.test.mjs admin/src/pages/WorkOrdersPage.jsx admin/src/pages/WorkOrdersPage.review-flow.test.mjs admin/src/services/api.js admin/package.json
git commit -m "feat(admin): review quote execution and receipts"
```

## Task 10: Quote-Derived Field Plan And China Localization

**Files:**
- Modify: `frontend/src/components/WorkOrder/FieldWorkPanel.jsx`
- Modify: `frontend/tests/field-work-contract.test.mjs`
- Modify: `admin/src/components/FieldWorkAdminPanel.jsx`
- Modify: `admin/src/components/FieldWorkAdminPanel.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `worker/tests/work-order-language.test.mjs`

- [ ] **Step 1: Add failing field-plan responsibility tests**

Assert new quote-driven orders display:

```text
报价审核工期 / Approved quote duration
预计现场作业 3 天 / 3 expected onsite workdays
已使用 2 天 / 2 used
剩余 1 天 / 1 remaining
```

Assert Admin normal plan inputs/save button are absent for an active quote version, while extension, correction, override, and evidence-hold controls remain.

- [ ] **Step 2: Add failing localization tests**

Assert China copy contains `工程师已到场签到`, `工程师已为工单`, `现场时区`, and `中国标准时间（上海）`, and does not expose `Engineer checked in`, `IANA 时区`, or raw `Asia/Shanghai` in normal timeline labels.

- [ ] **Step 3: Run and verify failures**

Run:

```bash
cd worker && node --test tests/work-order-language.test.mjs
cd ../frontend && node --test tests/field-work-contract.test.mjs
cd ../admin && node --test src/components/FieldWorkAdminPanel.test.mjs
```

Expected: FAIL on old Admin inputs and English/raw time-zone copy.

- [ ] **Step 4: Implement summary-only normal plan UI**

Use `quote_execution` for all counters. Retain legacy editable plan only when `active_quote_version` is null. Explain extension as time-only and route exhausted allowance to the existing extension request form.

- [ ] **Step 5: Localize Worker notifications and timezone labels**

Replace the hard-coded check-in notification with market-aware copy and use `formatSiteTimezone` in role-facing detail projections. Keep raw `site_timezone` separately for date formatting and technical audit.

- [ ] **Step 6: Run and commit**

Run the three focused commands from Step 3.

Expected: PASS.

```bash
git add worker/src/index.js worker/tests/work-order-language.test.mjs frontend/src/components/WorkOrder/FieldWorkPanel.jsx frontend/tests/field-work-contract.test.mjs admin/src/components/FieldWorkAdminPanel.jsx admin/src/components/FieldWorkAdminPanel.test.mjs
git commit -m "feat(field-work): derive plan from confirmed quote"
```

## Task 11: Full Verification, Production Smoke, And Deployment Runbook

**Files:**
- Create: `worker/scripts/quote-execution-production-smoke.mjs`
- Create: `worker/tests/quote-execution-production-smoke-script.test.mjs`
- Modify: `worker/package.json`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Write the smoke-script safety test first**

Follow existing production smoke contracts. Assert the script:

- requires explicit base URL and test credentials;
- creates uniquely prefixed customer, engineer, work order, quote, installments, receipt claims, and field days;
- exercises Admin approval, customer confirmation, partial/final receipts, start gate, field-day allowance, outstanding-balance closure gate, and final archive;
- uses `try/finally` cleanup scoped only to generated IDs;
- never deletes by broad email/name/status predicates;
- prints a concise COM/CN result summary without secrets.

- [ ] **Step 2: Run and verify the missing-script failure**

Run: `cd worker && node --test tests/quote-execution-production-smoke-script.test.mjs`

Expected: FAIL because the script is absent.

- [ ] **Step 3: Implement the smoke script and command**

Add:

```json
"smoke:production:quote-execution": "node scripts/quote-execution-production-smoke.mjs"
```

Do not automatically run the production smoke from CI because it requires production credentials and creates temporary records.

- [ ] **Step 4: Document migration and coordinated rollout**

Add exact commands to `DEPLOY.md`:

```bash
cd worker
npx wrangler d1 execute sagemro-db --env production --remote --file migrations/041_quote_execution_baseline.sql
npx wrangler d1 execute sagemro-db-cn --env production --remote --file migrations/041_quote_execution_baseline.sql
```

Document verification:

```sql
SELECT version FROM _migrations WHERE version = '041_quote_execution_baseline';
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('work_order_payment_schedule','work_order_installments','work_order_receipt_claims','work_order_receipt_evidence');
```

State clearly: migrate both D1 databases first, deploy shared Worker from `main`, deploy international clients, sync client changes to `china-edition`, then run the Aliyun ECS workflow.

- [ ] **Step 5: Run focused and full suites**

Run:

```bash
cd worker && npm test
cd ../frontend && npm run lint && npm test && npm run build
cd ../admin && npm test && npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Run browser verification before deployment**

Start unused local ports for frontend and Admin. With Playwright, verify desktop `1440x900` and mobile `390x844` for:

- engineer installment editor with six rows;
- customer complete quote confirmation;
- engineer partial-payment collection;
- Admin combined quote and receipt review;
- field-work allowance summary;
- no button text wrapping, horizontal overflow, raw `Asia/Shanghai`, or overlapping controls.

Capture screenshots and inspect canvas/page pixels for nonblank output. Fix any discovered defects and rerun relevant tests.

- [ ] **Step 7: Commit verification assets and runbook**

```bash
git add worker/scripts/quote-execution-production-smoke.mjs worker/tests/quote-execution-production-smoke-script.test.mjs worker/package.json DEPLOY.md
git commit -m "test: add quote execution production verification"
```

- [ ] **Step 8: Pre-deployment migration gate**

Before any Worker deployment, run the two `_migrations` queries against COM and CN. Stop if either database lacks `041_quote_execution_baseline`; do not deploy code that reads the new tables.

- [ ] **Step 9: Deploy and smoke only after explicit release execution begins**

Push `main` implementation, wait for GitHub Actions test/deploy success, run COM production smoke, synchronize client-only commits to `china-edition`, push it, manually trigger `aliyun-cn-deploy.yml --ref china-edition`, wait for success, then run CN production smoke. Report URLs, migration verification, commit SHAs, and smoke results.
