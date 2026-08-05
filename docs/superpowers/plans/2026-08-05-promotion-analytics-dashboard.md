# Promotion Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bilingual, role-scoped promotion overview and channel analysis workspace backed by corrected funnel semantics and direct aggregation of the existing COM/CN D1 event tables.

**Architecture:** Version new funnel events in `properties_json`, rotate browser sessions after 30 minutes of inactivity, and pair each AI request with its successful response through `request_id`. Aggregate each selected D1 independently in the Worker, merge only aggregate rows in JavaScript, and expose two read-only admin endpoints consumed by one lazy-loaded admin page with Overview and Channel Analysis tabs.

**Tech Stack:** React 19 customer frontend, React 18 admin, Cloudflare Workers, D1/SQLite JSON functions, Vite, Tailwind CSS, Node.js built-in test runner

---

## File map and boundaries

### Customer analytics

- Create `frontend/src/services/funnelAnalytics.js`: pure session and request-ID helpers.
- Create `frontend/tests/funnel-analytics.test.mjs`: deterministic session tests.
- Modify `frontend/src/services/api.js`: build v2 payloads with rotated sessions.
- Modify `frontend/src/App.jsx`: create one request ID for each user message.
- Modify `frontend/src/hooks/useChat.js`: attach the same request ID only to a genuine successful response.
- Modify `frontend/tests/brand-assets-contract.test.mjs`: enforce request-ID wiring and fallback exclusion.

### Worker aggregation and access

- Create `worker/src/lib/promotionAnalytics.js`: filter validation, SQL builders, aggregate merging, metric calculation, and health rules.
- Create `worker/tests/promotion-analytics.test.mjs`: pure rules, SQLite query results, two-market merge, API permissions, and response privacy.
- Modify `worker/src/index.js`: allow v2 properties, mark fallback SSE chunks, add handlers/routes, preserve both D1 bindings, and attach staff market scope.
- Modify `worker/tests/analytics-funnel.test.mjs`: v2 property sanitization.
- Modify `worker/tests/routes.test.mjs`: operations read-route coverage.
- Modify `worker/package.json`: include the new focused test in Worker test scripts.

### Admin UI

- Create `admin/src/pages/PromotionAnalyticsPage.jsx`: shared filters, tabs, request cancellation, loading/error state, and API orchestration.
- Create `admin/src/components/promotion/PromotionFilters.jsx`: date, market, source, medium, and campaign controls.
- Create `admin/src/components/promotion/PromotionOverview.jsx`: status, five metrics, funnel, trend, and reminders.
- Create `admin/src/components/promotion/ChannelAnalysis.jsx`: summary, sortable table, channel selection, and trend.
- Create `admin/src/pages/promotionAnalyticsView.js`: pure formatting, sorting, and SVG point helpers.
- Create `admin/src/pages/PromotionAnalyticsPage.test.mjs`: navigation, copy, state, privacy, sorting, and formatting contracts.
- Modify `admin/src/services/api.js`: two read-only analytics clients with abort support.
- Modify `admin/src/App.jsx`: bilingual lazy navigation available only to admin and operations.
- Modify `admin/src/App.lazy-loading.test.mjs`: new lazy page contract.
- Modify `admin/package.json`: include the new page test.

## Global constraints

- Do not add a D1 migration, summary table, cron, analytics vendor, chart dependency, or advertising-cost field.
- New dashboard metrics use only events with `analytics_version = 2`; old rows remain untouched.
- Do not expose raw event rows or identity/device fields to admin clients.
- Fixed report timezone is `Asia/Shanghai`; API responses must state it.
- Maximum date span is 90 report days.
- New strings must ship in English and Simplified Chinese together.

### Task 1: Introduce v2 session and AI request semantics

**Files:**
- Create: `frontend/src/services/funnelAnalytics.js`
- Create: `frontend/tests/funnel-analytics.test.mjs`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/hooks/useChat.js`
- Modify: `frontend/tests/brand-assets-contract.test.mjs`
- Modify: `worker/src/index.js`
- Modify: `worker/tests/analytics-funnel.test.mjs`

**Interfaces:**

```js
resolveAnalyticsSession(storage, now, idFactory) -> session ID string
createAnalyticsId(prefix) -> analytics ID string
createAnalyticsRequestId() -> request ID string
trackFunnelEvent(name, properties) -> best-effort POST/beacon
sendMessage(content, images, conversationId, requestId) -> Promise<void>
```

- [ ] **Step 1: Write deterministic session tests**

Create a small in-memory storage fake and cover a new session, 29-minute reuse, 31-minute rotation, invalid stored time, and storage failure:

```js
test('analytics session rotates only after 30 minutes of inactivity', () => {
  const storage = memoryStorage();
  let sequence = 0;
  const makeId = () => `session-${++sequence}`;

  assert.equal(resolveAnalyticsSession(storage, 0, makeId), 'session-1');
  assert.equal(resolveAnalyticsSession(storage, 29 * 60_000, makeId), 'session-1');
  assert.equal(resolveAnalyticsSession(storage, 60 * 60_000, makeId), 'session-2');
});

