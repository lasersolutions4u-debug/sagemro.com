# Onsite Workday Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private photo-first daily field-work records, daily reports, extension approval, reminders, and multi-day completion controls to onsite SAGEMRO work orders.

**Architecture:** Keep `work_orders` as the project-level lifecycle and add structured field-day, media, extension, revision, and evidence-hold records. Put pure date/status/validation rules in `worker/src/lib/field-work.js`; keep authenticated HTTP orchestration in the existing Worker router; store protected photos in a new private R2 binding and stream them only through authorized Worker routes. Add one focused `FieldWorkPanel` to the existing work-order modal and one focused Admin section rather than expanding the legacy arrival widget further.

**Tech Stack:** Cloudflare Workers, D1, private R2, scheduled Workers, React 19, Vite 8, Node test runner, Playwright.

## Global Constraints

- Normal check-in uses a live `getUserMedia` camera flow and never exposes a gallery/file picker for the check-in photo.
- Browser location is optional supporting evidence and never blocks a valid photo check-in.
- Daily reports are customer visible by default; internal notes and internal media are never returned to customers.
- Missed reports do not block the next day's check-in, but all open/overdue days block final service-report submission.
- Admin owns the approved site time zone, expected service days, expected completion date, and extension decisions.
- Check-in and daily-report media use a new private R2 bucket and are never served through `R2_PUBLIC_HOST`.
- No facial recognition, liveness scoring, identity matching, or biometric feature extraction.
- Protected media is eligible for deletion 12 months after final completion unless an evidence hold is open.
- Keep legacy arrival records compatible; do not rewrite historical records.
- Apply every schema migration to both `sagemro-db` and `sagemro-db-cn` before Worker deployment.
- International and China editions must expose equivalent behavior with localized copy.
- Do not add SMS, email reminders, payroll calculations, continuous GPS tracking, customer daily signatures, or multi-engineer crew attendance in this release.

---

## File Structure

### New files

- `worker/migrations/039_field_workdays.sql`: D1 schema and migration marker.
- `worker/src/lib/field-work.js`: site-local date calculation, status transitions, plan/report validation, visibility normalization, retention eligibility.
- `worker/tests/field-work-domain.test.mjs`: pure domain rules.
- `worker/tests/field-work-api.test.mjs`: route, authorization, storage, notification, closure, and scheduler contracts.
- `frontend/src/components/WorkOrder/FieldWorkPanel.jsx`: engineer/customer field-work UI, live camera capture, report form, timeline.
- `frontend/tests/field-work-contract.test.mjs`: frontend/API/camera/privacy contracts.
- `admin/src/components/FieldWorkAdminPanel.jsx`: plan, audit timeline, extension decisions, override, evidence hold controls.
- `admin/src/components/FieldWorkAdminPanel.test.mjs`: Admin contracts.
- `e2e/tests/onsite-multiday-lifecycle.spec.mjs`: two-day role-based lifecycle.

### Modified files

- `worker/schema.sql`: schema snapshot and migration marker.
- `worker/src/index.js`: authenticated handlers, role-filtered work-order responses, final-report gate, scheduled handler.
- `worker/wrangler.toml`: `FIELD_EVIDENCE` private R2 binding and `*/15 * * * *` trigger for development/production.
- `worker/tests/config.test.mjs`: schema/config/scheduler contracts.
- `worker/tests/routes.test.mjs`: new endpoint routing contracts.
- `frontend/src/services/api.js`: field-work multipart and JSON APIs.
- `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`: field-work tab and removal of location-only primary check-in UI.
- `frontend/src/components/common/LegalModal.jsx`: field-photo purpose, access, no-biometric-processing, retention text.
- `admin/src/services/api.js`: field-plan, extension, override, correction, hold APIs and authenticated media URL helper.
- `admin/src/pages/WorkOrdersPage.jsx`: list indicators and `FieldWorkAdminPanel` integration.
- `docs/legal/privacy-policy.md`: protected field evidence policy.
- `e2e/scripts/prepare-local-env.mjs`: local private R2 binding setup remains local-only.
- `e2e/tests/service-order-lifecycle.spec.mjs`: retain remote/default lifecycle while selecting service mode explicitly.

