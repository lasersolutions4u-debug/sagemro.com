import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('engineer activation route scrubs its fragment and submits a secure password', () => {
  const app = read('frontend/src/App.jsx');
  const activationPage = read('frontend/src/components/Engineer/EngineerActivationPage.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(app, /currentPath === '\/activate'/);
  assert.match(app, /<EngineerActivationPage/);
  assert.match(activationPage, /window\.location\.hash/);
  assert.match(activationPage, /window\.history\.replaceState/);
  assert.match(activationPage, /useLayoutEffect/);
  assert.doesNotMatch(activationPage, /useState\(readActivationToken\)/);
  assert.match(activationPage, /至少 10 位|at least 10 characters/);
  assert.match(activationPage, /显示密码/);
  assert.match(activationPage, /Show password/);
  assert.match(api, /\/api\/auth\/engineer\/activate/);
});

test('successful activation sign-in continues to the engineer workspace', () => {
  const app = read('frontend/src/App.jsx');

  assert.match(app, /handleActivationLoginSuccess/);
  assert.match(app, /onLoginSuccess=\{handleActivationLoginSuccess\}/);
  assert.match(app, /setCurrentPath\('\/'\)/);
});

test('login accepts an engineer email or phone in both locales', () => {
  const login = read('frontend/src/components/Auth/LoginModal.jsx');

  assert.match(login, /accountLabel: '邮箱或手机号'/);
  assert.match(login, /accountLabel: 'Email or phone'/);
  assert.match(login, /credential\.includes\('@'\)/);
});
