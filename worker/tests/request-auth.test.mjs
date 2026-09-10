import test from 'node:test';
import './session-fixture.test.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { hashPasswordLegacy, hashPasswordNew, signJwt, signSessionJwt, verifyJwt } from '../src/lib/auth.js';
import {
  authenticateRequest,
  hasValidCsrf,
  requestPortalRole,
} from '../src/lib/requestAuth.js';

const JWT_SECRET = 'request-auth-test-secret-32-characters';

async function passwordFixture(t, role) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const salt = 'fictional-password-test-salt';
  const hash = await hashPasswordNew('Initial-password-123', salt);
  if (role === 'admin') {
    sqlite.prepare(`INSERT INTO admin_staff_accounts
      (id, normalized_login, password_hash, salt, role, display_name, market_scope, must_change_password)
      VALUES ('account', 'account@example.invalid', ?, ?, 'operations', 'Fictional Staff', 'com', 1)`)
      .run(hash, salt);
  } else {
    sqlite.prepare(`INSERT INTO ${role === 'customer' ? 'customers' : 'engineers'}
      (id, user_no, name, phone, email, password_hash, salt, auth_status)
      VALUES ('account', 'FICTIONAL-1', 'Fictional Account', '+12025550123', 'account@example.invalid', ?, ?, 'authenticated')`)
      .run(hash, salt);
  }
  const kv = new Map();
  const env = { JWT_SECRET, ENVIRONMENT: 'production', ADMIN_PHONE: 'fictional-admin', ADMIN_PASSWORD: 'Fictional-bootstrap-123',
    KV: { async get(k) { return kv.get(k) ?? null; }, async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); } },
    DB: { prepare(sql) { let args = []; return {
      bind(...values) { args = values; return this; },
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
    }; }, async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; }
      catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    } },
  };
  const origin = role === 'admin' ? 'https://admin.sagemro.com' : role === 'engineer' ? 'https://engineer.sagemro.com' : 'https://ai.sagemro.com';
  async function api(path, { body, cookie, csrf, token, browser = true } = {}) {
    const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(browser ? { Origin: origin } : {}), 'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }), env, { waitUntil() {} });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function login(password = 'Initial-password-123', browser = true) {
    return api(role === 'admin' ? '/api/admin/login' : '/api/auth/login', {
      browser, body: role === 'admin' ? { phone: 'account@example.invalid', password } : { email: 'account@example.invalid', password },
    });
  }
  return { env, sqlite, kv, api, login };
}

for (const role of ['customer', 'engineer', 'admin']) {
  test(`password change revokes old ${role} cookies and Bearer credentials while renewing the current session`, async (t) => {
    const { api, login } = await passwordFixture(t, role);
    const old = await login();
    assert.equal(old.status, 200, JSON.stringify(old.data));
    const oldToken = old.cookie.slice(old.cookie.indexOf('=') + 1);
    const changed = await api('/api/auth/change-password', { cookie: old.cookie, csrf: old.data.csrfToken,
      body: { oldPassword: 'Initial-password-123', newPassword: 'Replacement-password-456' } });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    assert.equal((await api('/api/auth/session', { cookie: old.cookie })).data.authenticated, false);
    assert.equal((await api('/api/auth/session', { token: oldToken })).data.authenticated, false);
    assert.equal((await api('/api/conversations', { cookie: old.cookie })).status, 401);
    assert.equal((await api('/api/conversations', { token: oldToken })).status, 401);
    assert.ok(changed.cookie);
    assert.ok(changed.data.csrfToken);
    assert.notEqual(changed.data.csrfToken, old.data.csrfToken);
    assert.equal(changed.data.token, undefined);
    const current = await api('/api/auth/session', { cookie: changed.cookie });
    assert.equal(current.data.authenticated, true);
    if (role === 'admin') assert.equal(current.data.user.mustChangePassword, false);
    const again = await api('/api/auth/change-password', { cookie: changed.cookie, csrf: changed.data.csrfToken,
      body: { oldPassword: 'Replacement-password-456', newPassword: 'Another-password-789' } });
    assert.equal(again.status, 200, JSON.stringify(again.data));
  });
}

test('request portal role uses exact Origin and Referer hosts', () => {
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://ai.sagemro.com' },
  })), 'customer');
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://ai.sagemro.cn' },
  })), 'customer');
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://engineer.sagemro.com' },
  })), 'engineer');
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Referer: 'https://admin.sagemro.com/' },
  })), 'admin');
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://admin.attacker.example' },
  })), null);
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://ai.sagemro.com.evil.example' },
  })), null);
});

