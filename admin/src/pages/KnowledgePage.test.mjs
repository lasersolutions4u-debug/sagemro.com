import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('knowledge page exposes usage rules and makes new article action visible', async () => {
  const source = await readFile(new URL('./KnowledgePage.jsx', import.meta.url), 'utf8');

  assert.match(source, /Usage & rules/);
  assert.match(source, /Import text\/Markdown/);
  assert.match(source, /accept=".md,.markdown,.txt,.csv"/);
  assert.match(source, /FileReader/);
  assert.match(source, /New draft ready/);
  assert.match(source, /titleInputRef\.current\?\.focus/);
});
