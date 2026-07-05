#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSalt, hashPasswordNew } from '../src/lib/auth.js';

const DEFAULT_FETCH_TIMEOUT_MS = 30000;

function normalizeCliPath(value) {
  const normalized = String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/([A-Za-z]:\/)/, '$1');
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function isCliEntry(importMetaUrl, argvPath) {
  if (!argvPath) return false;
  return normalizeCliPath(fileURLToPath(importMetaUrl)) === normalizeCliPath(argvPath);
}

export function parseMaterialRequestSmokeArgs(argv = []) {
  const args = [...argv];
  const market = args.find((arg) => !arg.startsWith('--')) || 'cn';
  const allowWrite = args.includes('--allow-write');

  if (!['cn', 'com'].includes(market)) {
    throw new Error('Usage: node scripts/material-requests-production-smoke.mjs cn|com --allow-write [--json]');
  }
  if (!allowWrite) {
    throw new Error('material request production smoke requires --allow-write because it creates temporary production rows.');
  }

  return {
    market,
    allowWrite,
    json: args.includes('--json'),
  };
}

export function quoteSql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function readAdminCredentials(market) {
  const suffix = market === 'cn' ? 'CN' : 'COM';
  return {
    phone: process.env[`SAGEMRO_SMOKE_ADMIN_PHONE_${suffix}`] || process.env.SAGEMRO_SMOKE_ADMIN_PHONE,
    password: process.env[`SAGEMRO_SMOKE_ADMIN_PASSWORD_${suffix}`] || process.env.SAGEMRO_SMOKE_ADMIN_PASSWORD,
  };
}

export function buildMaterialRequestSmokeContext({ market, stamp, password } = {}) {
  const selectedMarket = market || 'cn';
  const nowStamp = stamp || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const cfg = selectedMarket === 'cn'
    ? {
        apiBase: 'https://api.sagemro.cn',
        origin: 'https://engineer.sagemro.cn',
        adminOrigin: 'https://admin.sagemro.cn',
        dbName: 'sagemro-db-cn',
        prefixDigit: '6',
        region: '山东济南',
        materialPrice: 186,
        laborFee: 620,
      }
    : {
        apiBase: 'https://api.sagemro.com',
        origin: 'https://engineer.sagemro.com',
        adminOrigin: 'https://admin.sagemro.com',
        dbName: 'sagemro-db',
        prefixDigit: '7',
        region: 'Texas',
        materialPrice: 29,
        laborFee: 190,
      };
  const runId = `SAGEMRO_SMOKE_MATERIAL_REQUEST_${selectedMarket}_${nowStamp}`;
  const phoneSeed = nowStamp.slice(-8);

  return {
    market: selectedMarket,
    stamp: nowStamp,
    runId,
    apiBase: cfg.apiBase,
    origin: cfg.origin,
    adminOrigin: cfg.adminOrigin,
    dbName: cfg.dbName,
    region: cfg.region,
    materialPrice: cfg.materialPrice,
    laborFee: cfg.laborFee,
    customerPhone: `13${cfg.prefixDigit}${phoneSeed}`,
    engineerPhone: `17${cfg.prefixDigit}${phoneSeed}`,
    password: password || `Smoke-${randomBytes(9).toString('hex')}!A1`,
    customerId: `smoke_req_cus_${selectedMarket}_${nowStamp}`,
    engineerId: `smoke_req_eng_${selectedMarket}_${nowStamp}`,
    workOrderId: `smoke_req_wo_${selectedMarket}_${nowStamp}`,
    orderNo: `WO-SMOKE-REQ-${selectedMarket.toUpperCase()}-${nowStamp}`,
    requestedMaterialCode: `${runId}_REQ_PART`,
  };
}

