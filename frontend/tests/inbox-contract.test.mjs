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
