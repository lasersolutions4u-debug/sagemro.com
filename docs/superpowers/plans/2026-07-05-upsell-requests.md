# Upsell Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the independent **增购与改造需求** module so engineers can submit field opportunities from the workspace or a work order, and Admin can triage, assign, and update them.

**Architecture:** Add a new D1 table `upsell_requests` and focused Worker handlers for engineer and Admin APIs. Add one shared frontend form component for engineer submissions, wire it into `EngineerWorkspace` and `WorkOrderDetailModal`, then add an Admin `UpsellRequestsPage` that follows the existing page/service patterns.

**Tech Stack:** Cloudflare Workers, D1 SQL migrations, React 19, Vite, Node `node:test`, existing fetch-based API services.

## Global Constraints

- Product copy must use **增购与改造需求** and must not position SAGEMRO as a complete-machine new equipment sales platform.
- Business scope includes parts/consumables, laser peripheral equipment, post-processing equipment, automation retrofit, bending tooling, and other retrofit needs.
- Engineers can create and view their own requests only.
- Admin can list, view, and update all requests.
- The module is independent and can optionally link to `work_order_id`.
- If a D1 migration is added, production D1 must be manually migrated before Worker deployment.
- Keep changes surgical; do not refactor unrelated Worker, frontend, or Admin code.

---

## File Structure

- Create `worker/migrations/029_upsell_requests.sql`: creates `upsell_requests` and records migration.
- Modify `worker/schema.sql`: mirrors the table and migration record for local schema reference.
- Modify `worker/src/index.js`: adds validation helpers and routes for engineer/Admin upsell request APIs.
- Create `worker/tests/upsell-requests.test.mjs`: tests creation, permissions, list, detail, and Admin updates.
- Modify `worker/package.json`: includes the new test file in `test` and `test:unit`.
- Modify `frontend/src/services/api.js`: adds engineer-side API helpers.
- Create `frontend/src/components/Upsell/UpsellRequestModal.jsx`: shared engineer submission/status modal.
- Modify `frontend/src/components/Engineer/EngineerWorkspace.jsx`: adds workspace entry and a recent submitted-request status list.
- Modify `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`: adds work-order-linked entry.
- Create `frontend/tests/upsell-request-model.test.mjs`: tests frontend payload/status model helpers.
- Modify `admin/src/services/api.js`: adds Admin upsell request API helpers.
- Create `admin/src/pages/UpsellRequestsPage.jsx`: Admin demand pool UI.
- Modify `admin/src/App.jsx`: adds sidebar nav item and route.

---

### Task 1: D1 Schema and Worker API

**Files:**
- Create: `worker/migrations/029_upsell_requests.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.js`
- Create: `worker/tests/upsell-requests.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**
- Produces: `POST /api/upsell-requests`, `GET /api/upsell-requests/mine`, `GET /api/admin/upsell-requests`, `GET /api/admin/upsell-requests/:id`, `PATCH /api/admin/upsell-requests/:id`.
- Consumes: existing JWT auth helpers, existing Admin auth checks, existing work-order access check style used by material requests.
- Request payload for engineer create:

```json
{
  "source_type": "engineer_workspace",
  "work_order_id": "",
  "category": "laser_peripheral",
  "title": "客户考虑增加除尘装置",
  "description": "现场粉尘较大，客户希望了解除尘方案。",
  "site_context": "光纤激光切割机，车间已有集中气源。",
  "expected_timeline": "within_3_months",
  "budget_signal": "comparing_quotes",
  "contact_name": "王经理",
  "contact_phone": "13800000000"
}
```

- Response shape:

```json
{
  "request": {
    "id": "usr_...",
    "market": "cn",
    "source_type": "engineer_workspace",
    "work_order_id": null,
    "customer_id": null,
    "engineer_id": "engineer-1",
    "category": "laser_peripheral",
    "title": "客户考虑增加除尘装置",
    "description": "现场粉尘较大，客户希望了解除尘方案。",
    "site_context": "光纤激光切割机，车间已有集中气源。",
    "expected_timeline": "within_3_months",
    "budget_signal": "comparing_quotes",
    "contact_name": "王经理",
    "contact_phone": "13800000000",
    "status": "pending_assignment",
    "assigned_sales_owner": "",
    "admin_note": "",
    "quote_status": "not_started",
    "deal_result": "undecided",
    "handover_note": ""
  }
}
```

- [ ] **Step 1: Write failing Worker tests**

Create `worker/tests/upsell-requests.test.mjs` with this structure. Match the existing `material-requests.test.mjs` mock DB pattern, but add `upsell_requests` behavior:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createStatement(env, sql) {
  return {
    args: [],
    bind(...args) {
      this.args = args;
      return this;
    },
    async first() {
      const normalized = normalizeSql(sql);

      if (/SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { ...order } : null;
      }

      if (/SELECT COUNT\(\*\) as count FROM upsell_requests/i.test(normalized)) {
        return { count: env.__upsellRequests.length };
      }

      if (/SELECT \* FROM upsell_requests WHERE id = \?/i.test(normalized)) {
        return env.__upsellRequests.find((item) => item.id === this.args[0]) || null;
      }

      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);

      if (/FROM upsell_requests/i.test(normalized)) {
        let results = [...env.__upsellRequests];
        if (/engineer_id = \?/i.test(normalized)) {
          results = results.filter((item) => item.engineer_id === this.args[0]);
        }
        if (/status = \?/i.test(normalized)) {
          const status = this.args.find((arg) => [
            'pending_assignment',
            'sales_following',
            'quoted',
            'won',
            'lost',
            'delivery_support',
            'completed',
          ].includes(arg));
          if (status) results = results.filter((item) => item.status === status);
        }
        return { results };
      }

      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO upsell_requests/i.test(normalized)) {
        const [
          id,
          market,
          source_type,
          work_order_id,
          customer_id,
          engineer_id,
          category,
          title,
          description,
          site_context,
          expected_timeline,
          budget_signal,
          contact_name,
          contact_phone,
          status,
          assigned_sales_owner,
          admin_note,
          quote_status,
          deal_result,
          handover_note,
        ] = this.args;
        env.__upsellRequests.push({
          id,
          market,
          source_type,
          work_order_id,
          customer_id,
          engineer_id,
          category,
          title,
          description,
          site_context,
          expected_timeline,
          budget_signal,
          contact_name,
          contact_phone,
          status,
          assigned_sales_owner,
          admin_note,
          quote_status,
          deal_result,
          handover_note,
        });
      }

      if (/UPDATE upsell_requests SET/i.test(normalized)) {
        const id = this.args.at(-1);
        const request = env.__upsellRequests.find((item) => item.id === id);
        if (!request) return { success: true, meta: { changes: 0 } };
        [
          request.status,
          request.assigned_sales_owner,
          request.admin_note,
          request.quote_status,
          request.deal_result,
          request.handover_note,
        ] = this.args.slice(0, 6);
        return { success: true, meta: { changes: 1 } };
      }

      if (/INSERT INTO audit_logs/i.test(normalized)) {
        env.__auditLogs.push({ args: this.args });
      }

      return { success: true, meta: { changes: 1 } };
    },
  };
}

function createEnv() {
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    __auditLogs: [],
    __upsellRequests: [],
    __workOrders: [
      {
        id: 'wo-1',
        customer_id: 'customer-1',
        engineer_id: 'engineer-1',
        assigned_regional_lead_id: 'lead-1',
        status: 'in_progress',
      },
    ],
    DB: {
      prepare(sql) {
        return createStatement(env, sql);
      },
    },
    KV: {
      async get() { return null; },
      async put() {},
    },
  };
  return env;
}

async function token(env, userType, userId) {
  return signJwt({
    userId,
    userType,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function api(env, path, { method = 'GET', body, userType = 'engineer', userId = 'engineer-1', origin = 'https://engineer.sagemro.cn' } = {}) {
  const jwt = await token(env, userType, userId);
  const response = await worker.fetch(new Request(`https://api.sagemro.cn${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('engineer can create a workspace upsell request', async () => {
  const env = createEnv();
  const result = await api(env, '/api/upsell-requests', {
    method: 'POST',
    body: {
      source_type: 'engineer_workspace',
      category: 'laser_peripheral',
      title: '客户考虑增加除尘装置',
      description: '现场粉尘较大，客户希望了解除尘方案。',
      site_context: '光纤激光切割机，车间已有集中气源。',
      expected_timeline: 'within_3_months',
      budget_signal: 'comparing_quotes',
      contact_name: '王经理',
      contact_phone: '13800000000',
    },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.json.request.status, 'pending_assignment');
  assert.equal(result.json.request.source_type, 'engineer_workspace');
  assert.equal(result.json.request.engineer_id, 'engineer-1');
  assert.equal(env.__upsellRequests.length, 1);
});

