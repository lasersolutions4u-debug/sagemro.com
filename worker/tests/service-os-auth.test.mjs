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

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/send-code', {
    email: 'joe@example.com',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.match(json.message, /验证码已发送/);
  assert.match(json.code, /^\d{4}$/);
  assert.equal(env.__kv.get('verify_code_email_joe@example.com'), json.code);
  assert.equal(env.__kv.get('verify_code_rate_email_joe@example.com'), '1');
});

test('COM production registration verification code uses Cloudflare Email binding', async () => {
  const sentEmails = [];
  const env = createTestEnv({
    ENVIRONMENT: 'production',
    VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@mail.sagemro.com>',
    EMAIL: {
      async send(message) {
        sentEmails.push(message);
      },
    },
  });

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/send-code', {
    email: 'joe@example.com',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.code, undefined);
  assert.equal(sentEmails.length, 1);
  assert.deepEqual(sentEmails[0], {
    from: 'SAGEMRO <verify@mail.sagemro.com>',
    to: 'joe@example.com',
    subject: 'SAGEMRO verification code',
    text: env.__kv.get('verify_code_email_joe@example.com')
      ? `Your SAGEMRO verification code is ${env.__kv.get('verify_code_email_joe@example.com')}. It is valid for 5 minutes. Do not share it with others.`
      : '',
  });
});

