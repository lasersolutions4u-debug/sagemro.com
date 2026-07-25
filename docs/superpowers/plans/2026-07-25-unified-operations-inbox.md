# Unified Operations Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a unified, permission-safe inbox for admin, regional leads, and engineers, while keeping customers and customer-visible work-order messages isolated.

**Architecture:** Add independent D1 conversation, participant, and message tables rather than overloading `work_order_messages`. The Worker is the sole authority for contact eligibility and conversation access. Admin and engineer clients consume the same `/api/inbox` contract through focused API clients and views; existing `notifications` remain system-notification storage and are aggregated by the inbox API.

**Tech Stack:** Cloudflare Workers, D1/SQLite migrations, JavaScript ES modules, React, Vite, Node built-in test runner, existing OneSignal helper.

---

## Planned file structure

| File | Responsibility |
| --- | --- |
| `worker/migrations/034_unified_operations_inbox.sql` | Create inbox tables, indexes, and migration ledger entry. |
| `worker/schema.sql` | Mirror migration schema for a fresh D1 database. |
| `worker/migrations/README.md` | Document migration 034. |
| `worker/src/lib/inbox.js` | Pure authorization and row-normalization helpers; no request or D1 coupling. |
| `worker/src/index.js` | Inbox persistence handlers, notification dispatch, protected-route recognition and routing. |
| `worker/tests/inbox.test.mjs` | Worker contract tests with an in-memory D1 statement adapter. |
| `worker/package.json` | Include inbox tests in `test` and `test:unit`. |
| `admin/src/services/api.js` | Admin-side `/api/inbox` client. |
| `admin/src/pages/InboxPage.jsx` | Admin three-pane inbox page and new-direct-message flow. |
| `admin/src/App.jsx` | Inbox navigation and unread badge polling. |
| `admin/src/pages/InboxPage.test.mjs` | Static contract checks for admin UI and API boundaries. |
| `frontend/src/services/api.js` | Engineer-side `/api/inbox` client. |
| `frontend/src/components/Engineer/InboxPanel.jsx` | Engineer/lead inbox UI with authorized contacts only. |
| `frontend/src/components/Engineer/EngineerWorkspace.jsx` | Add inbox entry to the existing workspace. |
| `frontend/tests/inbox-contract.test.mjs` | Engineer/client isolation and API contract checks. |

### Task 1: Add schema migration and migration documentation

**Files:**
- Create: `worker/migrations/034_unified_operations_inbox.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/migrations/README.md`

- [ ] **Step 1: Write migration contract assertions before creating the migration**

Create `worker/tests/inbox.test.mjs` with a migration-source test:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('unified inbox migration creates the required tables and indexes', async () => {
  const sql = await readFile(new URL('../migrations/034_unified_operations_inbox.sql', import.meta.url), 'utf8');
  for (const required of [
    'CREATE TABLE IF NOT EXISTS inbox_conversations',
    'CREATE TABLE IF NOT EXISTS inbox_participants',
    'CREATE TABLE IF NOT EXISTS inbox_messages',
    'idx_inbox_conversations_work_order',
    'idx_inbox_participants_user',
    'idx_inbox_messages_conversation_created',
    "'034_unified_operations_inbox'",
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
});
```

- [ ] **Step 2: Run the focused test and verify it fails because migration 034 is absent**

Run: `cd worker && node --test tests/inbox.test.mjs`

Expected: FAIL with `ENOENT` for `034_unified_operations_inbox.sql`.

- [ ] **Step 3: Create the idempotent D1 migration**

Create `worker/migrations/034_unified_operations_inbox.sql`:

```sql
CREATE TABLE IF NOT EXISTS inbox_conversations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('direct', 'work_order')),
  work_order_id TEXT,
  subject TEXT,
  created_by_id TEXT NOT NULL,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('admin', 'engineer')),
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_recent
  ON inbox_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_work_order
  ON inbox_conversations(work_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_conversations_work_order_unique
  ON inbox_conversations(work_order_id) WHERE kind = 'work_order';

CREATE TABLE IF NOT EXISTS inbox_participants (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'engineer')),
  last_read_message_id TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  left_at TEXT,
  PRIMARY KEY (conversation_id, user_id, user_type),
  FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inbox_participants_user
  ON inbox_participants(user_id, user_type, left_at);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'engineer')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_urls TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation_created
  ON inbox_messages(conversation_id, created_at);

