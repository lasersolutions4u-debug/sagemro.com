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
import { sendEngineerActivationEmail } from '../src/index.js';

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

test('activation email sender uses Cloudflare Email without a network request', async () => {
  const sent = [];
  const payload = {
    to: 'engineer@example.com',
    subject: 'Activate account',
    text: 'Open the activation link.',
    html: '<p>Open the activation link.</p>',
  };
  const env = {
    VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@mail.sagemro.com>',
    EMAIL: {
      async send(message) {
        sent.push(message);
      },
    },
  };

  const result = await sendEngineerActivationEmail(env, payload, 'com');

  assert.deepEqual(result, { sent: true });
  assert.deepEqual(sent, [{ from: env.VERIFICATION_EMAIL_FROM, ...payload }]);
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

test('activation email provider failure does not log the activation link or body', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  try {
    const result = await sendEngineerActivationEmail({
      VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@example.com>',
      EMAIL: {
        async send() {
          throw new Error('provider unavailable');
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
    assert.match(JSON.stringify(warnings[0]), /provider unavailable/);
    assert.match(JSON.stringify(warnings[0]), /example\.com/);
    assert.doesNotMatch(JSON.stringify(warnings[0]), /secret-token-url/);
  } finally {
    console.warn = originalWarn;
  }
});
