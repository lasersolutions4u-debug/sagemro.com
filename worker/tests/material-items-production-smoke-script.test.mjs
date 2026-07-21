import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildCleanupSql,
  buildResidueSql,
  buildSmokeContext,
  isCliEntry,
  parseWranglerResidueCount,
  parseMaterialSmokeArgs,
  quoteSql,
  sanitizeStepResult,
} from '../scripts/material-items-production-smoke.mjs';

test('material production smoke requires explicit write confirmation', () => {
  assert.throws(
    () => parseMaterialSmokeArgs(['cn']),
    /requires --allow-write/,
  );

  assert.deepEqual(parseMaterialSmokeArgs(['cn', '--allow-write']), {
    market: 'cn',
    allowWrite: true,
    json: false,
  });
});

test('material production smoke validates market argument', () => {
  assert.throws(
    () => parseMaterialSmokeArgs(['eu', '--allow-write']),
    /cn\|com/,
  );
});

test('buildSmokeContext creates SAGEMRO_SMOKE scoped ids for both markets', () => {
  const cn = buildSmokeContext({ market: 'cn', stamp: '20260704050102', password: 'not-secret' });
  const com = buildSmokeContext({ market: 'com', stamp: '20260704050102', password: 'not-secret' });

  assert.equal(cn.runId, 'SAGEMRO_SMOKE_MATERIAL_cn_20260704050102');
  assert.equal(cn.apiBase, 'https://api.sagemro.cn');
  assert.equal(cn.dbName, 'sagemro-db-cn');
  assert.equal(cn.customerPhone.startsWith('136'), true);

  assert.equal(com.runId, 'SAGEMRO_SMOKE_MATERIAL_com_20260704050102');
  assert.equal(com.apiBase, 'https://api.sagemro.com');
  assert.equal(com.dbName, 'sagemro-db');
  assert.equal(com.customerPhone.startsWith('137'), true);
});

test('quoteSql escapes single quotes and nulls', () => {
  assert.equal(quoteSql(null), 'NULL');
  assert.equal(quoteSql("SAGEMRO's smoke"), "'SAGEMRO''s smoke'");
});

test('cleanup SQL deletes child records before parent records and verifies residue', () => {
  const context = buildSmokeContext({ market: 'cn', stamp: '20260704050102', password: 'not-secret' });
  const cleanupSql = buildCleanupSql(context);

  assert.ok(cleanupSql.indexOf('DELETE FROM work_order_material_items') < cleanupSql.indexOf('DELETE FROM work_orders'));
  assert.ok(cleanupSql.indexOf('DELETE FROM work_order_pricing_history') < cleanupSql.indexOf('DELETE FROM work_order_pricing WHERE'));
  assert.ok(cleanupSql.indexOf('DELETE FROM work_orders') < cleanupSql.indexOf('DELETE FROM engineers'));
  assert.ok(cleanupSql.indexOf('DELETE FROM work_orders') < cleanupSql.indexOf('DELETE FROM customers'));
  assert.ok(cleanupSql.indexOf('DELETE FROM account_identities') < cleanupSql.indexOf('DELETE FROM engineers'));
  assert.ok(cleanupSql.indexOf('DELETE FROM account_identities') < cleanupSql.indexOf('DELETE FROM customers'));
  assert.match(cleanupSql, /DELETE FROM materials/);

  const residueSql = buildResidueSql(context);
  assert.match(residueSql, /total_residue/);
  assert.match(residueSql, /SAGEMRO_SMOKE_MATERIAL_cn_20260704050102/);
});

test('sanitizeStepResult never persists tokens or passwords', () => {
  const sanitized = sanitizeStepResult({
    status: 200,
    durationMs: 9,
    path: '/api/auth/login',
    body: {
      token: 'jwt-secret',
      password: 'plain-secret',
      customer: { id: 'cust-1', user_no: 'U000001' },
    },
  });

  assert.deepEqual(sanitized, {
    status: 200,
    durationMs: 9,
    path: '/api/auth/login',
    customer: { id: 'cust-1', user_no: 'U000001' },
  });
  assert.equal(JSON.stringify(sanitized).includes('jwt-secret'), false);
  assert.equal(JSON.stringify(sanitized).includes('plain-secret'), false);
});

test('parseWranglerResidueCount supports JSON and table output', () => {
  assert.equal(parseWranglerResidueCount('[{"total_residue":0}]'), 0);
  assert.equal(parseWranglerResidueCount('{"results":[{"total_residue":2}]}'), 2);
  assert.equal(parseWranglerResidueCount(`
┌───────────────┐
│ total_residue │
├───────────────┤
│ 0             │
└───────────────┘
`), 0);
});

test('isCliEntry handles unicode workspace paths', () => {
  const scriptPath = join(tmpdir(), 'SAGEMRO AI', '中文 smoke', 'material-items-production-smoke.mjs');
  assert.equal(isCliEntry(pathToFileURL(scriptPath).href, scriptPath), true);
});