test('analytics session safely degrades when storage throws', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(resolveAnalyticsSession(storage, 1, () => 'ephemeral-1'), 'ephemeral-1');
});
```

- [ ] **Step 2: Run the session test and verify RED**

Run:

```bash
cd frontend
node --test tests/funnel-analytics.test.mjs
```

Expected: FAIL because `funnelAnalytics.js` does not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

Create the module with fixed keys and dependency-injected time/ID generation:

```js
export const ANALYTICS_VERSION = '2';
export const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_ID_KEY = 'sagemro_analytics_session_id';
const LAST_ACTIVITY_KEY = 'sagemro_analytics_last_activity_ms';

export function createAnalyticsId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function resolveAnalyticsSession(storage, now = Date.now(), idFactory = createAnalyticsId) {
  const nextId = () => idFactory('session');
  try {
    const existing = storage.getItem(SESSION_ID_KEY);
    const lastActivity = Number(storage.getItem(LAST_ACTIVITY_KEY));
    const expired = !Number.isFinite(lastActivity) || now - lastActivity > SESSION_IDLE_MS;
    const sessionId = existing && !expired ? existing : nextId();
    storage.setItem(SESSION_ID_KEY, sessionId);
    storage.setItem(LAST_ACTIVITY_KEY, String(now));
    return sessionId;
  } catch {
    return nextId();
  }
}

export function createAnalyticsRequestId(idFactory = createAnalyticsId) {
  return idFactory('request');
}
```

- [ ] **Step 4: Wire the v2 session into `trackFunnelEvent`**

Remove the session ID from the never-expiring `getStoredAnalyticsValue` path. Build each payload with:

```js
session_id: resolveAnalyticsSession(localStorage),
properties: {
  ...properties,
  analytics_version: ANALYTICS_VERSION,
  market: window.location.hostname.endsWith('.cn') ? 'cn' : 'com',
  locale: window.location.hostname.endsWith('.cn') ? 'zh-CN' : 'en',
},
```

Keep the anonymous ID and last-non-direct UTM behavior unchanged.

- [ ] **Step 5: Write the failing AI request pairing contract**

Add source-contract assertions proving `App.jsx` creates one request ID, passes it to both events, and `useChat` suppresses success when the Worker marks a fallback:

```js
assert.match(app, /const requestId = createAnalyticsRequestId\(\)/);
assert.match(app, /request_id: requestId/);
assert.match(app, /sendMessage\(content, images, convId, requestId\)/);
assert.match(useChat, /responseFailed/);
assert.match(useChat, /data\.response_status === 'failed'/);
assert.match(useChat, /!responseFailed && aiContent/);
assert.match(useChat, /request_id: requestId/);
```

- [ ] **Step 6: Mark Worker fallback chunks and wire the request ID**

In both LLM fallback payloads add `response_status: 'failed'` beside `content` and `conversation_id`. In `App.jsx`, create one request ID before the start event and pass it into `sendMessage`. In `useChat`, use this exact local flag pattern:

```js
let aiContent = '';
let responseFailed = false;

// inside onChunk
if (data.response_status === 'failed') responseFailed = true;

