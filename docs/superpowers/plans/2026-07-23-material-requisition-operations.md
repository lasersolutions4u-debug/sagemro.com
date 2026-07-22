# Material Requisition Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an operational work-order material requisition workflow with staff roles, CI E2E coverage, scheduled D1 backups, and pilot metrics.

**Architecture:** Add focused Worker modules for staff authorization and requisition state calculations while keeping route integration compatible with the existing Worker. Reuse the current Admin and engineer portal patterns, and keep material master-data requests separate from fulfillment requisitions.

**Tech Stack:** Cloudflare Workers, D1, React/Vite, Node test runner, Playwright, GitHub Actions.

---

### Task 1: Requisition domain contract

**Files:**
- Create: `worker/src/lib/materialRequisitions.js`
- Create: `worker/tests/material-requisitions.test.mjs`
- Modify: `worker/package.json`

- [ ] Write failing tests for status derivation, quantity bounds, role permissions, and close eligibility.
- [ ] Run the focused test and confirm failures are caused by missing domain functions.
- [ ] Implement the minimal pure domain module.
- [ ] Run the focused test and Worker suite.

### Task 2: D1 schema and Worker APIs

**Files:**
- Create: `worker/migrations/038_material_requisitions_and_staff.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/migrations/README.md`
- Modify: `worker/src/index.js`
- Modify: `worker/tests/material-requisitions.test.mjs`

- [ ] Add staff account, requisition header, and requisition line tables with indexes.
- [ ] Add staff login, list, create, deactivate, and temporary-password reset APIs.
- [ ] Add engineer/Admin requisition create, list, detail, submit, review, fulfillment, issue, receipt, and cancel APIs.
- [ ] Add role checks, audit logs, stock adjustments, and deterministic requisition numbers.
- [ ] Run focused and full Worker tests.

### Task 3: Admin operations UI

**Files:**
- Create: `admin/src/pages/MaterialRequisitionsPage.jsx`
- Create: `admin/src/pages/StaffAccountsPage.jsx`
- Modify: `admin/src/App.jsx`
- Modify: `admin/src/services/api.js`
- Modify: `admin/src/pages/MaterialsPage.jsx`
- Create: `admin/src/pages/MaterialRequisitionsPage.test.mjs`
- Create: `admin/src/pages/StaffAccountsPage.test.mjs`
- Modify: `admin/package.json`

- [ ] Add failing UI/API contract tests for navigation, role-gated actions, list/detail behavior, and old request renaming.
- [ ] Implement requisition list/detail drawer and staff account management.
- [ ] Persist staff role from session and filter navigation/actions by capability.
- [ ] Run Admin tests and production build.

### Task 4: Engineer requisition workflow

**Files:**
- Create: `frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `frontend/src/services/api.js`
- Create: `frontend/tests/material-requisition-contract.test.mjs`

- [ ] Add failing tests for multi-line creation, work-order linkage, progress display, and receipt confirmation.
- [ ] Implement API clients and the work-order panel.
- [ ] Run frontend tests, lint, and build.

### Task 5: Pilot operations metrics

**Files:**
- Modify: `worker/src/index.js`
- Modify: `admin/src/pages/DashboardPage.jsx`
- Create: `admin/src/pages/material-requisition-metrics.test.mjs`

- [ ] Add failing tests for pending approval, shortage, overdue, median approval/fulfillment duration, and closure rate fields.
- [ ] Extend Admin stats and dashboard cards without removing existing metrics.
- [ ] Run Worker/Admin tests.

### Task 6: Full E2E CI gate

**Files:**
- Create: `e2e/tests/material-requisition-lifecycle.spec.mjs`
- Modify: `e2e/support/journeys.mjs`
- Modify: `.github/workflows/deploy.yml`

- [ ] Add an E2E scenario covering submission through receipt.
- [ ] Run the full local Playwright suite.
- [ ] Add Chromium installation and `npm test` for `e2e/` to the test job.
- [ ] Verify PR events still never deploy.

### Task 7: Scheduled production backups

**Files:**
- Create: `.github/workflows/d1-backup.yml`
- Create: `worker/tests/d1-backup-workflow.test.mjs`
- Modify: `worker/package.json`
- Modify: `DEPLOY.md`

- [ ] Add a failing workflow contract test for schedule, two databases, explicit production flags, validation, checksums, and 30-day artifacts.
- [ ] Implement the scheduled/manual workflow using existing D1 export tooling.
- [ ] Document restore location, retention, failure inspection, and the limitation that GitHub artifacts are not an external disaster-recovery store.
- [ ] Run Worker tests.

### Task 8: Verification and release

**Files:**
- Modify: `.Codex/memory/2026-07-22-technical-remediation-backlog.md` only after deployment state is known.

- [ ] Run Worker, frontend, Admin, and full Playwright suites.
- [ ] Run all builds, lint, and `git diff --check`.
- [ ] Commit and push the feature branch; create and merge a PR after CI passes.
- [ ] Apply migration `038` to COM and CN D1 before Worker deployment.
- [ ] Deploy `main`, sync client/Admin changes to `china-edition`, and deploy Aliyun ECS.
- [ ] Run production health, CORS, role, and scoped material requisition smoke checks.

