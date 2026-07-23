import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('CN Admin keeps Bearer fallback and sends Cookie/CSRF credentials', async () => {
  const api = await read('services/api.js');
  const app = await read('App.jsx');

  assert.match(api, /credentials:\s*['"]include['"]/);
  assert.match(api, /admin_csrf_token/);
  assert.match(api, /X-CSRF-Token/);
  assert.match(api, /admin_token/);
  assert.match(api, /restoreAdminSession/);
  assert.match(api, /adminLogout/);
  assert.match(app, /restoreAdminSession/);
});

test('CN Admin does not store an absent JWT returned by Cookie login', async () => {
  const login = await read('pages/LoginPage.jsx');

  assert.match(login, /admin_csrf_token/);
  assert.doesNotMatch(login, /localStorage\.setItem\(['"]admin_token['"], data\.token\)/);
});

test('CN Admin resets and guards navigation across identity changes', async () => {
  const app = await read('App.jsx');

  assert.match(app, /restoreAdminSession\(\)[\s\S]*setActivePage\('dashboard'\)[\s\S]*setUser\(restoredUser\)/);
  assert.match(app, /const handleLogout = \(\) => \{[\s\S]*setActivePage\('dashboard'\)[\s\S]*setUser\(null\)/);
  assert.match(app, /const handleLogin = \(nextUser\) => \{[\s\S]*setActivePage\('dashboard'\)[\s\S]*setUser\(normalizedUser\)/);
  assert.match(app, /const currentPage = visibleNavItems\.some\(\(item\) => item\.key === activePage\) \? activePage : 'dashboard'/);
  assert.match(app, /switch \(currentPage\)/);
});