// inside onDone
if (!responseFailed && aiContent && requestId) {
  trackFunnelEvent('ai_response_received', {
    conversation_id: targetConversationId || conversationId,
    request_id: requestId,
    response_status: 'received',
  });
}
```

- [ ] **Step 7: Allow only the new safe properties in the Worker**

Add `request_id` and `analytics_version` to `FUNNEL_PROPERTY_ALLOWLIST`, add `request_id` to `FUNNEL_IDENTIFIER_PROPERTIES`, and add this enum:

```js
analytics_version: new Set(['2']),
```

Extend `analytics-funnel.test.mjs` to assert the two fields survive while arbitrary properties remain removed.

- [ ] **Step 8: Run focused tests and verify GREEN**

Run:

```bash
cd frontend
node --test tests/funnel-analytics.test.mjs tests/brand-assets-contract.test.mjs
cd ../worker
node --test tests/analytics-funnel.test.mjs tests/chat-access.test.mjs
```

Expected: all focused tests pass; fallback SSE content is not counted as a successful AI response.

- [ ] **Step 9: Commit analytics v2 event semantics**

```bash
git add frontend/src/services/funnelAnalytics.js frontend/tests/funnel-analytics.test.mjs frontend/src/services/api.js frontend/src/App.jsx frontend/src/hooks/useChat.js frontend/tests/brand-assets-contract.test.mjs worker/src/index.js worker/tests/analytics-funnel.test.mjs
git commit -m "feat(analytics): version sessions and AI requests"
```

### Task 2: Implement filter validation, merging, and health rules as pure functions

**Files:**
- Create: `worker/src/lib/promotionAnalytics.js`
- Create: `worker/tests/promotion-analytics.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**

```js
parsePromotionFilters(searchParams, options) -> validated filter object
mergePromotionSnapshots(snapshots) -> one aggregate snapshot
mergeChannelRows(rowsByMarket) -> recomputed aggregate rows
evaluatePromotionHealth(current, previous, recentAi) -> status and reasons
```

- [ ] **Step 1: Write failing validation and health-rule tests**

Cover inclusive report dates, the `+08:00` UTC boundary, a 91-day rejection, disallowed markets, sample status, success thresholds, traffic drop, conversion drop, attribution quality, and five consecutive failures. Use fixed `now = new Date('2026-08-05T06:00:00Z')`.

```js
assert.deepEqual(parsePromotionFilters(new URLSearchParams({
  from: '2026-08-01', to: '2026-08-05', market: 'all',
}), { allowedMarkets: ['com', 'cn'], now }), {
  from: '2026-08-01',
  to: '2026-08-05',
  fromUtc: '2026-07-31 16:00:00',
  toUtcExclusive: '2026-08-05 16:00:00',
  effectiveToUtcExclusive: '2026-08-05 05:55:00',
  markets: ['com', 'cn'],
  source: '', medium: '', campaign: '',
});

assert.equal(evaluatePromotionHealth(
  { aiRequests: 100, aiSuccesses: 89, sessions: 100, unattributedSessions: 10 },
  { sessions: 100 },
  [{ success: false }, { success: false }, { success: false }, { success: false }, { success: false }],
).level, 'critical');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd worker
node --test tests/promotion-analytics.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict filters and fixed reporting boundaries**

Implement `PromotionAnalyticsInputError` with `status = 400`. Date strings must match `^\d{4}-\d{2}-\d{2}$`, round-trip to the same report date, span at most 90 days, and use midnight `+08:00`. Cap live data at five minutes before `now` so in-flight AI requests do not become false failures.

String filters use this normalization:

```js
function cleanFilter(value, max) {
  return String(value || '').trim().slice(0, max);
}
```

Return `markets` only from the intersection of the requested market and `allowedMarkets`.

- [ ] **Step 4: Implement merge functions that recompute rates**

Sum raw counts before calculating percentages. Never average percentages:

```js
export function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

