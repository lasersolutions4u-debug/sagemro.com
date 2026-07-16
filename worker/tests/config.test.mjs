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

test('allows local CN acceptance origins during development', async () => {
  for (const origin of [
    'http://local.sagemro-test.cn:5175',
    'http://engineer.local.sagemro-test.cn:3001',
    'http://admin.local.sagemro-test.cn:5176',
  ]) {
    const response = await worker.fetch(new Request('http://api.local.sagemro-test.cn:8788/health', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    }), { ENVIRONMENT: 'development' }, {});

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  }
});

test('schema snapshot includes the current work-order workflow migrations', () => {
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

  assert.match(schema, /\bemail TEXT\b/);
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
  ]) {
    assert.match(schema, new RegExp(`\\('${version}'`));
  }
});
