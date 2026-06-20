# Engineer Recruiting Calendar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first engineer portal loop: public engineer application, Admin application review, and engineer-owned availability calendar.

**Architecture:** Add small, explicit Worker API endpoints backed by new D1 tables for engineer applications and calendar events. Keep frontend changes focused: unauthenticated engineer hosts show a recruiting page, authenticated engineer users see availability inside the existing workspace, and Admin gets one lightweight review page. Do not build complex HR, forum, automatic dispatch, or compensation systems in this batch.

**Tech Stack:** Cloudflare Worker + D1 migrations, React/Vite frontend, React/Vite admin, Node test runner for Worker tests, existing fetch service wrappers.

---

## Scope Guard

This plan implements the first minimum viable loop only:

- Public engineer recruiting/application page on `engineer.sagemro.com` and `engineer.sagemro.cn`.
- Application submission API that does not create login accounts.
- Admin review API and admin page for submitted applications.
- Engineer-owned availability calendar where engineers manually add, confirm, and delete their availability/unavailability events.

This plan explicitly does not implement:

- Automatic dispatch from calendar events.
- Full certification course system.
- Open engineer forum.
- Compensation logic or payout rules.
- Production D1 migration execution.

## File Structure

- `worker/migrations/024_engineer_applications_and_calendar.sql`
  - Creates `engineer_applications` and `engineer_calendar_events`.
- `worker/schema.sql`
  - Adds the new tables to local/full schema.
- `worker/src/index.js`
  - Adds public application submit endpoint, Admin application review endpoints, and engineer calendar endpoints.
- `worker/tests/engineer-application-calendar.test.mjs`
  - Tests public application submission, Admin list/update behavior, and engineer calendar access boundaries.
- `worker/package.json`
  - Adds the new test file to unit test scripts.
- `frontend/src/services/api.js`
  - Adds engineer application and calendar service functions.
- `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`
  - New unauthenticated engineer host landing/application page.
- `frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx`
  - New engineer-owned calendar panel.
- `frontend/src/components/Engineer/EngineerWorkspace.jsx`
  - Shows calendar panel in logged-in workspace.
- `frontend/src/App.jsx`
  - Shows recruiting page on engineer hosts before login.
- `admin/src/services/api.js`
  - Adds Admin application list/update/create-user service calls.
- `admin/src/pages/EngineerApplicationsPage.jsx`
  - New lightweight Admin review page.
- `admin/src/App.jsx`
  - Adds navigation item for engineer applications.

---

## Task 1: Worker Data Model And API

**Files:**
- Create: `worker/migrations/024_engineer_applications_and_calendar.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/src/index.js`
- Create: `worker/tests/engineer-application-calendar.test.mjs`
- Modify: `worker/package.json`

- [ ] **Step 1: Write failing Worker tests**

Create `worker/tests/engineer-application-calendar.test.mjs` with tests that assert:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function createStatement(result = {}) {
  return {
    bind() { return this; },
    async first() { return result.first ?? null; },
    async all() { return result.all ?? { results: [] }; },
    async run() { return result.run ?? { success: true }; },
  };
}

function createEnv({ admin = false, engineer = false } = {}) {
  const calls = [];
  const env = {
    JWT_SECRET: 'test-secret',
    DB: {
      prepare(sql) {
        calls.push(sql);
        if (sql.includes('FROM engineers WHERE id = ?') && engineer) {
          return createStatement({ first: { id: 'eng_1', engineer_role: 'engineer' } });
        }
        return createStatement();
      },
    },
    KV: {
      async get() { return null; },
      async put() {},
    },
    __calls: calls,
  };
  return env;
}

async function adminToken(env) {
  return signJwt({
    userId: 'admin',
    userType: 'admin',
    phone: 'admin',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function engineerToken(env) {
  return signJwt({
    userId: 'eng_1',
    userType: 'engineer',
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

test('public engineer application submits without creating an engineer account', async () => {
  const env = createEnv();
  const request = new Request('https://api.sagemro.com/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.com' },
    body: JSON.stringify({
      name: 'Alex Service',
      phone: '+1 555 0100',
      email: 'alex@example.com',
      country: 'US',
      city: 'Chicago',
      service_regions: ['Illinois'],
      skill_tags: ['Laser cutting machine repair'],
      experience_summary: '8 years of field service.',
    }),
  });

  const response = await worker.fetch(request, env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_applications')), true);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineers')), false);
});

test('admin can list engineer applications', async () => {
  const env = createEnv();
  env.DB.prepare = (sql) => {
    env.__calls.push(sql);
    if (sql.includes('COUNT(*)')) return createStatement({ first: { count: 1 } });
    if (sql.includes('FROM engineer_applications')) {
      return createStatement({ all: { results: [{ id: 'app_1', name: 'Alex Service', status: 'submitted' }] } });
    }
    return createStatement();
  };
  const token = await adminToken(env);
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/admin/engineer-applications', {
    headers: { Authorization: `Bearer ${token}` },
  }), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.total, 1);
  assert.equal(body.list[0].id, 'app_1');
});