export function mergeChannelRows(rowsByMarket) {
  const merged = new Map();
  for (const row of rowsByMarket.flat()) {
    const key = JSON.stringify([row.source || '', row.medium || '', row.campaign || '']);
    const target = merged.get(key) || {
      source: row.source || '', medium: row.medium || '', campaign: row.campaign || '',
      sessions: 0, aiRequests: 0, aiSuccesses: 0, registrations: 0, serviceRequests: 0,
    };
    for (const field of ['sessions', 'aiRequests', 'aiSuccesses', 'registrations', 'serviceRequests']) {
      target[field] += Number(row[field] || 0);
    }
    merged.set(key, target);
  }
  return [...merged.values()].map((row) => ({
    ...row,
    aiSuccessRate: ratio(row.aiSuccesses, row.aiRequests),
    sessionToRequestRate: ratio(row.serviceRequests, row.sessions),
    sampleStatus: row.sessions < 20 ? 'insufficient' : 'ready',
  }));
}
```

- [ ] **Step 5: Implement the approved fixed health rules**

Return `{ level, reasons }`, where `level` is the worst of `normal`, `warning`, and `critical`. Include current value, threshold, and sample count in every reason. Use the approved rules: AI 95/90 percent, minimum 20 requests, five consecutive failures, 40 percent traffic drop, 30 percent relative funnel drop when both denominators are at least 20, and 30 percent unattributed sessions when there are at least 20 sessions.

- [ ] **Step 6: Add the test to Worker scripts and run GREEN**

Add `tests/promotion-analytics.test.mjs` to both `test` and `test:unit` in `worker/package.json`.

Run:

```bash
cd worker
node --test tests/promotion-analytics.test.mjs
```

Expected: all validation, merge, and health-rule tests pass.

- [ ] **Step 7: Commit pure promotion analytics rules**

```bash
git add worker/src/lib/promotionAnalytics.js worker/tests/promotion-analytics.test.mjs worker/package.json
git commit -m "feat(worker): add promotion analytics rules"
```

### Task 3: Add SQLite-tested D1 aggregate queries

**Files:**
- Modify: `worker/src/lib/promotionAnalytics.js`
- Modify: `worker/tests/promotion-analytics.test.mjs`

**Interfaces:**

```js
queryPromotionOverviewDb(db, filters) -> market snapshot
queryPromotionChannelsDb(db, filters) -> channel rows and daily trend
loadPromotionOverview(databases, filters) -> merged response data
loadPromotionChannels(databases, filters) -> merged response data
```

- [ ] **Step 1: Seed an in-memory SQLite funnel table**

Create the exact `funnel_events` columns used by the production migration. Seed COM-like v2 sessions, paired and failed AI request IDs, registration, service request, direct traffic, a legacy row without v2, and events on both sides of the Shanghai date boundary.

The assertions must prove:

```js
assert.equal(snapshot.sessions, 3);
assert.equal(snapshot.aiRequests, 2);
assert.equal(snapshot.aiSuccesses, 1);
assert.equal(snapshot.registrationEvents, 1);
assert.equal(snapshot.serviceRequestEvents, 1);
assert.equal(snapshot.visitors, 3);
assert.equal(snapshot.aiVisitors, 2);
assert.equal(snapshot.registrationVisitors, 1);
assert.equal(snapshot.serviceVisitors, 1);
assert.equal(snapshot.missingAnonymousEvents, 0);
assert.equal(snapshot.legacyEvents > 0, true);
assert.equal(snapshot.coverageStart, '2026-08-01 00:05:00');
```

- [ ] **Step 2: Run the SQLite test and verify RED**

Run:

```bash
cd worker
node --test tests/promotion-analytics.test.mjs
```

Expected: FAIL because D1 query functions do not exist.

- [ ] **Step 3: Build parameter-bound WHERE clauses**

The builder must only append fixed SQL fragments and push values separately:

```js
function buildEventWhere(filters) {
  const clauses = ['created_at >= ?', 'created_at < ?'];
  const params = [filters.fromUtc, filters.effectiveToUtcExclusive];
  for (const [column, value] of [['source', filters.source], ['medium', filters.medium], ['campaign', filters.campaign]]) {
    if (!value) continue;
    clauses.push(`${column} = ?`);
    params.push(value);
  }
  return { sql: clauses.join(' AND '), params };
}
```

Add a test with `source = "x' OR 1=1 --"` asserting the text appears only in params, never in SQL.

- [ ] **Step 4: Implement the summary query**

Use a filtered CTE that extracts `analytics_version` and `request_id` from `properties_json`. Count v2 sessions and requests with `COUNT(DISTINCT CASE WHEN ...)`. Keep top-card event counts separate from funnel visitor counts, which use distinct non-empty `anonymous_id`. Return raw numerators and denominators; calculate rates in JavaScript.

```sql
WITH filtered AS (
  SELECT event_name, session_id, anonymous_id, source, medium, campaign, created_at,
         json_extract(properties_json, '$.analytics_version') AS analytics_version,
         json_extract(properties_json, '$.request_id') AS request_id
  FROM funnel_events
  WHERE __BOUND_WHERE__
)
SELECT
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' THEN session_id END) AS sessions,
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_conversation_started' THEN request_id END) AS ai_requests,
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_response_received' THEN request_id END) AS ai_successes,
  SUM(CASE WHEN analytics_version = '2' AND event_name = 'signup_completed' THEN 1 ELSE 0 END) AS registration_events,
  SUM(CASE WHEN analytics_version = '2' AND event_name = 'service_request_created' THEN 1 ELSE 0 END) AS service_request_events,
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS visitors,
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_conversation_started' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS ai_visitors,
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'signup_completed' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS registration_visitors,
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'service_request_created' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS service_visitors,
  SUM(CASE WHEN analytics_version = '2' AND COALESCE(anonymous_id, '') = '' THEN 1 ELSE 0 END) AS missing_anonymous_events,
  COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' AND COALESCE(source, '') = '' THEN session_id END) AS unattributed_sessions,
  MIN(CASE WHEN analytics_version = '2' THEN created_at END) AS coverage_start,
  SUM(CASE WHEN analytics_version IS NULL OR analytics_version != '2' THEN 1 ELSE 0 END) AS legacy_events