test('Bearer authentication takes precedence over portal cookies', async (t) => {
  const { env, login } = await passwordFixture(t, 'engineer');
  const { data: { token } } = await login('Initial-password-123', false);
  const auth = await authenticateRequest(new Request('https://api.sagemro.com/api/workorders', {
    headers: {
      Origin: 'https://sagemro.com',
      Authorization: `Bearer ${token}`,
      Cookie: '__Host-sagemro_customer_session=invalid',
    },
  }), env);

  assert.equal(auth.userId, 'account');
  assert.equal(auth.authMethod, 'bearer');
});

test('cookie authentication enforces the portal role and CSRF token', async (t) => {
  const { env, login } = await passwordFixture(t, 'customer');
  const { cookie, data: { csrfToken: csrf } } = await login();
  const auth = await authenticateRequest(new Request('https://api.sagemro.com/api/workorders', {
    method: 'POST',
    headers: {
      Origin: 'https://sagemro.com',
      Cookie: cookie,
      'X-CSRF-Token': csrf,
    },
  }), env);

  assert.equal(auth.userId, 'account');
  assert.equal(auth.authMethod, 'cookie');
  assert.equal(hasValidCsrf(new Request('https://api.sagemro.com/api/workorders', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrf },
  }), auth), true);
});

for (const role of ['customer', 'engineer']) {
  test(`password recovery revokes every old ${role} credential without logging the requester in`, async (t) => {
    const { api, login, kv } = await passwordFixture(t, role);
    const old = await login('Initial-password-123', false);
    kv.set('reset_code_email_account@example.invalid', '654321');
    const reset = await api('/api/auth/reset-password', {
      body: { email: 'account@example.invalid', code: '654321', newPassword: 'Recovered-password-789' },
    });
    assert.equal(reset.status, 200, JSON.stringify(reset.data));
    assert.equal(reset.data.token, undefined);
    assert.equal(reset.cookie, undefined);
    assert.equal((await api('/api/auth/session', { token: old.data.token })).data.authenticated, false);
    assert.equal((await login('Recovered-password-789')).status, 200);
  });
}