test('engineer calendar events are scoped to authenticated engineer', async () => {
  const env = createEnv({ engineer: true });
  const token = await engineerToken(env);
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/engineers/calendar-events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'engineer_available',
      title: 'Available for field service',
      start_at: '2026-07-01T09:00:00Z',
      end_at: '2026-07-01T17:00:00Z',
      timezone: 'Asia/Shanghai',
    }),
  }), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_calendar_events')), true);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run test:unit --prefix worker -- tests/engineer-application-calendar.test.mjs
```

Expected: fails because endpoints do not exist or package script does not include this test yet.

- [ ] **Step 3: Add D1 migration and schema**

Create `worker/migrations/024_engineer_applications_and_calendar.sql`:

```sql
CREATE TABLE IF NOT EXISTS engineer_applications (
  id TEXT PRIMARY KEY,
  market TEXT DEFAULT 'com',
  status TEXT DEFAULT 'submitted',
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  country TEXT,
  province TEXT,
  city TEXT,
  base_region TEXT,
  service_regions TEXT DEFAULT '[]',
  years_experience TEXT,
  equipment_types TEXT DEFAULT '[]',
  brand_experience TEXT DEFAULT '[]',
  skill_tags TEXT DEFAULT '[]',
  languages TEXT DEFAULT '[]',
  can_travel INTEGER DEFAULT 0,
  can_weekend INTEGER DEFAULT 0,
  can_night INTEGER DEFAULT 0,
  has_tools INTEGER DEFAULT 0,
  experience_summary TEXT,
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  converted_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_engineer_applications_status ON engineer_applications(status);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_market ON engineer_applications(market);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_created_at ON engineer_applications(created_at);

CREATE TABLE IF NOT EXISTS engineer_calendar_events (
  id TEXT PRIMARY KEY,
  engineer_id TEXT NOT NULL,
  market TEXT DEFAULT 'com',
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  work_order_id TEXT,
  region TEXT,
  city TEXT,
  confirmation_status TEXT DEFAULT 'confirmed',
  engineer_response TEXT,
  visibility TEXT DEFAULT 'admin_team',
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_engineer_calendar_engineer ON engineer_calendar_events(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_calendar_range ON engineer_calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_engineer_calendar_type ON engineer_calendar_events(event_type);
```

Add equivalent table definitions to `worker/schema.sql`.

- [ ] **Step 4: Implement Worker endpoints**

Add public route before protected auth:

```js
if (path === '/api/engineer-applications' && request.method === 'POST') {
  return handleSubmitEngineerApplication(request, env);
}
```

Add protected Admin routes:

```js
if (path === '/api/admin/engineer-applications' && request.method === 'GET') {
  return handleAdminEngineerApplications(request, env);
}
if (path.match(/^\/api\/admin\/engineer-applications\/[^/]+$/) && request.method === 'PATCH') {
  return handleAdminUpdateEngineerApplication(request, env);
}
```

Add protected engineer routes:

```js
if (path === '/api/engineers/calendar-events' && request.method === 'GET') {
  return handleGetEngineerCalendarEvents(request, env);
}
if (path === '/api/engineers/calendar-events' && request.method === 'POST') {
  return handleCreateEngineerCalendarEvent(request, env);
}
if (path.match(/^\/api\/engineers\/calendar-events\/[^/]+$/) && request.method === 'DELETE') {
  return handleDeleteEngineerCalendarEvent(request, env);
}
```

Handler rules:

- Application submit validates `name` and at least one contact method.
- Application submit stores arrays as JSON strings and sets `market` from host/origin using `shouldUseCnDatabase(request) ? 'cn' : 'com'`.
- Admin list supports `status`, `page`, and `pageSize`.
- Admin update supports `status` and `review_notes`.
- Engineer calendar GET returns only current engineer events, unless current engineer is `regional_lead`, then it can return team events with `scope=team`.
- Engineer calendar POST only allows current engineer to create own `engineer_available`, `unavailable`, `emergency_available`, `training`, or `travel` events.
- Engineer calendar DELETE only deletes current engineer's own non-work-order event.

- [ ] **Step 5: Update worker tests script**

Add `tests/engineer-application-calendar.test.mjs` to `test` and `test:unit` in `worker/package.json`.

- [ ] **Step 6: Run Worker tests to verify GREEN**

Run:

```bash
npm run test:unit --prefix worker
```

Expected: all unit tests pass.

- [ ] **Step 7: Commit Task 1**

```bash
git add worker/migrations/024_engineer_applications_and_calendar.sql worker/schema.sql worker/src/index.js worker/tests/engineer-application-calendar.test.mjs worker/package.json
git commit -m "feat(worker): add engineer application and calendar APIs"
```

---

## Task 2: Engineer Public Recruiting Page And Calendar Panel

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`
- Create: `frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add API service functions**

Add:

```js
export async function submitEngineerApplication(data) {
  const response = await fetch(`${API_BASE}/api/engineer-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export async function getEngineerCalendarEvents(params = {}) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${API_BASE}/api/engineers/calendar-events?${query}`, {
    headers: authHeaders(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export async function createEngineerCalendarEvent(data) {
  const response = await fetch(`${API_BASE}/api/engineers/calendar-events`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export async function deleteEngineerCalendarEvent(eventId) {
  const response = await fetch(`${API_BASE}/api/engineers/calendar-events/${eventId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}
```

- [ ] **Step 2: Build recruiting page**

Create `EngineerRecruitingPage.jsx`:

- Detect `.cn` hostname for Chinese copy.
- Show SAGEMRO mark, positioning, six attraction cards, application form, and login button.
- Submit application through `submitEngineerApplication`.
- After success, show review message and do not log user in.
- Primary copy must say "Apply to Become a SAGEMRO Service Representative" / "申请成为 SAGEMRO 认证服务代表".
- Avoid "register to earn", "grab orders", "withdraw", or "commission".

- [ ] **Step 3: Route unauthenticated engineer hosts to recruiting page**

In `frontend/src/App.jsx`:

- If `isEngineerHost` and `!currentUser`, render `EngineerRecruitingPage`.
- Pass `onOpenLogin={() => setLoginModalOpen(true)}`.
- Keep `LoginModal` mounted so Admin-created accounts can log in.

- [ ] **Step 4: Build availability calendar panel**

Create `EngineerAvailabilityCalendar.jsx`:

- Load `getEngineerCalendarEvents`.
- Form fields: `event_type`, `title`, `start_at`, `end_at`, `timezone`, `city`, `notes`.
- Default `event_type` to `engineer_available`.
- Present event list grouped by date.
- Allow deleting own non-work-order events.
- Copy must emphasize "You fill and confirm your calendar. SAGEMRO uses it as dispatch reference."

- [ ] **Step 5: Add calendar panel to workspace**

In `EngineerWorkspace.jsx`:

- Import `EngineerAvailabilityCalendar`.
- Add it below task overview or alongside checklist.
- Keep existing task flows untouched.

- [ ] **Step 6: Verify frontend build**

Run:

```bash
npm run lint --prefix frontend
npm run build --prefix frontend
```

Expected: lint and build pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add frontend/src/services/api.js frontend/src/components/Engineer/EngineerRecruitingPage.jsx frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add engineer recruiting page and calendar"
```

---

## Task 3: Admin Engineer Applications Review

**Files:**
- Modify: `admin/src/services/api.js`
- Create: `admin/src/pages/EngineerApplicationsPage.jsx`
- Modify: `admin/src/App.jsx`

- [ ] **Step 1: Add Admin API functions**

Add:

```js
export async function getAdminEngineerApplications(page = 1, pageSize = 20, status = 'all') {
  return request(`/api/admin/engineer-applications?page=${page}&pageSize=${pageSize}&status=${status}`);
}

export async function updateAdminEngineerApplication(applicationId, data) {
  return request(`/api/admin/engineer-applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 2: Create review page**

Create `EngineerApplicationsPage.jsx`:

- Use `runtimeConfig.locale` for Chinese/English labels.
- Status filters: all, submitted, reviewing, approved, rejected, converted.
- Show applicant name, contact, region, skill tags, experience summary, created time.
- Allow status update and review note update.
- Include a clear note: approved applications do not automatically create accounts; Admin creates engineer accounts from Users page.

- [ ] **Step 3: Add Admin navigation**

In `admin/src/App.jsx`:

- Add icon import, nav text, nav item key `engineerApplications`.
- Render `EngineerApplicationsPage`.

- [ ] **Step 4: Verify admin tests/build**

Run:

```bash
npm test --prefix admin
npm run build --prefix admin
```

Expected: tests and build pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add admin/src/services/api.js admin/src/pages/EngineerApplicationsPage.jsx admin/src/App.jsx
git commit -m "feat(admin): add engineer application review"
```

---

## Task 4: End-To-End Verification And Handoff

**Files:**
- Modify as needed only for defects found in verification.

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm run test:unit --prefix worker
npm run lint --prefix frontend
npm run build --prefix frontend
npm test --prefix admin
npm run build --prefix admin
```

Expected: all pass.

- [ ] **Step 2: Check migration warning**

Run:

```bash
ls worker/migrations/024_engineer_applications_and_calendar.sql
```

Expected: file exists. Note in final that production D1 migration must be run manually before deploying Worker.

- [ ] **Step 3: Review diff for scope**

Run:

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Expected: only Worker/API, frontend engineer, admin application review, and plan/migration files changed.

- [ ] **Step 4: Final commit if fixes were needed**

If verification fixes were made:

```bash
git add <changed-files>
git commit -m "fix: verify engineer recruiting calendar mvp"
```

- [ ] **Step 5: Final response**

Report:

- Branch name.
- Key features completed.
- Verification commands and results.
- Migration file and production deployment warning.
*** End Patch
 