FROM filtered
```

- [ ] **Step 5: Implement daily, channel, and recent-request queries**

Daily grouping uses `date(datetime(created_at, '+8 hours'))`. Channel grouping normalizes empty values to empty strings and uses distinct anonymous visitors for registrations and service requests so repeat actions do not inflate channel conversion. It limits after ordering by service requests, registrations, then sessions. Recent AI status selects the latest five eligible v2 start IDs, includes internal `created_at`, and left joins any matching success event.

Do not return any identity columns from these functions.

- [ ] **Step 6: Implement per-market parallel loading and aggregate merging**

For `market=all`, call COM and CN databases in parallel:

```js
const snapshots = await Promise.all(
  filters.markets.map((market) => queryPromotionOverviewDb(databases[market], filters)),
);
return mergePromotionSnapshots(snapshots);
```

For channel rows, merge by `[source, medium, campaign]`, sum counts, recompute rates, sort, and slice to 100 after merging. For current/previous comparison, run the same summary query with the derived equal-length previous bounds. When both markets are selected, merge recent AI rows by `created_at`, sort newest first, take five, and remove timestamps before forming the public response.

- [ ] **Step 7: Run the SQLite and merge tests**

Run:

```bash
cd worker
node --test tests/promotion-analytics.test.mjs
```

Expected: exact seeded counts, date buckets, channel order, safe params, legacy coverage, and two-market sums pass.

- [ ] **Step 8: Commit D1 aggregation**

```bash
git add worker/src/lib/promotionAnalytics.js worker/tests/promotion-analytics.test.mjs
git commit -m "feat(worker): aggregate promotion funnel data"
```

### Task 4: Expose role- and market-scoped admin endpoints

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/promotion-analytics.test.mjs`
- Modify: `worker/tests/routes.test.mjs`

- [ ] **Step 1: Write failing API permission and privacy tests**

Exercise both endpoints through `worker.fetch` with bootstrap admin, admin staff, operations, warehouse, procurement, customer, and anonymous tokens. Assert:

```js
assert.equal(bootstrapOverview.status, 200);
assert.equal(operationsOverview.status, 200);
assert.equal(warehouseOverview.status, 403);
assert.equal(procurementOverview.status, 403);
assert.equal(customerOverview.status, 403);
assert.equal(anonymousOverview.status, 401);
assert.equal(JSON.stringify(await bootstrapOverview.json()).includes('anonymous_id'), false);
```

Add market-scope cases: COM-only operations cannot request `market=cn` or `market=all`; all-market operations can request all and receives merged counts.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd worker
node --test tests/promotion-analytics.test.mjs tests/routes.test.mjs
```

Expected: new endpoint tests fail and operations route classification returns false.

- [ ] **Step 3: Preserve both D1 bindings for a CN request**

Change the top-level fetch environment selection to preserve the original COM binding:

```js
const requestEnv = env.DB_CN && shouldUseCnDatabase(request)
  ? { ...env, DB_COM: env.DB, DB: env.DB_CN }
  : { ...env, DB_COM: env.DB };
