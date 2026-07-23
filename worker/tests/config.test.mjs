import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

test('wrangler.toml does not ship a fixed development verification code', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

  assert.equal(
    /^\s*DEV_BYPASS_CODE\s*=/m.test(config),
    false,
    'Use local .dev.vars for DEV_BYPASS_CODE so deploy config does not expose a fixed verification code.',
  );
});

test('allows the local engineer frontend origin during development', async () => {
  const response = await worker.fetch(new Request('http://127.0.0.1:8787/api/engineers/tickets', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  }), { ENVIRONMENT: 'development' }, {});

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:3000');
});

test('allows same-site nip.io E2E portal origins during development', async () => {
  for (const origin of [
    'http://customer.127.0.0.1.nip.io:4273',
    'http://engineer.127.0.0.1.nip.io:4273',
    'http://admin.127.0.0.1.nip.io:4274',
  ]) {
    const response = await worker.fetch(new Request('http://api.127.0.0.1.nip.io:8878/health', {
      headers: { Origin: origin },
    }), { ENVIRONMENT: 'development' }, {});
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  }
});

test('API responses include baseline security headers without replacing CORS', async () => {
  const response = await worker.fetch(new Request('https://api.sagemro.com/health', {
    headers: { Origin: 'https://sagemro.com' },
  }), { ENVIRONMENT: 'production' }, {});

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://sagemro.com');
  assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
});

test('development HTTP API responses do not force HSTS', async () => {
  const response = await worker.fetch(new Request('http://127.0.0.1:8787/health', {
    headers: { Origin: 'http://127.0.0.1:3000' },
  }), { ENVIRONMENT: 'development' }, {});

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:3000');
  assert.equal(response.headers.get('Strict-Transport-Security'), null);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('schema snapshot includes the current work-order workflow migrations', () => {
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

  assert.match(schema, /\bemail TEXT\b/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS conversations\s*\([\s\S]*\bengineer_id TEXT\b/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_conversations_engineer_id ON conversations\(engineer_id\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS work_order_repair_records\s*\(/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS invoice_requests\s*\(/);
  assert.match(schema, /onsite_conversion_status TEXT NOT NULL DEFAULT 'not_requested'/);

  for (const version of [
    '030_add_customer_email',
    '031_engineer_payouts',
    '032_invoice_requests',
    '032_payment_stages',
    '033_work_order_location_verification',
    '034_add_service_mode',
    '035_onsite_conversion_workflow',
    '038_material_requisitions_and_staff',
  ]) {
    assert.match(schema, new RegExp(`\\('${version}'`));
  }
});

test('onsite arrival is required for completion but not for saving a service report draft', () => {
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const saveStart = source.indexOf('async function handleSaveRepairRecord');
  const resolveStart = source.indexOf('async function handleResolveWorkOrder');
  const saveSource = source.slice(saveStart, source.indexOf('// ============ 工单附件', saveStart));
  const resolveSource = source.slice(resolveStart, source.indexOf('// 客户取消工单', resolveStart));

  assert.doesNotMatch(saveSource, /arrival_verification_required/);
  assert.match(resolveSource, /arrival_verification_required/);
  assert.match(resolveSource, /arrival_verified_at/);
});
