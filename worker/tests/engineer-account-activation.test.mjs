import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  activationExpiresAt,
  buildEngineerActivationEmail,
  buildEngineerActivationUrl,
  createEngineerActivationToken,
  hashEngineerActivationToken,
} from '../src/lib/engineerActivation.js';
import { signJwt } from '../src/lib/auth.js';
import worker, { sendEngineerActivationEmail } from '../src/index.js';

const JWT_SECRET = 'engineer-activation-test-secret';
const FIXED_EXPIRES_AT = '2026-07-23T12:00:00.000Z';

function statement(sql, env) {
  return {
    sql,
    args: [],
    bind(...args) {
      this.args = args;
      return this;
    },
    async first() {
      if (/SELECT user_no FROM engineers/i.test(sql)) return { user_no: 'E000127' };
      if (/FROM engineer_account_activations activation/i.test(sql)) {
        if (!env.__options.validToken) return null;
        return {
          activation_id: 'activation-1',
          engineer_id: 'eng-1',
          engineer_no: 'E000128',
          engineer_name: 'Alex Service',
          market: 'com',
          auth_status: env.__options.authStatus || 'pending_activation',
        };
      }
      if (/FROM engineer_applications a/i.test(sql) && /WHERE a\.id = \?/i.test(sql)) {
        return env.__applicationRow();
      }
      if (/FROM engineer_applications WHERE id = \?/i.test(sql)) return env.__applicationRow();
      if (/FROM account_identities/i.test(sql)) return env.__options.identityConflict || null;
      if (/FROM customers/i.test(sql) || /FROM engineers/i.test(sql)) return null;
      return null;
    },
    async all() {
      if (/FROM engineer_applications a/i.test(sql)) {
        return { results: env.__options.applicationRows || [env.__applicationRow()] };
      }
      return { results: [] };
    },
    async run() {
      env.__runs.push({ sql, args: this.args });
      return { success: true, meta: { changes: 1 } };
    },
  };
}

function makeActivationEnv(options = {}) {
  class TestEmailMessage {
    constructor(from, to, raw) {
      this.from = from;
      this.to = to;
      this.raw = raw;
    }
  }
  const env = {
    JWT_SECRET,
    VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@example.com>',
    __EmailMessage: TestEmailMessage,
    __options: options,
    __batches: [],
    __runs: [],
    __kv: new Map([
      ...(options.rateLimited ? [['engineer_activation_resend_eng-1', '1']] : []),
      ...(options.activationAttemptCount
        ? [
            ['engineer_activation_attempt_ip_203.0.113.10', String(options.activationAttemptCount)],
            ['engineer_activation_attempt_token_' + 'placeholder', String(options.activationAttemptCount)],
          ]
        : []),
    ]),
    __kvPuts: [],
    __applicationRow() {
      return {
        id: 'app-1',
        market: 'com',
        status: options.applicationStatus || 'qualified',
        name: 'Alex Service',
        phone: '+1 555 0100',
        email: 'alex@example.com',
        base_region: 'Chicago',
        service_regions: '["Illinois","Indiana"]',
        equipment_types: '["laser_cutting"]',
        brand_experience: '["Raycus"]',
        skill_tags: '["maintenance","repair"]',
        languages: '["English"]',
        converted_user_id: options.convertedUserId || null,
        engineer_no: options.convertedUserId ? 'E000128' : null,
        engineer_auth_status: options.authStatus || (options.convertedUserId ? 'pending_activation' : null),
        activation_expires_at: options.convertedUserId ? FIXED_EXPIRES_AT : null,
        activation_sent_at: options.convertedUserId ? '2026-07-21T12:01:00.000Z' : null,
        activation_send_status: options.convertedUserId ? 'sent' : null,
        activation_revoked_at: null,
      };
    },
    DB: {
      prepare(sql) {
        return statement(sql, env);
      },
      async batch(statements) {
        env.__batches.push(statements.map((item) => ({ sql: item.sql, args: item.args })));
        const applicationGuard = statements.find((item) => (
          /application_account_guard_failed/i.test(item.sql)
        ));
        const simulatesConcurrentApplicationChange = Object.hasOwn(
          options, 'concurrentApplicationStatus'
        ) || Object.hasOwn(options, 'concurrentConvertedUserId');
        if (applicationGuard && simulatesConcurrentApplicationChange && (
          options.concurrentApplicationStatus !== 'qualified'
          || options.concurrentConvertedUserId
        )) {
          throw new Error('NOT NULL constraint failed: account_identities.identity_type');
        }
        if (options.activationGuardError) {
          throw new Error("CHECK constraint failed: identity_type IN ('email', 'phone')");
        }
        return statements.map((_, index) => ({
          success: true,
          meta: { changes: options.batchChanges?.[index] ?? 1 },
        }));
      },
    },
    KV: {
      async get(key) {
        if (options.activationAttemptCount && key.startsWith('engineer_activation_attempt_')) {
          return String(options.activationAttemptCount);
        }
        return env.__kv.get(key) || null;
      },
      async put(key, value, settings) {
        env.__kv.set(key, value);
        env.__kvPut = { key, value, settings };
        env.__kvPuts.push(env.__kvPut);
      },
    },
    EMAIL: {
      async send(payload) {
        env.__emailPayload = payload;
        if (options.emailError) throw new Error(options.emailError);
      },
    },
    __batchSql() {
      return (env.__batches.at(-1) || []).map((item) => item.sql.replace(/\s+/g, ' ').trim()).join('\n');
    },
  };
  return env;
}

