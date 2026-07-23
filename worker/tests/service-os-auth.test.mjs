import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hashPasswordNew, signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

const ENGINEER_REJECT_JWT_SECRET = 'service-os-auth-test-secret-32-chars';

function normalizePhoneWithSql(value, sql) {
  let normalized = String(value || '').trim().replace(/[ ().-]/g, '');
  if (/char\(9\)/i.test(sql)) normalized = normalized.replace(/\t/g, '');
  if (/char\(10\)/i.test(sql)) normalized = normalized.replace(/\n/g, '');
  if (/char\(13\)/i.test(sql)) normalized = normalized.replace(/\r/g, '');
  return normalized;
}

function createTestEnv(overrides = {}) {
  const kv = new Map();
  const dbState = {
    customers: [],
    engineers: [],
    identities: [],
    engineerApplications: [],
    engineerActivations: [],
    workOrders: [],
    materialRequisitions: [],
    batches: [],
    batchError: null,
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
          sql,
          args: [],
          bind(...args) {
            this.args = args;
            return this;
          },
          async first() {
            if (/FROM material_requisitions mr\s+JOIN work_orders wo/i.test(sql)) {
              const [customerId, engineerId] = this.args;
              const workOrderIds = new Set(dbState.workOrders
                .filter((order) => order.customer_id === customerId || order.engineer_id === engineerId)
                .map((order) => order.id));
              return dbState.materialRequisitions.find((row) => workOrderIds.has(row.work_order_id)) || null;
            }
            if (/FROM account_identities/i.test(sql)) {
              const [email, phone] = this.args;
              return dbState.identities.find((identity) => (
                (identity.identity_type === 'email' && identity.normalized_value === email)
                || (identity.identity_type === 'phone' && identity.normalized_value === phone)
              )) || null;
            }
            if (/SELECT id FROM customers WHERE id = \?/i.test(sql)) {
              const row = dbState.customers.find((customer) => customer.id === this.args[0]);
              return row ? { id: row.id } : null;
            }
            if (/SELECT \* FROM customers WHERE id = \?/i.test(sql)) {
              return dbState.customers.find((customer) => customer.id === this.args[0]) || null;
            }
            if (/SELECT id FROM engineers WHERE id = \?/i.test(sql)) {
              const row = dbState.engineers.find((engineer) => engineer.id === this.args[0]);
              return row ? { id: row.id } : null;
            }
            if (/SELECT \* FROM engineers WHERE id = \?/i.test(sql)) {
              return dbState.engineers.find((engineer) => engineer.id === this.args[0]) || null;
            }
            if (/SELECT \* FROM customers\s+WHERE replace\(/i.test(sql)) {
              const row = dbState.customers.find((customer) => (
                normalizePhoneWithSql(customer.phone, sql) === this.args[0]
              ));
              return row || null;
            }
            if (/SELECT \* FROM customers WHERE lower\(email\) = \?/i.test(sql)) {
              const row = dbState.customers.find((customer) => customer.email?.toLowerCase() === this.args[0]);
              return row || null;
            }
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
            if (/FROM customers\s+WHERE replace\(/i.test(sql)) {
              const row = dbState.customers.find((customer) => (
                normalizePhoneWithSql(customer.phone, sql) === this.args[0]
              ));
              return row ? { id: row.id } : null;
            }
            if (/FROM customers WHERE lower\(email\) = \?/i.test(sql)) {
              const row = dbState.customers.find((customer) => customer.email?.toLowerCase() === this.args[0]);
              return row ? { id: row.id } : null;
            }
            if (/SELECT \* FROM engineers WHERE lower\(email\) = \?/i.test(sql)) {
              const row = dbState.engineers.find((engineer) => engineer.email?.toLowerCase() === this.args[0]);
              return row || null;
            }
            if (/SELECT \* FROM engineers\s+WHERE replace\(/i.test(sql)) {
              const row = dbState.engineers.find((engineer) => (
                normalizePhoneWithSql(engineer.phone, sql) === this.args[0]
              ));
              return row || null;
            }
            if (/FROM engineers WHERE phone = \?/i.test(sql)) {
              const row = dbState.engineers.find((engineer) => engineer.phone === this.args[0]);
              return row ? { id: row.id } : null;
            }
            if (/FROM engineers\s+WHERE replace\(/i.test(sql)) {
              const row = dbState.engineers.find((engineer) => (
                normalizePhoneWithSql(engineer.phone, sql) === this.args[0]
              ));
              return row ? { id: row.id } : null;
            }
            return null;
          },
          async all() {
            if (/SELECT id FROM work_orders WHERE customer_id = \?/i.test(sql)) {
              return { results: dbState.workOrders.filter((order) => order.customer_id === this.args[0]).map(({ id }) => ({ id })) };
            }
            if (/SELECT id FROM work_orders WHERE engineer_id = \?/i.test(sql)) {
              return { results: dbState.workOrders.filter((order) => order.engineer_id === this.args[0]).map(({ id }) => ({ id })) };
            }
            return { results: [] };
          },
          async run() {
            if (/INSERT INTO customers/i.test(sql)) {
              if (/\bemail\b/i.test(sql)) {
                const [id, user_no, name, phone, email, password_hash, salt, company, auth_status] = this.args;
                dbState.customers.push({ id, user_no, name, phone, email, password_hash, salt, company, auth_status });
              } else {
                const [id, user_no, name, phone, password_hash, salt, company, auth_status] = this.args;
                dbState.customers.push({ id, user_no, name, phone, password_hash, salt, company, auth_status });
              }
            }
            if (/INSERT INTO account_identities/i.test(sql)) {
              const [identity_type, normalized_value, owner_type, owner_id] = this.args;
              dbState.identities.push({ identity_type, normalized_value, owner_type, owner_id });
            }
            if (/UPDATE engineer_applications SET converted_user_id = NULL/i.test(sql)) {
              for (const application of dbState.engineerApplications) {
                if (application.converted_user_id === this.args[0]) application.converted_user_id = null;
              }
            }
            if (/DELETE FROM engineer_account_activations/i.test(sql)) {
              dbState.engineerActivations = dbState.engineerActivations.filter((row) => row.engineer_id !== this.args[0]);
            }
            if (/DELETE FROM account_identities/i.test(sql)) {
              const [ownerType, ownerId] = this.args;
              dbState.identities = dbState.identities.filter((row) => (
                row.owner_type !== ownerType || row.owner_id !== ownerId
              ));
            }
            if (/DELETE FROM customers WHERE id = \?/i.test(sql)) {
              dbState.customers = dbState.customers.filter((row) => row.id !== this.args[0]);
            }
            if (/DELETE FROM engineers WHERE id = \?/i.test(sql)) {
              dbState.engineers = dbState.engineers.filter((row) => row.id !== this.args[0]);
            }
            return { success: true };
          },
        };
      },
      async batch(statements) {
        dbState.batches.push(statements.map((statement) => statement.sql.trim().replace(/\s+/g, ' ')));
        if (dbState.batchError) {
          const error = dbState.batchError;
          dbState.batchError = null;
          throw error;
        }
        for (const statement of statements) await statement.run();
        return statements.map(() => ({ success: true }));
      },
    },
    __kv: kv,
    __dbState: dbState,
    ...overrides,
  };
}

async function adminRequest(url, { method = 'POST', body, market = 'com' } = {}) {
  const token = await signJwt({
    userId: 'admin',
    userType: 'admin',
    market,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, 'test-secret-with-enough-length');

  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: new URL(url).origin.replace('api.', 'admin.'),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
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
      password: 'secret12345',
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
      password: 'secret12345',
      code: '888888',
      company: '测试公司',
    }),
  });

  const response = await worker.fetch(request, {}, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 410);
  assert.equal(body.error, '工程师账号暂不开放公开注册。');
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
  assert.match(json.csrfToken, /^[A-Za-z0-9_-]{32,}$/);
  assert.match(response.headers.get('set-cookie') || '', /^__Host-sagemro_admin_session=/);
  assert.match(response.headers.get('set-cookie') || '', /HttpOnly/);
  assert.match(response.headers.get('set-cookie') || '', /Secure/);
});

