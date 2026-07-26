# Engineer Workspace Density and Work-Order Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved responsive eight-column engineer work-order list, readable workspace typography, and a persisted Admin-editable short work-order title on both the international and China editions.

**Architecture:** Add a nullable `work_orders.short_title` column plus one pure Worker title module that generates and resolves localized titles without waiting for AI. The Worker persists titles at both work-order creation entry points, exposes a localized `display_title`, and provides one Admin-only title mutation endpoint. Admin receives an inline editor; engineer and Regional Lead views remain read-only and share the same title precedence. The engineer list uses a wide-screen nine-track grid—eight information columns plus the detail affordance—and changes to a separate mobile card below 1280 CSS px.

**Tech Stack:** Cloudflare Workers and D1, JavaScript ES modules, React 19 frontend, React 18 Admin, Tailwind CSS 4, Node test runner, Vite, GitHub Actions, Cloudflare Pages/Workers, Aliyun ECS/nginx.

## Global Constraints

- Start execution in an isolated worktree created from current `origin/main`; do not implement on the dirty root worktree.
- Use branch `codex/engineer-density-title` for the international/main implementation.
- Do not modify `worker/wrangler.toml`, `.github/workflows/deploy.yml`, or Pages project names without a new explicit user confirmation.
- `short_title` is nullable, limited to 100 characters, and must not contain customer contact information.
- Automatic title generation is deterministic and must not call or wait for AI.
- Admin and Admin-role staff can edit; operations staff, engineers, Regional Leads, and customers cannot edit.
- Saved Admin text is displayed as saved and is not silently translated.
- Automatically generated and historical fallback titles follow the request market: English for `.com`, Chinese for `.cn`.
- Desktop width `>= 1280 CSS px` uses eight information columns plus the detail affordance; narrower viewports use a mobile card with no horizontal scrolling.
- Ordinary operational text in the touched engineer workspace components must not remain at 9–10 px.
- Preserve personal/team metrics, Regional Lead engineer grouping, calendar editing, work-order detail actions, quote, material requisition, field-work, and service-report behavior.
- Do not reintroduce inbox or private messaging.
- Add migration `042_work_order_short_title.sql`, update `worker/schema.sql`, and apply the migration manually to both `sagemro-db` and `sagemro-db-cn` before merging the main PR that deploys the Worker.
- Complete the full repository test job before merge: Worker pretests/tests/golden checks, frontend lint/tests/build, and Admin tests/build.
- Preserve unrelated user changes and untracked files in the root workspace.

---

## File Structure

### New files

- `worker/src/lib/workOrderTitles.js` — pure normalization, deterministic generation, and persisted/fallback title resolution.
- `worker/tests/work-order-titles.test.mjs` — unit and source-contract coverage for title generation and both creation paths.
- `worker/tests/work-order-short-title-api.test.mjs` — real SQLite-backed Admin mutation, permission, persistence, and audit coverage.
- `worker/migrations/042_work_order_short_title.sql` — nullable D1 column and migration marker.

### Modified Worker files

- `worker/schema.sql` — add `short_title TEXT` to the current work-order schema snapshot.
- `worker/migrations/README.md` — document migration 042.
- `worker/src/index.js` — populate short titles, expose `display_title`, implement Admin mutation, and include titles in explicit projections/sanitizers.
- `worker/tests/engineer-workspace-access.test.mjs` — verify personal, team, Regional Lead detail, and read-only title visibility.
- `worker/package.json` — add `work-order-titles.test.mjs` to `pretest` and `work-order-short-title-api.test.mjs` to `test` without removing existing suites.

### Modified Admin files

- `admin/src/services/api.js` — add `updateAdminWorkOrderTitle(workOrderId, shortTitle)`.
- `admin/src/pages/WorkOrdersPage.jsx` — render the short title in the detail header and add explicit inline Edit/Save/Cancel behavior when not read-only.
- `admin/src/pages/WorkOrdersPage.review-flow.test.mjs` — contract-test the editor, API call, read-only boundary, and error retention.

### Modified engineer frontend files

- `frontend/src/components/Engineer/engineerWorkOrderDisplay.js` — prefer persisted and Worker-resolved titles before legacy localized fallbacks.
- `frontend/src/components/Engineer/EngineerWorkOrderList.jsx` — approved desktop grid and separate mobile card.
- `frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx` — readable group headers and shared dense list.
- `frontend/src/components/Engineer/EngineerMetricOverview.jsx` — metric label/value typography.
- `frontend/src/components/Engineer/EngineerWorkspace.jsx` — header, calendar, filter, and status-control typography.
- `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx` — title, metadata, tabs, section labels, checklist, and action typography.
- `frontend/tests/engineer-work-order-experience-contract.test.mjs` — title precedence, responsive grid, mobile structure, and typography contracts.

---

### Task 0: Create the isolated main implementation worktree

**Files:**
- No production files change in this task.

**Interfaces:**
- Produces: `.worktrees/engineer-density-title` on branch `codex/engineer-density-title`, based on current `origin/main`.
- Preserves: the dirty root worktree and all unrelated user files.

- [ ] **Step 1: Create the worktree through the required worktree skill**

Invoke `superpowers:using-git-worktrees`, then run from the project root:

```bash
git fetch origin
git worktree add .worktrees/engineer-density-title \
  -b codex/engineer-density-title origin/main
```

Expected: a clean worktree at `/Users/joe/Projects/sagemro.com/.worktrees/engineer-density-title` with branch `codex/engineer-density-title`.

- [ ] **Step 2: Carry the approved documentation into the feature branch**

From the new worktree:

```bash
design_doc_sha="$(git log --all --format=%H --grep='^docs(engineer): define dense list and short titles$' -1)"
plan_doc_sha="$(git log --all --format=%H --grep='^docs(engineer): plan dense list and short titles$' -1)"
test -n "$design_doc_sha"
test -n "$plan_doc_sha"
git cherry-pick "$design_doc_sha" "$plan_doc_sha"
```

Expected: the approved design and this implementation plan are present on the feature branch before business-code changes begin.

- [ ] **Step 3: Confirm the isolated baseline**

```bash
git status --short --branch
git log -3 --oneline
```

Expected: clean status on `codex/engineer-density-title`; the two documentation commits are the latest commits.

---

### Task 1: Create the title domain and schema migration

**Files:**
- Create: `worker/src/lib/workOrderTitles.js`
- Create: `worker/tests/work-order-titles.test.mjs`
- Create: `worker/migrations/042_work_order_short_title.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/migrations/README.md`
- Modify: `worker/package.json`

**Interfaces:**
- Produces: `normalizeWorkOrderShortTitle(value) -> string`
- Produces: `buildWorkOrderShortTitle(workOrder, market = 'com') -> string`
- Produces: `resolveWorkOrderShortTitle(workOrder, market = 'com') -> string`
- Consumes: `redactPII(text)` from `worker/src/lib/redact.js`

- [ ] **Step 1: Write the failing pure-function tests**

