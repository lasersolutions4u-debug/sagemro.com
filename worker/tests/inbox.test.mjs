import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canStartDirectConversation } from '../src/lib/inbox.js';

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