export function buildMaterialRequestCleanupSql(context) {
  const wo = quoteSql(context.workOrderId);
  const eng = quoteSql(context.engineerId);
  const cust = quoteSql(context.customerId);
  const runId = quoteSql(context.runId);
  const matCode = quoteSql(context.requestedMaterialCode);

  return `
DELETE FROM audit_logs WHERE target_id IN (${wo}, ${eng}, ${cust}) OR instr(COALESCE(after_state, ''), ${runId}) > 0 OR instr(COALESCE(before_state, ''), ${runId}) > 0;
DELETE FROM work_order_pricing_history WHERE pricing_id IN (SELECT id FROM work_order_pricing WHERE work_order_id=${wo});
DELETE FROM work_order_material_items WHERE work_order_id=${wo} OR material_code=${matCode} OR material_id IN (SELECT id FROM materials WHERE material_code=${matCode});
DELETE FROM work_order_repair_records WHERE work_order_id=${wo};
DELETE FROM work_order_messages WHERE work_order_id=${wo};
DELETE FROM work_order_logs WHERE work_order_id=${wo};
DELETE FROM work_order_payments WHERE work_order_id=${wo};
DELETE FROM ratings WHERE work_order_id=${wo};
DELETE FROM customer_ratings WHERE work_order_id=${wo};
DELETE FROM engineer_reviews WHERE work_order_id=${wo};
DELETE FROM platform_ratings WHERE customer_id=${cust};
DELETE FROM notifications WHERE instr(COALESCE(data, ''), ${quoteSql(context.workOrderId)}) > 0 OR user_id IN (${cust}, ${eng});
DELETE FROM material_requests WHERE work_order_id=${wo} OR instr(COALESCE(suggested_name, ''), ${runId}) > 0 OR linked_material_id IN (SELECT id FROM materials WHERE material_code=${matCode});
DELETE FROM work_order_pricing WHERE work_order_id=${wo};
DELETE FROM work_order_attachments WHERE work_order_id=${wo};
DELETE FROM work_orders WHERE id=${wo};
DELETE FROM material_inventory_adjustments WHERE material_id IN (SELECT id FROM materials WHERE material_code=${matCode});
DELETE FROM materials WHERE material_code=${matCode};
DELETE FROM devices WHERE customer_id=${cust};
DELETE FROM engineer_calendar_events WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_wallets WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_deposits WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_promotions WHERE engineer_id=${eng};
DELETE FROM engineer_violations WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_withdrawals WHERE engineer_id=${eng};
DELETE FROM push_subscriptions WHERE engineer_id=${eng};
DELETE FROM engineers WHERE id=${eng};
DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE customer_id=${cust} OR engineer_id=${eng} OR instr(id, ${runId}) > 0);
DELETE FROM conversations WHERE customer_id=${cust} OR engineer_id=${eng} OR instr(id, ${runId}) > 0;
DELETE FROM customers WHERE id=${cust};
`;
}

export function buildMaterialRequestResidueSql(context) {
  const wo = quoteSql(context.workOrderId);
  const eng = quoteSql(context.engineerId);
  const cust = quoteSql(context.customerId);
  const runId = quoteSql(context.runId);
  const matCode = quoteSql(context.requestedMaterialCode);

  return `
SELECT
  (SELECT COUNT(*) FROM material_requests WHERE work_order_id=${wo} OR instr(COALESCE(suggested_name, ''), ${runId}) > 0) +
  (SELECT COUNT(*) FROM work_order_material_items WHERE work_order_id=${wo} OR material_code=${matCode}) +
  (SELECT COUNT(*) FROM work_order_repair_records WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_messages WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_logs WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_payments WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_pricing WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_pricing_history WHERE instr(COALESCE(pricing_id, ''), ${runId}) > 0) +
  (SELECT COUNT(*) FROM work_orders WHERE id=${wo}) +
  (SELECT COUNT(*) FROM material_inventory_adjustments WHERE material_id IN (SELECT id FROM materials WHERE material_code=${matCode})) +
  (SELECT COUNT(*) FROM materials WHERE material_code=${matCode}) +
  (SELECT COUNT(*) FROM engineer_calendar_events WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_wallets WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_deposits WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_promotions WHERE engineer_id=${eng}) +
  (SELECT COUNT(*) FROM engineer_violations WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_withdrawals WHERE engineer_id=${eng}) +
  (SELECT COUNT(*) FROM push_subscriptions WHERE engineer_id=${eng}) +
  (SELECT COUNT(*) FROM engineers WHERE id=${eng}) +
  (SELECT COUNT(*) FROM customers WHERE id=${cust}) AS total_residue;
`;
}