INSERT OR IGNORE INTO _migrations (version, note)
VALUES ('034_unified_operations_inbox', 'Admin and engineer internal inbox conversations');
```

- [ ] **Step 4: Mirror the three table definitions in the schema snapshot and document migration 034**

Append the same table and index definitions to `worker/schema.sql` immediately after the existing `notifications` definition. Add this row to the migration table in `worker/migrations/README.md`:

```markdown
| `034_unified_operations_inbox.sql` | Admin、区域负责人和工程师的内部会话、成员与消息；不对客户开放 |
```

- [ ] **Step 5: Run focused migration test**

Run: `cd worker && node --test tests/inbox.test.mjs`

Expected: PASS for `unified inbox migration creates the required tables and indexes`.

- [ ] **Step 6: Commit the schema boundary**

```bash
git add worker/migrations/034_unified_operations_inbox.sql worker/schema.sql worker/migrations/README.md worker/tests/inbox.test.mjs
git commit -m "feat(db): add unified operations inbox tables"
```

### Task 2: Add pure inbox permission helpers

**Files:**
- Create: `worker/src/lib/inbox.js`
- Modify: `worker/tests/inbox.test.mjs`

- [ ] **Step 1: Add failing permission-matrix tests**

Append to `worker/tests/inbox.test.mjs`:

```js
import { canStartDirectConversation } from '../src/lib/inbox.js';

const admin = { userId: 'admin', userType: 'admin' };
const lead = { userId: 'lead-1', userType: 'engineer', engineerRole: 'regional_lead' };
const engineer = { userId: 'eng-1', userType: 'engineer', engineerRole: 'engineer', regionalLeadId: 'lead-1' };
const outsider = { userId: 'eng-2', userType: 'engineer', engineerRole: 'engineer', regionalLeadId: 'lead-2' };