---

### Task 1: Field-Work Domain and D1 Schema

**Files:**
- Create: `worker/migrations/039_field_workdays.sql`
- Create: `worker/src/lib/field-work.js`
- Create: `worker/tests/field-work-domain.test.mjs`
- Modify: `worker/schema.sql`
- Modify: `worker/tests/config.test.mjs`
- Modify: `worker/migrations/README.md`

**Interfaces:**
- Produces `fieldDayLocalDate(now, timeZone) -> YYYY-MM-DD`.
- Produces `validateFieldPlan(input) -> { value } | { error }`.
- Produces `validateDailyReport(input, { overdue }) -> { value } | { error }`.
- Produces `fieldDayBlocksFinalReport(status) -> boolean`.
- Produces `mediaRetentionEligible({ completedAt, now, hasOpenHold }) -> boolean`.
- Produces tables used by all later tasks.

- [ ] **Step 1: Write failing domain and schema tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fieldDayBlocksFinalReport,
  fieldDayLocalDate,
  mediaRetentionEligible,
  validateDailyReport,
  validateFieldPlan,
} from '../src/lib/field-work.js';

test('uses the approved site time zone for the legal workday', () => {
  assert.equal(fieldDayLocalDate('2026-07-23T16:30:00Z', 'Asia/Shanghai'), '2026-07-24');
  assert.equal(fieldDayLocalDate('2026-07-23T16:30:00Z', 'America/Los_Angeles'), '2026-07-23');
});

test('daily reports require progress evidence and late reasons only when overdue', () => {
  assert.equal(validateDailyReport({ labor_hours: 8, progress_media_count: 0 }, { overdue: false }).error, 'progress_photo_required');
  assert.equal(validateDailyReport({ labor_hours: 8, progress_media_count: 1 }, { overdue: true }).error, 'late_reason_required');
});

test('open and overdue days block final closure', () => {
  assert.equal(fieldDayBlocksFinalReport('checked_in'), true);
  assert.equal(fieldDayBlocksFinalReport('report_overdue'), true);
  assert.equal(fieldDayBlocksFinalReport('report_submitted'), false);
});