test('browser admin login keeps the JWT out of the JSON response', async () => {
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://admin.sagemro.com',
    },
    body: JSON.stringify({ phone: '13800000000', password: 'global-pass' }),
  }), createTestEnv(), { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.token, undefined);
  assert.match(json.csrfToken, /^[A-Za-z0-9_-]{32,}$/);
  assert.match(response.headers.get('set-cookie') || '', /^__Host-sagemro_admin_session=/);
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

async function postJson(url, body, env = createTestEnv(), origin = new URL(url).origin.replace('api.', '')) {
  const response = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
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
      password: 'secret12345',
      company: 'Test Co',
      code: '2468',
    }, env);
    assert.equal(invalidRegister.response.status, 400);
    assert.match(invalidRegister.json.error, /验证码错误|Verification code/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('COM customer registration stores email and allows email login', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_email_joe@example.com', '1357');

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Joe',
    phone: '+66961135966',
    email: 'Joe@Example.com',
    password: 'secret12345',
    code: '1357',
    company: '济南钰峭机械有限公司',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.customer.phone, '+66961135966');
  assert.equal(env.__dbState.customers[0].email, 'joe@example.com');
  assert.equal(env.__dbState.customers[0].auth_status, 'authenticated');
  assert.equal(env.__dbState.identities.some((row) => (
    row.identity_type === 'email' && row.normalized_value === 'joe@example.com'
  )), true);
  assert.equal(env.__dbState.identities.some((row) => (
    row.identity_type === 'phone' && row.normalized_value === '+66961135966'
  )), true);
  assert.equal(env.__dbState.batches[0].length, 3);
  assert.equal(await env.KV.get('verify_code_email_joe@example.com'), null);

  const loginResult = await postJson('https://api.sagemro.com/api/auth/login', {
    email: 'JOE@example.com',
    password: 'secret12345',
  }, env);

  assert.equal(loginResult.response.status, 200);
  assert.equal(loginResult.json.user.phone, '+66961135966');
  assert.equal(loginResult.json.user.email, 'joe@example.com');
});

