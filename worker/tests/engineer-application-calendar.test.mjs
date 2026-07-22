import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function createStatement(result = {}, onBind = () => {}) {
  return {
    bind(...args) {
      onBind(args);
      return this;
    },
    async first() { return result.first ?? null; },
    async all() { return result.all ?? { results: [] }; },
    async run() { return result.run ?? { success: true }; },
  };
}

function createEnv({ engineer = false } = {}) {
  const calls = [];
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    DB: {
      prepare(sql) {
        calls.push(sql);
        if (sql.includes('FROM engineers WHERE id = ?') && engineer) {
          return createStatement({ first: { id: 'eng_1', engineer_role: 'engineer' } });
        }
        return createStatement({}, (args) => env.__bindings.push({ sql, args }));
      },
    },
    KV: {
      async get() { return null; },
      async put() {},
    },
    __calls: calls,
    __bindings: [],
  };
  return env;
}

async function adminToken(env) {
  return signJwt({
    userId: 'admin',
    userType: 'admin',
    market: 'com',
    phone: 'admin',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function engineerToken(env) {
  return signJwt({
    userId: 'eng_1',
    userType: 'engineer',
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

test('public engineer application submits without creating an engineer account', async () => {
  const env = createEnv();
  const request = new Request('https://api.sagemro.com/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.com' },
    body: JSON.stringify({
      name: 'Alex Service',
      phone: '+1 555 0100',
      email: 'alex@example.com',
      country: 'US',
      city: 'Chicago',
      service_regions: ['Illinois'],
      skill_tags: ['Laser cutting machine repair'],
      experience_summary: '8 years of field service.',
    }),
  });

  const response = await worker.fetch(request, env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_applications')), true);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineers')), false);
});

test('public engineer application requires a valid email', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.sagemro.cn/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.cn' },
    body: JSON.stringify({ name: '测试工程师', phone: '13800000000', email: 'invalid' }),
  }), env, { waitUntil() {} });

  assert.equal(response.status, 400);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_applications')), false);
});

test('public engineer application requires an email', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.sagemro.cn/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.cn' },
    body: JSON.stringify({ name: '测试工程师', phone: '13800000000' }),
  }), env, { waitUntil() {} });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, '姓名、联系电话和邮箱为必填项');
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_applications')), false);
});

test('public engineer application requires a phone number', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.sagemro.cn/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.cn' },
    body: JSON.stringify({ name: '测试工程师', email: 'engineer@example.com' }),
  }), env, { waitUntil() {} });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, '姓名、联系电话和邮箱为必填项');
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_applications')), false);
});

test('public engineer application returns English validation copy for invalid email', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.com' },
    body: JSON.stringify({ name: 'Alex Service', phone: '+1 555 0100', email: 'invalid' }),
  }), env, { waitUntil() {} });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Please enter a valid email address.');
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_applications')), false);
});

test('public engineer application binds a trimmed, lowercased email', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/engineer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.com' },
    body: JSON.stringify({
      name: 'Alex Service',
      phone: '+1 555 0100',
      email: '  Alex.Service@Example.COM  ',
    }),
  }), env, { waitUntil() {} });

  assert.equal(response.status, 200);
  const applicationInsert = env.__bindings.find(({ sql }) => sql.includes('INSERT INTO engineer_applications'));
  assert.ok(applicationInsert);
  assert.equal(applicationInsert.args[4], 'alex.service@example.com');
});

test('admin can list engineer applications', async () => {
  const env = createEnv();
  env.DB.prepare = (sql) => {
    env.__calls.push(sql);
    if (sql.includes('COUNT(*)')) return createStatement({ first: { count: 1 } });
    if (sql.includes('FROM engineer_applications')) {
      return createStatement({ all: { results: [{ id: 'app_1', name: 'Alex Service', status: 'submitted' }] } });
    }
    return createStatement();
  };
  const token = await adminToken(env);
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/admin/engineer-applications', {
    headers: { Authorization: `Bearer ${token}` },
  }), env, { waitUntil() {} });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 1);
  assert.equal(body.list[0].id, 'app_1');
});

test('engineer calendar events are scoped to authenticated engineer', async () => {
  const env = createEnv({ engineer: true });
  const token = await engineerToken(env);
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/engineers/calendar-events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'engineer_available',
      title: 'Available for field service',
      start_at: '2026-07-01T09:00:00Z',
      end_at: '2026-07-01T17:00:00Z',
      timezone: 'Asia/Shanghai',
    }),
  }), env, { waitUntil() {} });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(env.__calls.some((sql) => sql.includes('INSERT INTO engineer_calendar_events')), true);
});
