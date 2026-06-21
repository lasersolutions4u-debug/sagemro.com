import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('admin login page uses its own light palette instead of inherited console dark surfaces', async () => {
  const source = await readFile(new URL('./LoginPage.jsx', import.meta.url), 'utf8');

  assert.equal(source.includes('var(--color-text)'), false);
  assert.equal(source.includes('var(--color-text-secondary)'), false);
  assert.equal(source.includes('var(--color-surface-elevated)'), false);
  assert.equal(source.includes('var(--color-border)'), false);
});