test('customer registration rejects an email owned by an engineer identity', async () => {
  const env = createTestEnv();
  env.__dbState.identities.push({
    identity_type: 'email',
    normalized_value: 'joe@example.com',
    owner_type: 'engineer',
    owner_id: 'eng-1',
  });
  await env.KV.put('verify_code_email_joe@example.com', '1357');

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Joe',
    phone: '+66961135966',
    email: 'JOE@example.com',
    password: 'secret12345',
    code: '1357',
    company: 'Test Co',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 409);
  assert.match(json.error, /email/i);
  assert.equal(env.__dbState.customers.length, 0);
});

test('customer registration direct-table fallback normalizes an engineer phone', async () => {
  const env = createTestEnv();
  env.__dbState.engineers.push({ id: 'eng-1', phone: '+52 (5572) 080-065' });
  await env.KV.put('verify_code_email_joe@example.com', '1357');

  const { response } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Joe',
    phone: '+525572080065',
    email: 'joe@example.com',
    password: 'secret12345',
    code: '1357',
    company: 'Test Co',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 409);
  assert.equal(env.__dbState.customers.length, 0);
});

test('customer registration direct-table fallback removes historical phone control whitespace', async () => {
  const env = createTestEnv();
  env.__dbState.engineers.push({ id: 'eng-1', phone: '+52\t(5572)\n080-065\r' });
  await env.KV.put('verify_code_email_joe@example.com', '1357');

  const { response } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Joe',
    phone: '+525572080065',
    email: 'joe@example.com',
    password: 'secret12345',
    code: '1357',
    company: 'Test Co',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 409);
  assert.equal(env.__dbState.customers.length, 0);
});