Create `worker/tests/work-order-titles.test.mjs` with these behaviors:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  buildWorkOrderShortTitle,
  normalizeWorkOrderShortTitle,
  resolveWorkOrderShortTitle,
} from '../src/lib/workOrderTitles.js';

test('normalizes whitespace and removes contact information', () => {
  assert.equal(
    normalizeWorkOrderShortTitle('  Han\'s   3015 repair  support@example.com  '),
    'Han\'s 3015 repair',
  );
  assert.equal(
    normalizeWorkOrderShortTitle('现场维修 13800138000'),
    '现场维修',
  );
  assert.equal(
    normalizeWorkOrderShortTitle('Field repair +1 (415) 555-0100'),
    'Field repair',
  );
});

test('builds deterministic localized titles without AI text', () => {
  const order = {
    type: 'fault',
    service_mode: 'onsite',
    category_l1: 'laser_cutting',
    device_brand: "Han's Laser",
    device_model: '3015',
    description: 'Customer pasted a long equipment metadata sentence.',
  };

  assert.equal(buildWorkOrderShortTitle(order, 'com'), "Han's Laser 3015 on-site repair");
  assert.equal(buildWorkOrderShortTitle(order, 'cn'), "Han's Laser 3015 现场维修");
});

test('uses localized category and service fallbacks when device data is sparse', () => {
  const order = { type: 'maintenance', category_l1: 'laser_cutting' };
  assert.equal(buildWorkOrderShortTitle(order, 'com'), 'Laser cutting maintenance');
  assert.equal(buildWorkOrderShortTitle(order, 'cn'), '激光切割维护保养');
});

test('persisted Admin title is authoritative and is not language-filtered', () => {
  assert.equal(
    resolveWorkOrderShortTitle({ short_title: '济南 3015 维修', type: 'fault' }, 'com'),
    '济南 3015 维修',
  );
});

test('resolved titles are never empty and stay within 100 characters', () => {
  const resolved = resolveWorkOrderShortTitle({
    device_brand: 'A'.repeat(120),
    device_model: '3015',
    type: 'fault',
  }, 'com');
  assert.equal(resolved.length <= 100, true);
  assert.equal(resolveWorkOrderShortTitle({}, 'com'), 'Service task');
  assert.equal(resolveWorkOrderShortTitle({}, 'cn'), '服务任务');
});

