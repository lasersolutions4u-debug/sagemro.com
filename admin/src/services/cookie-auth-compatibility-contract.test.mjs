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
  assert.match(app, /const currentPage = visibleNavItems\.some\(\(item\) => item\.key === activePage\) \? activePage : visibleNavItems\[0\]\?\.key \|\| 'knowledge'/);
  // 后台裁剪为知识中枢后：非 admin 内部员工只保留知识库，员工账号只对 bootstrap 管理员可见。
  assert.match(app, /if \(user\.staffRole !== 'admin'\) return NAV_ITEMS\.filter\(\(item\) => item\.key === 'knowledge'\)/);
  assert.match(app, /item\.key === 'staffAccounts' \? isBootstrapAdmin : true/);
  assert.doesNotMatch(app, /businessWorkspace/);
  assert.match(app, /switch \(currentPage\)/);
});