test('engineer can create a work-order-linked upsell request for assigned order', async () => {
  const env = createEnv();
  const result = await api(env, '/api/upsell-requests', {
    method: 'POST',
    body: {
      source_type: 'work_order',
      work_order_id: 'wo-1',
      category: 'automation_retrofit',
      title: '客户咨询桁架上下料改造',
      description: '客户希望降低人工上下料强度。',
    },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.json.request.work_order_id, 'wo-1');
  assert.equal(result.json.request.customer_id, 'customer-1');
});

test('engineer cannot create an upsell request for another engineer work order', async () => {
  const env = createEnv();
  const result = await api(env, '/api/upsell-requests', {
    method: 'POST',
    userId: 'engineer-2',
    body: {
      source_type: 'work_order',
      work_order_id: 'wo-1',
      category: 'parts_consumables',
      title: '客户需要喷嘴',
      description: '客户想补充常用喷嘴。',
    },
  });

  assert.equal(result.response.status, 403);
});

test('engineer can list only own upsell requests', async () => {
  const env = createEnv();
  env.__upsellRequests.push(
    { id: 'up-1', engineer_id: 'engineer-1', title: '我的需求', status: 'pending_assignment' },
    { id: 'up-2', engineer_id: 'engineer-2', title: '别人的需求', status: 'pending_assignment' },
  );

  const result = await api(env, '/api/upsell-requests/mine');

  assert.equal(result.response.status, 200);
  assert.equal(result.json.requests.length, 1);
  assert.equal(result.json.requests[0].id, 'up-1');
});

test('admin can list and update upsell requests', async () => {
  const env = createEnv();
  env.__upsellRequests.push({
    id: 'up-1',
    market: 'cn',
    source_type: 'engineer_workspace',
    engineer_id: 'engineer-1',
    category: 'laser_peripheral',
    title: '除尘装置',
    description: '客户希望了解除尘方案',
    status: 'pending_assignment',
    assigned_sales_owner: '',
    admin_note: '',
    quote_status: 'not_started',
    deal_result: 'undecided',
    handover_note: '',
  });

  const list = await api(env, '/api/admin/upsell-requests', {
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.json.requests.length, 1);

  const updated = await api(env, '/api/admin/upsell-requests/up-1', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
    body: {
      status: 'sales_following',
      assigned_sales_owner: '李经理',
      admin_note: '已安排业务联系客户',
      quote_status: 'in_progress',
      deal_result: 'undecided',
      handover_note: '',
    },
  });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.request.status, 'sales_following');
  assert.equal(updated.json.request.assigned_sales_owner, '李经理');
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test worker/tests/upsell-requests.test.mjs
```

Expected: FAIL with 404/route errors because endpoints do not exist.

- [ ] **Step 3: Add migration**

Create `worker/migrations/029_upsell_requests.sql`:

```sql
-- 029_upsell_requests.sql
-- Engineer-submitted upsell and retrofit demand records.

CREATE TABLE IF NOT EXISTS upsell_requests (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL DEFAULT 'com',
  source_type TEXT NOT NULL DEFAULT 'engineer_workspace',
  work_order_id TEXT,
  customer_id TEXT,
  engineer_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other_retrofit',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  site_context TEXT,
  expected_timeline TEXT DEFAULT 'unclear',
  budget_signal TEXT DEFAULT 'unknown',
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending_assignment',
  assigned_sales_owner TEXT,
  admin_note TEXT,
  quote_status TEXT DEFAULT 'not_started',
  deal_result TEXT DEFAULT 'undecided',
  handover_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_upsell_requests_market ON upsell_requests(market);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_status ON upsell_requests(status);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_category ON upsell_requests(category);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_engineer ON upsell_requests(engineer_id);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_work_order ON upsell_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_created_at ON upsell_requests(created_at);

INSERT OR IGNORE INTO _migrations (version, description)
VALUES ('029_upsell_requests', '工程师增购与改造需求记录');
```

- [ ] **Step 4: Mirror schema**

Add the same `CREATE TABLE`, indexes, and `_migrations` row to `worker/schema.sql` near `material_requests` and the migration list.

- [ ] **Step 5: Add Worker helpers and routes**

In `worker/src/index.js`, add constants near other business constants:

```js
const UPSELL_CATEGORIES = new Set([
  'parts_consumables',
  'laser_peripheral',
  'post_processing',
  'automation_retrofit',
  'bending_tooling',
  'other_retrofit',
]);

const UPSELL_STATUSES = new Set([
  'pending_assignment',
  'sales_following',
  'quoted',
  'won',
  'lost',
  'delivery_support',
  'completed',
]);

const UPSELL_TIMELINES = new Set(['immediate', 'within_1_month', 'within_3_months', 'unclear']);
const UPSELL_BUDGET_SIGNALS = new Set(['has_budget', 'comparing_quotes', 'unknown']);
const UPSELL_QUOTE_STATUSES = new Set(['not_started', 'in_progress', 'quoted']);
const UPSELL_DEAL_RESULTS = new Set(['undecided', 'won', 'lost']);
```

Add a sanitizer helper:

```js
function normalizeChoice(value, allowed, fallback) {
  const text = String(value || '').trim();
  return allowed.has(text) ? text : fallback;
}

function normalizeOptionalText(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeUpsellRequestPayload(body = {}) {
  return {
    source_type: body.source_type === 'work_order' ? 'work_order' : 'engineer_workspace',
    work_order_id: normalizeOptionalText(body.work_order_id, 80) || null,
    category: normalizeChoice(body.category, UPSELL_CATEGORIES, 'other_retrofit'),
    title: normalizeOptionalText(body.title, 120),
    description: normalizeOptionalText(body.description, 3000),
    site_context: normalizeOptionalText(body.site_context, 3000),
    expected_timeline: normalizeChoice(body.expected_timeline, UPSELL_TIMELINES, 'unclear'),
    budget_signal: normalizeChoice(body.budget_signal, UPSELL_BUDGET_SIGNALS, 'unknown'),
    contact_name: normalizeOptionalText(body.contact_name, 80),
    contact_phone: normalizeOptionalText(body.contact_phone, 40),
  };
}
```

Add handlers close to material request handlers:

```js
async function createUpsellRequest(request, env, user, market) {
  if (user.userType !== 'engineer') return json({ error: 'Engineer access required' }, 403);
  const body = await request.json().catch(() => ({}));
  const payload = normalizeUpsellRequestPayload(body);
  if (!payload.title || !payload.description) {
    return json({ error: 'title and description are required' }, 400);
  }

  let customerId = null;
  if (payload.source_type === 'work_order') {
    if (!payload.work_order_id) return json({ error: 'work_order_id is required' }, 400);
    const order = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = ?'
    ).bind(payload.work_order_id).first();
    if (!order) return json({ error: 'Work order not found' }, 404);
    if (order.engineer_id !== user.userId && order.assigned_regional_lead_id !== user.userId) {
      return json({ error: 'Forbidden' }, 403);
    }
    customerId = order.customer_id || null;
  } else {
    payload.work_order_id = null;
  }

  const id = generateId('upsell');
  await env.DB.prepare(`
    INSERT INTO upsell_requests (
      id, market, source_type, work_order_id, customer_id, engineer_id,
      category, title, description, site_context, expected_timeline,
      budget_signal, contact_name, contact_phone, status,
      assigned_sales_owner, admin_note, quote_status, deal_result, handover_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    market,
    payload.source_type,
    payload.work_order_id,
    customerId,
    user.userId,
    payload.category,
    payload.title,
    payload.description,
    payload.site_context,
    payload.expected_timeline,
    payload.budget_signal,
    payload.contact_name,
    payload.contact_phone,
    'pending_assignment',
    '',
    '',
    'not_started',
    'undecided',
    '',
  ).run();

  const created = await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(id).first();
  return json({ request: created }, 201);
}

async function listMyUpsellRequests(request, env, user) {
  if (user.userType !== 'engineer') return json({ error: 'Engineer access required' }, 403);
  const rows = await env.DB.prepare(
    'SELECT * FROM upsell_requests WHERE engineer_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(user.userId).all();
  return json({ requests: rows.results || [] });
}

async function listAdminUpsellRequests(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';
  const category = url.searchParams.get('category') || 'all';
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('pageSize') || '20', 10), 1), 100);
  const offset = (page - 1) * pageSize;
  const where = [];
  const args = [];
  if (UPSELL_STATUSES.has(status)) {
    where.push('status = ?');
    args.push(status);
  }
  if (UPSELL_CATEGORIES.has(category)) {
    where.push('category = ?');
    args.push(category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await env.DB.prepare(`SELECT COUNT(*) as count FROM upsell_requests ${whereSql}`).bind(...args).first();
  const rows = await env.DB.prepare(`
    SELECT * FROM upsell_requests ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...args, pageSize, offset).all();
  return json({ total: count?.count || 0, requests: rows.results || [] });
}

async function getAdminUpsellRequest(request, env, id) {
  const row = await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Upsell request not found' }, 404);
  return json({ request: row });
}

async function updateAdminUpsellRequest(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Upsell request not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const next = {
    status: normalizeChoice(body.status || existing.status, UPSELL_STATUSES, existing.status),
    assigned_sales_owner: normalizeOptionalText(body.assigned_sales_owner ?? existing.assigned_sales_owner, 120),
    admin_note: normalizeOptionalText(body.admin_note ?? existing.admin_note, 3000),
    quote_status: normalizeChoice(body.quote_status || existing.quote_status, UPSELL_QUOTE_STATUSES, existing.quote_status || 'not_started'),
    deal_result: normalizeChoice(body.deal_result || existing.deal_result, UPSELL_DEAL_RESULTS, existing.deal_result || 'undecided'),
    handover_note: normalizeOptionalText(body.handover_note ?? existing.handover_note, 3000),
  };
  await env.DB.prepare(`
    UPDATE upsell_requests
    SET status = ?, assigned_sales_owner = ?, admin_note = ?, quote_status = ?,
        deal_result = ?, handover_note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    next.status,
    next.assigned_sales_owner,
    next.admin_note,
    next.quote_status,
    next.deal_result,
    next.handover_note,
    id,
  ).run();
  const updated = await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(id).first();
  return json({ request: updated });
}
```

Wire routes in `routeRequest`:

```js
if (path === '/api/upsell-requests' && request.method === 'POST') {
  return createUpsellRequest(request, env, user, market);
}
if (path === '/api/upsell-requests/mine' && request.method === 'GET') {
  return listMyUpsellRequests(request, env, user);
}
if (path === '/api/admin/upsell-requests' && request.method === 'GET') {
  requireAdmin(user);
  return listAdminUpsellRequests(request, env);
}
if (path.startsWith('/api/admin/upsell-requests/') && request.method === 'GET') {
  requireAdmin(user);
  return getAdminUpsellRequest(request, env, path.split('/').pop());
}
if (path.startsWith('/api/admin/upsell-requests/') && request.method === 'PATCH') {
  requireAdmin(user);
  return updateAdminUpsellRequest(request, env, path.split('/').pop());
}
```

If the project uses a different Admin guard signature, follow the surrounding `/api/admin/material-requests` route pattern exactly.

- [ ] **Step 6: Add test file to package scripts**

Modify `worker/package.json` and add `tests/upsell-requests.test.mjs` to both `test` and `test:unit` scripts next to `tests/material-requests.test.mjs`.

- [ ] **Step 7: Run Worker tests**

Run:

```bash
node --test worker/tests/upsell-requests.test.mjs
npm test --prefix worker
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add worker/migrations/029_upsell_requests.sql worker/schema.sql worker/src/index.js worker/tests/upsell-requests.test.mjs worker/package.json
git commit -m "feat(worker): add upsell request api"
```

---

### Task 2: Engineer API Client and Shared Submission Modal

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/components/Upsell/UpsellRequestModal.jsx`
- Create: `frontend/src/components/Upsell/upsellRequestModel.js`
- Create: `frontend/tests/upsell-request-model.test.mjs`

**Interfaces:**
- Consumes: Worker endpoints from Task 1.
- Produces:
  - `createUpsellRequest(payload)`.
  - `getMyUpsellRequests()`.
  - `UPSELL_CATEGORIES`, `UPSELL_TIMELINES`, `UPSELL_BUDGET_SIGNALS`.
  - `buildUpsellPayload(form, context)`.
  - `<UpsellRequestModal isOpen onClose context onSubmitted />`.

- [ ] **Step 1: Write failing model tests**

Create `frontend/tests/upsell-request-model.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUpsellPayload,
  getUpsellCategoryLabel,
  getUpsellStatusLabel,
} from '../src/components/Upsell/upsellRequestModel.js';

test('buildUpsellPayload creates workspace payload without work order id', () => {
  const payload = buildUpsellPayload({
    category: 'laser_peripheral',
    title: '客户考虑增加除尘装置',
    description: '现场粉尘较大',
    site_context: '已有激光切割设备',
    expected_timeline: 'within_3_months',
    budget_signal: 'comparing_quotes',
    contact_name: '王经理',
    contact_phone: '13800000000',
  }, { sourceType: 'engineer_workspace' });

  assert.equal(payload.source_type, 'engineer_workspace');
  assert.equal(payload.work_order_id, '');
  assert.equal(payload.category, 'laser_peripheral');
});

test('buildUpsellPayload creates work-order-linked payload', () => {
  const payload = buildUpsellPayload({
    category: 'automation_retrofit',
    title: '桁架上下料改造',
    description: '客户希望降低人工上下料强度',
  }, { sourceType: 'work_order', workOrderId: 'wo-1' });

  assert.equal(payload.source_type, 'work_order');
  assert.equal(payload.work_order_id, 'wo-1');
});

test('labels keep product copy away from complete machine sales', () => {
  assert.equal(getUpsellCategoryLabel('bending_tooling', 'zh-CN'), '折弯相关');
  assert.equal(getUpsellStatusLabel('pending_assignment', 'zh-CN'), '待分配');
});
```

- [ ] **Step 2: Run failing frontend model test**

Run:

```bash
node --test frontend/tests/upsell-request-model.test.mjs
```

Expected: FAIL because model file does not exist.

- [ ] **Step 3: Implement model**

Create `frontend/src/components/Upsell/upsellRequestModel.js`:

```js
export const UPSELL_CATEGORIES = [
  { value: 'parts_consumables', cn: '配件 / 易损件', en: 'Parts / consumables' },
  { value: 'laser_peripheral', cn: '激光周边设备', en: 'Laser peripheral equipment' },
  { value: 'post_processing', cn: '后道处理设备', en: 'Post-processing equipment' },
  { value: 'automation_retrofit', cn: '自动化改造', en: 'Automation retrofit' },
  { value: 'bending_tooling', cn: '折弯相关', en: 'Bending tooling' },
  { value: 'other_retrofit', cn: '其他现场改造需求', en: 'Other retrofit need' },
];

export const UPSELL_TIMELINES = [
  { value: 'immediate', cn: '立即', en: 'Immediate' },
  { value: 'within_1_month', cn: '1 个月内', en: 'Within 1 month' },
  { value: 'within_3_months', cn: '3 个月内', en: 'Within 3 months' },
  { value: 'unclear', cn: '暂不明确', en: 'Unclear' },
];

export const UPSELL_BUDGET_SIGNALS = [
  { value: 'has_budget', cn: '明确预算', en: 'Has budget' },
  { value: 'comparing_quotes', cn: '询价比较', en: 'Comparing quotes' },
  { value: 'unknown', cn: '尚未确认', en: 'Not confirmed' },
];

export const UPSELL_STATUSES = [
  { value: 'pending_assignment', cn: '待分配', en: 'Pending assignment' },
  { value: 'sales_following', cn: '业务跟进中', en: 'Sales following' },
  { value: 'quoted', cn: '已报价', en: 'Quoted' },
  { value: 'won', cn: '已成交', en: 'Won' },
  { value: 'lost', cn: '未成交', en: 'Lost' },
  { value: 'delivery_support', cn: '交付协同中', en: 'Delivery support' },
  { value: 'completed', cn: '已完成', en: 'Completed' },
];

function pickLabel(list, value, locale) {
  const item = list.find((entry) => entry.value === value);
  if (!item) return value || '-';
  return locale === 'zh-CN' ? item.cn : item.en;
}

export function getUpsellCategoryLabel(value, locale = 'zh-CN') {
  return pickLabel(UPSELL_CATEGORIES, value, locale);
}

export function getUpsellStatusLabel(value, locale = 'zh-CN') {
  return pickLabel(UPSELL_STATUSES, value, locale);
}

export function buildUpsellPayload(form, context = {}) {
  return {
    source_type: context.sourceType === 'work_order' ? 'work_order' : 'engineer_workspace',
    work_order_id: context.sourceType === 'work_order' ? (context.workOrderId || '') : '',
    category: form.category || 'other_retrofit',
    title: (form.title || '').trim(),
    description: (form.description || '').trim(),
    site_context: (form.site_context || '').trim(),
    expected_timeline: form.expected_timeline || 'unclear',
    budget_signal: form.budget_signal || 'unknown',
    contact_name: (form.contact_name || '').trim(),
    contact_phone: (form.contact_phone || '').trim(),
  };
}
```

- [ ] **Step 4: Add frontend service helpers**

Modify `frontend/src/services/api.js`:

```js
export async function createUpsellRequest(payload) {
  const response = await fetch(`${API_BASE}/api/upsell-requests`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function getMyUpsellRequests() {
  const response = await fetch(`${API_BASE}/api/upsell-requests/mine`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
}
```

Use the existing response helper name in `frontend/src/services/api.js`; if it is not `handleResponse`, copy the local pattern used by adjacent API helpers.

- [ ] **Step 5: Create shared modal**

Create `frontend/src/components/Upsell/UpsellRequestModal.jsx`:

```jsx
import { useState } from 'react';
import { Lightbulb, Send } from 'lucide-react';
import { Modal } from '../common/Modal';
import { createUpsellRequest } from '../../services/api';
import { isCnLocale } from '../../utils/locale';
import {
  buildUpsellPayload,
  UPSELL_BUDGET_SIGNALS,
  UPSELL_CATEGORIES,
  UPSELL_TIMELINES,
} from './upsellRequestModel';

const EMPTY_FORM = {
  category: 'laser_peripheral',
  title: '',
  description: '',
  site_context: '',
  expected_timeline: 'unclear',
  budget_signal: 'unknown',
  contact_name: '',
  contact_phone: '',
};

function label(item, isCn) {
  return isCn ? item.cn : item.en;
}

export function UpsellRequestModal({ isOpen, onClose, context = {}, onSubmitted }) {
  const isCn = isCnLocale();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    const payload = buildUpsellPayload(form, context);
    if (!payload.title || !payload.description) {
      setMessage(isCn ? '请填写需求标题和需求描述。' : 'Please enter a title and description.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createUpsellRequest(payload);
      setForm(EMPTY_FORM);
      onSubmitted?.(result.request);
      onClose?.();
    } catch (error) {
      setMessage((isCn ? '提交失败：' : 'Submit failed: ') + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCn ? '增购与改造需求' : 'Upsell & Retrofit Need'} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4 text-sm text-[var(--color-text-secondary)]">
          <div className="mb-2 flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
            <Lightbulb size={16} />
            {isCn ? '记录现场发现的配套、改造、配件或易损件需求。' : 'Capture field needs for retrofit, peripheral equipment, parts, or consumables.'}
          </div>
          {context.workOrderNo && (
            <div>{isCn ? '关联工单：' : 'Linked work order: '}{context.workOrderNo}</div>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '需求分类' : 'Category'}</span>
          <select value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            {UPSELL_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{label(item, isCn)}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '需求标题' : 'Title'}</span>
          <input value={form.title} onChange={(e) => update('title', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '客户现场情况' : 'Site context'}</span>
          <textarea value={form.site_context} onChange={(e) => update('site_context', e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '需求描述' : 'Description'}</span>
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={4} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '预计时间' : 'Timeline'}</span>
            <select value={form.expected_timeline} onChange={(e) => update('expected_timeline', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              {UPSELL_TIMELINES.map((item) => <option key={item.value} value={item.value}>{label(item, isCn)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '预算信号' : 'Budget signal'}</span>
            <select value={form.budget_signal} onChange={(e) => update('budget_signal', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              {UPSELL_BUDGET_SIGNALS.map((item) => <option key={item.value} value={item.value}>{label(item, isCn)}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '联系人' : 'Contact'}</span>
            <input value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{isCn ? '联系电话' : 'Phone'}</span>
            <input value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" />
          </label>
        </div>

        {message && <div className="text-sm text-red-500">{message}</div>}

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
          <Send size={16} />
          {submitting ? (isCn ? '提交中...' : 'Submitting...') : (isCn ? '提交需求' : 'Submit request')}
        </button>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 6: Run frontend tests**

Run:

```bash
node --test frontend/tests/upsell-request-model.test.mjs
npm run lint --prefix frontend
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add frontend/src/services/api.js frontend/src/components/Upsell/UpsellRequestModal.jsx frontend/src/components/Upsell/upsellRequestModel.js frontend/tests/upsell-request-model.test.mjs
git commit -m "feat(frontend): add upsell request form"
```

---

### Task 3: Engineer Workspace and Work Order Detail Integration

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `frontend/tests/engineer-workspace-model.test.mjs` if model expectations need coverage.

**Interfaces:**
- Consumes: `<UpsellRequestModal />` from Task 2.
- Produces: visible **增购与改造需求** entry in engineer workspace and work order detail, plus a recent status list for the engineer's own submissions.

- [ ] **Step 1: Add workspace modal state**

In `EngineerWorkspace.jsx`, import:

```js
import { Lightbulb } from 'lucide-react';
import { getMyUpsellRequests } from '../../services/api';
import { UpsellRequestModal } from '../Upsell/UpsellRequestModal';
import { getUpsellCategoryLabel, getUpsellStatusLabel } from '../Upsell/upsellRequestModel';
```

If `Lightbulb` conflicts with existing lucide import, add it to the existing import list.

Add state:

```js
const [upsellOpen, setUpsellOpen] = useState(false);
const [upsellMessage, setUpsellMessage] = useState('');
const [upsellRequests, setUpsellRequests] = useState([]);
```

- [ ] **Step 2: Load engineer's own request statuses**

Add a loader near `loadTickets`:

```js
const loadUpsellRequests = useCallback(async () => {
  if (!engineerId) return;
  try {
    const data = await getMyUpsellRequests();
    setUpsellRequests(data.requests || []);
  } catch {
    setUpsellRequests([]);
  }
}, [engineerId]);
```

Call it with an effect:

```js
useEffect(() => {
  loadUpsellRequests();
}, [loadUpsellRequests]);
```

- [ ] **Step 3: Add workspace entry and recent status list**

In the 工程师工具箱 area, add a button:

```jsx
<button
  onClick={() => setUpsellOpen(true)}
  className="flex w-full items-center gap-3 rounded-xl bg-[var(--color-surface-elevated)] px-4 py-3 text-left text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
>
  <Lightbulb size={18} className="text-[var(--color-primary)]" />
  <span>
    <span className="block font-medium text-[var(--color-text-primary)]">增购与改造需求</span>
    <span className="block text-xs text-[var(--color-text-muted)]">记录配件、易损件、周边设备和现场改造需求。</span>
  </span>
</button>
```

Below the button, render recent submissions:

```jsx
{upsellRequests.length > 0 && (
  <div className="mt-3 space-y-2">
    {upsellRequests.slice(0, 3).map((request) => (
      <div key={request.id} className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-[var(--color-text-primary)]">{request.title}</span>
          <span className="shrink-0 text-[var(--color-primary)]">{getUpsellStatusLabel(request.status, 'zh-CN')}</span>
        </div>
        <div className="mt-1 text-[var(--color-text-muted)]">
          {getUpsellCategoryLabel(request.category, 'zh-CN')}
        </div>
      </div>
    ))}
  </div>
)}
```

Render modal near existing `WorkOrderDetailModal`:

```jsx
<UpsellRequestModal
  isOpen={upsellOpen}
  onClose={() => setUpsellOpen(false)}
  context={{ sourceType: 'engineer_workspace' }}
  onSubmitted={() => {
    setUpsellMessage('增购与改造需求已提交，Admin 会安排业务跟进。');
    loadUpsellRequests();
  }}
/>
```

Show `upsellMessage` in the existing message area or as a small success alert.

- [ ] **Step 4: Add work order detail entry**

In `WorkOrderDetailModal.jsx`, import modal and add state:

```js
import { UpsellRequestModal } from '../Upsell/UpsellRequestModal';

const [upsellOpen, setUpsellOpen] = useState(false);
```

In the `详情` tab, add an engineer-only section after parts preparation:

```jsx
{isEngineer && renderSection(isCn ? '增购与改造需求' : 'Upsell & Retrofit Need', (
  <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
    <p>
      {isCn
        ? '现场发现配件、易损件、周边设备、自动化改造或折弯模具需求时，可提交给 Admin 安排业务跟进。'
        : 'Capture field needs for parts, consumables, peripheral equipment, automation retrofit, or bending tooling.'}
    </p>
    <button
      type="button"
      onClick={() => setUpsellOpen(true)}
      className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
    >
      {isCn ? '提交增购与改造需求' : 'Submit need'}
    </button>
  </div>
))}
```

Render modal:

```jsx
<UpsellRequestModal
  isOpen={upsellOpen}
  onClose={() => setUpsellOpen(false)}
  context={{
    sourceType: 'work_order',
    workOrderId: workOrder.id,
    workOrderNo: detail?.order_no || workOrder.order_no || workOrder.id,
  }}
/>
```

- [ ] **Step 5: Run frontend build/lint**

Run:

```bash
npm run lint --prefix frontend
npm run build --prefix frontend
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx
git commit -m "feat(frontend): surface upsell request entrypoints"
```

---

### Task 4: Admin API Client and Demand Pool Page

**Files:**
- Modify: `admin/src/services/api.js`
- Create: `admin/src/pages/UpsellRequestsPage.jsx`
- Modify: `admin/src/App.jsx`

**Interfaces:**
- Consumes: Admin endpoints from Task 1.
- Produces:
  - `getAdminUpsellRequests(page, pageSize, filters)`.
  - `getAdminUpsellRequest(requestId)`.
  - `updateAdminUpsellRequest(requestId, payload)`.
  - Admin nav item **增购需求池**.

- [ ] **Step 1: Add Admin API helpers**

Modify `admin/src/services/api.js`:

```js
export async function getAdminUpsellRequests(page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ page, pageSize, ...filters });
  return request(`/api/admin/upsell-requests?${params}`);
}

export async function getAdminUpsellRequest(requestId) {
  return request(`/api/admin/upsell-requests/${requestId}`);
}

export async function updateAdminUpsellRequest(requestId, payload) {
  return request(`/api/admin/upsell-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Create Admin page**

Create `admin/src/pages/UpsellRequestsPage.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, RefreshCw, Save } from 'lucide-react';
import { getAdminUpsellRequests, updateAdminUpsellRequest } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const CATEGORIES = {
  parts_consumables: { en: 'Parts / consumables', cn: '配件 / 易损件' },
  laser_peripheral: { en: 'Laser peripheral equipment', cn: '激光周边设备' },
  post_processing: { en: 'Post-processing equipment', cn: '后道处理设备' },
  automation_retrofit: { en: 'Automation retrofit', cn: '自动化改造' },
  bending_tooling: { en: 'Bending tooling', cn: '折弯相关' },
  other_retrofit: { en: 'Other retrofit need', cn: '其他现场改造需求' },
};

const STATUSES = {
  pending_assignment: { en: 'Pending assignment', cn: '待分配' },
  sales_following: { en: 'Sales following', cn: '业务跟进中' },
  quoted: { en: 'Quoted', cn: '已报价' },
  won: { en: 'Won', cn: '已成交' },
  lost: { en: 'Lost', cn: '未成交' },
  delivery_support: { en: 'Delivery support', cn: '交付协同中' },
  completed: { en: 'Completed', cn: '已完成' },
};

const QUOTE_STATUSES = {
  not_started: { en: 'Not started', cn: '未开始' },
  in_progress: { en: 'In progress', cn: '报价中' },
  quoted: { en: 'Quoted', cn: '已报价' },
};

const DEAL_RESULTS = {
  undecided: { en: 'Undecided', cn: '未定' },
  won: { en: 'Won', cn: '已成交' },
  lost: { en: 'Lost', cn: '未成交' },
};

const TEXT = {
  en: {
    title: 'Upsell Request Pool',
    subtitle: 'Engineer-captured needs for retrofit, peripheral equipment, parts, consumables, and tooling.',
    refresh: 'Refresh',
    allStatuses: 'All statuses',
    allCategories: 'All categories',
    empty: 'No upsell requests yet.',
    save: 'Save',
    saved: 'Request updated.',
    failed: 'Operation failed: ',
    owner: 'Sales owner',
    adminNote: 'Admin note',
    handoverNote: 'Handover note',
  },
  'zh-CN': {
    title: '增购需求池',
    subtitle: '工程师现场提交的配件、易损件、周边设备、自动化改造和折弯相关需求。',
    refresh: '刷新',
    allStatuses: '全部状态',
    allCategories: '全部分类',
    empty: '暂无增购与改造需求。',
    save: '保存',
    saved: '需求已更新。',
    failed: '操作失败：',
    owner: '业务负责人',
    adminNote: '内部备注',
    handoverNote: '交付协同说明',
  },
};

function localize(map, key, locale) {
  const item = map[key];
  if (!item) return key || '-';
  return locale === 'zh-CN' ? item.cn : item.en;
}

export function UpsellRequestsPage() {
  const locale = runtimeConfig.locale;
  const t = TEXT[locale] || TEXT.en;
  const [data, setData] = useState({ total: 0, requests: [] });
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const pageSize = 20;

  const filters = useMemo(() => ({ status, category }), [status, category]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await getAdminUpsellRequests(1, pageSize, filters);
      setData({ total: result.total || 0, requests: result.requests || [] });
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const updateLocal = (id, key, value) => {
    setData((prev) => ({
      ...prev,
      requests: prev.requests.map((item) => item.id === id ? { ...item, [key]: value } : item),
    }));
  };

  const save = async (item) => {
    setSavingId(item.id);
    setMessage('');
    try {
      const result = await updateAdminUpsellRequest(item.id, {
        status: item.status,
        assigned_sales_owner: item.assigned_sales_owner || '',
        admin_note: item.admin_note || '',
        quote_status: item.quote_status || 'not_started',
        deal_result: item.deal_result || 'undecided',
        handover_note: item.handover_note || '',
      });
      setData((prev) => ({
        ...prev,
        requests: prev.requests.map((row) => row.id === item.id ? result.request : row),
      }));
      setMessage(t.saved);
    } catch (error) {
      setMessage(t.failed + error.message);
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[var(--color-primary)]">
            <Lightbulb size={18} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">SAGEMRO</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.subtitle}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
          <RefreshCw size={16} />
          {t.refresh}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
          <option value="all">{t.allStatuses}</option>
          {Object.keys(STATUSES).map((key) => <option key={key} value={key}>{localize(STATUSES, key, locale)}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
          <option value="all">{t.allCategories}</option>
          {Object.keys(CATEGORIES).map((key) => <option key={key} value={key}>{localize(CATEGORIES, key, locale)}</option>)}
        </select>
      </div>

      {message && <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">{message}</div>}

      {loading ? (
        <div className="text-sm text-[var(--color-text-secondary)]">Loading...</div>
      ) : data.requests.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-secondary)]">{t.empty}</div>
      ) : (
        <div className="space-y-4">
          {data.requests.map((item) => (
            <article key={item.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[var(--color-text)]">{item.title}</h2>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {localize(CATEGORIES, item.category, locale)} · {item.source_type === 'work_order' ? `WO ${item.work_order_id || '-'}` : 'Workspace'} · {item.engineer_id}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">{item.created_at || '-'}</div>
              </div>
              <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
              {item.site_context && <p className="mb-3 text-sm text-[var(--color-text-muted)]">{item.site_context}</p>}

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">Status</span>
                  <select value={item.status || 'pending_assignment'} onChange={(e) => updateLocal(item.id, 'status', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2">
                    {Object.keys(STATUSES).map((key) => <option key={key} value={key}>{localize(STATUSES, key, locale)}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">Quote</span>
                  <select value={item.quote_status || 'not_started'} onChange={(e) => updateLocal(item.id, 'quote_status', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2">
                    {Object.keys(QUOTE_STATUSES).map((key) => <option key={key} value={key}>{localize(QUOTE_STATUSES, key, locale)}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">Deal</span>
                  <select value={item.deal_result || 'undecided'} onChange={(e) => updateLocal(item.id, 'deal_result', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2">
                    {Object.keys(DEAL_RESULTS).map((key) => <option key={key} value={key}>{localize(DEAL_RESULTS, key, locale)}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">{t.owner}</span>
                  <input value={item.assigned_sales_owner || ''} onChange={(e) => updateLocal(item.id, 'assigned_sales_owner', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2" />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">{t.adminNote}</span>
                  <input value={item.admin_note || ''} onChange={(e) => updateLocal(item.id, 'admin_note', e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2" />
                </label>
              </div>

              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-[var(--color-text-secondary)]">{t.handoverNote}</span>
                <textarea value={item.handover_note || ''} onChange={(e) => updateLocal(item.id, 'handover_note', e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2" />
              </label>

              <div className="mt-3 flex justify-end">
                <button onClick={() => save(item)} disabled={savingId === item.id} className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                  <Save size={16} />
                  {savingId === item.id ? 'Saving...' : t.save}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add Admin navigation**

Modify `admin/src/App.jsx`:

```js
import { Boxes, ClipboardList, LayoutDashboard, Users, FileText, Star, LogOut, Target, Lightbulb } from 'lucide-react';
import { UpsellRequestsPage } from './pages/UpsellRequestsPage';
```

Add localized nav text:

```js
upsellRequests: 'Upsell Requests',
```

and:

```js
upsellRequests: '增购需求池',
```

Add nav item after leads:

```js
{ key: 'upsellRequests', label: t.nav.upsellRequests, icon: Lightbulb },
```

Add render case:

```js
case 'upsellRequests': return <UpsellRequestsPage />;
```

- [ ] **Step 4: Run Admin build**

Run:

```bash
npm run build --prefix admin
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add admin/src/services/api.js admin/src/pages/UpsellRequestsPage.jsx admin/src/App.jsx
git commit -m "feat(admin): add upsell request pool"
```

---

### Task 5: End-to-End Verification and Deployment Notes

**Files:**
- Modify: `docs/superpowers/plans/2026-07-05-upsell-requests.md` only if verification discovers plan corrections.

**Interfaces:**
- Consumes: all tasks.
- Produces: verified feature branch ready for deployment.

- [ ] **Step 1: Run complete local checks**

Run:

```bash
npm test --prefix worker
npm run lint --prefix frontend
npm run build --prefix frontend
npm run build --prefix admin
node --test frontend/tests/cn-copy-contract.test.mjs frontend/tests/brand-assets-contract.test.mjs
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 2: Run browser smoke for engineer UI**

Start local frontend:

```bash
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5175
```

Use Playwright CLI to:

- Open `http://127.0.0.1:5175/engineer`.
- Set engineer localStorage.
- Mock `/api/upsell-requests`, `/api/upsell-requests/mine`, `/api/engineers/tickets`, and `/api/workorders/:id`.
- Confirm the engineer workspace shows **增购与改造需求**.
- Open a work order detail and confirm it shows **增购与改造需求**.
- Submit a mocked request and confirm success handling.

Expected: UI renders without blank screen or overlapping controls.

- [ ] **Step 3: Run browser smoke for Admin UI**

Start local admin:

```bash
npm run dev --prefix admin -- --host 127.0.0.1 --port 5176
```

Use Playwright CLI to:

- Open `http://127.0.0.1:5176`.
- Set admin localStorage.
- Mock `/api/admin/upsell-requests`.
- Confirm sidebar shows **增购需求池**.
- Confirm list renders a pending request.
- Change status/owner and confirm `PATCH` call is made.

Expected: Admin page is usable on desktop and no text overlaps.

- [ ] **Step 4: Document migration command before deployment**

Before pushing a Worker deployment, run production D1 migration manually:

```bash
wrangler d1 execute sagemro-db --env production --remote --file migrations/029_upsell_requests.sql
wrangler d1 execute sagemro-db --env production --remote --command "SELECT version FROM _migrations ORDER BY version;"
```

Expected: `_migrations` includes `029_upsell_requests`.

- [ ] **Step 5: Commit verification fixes**

If any small fixes are needed:

```bash
git add <changed-files>
git commit -m "fix: stabilize upsell request verification"
```

If no fixes are needed, do not create an empty commit.
