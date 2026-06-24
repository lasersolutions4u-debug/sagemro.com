import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

const ENGINEER_REJECT_JWT_SECRET = 'service-os-auth-test-secret-32-chars';

function createTestEnv(overrides = {}) {
  const kv = new Map();
  const dbState = {
    customers: [],
    engineers: [],
  };
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
    DB: {
      prepare(sql) {
        return {
          args: [],
          bind(...args) {
            this.args = args;
            return this;
          },
          async first() {
            if (/SELECT user_no FROM customers/i.test(sql)) {
              const last = dbState.customers.at(-1);
              return last ? { user_no: last.user_no } : null;
            }
            if (/SELECT user_no FROM engineers/i.test(sql)) {
              const last = dbState.engineers.at(-1);
              return last ? { user_no: last.user_no } : null;
            }
            if (/FROM customers WHERE phone = \?/i.test(sql)) {
              const row = dbState.customers.find((customer) => customer.phone === this.args[0]);
              return row ? { id: row.id } : null;
            }
            if (/FROM engineers WHERE phone = \?/i.test(sql)) {
              const row = dbState.engineers.find((engineer) => engineer.phone === this.args[0]);
              return row ? { id: row.id } : null;
            }
            return null;
          },
          async run() {
            if (/INSERT INTO customers/i.test(sql)) {
              const [id, user_no, name, phone, password_hash, salt, company, auth_status] = this.args;
              dbState.customers.push({ id, user_no, name, phone, password_hash, salt, company, auth_status });
            }
            return { success: true };
          },
        };
      },
    },
    __kv: kv,
    __dbState: dbState,
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

test('registration verification code can be sent to an email address', async () => {
  const env = createTestEnv({ ENVIRONMENT: 'development' });

  const { response, json } = await postJson('https://api.sagemro.cn/api/auth/send-code', {
    email: 'joe@example.com',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.match(json.message, /验证码已发送/);
  assert.match(json.code, /^\d{4}$/);
  assert.equal(env.__kv.get('verify_code_email_joe@example.com'), json.code);
  assert.equal(env.__kv.get('verify_code_rate_email_joe@example.com'), '1');
});

test('customer registration accepts an email verification code while keeping phone as login contact', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_email_joe@example.com', '1357');

  const { response, json } = await postJson('https://api.sagemro.cn/api/auth/register/customer', {
    name: 'Joe',
    phone: '13800000001',
    email: 'joe@example.com',
    password: 'secret123',
    code: '1357',
    company: '济南钰峭机械有限公司',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.customer.phone, '13800000001');
  assert.equal(env.__dbState.customers[0].auth_status, 'authenticated');
  assert.equal(await env.KV.get('verify_code_email_joe@example.com'), null);
});

function makeEngineerRejectEnv() {
  const workOrder = {
    status: 'assigned',
    engineer_id: 'eng-1',
    assigned_regional_lead_id: 'lead-1',
    rejected_engineers: null,
  };
  const logs = [];
  const internalMessages = [];

  const db = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (/SELECT status, engineer_id, assigned_regional_lead_id, rejected_engineers FROM work_orders/.test(sql)) {
            return workOrder;
          }
          if (/SELECT customer_id, order_no FROM work_orders/.test(sql)) {
            return { customer_id: 'cust-1', order_no: 'WO-TEST-001' };
          }
          if (/SELECT onesignal_player_id FROM customers/.test(sql)) {
            return { onesignal_player_id: null };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO work_order_logs/.test(sql)) {
            logs.push({
              work_order_id: this.args[1],
              action: this.args[2],
              actor_type: this.args[3],
              actor_id: this.args[4],
              content: this.args[5],
            });
          }
          if (/INSERT INTO work_order_messages/.test(sql)) {
            internalMessages.push({
              work_order_id: this.args[1],
              sender_id: this.args[2],
              content: this.args[3],
            });
          }
          return { success: true };
        },
      };
    },
  };

  return { env: { DB: db, JWT_SECRET: ENGINEER_REJECT_JWT_SECRET }, logs, internalMessages };
}

async function engineerRejectRequest(body) {
  const token = await signJwt({
    userId: 'eng-1',
    userType: 'engineer',
    exp: Math.floor(Date.now() / 1000) + 60,
  }, ENGINEER_REJECT_JWT_SECRET);

  return new Request('https://api.sagemro.com/api/engineers/tickets/reject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: 'https://engineer.sagemro.com',
    },
    body: JSON.stringify(body),
  });
}

test('engineer reject dispatch requires a reason', async () => {
  const { env } = makeEngineerRejectEnv();
  const response = await worker.fetch(
    await engineerRejectRequest({ work_order_id: 'wo-1' }),
    env,
    { waitUntil() {} },
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.ok(body.error);
});

test('engineer reject dispatch records the submitted reason as an internal note', async () => {
  const { env, logs, internalMessages } = makeEngineerRejectEnv();
  const reason = 'Customer changed the schedule and the site visit cannot be confirmed.';
  const response = await worker.fetch(
    await engineerRejectRequest({
      work_order_id: 'wo-1',
      reason,
    }),
    env,
    { waitUntil() {} },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, 'rejected');
  assert.equal(internalMessages.length, 1);
  assert.match(internalMessages[0].content, new RegExp(reason));
});