test('schema and migration contain the nullable short title column', () => {
  const migration = readFileSync(new URL('../migrations/042_work_order_short_title.sql', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  assert.match(migration, /ALTER TABLE work_orders ADD COLUMN short_title TEXT/);
  assert.match(migration, /'042_work_order_short_title'/);
  assert.match(schema, /short_title TEXT/);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
cd worker
node --test tests/work-order-titles.test.mjs
```

Expected: FAIL because `src/lib/workOrderTitles.js` and migration 042 do not exist.

- [ ] **Step 3: Implement the pure title module**

Create `worker/src/lib/workOrderTitles.js`:

```js
import { redactPII } from './redact.js';

const TITLE_LIMIT = 100;
const CHINESE_TEXT = /[\u3400-\u9fff]/u;
const INTERNATIONAL_PHONE = /\+\d[\d\s().-]{6,}\d/g;

const COPY = {
  com: {
    fallback: 'Service task',
    categories: {
      laser_cutting: 'Laser cutting', bending: 'Press brake', punching: 'Punching',
      welding: 'Welding', surface_treatment: 'Surface treatment', auxiliary: 'Auxiliary equipment',
      cnc_automation: 'CNC and automation', inspection: 'Inspection', other: 'Equipment',
    },
    services: {
      fault: 'repair', maintenance: 'maintenance', parameter: 'parameter tuning',
      consult: 'technical support', parts: 'parts request', aftersales: 'after-sales service', other: 'service',
    },
    onsiteRepair: 'on-site repair',
  },
  cn: {
    fallback: '服务任务',
    categories: {
      laser_cutting: '激光切割', bending: '折弯设备', punching: '冲压设备', welding: '焊接设备',
      surface_treatment: '表面处理', auxiliary: '辅助设备', cnc_automation: '数控与自动化',
      inspection: '检测与品控', other: '设备',
    },
    services: {
      fault: '维修', maintenance: '维护保养', parameter: '参数调试', consult: '技术支持',
      parts: '备件申请', aftersales: '售后服务', other: '服务',
    },
    onsiteRepair: '现场维修',
  },
};

export function normalizeWorkOrderShortTitle(value) {
  if (typeof value !== 'string') return '';
  return redactPII(value)
    .replace(INTERNATIONAL_PHONE, ' ')
    .replace(/\[(?:手机号|身份证|邮箱|银行卡|车牌|URL)\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_LIMIT)
    .trim();
}

export function buildWorkOrderShortTitle(workOrder = {}, market = 'com') {
  const locale = market === 'cn' ? 'cn' : 'com';
  const copy = COPY[locale];
  const deviceIdentity = normalizeWorkOrderShortTitle([
    workOrder.device_brand || workOrder.brand,
    workOrder.device_model || workOrder.model,
  ].filter(Boolean).join(' '));
  const category = workOrder.category_l1 && workOrder.category_l1 !== 'other'
    ? copy.categories[workOrder.category_l1]
    : '';
  const service = workOrder.type === 'fault' && workOrder.service_mode === 'onsite'
    ? copy.onsiteRepair
    : copy.services[workOrder.type] || '';
  if (!deviceIdentity && !category && !service) return copy.fallback;
  const machine = deviceIdentity || category || copy.categories.other;
  return normalizeWorkOrderShortTitle(`${machine} ${service}`) || copy.fallback;
}

export function resolveWorkOrderShortTitle(workOrder = {}, market = 'com') {
  const persisted = normalizeWorkOrderShortTitle(workOrder.short_title);
  if (persisted) return persisted;
  const locale = market === 'cn' ? 'cn' : 'com';
  const legacy = [workOrder.issue_title, workOrder.title]
    .map(normalizeWorkOrderShortTitle)
    .find((value) => value && (locale === 'cn' ? CHINESE_TEXT.test(value) : !CHINESE_TEXT.test(value)));
  return legacy
    || buildWorkOrderShortTitle(workOrder, market)
    || COPY[market === 'cn' ? 'cn' : 'com'].fallback;
}
```

- [ ] **Step 4: Add migration 042 and schema snapshot**

Create `worker/migrations/042_work_order_short_title.sql`:

```sql
ALTER TABLE work_orders ADD COLUMN short_title TEXT;

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('042_work_order_short_title', 'Persisted short titles for service work orders');
```

Add this field beside `description` in `worker/schema.sql`:

```sql
    description TEXT NOT NULL,
    short_title TEXT,
```

Append the migration to the table in `worker/migrations/README.md`:

```markdown
| `042_work_order_short_title.sql` | 工单短标题：系统自动生成，Admin 可修正，工程师端只读 |
```

- [ ] **Step 5: Register the new tests in Worker scripts**

Add `tests/work-order-titles.test.mjs` to `pretest` so schema/title regressions block the normal Worker test command. Add the later `tests/work-order-short-title-api.test.mjs` entry in Task 3 when that file exists. Do not remove or reorder existing suites unnecessarily.

- [ ] **Step 6: Run the title unit test and verify GREEN**

Run:

```bash
cd worker
node --test tests/work-order-titles.test.mjs
```

Expected: all title tests pass, 0 fail.

- [ ] **Step 7: Commit the domain and migration**

```bash
git add worker/src/lib/workOrderTitles.js worker/tests/work-order-titles.test.mjs \
  worker/migrations/042_work_order_short_title.sql worker/schema.sql \
  worker/migrations/README.md worker/package.json
git commit -m "feat(worker): add work order short titles"
```

---

### Task 2: Persist titles at creation and expose one display title on read paths

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/work-order-titles.test.mjs`
- Modify: `worker/tests/engineer-workspace-access.test.mjs`

**Interfaces:**
- Consumes: `buildWorkOrderShortTitle()` and `resolveWorkOrderShortTitle()` from Task 1.
- Produces: `short_title` and localized `display_title` on engineer list/detail and Admin list/detail responses.
- Produces: deterministic persisted `short_title` from both HTTP and AI-tool work-order creation entry points.

- [ ] **Step 1: Add failing source-contract coverage for both creation paths**

Append to `worker/tests/work-order-titles.test.mjs`:

```js
test('both work-order creation paths persist deterministic short titles', () => {
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const httpStart = source.indexOf('async function handleCreateWorkOrder');
  const toolStart = source.indexOf('async function toolCreateWorkOrder');
  const matchingStart = source.indexOf('const SPECIALTY_ALIASES');
  const httpBody = source.slice(httpStart, matchingStart);
  const toolBody = source.slice(toolStart, httpStart);

  assert.match(httpBody, /buildWorkOrderShortTitle/);
  assert.match(httpBody, /short_title/);
  assert.match(toolBody, /buildWorkOrderShortTitle/);
  assert.match(toolBody, /short_title/);
});
```

- [ ] **Step 2: Make the existing engineer-access fixture demand title fields**

Change `insertWorkOrder()` in `worker/tests/engineer-workspace-access.test.mjs` to accept `shortTitle = null`, insert `short_title`, and seed `wo-member` with `shortTitle: 'Han\'s Laser 3015 on-site repair'`.

Add these assertions to the existing scope/detail test:

```js
assert.equal(memberTicket.short_title, "Han's Laser 3015 on-site repair");
assert.equal(memberTicket.display_title, "Han's Laser 3015 on-site repair");

const memberDetail = await api(env, '/api/workorders/wo-member');
assert.equal(memberDetail.json.short_title, "Han's Laser 3015 on-site repair");
assert.equal(memberDetail.json.display_title, "Han's Laser 3015 on-site repair");
```

Also assert that a title-less personal order receives a non-empty English `display_title`.

In the existing historical Regional Lead detail test, assert that the compact historical response contains both `short_title` and `display_title`; this covers the early-return branch in `handleGetWorkOrder()`.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
cd worker
node --test tests/work-order-titles.test.mjs tests/engineer-workspace-access.test.mjs
```

Expected: FAIL because creation statements and responses do not yet handle the title fields.

- [ ] **Step 4: Import the title functions and load device title context**

In `worker/src/index.js`, import:

```js
import {
  buildWorkOrderShortTitle,
  resolveWorkOrderShortTitle,
} from './lib/workOrderTitles.js';
```

Add one small DB helper near the work-order creation handlers:

```js
async function getWorkOrderTitleDevice(env, deviceId, customerId) {
  if (!deviceId) return null;
  return env.DB.prepare(`
    SELECT type, brand, model
    FROM devices
    WHERE id = ? AND customer_id = ?
  `).bind(deviceId, customerId).first();
}
```

- [ ] **Step 5: Persist the generated title in both creation handlers**

In both `toolCreateWorkOrder()` and `handleCreateWorkOrder()`:

```js
const titleDevice = await getWorkOrderTitleDevice(env, device_id, customerIdOrCustomerIdVariable);
const shortTitle = buildWorkOrderShortTitle({
  type,
  service_mode: serviceMode,
  category_l1: catL1,
  category_l2: category_l2 || 'other',
  device_brand: titleDevice?.brand,
  device_model: titleDevice?.model,
}, market);
```

Add `short_title` to each `INSERT INTO work_orders` column list and bind `shortTitle` beside `safeDescription`.

Include both fields in creation responses:

```js
short_title: shortTitle,
display_title: shortTitle,
```

Use the real local variable names in each handler (`customerId` in the tool path and `customer_id` in the HTTP path); do not introduce a generic alias that obscures ownership checks.

- [ ] **Step 6: Add localized `display_title` to relevant read paths**

Use the request market once per handler:

```js
const market = getRequestMarket(request);
```

For rows already selected with `w.*`, retain `short_title` and add:

```js
display_title: resolveWorkOrderShortTitle(wo, market),
```

Apply that response decoration to:

- `handleGetWorkOrders`
- `handleGetWorkOrder`
- personal scope in `handleGetEngineerTickets`
- team scope in `handleGetEngineerTickets`
- `handleAdminWorkOrders`
- `handleAdminEngineerDetail` work-order history
- `sanitizeRegionalManagementWorkOrder`
- the historical-engineer compact detail response before its early return

For explicit projections, add `w.short_title`. For team scope, return both:

```js
short_title: wo.short_title,
display_title: resolveWorkOrderShortTitle(wo, getRequestMarket(request)),
```

Do not expose customer contact fields while adding title fields.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
cd worker
node --test tests/work-order-titles.test.mjs tests/engineer-workspace-access.test.mjs
```

Expected: all focused tests pass, including personal/team/detail title assertions.

- [ ] **Step 8: Commit creation and read plumbing**

```bash
git add worker/src/index.js worker/tests/work-order-titles.test.mjs \
  worker/tests/engineer-workspace-access.test.mjs
git commit -m "feat(worker): persist and expose work order titles"
```

---

### Task 3: Add the Admin-only title update endpoint

**Files:**
- Create: `worker/tests/work-order-short-title-api.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `worker/package.json`

**Interfaces:**
- Produces: `PATCH /api/admin/workorders/:workOrderId/short-title`
- Request: `{ "short_title": "Han's Laser 3015 on-site repair" }`
- Response: `{ success: true, work_order: { id, short_title, display_title, updated_at } }`
- Permission: `canMutateFieldWorkAdmin(request._auth)` must be true.

- [ ] **Step 1: Write a real SQLite-backed failing API test**

Create `worker/tests/work-order-short-title-api.test.mjs`. Reuse the same in-memory D1 adapter shape already present in `worker/tests/engineer-workspace-access.test.mjs`, and include these exact test cases:

```js
test('Admin persists a normalized short title and writes an audit record', async (t) => {
  const env = createEnv(t);
  const { response, json } = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin',
    body: { short_title: "  Han's   Laser 3015 repair  " },
  });

  assert.equal(response.status, 200);
  assert.equal(json.work_order.short_title, "Han's Laser 3015 repair");
  assert.equal(json.work_order.display_title, "Han's Laser 3015 repair");
  assert.equal(
    env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    "Han's Laser 3015 repair",
  );
  assert.equal(
    env.DB.__sqlite.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'work_order_short_title_updated'").get().count,
    1,
  );
});

test('Admin-role staff can edit but operations staff cannot', async (t) => {
  const env = createEnv(t);
  insertStaff(env.DB.__sqlite, { id: 'staff-admin', role: 'admin' });
  insertStaff(env.DB.__sqlite, { id: 'staff-operations', role: 'operations' });

  const allowed = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'staff-admin', staffId: 'staff-admin',
    body: { short_title: 'Admin staff title' },
  });
  assert.equal(allowed.response.status, 200);

  const forbidden = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'staff-operations', staffId: 'staff-operations',
    body: { short_title: 'Operations title' },
  });
  assert.equal(forbidden.response.status, 403);
});

