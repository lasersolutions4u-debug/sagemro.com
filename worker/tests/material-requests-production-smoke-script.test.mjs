import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildMaterialRequestSmokeContext,
  buildMaterialRequestCleanupSql,
  buildMaterialRequestResidueSql,
  buildWranglerD1Args,
  buildNpxWranglerD1Args,
  isCliEntry,
  parseWranglerResidueCount,
  parseMaterialRequestSmokeArgs,
  sanitizeMaterialRequestStepResult,
} from '../scripts/material-requests-production-smoke.mjs';

test('material request production smoke requires explicit write confirmation', () => {
  assert.throws(
    () => parseMaterialRequestSmokeArgs(['cn']),
    /requires --allow-write/,
  );

  assert.deepEqual(parseMaterialRequestSmokeArgs(['cn', '--allow-write']), {
    market: 'cn',
    allowWrite: true,
    json: false,
  });
});

test('material request production smoke validates market argument', () => {
  assert.throws(
    () => parseMaterialRequestSmokeArgs(['eu', '--allow-write']),
    /cn\|com/,
  );
});

test('material request smoke context uses SAGEMRO_SMOKE scoped ids', () => {
  const cn = buildMaterialRequestSmokeContext({ market: 'cn', stamp: '20260704190506', password: 'not-secret' });
  const com = buildMaterialRequestSmokeContext({ market: 'com', stamp: '20260704190506', password: 'not-secret' });

  assert.equal(cn.runId, 'SAGEMRO_SMOKE_MATERIAL_REQUEST_cn_20260704190506');
  assert.equal(cn.apiBase, 'https://api.sagemro.cn');
  assert.equal(cn.dbName, 'sagemro-db-cn');
  assert.equal(cn.requestedMaterialCode, 'SAGEMRO_SMOKE_MATERIAL_REQUEST_cn_20260704190506_REQ_PART');

  assert.equal(com.runId, 'SAGEMRO_SMOKE_MATERIAL_REQUEST_com_20260704190506');
  assert.equal(com.apiBase, 'https://api.sagemro.com');
  assert.equal(com.dbName, 'sagemro-db');
  assert.equal(com.requestedMaterialCode, 'SAGEMRO_SMOKE_MATERIAL_REQUEST_com_20260704190506_REQ_PART');
});

test('material request cleanup covers request, material, work order, and users', () => {
  const context = buildMaterialRequestSmokeContext({ market: 'cn', stamp: '20260704190506', password: 'not-secret' });
  const cleanupSql = buildMaterialRequestCleanupSql(context);
  const residueSql = buildMaterialRequestResidueSql(context);

  assert.match(cleanupSql, /DELETE FROM material_requests/);
  assert.match(cleanupSql, /DELETE FROM materials/);
  assert.match(cleanupSql, /DELETE FROM work_orders/);
  assert.match(cleanupSql, /DELETE FROM customers/);
  assert.match(cleanupSql, /DELETE FROM engineers/);
  assert.ok(cleanupSql.indexOf('DELETE FROM work_order_material_items') < cleanupSql.indexOf('DELETE FROM materials'));
  assert.ok(cleanupSql.indexOf('DELETE FROM work_orders') < cleanupSql.indexOf('DELETE FROM customers'));

  assert.match(residueSql, /material_requests/);
  assert.match(residueSql, /total_residue/);
  assert.match(residueSql, /SAGEMRO_SMOKE_MATERIAL_REQUEST_cn_20260704190506/);
});

test('material request smoke report sanitization excludes secrets', () => {
  const sanitized = sanitizeMaterialRequestStepResult({
    status: 200,
    durationMs: 9,
    path: '/api/admin/login',
    body: {
      token: 'admin-jwt-secret',
      password: 'plain-secret',
      request: { id: 'req-1', status: 'submitted' },
      material: { id: 'mat-1', material_code: 'REQ-PART' },
    },
  });

  assert.deepEqual(sanitized, {
    status: 200,
    durationMs: 9,
    path: '/api/admin/login',
    request: { id: 'req-1', status: 'submitted' },
    material: { id: 'mat-1', material_code: 'REQ-PART' },
  });
  assert.equal(JSON.stringify(sanitized).includes('admin-jwt-secret'), false);
  assert.equal(JSON.stringify(sanitized).includes('plain-secret'), false);
});

test('material request residue uses wrangler command mode so SELECT results are returned', () => {
  const context = buildMaterialRequestSmokeContext({ market: 'com', stamp: '20260704190506', password: 'not-secret' });
  const args = buildWranglerD1Args({ context, sql: buildMaterialRequestResidueSql(context), mode: 'command' });

  assert.deepEqual(args.slice(0, 7), ['wrangler', 'd1', 'execute', 'sagemro-db', '--env', 'production', '--remote']);
  assert.equal(args[7], '--command');
  assert.match(args[8], /total_residue/);
  assert.equal(args.includes('--file'), false);
});

test('material request smoke passes wrangler, not d1, as the npx executable target', () => {
  const context = buildMaterialRequestSmokeContext({ market: 'com', stamp: '20260704190506', password: 'not-secret' });
  const args = buildNpxWranglerD1Args({
    context,
    sql: buildMaterialRequestResidueSql(context),
    mode: 'command',
  });

  assert.equal(args[0], 'wrangler');
  assert.equal(args[1], 'd1');
  assert.equal(args[2], 'execute');
  assert.notEqual(args[0], 'd1');
});

test('material request residue parser treats wrangler import summary as unknown', () => {
  const importSummary = `[
    {
      "results": [
        {
          "Total queries executed": 1,
          "Rows read": 3,
          "Rows written": 0
        }
      ],
      "success": true
    }
  ]`;

  assert.equal(parseWranglerResidueCount(importSummary), null);
});

test('material request residue parser reads command query output', () => {
  const commandOutput = `[
    {
      "results": [
        {
          "total_residue": 0
        }
      ],
      "success": true
    }
  ]`;

  assert.equal(parseWranglerResidueCount(commandOutput), 0);
});

test('material request smoke isCliEntry handles unicode workspace paths', () => {
  const scriptPath = join(tmpdir(), 'SAGEMRO AI', '中文 smoke', 'material-requests-production-smoke.mjs');
  assert.equal(isCliEntry(pathToFileURL(scriptPath).href, scriptPath), true);
});