test('direct-message permission matrix is limited to operations relationships', () => {
  assert.equal(canStartDirectConversation(admin, engineer), true);
  assert.equal(canStartDirectConversation(engineer, admin), true);
  assert.equal(canStartDirectConversation(lead, engineer), true);
  assert.equal(canStartDirectConversation(engineer, lead), true);
  assert.equal(canStartDirectConversation(engineer, outsider), false);
  assert.equal(canStartDirectConversation(lead, outsider), false);
  assert.equal(canStartDirectConversation({ userType: 'customer', userId: 'cust-1' }, engineer), false);
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the helper is missing**

Run: `cd worker && node --test tests/inbox.test.mjs`

Expected: FAIL with missing export `canStartDirectConversation`.

- [ ] **Step 3: Implement minimal pure helpers**

Create `worker/src/lib/inbox.js`:

```js
export function isInboxIdentity(identity) {
  return identity?.userType === 'admin' || identity?.userType === 'engineer';
}

export function canStartDirectConversation(sender, recipient) {
  if (!isInboxIdentity(sender) || !isInboxIdentity(recipient)) return false;
  if (sender.userId === recipient.userId && sender.userType === recipient.userType) return false;
  if (sender.userType === 'admin' || recipient.userType === 'admin') return true;
  if (sender.engineerRole === 'regional_lead') return recipient.engineerRole === 'engineer' && recipient.regionalLeadId === sender.userId;
  if (recipient.engineerRole === 'regional_lead') return sender.engineerRole === 'engineer' && sender.regionalLeadId === recipient.userId;
  return false;
}

export function isConversationParticipant(participants, auth) {
  return participants.some((participant) => participant.user_id === auth.userId && participant.user_type === auth.userType && !participant.left_at);
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd worker && node --test tests/inbox.test.mjs`

Expected: PASS for migration and permission-matrix tests.

- [ ] **Step 5: Commit pure authorization logic**

```bash
git add worker/src/lib/inbox.js worker/tests/inbox.test.mjs
git commit -m "feat(worker): add inbox permission helpers"
```

### Task 3: Implement Worker inbox APIs with authorization and notifications

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/tests/inbox.test.mjs`
- Modify: `worker/package.json`

- [ ] **Step 1: Add failing API tests using the existing JWT helper**

Build `createInboxEnv()` in `worker/tests/inbox.test.mjs` with `engineers` containing `lead-1` (`regional_lead`), `eng-1` (`regional_lead_id: 'lead-1'`), and `eng-2` (`regional_lead_id: 'lead-2'`). Add an `api()` helper patterned after `worker/tests/work-order-messages.test.mjs`, then add these tests:

```js
test('engineer may list only operations Joe and their own regional lead as inbox contacts', async () => {
  const { response, json } = await api(createInboxEnv(), '/api/inbox/contacts', { userType: 'engineer', userId: 'eng-1' });
  assert.equal(response.status, 200);
  assert.deepEqual(json.contacts.map(({ id, type }) => [id, type]), [['admin', 'admin'], ['lead-1', 'engineer']]);
});

test('direct conversations are created once, delivered to the recipient, and unread until read', async () => {
  const env = createInboxEnv();
  const created = await api(env, '/api/inbox/conversations', { method: 'POST', userType: 'engineer', userId: 'eng-1', body: { recipient_id: 'lead-1', recipient_type: 'engineer' } });
  assert.equal(created.response.status, 200);
  const sent = await api(env, `/api/inbox/conversations/${created.json.conversation.id}/messages`, { method: 'POST', userType: 'engineer', userId: 'eng-1', body: { content: 'Need dispatch support.' } });
  assert.equal(sent.response.status, 200);
  const inbox = await api(env, '/api/inbox', { userType: 'engineer', userId: 'lead-1' });
  assert.equal(inbox.json.unread.conversations, 1);
});

test('customer, unrelated engineer, and non-member cannot use protected inbox resources', async () => {
  const env = createInboxEnv();
  const created = await api(env, '/api/inbox/conversations', { method: 'POST', userType: 'admin', userId: 'admin', body: { recipient_id: 'eng-1', recipient_type: 'engineer' } });
  const id = created.json.conversation.id;
  for (const actor of [{ userType: 'customer', userId: 'cust-1' }, { userType: 'engineer', userId: 'eng-2' }]) {
    const result = await api(env, `/api/inbox/conversations/${id}`, actor);
    assert.equal(result.response.status, 403);
  }
});
```

- [ ] **Step 2: Run focused API tests and verify failure**

Run: `cd worker && node --test tests/inbox.test.mjs`

Expected: FAIL because `/api/inbox/*` is not yet recognized as a protected route or routed.

- [ ] **Step 3: Add identity, contact, and access helpers in `worker/src/index.js`**

Import `canStartDirectConversation`, `isConversationParticipant`, and `isInboxIdentity` from `./lib/inbox.js`. Add these focused helpers near `authenticateRequest`:

```js
async function getInboxIdentity(auth, env) {
  if (auth.userType === 'admin') return { userId: auth.userId, userType: 'admin', name: '运营 Joe' };
  if (auth.userType !== 'engineer') return null;
  const engineer = await env.DB.prepare('SELECT id, name, engineer_role, regional_lead_id, status FROM engineers WHERE id = ?').bind(auth.userId).first();
  if (!engineer || engineer.status === 'offline') return null;
  return { userId: engineer.id, userType: 'engineer', name: engineer.name || 'Engineer', engineerRole: engineer.engineer_role || 'engineer', regionalLeadId: engineer.regional_lead_id || null };
}

async function assertInboxAccess(request, env) {
  const identity = await getInboxIdentity(request._auth, env);
  if (!identity || !isInboxIdentity(identity)) throw new GuardError('您无权访问内部收件箱', 403);
  return identity;
}
```

- [ ] **Step 4: Implement contact, direct-conversation, list, read, and message handlers**

Add handlers following current Worker conventions. Their required SQL contract is:

```js
// contacts: return admin plus only related engineers, never accept a requester id from input
// direct create: query existing direct conversation that has exactly both active participants; otherwise insert conversation and two participants
// detail/list: join inbox_conversations, inbox_participants, and latest inbox_messages; filter by current auth participant
// send: assert active participant; assertMaxLength(content, LIMITS.content, 'content'); insert inbox_messages; update last_message_at; createNotification for every other active participant
// read: set last_read_message_id to the newest message id only for request._auth identity
```

For messages, use this exact validation and notification loop:

```js
const content = String(body.content || '').trim();
assertMaxLength(content, LIMITS.content, 'content');
if (!content) return errorResponse(market === 'cn' ? '消息不能为空' : 'Message is required', 400);

for (const participant of participants.filter((item) => item.user_id !== identity.userId || item.user_type !== identity.userType)) {
  await createNotification(env, {
    user_id: participant.user_id,
    user_type: participant.user_type,
    type: 'inbox_message',
    title: market === 'cn' ? '收到新的内部消息' : 'New internal message',
    body: `${identity.name}: ${truncateStr(content, 120)}`,
    data: { conversation_id: conversationId, work_order_id: conversation.work_order_id || null },
  });
}
```

For admin notifications, update `worker/src/lib/push.js` so `createNotification()` still persists a notification but `sendPushToUser()` returns `false` for `admin`; this preserves the planned in-app-only admin behavior rather than dropping admin records.

- [ ] **Step 5: Add protected route recognition and dispatch before the generic work-order routes**

Add `path === '/api/inbox' || path.startsWith('/api/inbox/')` to `isKnownProtectedRoute`. Before work-order routing, dispatch:

```js
if (path === '/api/inbox' && request.method === 'GET') return handleGetInbox(request, env);
if (path === '/api/inbox/contacts' && request.method === 'GET') return handleGetInboxContacts(request, env);
if (path === '/api/inbox/conversations' && request.method === 'POST') return handleCreateInboxConversation(request, env);
if (path.match(/^\/api\/inbox\/conversations\/[^/]+$/) && request.method === 'GET') return handleGetInboxConversation(request, env);
if (path.match(/^\/api\/inbox\/conversations\/[^/]+\/messages$/) && request.method === 'POST') return handlePostInboxMessage(request, env);
if (path.match(/^\/api\/inbox\/conversations\/[^/]+\/read$/) && request.method === 'POST') return handleMarkInboxConversationRead(request, env);
if (path.match(/^\/api\/inbox\/work-orders\/[^/]+$/) && request.method === 'POST') return handleGetOrCreateWorkOrderInboxConversation(request, env);
```

`handleGetOrCreateWorkOrderInboxConversation` must load the work order and permit only admin, its assigned regional lead, or its assigned engineer. It must create a `kind = 'work_order'` conversation with the admin plus assigned internal roles; it must not expose or query customer messages.

- [ ] **Step 6: Extend tests for contact changes, duplicate direct conversations, work-order isolation, and notification failure**

Add tests that assert:

```js
// after env.engineers.find(e => e.id === 'eng-1').regional_lead_id = 'lead-2', lead-1 disappears from contacts
// two POSTs for the same pair return identical conversation.id
// customer GET /api/inbox/work-orders/wo-1 returns 403
// a failed OneSignal configuration leaves the persisted inbox message and notification intact
```

- [ ] **Step 7: Run Worker tests**

Run: `cd worker && node --test tests/inbox.test.mjs && npm test`

Expected: all inbox tests and the existing Worker suite PASS.

- [ ] **Step 8: Register inbox tests and commit Worker API**

Add `tests/inbox.test.mjs` to both test commands in `worker/package.json`, then:

```bash
git add worker/src/index.js worker/src/lib/push.js worker/tests/inbox.test.mjs worker/package.json
git commit -m "feat(worker): add unified inbox APIs"
```

### Task 4: Build the admin inbox

**Files:**
- Modify: `admin/src/services/api.js`
- Create: `admin/src/pages/InboxPage.jsx`
- Modify: `admin/src/App.jsx`
- Create: `admin/src/pages/InboxPage.test.mjs`
- Modify: `admin/package.json`

- [ ] **Step 1: Write static contract tests before UI implementation**

Create `admin/src/pages/InboxPage.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin inbox provides filters, direct-message creation, and no client-supplied authorization rule', async () => {
  const source = await readFile(new URL('./InboxPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /全部|All/);
  assert.match(source, /新建私信|New message/);
  assert.match(source, /getInboxContacts/);
  assert.match(source, /createInboxConversation/);
  assert.doesNotMatch(source, /regional_lead_id\s*===/);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd admin && node --test src/pages/InboxPage.test.mjs`

Expected: FAIL with `ENOENT` for `InboxPage.jsx`.

- [ ] **Step 3: Add admin API client functions**

Append to `admin/src/services/api.js`:

```js
export const getInbox = (filter = 'all') => request(`/api/inbox?filter=${encodeURIComponent(filter)}`);
export const getInboxContacts = () => request('/api/inbox/contacts');
export const createInboxConversation = (recipientId, recipientType) => request('/api/inbox/conversations', { method: 'POST', body: JSON.stringify({ recipient_id: recipientId, recipient_type: recipientType }) });
export const getInboxConversation = (id) => request(`/api/inbox/conversations/${id}`);
export const postInboxMessage = (id, content) => request(`/api/inbox/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
export const markInboxConversationRead = (id) => request(`/api/inbox/conversations/${id}/read`, { method: 'POST', body: JSON.stringify({}) });
```

- [ ] **Step 4: Implement `InboxPage` as a focused three-pane component**

Create `admin/src/pages/InboxPage.jsx` with state for `filter`, `inbox`, `contacts`, `selectedId`, `conversation`, and `draft`. On initial render call `getInbox()`; only call `getInboxContacts()` when the “新建私信” control opens. Select a row with `getInboxConversation(id)` and call `markInboxConversationRead(id)`. Send using `postInboxMessage(selectedId, draft.trim())`, clear draft only after success, and reload current conversation plus inbox. Render:

```jsx
const FILTERS = [
  ['all', '全部'], ['work_order', '工单会话'], ['direct', '私信'], ['system', '系统通知'],
];
// Left: filters and “新建私信”; middle: API-returned conversation rows; right: participants and linked work order.
// Never derive contact access locally; map only contacts returned by getInboxContacts().
```

Use existing CSS variables and `lucide-react` icons. Keep system notifications read-only and use their API-provided destination to open linked conversations or work orders. Do not add attachments, deletion, editing, or group chat controls.

- [ ] **Step 5: Add page navigation and periodic unread refresh**

In `admin/src/App.jsx`, import `Bell`, `InboxPage`, and `getInbox`. Add `{ key: 'inbox', label: '收件箱', icon: Bell }` to `NAV_ITEMS`, render `<InboxPage />`, and maintain `inboxUnread` from `getInbox().unread.total` on login plus a 30-second interval. Render the badge beside the inbox nav item only when nonzero.

- [ ] **Step 6: Run admin focused test and build**

Run: `cd admin && node --test src/pages/InboxPage.test.mjs && npm test && npm run build`

Expected: all PASS; Vite emits `dist/`.

- [ ] **Step 7: Commit admin inbox**

```bash
git add admin/src/services/api.js admin/src/pages/InboxPage.jsx admin/src/pages/InboxPage.test.mjs admin/src/App.jsx admin/package.json
git commit -m "feat(admin): add operations inbox"
```

### Task 5: Build the engineer and regional-lead inbox

**Files:**
- Modify: `frontend/src/services/api.js`
- Create: `frontend/src/components/Engineer/InboxPanel.jsx`
- Modify: `frontend/src/components/Engineer/EngineerWorkspace.jsx`
- Create: `frontend/tests/inbox-contract.test.mjs`

- [ ] **Step 1: Write failing engineer/client isolation tests**

Create `frontend/tests/inbox-contract.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('inbox is an engineer workspace capability and is absent from customer app surfaces', async () => {
  const panel = await readFile(new URL('../src/components/Engineer/InboxPanel.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(panel, /getInboxContacts/);
  assert.match(panel, /createInboxConversation/);
  assert.match(app, /EngineerWorkspace/);
  assert.doesNotMatch(app, /CustomerHomeModal[\s\S]*InboxPanel/);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd frontend && node --test tests/inbox-contract.test.mjs`

Expected: FAIL with `ENOENT` for `InboxPanel.jsx`.

- [ ] **Step 3: Add engineer API wrappers that reuse authenticated headers**

Append equivalents of the Task 4 functions to `frontend/src/services/api.js`, using `fetch`, `API_BASE`, and `authHeaders()`. Each non-OK response must throw `new Error(\`HTTP ${response.status}\`)`, matching nearby service functions.

- [ ] **Step 4: Implement `InboxPanel`**

Create `frontend/src/components/Engineer/InboxPanel.jsx`. Receive `onClose` and optional `onOpenWorkOrder`. Load inbox when opened; offer the API-returned contact list in a modal or inline picker. Render role labels from contact data, not inferred identity. Include direct/work-order/system filters, message list, composer, unread state, and linked-work-order button. On new direct creation, select the returned conversation and load it. On message send, reload current conversation and inbox.

All copy must include `en` and `cn` strings using the project’s `isCnLocale()` pattern. Do not import this component into any customer-only component.

- [ ] **Step 5: Add inbox entry to `EngineerWorkspace`**

In `frontend/src/components/Engineer/EngineerWorkspace.jsx`:

```jsx
const [inboxOpen, setInboxOpen] = useState(false);
// Add a “收件箱 / Inbox” button in the workspace toolbar with API-returned unread total.
// Render <InboxPanel isOpen={inboxOpen} onClose={() => setInboxOpen(false)} /> near existing calendar/profile overlays.
```

Fetch the unread value via `getInbox()` alongside other workspace refreshes. The button is available to both engineer roles; API contacts enforce the different recipient scopes.

- [ ] **Step 6: Run frontend checks**

Run: `cd frontend && node --test tests/inbox-contract.test.mjs && npm test && npm run lint && npm run build`

Expected: all PASS; lint has no errors; Vite emits `dist/`.

- [ ] **Step 7: Commit engineer inbox**

```bash
git add frontend/src/services/api.js frontend/src/components/Engineer/InboxPanel.jsx frontend/src/components/Engineer/EngineerWorkspace.jsx frontend/tests/inbox-contract.test.mjs
git commit -m "feat(engineer): add collaboration inbox"
```

### Task 6: Integrate internal work-order entry points and run full verification

**Files:**
- Modify: `admin/src/pages/WorkOrdersPage.jsx`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`
- Modify: `admin/src/pages/WorkOrdersPage.review-flow.test.mjs`
- Modify: `frontend/tests/inbox-contract.test.mjs`

- [ ] **Step 1: Write failing entry-point contract tests**

Add assertions:

```js
// admin test: WorkOrdersPage imports or invokes the work-order inbox API and labels the control “内部协作” / “Internal collaboration”.
// frontend test: WorkOrderDetailModal gates the control with userType !== 'customer'.
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd admin && node --test src/pages/WorkOrdersPage.review-flow.test.mjs && cd ../frontend && node --test tests/inbox-contract.test.mjs`

Expected: FAIL because neither work-order screen has an inbox entry point.

- [ ] **Step 3: Add admin work-order entry point**

Add `getOrCreateWorkOrderInboxConversation(workOrderId)` to `admin/src/services/api.js`:

```js
export const getOrCreateWorkOrderInboxConversation = (workOrderId) => request(`/api/inbox/work-orders/${workOrderId}`, { method: 'POST', body: JSON.stringify({}) });
```

In the selected work-order action area of `admin/src/pages/WorkOrdersPage.jsx`, add an “内部协作” button. It must call the helper and navigate to the inbox page with the returned conversation id in component state or query string. It must not convert existing customer-visible messages or notes.

- [ ] **Step 4: Add engineer/lead work-order entry point, excluding customers**

Add matching helper in `frontend/src/services/api.js`. In `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`, add the “内部协作 / Internal collaboration” tab or button only when `userType !== 'customer'`. On activation call the helper and open `InboxPanel` at that conversation. Preserve the existing `MessagePanel` for client-visible work-order messages.

- [ ] **Step 5: Run complete local suite**

Run:

```bash
cd worker && npm test
cd ../frontend && npm run lint && npm test && npm run build
cd ../admin && npm test && npm run build
```

Expected: every command exits 0.

- [ ] **Step 6: Review diff and commit integration**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only planned inbox files staged.

```bash
git add admin/src/services/api.js admin/src/pages/WorkOrdersPage.jsx admin/src/pages/WorkOrdersPage.review-flow.test.mjs frontend/src/services/api.js frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx frontend/tests/inbox-contract.test.mjs
git commit -m "feat: link work orders to internal collaboration inbox"
```

### Task 7: Production migration and release validation

**Files:**
- No source-code changes expected.

- [ ] **Step 1: Confirm migration ledger before production changes**

Run from `worker/`:

```bash
npx wrangler d1 execute sagemro-db --env production --remote --command "SELECT version FROM _migrations ORDER BY version;"
npx wrangler d1 execute sagemro-db-cn --env production --remote --command "SELECT version FROM _migrations ORDER BY version;"
```

Expected: neither output contains `034_unified_operations_inbox` before applying it.

- [ ] **Step 2: Apply the exact migration to both production D1 databases**

Run from `worker/`:

```bash
npx wrangler d1 execute sagemro-db --env production --remote --file migrations/034_unified_operations_inbox.sql
npx wrangler d1 execute sagemro-db-cn --env production --remote --file migrations/034_unified_operations_inbox.sql
```

Expected: each command succeeds and records the migration version. Do not deploy Worker before both schema changes succeed.

- [ ] **Step 3: Recheck migration ledger**

Run the Step 1 commands again.

Expected: both databases contain `034_unified_operations_inbox` exactly once.

- [ ] **Step 4: Deploy through the repository’s existing release workflow**

Push the reviewed branch according to the deployment policy. Worker/schema changes must reach `main` for Worker deployment. For `.cn` frontend/admin changes, manually trigger `Deploy China Edition to Aliyun ECS` from `china-edition` after the code is merged there; a Pages deployment alone is not `.cn` production.

- [ ] **Step 5: Smoke-test the released permission paths**

Manually verify on the relevant production hosts:

1. Admin creates a direct message to an engineer; engineer sees an unread inbox item and replies.
2. Regional lead sees and messages a direct subordinate; unrelated engineer is absent from contacts.
3. Engineer sees only “运营 Joe” and own regional lead.
4. Customer cannot discover an inbox entry and receives 403 from `/api/inbox` with a customer token.
5. A work-order internal collaboration message is not visible in the customer’s work-order message list.
6. International subscribed engineer receives only configured important OneSignal events; `.cn` still receives in-app unread state without OneSignal.

## Plan self-review

- **Spec coverage:** Tasks 1–3 cover schema, secure API, D1 migration, existing notification aggregation, direct contacts, work-order conversations, and notification fallback. Tasks 4–6 cover admin/engineer UI, customer exclusion, and work-order entry. Task 7 covers required two-database migration and deployment policy.
- **Scope check:** No client unified inbox, engineer-to-engineer direct messaging, groups, attachments, edits, WebSockets, SMS, or WeChat are included.
- **Consistency:** All UI calls use `/api/inbox`; the only inbox identity types are `admin` and `engineer`; `inbox_conversations`, `inbox_participants`, and `inbox_messages` names match migration, Worker, and tests.