test('customer registration maps a concurrent identity claim to 409', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_email_joe@example.com', '1357');
  env.__dbState.batchError = new Error(
    'D1_ERROR: UNIQUE constraint failed: account_identities.identity_type, account_identities.normalized_value: SQLITE_CONSTRAINT',
  );
  const originalBatch = env.DB.batch;
  env.DB.batch = async (statements) => {
    env.__dbState.identities.push({
      identity_type: 'email',
      normalized_value: 'joe@example.com',
      owner_type: 'engineer',
      owner_id: 'eng-race',
    });
    return originalBatch(statements);
  };

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Joe',
    phone: '+66961135966',
    email: 'joe@example.com',
    password: 'secret12345',
    code: '1357',
    company: 'Test Co',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 409);
  assert.match(json.error, /email/i);
  assert.equal(env.__dbState.customers.length, 0);
});

test('customer registration maps a concurrent normalized email index conflict to 409', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_email_joe@example.com', '1357');
  env.__dbState.batchError = new Error(
    "D1_ERROR: UNIQUE constraint failed: index 'idx_customers_email_normalized_unique': SQLITE_CONSTRAINT",
  );

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Joe',
    phone: '+66961135966',
    email: 'joe@example.com',
    password: 'secret12345',
    code: '1357',
    company: 'Test Co',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 409);
  assert.match(json.error, /email/i);
  assert.equal(env.__dbState.customers.length, 0);
});

