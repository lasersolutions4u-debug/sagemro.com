import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('inbox page provides the required three-pane inbox interactions', async () => {
  const source = await readFile(new URL('./InboxPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /getInbox\(nextFilter\)/);
  assert.match(source, /getInboxContacts\(\)/);
  assert.match(source, /getInboxConversation\(item\.id\)/);
  assert.match(source, /markInboxConversationRead\(item\.id\)/);
  assert.match(source, /postInboxMessage\(selectedConversation\.id, draft\)/);
  assert.match(source, /createInboxDirectConversation\(contact\.id, contact\.type\)/);
  assert.match(source, /\['all', 'work_order', 'direct', 'system'\]/);
  assert.match(source, /selectedNotification/);
  assert.match(source, /New message/);
});

test('admin API client exposes inbox endpoints', async () => {
  const source = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(source, /request\(`\/api\/inbox\?filter=\$\{filter\}`\)/);
  assert.match(source, /request\('\/api\/inbox\/contacts'\)/);
  assert.match(source, /request\('\/api\/inbox\/conversations', \{[\s\S]*recipient_id/);
  assert.match(source, /request\(`\/api\/inbox\/conversations\/\$\{conversationId\}`\)/);
  assert.match(source, /\/messages`, \{/);
  assert.match(source, /\/read`, \{/);
});
