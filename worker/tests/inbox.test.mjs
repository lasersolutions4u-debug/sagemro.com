import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('unified operations inbox migration defines the conversation, membership, and message schema', async () => {
  const migration = await readFile(new URL('../migrations/034_unified_operations_inbox.sql', import.meta.url), 'utf8');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS inbox_conversations/);
  assert.match(migration, /kind TEXT NOT NULL CHECK \(kind IN \('direct', 'work_order'\)\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS inbox_participants/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS inbox_messages/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_inbox_conversations_work_order/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_inbox_participants_user/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation_created/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_conversations_unique_work_order[\s\S]*WHERE kind = 'work_order'/);
  assert.match(migration, /\('034_unified_operations_inbox', 'Unified operations inbox tables'\)/);

  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  const notificationsEnd = schema.indexOf('CREATE INDEX IF NOT EXISTS idx_notifications_unread');
  const inboxStart = schema.indexOf('CREATE TABLE IF NOT EXISTS inbox_conversations');
  assert.ok(inboxStart > notificationsEnd, 'inbox schema follows notifications');
  assert.equal(schema.slice(inboxStart, schema.indexOf('-- 工程师对客户评价（007）', inboxStart)).trim(), migration.replace(/\nINSERT OR IGNORE[\s\S]*/, '').trim());
});
