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

test('staff login accepts a phone number or login name while preserving the phone request field', async () => {
  const source = await readFile(new URL('./LoginPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(source, /Phone number or login name/);
  assert.match(source, /手机号或登录名/);
  assert.match(source, /<label[^>]*htmlFor="admin-login-identifier"/);
  assert.match(source, /id="admin-login-identifier"/);
  assert.match(source, /type="text"/);
  assert.match(source, /autoComplete="username"/);
  assert.doesNotMatch(source, /type="tel"/);
  assert.match(api, /JSON\.stringify\(\{ phone, password \}\)/);
});
