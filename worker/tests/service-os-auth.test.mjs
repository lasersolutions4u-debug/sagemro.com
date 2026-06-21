import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

function createTestEnv(overrides = {}) {
  const kv = new Map();
  return {
    JWT_SECRET: 'test-secret-with-enough-length',
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'global-pass',
    ADMIN_PHONE_CN: '13900000000',
    ADMIN_PASSWORD_CN: 'cn-pass',
    KV: {
      async get(key) {
        return kv.get(key) || null;
      },
      async put(key, value) {
        kv.set(key, value);
      },
      async delete(key) {
        kv.delete(key);
      },
    },
    ...overrides,
  };
}

async function adminLogin(url, body, env = createTestEnv()) {
  const response = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(url).origin,
    },
    body: JSON.stringify(body),
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('public engineer registration is closed for Service OS positioning', async () => {
  const request = new Request('https://api.sagemro.com/api/auth/register/engineer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
    },
    body: JSON.stringify({
      name: 'Test Engineer',
      phone: '13800000000',
      password: 'secret123',
      code: '888888',
      company: 'Test Co',
    }),
  });

  const response = await worker.fetch(request, {}, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 410);
  assert.match(body.error, /Public engineer registration is closed/);
});

test('CN public engineer registration closure is localized', async () => {
  const request = new Request('https://api.sagemro.cn/api/auth/register/engineer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.cn',
    },
    body: JSON.stringify({
      name: '测试工程师',
      phone: '13800000000',
      password: 'secret123',
      code: '888888',
      company: '测试公司',
    }),
  });

  const response = await worker.fetch(request, {}, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 410);
  assert.equal(body.error, '工程师账号由 SAGEMRO 内部创建，公开注册已关闭。');
});

test('COM admin login uses the international admin secret', async () => {
  const { response, json } = await adminLogin('https://api.sagemro.com/api/admin/login', {
    phone: '13800000000',
    password: 'global-pass',
  });

  assert.equal(response.status, 200);
  assert.equal(json.user.phone, '13800000000');
  assert.equal(json.user.market, 'com');
  assert.ok(json.token);
});

test('CN admin login uses the China admin secret', async () => {
  const { response, json } = await adminLogin('https://api.sagemro.cn/api/admin/login', {
    phone: '13900000000',
    password: 'cn-pass',
  });

  assert.equal(response.status, 200);
  assert.equal(json.user.phone, '13900000000');
  assert.equal(json.user.market, 'cn');
  assert.ok(json.token);
});

test('CN admin login rejects the international admin secret when CN secret exists', async () => {
  const { response, json } = await adminLogin('https://api.sagemro.cn/api/admin/login', {
    phone: '13800000000',
    password: 'global-pass',
  });

  assert.equal(response.status, 401);
  assert.match(json.error, /手机号或密码错误/);
});

async function postJson(url, body, env = createTestEnv()) {
  const response = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: new URL(url).origin.replace('api.', ''),
    },
    body: JSON.stringify(body),
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('COM auth validation errors are returned in English', async () => {
  const login = await postJson('https://api.sagemro.com/api/auth/login', {});
  assert.equal(login.response.status, 400);
  assert.equal(login.json.error, 'Phone number and password are required.');

  const sendCode = await postJson('https://api.sagemro.com/api/auth/send-code', {
    phone: 'not-a-phone',
  });
  assert.equal(sendCode.response.status, 400);
  assert.equal(sendCode.json.error, 'Please enter a valid phone number.');
});

test('COM protected route auth errors are returned in English', async () => {
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/workorders', {
    method: 'GET',
    headers: { Origin: 'https://sagemro.com' },
  }), createTestEnv(), { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 401);
  assert.equal(json.error, 'Please sign in first.');
});

test('CN auth validation errors stay in Simplified Chinese', async () => {
  const login = await postJson('https://api.sagemro.cn/api/auth/login', {});
  assert.equal(login.response.status, 400);
  assert.equal(login.json.error, '手机号、密码不能为空');

  const sendCode = await postJson('https://api.sagemro.cn/api/auth/send-code', {
    phone: 'not-a-phone',
  });
  assert.equal(sendCode.response.status, 400);
  assert.equal(sendCode.json.error, '手机号格式不正确');
});