test('retention requires 12 months and no evidence hold', () => {
  assert.equal(mediaRetentionEligible({ completedAt: '2025-07-01T00:00:00Z', now: '2026-07-02T00:00:00Z', hasOpenHold: false }), true);
  assert.equal(mediaRetentionEligible({ completedAt: '2025-07-01T00:00:00Z', now: '2026-07-02T00:00:00Z', hasOpenHold: true }), false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd worker && node --test tests/field-work-domain.test.mjs tests/config.test.mjs`

Expected: FAIL because `src/lib/field-work.js` and migration `039_field_workdays` do not exist.

- [ ] **Step 3: Add the migration and schema snapshot**

The migration adds plan columns to `work_orders` and creates:

```sql
CREATE TABLE IF NOT EXISTS work_order_field_days (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  site_local_date TEXT NOT NULL,
  site_timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'checked_in',
  check_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  expected_check_out_at TEXT,
  report_submitted_at TEXT,
  labor_hours REAL,
  completed_work TEXT,
  issues_risks TEXT,
  next_plan TEXT,
  customer_support_needed TEXT,
  internal_note TEXT,
  late_reason TEXT,
  location_status TEXT NOT NULL DEFAULT 'unavailable',
  latitude REAL,
  longitude REAL,
  accuracy_m REAL,
  coordinate_system TEXT,
  location_source TEXT,
  distance_m REAL,
  radius_m REAL,
  within_geofence INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(work_order_id, engineer_id, site_local_date),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
```

Also create `work_order_field_day_media`, `work_order_extension_requests`, `work_order_field_day_revisions`, and `work_order_field_evidence_holds` exactly as defined in the design, plus indexes for work-order/date/status, pending extensions, media retention, and open holds. Add reminder timestamps (`checkout_reminder_sent_at`, `overdue_notification_sent_at`) to field days and `privacy_retention_due_at` to media.

- [ ] **Step 4: Implement the pure domain module**

Use `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })` and `formatToParts` rather than parsing locale-formatted strings. Validate IANA zones by constructing the formatter. Bound service days to `1..365`, labor hours to `(0, 24]`, text to existing `cleanText` limits at the HTTP layer, and media counts to positive integers.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run: `cd worker && node --test tests/field-work-domain.test.mjs tests/config.test.mjs`

Expected: all selected tests pass and schema snapshot contains `039_field_workdays`.

- [ ] **Step 6: Commit**

```bash
git add worker/migrations/039_field_workdays.sql worker/migrations/README.md worker/schema.sql worker/src/lib/field-work.js worker/tests/field-work-domain.test.mjs worker/tests/config.test.mjs
git commit -m "feat(field-work): add daily onsite domain schema"
```

---

### Task 2: Private Media Storage and Photo Check-In API

**Files:**
- Modify: `worker/wrangler.toml`
- Modify: `worker/src/index.js`
- Create: `worker/tests/field-work-api.test.mjs`
- Modify: `worker/tests/routes.test.mjs`
- Modify: `worker/tests/wrangler-config.test.mjs`

**Interfaces:**
- Consumes Task 1 schema and domain helpers.
- Produces `POST /api/workorders/:id/field-days/check-in`.
- Produces `GET /api/workorders/:id/field-days`.
- Produces `GET /api/workorders/:id/field-media/:mediaId`.
- Produces private R2 binding `env.FIELD_EVIDENCE`.

- [ ] **Step 1: Write failing API/config tests**

Tests must assert:

```js
assert.match(config, /binding\s*=\s*"FIELD_EVIDENCE"/);
assert.match(config, /bucket_name\s*=\s*"sagemro-field-evidence"/);
assert.doesNotMatch(source, /FIELD_EVIDENCE[\s\S]*R2_PUBLIC_HOST/);
assert.match(source, /handleFieldDayCheckIn/);
assert.match(source, /handleProtectedFieldMedia/);
assert.match(source, /Cache-Control['"],\s*['"]private, no-store/);
```

Add handler-level tests with an in-memory DB/R2 stub proving assigned-engineer success, unrelated-engineer rejection, photo-required validation, optional-location success, duplicate idempotency, and customer access only to customer-visible media.

- [ ] **Step 2: Run selected tests and confirm RED**

Run: `cd worker && node --test tests/field-work-api.test.mjs tests/routes.test.mjs tests/wrangler-config.test.mjs`

Expected: FAIL for missing binding and routes.

- [ ] **Step 3: Add the private R2 binding**

Add to root and production environments:

```toml
[[r2_buckets]]
binding = "FIELD_EVIDENCE"
bucket_name = "sagemro-field-evidence"
```

Do not add a public host for this bucket.

- [ ] **Step 4: Implement photo validation and check-in orchestration**

The multipart endpoint accepts `photo`, `expected_checkout_time`, optional location fields, and `Idempotency-Key`. It must:

1. authenticate the current assigned engineer;
2. require onsite + `in_service` + complete field plan;
3. compute `site_local_date` from server time and `site_timezone`;
4. reject non-image MIME, zero bytes, files over 10 MB, and unsupported decoded signatures (JPEG/PNG/WebP);
5. return the existing record for a matching idempotency key or same legal day;
6. evaluate location only when a valid coordinate pair and accuracy are supplied;
7. upload to `field-evidence/<market>/<workOrderId>/<fieldDayId>/check-in.<ext>`;
8. insert field day/media/audit records, deleting the object if D1 persistence fails;
9. write a compatibility `work_order_arrival_checks` record and populate first-arrival fields;
10. return `location_status: verified | outside_geofence | unavailable` without rejecting photo check-in.

- [ ] **Step 5: Implement role-filtered timeline and protected streaming**

`GET field-days` returns customer-visible report fields to customers and full fields to the assigned/historical engineer or Admin. Media responses use authenticated lookup and return:

```js
new Response(object.body, {
  headers: {
    'Content-Type': media.mime_type,
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  },
});
```

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `cd worker && node --test tests/field-work-api.test.mjs tests/routes.test.mjs tests/wrangler-config.test.mjs`

- [ ] **Step 7: Commit**

```bash
git add worker/wrangler.toml worker/src/index.js worker/tests/field-work-api.test.mjs worker/tests/routes.test.mjs worker/tests/wrangler-config.test.mjs
git commit -m "feat(field-work): add private photo check-in API"
```

---

### Task 3: Daily Reports, Field Plans, Extensions, and Admin Decisions

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/field-work-api.test.mjs`
- Modify: `worker/tests/routes.test.mjs`

**Interfaces:**
- Produces `POST /api/workorders/:id/field-days/:fieldDayId/report`.
- Produces `POST /api/workorders/:id/extension-requests`.
- Produces `PATCH /api/admin/workorders/:id/field-plan`.
- Produces `POST /api/admin/workorders/:id/extension-requests/:requestId/decision`.
- Produces `POST /api/admin/workorders/:id/field-days/override`.
- Produces Admin correction and evidence-hold endpoints.

- [ ] **Step 1: Add failing tests for report and Admin workflows**

Cover required report fields, progress media, late reason, internal/customer filtering, positive labor hours, one pending extension, plan update ownership, decision notifications, audited override, Admin-only correction revision, and evidence hold open/resolve.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd worker && node --test tests/field-work-api.test.mjs tests/routes.test.mjs`

- [ ] **Step 3: Implement field-plan validation and Admin route**

Accept only Admin authentication. Normalize `site_timezone`, `expected_service_days`, `expected_completion_date`, and optional `HH:MM` schedule. Write before/after audit snapshots and include the plan in work-order details.

- [ ] **Step 4: Implement multipart daily-report submission**

Require customer-visible text fields, labor hours, and one or more progress images. Store customer-visible and internal media separately. For overdue days require `late_reason` and transition to `late_report_submitted`; otherwise transition to `report_submitted`. Insert a customer notification after successful persistence.

- [ ] **Step 5: Implement extension request and decision routes**

An engineer can request an extension from the report payload or separate JSON route. Admin approval atomically updates the request and current plan, logs the decision, and notifies engineer/customer; rejection keeps the plan unchanged and notifies the engineer.

- [ ] **Step 6: Implement Admin override, correction, and evidence holds**

Every exceptional action requires a non-empty reason, writes the existing audit log, and never labels an override as a normal camera check-in. Corrections first store the previous report snapshot in `work_order_field_day_revisions`.

- [ ] **Step 7: Extend work-order detail and Admin list payloads**

Return role-filtered `field_days`, `field_plan`, `field_work_summary`, `pending_extension_requests`, and Admin list indicators `field_checked_in_today`, `field_report_overdue_count`, and `field_extension_pending`.

- [ ] **Step 8: Run focused tests and confirm GREEN**

Run: `cd worker && node --test tests/field-work-api.test.mjs tests/routes.test.mjs`

- [ ] **Step 9: Commit**

```bash
git add worker/src/index.js worker/tests/field-work-api.test.mjs worker/tests/routes.test.mjs
git commit -m "feat(field-work): add daily reports and extension workflow"
```

---

### Task 4: Reminders, Retention, and Final Closure Gate

**Files:**
- Modify: `worker/wrangler.toml`
- Modify: `worker/src/index.js`
- Modify: `worker/tests/field-work-api.test.mjs`
- Modify: `worker/tests/config.test.mjs`

**Interfaces:**
- Produces `scheduled(controller, env, ctx)` handler.
- Enforces field-day completion from the existing final-report/resolve path.

- [ ] **Step 1: Add failing scheduler and closure tests**

Assert a `*/15 * * * *` trigger, site-time-zone overdue evaluation, one-time checkout reminder, one-time overdue notification, 12-month deletion, open-hold exclusion, and final closure rejection for `checked_in`, `report_overdue`, or pending extension records.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd worker && node --test tests/field-work-api.test.mjs tests/config.test.mjs`

- [ ] **Step 3: Add the cron trigger**

```toml
[triggers]
crons = ["*/15 * * * *"]

[env.production.triggers]
crons = ["*/15 * * * *"]
```

- [ ] **Step 4: Implement scheduled processing for both D1 markets**

The scheduler iterates `env.DB` and `env.DB_CN` when present, marks locally expired days overdue, sends deduplicated reminders, and deletes eligible private objects only after checking evidence holds. Use `ctx.waitUntil` and isolate failures per database/object so one bad record does not abort the complete scan.

- [ ] **Step 5: Enforce final closure rules**

For new-plan onsite work orders, reject final submission when no field day exists, any day blocks closure, the final day lacks a report, or an extension remains pending. Keep legacy active work orders valid when they have no field plan and already satisfy the existing arrival compatibility rule.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `cd worker && node --test tests/field-work-api.test.mjs tests/config.test.mjs`

- [ ] **Step 7: Commit**

```bash
git add worker/wrangler.toml worker/src/index.js worker/tests/field-work-api.test.mjs worker/tests/config.test.mjs
git commit -m "feat(field-work): add reminders and retention enforcement"
```

---

### Task 5: Engineer and Customer Field-Work UI

**Files:**
- Create: `frontend/src/components/WorkOrder/FieldWorkPanel.jsx`
- Create: `frontend/tests/field-work-contract.test.mjs`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `frontend/tests/work-order-location-contract.test.mjs`

**Interfaces:**
- Consumes Tasks 2-4 APIs.
- Produces role-aware `FieldWorkPanel({ workOrderId, detail, userType, userId, onChanged, onBusyChange })`.

- [ ] **Step 1: Write failing frontend contracts**

Assert `navigator.mediaDevices.getUserMedia`, `facingMode: 'user'`, canvas/blob capture, no `<input type="file">` in the check-in block, optional `getBrowserLocation`, multipart API calls with idempotency keys, customer/internal visibility, local draft persistence, overdue completion, and final-report explanatory block.

- [ ] **Step 2: Run test and confirm RED**

Run: `cd frontend && node --test tests/field-work-contract.test.mjs tests/work-order-location-contract.test.mjs`

- [ ] **Step 3: Add frontend API functions**

Implement `checkInFieldDay`, `getFieldDays`, `submitFieldDayReport`, `requestFieldExtension`, and `fieldMediaUrl`. Multipart requests must not set `Content-Type` manually; the patched fetch still supplies Cookie/CSRF credentials.

- [ ] **Step 4: Build the live-camera check-in state**

Use a `<video playsInline muted>` preview and canvas capture. Stop all media tracks on modal close/unmount. Try optional geolocation in parallel or immediately before submission; convert failures to `location_status` metadata instead of a blocking error. Disable capture until the stream is ready.

- [ ] **Step 5: Build engineer report and timeline states**

Show exactly one primary action based on today's field day. Require report fields, labor hours, and progress photos. Autosave text under `sagemro_field_report_<fieldDayId>` and clear only after a confirmed response. Allow completion of earlier overdue reports without blocking today's check-in.

- [ ] **Step 6: Build customer timeline state**

Render approved plan, customer-visible reports/media, revised completion date, and a neutral overdue indicator. Never render `internal_note`, raw coordinates, geofence internals, or Admin override reasons.

- [ ] **Step 7: Integrate the tab and retire location-only primary UI**

Add `Field work` / `现场作业` for onsite `in_service` and historical field-day records. Keep legacy arrival information as a secondary historical indicator. Use the new field-work completion message before final report submission.

- [ ] **Step 8: Run frontend verification**

Run:

```bash
cd frontend
node --test tests/field-work-contract.test.mjs tests/work-order-location-contract.test.mjs
npm run lint
npm test
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/WorkOrder/FieldWorkPanel.jsx frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/src/services/api.js frontend/tests/field-work-contract.test.mjs frontend/tests/work-order-location-contract.test.mjs
git commit -m "feat(frontend): add daily field-work workflow"
```

---

### Task 6: Admin Field Operations UI

**Files:**
- Create: `admin/src/components/FieldWorkAdminPanel.jsx`
- Create: `admin/src/components/FieldWorkAdminPanel.test.mjs`
- Modify: `admin/src/services/api.js`
- Modify: `admin/src/pages/WorkOrdersPage.jsx`
- Modify: `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`

**Interfaces:**
- Consumes Task 3 Admin APIs and protected media endpoint.
- Produces plan editor, daily audit, extension decisions, corrections, overrides, and evidence holds.

- [ ] **Step 1: Write failing Admin contracts**

Assert exact API paths, IANA time-zone field, expected days/date, daily status timeline, private authenticated media preview, pending extension approve/reject controls, mandatory override/correction reason, evidence hold controls, and list indicators.

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd admin && node --test src/components/FieldWorkAdminPanel.test.mjs src/pages/WorkOrdersPage.review-flow.test.mjs`

- [ ] **Step 3: Add Admin API functions**

Implement `updateFieldPlan`, `decideFieldExtension`, `overrideFieldDay`, `correctFieldDayReport`, `openFieldEvidenceHold`, and `resolveFieldEvidenceHold` using the existing `request` Cookie/CSRF wrapper.

- [ ] **Step 4: Build `FieldWorkAdminPanel`**

Use dense operational sections, not nested cards: plan form, status timeline, secure media previews, labor totals, overdue rows, extension decisions, correction/override forms, and holds. Read-only operations staff can inspect but cannot mutate.

- [ ] **Step 5: Integrate list indicators and detail panel**

Add compact indicators to service-order rows and render the panel inside the existing drawer after onsite-location controls. Refresh the detail after every successful action.

- [ ] **Step 6: Run Admin verification**

Run:

```bash
cd admin
npm test
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/FieldWorkAdminPanel.jsx admin/src/components/FieldWorkAdminPanel.test.mjs admin/src/pages/WorkOrdersPage.jsx admin/src/pages/WorkOrdersPage.review-flow.test.mjs admin/src/services/api.js
git commit -m "feat(admin): add onsite field operations controls"
```

---

### Task 7: Privacy Copy and Two-Day E2E Lifecycle

**Files:**
- Modify: `frontend/src/components/common/LegalModal.jsx`
- Modify: `docs/legal/privacy-policy.md`
- Create: `e2e/tests/onsite-multiday-lifecycle.spec.mjs`
- Modify: `e2e/scripts/prepare-local-env.mjs`
- Modify: `e2e/tests/service-order-lifecycle.spec.mjs`
- Modify: `frontend/tests/seo-contract.test.mjs` or create a focused legal contract test.

**Interfaces:**
- Produces user disclosure and browser-level acceptance coverage.

- [ ] **Step 1: Write failing legal and E2E contracts**

The legal test must assert disclosure of live check-in photos, service purpose, role-based access, no facial recognition, 12-month post-completion retention, and dispute holds in English and Chinese.

- [ ] **Step 2: Run legal contract and confirm RED**

Run: `cd frontend && node --test tests/field-work-contract.test.mjs`

- [ ] **Step 3: Update legal copy**

Keep ordinary service attachments under the existing policy, but add a distinct protected field-evidence section with the confirmed collection, access, processing, and retention rules.

- [ ] **Step 4: Add the two-day E2E scenario**

Use Playwright camera permission with deterministic fake media or route-level multipart fixtures in the isolated local Worker. Cover Admin plan, day-one location-unavailable check-in, overdue transition, day-two check-in, late report, extension approval, customer-visible/internal filtering, and final closure.

- [ ] **Step 5: Run E2E and full local gates**

Run:

```bash
cd e2e && npm test -- --grep "multi-day onsite"
cd ../worker && npm test
cd ../frontend && npm run lint && npm test && npm run build
cd ../admin && npm test && npm run build
git diff --check
```

- [ ] **Step 6: Commit**

```bash
git add docs/legal/privacy-policy.md frontend/src/components/common/LegalModal.jsx frontend/tests/field-work-contract.test.mjs e2e/scripts/prepare-local-env.mjs e2e/tests/onsite-multiday-lifecycle.spec.mjs e2e/tests/service-order-lifecycle.spec.mjs
git commit -m "test(field-work): cover protected multi-day onsite lifecycle"
```

---

### Task 8: China Edition Sync, Production Migration, and Deployment

**Files:**
- Sync compatible commits from `main` implementation branch to a fresh `china-edition` worktree.
- No new source file names beyond Tasks 1-7.

**Interfaces:**
- Produces equivalent COM/CN releases.

- [ ] **Step 1: Verify final implementation branch**

Run all Worker, frontend, Admin, and E2E gates plus `git diff --check`. Review the complete diff against the design's success criteria.

- [ ] **Step 2: Create the private R2 bucket before deployment**

Run an idempotent account-scoped check and create `sagemro-field-evidence` only if absent. Do not enable public access or add a public custom domain.

- [ ] **Step 3: Apply migration 039 to both production D1 databases**

```bash
cd worker
npx wrangler d1 execute sagemro-db --env production --remote --file migrations/039_field_workdays.sql
npx wrangler d1 execute sagemro-db-cn --env production --remote --file migrations/039_field_workdays.sql
```

Verify `_migrations` in both databases before Worker deployment.

- [ ] **Step 4: Push implementation branch, create PR to `main`, wait for CI, and merge**

The merge push deploys the shared Worker, international frontend, and Admin. Confirm the scheduled trigger and private binding in the deployed Worker.

- [ ] **Step 5: Sync frontend/Admin compatibility to `china-edition`**

Cherry-pick or merge the reviewed commits without dropping current China-only localization and Aliyun workflow changes. Run the China frontend test/lint/build and Admin build.

- [ ] **Step 6: Push China branch, create PR, wait for CI, and merge**

After merge, manually trigger:

```bash
gh workflow run aliyun-cn-deploy.yml --ref china-edition
```

- [ ] **Step 7: Run production smoke and cleanup**

Use uniquely prefixed temporary identities and a temporary onsite work order. Verify protected media returns `200` only with authorized session, unauthorized access is rejected, customer/internal filtering works, COM/CN API health is `200`, and all temporary D1/R2 records are removed.

- [ ] **Step 8: Record completion**

Update the implementation PRs with migration IDs, workflow URLs, smoke results, and confirmation that the private bucket has no public endpoint.

---

## Plan Self-Review

- Spec coverage: daily lifecycle, camera-only check-in UI, optional location, daily report, missed-report recovery, extensions, time zones, notifications, reassignment ownership, private media, retention holds, legacy compatibility, final closure, three role UIs, privacy copy, E2E, COM/CN deployment are assigned to Tasks 1-8.
- Placeholder scan: no `TBD`, `TODO`, or undefined later-phase interfaces remain.
- Type consistency: `work_order_field_days`, `work_order_field_day_media`, `work_order_extension_requests`, `work_order_field_day_revisions`, and `work_order_field_evidence_holds` names are consistent across migration, Worker, frontend, Admin, scheduler, and tests.
- Configuration gate: the approved implementation explicitly includes the private R2 binding and cron trigger; neither contains secrets or changes the existing public attachment binding.