```

The analytics handler maps COM to `env.DB_COM || env.DB` and CN to `env.DB_CN || env.DB` only when the request market is CN.

- [ ] **Step 4: Attach active staff market scope at the existing gate**

When the staff row is validated, retain:

```js
request._auth = {
  ...auth,
  staffRole: staff.role,
  marketScope: staff.market_scope,
  mustChangePassword: Boolean(staff.must_change_password),
};
```

Bootstrap admin defaults to `marketScope = 'all'` inside the analytics handler.

- [ ] **Step 5: Permit only operations GET access to the two exact paths**

Extend `isOperationsReadRoute` with:

```js
|| path === '/api/admin/analytics/overview'
|| path === '/api/admin/analytics/channels'
```

Add route tests proving GET is allowed and POST remains denied.

- [ ] **Step 6: Add thin handlers and route dispatch**

Handlers perform role checks, call `parsePromotionFilters`, select allowed/available databases, call the aggregation module, and return:

```js
{
  reporting_timezone: 'Asia/Shanghai',
  allowed_markets: allowedMarkets,
  filters: publicFilters,
  data_quality: dataQuality,
  ...analyticsPayload,
}
```

Add exact GET routes under the existing `/api/admin/` block. Catch `PromotionAnalyticsInputError` as 400/403; unexpected query errors call `captureException(error, env, { request, ctx: request._ctx, extra: { feature: 'promotion_analytics', endpoint } })` and return 500.

- [ ] **Step 7: Run API tests and verify GREEN**

Run:

```bash
cd worker
node --test tests/promotion-analytics.test.mjs tests/routes.test.mjs tests/request-auth.test.mjs
```

Expected: permissions, market scope, privacy, invalid filters, COM/CN merge, and route classification all pass.

- [ ] **Step 8: Commit the API boundary**

```bash
git add worker/src/index.js worker/tests/promotion-analytics.test.mjs worker/tests/routes.test.mjs
git commit -m "feat(worker): expose promotion analytics endpoints"
```

### Task 5: Add the bilingual lazy admin entry and API client

**Files:**
- Modify: `admin/src/services/api.js`
- Modify: `admin/src/App.jsx`
- Modify: `admin/src/App.lazy-loading.test.mjs`
- Create: `admin/src/pages/PromotionAnalyticsPage.test.mjs`
- Modify: `admin/package.json`

- [ ] **Step 1: Write failing navigation and client contracts**

Require a lazy `PromotionAnalyticsPage`, bilingual copy, one `promotionAnalytics` nav item, the operations allowlist entry, and two API functions:

```js
assert.match(app, /const PromotionAnalyticsPage = lazy/);
assert.match(app, /promotionAnalytics: 'Promotion Analytics'/);
assert.match(app, /promotionAnalytics: '推广分析'/);
assert.match(app, /OPERATIONS_NAV_KEYS[\s\S]*'promotionAnalytics'/);
assert.match(api, /getPromotionOverview/);
assert.match(api, /\/api\/admin\/analytics\/overview/);
assert.match(api, /getPromotionChannels/);
assert.match(api, /\/api\/admin\/analytics\/channels/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd admin
node --test src/App.lazy-loading.test.mjs src/pages/PromotionAnalyticsPage.test.mjs
```

Expected: FAIL because the page, nav item, and API clients do not exist.

- [ ] **Step 3: Add abortable GET clients**

Use one safe parameter builder:

```js
function promotionAnalyticsQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const key of ['from', 'to', 'market', 'source', 'medium', 'campaign']) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params.toString();
}

export function getPromotionOverview(filters, signal) {
  return request(`/api/admin/analytics/overview?${promotionAnalyticsQuery(filters)}`, { signal });
}

export function getPromotionChannels(filters, signal) {
  return request(`/api/admin/analytics/channels?${promotionAnalyticsQuery(filters)}`, { signal });
}
```

- [ ] **Step 4: Add the single lazy navigation entry**

Import `ChartNoAxesCombined` from `lucide-react`, lazy-load the page, add the bilingual key, insert one nav item after the dashboard, add `promotionAnalytics` to `OPERATIONS_NAV_KEYS`, and render:

```jsx
case 'promotionAnalytics':
  return <PromotionAnalyticsPage />;
