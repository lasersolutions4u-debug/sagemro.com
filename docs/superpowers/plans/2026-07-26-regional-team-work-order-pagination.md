# Regional Team Work Order Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add true per-group pagination, complete counts, and complete metrics to the Regional Lead team work-order workspace.

**Architecture:** Extend the existing authenticated team endpoint with summary and group-page views while preserving its legacy response. The workspace loads a lightweight summary when team scope is selected, and the grouped list owns independent cursor state for each open group. International and China frontends use the same component/API contract; only the international Worker is deployed.

**Tech Stack:** Cloudflare Workers, D1 SQL, React, Tailwind CSS, Node test runner, Vite.

---

### Task 1: Worker summary and group pagination contract

**Files:**
- Modify: `worker/tests/engineer-workspace-access.test.mjs`
- Modify: `worker/src/index.js`

- [x] **Step 1: Write failing Worker tests**

Add tests that create more than five work orders for a team member and assert:

```js
const summary = await api(env, '/api/engineers/tickets?scope=team&view=summary&filter=all');
assert.equal(summary.json.work_orders.length, 0);
assert.equal(summary.json.groups.find((group) => group.key === 'eng-1').total, 7);

const firstPage = await api(env, '/api/engineers/tickets?scope=team&view=group&group_type=member&group_id=eng-1&filter=all&limit=5');
assert.equal(firstPage.json.work_orders.length, 5);
assert.equal(firstPage.json.total, 7);
assert.equal(firstPage.json.has_more, true);

const secondPage = await api(env, `/api/engineers/tickets?scope=team&view=group&group_type=member&group_id=eng-1&filter=all&limit=10&cursor=${encodeURIComponent(firstPage.json.next_cursor)}`);
assert.equal(secondPage.json.work_orders.length, 2);
assert.equal(secondPage.json.has_more, false);
```

Also assert filtered totals, full team metrics, invalid cursors, and member authorization.

- [x] **Step 2: Run the focused Worker test and verify RED**

```bash
cd worker
node --test --test-name-pattern="team work-order summary and group pagination" tests/engineer-workspace-access.test.mjs
```

Expected: FAIL because `view=summary` and `view=group` do not exist.

- [x] **Step 3: Implement summary and group modes**

In `handleGetEngineerTickets`:

- validate `filter`, `view`, `group_type`, `limit`, and cursor;
- reuse one authorized team-scope predicate;
- calculate group totals and the eight metrics over the full scope;
- query only the selected group for group mode;
- order by `w.created_at DESC, w.id DESC`;
- return `total`, `has_more`, and `next_cursor`;
- leave the legacy no-`view` response unchanged.

- [x] **Step 4: Run the focused Worker test and verify GREEN**

Run the Step 2 command. Expected: PASS.

### Task 2: Frontend API and metric support

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/src/components/Engineer/engineerWorkOrderMetrics.js`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

- [x] **Step 1: Write failing frontend contracts**

Assert the API serializes `view`, group, filter, limit, and cursor parameters; the workspace stores `teamSummary`; and team metrics use the server aggregate instead of the loaded page rows.

- [x] **Step 2: Run the focused frontend test and verify RED**

```bash
cd frontend
node --test --test-name-pattern="regional team pagination" tests/engineer-work-order-experience-contract.test.mjs
```

- [x] **Step 3: Implement API and workspace summary loading**

- Extend `getEngineerTickets(options)` to serialize all supported optional parameters.
- In team scope request `view: 'summary'` and store `groups` plus `metrics`.
- In personal scope preserve the current request and client metric calculation.
- Pass a group loader callback and summary groups to `EngineerTeamWorkOrderList`.

- [x] **Step 4: Verify GREEN**

Run the Step 2 command. Expected: PASS.

### Task 3: Group loading interaction

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

- [x] **Step 1: Write failing interaction contracts**

Assert constants `INITIAL_GROUP_LIMIT = 5` and `MORE_GROUP_LIMIT = 10`, default-collapsed member groups, independent per-group cursors, filter reset, inline loading/error states, and bilingual `Load 10 more` copy.

- [x] **Step 2: Run the focused test and verify RED**

Use the Task 2 command. Expected: FAIL against the current render-all implementation.

- [x] **Step 3: Implement group state and rendering**

- Render group headers from summary data.
- Auto-load queue and lead groups with five records.
- Load member/historical first pages when opened.
- Append ten records per subsequent action.
- Keep empty groups compact.
- Reset group pages when the global status filter changes.
- Preserve already loaded rows when a subsequent request fails.

- [x] **Step 4: Verify GREEN**

Run the Task 2 command. Expected: PASS.

### Task 4: China sync, complete verification, and visual review

**Files:**
- Modify the matching `frontend/` files and test on `china-edition`.

- [x] **Step 1: Apply identical frontend changes to China**

Do not copy Worker changes to `china-edition`; it uses the Worker deployed from `main`.

- [x] **Step 2: Run complete verification**

```bash
cd worker && npm test
cd ../frontend && npm test && npm run lint && npm run build
```

Run frontend verification in both release worktrees.

- [x] **Step 3: Capture desktop and mobile screenshots**

Use fixtures with at least 17 work orders for one engineer. Verify five initial rows, accurate total, `Load 10 more`, collapsed member defaults, compact empty queue, and mobile button fit.

### Task 5: Release

**Files:**
- No additional source files.

- [ ] **Step 1: Inspect and commit**

```bash
git diff --check
git status --short
git commit -m "feat(engineer): paginate regional team work orders"
```

- [ ] **Step 2: Push and deploy**

Push international changes to `main`, China frontend changes to `china-edition`, monitor `deploy.yml`, and trigger `aliyun-cn-deploy.yml`.

- [ ] **Step 3: Smoke check**

Confirm both Engineer hosts and both API health endpoints return HTTP 200, then exercise one production team summary request through an authenticated browser session if available.
