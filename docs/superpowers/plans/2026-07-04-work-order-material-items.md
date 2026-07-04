# Work Order Material Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let engineers reference Admin-maintained materials inside work orders for quote lines, preparation lists, and service report parts without exposing supplier, cost, or inventory fields to customers.

**Architecture:** Add a `work_order_material_items` table that stores a safe snapshot of selected material fields at the time of use. Worker APIs enforce work-order ownership and expose limited material fields to engineers/customers. Frontend quote and service-report panels reuse a small material picker that searches active materials and submits selected lines.

**Tech Stack:** Cloudflare Workers, D1 SQL migrations, React/Vite frontend, Node test runner.

---

### Task 1: Worker API Contract

**Files:**
- Create: `worker/tests/work-order-material-items.test.mjs`
- Modify: `worker/package.json`

- [ ] Write failing tests for engineer material search, quote item creation, customer-safe reads, and unauthorized access.
- [ ] Run `node --test worker/tests/work-order-material-items.test.mjs`.
- [ ] Expected failure before implementation: routes return 404 or missing fields.

### Task 2: D1 Migration And Schema Snapshot

**Files:**
- Create: `worker/migrations/027_work_order_material_items.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/migrations/README.md`

- [ ] Add `work_order_material_items` with indexes on `work_order_id`, `material_id`, `purpose`, and `status`.
- [ ] Store safe snapshot fields: code, names, spec, brand, unit, quantity, unit price, purpose, note.
- [ ] Do not store supplier, reference cost, or stock on the work-order item.
- [ ] Add `_migrations` entry `027_work_order_material_items`.

### Task 3: Worker Handlers

**Files:**
- Modify: `worker/src/index.js`

- [ ] Add `GET /api/materials` for admin/engineer material search with safe fields only.
- [ ] Add `GET /api/workorders/:id/material-items` for work-order-scoped material lines.
- [ ] Add `POST /api/workorders/:id/material-items` for admin/engineer line creation.
- [ ] Add `PATCH /api/workorders/:id/material-items/:itemId` for quantity, price, note, purpose, and soft removal.
- [ ] Attach quote material lines to `GET /api/workorders/:id/pricing`.
- [ ] Attach service-report material lines to `GET /api/workorders/:id/repair-record` and work-order detail.
- [ ] If `material_items` is submitted with pricing or repair record, replace that purpose’s active lines from the payload.

### Task 4: Frontend Material Picker

**Files:**
- Create: `frontend/src/components/WorkOrder/MaterialPicker.jsx`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/components/WorkOrder/PricingPanels.jsx`
- Modify: `frontend/src/components/WorkOrder/RepairRecordPanel.jsx`

- [ ] Add safe material search client and work-order material item helpers.
- [ ] Add picker in engineer quote panel for quote parts with quantity and unit price.
- [ ] Add customer quote display using structured material lines when present, falling back to legacy `parts_detail`.
- [ ] Add picker in service report panel for used parts without requiring pricing.
- [ ] Keep old free-text parts fields compatible.

### Task 5: Verification And Deployment Preparation

**Files:**
- Modify: `.Codex/memory/2026-07-04-sagemro-material-master-batch-2.md`

- [ ] Run `node --test worker/tests/work-order-material-items.test.mjs`.
- [ ] Run `npm test --prefix worker`.
- [ ] Run `npm run build --prefix frontend`.
- [ ] Run `npm run build --prefix admin`.
- [ ] Run `git diff --check`.
- [ ] Record that production deployment requires running migration `027_work_order_material_items.sql` on both `sagemro-db` and `sagemro-db-cn` before deploying the Worker.