test('Admin customer creation atomically claims the phone identity', async () => {
  const env = createTestEnv();
  const response = await worker.fetch(await adminRequest('https://api.sagemro.com/api/admin/users', {
    body: {
      userType: 'customer',
      name: 'Customer One',
      phone: '+1 (555) 123-4567',
      password: 'secret12345',
      region: 'Texas',
    },
  }), env, { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.user.phone, '+1 (555) 123-4567');
  assert.equal(env.__dbState.batches.at(-1).length, 2);
  assert.equal(env.__dbState.identities.some((row) => (
    row.identity_type === 'phone'
    && row.normalized_value === '+15551234567'
    && row.owner_type === 'customer'
  )), true);
});

test('Admin customer creation direct-table fallback removes historical phone control whitespace', async () => {
  const env = createTestEnv();
  env.__dbState.customers.push({ id: 'cust-existing', phone: '+1\t(555)\n123-4567\r' });

  const response = await worker.fetch(await adminRequest('https://api.sagemro.com/api/admin/users', {
    body: {
      userType: 'customer',
      name: 'Customer Two',
      phone: '+15551234567',
      password: 'secret12345',
      region: 'Texas',
    },
  }), env, { waitUntil() {} });

  assert.equal(response.status, 409);
  assert.equal(env.__dbState.customers.length, 1);
});

test('Admin customer creation maps a concurrent customer phone conflict to 409', async () => {
  const env = createTestEnv();
  env.__dbState.batchError = new Error(
    'D1_ERROR: UNIQUE constraint failed: customers.phone: SQLITE_CONSTRAINT',
  );

  const response = await worker.fetch(await adminRequest('https://api.sagemro.com/api/admin/users', {
    body: {
      userType: 'customer',
      name: 'Customer Two',
      phone: '+15551234567',
      password: 'secret12345',
      region: 'Texas',
    },
  }), env, { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 409);
  assert.match(json.error, /phone/i);
  assert.equal(env.__dbState.customers.length, 0);
});

test('generic Admin engineer creation is retired with guidance', async () => {
  const env = createTestEnv();
  const response = await worker.fetch(await adminRequest('https://api.sagemro.com/api/admin/users', {
    body: {
      userType: 'engineer',
      name: 'Engineer One',
      phone: '+15551234567',
      password: 'secret12345',
    },
  }), env, { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 410);
  assert.match(json.error, /approved application/i);
  assert.equal(env.__dbState.engineers.length, 0);
});

test('Admin account deletion releases customer identity before deleting the customer', async () => {
  const env = createTestEnv();
  env.__dbState.customers.push({ id: 'cust-1', phone: '+15551230001' });
  env.__dbState.identities.push({
    identity_type: 'phone', normalized_value: '+15551230001', owner_type: 'customer', owner_id: 'cust-1',
  });

  const response = await worker.fetch(await adminRequest(
    'https://api.sagemro.com/api/admin/users/cust-1?type=customer',
    { method: 'DELETE' },
  ), env, { waitUntil() {} });

  assert.equal(response.status, 200);
  const batch = env.__dbState.batches.at(-1);
  assert.ok(batch.findIndex((sql) => sql.startsWith('DELETE FROM account_identities'))
    < batch.findIndex((sql) => sql.startsWith('DELETE FROM customers')));
});

test('Admin engineer deletion clears application, activation, and identity before the engineer', async () => {
  const env = createTestEnv();
  env.__dbState.engineers.push({ id: 'eng-1', phone: '+15551230002' });
  env.__dbState.engineerApplications.push({ id: 'app-1', converted_user_id: 'eng-1' });
  env.__dbState.engineerActivations.push({ id: 'activation-1', engineer_id: 'eng-1' });
  env.__dbState.identities.push({
    identity_type: 'phone', normalized_value: '+15551230002', owner_type: 'engineer', owner_id: 'eng-1',
  });

  const response = await worker.fetch(await adminRequest(
    'https://api.sagemro.com/api/admin/users/eng-1?type=engineer',
    { method: 'DELETE' },
  ), env, { waitUntil() {} });

  assert.equal(response.status, 200);
  const batch = env.__dbState.batches.at(-1);
  const applicationIndex = batch.findIndex((sql) => sql.startsWith('UPDATE engineer_applications'));
  const activationIndex = batch.findIndex((sql) => sql.startsWith('DELETE FROM engineer_account_activations'));
  const identityIndex = batch.findIndex((sql) => sql.startsWith('DELETE FROM account_identities'));
  const engineerIndex = batch.findIndex((sql) => sql.startsWith('DELETE FROM engineers'));
  assert.ok(applicationIndex < activationIndex);
  assert.ok(activationIndex < identityIndex);
  assert.ok(identityIndex < engineerIndex);
});

test('Admin deletion preserves material requisition history for customers and engineers', async () => {
  for (const [type, userId, ownerField] of [
    ['customer', 'cust-linked', 'customer_id'],
    ['engineer', 'eng-linked', 'engineer_id'],
  ]) {
    const env = createTestEnv();
    env.__dbState[type === 'customer' ? 'customers' : 'engineers'].push({ id: userId });
    env.__dbState.workOrders.push({ id: 'wo-linked', [ownerField]: userId });
    env.__dbState.materialRequisitions.push({ id: 'req-linked', work_order_id: 'wo-linked' });

    const response = await worker.fetch(await adminRequest(
      `https://api.sagemro.com/api/admin/users/${userId}?type=${type}`,
      { method: 'DELETE' },
    ), env, { waitUntil() {} });

    assert.equal(response.status, 409, type);
    assert.equal(env.__dbState.batches.length, 0, type);
  }
});

test('customer login returns company profile fields saved during registration', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_email_buyer@example.com', '1357');

  const company = 'ABC Metal Products Co., Ltd.';
  const registration = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Buyer One',
    phone: '13800000002',
    email: 'buyer@example.com',
    password: 'secret12345',
    code: '1357',
    company,
    identity: 'customer',
  }, env);
  assert.equal(registration.response.status, 200);

  const loginResult = await postJson('https://api.sagemro.com/api/auth/login', {
    phone: '13800000002',
    password: 'secret12345',
  }, env);

  assert.equal(loginResult.response.status, 200);
  assert.equal(loginResult.json.user.company, company);
  assert.equal(loginResult.json.user.auth_status, 'authenticated');
  assert.equal(loginResult.json.token, undefined);
});

