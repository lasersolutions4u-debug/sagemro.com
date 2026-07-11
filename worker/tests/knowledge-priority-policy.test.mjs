import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('AI prompt contains invisible knowledge priority and conflict policy', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

  assert.match(source, /Knowledge Priority & Conflict Policy/);
  assert.match(source, /Prefer published SAGEMRO knowledge over general model knowledge/);
  assert.match(source, /General model knowledge may fill only general background/);
  assert.match(source, /Do not expose the words "policy", "conflict", "priority", or "knowledge base"/);
  assert.match(source, /No matching published SAGEMRO knowledge was found/);
});