test('staff reset revokes old login permanently, including after mandatory password change', async (t) => {
  const { api, login, env } = await passwordFixture(t, 'admin');
  const old = await login();
  const bootstrap = await api('/api/admin/login', { body: { phone: env.ADMIN_PHONE, password: env.ADMIN_PASSWORD } });
  assert.equal(bootstrap.status, 200);
  const reset = await api('/api/admin/staff/account/reset-password', { cookie: bootstrap.cookie, csrf: bootstrap.data.csrfToken, body: {} });
  assert.equal(reset.status, 200, JSON.stringify(reset.data));
  assert.equal((await api('/api/auth/session', { cookie: old.cookie })).data.authenticated, false);
  const temporary = await login(reset.data.temporary_password);
  assert.equal(temporary.status, 200);
  assert.equal(temporary.data.user.mustChangePassword, true);
  const changed = await api('/api/auth/change-password', { cookie: temporary.cookie, csrf: temporary.data.csrfToken,
    body: { oldPassword: reset.data.temporary_password, newPassword: 'Permanent-password-456' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.data));
  assert.equal((await api('/api/auth/session', { cookie: changed.cookie })).data.user.mustChangePassword, false);
  for (const cookie of [old.cookie, temporary.cookie]) {
    assert.equal((await api('/api/auth/session', { cookie })).data.authenticated, false);
  }
});

test('non-browser password change returns a replacement Bearer token', async (t) => {
  const { api, login } = await passwordFixture(t, 'customer');
  const old = await login('Initial-password-123', false);
  const changed = await api('/api/auth/change-password', { browser: false, token: old.data.token,
    body: { oldPassword: 'Initial-password-123', newPassword: 'Replacement-password-456' } });
  assert.equal(changed.status, 200);
  assert.ok(changed.data.token);
  assert.equal((await api('/api/auth/session', { token: changed.data.token, browser: false })).data.authenticated, true);
  assert.equal((await api('/api/auth/session', { token: old.data.token, browser: false })).data.authenticated, false);
});

test('legacy unsigned credential versions cannot be upgraded via session restore', async (t) => {
  const { api } = await passwordFixture(t, 'customer');
  const token = await signJwt({ userId: 'account', userType: 'customer', market: 'com', exp: Math.floor(Date.now() / 1000) + 60 }, JWT_SECRET);
  const restored = await api('/api/auth/session', { token });
  assert.equal(restored.data.authenticated, false);
  assert.equal(restored.cookie, undefined);
});

test('credential binding rejects changed identity, market, expired tokens and removed accounts', async (t) => {
  const { env, login, sqlite } = await passwordFixture(t, 'customer');
  const old = await login('Initial-password-123', false);
  const payload = await verifyJwt(old.data.token, JWT_SECRET);
  const auth = token => authenticateRequest(new Request('https://api.sagemro.com/api/workorders', { headers: { Authorization: `Bearer ${token}` } }), env);
  assert.ok(await auth(old.data.token));
  const stored = sqlite.prepare("SELECT * FROM customers WHERE id='account'").get();
  assert.equal(JSON.stringify(payload).includes(stored.password_hash), false);
  assert.equal(JSON.stringify(payload).includes(stored.salt), false);
  for (const patch of [{ userId: 'other' }, { userType: 'engineer' }, { market: 'cn' }, { cv: 'wrong' }, { cv: null }, { exp: 0 }, { exp: undefined }]) {
    assert.equal(await auth(await signJwt({ ...payload, ...patch }, JWT_SECRET)), null);
  }
  env.SESSION_MARKET = 'cn';
  assert.equal(await auth(old.data.token), null);
  env.SESSION_MARKET = 'com';
  sqlite.prepare("DELETE FROM customers WHERE id='account'").run();
  assert.equal(await auth(old.data.token), null);
});

test('legacy password upgrade signs against the upgraded record, not the old hash', async (t) => {
  const { sqlite, api, login } = await passwordFixture(t, 'customer');
  sqlite.prepare("UPDATE customers SET salt='', password_hash=? WHERE id='account'")
    .run(await hashPasswordLegacy('Initial-password-123'));
  const loggedIn = await login();
  assert.equal(loggedIn.status, 200);
  assert.ok(sqlite.prepare("SELECT salt FROM customers WHERE id='account'").get().salt);
  assert.equal((await api('/api/auth/session', { cookie: loggedIn.cookie })).data.authenticated, true);
});

test('failed password changes preserve the existing session', async (t) => {
  const { api, login } = await passwordFixture(t, 'customer');
  const old = await login();
  const changed = await api('/api/auth/change-password', { cookie: old.cookie, csrf: old.data.csrfToken,
    body: { oldPassword: 'Incorrect-password-123', newPassword: 'Replacement-password-456' } });
  assert.equal(changed.status, 400);
  assert.equal(changed.cookie, undefined);
  assert.equal((await api('/api/auth/session', { cookie: old.cookie })).data.authenticated, true);
});

test('bootstrap credentials rotate independently by market and disabled staff fail authentication', async (t) => {
  const { api, env, login, sqlite } = await passwordFixture(t, 'admin');
  const root = await api('/api/admin/login', { body: { phone: env.ADMIN_PHONE, password: env.ADMIN_PASSWORD } });
  env.ADMIN_PASSWORD_CN = 'Fictional-CN-password';
  env.ADMIN_PHONE_CN = 'fictional-cn';
  assert.equal((await api('/api/auth/session', { cookie: root.cookie })).data.authenticated, true);
  env.ADMIN_PASSWORD = 'Rotated-bootstrap-password';
  assert.equal((await api('/api/auth/session', { cookie: root.cookie })).data.authenticated, false);
  const staff = await login();
  sqlite.prepare("UPDATE admin_staff_accounts SET is_active=0 WHERE id='account'").run();
  assert.equal((await api('/api/auth/session', { cookie: staff.cookie })).data.authenticated, false);
});

test('credential-bound token issuance rejects missing password state', async () => {
  await assert.rejects(signSessionJwt({ userId: 'account', userType: 'customer', market: 'com' }, {}, JWT_SECRET), /credential unavailable/i);
});

test('protected customer requests read their credential once', async (t) => {
  const { api, login, env } = await passwordFixture(t, 'customer');
  const old = await login();
  const prepare = env.DB.prepare;
  let reads = 0;
  env.DB.prepare = sql => {
    if (/SELECT \* FROM customers WHERE id = \?/.test(sql)) reads++;
    return prepare(sql);
  };
  const response = await api('/api/conversations', { cookie: old.cookie });
  assert.equal(response.status, 200);
  assert.equal(reads, 1);
});

test('credential lookup failures fail closed without database error details', async (t) => {
  const { api, login, env } = await passwordFixture(t, 'customer');
  const old = await login();
  env.DB.prepare = () => { throw new Error('Simulated private database details'); };
  const unavailable = await api('/api/conversations', { cookie: old.cookie });
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(JSON.stringify(unavailable.data), /private database|Simulated/);
  assert.match(JSON.stringify(unavailable.data), /temporarily unavailable/i);
});