test('non-browser customer login retains Bearer compatibility', async () => {
  const env = createTestEnv();
  const salt = 'script-login-salt';
  env.__dbState.customers.push({
    id: 'cust-script-login',
    user_no: 'U000097',
    name: 'Script Customer',
    phone: '+15550000097',
    email: 'script-login@example.com',
    password_hash: await hashPasswordNew('secret12345', salt),
    salt,
    auth_status: 'authenticated',
  });

  const response = await worker.fetch(new Request('https://api.sagemro.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'script-login@example.com', password: 'secret12345' }),
  }), env, { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.match(json.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test('customer session is restored from its HttpOnly cookie', async () => {
  const env = createTestEnv();
  const salt = 'session-customer-salt';
  const password = 'secret12345';
  env.__dbState.customers.push({
    id: 'cust-session-1',
    user_no: 'U000099',
    name: 'Session Customer',
    phone: '+15550000099',
    email: 'session@example.com',
    password_hash: await hashPasswordNew(password, salt),
    salt,
    company: 'Session Co',
    auth_status: 'authenticated',
  });

  const loginResult = await postJson('https://api.sagemro.com/api/auth/login', {
    email: 'session@example.com', password,
  }, env);
  const cookie = (loginResult.response.headers.get('set-cookie') || '').split(';')[0];
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://sagemro.com', Cookie: cookie },
  }), env, { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.authenticated, true);
  assert.equal(json.userType, 'customer');
  assert.equal(json.user.id, 'cust-session-1');
  assert.equal(json.user.company, 'Session Co');
  assert.equal(json.csrfToken, loginResult.json.csrfToken);
});

test('legacy Bearer session restore rotates into a CSRF-bound HttpOnly cookie', async () => {
  const env = createTestEnv();
  env.__dbState.customers.push({
    id: 'cust-legacy-session',
    user_no: 'U000098',
    name: 'Legacy Session Customer',
    phone: '+15550000098',
    email: 'legacy-session@example.com',
    company: 'Legacy Session Co',
    auth_status: 'authenticated',
  });
  const legacyToken = await signJwt({
    userId: 'cust-legacy-session',
    userType: 'customer',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/auth/session', {
    headers: {
      Origin: 'https://sagemro.com',
      Authorization: `Bearer ${legacyToken}`,
    },
  }), env, { waitUntil() {} });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.authenticated, true);
  assert.match(json.csrfToken, /^[A-Za-z0-9_-]{32,}$/);
  assert.match(response.headers.get('set-cookie') || '', /^__Host-sagemro_customer_session=/);
});

test('session endpoint returns an unauthenticated result without raising 401', async () => {
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://sagemro.com' },
  }), createTestEnv(), { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test('logout clears the role-isolated session cookie', async () => {
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/auth/logout', {
    method: 'POST',
    headers: { Origin: 'https://sagemro.com' },
  }), createTestEnv(), { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') || '', /^__Host-sagemro_customer_session=;/);
  assert.match(response.headers.get('set-cookie') || '', /Max-Age=0/);
});

test('customer phone login matches canonical phone formatting', async () => {
  const env = createTestEnv();
  const salt = 'formatted-customer-salt';
  const password = 'secret12345';
  env.__dbState.customers.push({
    id: 'cust-formatted-1',
    user_no: 'U000002',
    name: 'Formatted Customer',
    phone: '+1 (555) 123-4567',
    password_hash: await hashPasswordNew(password, salt),
    salt,
    auth_status: 'authenticated',
  });

  const result = await postJson('https://api.sagemro.com/api/auth/login', {
    phone: '+15551234567', password,
  }, env);

  assert.equal(result.response.status, 200);
  assert.equal(result.json.userType, 'customer');
  assert.equal(result.json.user.id, 'cust-formatted-1');
});

