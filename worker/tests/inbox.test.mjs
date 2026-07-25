import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canStartDirectConversation, isConversationParticipant, isInboxIdentity } from '../src/lib/inbox.js';
import { createNotification } from '../src/lib/push.js';
import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

test('unified operations inbox migration defines the conversation, membership, and message schema', async () => {
  const migration = await readFile(new URL('../migrations/034_unified_operations_inbox.sql', import.meta.url), 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS inbox_conversations/);
  assert.match(migration, /kind TEXT NOT NULL CHECK \(kind IN \('direct', 'work_order'\)\)/);
  assert.match(migration, /created_by_type TEXT NOT NULL CHECK \(created_by_type IN \('admin', 'engineer'\)\)/);
  assert.match(migration, /last_message_at TEXT NOT NULL DEFAULT \(datetime\('now'\)\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS inbox_participants/);
  assert.match(migration, /user_type TEXT NOT NULL CHECK \(user_type IN \('admin', 'engineer'\)\)/);
  assert.doesNotMatch(migration, /is_active/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS inbox_messages/);
  assert.match(migration, /sender_type TEXT NOT NULL CHECK \(sender_type IN \('admin', 'engineer'\)\)/);
  assert.match(migration, /sender_name TEXT NOT NULL/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_inbox_conversations_work_order/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_inbox_conversations_recent ON inbox_conversations\(kind, last_message_at DESC\)/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_inbox_participants_user ON inbox_participants\(user_id, user_type, left_at\)/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation_created/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_conversations_unique_work_order[\s\S]*WHERE kind = 'work_order'/);
  assert.match(migration, /\('034_unified_operations_inbox', 'Unified operations inbox tables'\)/);

  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const notificationsEnd = schema.indexOf('CREATE INDEX IF NOT EXISTS idx_notifications_unread');
  const inboxStart = schema.indexOf('CREATE TABLE IF NOT EXISTS inbox_conversations');
  assert.ok(inboxStart > notificationsEnd, 'inbox schema follows notifications');
  assert.equal(schema.slice(inboxStart, schema.indexOf('-- 工程师对客户评价（007）', inboxStart)).trim(), migration.replace(/\nINSERT OR IGNORE[\s\S]*/, '').trim());
});

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

test('inbox identity and active participant helpers reject customers and departed members', () => {
  assert.equal(isInboxIdentity(admin), true);
  assert.equal(isInboxIdentity(engineer), true);
  assert.equal(isInboxIdentity({ userId: 'cust-1', userType: 'customer' }), false);
  assert.equal(isConversationParticipant([
    { user_id: 'eng-1', user_type: 'engineer', left_at: null },
  ], engineer), true);
  assert.equal(isConversationParticipant([
    { user_id: 'eng-1', user_type: 'engineer', left_at: '2026-07-25T00:00:00Z' },
  ], engineer), false);
});

const JWT_SECRET = 'inbox-api-test-secret-at-least-16';

function createInboxEnv() {
  const state = {
    engineers: [
      { id: 'lead-1', name: 'Lead', engineer_role: 'regional_lead', status: 'available', regional_lead_id: null },
      { id: 'eng-1', name: 'Engineer', engineer_role: 'engineer', status: 'available', regional_lead_id: 'lead-1' },
      { id: 'eng-2', name: 'Outsider', engineer_role: 'engineer', status: 'available', regional_lead_id: 'lead-2' },
    ],
    workOrders: [{ id: 'wo-1', order_no: 'WO-1', engineer_id: 'eng-1', assigned_regional_lead_id: 'lead-1' }],
    conversations: [], participants: [], messages: [], notifications: [],
  };
  const DB = { prepare(sql) { return { args: [], bind(...args) { this.args = args; return this; }, async first() {
    if (/FROM engineers WHERE id = \?/i.test(sql)) return state.engineers.find((x) => x.id === this.args[0]) || null;
    if (/FROM work_orders WHERE id = \?/i.test(sql)) return state.workOrders.find((x) => x.id === this.args[0]) || null;
    if (/FROM inbox_conversations WHERE id = \?/i.test(sql)) return state.conversations.find((x) => x.id === this.args[0]) || null;
    if (/SELECT id FROM inbox_messages WHERE conversation_id = \?/i.test(sql)) {
      return state.messages.filter((message) => message.conversation_id === this.args[0]).at(-1) || null;
    }
    if (/FROM inbox_conversations c[\s\S]*inbox_participants/i.test(sql)) {
      const [aType, aId, bType, bId] = this.args;
      return state.conversations.find((c) => c.kind === 'direct' && state.participants.filter((p) => p.conversation_id === c.id && !p.left_at).some((p) => p.user_type === aType && p.user_id === aId) && state.participants.filter((p) => p.conversation_id === c.id && !p.left_at).some((p) => p.user_type === bType && p.user_id === bId)) || null;
    }
    return null;
  }, async all() {
    if (/SELECT id, name, engineer_role, regional_lead_id FROM engineers/i.test(sql)) {
      const [leadId, memberId] = this.args;
      return { results: state.engineers.filter((x) => x.status === 'available' && (x.id === leadId || x.regional_lead_id === memberId)) };
    }
    if (/FROM inbox_participants WHERE conversation_id/i.test(sql)) return { results: state.participants.filter((x) => x.conversation_id === this.args[0]) };
    if (/FROM inbox_conversations c JOIN inbox_participants p/i.test(sql)) {
      const [userId, userType] = this.args;
      return { results: state.conversations
        .filter((conversation) => state.participants.some((participant) => participant.conversation_id === conversation.id && participant.user_id === userId && participant.user_type === userType && !participant.left_at))
        .map((conversation) => {
          const participant = state.participants.find((item) => item.conversation_id === conversation.id && item.user_id === userId && item.user_type === userType);
          const latest = state.messages.filter((message) => message.conversation_id === conversation.id).at(-1);
          return { ...conversation, last_read_message_id: participant.last_read_message_id || null, latest_message_id: latest?.id || null };
        }) };
    }
    if (/FROM notifications WHERE user_id = \? AND user_type = \?/i.test(sql)) {
      return { results: state.notifications.filter((notification) => notification.user_id === this.args[0] && notification.user_type === this.args[1]) };
    }
    return { results: [] };
  }, async run() {
    if (/INSERT INTO inbox_conversations/i.test(sql)) state.conversations.push({ id: this.args[0], kind: 'direct' });
    if (/INSERT INTO inbox_participants/i.test(sql)) {
      state.participants.push({ conversation_id: this.args[0], user_type: this.args[1], user_id: this.args[2], left_at: null }, { conversation_id: this.args[3], user_type: this.args[4], user_id: this.args[5], left_at: null });
    }
    if (/INSERT INTO inbox_messages/i.test(sql)) {
      state.messages.push({ id: this.args[0], conversation_id: this.args[1], sender_type: this.args[2], sender_id: this.args[3], sender_name: this.args[4], content: this.args[5] });
    }
    if (/INSERT INTO notifications/i.test(sql)) {
      state.notifications.push({ id: this.args[0], user_id: this.args[1], user_type: this.args[2], type: this.args[3], title: this.args[4], body: this.args[5], data: this.args[6], is_read: 0 });
    }
    if (/UPDATE inbox_participants SET last_read_message_id/i.test(sql)) {
      const participant = state.participants.find((item) => item.conversation_id === this.args[1] && item.user_type === this.args[2] && item.user_id === this.args[3]);
      participant.last_read_message_id = this.args[0];
    }
    return { success: true };
  } }; } };
  return { JWT_SECRET, DB, __state: state };
}

async function inboxRequest(env, userType, userId, path, method = 'GET', body) {
  const token = await signJwt({ userType, userId, exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

test('inbox API exposes allowed contacts and rejects customers', async () => {
  const env = createInboxEnv();
  const contacts = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/contacts');
  assert.equal(contacts.response.status, 200);
  assert.deepEqual(contacts.json.contacts.map((x) => x.id), ['admin', 'lead-1']);
  const denied = await inboxRequest(env, 'customer', 'cust-1', '/api/inbox');
  assert.equal(denied.response.status, 403);
});

test('inbox API uses engineer_role and available status for contacts', async () => {
  const env = createInboxEnv();
  env.__state.engineers[0].status = 'paused';
  const contacts = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/contacts');
  assert.deepEqual(contacts.json.contacts.map((x) => x.id), ['admin']);
});

test('inbox API reuses a direct conversation and protects membership', async () => {
  const env = createInboxEnv();
  const first = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/conversations', 'POST', { recipient_id: 'lead-1', recipient_type: 'engineer' });
  assert.equal(first.response.status, 200);
  const second = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/conversations', 'POST', { recipient_id: 'lead-1', recipient_type: 'engineer' });
  assert.equal(second.json.conversation.id, first.json.conversation.id);
  const denied = await inboxRequest(env, 'engineer', 'eng-2', `/api/inbox/conversations/${first.json.conversation.id}`);
  assert.equal(denied.response.status, 403);
});

test('inbox list aggregates system notifications, unread counters, and supported filters', async () => {
  const env = createInboxEnv();
  const created = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/conversations', 'POST', { recipient_id: 'lead-1', recipient_type: 'engineer' });
  await inboxRequest(env, 'engineer', 'eng-1', `/api/inbox/conversations/${created.json.conversation.id}/messages`, 'POST', { content: 'Need help' });
  env.__state.notifications.push({ id: 'system-1', user_id: 'lead-1', user_type: 'engineer', is_read: 0, title: 'Dispatch' });
  const all = await inboxRequest(env, 'engineer', 'lead-1', '/api/inbox?filter=all');
  assert.equal(all.json.unread.conversations, 1);
  assert.equal(all.json.unread.notifications, 2);
  assert.equal(all.json.unread.total, 3);
  assert.equal(all.json.notifications.some((item) => item.kind === 'system'), true);
  const direct = await inboxRequest(env, 'engineer', 'lead-1', '/api/inbox?filter=direct');
  assert.equal(direct.json.conversations.length, 1);
  assert.equal(direct.json.notifications.length, 0);
  const system = await inboxRequest(env, 'engineer', 'lead-1', '/api/inbox?filter=system');
  assert.equal(system.json.conversations.length, 0);
  assert.equal(system.json.notifications.length, 2);
});

test('direct messages recheck the current reporting relationship before delivery', async () => {
  const env = createInboxEnv();
  const created = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/conversations', 'POST', { recipient_id: 'lead-1', recipient_type: 'engineer' });
  env.__state.engineers[1].regional_lead_id = 'lead-2';
  const sent = await inboxRequest(env, 'engineer', 'eng-1', `/api/inbox/conversations/${created.json.conversation.id}/messages`, 'POST', { content: 'Should fail' });
  assert.equal(sent.response.status, 403);
});

test('marking an inbox conversation read always advances to its newest message', async () => {
  const env = createInboxEnv();
  const created = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/conversations', 'POST', { recipient_id: 'lead-1', recipient_type: 'engineer' });
  const id = created.json.conversation.id;
  env.__state.messages.push({ id: 'message-1', conversation_id: id }, { id: 'message-2', conversation_id: id });
  const marked = await inboxRequest(env, 'engineer', 'lead-1', `/api/inbox/conversations/${id}/read`, 'POST', { message_id: 'arbitrary-id' });
  assert.equal(marked.response.status, 200);
  assert.equal(env.__state.participants.find((item) => item.conversation_id === id && item.user_id === 'lead-1').last_read_message_id, 'message-2');
});

test('notification persistence can skip OneSignal dispatch for the CN market', async () => {
  let inserts = 0;
  const env = {
    DB: { prepare() { return { bind() { return this; }, async run() { inserts += 1; } }; } },
    ONESIGNAL_APP_ID: 'app-id',
    ONESIGNAL_REST_API_KEY: 'rest-key',
  };
  const originalFetch = globalThis.fetch;
  let pushCalls = 0;
  globalThis.fetch = async () => { pushCalls += 1; return new Response('{}', { status: 200 }); };
  try {
    await createNotification(env, { user_id: 'eng-1', user_type: 'engineer', type: 'inbox_message', title: '新协作消息', body: 'CN message', push: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(inserts, 1);
  assert.equal(pushCalls, 0);
});
