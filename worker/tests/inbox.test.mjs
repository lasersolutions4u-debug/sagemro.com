import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canStartDirectConversation, isConversationParticipant, isInboxIdentity } from '../src/lib/inbox.js';
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
      { id: 'lead-1', name: 'Lead', role: 'regional_lead', status: 'active', regional_lead_id: null },
      { id: 'eng-1', name: 'Engineer', role: 'engineer', status: 'active', regional_lead_id: 'lead-1' },
      { id: 'eng-2', name: 'Outsider', role: 'engineer', status: 'active', regional_lead_id: 'lead-2' },
    ],
    workOrders: [{ id: 'wo-1', order_no: 'WO-1', engineer_id: 'eng-1', assigned_regional_lead_id: 'lead-1' }],
    conversations: [], participants: [], messages: [], notifications: [],
  };
  const DB = { prepare(sql) { return { args: [], bind(...args) { this.args = args; return this; }, async first() {
    if (/FROM engineers WHERE id = \?/i.test(sql)) return state.engineers.find((x) => x.id === this.args[0]) || null;
    if (/FROM work_orders WHERE id = \?/i.test(sql)) return state.workOrders.find((x) => x.id === this.args[0]) || null;
    if (/FROM inbox_conversations WHERE id = \?/i.test(sql)) return state.conversations.find((x) => x.id === this.args[0]) || null;
    if (/FROM inbox_conversations c[\s\S]*inbox_participants/i.test(sql)) {
      const [aType, aId, bType, bId] = this.args;
      return state.conversations.find((c) => c.kind === 'direct' && state.participants.filter((p) => p.conversation_id === c.id && !p.left_at).some((p) => p.user_type === aType && p.user_id === aId) && state.participants.filter((p) => p.conversation_id === c.id && !p.left_at).some((p) => p.user_type === bType && p.user_id === bId)) || null;
    }
    return null;
  }, async all() {
    if (/SELECT id, name, role, regional_lead_id FROM engineers/i.test(sql)) {
      const [leadId, memberId] = this.args;
      return { results: state.engineers.filter((x) => x.status === 'active' && (x.id === leadId || x.regional_lead_id === memberId)) };
    }
    if (/FROM inbox_participants WHERE conversation_id/i.test(sql)) return { results: state.participants.filter((x) => x.conversation_id === this.args[0]) };
    return { results: [] };
  }, async run() {
    if (/INSERT INTO inbox_conversations/i.test(sql)) state.conversations.push({ id: this.args[0], kind: 'direct' });
    if (/INSERT INTO inbox_participants/i.test(sql)) {
      state.participants.push({ conversation_id: this.args[0], user_type: this.args[1], user_id: this.args[2], left_at: null }, { conversation_id: this.args[3], user_type: this.args[4], user_id: this.args[5], left_at: null });
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

test('inbox API reuses a direct conversation and protects membership', async () => {
  const env = createInboxEnv();
  const first = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/conversations', 'POST', { recipient_id: 'lead-1', recipient_type: 'engineer' });
  assert.equal(first.response.status, 200);
  const second = await inboxRequest(env, 'engineer', 'eng-1', '/api/inbox/conversations', 'POST', { recipient_id: 'lead-1', recipient_type: 'engineer' });
  assert.equal(second.json.conversation.id, first.json.conversation.id);
  const denied = await inboxRequest(env, 'engineer', 'eng-2', `/api/inbox/conversations/${first.json.conversation.id}`);
  assert.equal(denied.response.status, 403);
});
