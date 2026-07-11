import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('knowledge page exposes usage rules and makes new article action visible', async () => {
  const source = await readFile(new URL('./KnowledgePage.jsx', import.meta.url), 'utf8');

  assert.match(source, /importText: 'Import'/);
  assert.match(source, /newBlankDraft: 'New blank draft'/);
  assert.match(source, /Knowledge Base usage and rules/);
  assert.match(source, /accept=".md,.markdown,.txt,.csv"/);
  assert.match(source, /FileReader/);
  assert.match(source, /New draft ready/);
  assert.match(source, /titleInputRef\.current\?\.focus/);
});
