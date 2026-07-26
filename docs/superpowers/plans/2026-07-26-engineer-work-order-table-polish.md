# Engineer Work Order Table Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the desktop work-order grid and deliver a compact, aligned eight-column table with readable task and equipment text.

**Architecture:** Keep the existing responsive component structure. Change only the explicit desktop grid template and cell wrapping rules, then enforce the template through the existing source-contract test. Preserve mobile markup, events, data flow, and detail behavior.

**Tech Stack:** React, Tailwind CSS arbitrary grid templates, Node test runner, ESLint, Vite.

---

### Task 1: Lock the eight-column desktop contract

**Files:**
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

- [ ] **Step 1: Write the failing test**

Assert the eight-column template and wrapping classes in the existing Engineer list contract test.

- [ ] **Step 2: Run the focused test to verify it fails**

```bash
cd frontend
node --test --test-name-pattern="engineer list keeps key fields readable" tests/engineer-work-order-experience-contract.test.mjs
```

Expected: FAIL because the component still defines only seven explicit columns.

### Task 2: Implement the compact eight-column row

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`

- [ ] **Step 1: Define all eight columns in header and row**

Use `132px minmax(240px,1.55fr) minmax(110px,.75fr) minmax(260px,1.55fr) minmax(120px,.8fr) minmax(150px,.9fr) 118px 36px` for both desktop templates.

- [ ] **Step 2: Balance wrapping and alignment**

Keep task and equipment at two lines, customer and region truncated, status bounded to its cell, updated time on one line, and the row at `min-h-[84px]`.

- [ ] **Step 3: Run the focused test to verify it passes**

Run the Task 1 command again. Expected: PASS.

### Task 3: Verify and release

**Files:**
- No additional source files.

- [ ] **Step 1: Run frontend verification**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 2: Capture desktop and mobile screenshots**

Verify one 84px desktop row per work order, eight aligned cells, a far-right arrow, a one-line updated time, and unchanged mobile cards.

- [ ] **Step 3: Commit, push, deploy, and smoke check**

Commit with `fix(engineer): align work-order table`, push to the release branch, monitor CI, deploy China to Aliyun ECS, and confirm both Engineer hosts and API health endpoints return HTTP 200.
