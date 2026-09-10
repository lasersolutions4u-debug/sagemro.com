import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const api = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
const login = await readFile(new URL('../src/components/Auth/LoginModal.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

function passwordChangeClient(result, status = 200) {
  const storage = new Map([
    ['sagemro_token', 'old-bearer'],
    ['sagemro_csrf_token', 'old-csrf'],
    ['sagemro_user', '{"id":"test-user"}'],
  ]);
  const calls = [];
  const context = {
    Headers, URL, setTimeout,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    location: { origin: 'https://customer.example.test', hostname: 'customer.example.test' },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/api/auth/session')) return Response.json({ authenticated: true });
      if (result instanceof Error) throw result;
      return Response.json(result, { status });
    },
  };
  context.window = context;
  runInNewContext(api.replace(/^import [\s\S]*?from '\.\/funnelAnalytics';/, '')
    .replaceAll('import.meta.env', '{}').replaceAll('export ', ''), context);
  return { context, storage, calls };
}

for (const credentials of [
  { csrfToken: 'rotated-csrf' },
  { csrfToken: 'rotated-csrf', token: 'rotated-bearer' },
  { token: 'rotated-bearer' },
]) {
  test(`frontend password change rotates credentials for the next write: ${Object.keys(credentials).join(', ')}`, async () => {
    const result = { success: true, ...credentials };
    const { context, storage, calls } = passwordChangeClient(result);
    assert.deepEqual(await context.changePassword({ oldPassword: 'old-password', newPassword: 'new-password' }), result);
    await context.renameConversation('test-conversation', 'Updated');

    const headers = calls[1].options.headers;
    assert.equal(headers.get('X-CSRF-Token'), credentials.csrfToken || 'old-csrf');
    assert.equal(headers.get('Authorization'), credentials.csrfToken ? null : 'Bearer rotated-bearer');
    assert.equal(storage.get('sagemro_token'), credentials.csrfToken ? undefined : 'rotated-bearer');
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(storage.get('sagemro_user'), '{"id":"test-user"}');
  });
}

for (const status of [400, 401, 503, 'network']) {
  test(`frontend failed password change preserves credentials: ${status}`, async () => {
    const result = status === 'network' ? new Error('Network unavailable') : { error: 'Rejected' };
    const { context, storage } = passwordChangeClient(result, status === 'network' ? 200 : status);
    const original = [...storage];
    await assert.rejects(context.changePassword({ oldPassword: 'wrong-password', newPassword: 'new-password' }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([...storage], original);
  });
}

test('frontend API requests include cookies and non-empty CSRF for unsafe methods', () => {
  assert.match(api, /credentials:\s*'include'/);
  assert.match(api, /X-CSRF-Token/);
  assert.match(api, /sagemro_csrf_token/);
  assert.match(api, /csrfToken[\s\S]*!\['GET', 'HEAD', 'OPTIONS'\]\.includes\(method\)/);
  assert.doesNotMatch(api, /X-CSRF-Token', localStorage\.getItem\('sagemro_csrf_token'\) \|\| ''/);
});

test('frontend exposes session restore and logout APIs', () => {
  assert.match(api, /export async function restoreSession/);
  assert.match(api, /\/api\/auth\/session/);
  assert.match(api, /export async function logout/);
  assert.match(api, /\/api\/auth\/logout/);
});

test('frontend login keeps legacy JWT fallback without blindly persisting a missing token', () => {
  assert.doesNotMatch(login, /localStorage\.setItem\('sagemro_token'/);
  assert.match(login, /sagemro_csrf_token/);
  assert.match(api, /if \(data\.token\) localStorage\.setItem\('sagemro_token', data\.token\)/);
  assert.match(api, /if \(data\.csrfToken\)[\s\S]*localStorage\.removeItem\('sagemro_token'\)/);
});

test('frontend application restores and clears the server session', () => {
  assert.match(app, /restoreSession/);
  assert.match(app, /logoutSession/);
  assert.doesNotMatch(app, /localStorage\.getItem\('sagemro_user'\)/);
  assert.doesNotMatch(app, /localStorage\.getItem\('sagemro_user_type'\)/);
  assert.match(app, /setAuthReady\(true\)/);
  assert.match(app, /isEngineerHost[^\n]*&&[^\n]*!authReady/);
  assert.match(app, /if \(authVersionRef\.current !== restoreVersion\) return;[\s\S]*localStorage\.setItem\('sagemro_csrf_token'/);
  assert.match(app, /if \(authVersionRef\.current !== restoreVersion\) return;[\s\S]*localStorage\.removeItem\('sagemro_csrf_token'/);
});

test('a delayed startup session restore cannot overwrite a newer login', () => {
  const restoreSessionSource = api.slice(
    api.indexOf('export async function restoreSession'),
    api.indexOf('export async function logout'),
  );
  const handleLogoutSource = app.slice(
    app.indexOf('const handleLogout = useCallback'),
    app.indexOf('// 监听 401 自动登出事件'),
  );

  assert.match(app, /const authVersionRef = useRef\(0\)/);
  assert.match(app, /const restoreVersion = authVersionRef\.current/);
  assert.match(app, /if \(authVersionRef\.current !== restoreVersion\) return/);
  assert.match(app, /const handleLoginSuccess = useCallback[\s\S]*authVersionRef\.current \+= 1/);
  assert.match(app, /const handleLogout = useCallback[\s\S]*authVersionRef\.current \+= 1/);
  assert.match(api, /let __sessionRestoreOperation = null/);
  assert.match(api, /async function waitForAuthTransitions/);
  assert.match(api, /export async function login[\s\S]*await waitForAuthTransitions\(\)/);
  assert.match(restoreSessionSource, /__sessionRestoreOperation/);
  assert.doesNotMatch(restoreSessionSource, /localStorage\.removeItem/);
  assert.match(handleLogoutSource, /localStorage\.removeItem\('sagemro_csrf_token'\)/);
});

test('frontend session restore falls back to the legacy JWT during staggered deploys', () => {
  assert.match(api, /response\.status === 404/);
  assert.match(api, /localStorage\.getItem\('sagemro_token'\)[\s\S]*storedUser[\s\S]*storedType/);
  assert.match(api, /legacy:\s*true/);
});

test('authenticated funnel events avoid sendBeacon so the CSRF header can be attached', () => {
  assert.match(api, /const csrfToken = getAnalyticsStorageValue\(storage, 'sagemro_csrf_token'\)/);
  assert.match(api, /if \(storageAvailable && !csrfToken && navigator\.sendBeacon\)/);
});

test('frontend dev server allows the isolated E2E portal hosts', () => {
  assert.match(viteConfig, /customer\.127\.0\.0\.1\.nip\.io/);
  assert.match(viteConfig, /engineer\.127\.0\.0\.1\.nip\.io/);
});