test('COM production registration verification code falls back to Resend when Email binding is absent', async () => {
  const env = createTestEnv({
    ENVIRONMENT: 'production',
    RESEND_API_KEY: 'test-resend-key',
    VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@example.com>',
  });
  const originalFetch = globalThis.fetch;
  let capturedRequest = null;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return new Response(JSON.stringify({ id: 'email-test-id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { response, json } = await postJson('https://api.sagemro.com/api/auth/send-code', {
      email: 'joe@example.com',
    }, env);

    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(capturedRequest.url, 'https://api.resend.com/emails');
    assert.equal(capturedRequest.init.method, 'POST');
    const body = JSON.parse(capturedRequest.init.body);
    assert.equal(body.from, 'SAGEMRO <verify@example.com>');
    assert.deepEqual(body.to, ['joe@example.com']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CN registration verification code is sent through Aliyun SMS for a phone number', async () => {
  const env = createTestEnv({
    ENVIRONMENT: 'production',
    ALIYUN_SMS_ACCESS_KEY_ID: 'test-access-key-id',
    ALIYUN_SMS_ACCESS_KEY_SECRET: 'test-access-key-secret',
    ALIYUN_SMS_SIGN_NAME_CN: '济南钰峭机械',
    ALIYUN_SMS_TEMPLATE_CODE_REGISTER_CN: 'SMS_508990106',
  });
  const originalFetch = globalThis.fetch;
  let capturedRequest = null;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return new Response(JSON.stringify({ Code: 'OK', Message: 'OK' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { response, json } = await postJson('https://api.sagemro.cn/api/auth/send-code', {
      phone: '13800000001',
    }, env);

    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.code, undefined);
    const smsUrl = new URL(capturedRequest.url);
    assert.equal(smsUrl.origin, 'https://dysmsapi.aliyuncs.com');
    assert.equal(smsUrl.pathname, '/');
    assert.equal(capturedRequest.init.method, 'POST');
    assert.match(capturedRequest.init.headers.Authorization, /^ACS3-HMAC-SHA256 /);
    assert.equal(capturedRequest.init.headers['x-acs-action'], 'SendSms');
    assert.equal(capturedRequest.init.headers['x-acs-version'], '2017-05-25');
    assert.equal(capturedRequest.init.headers['x-acs-content-sha256'], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(capturedRequest.init.body, undefined);

    const params = smsUrl.searchParams;
    assert.equal(params.get('PhoneNumbers'), '13800000001');
    assert.equal(params.get('SignName'), '济南钰峭机械');
    assert.equal(params.get('TemplateCode'), 'SMS_508990106');
    const templateParam = JSON.parse(params.get('TemplateParam'));
    assert.match(templateParam.code, /^\d{4}$/);
    assert.equal(env.__kv.get('verify_code_13800000001'), templateParam.code);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CN phone verification reports a clear service error when Aliyun SMS is not configured', async () => {
  const env = createTestEnv({ ENVIRONMENT: 'production' });

  const { response, json } = await postJson('https://api.sagemro.cn/api/auth/send-code', {
    phone: '13800000002',
  }, env);

  assert.equal(response.status, 503);
  assert.equal(json.error, '短信验证码服务尚未配置，请稍后再试');
  assert.equal(env.__kv.get('verify_code_13800000002'), undefined);
});

test('CN phone verification logs sanitized Aliyun SMS failure details', async () => {
  const env = createTestEnv({
    ENVIRONMENT: 'production',
    ALIYUN_SMS_ACCESS_KEY_ID: 'test-access-key-id',
    ALIYUN_SMS_ACCESS_KEY_SECRET: 'test-access-key-secret',
    ALIYUN_SMS_SIGN_NAME_CN: '济南钰峭机械',
    ALIYUN_SMS_TEMPLATE_CODE_REGISTER_CN: 'SMS_508990106',
  });
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings = [];
  globalThis.fetch = async () => new Response(JSON.stringify({
    Code: 'isv.SMS_SIGNATURE_ILLEGAL',
    Message: 'signature is invalid',
    RequestId: 'req-test-1',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  console.warn = (...args) => {
    warnings.push(args);
  };

  try {
    const { response, json } = await postJson('https://api.sagemro.cn/api/auth/send-code', {
      phone: '13800000003',
    }, env);

    assert.equal(response.status, 503);
    assert.equal(json.error, '短信验证码发送失败，请稍后再试');
    assert.equal(env.__kv.get('verify_code_13800000003'), undefined);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][0], '[aliyun-sms] send failed');
    assert.equal(warnings[0][1].code, 'isv.SMS_SIGNATURE_ILLEGAL');
    assert.equal(warnings[0][1].message, 'signature is invalid');
    assert.equal(warnings[0][1].requestId, 'req-test-1');
    assert.equal(warnings[0][1].phoneSuffix, '0003');
    assert.equal(JSON.stringify(warnings), JSON.stringify(warnings).replace('13800000003', ''));
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test('production CN verification ignores DEV_BYPASS_CODE and sends the random SMS code', async () => {
  const env = createTestEnv({
    ENVIRONMENT: 'production',
    DEV_BYPASS_CODE: '2468',
    ALIYUN_SMS_ACCESS_KEY_ID: 'test-access-key-id',
    ALIYUN_SMS_ACCESS_KEY_SECRET: 'test-access-key-secret',
    ALIYUN_SMS_SIGN_NAME_CN: '济南钰峭机械',
    ALIYUN_SMS_TEMPLATE_CODE_REGISTER_CN: 'SMS_508990106',
  });
  const originalFetch = globalThis.fetch;
  let templateParam = null;
  globalThis.fetch = async (url) => {
    templateParam = JSON.parse(new URL(url).searchParams.get('TemplateParam'));
    return new Response(JSON.stringify({ Code: 'OK', Message: 'OK' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const { response, json } = await postJson('https://api.sagemro.cn/api/auth/send-code', {
      phone: '13800000004',
    }, env);

    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.code, undefined);
    assert.match(templateParam.code, /^\d{4}$/);
    assert.notEqual(templateParam.code, '2468');
    assert.equal(env.__kv.get('verify_code_13800000004'), templateParam.code);
    assert.equal(env.__kv.get('verify_code_13800000004_bypass'), undefined);

    const invalidRegister = await postJson('https://api.sagemro.cn/api/auth/register/customer', {
      name: 'Test Customer',
      phone: '13800000004',
      password: 'secret123',
      company: 'Test Co',
      code: '2468',
    }, env);
    assert.equal(invalidRegister.response.status, 400);
    assert.match(invalidRegister.json.error, /验证码错误|Verification code/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('COM customer registration accepts an email verification code while keeping phone as login contact', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_email_joe@example.com', '1357');

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
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

test('CN customer registration accepts a phone verification code without requiring email', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_13800000003', '2468');

  const { response, json } = await postJson('https://api.sagemro.cn/api/auth/register/customer', {
    name: 'Joe',
    phone: '13800000003',
    password: 'secret123',
    code: '2468',
    company: '济南钰峭机械有限公司',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.customer.phone, '13800000003');
  assert.equal(env.__dbState.customers[0].auth_status, 'authenticated');
  assert.equal(await env.KV.get('verify_code_13800000003'), null);
});

test('CN customer registration still verifies the phone code when optional email is provided', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_13800000004', '8642');

  const { response, json } = await postJson('https://api.sagemro.cn/api/auth/register/customer', {
    name: 'Joe',
    phone: '13800000004',
    email: 'joe@example.com',
    password: 'secret123',
    code: '8642',
    company: '济南钰峭机械有限公司',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.customer.phone, '13800000004');
  assert.equal(await env.KV.get('verify_code_13800000004'), null);
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