async function adminActivationRequest(action, body = {}) {
  const token = await signJwt({
    userId: 'admin-1',
    userType: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  return new Request(`https://api.sagemro.com/api/admin/engineer-applications/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: 'https://admin.sagemro.com',
    },
    body: JSON.stringify(body),
  });
}

function postActivation(env, body) {
  return worker.fetch(new Request('https://api.sagemro.com/api/auth/engineer/activate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.10',
    },
    body: JSON.stringify(body),
  }), env, { waitUntil() {} });
}

const root = path.resolve(import.meta.dirname, '../..');
const migrationPath = path.join(root, 'worker/migrations/037_engineer_account_activation.sql');
const preflightPath = path.join(root, 'worker/migrations/data_fixes/account_identity_preflight.sql');
const schemaPath = path.join(root, 'worker/schema.sql');
const funnelMigrationPath = path.join(root, 'worker/migrations/036_create_funnel_events.sql');

test('activation migration adds engineer email, shared identities, and activation records', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  assert.match(sql, /ALTER TABLE engineers ADD COLUMN email TEXT/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_identities/);
  assert.match(sql, /PRIMARY KEY\s*\(identity_type, normalized_value\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS engineer_account_activations/);
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(sql, /expires_at TEXT NOT NULL/);
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_activations_one_open[\s\S]*WHERE used_at IS NULL AND revoked_at IS NULL/,
  );
  assert.equal((sql.match(/INSERT INTO account_identities/g) || []).length, 3);
  assert.match(sql, /SELECT 'email',[\s\S]*'customer', id[\s\S]*FROM customers/);
  assert.match(sql, /SELECT 'phone',[\s\S]*'customer', id[\s\S]*FROM customers/);
  assert.match(sql, /SELECT 'phone',[\s\S]*'engineer', id[\s\S]*FROM engineers/);
  assert.match(sql, /037_engineer_account_activation/);
});

test('activation preflight and migration normalize historical phone whitespace consistently', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const preflightSql = readFileSync(preflightPath, 'utf8');

  for (const sql of [migrationSql, preflightSql]) {
    assert.match(sql, /replace\([^\n]+char\(9\)[^\n]+\)/);
    assert.match(sql, /replace\([^\n]+char\(10\)[^\n]+\)/);
    assert.match(sql, /replace\([^\n]+char\(13\)[^\n]+\)/);
  }
  assert.equal((migrationSql.match(/char\(9\)/g) || []).length, 2);
  assert.equal((preflightSql.match(/char\(9\)/g) || []).length, 2);
});

test('schema snapshot includes migration 036 before activation migration 037', () => {
  const funnelMigrationSql = readFileSync(funnelMigrationPath, 'utf8').trim();
  const schemaSql = readFileSync(schemaPath, 'utf8');
  const funnelSchemaSql = funnelMigrationSql.split('INSERT OR IGNORE INTO _migrations')[0].trim();

  assert.ok(schemaSql.includes(funnelSchemaSql));
  assert.match(schemaSql, /\('036_create_funnel_events',\s+'Controlled beta funnel event tracking'\)/);
  assert.ok(schemaSql.indexOf('036_create_funnel_events') < schemaSql.indexOf('037_engineer_account_activation'));
  assert.ok(schemaSql.indexOf('CREATE TABLE IF NOT EXISTS funnel_events') < schemaSql.indexOf('CREATE TABLE IF NOT EXISTS account_identities'));
});

test('activation token is random, hashed, and placed in the URL fragment', async () => {
  const first = createEngineerActivationToken();
  const second = createEngineerActivationToken();

  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(await hashEngineerActivationToken(first), /^[a-f0-9]{64}$/);
  assert.equal(
    buildEngineerActivationUrl('cn', first),
    `https://engineer.sagemro.cn/activate#token=${first}`,
  );
});

test('activation expiry is exactly 48 hours after creation', () => {
  const now = Date.parse('2026-07-21T12:00:00.000Z');

  assert.equal(activationExpiresAt(now), '2026-07-23T12:00:00.000Z');
});

test('activation email contains no password and explains the 48-hour expiry', () => {
  const email = buildEngineerActivationEmail({
    market: 'com',
    name: 'Tom Lee',
    engineerNo: 'E000128',
    activationUrl: 'https://example.test/#token=x',
  });

  assert.match(email.subject, /Activate your SAGEMRO engineer account/);
  assert.match(email.text, /48 hours/);
  assert.match(email.html, /<a[^>]+href="https:\/\/example\.test\/#token=x"/);
  assert.match(email.html, />https:\/\/example\.test\/#token=x</);
  assert.doesNotMatch(email.text, /password:/i);
});

test('activation email escapes applicant-controlled HTML', () => {
  const email = buildEngineerActivationEmail({
    market: 'com',
    name: '<img src=x onerror=alert(1)>',
    engineerNo: '<script>alert(2)</script>',
    activationUrl: 'https://example.test/#token=x&next="bad"',
  });

  assert.doesNotMatch(email.html, /<img|<script/);
  assert.match(email.html, /&lt;img/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /href="https:\/\/example\.test\/#token=x&amp;next=&quot;bad&quot;"/);
});

test('activation email sender uses a raw MIME EmailMessage with Cloudflare Email', async () => {
  const sent = [];
  class TestEmailMessage {
    constructor(from, to, raw) {
      this.from = from;
      this.to = to;
      this.raw = raw;
    }
  }
  const payload = {
    to: 'engineer@example.com',
    subject: 'Activate account',
    text: 'Open the activation link.',
    html: '<p>Open the activation link.</p>',
  };
  const env = {
    VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@mail.sagemro.com>',
    __EmailMessage: TestEmailMessage,
    EMAIL: {
      async send(message) {
        sent.push(message);
      },
    },
  };

  const result = await sendEngineerActivationEmail(env, payload, 'com');

  assert.deepEqual(result, { sent: true });
  assert.equal(sent.length, 1);
  assert.ok(sent[0] instanceof TestEmailMessage);
  assert.equal(sent[0].from, env.VERIFICATION_EMAIL_FROM);
  assert.equal(sent[0].to, payload.to);
  assert.match(sent[0].raw, /MIME-Version: 1\.0/);
  assert.match(sent[0].raw, /Content-Type: multipart\/alternative/);
  assert.match(sent[0].raw, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(sent[0].raw, /Content-Type: text\/html; charset=UTF-8/);
  assert.doesNotMatch(sent[0].raw, /\r?\nBcc:/i);
});

test('activation email sender falls back to Resend without sending a real email', async () => {
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
    const payload = {
      to: 'engineer@example.com',
      subject: 'Activate account',
      text: 'Open the activation link.',
      html: '<p>Open the activation link.</p>',
    };
    const result = await sendEngineerActivationEmail({
      VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@example.com>',
      RESEND_API_KEY: 'test-resend-key',
    }, payload, 'com');

    assert.deepEqual(result, { sent: true });
    assert.equal(capturedRequest.url, 'https://api.resend.com/emails');
    assert.equal(capturedRequest.init.method, 'POST');
    assert.deepEqual(JSON.parse(capturedRequest.init.body), {
      from: 'SAGEMRO <verify@example.com>',
      ...payload,
      to: ['engineer@example.com'],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('activation email sender falls back to Resend after Cloudflare Email fails', async () => {
  const originalFetch = globalThis.fetch;
  let resendCalls = 0;
  globalThis.fetch = async () => {
    resendCalls += 1;
    return new Response(JSON.stringify({ id: 'email-test-id' }), { status: 200 });
  };

  try {
    const result = await sendEngineerActivationEmail({
      VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@example.com>',
      RESEND_API_KEY: 'test-resend-key',
      __EmailMessage: class TestEmailMessage {},
      EMAIL: { async send() { throw new Error('binding unavailable'); } },
    }, {
      to: 'engineer@example.com',
      subject: 'Activate account',
      text: 'Open the activation link.',
      html: '<p>Open the activation link.</p>',
    }, 'com');

    assert.deepEqual(result, { sent: true });
    assert.equal(resendCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('activation email provider failure logs only a generic sanitized reason', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  try {
    const result = await sendEngineerActivationEmail({
      VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@example.com>',
      __EmailMessage: class TestEmailMessage {},
      EMAIL: {
        async send() {
          throw new Error('provider failed for https://engineer.sagemro.com/activate#token=secret-token');
        },
      },
    }, {
      to: 'engineer@example.com',
      subject: 'Activate account',
      text: 'secret-token-url',
      html: '<a href="secret-token-url">Activate</a>',
    }, 'com');

    assert.deepEqual(result, { error: 'Failed to send activation email. Please try again later.' });
    assert.equal(warnings.length, 1);
    assert.match(JSON.stringify(warnings[0]), /provider_error/);
    assert.match(JSON.stringify(warnings[0]), /example\.com/);
    assert.doesNotMatch(JSON.stringify(warnings[0]), /provider failed|activate#token|secret-token-url/);
  } finally {
    console.warn = originalWarn;
  }
});

test('admin authentication is required to open an engineer account', async () => {
  const response = await worker.fetch(new Request(
    'https://api.sagemro.com/api/admin/engineer-applications/app-1/open-account',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  ), makeActivationEnv(), { waitUntil() {} });

  assert.equal(response.status, 401);
});

test('approved application opens and links one pending engineer account atomically', async () => {
  const env = makeActivationEnv({ applicationStatus: 'qualified' });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account', {
    services: ['maintenance'],
    engineer_role: 'engineer',
  }), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.account, {
    engineer_id: body.account.engineer_id,
    engineer_no: 'E000128',
    activation_status: 'awaiting_activation',
    email_sent: true,
    expires_at: body.account.expires_at,
  });
  assert.equal(env.__batches.length, 1);
  assert.match(env.__batchSql(), /INSERT INTO account_identities/);
  assert.match(env.__batchSql(), /INSERT INTO engineers/);
  assert.match(env.__batchSql(), /INSERT INTO engineer_account_activations/);
  assert.match(env.__batchSql(), /UPDATE engineer_applications/);
  assert.match(env.__batchSql(), /INSERT INTO audit_logs/);
  assert.match(env.__batchSql(), /first_login_password_reset_required[\s\S]*1, 'pending_activation'/);
  assert.match(env.__runs.at(-1).sql, /send_status = 'sent'/);
  assert.match(env.__emailPayload.raw, /Activate engineer account/);
});

test('open-account maps approved application defaults and cleaned admin fields to engineer values', async () => {
  const env = makeActivationEnv();
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account', {
    name: '  Alex Field  ',
    services: ['maintenance', 'repair'],
    engineer_role: 'regional_lead',
    regional_lead_id: 'ignored-for-lead',
    responsible_region: ' North America ',
    team_name: '  Midwest Team ',
    certification_status: 'verified',
    cooperation_status: 'active',
    workload_status: 'normal',
  }), env, { waitUntil() {} });

  assert.equal(response.status, 200);
  const engineerInsert = env.__batches[0].find((item) => /INSERT INTO engineers/.test(item.sql));
  assert.equal(engineerInsert.args.includes('Alex Field'), true);
  assert.equal(engineerInsert.args.includes('regional_lead'), true);
  assert.equal(engineerInsert.args.includes('North America'), true);
  assert.equal(engineerInsert.args.includes('Midwest Team'), true);
  assert.equal(engineerInsert.args.includes('verified'), true);
  assert.equal(engineerInsert.args.includes('active'), true);
  assert.equal(engineerInsert.args.includes('normal'), true);
  assert.equal(engineerInsert.args.includes(null), true);
  assert.equal(engineerInsert.args.includes(JSON.stringify(['maintenance', 'repair'])), true);
});

test('unapproved application cannot open an engineer account', async () => {
  const env = makeActivationEnv({ applicationStatus: 'rejected' });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account'), env, { waitUntil() {} });

  assert.equal(response.status, 409);
  assert.equal(env.__batches.length, 0);
});

test('concurrent open-account loser rolls back when another request links the application', async () => {
  const env = makeActivationEnv({
    applicationStatus: 'qualified',
    concurrentApplicationStatus: 'qualified',
    concurrentConvertedUserId: 'eng-winner',
  });
  const response = await worker.fetch(
    await adminActivationRequest('app-1/open-account'), env, { waitUntil() {} },
  );

  assert.equal(response.status, 409);
  assert.equal(env.__batches.length, 1);
  assert.match(env.__batchSql(), /NULL AS application_account_guard_failed/i);
  assert.match(env.__batchSql(), /status = 'qualified'/i);
  assert.match(env.__batchSql(), /converted_user_id IS NULL/i);
  assert.equal(env.__runs.length, 0);
  assert.equal(env.__emailPayload, undefined);
});

test('concurrent review change prevents open-account from overwriting rejected or archived status', async () => {
  for (const status of ['rejected', 'archived']) {
    const env = makeActivationEnv({
      applicationStatus: 'qualified',
      concurrentApplicationStatus: status,
      concurrentConvertedUserId: null,
    });
    const response = await worker.fetch(
      await adminActivationRequest('app-1/open-account'), env, { waitUntil() {} },
    );

    assert.equal(response.status, 409, status);
    assert.equal(env.__runs.length, 0, status);
    assert.equal(env.__emailPayload, undefined, status);
  }
});

test('open-account retry returns the existing linked engineer', async () => {
  const env = makeActivationEnv({ convertedUserId: 'eng-1' });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account'), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.account.engineer_id, 'eng-1');
  assert.equal(env.__batches.length, 0);
});

test('cross-role email or phone conflict prevents account creation', async () => {
  const env = makeActivationEnv({ identityConflict: { identity_type: 'email', owner_type: 'customer' } });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account'), env, { waitUntil() {} });

  assert.equal(response.status, 409);
  assert.equal(env.__batches.length, 0);
});

test('email failure preserves the linked pending account for resend', async () => {
  const env = makeActivationEnv({ emailError: 'provider unavailable' });
  const response = await worker.fetch(await adminActivationRequest('app-1/open-account'), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.account.email_sent, false);
  assert.equal(body.account.activation_status, 'awaiting_activation');
  assert.equal(env.__batches.length, 1);
  assert.match(env.__runs.at(-1).sql, /send_status = 'failed'/);
  assert.doesNotMatch(JSON.stringify(env.__runs.at(-1).args), /provider unavailable/);
});

test('resend revokes the previous token and creates one replacement', async () => {
  const env = makeActivationEnv({ convertedUserId: 'eng-1', authStatus: 'pending_activation' });
  const response = await worker.fetch(await adminActivationRequest('app-1/resend-activation'), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.account.engineer_id, 'eng-1');
  assert.match(env.__batchSql(), /SET revoked_at = datetime\('now'\)/);
  assert.match(env.__batchSql(), /INSERT INTO engineer_account_activations/);
  assert.deepEqual(env.__kvPut, {
    key: 'engineer_activation_resend_eng-1',
    value: '1',
    settings: { expirationTtl: 60 },
  });
});

test('resend uses the linked engineer email after an admin correction', async () => {
  const env = makeActivationEnv({ convertedUserId: 'eng-1', authStatus: 'pending_activation' });
  const originalApplicationRow = env.__applicationRow;
  env.__applicationRow = () => ({
    ...originalApplicationRow(),
    email: 'application@example.com',
    engineer_email: 'corrected@example.com',
    engineer_name: 'Corrected Engineer',
  });

  const response = await worker.fetch(
    await adminActivationRequest('app-1/resend-activation'), env, { waitUntil() {} },
  );

  assert.equal(response.status, 200);
  assert.equal(env.__emailPayload.to, 'corrected@example.com');
});

test('resend is rate limited and activated accounts cannot receive activation emails', async () => {
  const limited = makeActivationEnv({ convertedUserId: 'eng-1', rateLimited: true });
  const limitedResponse = await worker.fetch(await adminActivationRequest('app-1/resend-activation'), limited, { waitUntil() {} });
  assert.equal(limitedResponse.status, 429);
  assert.equal(limited.__batches.length, 0);

  const activated = makeActivationEnv({ convertedUserId: 'eng-1', authStatus: 'authenticated' });
  const activatedResponse = await worker.fetch(await adminActivationRequest('app-1/resend-activation'), activated, { waitUntil() {} });
  assert.equal(activatedResponse.status, 409);
  assert.equal(activated.__batches.length, 0);
});

test('resend rejects legacy and non-activation engineer auth statuses without side effects', async () => {
  for (const authStatus of ['pending', 'suspended']) {
    const env = makeActivationEnv({ convertedUserId: 'eng-1', authStatus });
    const response = await worker.fetch(
      await adminActivationRequest('app-1/resend-activation'), env, { waitUntil() {} },
    );
    const body = await response.json();

    assert.equal(response.status, 409, authStatus);
    assert.match(body.error, /pending activation|待激活/i, authStatus);
    assert.equal(env.__batches.length, 0, authStatus);
    assert.equal(env.__kvPuts.length, 0, authStatus);
    assert.equal(env.__emailPayload, undefined, authStatus);
  }
});

test('application list projects independent review and activation states', async () => {
  const env = makeActivationEnv({ applicationRows: [
    { ...makeActivationEnv().__applicationRow(), id: 'not-opened', converted_user_id: null },
    { ...makeActivationEnv().__applicationRow(), id: 'awaiting', converted_user_id: 'eng-1', engineer_no: 'E000128', engineer_auth_status: 'pending_activation', activation_expires_at: '2999-01-01T00:00:00.000Z' },
    { ...makeActivationEnv().__applicationRow(), id: 'expired', converted_user_id: 'eng-2', engineer_no: 'E000129', engineer_auth_status: 'pending_activation', activation_expires_at: '2000-01-01T00:00:00.000Z' },
    { ...makeActivationEnv().__applicationRow(), id: 'activated', converted_user_id: 'eng-3', engineer_no: 'E000130', engineer_auth_status: 'authenticated', activation_expires_at: '2000-01-01T00:00:00.000Z' },
  ] });
  const response = await worker.fetch(await adminActivationRequest('', {}), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 404);
  const token = await signJwt({ userId: 'admin-1', userType: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
  const listResponse = await worker.fetch(new Request('https://api.sagemro.com/api/admin/engineer-applications', {
    headers: { Authorization: `Bearer ${token}` },
  }), env, { waitUntil() {} });
  const listBody = await listResponse.json();
  assert.deepEqual(listBody.list.map((item) => item.account.activation_status), [
    'not_opened', 'awaiting_activation', 'activation_expired', 'activated',
  ]);
});

test('legacy converted applications remain readable but cannot be newly written', async () => {
  const env = makeActivationEnv({ applicationStatus: 'converted' });
  const token = await signJwt({
    userId: 'admin-1',
    userType: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  const listResponse = await worker.fetch(new Request(
    'https://api.sagemro.com/api/admin/engineer-applications',
    { headers: { Authorization: `Bearer ${token}` } },
  ), env, { waitUntil() {} });
  const updateResponse = await worker.fetch(new Request(
    'https://api.sagemro.com/api/admin/engineer-applications/app-1',
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'converted', review_notes: 'legacy write attempt' }),
    },
  ), env, { waitUntil() {} });

  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).list[0].status, 'converted');
  assert.equal(updateResponse.status, 400);
  assert.equal(env.__runs.some(({ sql }) => /UPDATE engineer_applications/i.test(sql)), false);
});

test('saving an application review preserves its linked engineer account', async () => {
  const env = makeActivationEnv({ convertedUserId: 'eng-1' });
  const token = await signJwt({
    userId: 'admin-1',
    userType: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  const response = await worker.fetch(new Request(
    'https://api.sagemro.com/api/admin/engineer-applications/app-1',
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'qualified', review_notes: 'Keep linked account' }),
    },
  ), env, { waitUntil() {} });
  const update = env.__runs.find(({ sql }) => /UPDATE engineer_applications/i.test(sql));

  assert.equal(response.status, 200);
  assert.ok(update);
  assert.doesNotMatch(update.sql, /converted_user_id/);
});

test('valid activation sets password and consumes the token atomically', async () => {
  const env = makeActivationEnv({ validToken: true, authStatus: 'pending_activation' });
  const response = await postActivation(env, { token: 'valid-token', password: 'secret12345' });

  assert.equal(response.status, 200);
  assert.match(env.__batchSql(), /auth_status = 'authenticated'/);
  assert.match(env.__batchSql(), /first_login_password_reset_required = 0/);
  assert.match(env.__batchSql(), /SET used_at = datetime\('now'\)/);
  assert.match(env.__batchSql(), /INSERT INTO audit_logs/);
  assert.equal(env.__kvPuts.length, 2);
  assert.ok(env.__kvPuts.every((entry) => entry.settings.expirationTtl === 900));
  assert.ok(env.__kvPuts.every((entry) => entry.value === '1'));
});

test('concurrent activation consumption returns the safe invalid-link error', async () => {
  const env = makeActivationEnv({
    validToken: true,
    authStatus: 'pending_activation',
    activationGuardError: true,
  });
  const response = await postActivation(env, { token: 'valid-token', password: 'secret12345' });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /expired|invalid|已失效|无效/i);
});

for (const state of ['expired', 'used', 'revoked', 'unknown']) {
  test(`${state} activation token returns the same safe error`, async () => {
    const response = await postActivation(makeActivationEnv({ tokenState: state }), {
      token: 'invalid-token', password: 'secret12345',
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /expired|invalid|已失效|无效/i);
  });
}

test('activation rejects a password shorter than ten characters', async () => {
  const env = makeActivationEnv({ validToken: true });
  const response = await postActivation(env, { token: 'valid-token', password: 'short' });

  assert.equal(response.status, 400);
  assert.equal(env.__batches.length, 0);
});

test('activation attempts increment IP and token counters and rate limit generically', async () => {
  const env = makeActivationEnv({ activationAttemptCount: 10 });
  const response = await postActivation(env, { token: 'unknown-token', password: 'secret12345' });
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.match(body.error, /too many|稍后/i);
  assert.equal(env.__batches.length, 0);
  assert.equal(env.__kvPuts.length, 2);
  assert.ok(env.__kvPuts.every((entry) => entry.settings.expirationTtl === 900));
  assert.ok(env.__kvPuts.every((entry) => entry.value === '11'));
});
