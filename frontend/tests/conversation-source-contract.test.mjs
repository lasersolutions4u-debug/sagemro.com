import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('authenticated conversation state is loaded from the server', async () => {
  const hook = await read('src/hooks/useConversations.js');
  const app = await read('src/App.jsx');

  assert.match(hook, /getConversations/);
  assert.match(hook, /isAuthenticated/);
  assert.match(hook, /if \(isAuthenticated\)/);
  assert.match(app, /useConversations\(\{ isAuthenticated: Boolean\(currentUser && userType\) \}\)/);
  assert.match(app, /getConversation as getConversationApi/);
  assert.match(app, /getConversationApi\(conv\.id\)/);
  assert.match(app, /handleLoginSuccess[\s\S]*getConversationApi\(conversationId\)/);
});

test('authenticated conversations do not persist message history to localStorage', async () => {
  const app = await read('src/App.jsx');
  const hook = await read('src/hooks/useConversations.js');

  assert.match(app, /if \(!currentUser\) \{[\s\S]*localStorage\.getItem\(`sagemro_messages_/);
  assert.match(app, /else refreshConversations\(\)/);
  assert.match(hook, /if \(!isAuthenticated\) saveToStorage\(updated\)/);
  assert.match(hook, /if \(isAuthenticated\) loadFromServer\(\)/);
  assert.match(app, /const handleDeleteConversation = useCallback\(async \(id\)/);
  assert.match(app, /await deleteConversation\(id\)/);
});
