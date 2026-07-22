import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const api = await readFile(new URL('./api.js', import.meta.url), 'utf8');
const login = await readFile(new URL('../pages/LoginPage.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../../vite.config.js', import.meta.url), 'utf8');

test('admin API requests include cookies and CSRF', () => {
  assert.match(api, /credentials:\s*'include'/);
  assert.match(api, /X-CSRF-Token/);
  assert.match(api, /admin_csrf_token/);
});

test('admin exposes session restore and logout APIs', () => {
  assert.match(api, /export async function restoreAdminSession/);
  assert.match(api, /\/api\/auth\/session/);
  assert.match(api, /export async function adminLogout/);
  assert.match(api, /\/api\/auth\/logout/);
});

test('new admin logins do not persist JWTs in localStorage', () => {
  assert.doesNotMatch(login, /localStorage\.setItem\('admin_token'/);
  assert.match(api, /admin_csrf_token/);
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

test('admin dev server allows the isolated E2E portal host', () => {
  assert.match(viteConfig, /admin\.127\.0\.0\.1\.nip\.io/);
});