export function parseWranglerResidueCount(output) {
  const text = String(output);
  const match = text.match(/"total_residue"\s*:\s*(\d+)/);
  if (match) return Number(match[1]);
  const tableMatch = text.match(/total_residue[\s\S]*?[│|]\s*(\d+)\s*[│|]/);
  if (tableMatch) return Number(tableMatch[1]);
  const plainMatch = text.match(/total_residue[\s\S]*?\n\s*(\d+)\s*(?:\n|$)/);
  return plainMatch ? Number(plainMatch[1]) : null;
}

export function sanitizeMaterialRequestStepResult(result) {
  if (!result || typeof result !== 'object') return result;

  const out = {
    status: result.status,
    durationMs: result.durationMs,
    path: result.path,
  };

  if (Array.isArray(result.body?.list)) out.listCount = result.body.list.length;
  if (result.body?.request) {
    out.request = {
      id: result.body.request.id,
      status: result.body.request.status,
    };
  }
  if (result.body?.material) {
    out.material = {
      id: result.body.material.id,
      material_code: result.body.material.material_code,
    };
  }
  if (result.body?.item) {
    out.item = {
      id: result.body.item.id,
      material_code: result.body.item.material_code,
      purpose: result.body.item.purpose,
      line_total: result.body.item.line_total,
    };
  }
  if (result.body?.pricing) {
    out.pricing = {
      status: result.body.pricing.status,
      materialItems: result.body.pricing.material_items?.length || 0,
    };
  }
  if (result.body?.customer) out.customer = { id: result.body.customer.id, user_no: result.body.customer.user_no };
  if (result.body?.engineer) out.engineer = { id: result.body.engineer.id, user_no: result.body.engineer.user_no };
  if (result.body?.residue !== undefined) out.residue = result.body.residue;

  return out;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function buildWranglerD1Args({ context, sql, mode = 'file', file } = {}) {
  const args = ['wrangler', 'd1', 'execute', context.dbName, '--env', 'production', '--remote'];
  if (mode === 'command') return [...args, '--command', sql];
  return [...args, '--file', file];
}

export function buildNpxWranglerD1Args(options) {
  return buildWranglerD1Args(options);
}

function runWranglerSql({ context, sql, label, workerDir, tempDir }) {
  const file = join(tempDir, `${label}.sql`);
  writeFileSync(file, sql);
  const args = buildNpxWranglerD1Args({ context, mode: 'file', file });
  return execFileSync('npx', args, {
    cwd: workerDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runWranglerCommandSql({ context, sql, workerDir }) {
  const args = buildNpxWranglerD1Args({ context, sql, mode: 'command' });
  return execFileSync('npx', args, {
    cwd: workerDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return {
      status: response.status,
      ok: response.ok,
      body,
      durationMs: Date.now() - started,
      path: new URL(url).pathname,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function api(context, path, init = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: init.admin ? context.adminOrigin : context.origin,
    ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    ...(init.headers || {}),
  };
  const { token, admin, ...rest } = init;
  return fetchWithTimeout(`${context.apiBase}${path}`, { ...rest, headers });
}

async function buildSeedSql(context) {
  const engineerSalt = generateSalt();
  const engineerHash = await hashPasswordNew(context.password, engineerSalt);
  const customerSalt = generateSalt();
  const customerHash = await hashPasswordNew(context.password, customerSalt);

  return `
INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region, company, auth_status)
VALUES (${quoteSql(context.customerId)}, ${quoteSql(`U${context.stamp.slice(-6)}`)}, ${quoteSql(`${context.runId}_CUSTOMER`)}, ${quoteSql(context.customerPhone)}, ${quoteSql(customerHash)}, ${quoteSql(customerSalt)}, ${quoteSql(context.region)}, ${quoteSql(`${context.runId}_COMPANY`)}, 'authenticated');

INSERT INTO engineers (id, user_no, name, phone, password_hash, salt, specialties, brands, services, service_region, bio, level, commission_rate, credit_score, wallet_balance, deposit_balance, company, auth_status, status, engineer_role, cooperation_status, certification_status, first_login_password_reset_required)
VALUES (${quoteSql(context.engineerId)}, ${quoteSql(`E${context.stamp.slice(-6)}`)}, ${quoteSql(`${context.runId}_ENGINEER`)}, ${quoteSql(context.engineerPhone)}, ${quoteSql(engineerHash)}, ${quoteSql(engineerSalt)}, ${quoteSql(JSON.stringify(['laser_cutting']))}, ${quoteSql(JSON.stringify({ laser: ['Euchio'] }))}, ${quoteSql(JSON.stringify(['field_service']))}, ${quoteSql(context.region)}, ${quoteSql(`${context.runId} engineer seed`)}, 'junior', 0.8, 100, 0, 0, ${quoteSql(`${context.runId}_SERVICE`)}, 'authenticated', 'available', 'engineer', 'confirmed', 'certified', 0);

INSERT INTO work_orders (id, order_no, customer_id, engineer_id, type, description, urgency, status, category_l1, category_l2, quote_review_status, assigned_at, started_at)
VALUES (${quoteSql(context.workOrderId)}, ${quoteSql(context.orderNo)}, ${quoteSql(context.customerId)}, ${quoteSql(context.engineerId)}, 'fault', ${quoteSql(`${context.runId}: material request production smoke work order`)}, 'normal', 'in_progress', 'laser_cutting', 'laser_source', 'not_required', datetime('now'), datetime('now'));
`;
}

async function step(report, name, fn) {
  const item = { name, ok: false, startedAt: new Date().toISOString() };
  try {
    const result = await fn();
    item.ok = true;
    item.result = sanitizeMaterialRequestStepResult(result);
    return result;
  } catch (error) {
    item.error = error?.message || String(error);
    throw error;
  } finally {
    item.finishedAt = new Date().toISOString();
    report.steps.push(item);
  }
}

async function runMaterialRequestSmoke({ context, workerDir, reportPath }) {
  const tempDir = mkdtempSync(join(tmpdir(), 'sagemro-material-request-smoke-'));
  const report = {
    market: context.market,
    runId: context.runId,
    apiBase: context.apiBase,
    startedAt: new Date().toISOString(),
    steps: [],
    ids: {
      customerPhone: context.customerPhone,
      engineerPhone: context.engineerPhone,
      workOrderId: context.workOrderId,
      orderNo: context.orderNo,
      requestedMaterialCode: context.requestedMaterialCode,
    },
    cleanup: [],
    passed: false,
  };

  try {
    const admin = readAdminCredentials(context.market);
    assert(admin.phone && admin.password, `Missing SAGEMRO_SMOKE_ADMIN_PHONE${context.market === 'cn' ? '_CN' : '_COM'} / SAGEMRO_SMOKE_ADMIN_PASSWORD${context.market === 'cn' ? '_CN' : '_COM'} or common SAGEMRO_SMOKE_ADMIN_* env vars.`);

    await step(report, 'seed customer engineer work order', async () => {
      runWranglerSql({ context, sql: await buildSeedSql(context), label: 'seed', workerDir, tempDir });
      return { status: 0, durationMs: 0, path: 'wrangler d1 execute seed' };
    });

    const customerLogin = await step(report, 'customer login', async () => {
      const res = await api(context, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: context.customerPhone, password: context.password }),
      });
      assert(res.ok && res.body?.token, `customer login failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      return res;
    });
    const customerToken = customerLogin.body.token;

    const engineerLogin = await step(report, 'engineer login', async () => {
      const res = await api(context, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: context.engineerPhone, password: context.password }),
      });
      assert(res.ok && res.body?.token, `engineer login failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      return res;
    });
    const engineerToken = engineerLogin.body.token;

    const adminLogin = await step(report, 'admin login', async () => {
      const res = await api(context, '/api/admin/login', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ phone: admin.phone, password: admin.password }),
      });
      assert(res.ok && res.body?.token, `admin login failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      return res;
    });
    const adminToken = adminLogin.body.token;

    const materialRequest = await step(report, 'engineer creates material request', async () => {
      const res = await api(context, '/api/material-requests', {
        method: 'POST',
        token: engineerToken,
        body: JSON.stringify({
          work_order_id: context.workOrderId,
          suggested_name: `${context.runId} requested protective lens`,
          suggested_name_en: `${context.runId} requested protective lens`,
          category: 'laser_cutting',
          spec: 'D30 F5.0 request smoke',
          brand: 'SAGEMRO_SMOKE',
          compatible_equipment: 'fiber laser cutting machine',
          supplier_suggestion: 'SAGEMRO_SMOKE_TEST_SUPPLIER',
          expected_quantity: 2,
          unit: 'pcs',
          usage_note: `${context.runId} request smoke usage`,
          urgency: 'normal',
        }),
      });
      assert(res.status === 201 && res.body?.request?.id, `create material request failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      report.ids.materialRequestId = res.body.request.id;
      return res;
    });

    await step(report, 'admin lists submitted material request', async () => {
      const res = await api(context, '/api/admin/material-requests?status=submitted&pageSize=20', {
        method: 'GET',
        token: adminToken,
        admin: true,
      });
      assert(res.ok, `admin list requests failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      assert((res.body?.list || []).some((item) => item.id === materialRequest.body.request.id), 'submitted material request missing from admin list');
      return res;
    });

    const reviewed = await step(report, 'admin approves request into material master', async () => {
      const res = await api(context, `/api/admin/material-requests/${materialRequest.body.request.id}`, {
        method: 'PATCH',
        token: adminToken,
        admin: true,
        body: JSON.stringify({
          action: 'approve_create',
          review_notes: `${context.runId} approved by production smoke`,
          material: {
            material_code: context.requestedMaterialCode,
            category: 'laser_cutting',
            name: `${context.runId} requested protective lens`,
            name_en: `${context.runId} requested protective lens`,
            spec: 'D30 F5.0 request smoke',
            brand: 'SAGEMRO_SMOKE',
            compatible_equipment: 'fiber laser cutting machine',
            supplier: 'SAGEMRO_SMOKE_TEST_SUPPLIER',
            unit: 'pcs',
            reference_cost: 12,
            reference_price: context.materialPrice,
            stock_quantity: 2,
            safety_stock: 1,
            status: 'active',
            notes: `${context.runId} material created by request smoke`,
          },
        }),
      });
      assert(res.ok && res.body?.request?.status === 'approved', `approve material request failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      assert(res.body?.material?.material_code === context.requestedMaterialCode, 'approved material code mismatch');
      report.ids.materialId = res.body.material.id;
      return res;
    });
    const materialId = reviewed.body.material.id;

    await step(report, 'engineer searches approved material safely', async () => {
      const res = await api(context, `/api/materials?search=${encodeURIComponent(context.requestedMaterialCode)}`, {
        method: 'GET',
        token: engineerToken,
      });
      assert(res.ok, `search approved material failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const found = (res.body?.list || []).find((item) => item.id === materialId);
      assert(found, 'approved material missing from engineer search');
      const payload = JSON.stringify(found);
      for (const forbidden of ['SAGEMRO_SMOKE_TEST_SUPPLIER', 'reference_cost', 'stock_quantity']) {
        assert(!payload.includes(forbidden), `${forbidden} leaked in engineer material search`);
      }
      return res;
    });

    await step(report, 'engineer adds approved material to quote', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/material-items`, {
        method: 'POST',
        token: engineerToken,
        body: JSON.stringify({
          material_id: materialId,
          purpose: 'quote',
          quantity: 2,
          unit_price: context.materialPrice,
          note: `${context.runId} quote item from approved request`,
        }),
      });
      assert(res.status === 201 && res.body?.item?.material_code === context.requestedMaterialCode, `add requested material item failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      return res;
    });

    await step(report, 'engineer submits pricing with approved requested material', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/pricing`, {
        method: 'POST',
        token: engineerToken,
        body: JSON.stringify({
          labor_fee: context.laborFee,
          travel_fee: 0,
          other_fee: 0,
          material_items: [{
            material_id: materialId,
            purpose: 'quote',
            quantity: 1,
            unit_price: context.materialPrice,
            note: `${context.runId} pricing item from material request`,
          }],
        }),
      });
      assert(res.ok, `submit pricing failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      return res;
    });

    await step(report, 'mark smoke pricing visible after operations review', async () => {
      runWranglerSql({
        context,
        sql: `
UPDATE work_order_pricing SET status='submitted' WHERE work_order_id=${quoteSql(context.workOrderId)};
UPDATE work_orders SET quote_review_status='approved', status='pricing' WHERE id=${quoteSql(context.workOrderId)};
`,
        label: 'approve-pricing',
        workerDir,
        tempDir,
      });
      return { status: 0, durationMs: 0, path: 'wrangler d1 execute approve-pricing' };
    });

    await step(report, 'customer reads structured quote material safely', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/pricing`, {
        method: 'GET',
        token: customerToken,
      });
      assert(res.ok, `customer pricing failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const items = res.body?.material_items || res.body?.pricing?.material_items || [];
      assert(Array.isArray(items) && items.some((item) => item.material_code === context.requestedMaterialCode), 'requested material missing from customer pricing payload');
      const payload = JSON.stringify(items);
      for (const forbidden of ['SAGEMRO_SMOKE_TEST_SUPPLIER', 'reference_cost', 'stock_quantity', 'safety_stock', 'supplier']) {
        assert(!payload.includes(forbidden), `${forbidden} leaked in customer pricing payload`);
      }
      return res;
    });

    report.passed = true;
  } catch (error) {
    report.error = error?.message || String(error);
  } finally {
    try {
      runWranglerSql({ context, sql: buildMaterialRequestCleanupSql(context), label: 'cleanup', workerDir, tempDir });
      report.cleanup.push({ ok: true, action: 'cleanup applied' });
    } catch (error) {
      report.cleanup.push({ ok: false, action: 'cleanup failed', error: error?.message || String(error) });
    }

    try {
      const output = runWranglerCommandSql({ context, sql: buildMaterialRequestResidueSql(context), workerDir });
      const totalResidue = parseWranglerResidueCount(output);
      report.cleanup.push({ ok: totalResidue === 0, action: 'residue checked', totalResidue });
      if (totalResidue !== 0) report.passed = false;
    } catch (error) {
      report.cleanup.push({ ok: false, action: 'residue check failed', error: error?.message || String(error) });
      report.passed = false;
    }

    report.finishedAt = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  return report;
}

async function main() {
  const opts = parseMaterialRequestSmokeArgs(process.argv.slice(2));
  const context = buildMaterialRequestSmokeContext({ market: opts.market });
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const workerDir = resolve(scriptDir, '..');
  const reportPath = resolve(workerDir, `../.Codex/memory/material-request-write-smoke-${context.market}-${context.stamp}.json`);
  const report = await runMaterialRequestSmoke({ context, workerDir, reportPath });
  const summary = {
    passed: report.passed,
    market: report.market,
    runId: report.runId,
    reportPath,
    failedStep: report.steps.find((item) => !item.ok)?.name || null,
    error: report.error || null,
    cleanup: report.cleanup,
  };

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`SAGEMRO material request production smoke: ${summary.passed ? 'PASS' : 'FAIL'}`);
    console.log(`Market: ${summary.market}`);
    console.log(`Run ID: ${summary.runId}`);
    console.log(`Report: ${summary.reportPath}`);
    if (summary.failedStep) console.log(`Failed step: ${summary.failedStep}`);
    if (summary.error) console.log(`Error: ${summary.error}`);
    for (const item of summary.cleanup) {
      console.log(`Cleanup ${item.ok ? 'PASS' : 'FAIL'}: ${item.action}${item.totalResidue !== undefined ? ` (${item.totalResidue})` : ''}`);
    }
  }

  if (!report.passed) process.exitCode = 1;
}

if (isCliEntry(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
