import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const api = await readFile(new URL('./api.js', import.meta.url), 'utf8');
const login = await readFile(new URL('../pages/LoginPage.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../../vite.config.js', import.meta.url), 'utf8');

test('admin API requests include cookies and non-empty CSRF for unsafe methods', () => {
  assert.match(api, /credentials:\s*'include'/);
  assert.match(api, /X-CSRF-Token/);
  assert.match(api, /admin_csrf_token/);
  assert.match(api, /csrfToken[\s\S]*!\['GET', 'HEAD', 'OPTIONS'\]\.includes\(method\)/);
});

test('admin exposes session restore and logout APIs', () => {
  assert.match(api, /export async function restoreAdminSession/);
  assert.match(api, /\/api\/auth\/session/);
  assert.match(api, /export async function adminLogout/);
  assert.match(api, /\/api\/auth\/logout/);
});

test('admin login keeps legacy JWT fallback without blindly persisting a missing token', () => {
  assert.doesNotMatch(login, /localStorage\.setItem\('admin_token'/);
  assert.match(api, /admin_csrf_token/);
  assert.match(api, /if \(data\.token\) localStorage\.setItem\('admin_token', data\.token\)/);
  assert.match(api, /if \(data\.csrfToken\)[\s\S]*localStorage\.removeItem\('admin_token'\)/);
});

test('admin application restores and clears the server session', () => {
  assert.match(app, /restoreAdminSession/);
  assert.match(app, /adminLogout/);
  assert.doesNotMatch(app, /localStorage\.getItem\('admin_user'\)/);
  assert.match(app, /const \[authReady, setAuthReady\] = useState\(false\)/);
  assert.match(app, /if \(!authReady\)/);
  assert.match(api, /if \(!data\.authenticated\)[\s\S]*localStorage\.removeItem\('admin_user'\)/);
  assert.match(api, /if \(!data\.authenticated\)[\s\S]*localStorage\.removeItem\('admin_csrf_token'\)/);
});

test('admin navigation resets and guards privileged pages across identity changes', () => {
  assert.match(app, /restoreAdminSession\(\)[\s\S]*setActivePage\('dashboard'\)[\s\S]*setUser\(restoredUser\)/);
  assert.match(app, /const handleLogout = \(\) => \{[\s\S]*setActivePage\('dashboard'\)[\s\S]*setUser\(null\)/);
  assert.match(app, /const handleLogin = \(nextUser\) => \{[\s\S]*setActivePage\('dashboard'\)[\s\S]*setUser\(normalizedUser\)/);
  assert.match(app, /visibleNavItems\.some\(\(item\) => item\.key === activePage\)/);
  assert.match(app, /const currentPage = visibleNavItems\.some\(\(item\) => item\.key === activePage\) \? activePage : 'dashboard'/);
  assert.match(app, /switch \(currentPage\)/);
  assert.match(app, /useEffect\(\(\) => \{[\s\S]*setActivePage\('dashboard'\)[\s\S]*\}, \[activePage, user, visibleNavItems\]\)/);
});

test('admin session restore falls back to the legacy JWT during staggered deploys', () => {
  assert.match(api, /error\?\.status === 404/);
  assert.match(api, /localStorage\.getItem\('admin_token'\)[\s\S]*saved/);
  assert.match(api, /legacy:\s*true/);
});

test('admin dev server allows the isolated E2E portal host', () => {
  assert.match(viteConfig, /admin\.127\.0\.0\.1\.nip\.io/);
});