test('activated engineer signs in with normalized email and phone', async () => {
  const env = createTestEnv();
  const salt = 'engineer-login-salt';
  const password = 'secret12345';
  env.__dbState.engineers.push({
    id: 'eng-login-1',
    user_no: 'E000001',
    name: 'Tom Lee',
    phone: '+525572080065',
    email: 'tom@example.com',
    password_hash: await hashPasswordNew(password, salt),
    salt,
    auth_status: 'authenticated',
  });

  const emailLogin = await postJson('https://api.sagemro.com/api/auth/login', {
    email: ' TOM@EXAMPLE.COM ', password,
  }, env, 'https://engineer.sagemro.com');
  assert.equal(emailLogin.response.status, 200);
  assert.equal(emailLogin.json.userType, 'engineer');

  const phoneLogin = await postJson('https://api.sagemro.com/api/auth/login', {
    phone: '+525572080065', password,
  }, env, 'https://engineer.sagemro.com');
  assert.equal(phoneLogin.response.status, 200);
});

test('customer portal rejects engineer credentials with portal guidance', async () => {
  const env = createTestEnv();
  const salt = 'engineer-portal-boundary-salt';
  const password = 'secret12345';
  env.__dbState.engineers.push({
    id: 'eng-boundary-1',
    user_no: 'E000010',
    name: 'Portal Engineer',
    phone: '+15550000010',
    email: 'portal-engineer@example.com',
    password_hash: await hashPasswordNew(password, salt),
    salt,
    auth_status: 'authenticated',
  });

  const response = await worker.fetch(new Request('https://api.sagemro.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://sagemro.com' },
    body: JSON.stringify({ email: 'portal-engineer@example.com', password }),
  }), env, { waitUntil() {} });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /engineer\.sagemro\.com/);
});

test('engineer portal rejects customer credentials with portal guidance', async () => {
  const env = createTestEnv();
  const salt = 'customer-portal-boundary-salt';
  const password = 'secret12345';
  env.__dbState.customers.push({
    id: 'cust-boundary-1',
    user_no: 'U000010',
    name: 'Portal Customer',
    phone: '+15550000011',
    email: 'portal-customer@example.com',
    password_hash: await hashPasswordNew(password, salt),
    salt,
    auth_status: 'authenticated',
  });

  const response = await worker.fetch(new Request('https://api.sagemro.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://engineer.sagemro.com' },
    body: JSON.stringify({ email: 'portal-customer@example.com', password }),
  }), env, { waitUntil() {} });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /sagemro\.com/);
});

test('phone login preserves customer-first matching across canonical formats', async () => {
  const env = createTestEnv();
  const salt = 'customer-first-salt';
  const password = 'secret12345';
  const password_hash = await hashPasswordNew(password, salt);
  env.__dbState.customers.push({
    id: 'cust-first', user_no: 'U000003', name: 'Customer First',
    phone: '+52 (55) 7208-0065', password_hash, salt, auth_status: 'authenticated',
  });
  env.__dbState.engineers.push({
    id: 'eng-second', user_no: 'E000004', name: 'Engineer Second',
    phone: '+525572080065', password_hash, salt, auth_status: 'authenticated',
  });

  const result = await postJson('https://api.sagemro.com/api/auth/login', {
    phone: '+52 55 7208 0065', password,
  }, env);

  assert.equal(result.response.status, 200);
  assert.equal(result.json.userType, 'customer');
  assert.equal(result.json.user.id, 'cust-first');
});

test('pending engineer cannot sign in with phone or email', async () => {
  const env = createTestEnv();
  const salt = 'pending-engineer-salt';
  const password = 'secret12345';
  env.__dbState.engineers.push({
    id: 'eng-pending-1',
    user_no: 'E000002',
    name: 'Pending Engineer',
    phone: '+525572080066',
    email: 'pending@example.com',
    password_hash: await hashPasswordNew(password, salt),
    salt,
    auth_status: 'pending_activation',
  });

  for (const body of [
    { phone: '+525572080066', password },
    { email: 'PENDING@example.com', password },
  ]) {
    const result = await postJson('https://api.sagemro.com/api/auth/login', body, env);
    assert.equal(result.response.status, 403);
  }
});

