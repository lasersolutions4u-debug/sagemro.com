import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('CN frontend keeps legacy Bearer fallback while adopting Cookie sessions', async () => {
  const api = await read('src/services/api.js');
  const app = await read('src/App.jsx');

  assert.match(api, /credentials:\s*['"]include['"]/);
  assert.match(api, /sagemro_csrf_token/);
  assert.match(api, /X-CSRF-Token/);
  assert.match(api, /legacyToken[\s\S]*Authorization|Authorization[\s\S]*legacyToken/);
  assert.match(api, /export async function restoreSession/);
  assert.match(api, /export async function logout/);
  assert.match(app, /restoreSession/);
  assert.match(app, /authReady/);
});

test('CN frontend does not persist a missing JWT from a Cookie login', async () => {
  const api = await read('src/services/api.js');
  const modal = await read('src/components/Auth/LoginModal.jsx');

  assert.match(api, /if \(data\.csrfToken\)[\s\S]*removeItem\(['"]sagemro_token/);
  assert.match(modal, /if \(result\.csrfToken\)[\s\S]*sagemro_csrf_token/);
  assert.doesNotMatch(modal, /localStorage\.setItem\(['"]sagemro_token['"], result\.token\)/);
});

test('a delayed startup session restore cannot overwrite a newer portal login', async () => {
  const api = await read('src/services/api.js');
  const app = await read('src/App.jsx');
  const restoreSessionSource = api.slice(
    api.indexOf('export async function restoreSession'),
    api.indexOf('export async function logout'),
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
  assert.doesNotMatch(restoreSessionSource, /localStorage\.removeItem|clearStoredSession\(\)/);
});
