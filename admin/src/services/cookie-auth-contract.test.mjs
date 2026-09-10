import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const api = await readFile(new URL('./api.js', import.meta.url), 'utf8');
const login = await readFile(new URL('../pages/LoginPage.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../../vite.config.js', import.meta.url), 'utf8');

function passwordChangeClient(result, status = 200) {
  const storage = new Map([
    ['admin_token', 'old-bearer'],
    ['admin_csrf_token', 'old-csrf'],
    ['admin_user', '{"id":"test-admin"}'],
  ]);
  const calls = [];
  const context = {
    FormData,
    runtimeConfig: { apiBase: 'https://api.example.test' },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (result instanceof Error) throw result;
      return Response.json(result, { status });
    },
  };
  runInNewContext(api.replace(/^import [^\n]+\n/, '')
    .replaceAll('import.meta.env', '{}').replaceAll('export ', ''), context);
  return { context, storage, calls };
}

for (const credentials of [
  { csrfToken: 'rotated-csrf' },
  { csrfToken: 'rotated-csrf', token: 'rotated-bearer' },
  { token: 'rotated-bearer' },
]) {
  test(`admin password change rotates credentials for the next write: ${Object.keys(credentials).join(', ')}`, async () => {
    const result = { success: true, mustChangePassword: false, ...credentials };
    const { context, storage, calls } = passwordChangeClient(result);
    assert.deepEqual(await context.changeAdminPassword('old-password', 'new-password'), result);
    await context.updateAdminLead('test-lead', 'contacted');

    const headers = calls[1].options.headers;
    assert.equal(headers['X-CSRF-Token'], credentials.csrfToken || 'old-csrf');
    assert.equal(headers.Authorization, credentials.csrfToken ? undefined : 'Bearer rotated-bearer');
    assert.equal(storage.get('admin_token'), credentials.csrfToken ? undefined : 'rotated-bearer');
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(storage.get('admin_user'), '{"id":"test-admin"}');
  });
}

for (const status of [400, 401, 503, 'network']) {
  test(`admin failed password change preserves credentials: ${status}`, async () => {
    const result = status === 'network' ? new Error('Network unavailable') : { error: 'Rejected' };
    const { context, storage } = passwordChangeClient(result, status === 'network' ? 200 : status);
    const original = [...storage];
    await assert.rejects(context.changeAdminPassword('wrong-password', 'new-password'));
    assert.deepEqual([...storage], original);
  });
}

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
  assert.match(app, /const currentPage = visibleNavItems\.some\(\(item\) => item\.key === activePage\) \? activePage : visibleNavItems\[0\]\?\.key \|\| 'dashboard'/);
  assert.match(app, /if \(isBusinessStaff\) return item\.key === 'businessWorkspace'/);
  assert.match(app, /if \(runtimeConfig\.market === 'com'\) \{\s*if \(item\.key === 'businessWorkspace'\) return false;\s*if \(isBusinessStaff\) return BUSINESS_RECORD_NAV_KEYS\.has\(item\.key\)/);
  assert.match(app, /BUSINESS_RECORD_NAV_KEYS = new Set\(\['users', 'leads', 'workorders'\]\)/);
  for (const kind of ['customer', 'lead', 'work_order']) {
    assert.ok(app.includes(`key={\x60\x24{user.staffId}:\x24{user.staffRole}:${kind}\x60}`));
    assert.ok(app.includes(`user={user} kind="${kind}"`));
  }
  assert.match(app, /switch \(currentPage\)/);
  assert.match(app, /useEffect\(\(\) => \{[\s\S]*setActivePage\(visibleNavItems\[0\]\?\.key \|\| 'dashboard'\)[\s\S]*\}, \[activePage, user, visibleNavItems\]\)/);
});

test('admin session restore falls back to the legacy JWT during staggered deploys', () => {
  assert.match(api, /error\?\.status === 404/);
  assert.match(api, /localStorage\.getItem\('admin_token'\)[\s\S]*saved/);
  assert.match(api, /legacy:\s*true/);
});

test('admin dev server allows the isolated E2E portal host', () => {
  assert.match(viteConfig, /admin\.127\.0\.0\.1\.nip\.io/);
});