test('legacy engineer auth status keeps current login behavior', async () => {
  const env = createTestEnv();
  const salt = 'legacy-engineer-salt';
  const password = 'secret12345';
  env.__dbState.engineers.push({
    id: 'eng-legacy-1',
    user_no: 'E000003',
    name: 'Legacy Engineer',
    phone: '13800000000',
    password_hash: await hashPasswordNew(password, salt),
    salt,
    auth_status: 'pending',
  });

  const result = await postJson('https://api.sagemro.com/api/auth/login', {
    phone: '13800000000', password,
  }, env, 'https://engineer.sagemro.com');
  assert.equal(result.response.status, 200);
});

test('CN customer registration accepts a phone verification code without requiring email', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_13800000003', '2468');

  const { response, json } = await postJson('https://api.sagemro.cn/api/auth/register/customer', {
    name: 'Joe',
    phone: '13800000003',
    password: 'secret12345',
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
    password: 'secret12345',
    code: '8642',
    company: '济南钰峭机械有限公司',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.customer.phone, '13800000004');
  assert.equal(await env.KV.get('verify_code_13800000004'), null);
});

test('customer registration rejects public passwords shorter than 10 characters', async () => {
  const env = createTestEnv();
  await env.KV.put('verify_code_email_short@example.com', '1357');

  const { response, json } = await postJson('https://api.sagemro.com/api/auth/register/customer', {
    name: 'Short Password',
    phone: '+15551234567',
    email: 'short@example.com',
    password: 'secret123',
    code: '1357',
    company: 'Test Co',
    identity: 'customer',
  }, env);

  assert.equal(response.status, 400);
  assert.match(json.error, /Password must be at least 10 characters/);
  assert.equal(env.__dbState.customers.length, 0);
});

test('password reset rejects new passwords shorter than 10 characters', async () => {
  const env = createTestEnv();
  env.__dbState.customers.push({
    id: 'cust-1',
    user_no: 'U000001',
    name: 'Reset Customer',
    phone: '13800000005',
    password_hash: 'old-hash',
    salt: 'old-salt',
  });
  await env.KV.put('reset_code_13800000005', '2468');

  const { response, json } = await postJson('https://api.sagemro.cn/api/auth/reset-password', {
    phone: '13800000005',
    code: '2468',
    newPassword: 'secret123',
  }, env);

  assert.equal(response.status, 400);
  assert.match(json.error, /密码至少需要 10 位|Password must be at least 10 characters/);
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

test('cookie-authenticated engineer writes reject missing CSRF', async () => {
  const { env } = makeEngineerRejectEnv();
  const csrf = 'csrf-token-for-engineer';
  const token = await signJwt({
    userId: 'eng-1',
    userType: 'engineer',
    csrf,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, ENGINEER_REJECT_JWT_SECRET);
  const request = new Request('https://api.sagemro.com/api/engineers/tickets/reject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__Host-sagemro_engineer_session=${token}`,
      Origin: 'https://engineer.sagemro.com',
    },
    body: JSON.stringify({ work_order_id: 'wo-1', reason: 'Schedule conflict' }),
  });

  const response = await worker.fetch(request, env, { waitUntil() {} });
  assert.equal(response.status, 403);
});

test('cookie-authenticated engineer writes accept matching CSRF', async () => {
  const { env } = makeEngineerRejectEnv();
  const csrf = 'csrf-token-for-engineer';
  const token = await signJwt({
    userId: 'eng-1',
    userType: 'engineer',
    csrf,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, ENGINEER_REJECT_JWT_SECRET);
  const request = new Request('https://api.sagemro.com/api/engineers/tickets/reject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__Host-sagemro_engineer_session=${token}`,
      Origin: 'https://engineer.sagemro.com',
      'X-CSRF-Token': csrf,
    },
    body: JSON.stringify({ work_order_id: 'wo-1', reason: 'Schedule conflict' }),
  });

  const response = await worker.fetch(request, env, { waitUntil() {} });
  assert.equal(response.status, 200);
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