```

Do not add separate sidebar entries for Overview and Channel Analysis.

- [ ] **Step 5: Add the new test to the admin script and run GREEN**

Add `src/pages/PromotionAnalyticsPage.test.mjs` to `admin/package.json` `test`.

Run:

```bash
cd admin
node --test src/App.lazy-loading.test.mjs src/pages/PromotionAnalyticsPage.test.mjs src/services/cookie-auth-contract.test.mjs
```

Expected: lazy loading, permission visibility, bilingual copy, and cookie-auth request behavior pass.

- [ ] **Step 6: Commit the admin entry boundary**

```bash
git add admin/src/services/api.js admin/src/App.jsx admin/src/App.lazy-loading.test.mjs admin/src/pages/PromotionAnalyticsPage.test.mjs admin/package.json
git commit -m "feat(admin): add promotion analytics entry"
```

### Task 6: Build the Overview tab with safe async states

**Files:**
- Create: `admin/src/pages/PromotionAnalyticsPage.jsx`
- Create: `admin/src/components/promotion/PromotionFilters.jsx`
- Create: `admin/src/components/promotion/PromotionOverview.jsx`
- Create: `admin/src/pages/promotionAnalyticsView.js`
- Modify: `admin/src/pages/PromotionAnalyticsPage.test.mjs`

- [ ] **Step 1: Write failing view-model and page-state tests**

Import the pure helpers and assert null formatting, percentage formatting, funnel widths, and SVG points. Add source contracts for loading, no-data, insufficient-sample, retry, abort, five metric labels, status, funnel, trend, and reminders in both languages.

```js
assert.equal(formatMetric(null, 'percent', 'en'), '—');
assert.equal(formatMetric(0.978, 'percent', 'en'), '97.8%');
assert.deepEqual(buildLinePoints([0, 5, 10], 100, 40), ['0,40', '50,20', '100,0']);
assert.match(page, /AbortController/);
assert.match(page, /controller\.abort\(\)/);
assert.match(overview, /AI success rate/);
assert.match(overview, /AI 成功率/);
assert.match(overview, /sample_status/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd admin
node --test src/pages/PromotionAnalyticsPage.test.mjs
```

Expected: FAIL because the page, components, and helpers do not exist.

- [ ] **Step 3: Implement pure display helpers**

Export `formatMetric`, `formatChange`, `buildLinePoints`, and `statusTone`. Null values return an em dash. Percentages multiply ratios by 100. SVG point generation must handle an empty or all-zero series without `NaN` or `Infinity`.

- [ ] **Step 4: Implement shared filters and presets**

`PromotionFilters` receives `{ filters, allowedMarkets, onChange, copy }`. Today, 7-day, and 30-day presets produce `YYYY-MM-DD` in the fixed report timezone. Market options come only from `allowed_markets`; source, medium, and campaign remain plain bounded text inputs sent only when the user applies filters.

- [ ] **Step 5: Implement request cancellation and retry**

Use a monotonically replaced `AbortController` inside `useEffect`:

```js
useEffect(() => {
  const controller = new AbortController();
  setOverviewState({ status: 'loading', data: null, error: '' });
  getPromotionOverview(filters, controller.signal)
    .then((data) => setOverviewState({ status: 'ready', data, error: '' }))
    .catch((error) => {
      if (error.name !== 'AbortError') setOverviewState({ status: 'error', data: null, error: error.message });
    });
  return () => controller.abort();
}, [filters, reloadKey]);
```

The error panel keeps the active filters and increments `reloadKey` on retry.

- [ ] **Step 6: Implement the approved Overview hierarchy**

Render in this order:

1. overall status banner and reason count;
2. sessions, AI requests, AI success rate, completed registrations, service requests;
3. visitor funnel and SVG daily trend;
4. operational reminders and data-quality notices.

Use existing CSS variables and Tailwind classes. `sample_status=no_data` renders “No data / 暂无样本”; `insufficient` renders “Insufficient sample / 样本不足”. Show `reporting_timezone` and `coverage_start` near the filters.

- [ ] **Step 7: Run page tests and production build**

Run:

```bash
cd admin
node --test src/pages/PromotionAnalyticsPage.test.mjs
npm run build
```

Expected: view-model and source contracts pass; Vite builds without JSX or import errors.

- [ ] **Step 8: Commit the Overview tab**

```bash
git add admin/src/pages/PromotionAnalyticsPage.jsx admin/src/components/promotion/PromotionFilters.jsx admin/src/components/promotion/PromotionOverview.jsx admin/src/pages/promotionAnalyticsView.js admin/src/pages/PromotionAnalyticsPage.test.mjs
git commit -m "feat(admin): add promotion overview dashboard"
```

### Task 7: Build the table-first Channel Analysis tab

**Files:**
- Create: `admin/src/components/promotion/ChannelAnalysis.jsx`
- Modify: `admin/src/pages/PromotionAnalyticsPage.jsx`
- Modify: `admin/src/pages/promotionAnalyticsView.js`
- Modify: `admin/src/pages/PromotionAnalyticsPage.test.mjs`

- [ ] **Step 1: Write failing channel sorting and privacy tests**

Require stable client sorting, local source/campaign search, direct/unknown labels, sample status, all approved columns, no cost fields, and no raw identity labels:

```js
const rows = [
  { source: 'google', sessions: 40, serviceRequests: 2 },
  { source: 'linkedin', sessions: 20, serviceRequests: 4 },
];
assert.deepEqual(sortChannelRows(rows, 'serviceRequests', 'desc').map((row) => row.source), ['linkedin', 'google']);
assert.deepEqual(filterChannelRows(rows, 'link').map((row) => row.source), ['linkedin']);
assert.match(channels, /Service requests/);
assert.match(channels, /服务请求/);
assert.doesNotMatch(channels, /CPA|ROAS|Ad spend|广告花费/);
assert.doesNotMatch(channels, /anonymous_id|session_id|ip_hash|user_agent/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd admin
node --test src/pages/PromotionAnalyticsPage.test.mjs
```

Expected: FAIL because `ChannelAnalysis` and sorting behavior do not exist.

- [ ] **Step 3: Implement stable channel sorting**

Export a non-mutating sorter with a source/medium/campaign string tie-breaker and a case-insensitive `filterChannelRows` that searches those three fields. Null rates sort after real values in both directions. Default order is service requests descending, registrations descending, then sessions descending.

- [ ] **Step 4: Fetch channels only when the tab is active**

Use a separate `AbortController`, `channelReloadKey`, and state object. Do not refetch Overview when only the channel sort changes. Preserve shared filters between tabs.

- [ ] **Step 5: Implement the approved table-first layout**

Render:

1. best channel, best campaign, attributable service requests, and attribution quality;
2. sortable table with source/medium, campaign, sessions, AI requests, AI success rate, registrations, service requests, and session-to-request rate;
3. selected-channel trend and operational/data-quality hints.

Rows below 20 sessions show “Insufficient sample / 样本不足” and are never styled as winning or failing based on a rate. Empty source displays “Direct / Unattributed” or “直接访问 / 未归因”.

- [ ] **Step 6: Make row selection explicit and reversible**

Clicking a row applies its source, medium, and campaign to the shared filters, which reloads the trend under the same API contract. Show a “Clear channel filter / 清除渠道筛选” control to restore the full table. This avoids a third detail endpoint.

- [ ] **Step 7: Run focused tests and build**

Run:

```bash
cd admin
node --test src/pages/PromotionAnalyticsPage.test.mjs src/App.lazy-loading.test.mjs
npm run build
```

Expected: table sorting, selection, bilingual copy, privacy assertions, lazy loading, and production build pass.

- [ ] **Step 8: Commit Channel Analysis**

```bash
git add admin/src/components/promotion/ChannelAnalysis.jsx admin/src/pages/PromotionAnalyticsPage.jsx admin/src/pages/promotionAnalyticsView.js admin/src/pages/PromotionAnalyticsPage.test.mjs
git commit -m "feat(admin): add channel performance analysis"
```

### Task 8: Complete cross-project verification and deployment handoff

**Files:**
- Modify only if verification exposes a defect directly caused by Tasks 1-7.

- [ ] **Step 1: Run the complete Worker suite**

```bash
cd worker
npm test
```

Expected: pretest, all unit/API/SQLite tests, production smoke-script contracts, and evaluation harness pass.

- [ ] **Step 2: Run the complete customer frontend suite**

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: all tests pass, ESLint reports zero errors, and the production build succeeds.

- [ ] **Step 3: Run the complete admin suite**

```bash
cd admin
npm test
npm run build
```

Expected: all admin tests and the production build pass for the shared COM/CN source.

- [ ] **Step 4: Run repository hygiene checks**

```bash
git diff --check
git status --short
git log --oneline origin/main..HEAD
```

Expected: no whitespace errors, no untracked build artifacts, and only the planned design/implementation commits are ahead of `origin/main`.

- [ ] **Step 5: Perform local role and responsive smoke checks**

Verify at desktop and narrow width:

- bootstrap admin sees Promotion Analytics;
- operations sees Promotion Analytics;
- warehouse and procurement do not see it;
- Overview loads, retries, and shows no-data/insufficient-sample honestly;
- Channel table stays usable through horizontal scrolling;
- COM is English and CN is Simplified Chinese.

- [ ] **Step 6: Prepare the deployment sequence without executing it prematurely**

After code review, use the finishing-development-branch workflow. The production sequence is:

1. merge/push the tested branch to `main` so COM admin and the shared Worker deploy;
2. verify GitHub Actions and COM smoke;
3. sync the admin changes to `china-edition`;
4. push `china-edition` and manually trigger `.github/workflows/aliyun-cn-deploy.yml`;
5. smoke `admin.sagemro.cn`, `api.sagemro.cn/health`, and one authorized CN analytics read.

No D1 migration command is required for this feature.