test('empty and over-limit titles are rejected without changing the row', async (t) => {
  const env = createEnv(t);
  for (const short_title of ['   ', 'x'.repeat(101)]) {
    const { response } = await api(env, '/api/admin/workorders/wo-title/short-title', {
      method: 'PATCH', userType: 'admin', userId: 'admin', body: { short_title },
    });
    assert.equal(response.status, 400);
  }
  assert.equal(
    env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    null,
  );
});

test('Regional Leads cannot edit work-order titles', async (t) => {
  const env = createEnv(t);
  const { response } = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'engineer', userId: 'lead-1', body: { short_title: 'Unauthorized edit' },
  });
  assert.equal(response.status, 403);
});
```

The test fixture must create `customer-1`, Regional Lead `lead-1`, and `wo-title` using `worker/schema.sql`. Add `insertStaff(sqlite, { id, role })` that inserts an active `admin_staff_accounts` row with `market_scope = 'com'` and `must_change_password = 0`. The `api()` helper signs the JWT with `signJwt`, includes `staffId` when provided, uses `https://admin.sagemro.com` for Admin requests and `https://engineer.sagemro.com` for engineer requests, and returns `{ response, json }`.

- [ ] **Step 2: Register and run the API test to verify RED**

Add `tests/work-order-short-title-api.test.mjs` to the Worker `test` script, then run:

```bash
cd worker
node --test tests/work-order-short-title-api.test.mjs
```

Expected: FAIL because the route and handler do not exist.

- [ ] **Step 3: Implement the focused Admin handler**

Add to `worker/src/index.js` near other Admin work-order mutations:

```js
async function handleAdminUpdateWorkOrderTitle(request, env) {
  try {
    if (!canMutateFieldWorkAdmin(request._auth)) {
      return errorResponse(getRequestMarket(request) === 'cn'
        ? '当前员工角色无权修改工单标题'
        : 'Your staff role cannot edit work-order titles', 403);
    }

    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const body = await request.json().catch(() => ({}));
    assertMaxLength(body.short_title, 'short_title', LIMITS.title);
    const shortTitle = normalizeWorkOrderShortTitle(body.short_title);
    if (!shortTitle) {
      return errorResponse(getRequestMarket(request) === 'cn'
        ? '请填写工单标题'
        : 'Enter a work-order title', 400);
    }

    const existing = await env.DB.prepare(
      'SELECT id, short_title, updated_at FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!existing) {
      return errorResponse(getRequestMarket(request) === 'cn'
        ? '服务工单不存在'
        : 'Work order not found', 404);
    }

    await env.DB.prepare(`
      UPDATE work_orders
      SET short_title = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(shortTitle, workOrderId).run();

    const updated = await env.DB.prepare(
      'SELECT id, short_title, updated_at FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'work_order_short_title_updated',
      beforeState: { short_title: existing.short_title },
      afterState: { short_title: updated.short_title },
    });

    return jsonResponse({
      success: true,
      work_order: {
        ...updated,
        display_title: updated.short_title,
      },
    });
  } catch (error) {
    const validation = validationErrorToResponse(error, errorResponse);
    if (validation) return validation;
    return errorResponse(error.message, 500);
  }
}
```

Also import `normalizeWorkOrderShortTitle` from the Task 1 module.

- [ ] **Step 4: Route the endpoint before generic Admin work-order handlers**

In the authenticated Admin route section, add:

```js
if (path.match(/^\/api\/admin\/workorders\/[^/]+\/short-title$/) && request.method === 'PATCH') {
  return handleAdminUpdateWorkOrderTitle(request, env);
}
```

`isKnownProtectedRoute()` already accepts `/api/admin/*`; do not broaden the route allowlist.

- [ ] **Step 5: Run the API test and verify GREEN**

Run:

```bash
cd worker
node --test tests/work-order-short-title-api.test.mjs tests/routes.test.mjs tests/validators.test.mjs
```

Expected: all tests pass; successful update persists and audits, invalid values return 400, Regional Lead returns 403.

- [ ] **Step 6: Commit the Admin mutation endpoint**

```bash
git add worker/src/index.js worker/tests/work-order-short-title-api.test.mjs worker/package.json
git commit -m "feat(worker): let admin edit work order titles"
```

---

### Task 4: Add the Admin inline title editor

**Files:**
- Modify: `admin/src/services/api.js`
- Modify: `admin/src/pages/WorkOrdersPage.jsx`
- Modify: `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`

**Interfaces:**
- Consumes: `PATCH /api/admin/workorders/:id/short-title` from Task 3.
- Produces: `updateAdminWorkOrderTitle(workOrderId, shortTitle)`.
- Produces: explicit Edit → Save/Cancel UI in the detail header; no edit control when `readOnly` is true.

- [ ] **Step 1: Write the failing Admin contract test**

Append to `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`:

```js
test('Admin can edit the persisted short title while operations stays read-only', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(api, /export async function updateAdminWorkOrderTitle/);
  assert.match(api, /workorders\/\$\{workOrderId\}\/short-title/);
  assert.match(source, /updateAdminWorkOrderTitle/);
  assert.match(source, /const \[titleEditor, setTitleEditor\]/);
  assert.match(source, /maxLength=\{100\}/);
  assert.match(source, /await updateAdminWorkOrderTitle\(detail\.id, titleEditor\.value\)/);
  assert.match(source, /setDetail\(\(current\) => current\?\.id === detail\.id/);
  assert.match(source, /setData\(\(current\) => \(\{[\s\S]*short_title/);
  assert.match(source, /\{!readOnly && [\s\S]*titleEditor\.open/);
  assert.match(source, /titleEditor\.error/);
  assert.doesNotMatch(source, /window\.prompt/);
});
```

- [ ] **Step 2: Run the focused Admin test and verify RED**

Run:

```bash
cd admin
node --test src/pages/WorkOrdersPage.review-flow.test.mjs
```

Expected: FAIL because the API function and editor state do not exist.

- [ ] **Step 3: Add the Admin API client function**

In `admin/src/services/api.js` beside other work-order mutations:

```js
export async function updateAdminWorkOrderTitle(workOrderId, shortTitle) {
  return request(`/api/admin/workorders/${workOrderId}/short-title`, {
    method: 'PATCH',
    body: JSON.stringify({ short_title: shortTitle }),
  });
}
```

- [ ] **Step 4: Add localized copy and editor state**

Import `updateAdminWorkOrderTitle`. Add these keys to both `TEXT.en` and `TEXT.cn`:

```js
// English
workOrderTitle: 'Work-order title',
editWorkOrderTitle: 'Edit title',
saveWorkOrderTitle: 'Save title',
cancelWorkOrderTitle: 'Cancel',
workOrderTitlePlaceholder: 'Short task title',
workOrderTitleUpdated: 'Work-order title updated.',
workOrderTitleUpdateFailed: 'Failed to update the work-order title',

// Chinese
workOrderTitle: '工单标题',
editWorkOrderTitle: '编辑标题',
saveWorkOrderTitle: '保存标题',
cancelWorkOrderTitle: '取消',
workOrderTitlePlaceholder: '简短任务标题',
workOrderTitleUpdated: '工单标题已更新。',
workOrderTitleUpdateFailed: '工单标题更新失败',
```

Add state:

```js
const [titleEditor, setTitleEditor] = useState({
  open: false,
  value: '',
  saving: false,
  error: '',
});
```

Reset it in `openDetail()` before loading the new order.

- [ ] **Step 5: Implement Edit, Save, and Cancel behavior**

Add:

```js
function beginTitleEdit() {
  if (readOnly || !detail) return;
  setTitleEditor({
    open: true,
    value: detail.short_title || detail.display_title || '',
    saving: false,
    error: '',
  });
}

function cancelTitleEdit() {
  setTitleEditor({ open: false, value: '', saving: false, error: '' });
}

async function saveTitleEdit() {
  if (readOnly || !detail?.id || !titleEditor.value.trim()) return;
  setTitleEditor((current) => ({ ...current, saving: true, error: '' }));
  try {
    const response = await updateAdminWorkOrderTitle(detail.id, titleEditor.value);
    const saved = response.work_order;
    setDetail((current) => current?.id === detail.id ? { ...current, ...saved } : current);
    setData((current) => ({
      ...current,
      list: current.list.map((item) => item.id === detail.id ? { ...item, ...saved } : item),
    }));
    setMessage(t.workOrderTitleUpdated);
    cancelTitleEdit();
  } catch (error) {
    setTitleEditor((current) => ({
      ...current,
      saving: false,
      error: error.message || t.workOrderTitleUpdateFailed,
    }));
  }
}
```

On failure, keep the editor open and preserve the attempted value.

- [ ] **Step 6: Render the title in the sticky work-order detail header**

In the existing sticky drawer header, keep the service-record kicker, replace the generic drawer heading with `detail.display_title || t.drawerTitle` after detail loads, and show the order number as secondary text. When editing, replace the title heading with one input:

```jsx
<input
  value={titleEditor.value}
  onChange={(event) => setTitleEditor((current) => ({ ...current, value: event.target.value }))}
  maxLength={100}
  aria-label={t.workOrderTitle}
  placeholder={t.workOrderTitlePlaceholder}
  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base font-semibold"
/>
```

Show Edit only inside `{!readOnly && (...)}`. Show Save/Cancel only while editing. Disable Save while saving or when `value.trim()` is empty. Render `titleEditor.error` directly under the input. Keep the order number, status, and full description below the title.

- [ ] **Step 7: Run focused Admin verification**

Run:

```bash
cd admin
node --test src/pages/WorkOrdersPage.review-flow.test.mjs
npm run build
```

Expected: all review-flow tests pass and Vite build exits 0.

- [ ] **Step 8: Commit the Admin editor**

```bash
git add admin/src/services/api.js admin/src/pages/WorkOrdersPage.jsx \
  admin/src/pages/WorkOrdersPage.review-flow.test.mjs
git commit -m "feat(admin): edit work order short titles"
```

---

### Task 5: Build the approved responsive eight-column engineer list

**Files:**
- Modify: `frontend/src/components/Engineer/engineerWorkOrderDisplay.js`
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`
- Modify: `frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

**Interfaces:**
- Consumes: `ticket.short_title` and `ticket.display_title` from the Worker.
- Preserves: `getEngineerWorkOrderTitle(ticket, isCn, fallback)` public signature.
- Produces: desktop columns `order | title | customer | equipment/issue | region | status | next step | updated | detail`.

- [ ] **Step 1: Write failing title-precedence and layout contracts**

Append or update tests in `frontend/tests/engineer-work-order-experience-contract.test.mjs`:

```js
test('saved and Worker-resolved titles precede legacy customer text', async () => {
  const { getEngineerWorkOrderTitle } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');

  assert.equal(getEngineerWorkOrderTitle({
    short_title: '济南 3015 维修',
    description: 'English customer description.',
  }, false, 'Service task'), '济南 3015 维修');
  assert.equal(getEngineerWorkOrderTitle({
    display_title: "Han's Laser 3015 on-site repair",
    description: '设备类型：激光切割机。',
  }, false, 'Service task'), "Han's Laser 3015 on-site repair");
});

test('engineer list uses eight desktop information columns and a separate mobile card', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  for (const label of ['Work order', 'Task name', 'Customer', 'Equipment / issue', 'Region', 'Status', 'Next step', 'Updated']) {
    assert.match(list, new RegExp(label.replace('/', '\\/')));
  }
  assert.match(list, /min-\[1280px\]:grid/);
  assert.match(list, /min-\[1280px\]:hidden/);
  assert.match(list, /line-clamp-2/);
  assert.match(list, /grid-cols-\[132px_minmax\(160px,1\.05fr\)_92px_minmax\(175px,1\.1fr\)_96px_120px_minmax\(190px,1\.25fr\)_104px_36px\]/);
  assert.doesNotMatch(list, /grid-cols-\[1\.05fr_2\.1fr_\.9fr_1\.5fr_\.8fr_36px\]/);
});
```

- [ ] **Step 2: Run the focused frontend test and verify RED**

Run:

```bash
cd frontend
node --test tests/engineer-work-order-experience-contract.test.mjs
```

Expected: FAIL on title precedence and the approved desktop grid.

- [ ] **Step 3: Update title precedence without filtering saved Admin text by language**

Change `getEngineerWorkOrderTitle()` to:

```js
export function getEngineerWorkOrderTitle(ticket = {}, isCn = false, fallback = '') {
  const persisted = redactContactInfo(String(ticket.short_title || ticket.display_title || '')).trim();
  if (persisted) return persisted;

  const candidates = [ticket.issue_title, ticket.title, ticket.description]
    .map((value) => redactContactInfo(String(value || '')).match(/^[^。.!?\n]+[。.!?]?/)?.[0].trim())
    .filter(Boolean);
  const localized = candidates.find((value) => (isCn ? hasChineseText(value) : !hasChineseText(value)));
  return localized || fallback || (isCn ? '服务任务' : 'Service task');
}
```

- [ ] **Step 4: Replace the desktop row with the approved nine-track grid**

Use this exact desktop template in `EngineerWorkOrderList.jsx`; its minimum tracks plus 12 px gaps fit the existing content width at a 1280 px viewport:

```txt
min-[1280px]:grid-cols-[132px_minmax(160px,1.05fr)_92px_minmax(175px,1.1fr)_96px_120px_minmax(190px,1.25fr)_104px_36px]
```

The desktop header labels are:

```js
[
  isCn ? '工单号' : 'Work order',
  isCn ? '工单名称' : 'Task name',
  isCn ? '客户' : 'Customer',
  isCn ? '设备 / 故障' : 'Equipment / issue',
  isCn ? '地区' : 'Region',
  isCn ? '状态' : 'Status',
  copy.nextStep,
  copy.updated,
]
```

Each desktop row must use one outer `<button>` and these values in order:

```jsx
<strong>{ticket.order_no || ticket.id}</strong>
<strong className="truncate">{getEngineerWorkOrderTitle(ticket, isCn, copy.taskFallback)}</strong>
<span className="truncate">{ticket.customer_name || '—'}</span>
<span className="truncate">{getMachineLine(ticket) || copy.machineFallback}</span>
<span className="truncate">{ticket.customer_region || copy.regionFallback}</span>
<span>{statusLabels[ticket.status] || ticket.status}</span>
<strong className="line-clamp-2">{getNextAction(ticket)}</strong>
<span>{formatUpdated(ticket.updated_at || ticket.created_at, isCn)}</span>
<span aria-hidden="true"><ChevronRight /></span>
```

Target `min-h-[76px]`; use fixed column widths for operational metadata and flexible widths only for title, equipment/issue, and next step.

- [ ] **Step 5: Add the separate mobile card**

Below 1280 CSS px, render one card with this order:

1. title + status
2. order number
3. customer
4. equipment/issue + region
5. next-step label and copy
6. updated time + visible detail affordance

Use `min-[1280px]:hidden` for the card and `hidden min-[1280px]:grid` for the desktop row. Do not use horizontal scrolling. Keep one outer interactive element and no nested button.

- [ ] **Step 6: Keep Regional Lead grouping and enlarge its operational labels**

Continue rendering `EngineerWorkOrderList embedded` inside each engineer group. Do not flatten group names. Raise group-name, group-detail, work-order-count, and filter copy to the type scale finalized in Task 6; do not change group ordering or collapse behavior.

- [ ] **Step 7: Run focused frontend tests and build**

Run:

```bash
cd frontend
node --test tests/engineer-work-order-experience-contract.test.mjs
npm run lint
npm run build
```

Expected: contract test passes, ESLint reports 0 errors, Vite build exits 0.

- [ ] **Step 8: Commit the responsive list**

```bash
git add frontend/src/components/Engineer/engineerWorkOrderDisplay.js \
  frontend/src/components/Engineer/EngineerWorkOrderList.jsx \
  frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx \
  frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "feat(engineer): use dense responsive work order list"
```

---

### Task 6: Apply the approved typography scale across the engineer workspace

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerMetricOverview.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderList.jsx`
- Modify: `frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx`
- Modify: `frontend/tests/engineer-work-order-experience-contract.test.mjs`

**Interfaces:**
- Preserves all component props and behavior.
- Produces the approved minimum type sizes and readable line heights.

- [ ] **Step 1: Add a failing typography contract**

Append:

```js
test('engineer workspace no longer uses 9px or 10px operational text', () => {
  const files = [
    'frontend/src/components/Engineer/EngineerMetricOverview.jsx',
    'frontend/src/components/Engineer/EngineerWorkspace.jsx',
    'frontend/src/components/Engineer/EngineerWorkOrderList.jsx',
    'frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx',
    'frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /text-\[(?:9|10)px\]/, `${file} still uses undersized operational text`);
  }

  const metrics = read(files[0]);
  const list = read(files[2]);
  assert.match(metrics, /text-\[30px\]/);
  assert.match(list, /text-\[(?:15|16)px\]/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
cd frontend
node --test tests/engineer-work-order-experience-contract.test.mjs
```

Expected: FAIL listing the remaining 9px and 10px classes.

- [ ] **Step 3: Apply the metric typography**

In `EngineerMetricOverview.jsx`:

- section heading: `text-base`
- explanatory note: `text-[13px] leading-5`
- personal/team scope buttons: `text-xs`
- metric label: `text-xs leading-4`
- metric value: `text-[30px] leading-none`
- keep eight cards and current colors; do not increase card count or add decoration

- [ ] **Step 4: Apply header and calendar typography**

In `EngineerWorkspace.jsx`:

- workspace title: `text-xl`
- workspace subtitle: `text-[13px]`
- locale, profile, and sign-out controls: `text-xs`
- calendar heading: `text-base`
- calendar note: `text-[13px] leading-5`
- Open calendar: `text-xs`
- weekday labels and dates: `text-xs`
- range/count notes and availability buttons: `text-xs`
- keep the existing max-width and metric/calendar proportions

- [ ] **Step 5: Apply list and team typography**

In personal and team lists:

- list title: `text-xl`
- list note: `text-[13px]`
- table headers: `text-[11px]`
- task title: `text-[15px]`
- work-order number: `text-sm`
- next step: `text-[13px] leading-5`
- customer, equipment, region, and timestamps: `text-xs` or `text-[13px]` according to emphasis
- status and filter controls: `text-xs`
- team group name: `text-[15px]`; group note/count: `text-xs`
- do not increase desktop row beyond the 68–76 px target unless the next step needs its allowed second line

- [ ] **Step 6: Apply detail-page typography**

In `EngineerWorkOrderDetail.jsx`:

- kicker/order number: `text-xs`
- main title remains `text-2xl` and uses the new short title
- status pill: `text-xs`
- metadata labels: `text-xs`; values: `text-sm`
- next-step label: `text-xs`; action: `text-sm leading-6`
- tabs: `text-[13px]`
- section labels: `text-xs`
- section headings/body: at least `text-sm`
- AI tags, attachment count, checklist numbering, checklist copy, management metadata, and support copy: at least `text-xs`, with checklist copy `text-sm leading-6`

Do not change action availability, tab state, sticky behavior, or shared quote/material/report component logic.

- [ ] **Step 7: Run focused verification and inspect the diff**

Run:

```bash
cd frontend
node --test tests/engineer-work-order-experience-contract.test.mjs
npm run lint
npm run build
cd ..
git diff --check
git diff --stat
```

Expected: all focused tests pass, lint/build exit 0, no whitespace errors, and changes remain confined to the approved engineer components/tests.

- [ ] **Step 8: Perform local visual verification**

Start the frontend with its normal local API configuration:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Using the browser automation skill and an authenticated engineer session, inspect:

- 1440 × 1000: all eight labels plus detail affordance visible, no large unused column gaps, ordinary rows 68–76 px, next step at most two lines.
- 1280 × 900: desktop layout still fits without page-level horizontal scrolling.
- 1279 × 900: switches to cards.
- 390 × 844: no horizontal scrolling; title, status, next step, and detail action remain visible.
- Regional Lead personal/team switch: personal metrics remain personal; team work orders remain grouped by engineer name.
- Detail page: saved short title is the heading; full equipment/issue text remains under Current Task Context.

If a local authenticated session is unavailable, do not weaken the acceptance criteria; complete the automated checks now and perform the same viewport inspection after deployment using the existing production session.

- [ ] **Step 9: Commit the typography update**

```bash
git add frontend/src/components/Engineer/EngineerMetricOverview.jsx \
  frontend/src/components/Engineer/EngineerWorkspace.jsx \
  frontend/src/components/Engineer/EngineerWorkOrderList.jsx \
  frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx \
  frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx \
  frontend/tests/engineer-work-order-experience-contract.test.mjs
git commit -m "style(engineer): improve workspace readability"
```

---

### Task 7: Run the full international verification and open the main PR

**Files:**
- Verify only; modify files only to fix failures directly caused by Tasks 1–6.

**Interfaces:**
- Produces: a reviewable PR targeting `main` with no unrelated changes.

- [ ] **Step 1: Run the exact repository verification commands**

```bash
cd worker
npm install --no-audit --no-fund
npm run pretest
npm test

cd ../frontend
npm install --no-audit --no-fund
npm run lint
npm test
npm run build

cd ../admin
npm install --no-audit --no-fund
npm test
npm run build

cd ../e2e
npm install --no-audit --no-fund
npx playwright install chromium
npm test
```

Expected: every command exits 0; Worker golden set reports no failures; frontend/Admin builds complete; all E2E contracts and browser lifecycle tests pass.

- [ ] **Step 2: Re-run the focused security and behavior tests**

```bash
cd ../worker
node --test tests/work-order-titles.test.mjs \
  tests/work-order-short-title-api.test.mjs \
  tests/engineer-workspace-access.test.mjs \
  tests/routes.test.mjs tests/validators.test.mjs
```

Expected: 0 failures; Admin update persists/audits; invalid title and Regional Lead edit are rejected.

- [ ] **Step 3: Review the final diff against the approved specification**

```bash
cd ..
git status --short
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- worker/migrations/042_work_order_short_title.sql \
  worker/src/lib/workOrderTitles.js frontend/src/components/Engineer \
  admin/src/pages/WorkOrdersPage.jsx
```

Verify explicitly:

- no inbox code
- no deployment workflow or Wrangler config edits
- no engineer/Regional Lead title editor
- no language filtering of saved Admin title
- no 9px/10px ordinary operational text in the touched engineer files
- no hidden desktop operational columns at 1280 px or wider

- [ ] **Step 4: Push the feature branch and open a PR to main**

```bash
git push -u origin codex/engineer-density-title
gh pr create \
  --base main \
  --head codex/engineer-density-title \
  --title "feat: improve engineer work-order density and titles" \
  --body "Implements the approved eight-column engineer list, workspace typography scale, deterministic short work-order titles, and Admin-only title editing. Includes Worker, frontend, and Admin tests plus migration 042."
```

Expected: PR URL returned; PR targets `main` and contains only the feature commits and approved documentation.

- [ ] **Step 5: Wait for PR checks and fix only feature-caused failures**

```bash
main_pr_number="$(gh pr view --json number --jq .number)"
gh pr checks "$main_pr_number" --watch
```

Expected: all required checks pass. Do not merge while any check is pending or failing.

- [ ] **Step 6: Obtain explicit user approval before production changes**

Report the PR URL, fresh test/build evidence, migration/backup commands, and the exact deployment order. Wait for the user's explicit authorization before executing Task 8, because Task 8 writes both production databases and merges code that triggers production deployment.

---

### Task 8: Apply both D1 migrations, merge main, and verify international production

**Files:**
- Production state change only; no code edits expected.

**Interfaces:**
- Consumes: approved main PR and migration 042.
- Produces: compatible schemas in both D1 databases before the new Worker is deployed.

- [ ] **Step 1: Confirm migration 042 is not already applied**

From the feature worktree:

```bash
cd worker
npx wrangler d1 execute sagemro-db --env production --remote \
  --command "SELECT version FROM _migrations WHERE version = '042_work_order_short_title';"
npx wrangler d1 execute sagemro-db-cn --env production --remote \
  --command "SELECT version FROM _migrations WHERE version = '042_work_order_short_title';"
```

Expected before first application: no matching row in either database. If one database already has the marker, inspect `PRAGMA table_info(work_orders)` before deciding whether to run anything; do not blindly re-run `ALTER TABLE`.

- [ ] **Step 2: Create fresh production backups before changing either schema**

Use the existing guarded D1 operations script and a narrow temporary directory:

```bash
backup_dir="$(mktemp -d /tmp/sagemro-title-migration.XXXXXX)"
backup_path_file="/tmp/sagemro-title-migration-path"
printf '%s\n' "$backup_dir" > "$backup_path_file"
node scripts/d1-operations.mjs backup --market com --mode remote \
  --confirm-production --output "$backup_dir/sagemro-db-before-042.sql"
node scripts/d1-operations.mjs backup --market cn --mode remote \
  --confirm-production --output "$backup_dir/sagemro-db-cn-before-042.sql"
test -s "$backup_dir/sagemro-db-before-042.sql"
test -s "$backup_dir/sagemro-db-cn-before-042.sql"
```

Expected: two non-empty backup files. Keep the directory until both deployments and production verification complete; then remove only this exact temporary directory.

- [ ] **Step 3: Apply the nullable migration to both production databases**

```bash
npx wrangler d1 execute sagemro-db --env production --remote \
  --file migrations/042_work_order_short_title.sql
npx wrangler d1 execute sagemro-db-cn --env production --remote \
  --file migrations/042_work_order_short_title.sql
```

Expected: both commands succeed. This schema change is backward compatible because the existing Worker ignores the nullable column.

- [ ] **Step 4: Verify both schemas and migration markers**

```bash
npx wrangler d1 execute sagemro-db --env production --remote \
  --command "SELECT name, type FROM pragma_table_info('work_orders') WHERE name = 'short_title'; SELECT version FROM _migrations WHERE version = '042_work_order_short_title';"
npx wrangler d1 execute sagemro-db-cn --env production --remote \
  --command "SELECT name, type FROM pragma_table_info('work_orders') WHERE name = 'short_title'; SELECT version FROM _migrations WHERE version = '042_work_order_short_title';"
```

Expected: each database returns `short_title | TEXT` and the 042 migration marker.

- [ ] **Step 5: Merge the main PR only after both database checks pass**

```bash
main_pr_number="$(gh pr view codex/engineer-density-title --json number --jq .number)"
gh pr merge "$main_pr_number" --merge --delete-branch
```

Expected: merge succeeds and produces a main merge commit.

- [ ] **Step 6: Wait for the main deployment workflow**

```bash
main_run_id="$(gh run list --workflow deploy.yml --branch main --event push --limit 1 --json databaseId --jq '.[0].databaseId')"
test -n "$main_run_id"
gh run watch "$main_run_id" --exit-status
```

Expected: test, frontend, Admin, and Worker deployment jobs all succeed.

- [ ] **Step 7: Verify international production**

```bash
curl -fsS https://api.sagemro.com/health
curl -fsSI https://sagemro.com/ | head -n 1
curl -fsSI https://admin.sagemro.com/ | head -n 1
curl -fsSI https://engineer.sagemro.com/ | head -n 1
```

Expected: API JSON status is `ok`; all three sites return HTTP 200.

Using the existing authenticated production session, repeat the 1440, 1280, 1279, and 390 px visual checks from Task 6. Verify English UI copy only. In Admin, confirm the editor is visible for Admin and absent in the read-only operations view. Do not change a real production title merely for smoke testing; endpoint persistence is covered by the SQLite API test.

- [ ] **Step 8: Retain the backup paths for the China rollout**

Record the exact path printed by `cat /tmp/sagemro-title-migration-path` in the deployment notes. Do not delete it until Task 9 production verification succeeds.

---

### Task 9: Synchronize the feature to China edition and deploy Aliyun ECS

**Files:**
- Same feature files as Tasks 1–6, applied to a branch based on current `origin/china-edition`.

**Interfaces:**
- Produces: a China-edition PR/merge preserving China-specific localization and the existing inbox rollback.

- [ ] **Step 1: Create an isolated China synchronization worktree**

Use `superpowers:using-git-worktrees` and create:

```bash
git fetch origin
git worktree add .worktrees/engineer-density-title-cn \
  -b codex/engineer-density-title-cn origin/china-edition
```

Do not reuse the main worktree or modify the existing `china-edition` worktree.

- [ ] **Step 2: Cherry-pick the feature commits in order**

Resolve the already merged feature commits from `origin/main` by exact commit subjects, then cherry-pick them in order:

```bash
for subject in \
  "feat(admin): edit work order short titles" \
  "feat(engineer): use dense responsive work order list" \
  "style(engineer): improve workspace readability"
do
  sha="$(git log origin/main --format=%H --grep="^${subject}$" -1)"
  test -n "$sha"
  git cherry-pick "$sha"
done
```

Do not cherry-pick the migration/domain/API commits into `china-edition`: the Worker deploys only from `main`, and carrying those commits onto the China branch would add duplicate schema/API changes to a branch that never deploys the Worker.

If `admin/src/pages/WorkOrdersPage.jsx`, engineer components, or tests conflict, preserve all China-edition behavior from `origin/china-edition`, especially:

- localized Chinese engineer UI
- personal/team Regional Lead behavior
- payment and work-order detail actions
- reverted inbox code remains reverted

Resolve only the feature lines; do not merge `origin/main` wholesale.

- [ ] **Step 3: Run the full China-branch verification**

Run the complete China frontend/Admin checks. Worker source is intentionally unchanged on this branch, so the already successful main Worker suite remains the release evidence:

```bash
cd frontend && npm install --no-audit --no-fund && npm run lint && npm test && npm run build
cd ../admin && npm install --no-audit --no-fund && npm test && npm run build
```

Expected: every command exits 0. Verify the built frontend contains Chinese strings such as `我的工单`, `工单名称`, `设备 / 故障`, `下一步`, and `当前任务上下文`, and does not render English interface labels on the `.cn` host path.

- [ ] **Step 4: Push and merge the China feature branch**

```bash
git push -u origin codex/engineer-density-title-cn
gh pr create \
  --base china-edition \
  --head codex/engineer-density-title-cn \
  --title "feat(cn): sync engineer work-order density and titles" \
  --body "Synchronizes the approved engineer list, typography, and Admin title editor while consuming the shared title API already deployed from main. Preserves China-specific localization and inbox rollback."
```

Because `deploy.yml` PR tests only target `main`, rely on the fresh complete local verification above and inspect the PR diff before merge.

Report the China PR URL and local test evidence, then obtain explicit user approval before merging and triggering China production deployment.

```bash
cn_pr_number="$(gh pr view codex/engineer-density-title-cn --json number --jq .number)"
gh pr view "$cn_pr_number" --json files \
  --jq '.files[] | [.path, .additions, .deletions] | @tsv'
gh pr merge "$cn_pr_number" --merge --delete-branch
```

Expected: merge into `china-edition` succeeds. Its automatic Cloudflare Pages deployment is auxiliary and does not constitute China production deployment.

- [ ] **Step 5: Wait for the China branch Cloudflare workflow**

```bash
cn_pages_run_id="$(gh run list --workflow deploy.yml --branch china-edition --event push --limit 1 --json databaseId --jq '.[0].databaseId')"
test -n "$cn_pages_run_id"
gh run watch "$cn_pages_run_id" --exit-status
```

Expected: tests plus China Pages/Admin auxiliary deployments succeed; Worker is not deployed from this branch.

- [ ] **Step 6: Trigger and wait for the Aliyun ECS production deployment**

```bash
gh workflow run aliyun-cn-deploy.yml --ref china-edition
aliyun_run_id="$(gh run list --workflow aliyun-cn-deploy.yml --branch china-edition --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')"
test -n "$aliyun_run_id"
gh run watch "$aliyun_run_id" --exit-status
```

Expected: build, upload, activation, nginx validation/reload, health checks, and temporary security-group cleanup all succeed. Do not cancel the run while the temporary SSH rule exists.

- [ ] **Step 7: Verify China production**

```bash
curl -fsS https://api.sagemro.cn/health
curl -fsSI https://sagemro.cn/ | head -n 1
curl -fsSI https://admin.sagemro.cn/ | head -n 1
curl -fsSI https://engineer.sagemro.cn/ | head -n 1
```

Expected: API JSON status is `ok`; all three sites return HTTP 200.

In a real browser with the existing authenticated session, verify:

- engineer page is not blank and has no console errors
- Chinese UI only
- 1440/1280 wide layouts use the approved eight information columns plus detail affordance
- 1279/390 layouts use cards without horizontal scrolling
- typography matches the approved scale
- personal/team metrics and engineer-name grouping remain correct
- short title appears in list/detail; full device data remains in Current Task Context
- Admin title editor appears only for Admin

- [ ] **Step 8: Record final evidence**

Capture and report:

- main PR URL and merge commit
- China PR URL and merge commit
- both D1 migration verification outputs
- main Cloudflare deployment run URL
- China Cloudflare auxiliary run URL
- Aliyun ECS deployment run URL
- full test counts and build results
- production HTTP checks
- browser verification result for both locales and both responsive layouts

Do not claim completion until every required check above has fresh successful evidence.

- [ ] **Step 9: Remove only the temporary migration backup directory after all checks pass**

Validate and delete the exact directory created in Task 8:

```bash
IFS= read -r backup_dir < /tmp/sagemro-title-migration-path
case "$backup_dir" in
  /tmp/sagemro-title-migration.*) rm -rf -- "$backup_dir" && rm -f -- /tmp/sagemro-title-migration-path ;;
  *) echo "Unexpected backup path: $backup_dir"; exit 1 ;;
esac
```

Expected: only the two temporary pre-migration backup files are removed after successful international and China production verification.
