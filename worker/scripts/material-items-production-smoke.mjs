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

export function parseMaterialSmokeArgs(argv = []) {
  const args = [...argv];
  const market = args.find((arg) => !arg.startsWith('--')) || 'cn';
  const allowWrite = args.includes('--allow-write');

  if (!['cn', 'com'].includes(market)) {
    throw new Error('Usage: node scripts/material-items-production-smoke.mjs cn|com --allow-write [--json]');
  }
  if (!allowWrite) {
    throw new Error('material items production smoke requires --allow-write because it creates temporary production rows.');
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

export function buildSmokeContext({ market, stamp, password } = {}) {
  const selectedMarket = market || 'cn';
  const nowStamp = stamp || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const cfg = selectedMarket === 'cn'
    ? {
        apiBase: 'https://api.sagemro.cn',
        origin: 'https://sagemro.cn',
        dbName: 'sagemro-db-cn',
        prefixDigit: '6',
        region: '山东济南',
        materialPrice: 180,
        laborFee: 600,
        travelFee: 120,
      }
    : {
        apiBase: 'https://api.sagemro.com',
        origin: 'https://sagemro.com',
        dbName: 'sagemro-db',
        prefixDigit: '7',
        region: 'Texas',
        materialPrice: 28,
        laborFee: 180,
        travelFee: 60,
      };
  const runId = `SAGEMRO_SMOKE_MATERIAL_${selectedMarket}_${nowStamp}`;
  const phoneSeed = nowStamp.slice(-8);

  return {
    market: selectedMarket,
    stamp: nowStamp,
    runId,
    apiBase: cfg.apiBase,
    origin: cfg.origin,
    dbName: cfg.dbName,
    region: cfg.region,
    materialPrice: cfg.materialPrice,
    laborFee: cfg.laborFee,
    travelFee: cfg.travelFee,
    customerPhone: `13${cfg.prefixDigit}${phoneSeed}`,
    engineerPhone: `17${cfg.prefixDigit}${phoneSeed}`,
    password: password || `Smoke-${randomBytes(9).toString('hex')}!A1`,
    customerId: `smoke_cus_${selectedMarket}_${nowStamp}`,
    engineerId: `smoke_eng_${selectedMarket}_${nowStamp}`,
    workOrderId: `smoke_wo_${selectedMarket}_${nowStamp}`,
    materialId: `smoke_mat_${selectedMarket}_${nowStamp}`,
    orderNo: `WO-SMOKE-${selectedMarket.toUpperCase()}-${nowStamp}`,
    materialCode: `${runId}_LENS`,
  };
}

export function buildCleanupSql(context) {
  const wo = quoteSql(context.workOrderId);
  const mat = quoteSql(context.materialId);
  const eng = quoteSql(context.engineerId);
  const cust = quoteSql(context.customerId);
  const runId = quoteSql(context.runId);

  return `
DELETE FROM audit_logs WHERE target_id IN (${wo}, ${mat}, ${eng}, ${cust}) OR after_state LIKE '%' || ${runId} || '%' OR before_state LIKE '%' || ${runId} || '%';
DELETE FROM work_order_pricing_history WHERE pricing_id IN (SELECT id FROM work_order_pricing WHERE work_order_id=${wo});
DELETE FROM work_order_material_items WHERE work_order_id=${wo} OR material_id=${mat};
DELETE FROM work_order_repair_records WHERE work_order_id=${wo};
DELETE FROM work_order_messages WHERE work_order_id=${wo};
DELETE FROM work_order_logs WHERE work_order_id=${wo};
DELETE FROM work_order_payments WHERE work_order_id=${wo};
DELETE FROM ratings WHERE work_order_id=${wo};
DELETE FROM customer_ratings WHERE work_order_id=${wo};
DELETE FROM engineer_reviews WHERE work_order_id=${wo};
DELETE FROM platform_ratings WHERE customer_id=${cust};
DELETE FROM notifications WHERE data LIKE '%' || ${quoteSql(context.workOrderId)} || '%' OR user_id IN (${cust}, ${eng});
DELETE FROM work_order_pricing WHERE work_order_id=${wo};
DELETE FROM work_order_attachments WHERE work_order_id=${wo};
DELETE FROM work_orders WHERE id=${wo};
DELETE FROM material_inventory_adjustments WHERE material_id=${mat};
DELETE FROM materials WHERE id=${mat};
DELETE FROM devices WHERE customer_id=${cust};
DELETE FROM engineer_calendar_events WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_wallets WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_deposits WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_promotions WHERE engineer_id=${eng};
DELETE FROM engineer_violations WHERE engineer_id=${eng} OR work_order_id=${wo};
DELETE FROM engineer_withdrawals WHERE engineer_id=${eng};
DELETE FROM push_subscriptions WHERE engineer_id=${eng};
DELETE FROM account_identities WHERE owner_type='engineer' AND owner_id=${eng};
DELETE FROM engineers WHERE id=${eng};
DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE customer_id=${cust} OR engineer_id=${eng} OR id LIKE '%' || ${runId} || '%');
DELETE FROM conversations WHERE customer_id=${cust} OR engineer_id=${eng} OR id LIKE '%' || ${runId} || '%';
DELETE FROM account_identities WHERE owner_type='customer' AND owner_id=${cust};
DELETE FROM customers WHERE id=${cust};
`;
}

export function buildResidueSql(context) {
  const wo = quoteSql(context.workOrderId);
  const mat = quoteSql(context.materialId);
  const eng = quoteSql(context.engineerId);
  const cust = quoteSql(context.customerId);
  const runId = quoteSql(context.runId);

  return `
SELECT
  (SELECT COUNT(*) FROM work_order_material_items WHERE work_order_id=${wo} OR material_id=${mat}) +
  (SELECT COUNT(*) FROM work_order_repair_records WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_messages WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_logs WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_payments WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_pricing WHERE work_order_id=${wo}) +
  (SELECT COUNT(*) FROM work_order_pricing_history WHERE pricing_id LIKE '%' || ${runId} || '%') +
  (SELECT COUNT(*) FROM work_orders WHERE id=${wo}) +
  (SELECT COUNT(*) FROM material_inventory_adjustments WHERE material_id=${mat}) +
  (SELECT COUNT(*) FROM materials WHERE id=${mat}) +
  (SELECT COUNT(*) FROM engineer_calendar_events WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_wallets WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_deposits WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_promotions WHERE engineer_id=${eng}) +
  (SELECT COUNT(*) FROM engineer_violations WHERE engineer_id=${eng} OR work_order_id=${wo}) +
  (SELECT COUNT(*) FROM engineer_withdrawals WHERE engineer_id=${eng}) +
  (SELECT COUNT(*) FROM push_subscriptions WHERE engineer_id=${eng}) +
  (SELECT COUNT(*) FROM account_identities WHERE (owner_type='engineer' AND owner_id=${eng}) OR (owner_type='customer' AND owner_id=${cust})) +
  (SELECT COUNT(*) FROM engineers WHERE id=${eng}) +
  (SELECT COUNT(*) FROM customers WHERE id=${cust}) AS total_residue;
`;
}

export function sanitizeStepResult(result) {
  if (!result || typeof result !== 'object') return result;

  const out = {
    status: result.status,
    durationMs: result.durationMs,
    path: result.path,
  };

  if (Array.isArray(result.body?.list)) out.listCount = result.body.list.length;
  if (result.body?.item) {
    out.item = {
      id: result.body.item.id,
      purpose: result.body.item.purpose,
      material_code: result.body.item.material_code,
      line_total: result.body.item.line_total,
      status: result.body.item.status,
    };
  }
  if (result.body?.pricing) {
    out.pricing = {
      status: result.body.pricing.status,
      materialItems: result.body.pricing.material_items?.length || 0,
    };
  }
  if (result.body?.repair_record) {
    out.repairRecord = {
      materialItems: result.body.repair_record.material_items?.length || 0,
    };
  }
  if (result.body?.customer) {
    out.customer = {
      id: result.body.customer.id,
      user_no: result.body.customer.user_no,
    };
  }
  if (result.body?.engineer) {
    out.engineer = {
      id: result.body.engineer.id,
      user_no: result.body.engineer.user_no,
    };
  }
  if (result.body?.residue !== undefined) out.residue = result.body.residue;

  return out;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runWranglerSql({ context, sql, label, workerDir, tempDir }) {
  const file = join(tempDir, `${label}.sql`);
  writeFileSync(file, sql);
  return execFileSync('npx', ['wrangler', 'd1', 'execute', context.dbName, '--env', 'production', '--remote', '--file', file], {
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
    Origin: context.origin,
    ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    ...(init.headers || {}),
  };
  return fetchWithTimeout(`${context.apiBase}${path}`, { ...init, headers });
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

async function step(report, name, fn) {
  const item = { name, ok: false, startedAt: new Date().toISOString() };
  try {
    const result = await fn();
    item.ok = true;
    item.result = sanitizeStepResult(result);
    return result;
  } catch (error) {
    item.error = error?.message || String(error);
    throw error;
  } finally {
    item.finishedAt = new Date().toISOString();
    report.steps.push(item);
  }
}

async function buildSeedSql(context) {
  const engineerSalt = generateSalt();
  const engineerHash = await hashPasswordNew(context.password, engineerSalt);
  const customerSalt = generateSalt();
  const customerHash = await hashPasswordNew(context.password, customerSalt);

  return `
INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region, company, auth_status)
VALUES (${quoteSql(context.customerId)}, ${quoteSql(`U${context.stamp.slice(-6)}`)}, ${quoteSql(`${context.runId}_CUSTOMER`)}, ${quoteSql(context.customerPhone)}, ${quoteSql(customerHash)}, ${quoteSql(customerSalt)}, ${quoteSql(context.region)}, ${quoteSql(`${context.runId}_COMPANY`)}, 'authenticated');

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
VALUES ('phone', ${quoteSql(context.customerPhone)}, 'customer', ${quoteSql(context.customerId)});

INSERT INTO engineers (id, user_no, name, phone, password_hash, salt, specialties, brands, services, service_region, bio, level, commission_rate, credit_score, wallet_balance, deposit_balance, company, auth_status, status, engineer_role, cooperation_status, certification_status, first_login_password_reset_required)
VALUES (${quoteSql(context.engineerId)}, ${quoteSql(`E${context.stamp.slice(-6)}`)}, ${quoteSql(`${context.runId}_ENGINEER`)}, ${quoteSql(context.engineerPhone)}, ${quoteSql(engineerHash)}, ${quoteSql(engineerSalt)}, ${quoteSql(JSON.stringify(['laser_cutting']))}, ${quoteSql(JSON.stringify({ laser: ['Euchio'] }))}, ${quoteSql(JSON.stringify(['field_service']))}, ${quoteSql(context.region)}, ${quoteSql(`${context.runId} engineer seed`)}, 'junior', 0.8, 100, 0, 0, ${quoteSql(`${context.runId}_SERVICE`)}, 'authenticated', 'available', 'engineer', 'confirmed', 'certified', 0);

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
VALUES ('phone', ${quoteSql(context.engineerPhone)}, 'engineer', ${quoteSql(context.engineerId)});

INSERT INTO materials (id, market, material_code, category, name, name_en, spec, brand, compatible_equipment, supplier, production_code, unit, reference_cost, reference_price, stock_quantity, safety_stock, status, notes)
VALUES (${quoteSql(context.materialId)}, ${quoteSql(context.market)}, ${quoteSql(context.materialCode)}, 'laser_cutting', ${quoteSql(context.market === 'cn' ? '生产测试保护镜片' : 'Production smoke protective lens')}, 'Production smoke protective lens', 'D30 F5.0 smoke', 'SAGEMRO_SMOKE', 'fiber laser cutting machine', 'SAGEMRO_SMOKE_TEST_SUPPLIER', ${quoteSql(`${context.runId}_BATCH`)}, 'pcs', 12, ${context.materialPrice}, 3, 1, 'active', ${quoteSql(`${context.runId} material seed`)});

INSERT INTO work_orders (id, order_no, customer_id, engineer_id, type, description, urgency, status, category_l1, category_l2, quote_review_status, assigned_at, started_at)
VALUES (${quoteSql(context.workOrderId)}, ${quoteSql(context.orderNo)}, ${quoteSql(context.customerId)}, ${quoteSql(context.engineerId)}, 'fault', ${quoteSql(`${context.runId}: material item production smoke work order`)}, 'normal', 'in_progress', 'laser_cutting', 'laser_source', 'not_required', datetime('now'), datetime('now'));
`;
}

async function runMaterialSmoke({ context, workerDir, reportPath }) {
  const tempDir = mkdtempSync(join(tmpdir(), 'sagemro-material-smoke-'));
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
      materialId: context.materialId,
      materialCode: context.materialCode,
      orderNo: context.orderNo,
    },
    cleanup: [],
    passed: false,
  };

  try {
    await step(report, 'seed customer engineer material work order', async () => {
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

    await step(report, 'engineer searches material safely', async () => {
      const res = await api(context, `/api/materials?search=${encodeURIComponent(context.materialCode)}`, {
        method: 'GET',
        token: engineerToken,
      });
      assert(res.ok, `material search failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const found = (res.body?.list || []).find((item) => item.id === context.materialId);
      assert(found, 'seed material missing from search');
      const payload = JSON.stringify(found);
      for (const forbidden of ['SAGEMRO_SMOKE_TEST_SUPPLIER', 'reference_cost', 'stock_quantity']) {
        assert(!payload.includes(forbidden), `${forbidden} leaked in material search`);
      }
      return res;
    });

    const quoteItem = await step(report, 'engineer adds quote material item', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/material-items`, {
        method: 'POST',
        token: engineerToken,
        body: JSON.stringify({
          material_id: context.materialId,
          purpose: 'quote',
          quantity: 2,
          unit_price: context.materialPrice,
          note: `${context.runId} quote item`,
        }),
      });
      assert(res.status === 201 && res.body?.item?.id, `add quote item failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      report.ids.quoteItemId = res.body.item.id;
      return res;
    });

    await step(report, 'customer reads safe quote material item', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/material-items?purpose=quote`, {
        method: 'GET',
        token: customerToken,
      });
      assert(res.ok, `customer read item failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const found = (res.body?.list || []).find((item) => item.id === quoteItem.body.item.id);
      assert(found, 'quote item missing for customer');
      const payload = JSON.stringify(found);
      for (const forbidden of ['SAGEMRO_SMOKE_TEST_SUPPLIER', 'reference_cost', 'stock_quantity', 'safety_stock', 'supplier']) {
        assert(!payload.includes(forbidden), `${forbidden} leaked to customer`);
      }
      return res;
    });

    await step(report, 'engineer submits pricing with structured material item', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/pricing`, {
        method: 'POST',
        token: engineerToken,
        body: JSON.stringify({
          labor_fee: context.laborFee,
          travel_fee: context.travelFee,
          other_fee: 0,
          material_items: [{
            material_id: context.materialId,
            purpose: 'quote',
            quantity: 1,
            unit_price: context.materialPrice,
            note: `${context.runId} pricing structured item`,
          }],
        }),
      });
      assert(res.ok, `submit pricing failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      return res;
    });

    await step(report, 'mark smoke pricing visible after review', async () => {
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

    await step(report, 'customer pricing payload includes structured materials safely', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/pricing`, {
        method: 'GET',
        token: customerToken,
      });
      assert(res.ok, `customer pricing failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const items = res.body?.material_items || res.body?.pricing?.material_items || [];
      assert(Array.isArray(items) && items.some((item) => item.material_code === context.materialCode), 'structured material missing from pricing payload');
      const payload = JSON.stringify(items);
      for (const forbidden of ['SAGEMRO_SMOKE_TEST_SUPPLIER', 'reference_cost', 'stock_quantity', 'safety_stock', 'supplier']) {
        assert(!payload.includes(forbidden), `${forbidden} leaked in pricing payload`);
      }
      return res;
    });

    await step(report, 'engineer saves repair record with service-report material', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/repair-record`, {
        method: 'POST',
        token: engineerToken,
        body: JSON.stringify({
          symptom: `${context.runId} symptom`,
          diagnosis: `${context.runId} diagnosis`,
          solution: `${context.runId} solution`,
          parts_used: [{ name: 'smoke lens', qty: 1 }],
          labor_hours: 1.5,
          material_items: [{
            material_id: context.materialId,
            purpose: 'service_report',
            quantity: 1,
            unit_price: context.materialPrice,
            note: `${context.runId} service report item`,
          }],
        }),
      });
      assert(res.ok, `save repair record failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      return res;
    });

    await step(report, 'customer repair record includes service-report material safely', async () => {
      const res = await api(context, `/api/workorders/${context.workOrderId}/repair-record`, {
        method: 'GET',
        token: customerToken,
      });
      assert(res.ok, `customer repair record failed HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const items = res.body?.material_items || res.body?.repair_record?.material_items || [];
      assert(Array.isArray(items) && items.some((item) => item.material_code === context.materialCode), 'service report material missing');
      const payload = JSON.stringify(items);
      for (const forbidden of ['SAGEMRO_SMOKE_TEST_SUPPLIER', 'reference_cost', 'stock_quantity', 'safety_stock', 'supplier']) {
        assert(!payload.includes(forbidden), `${forbidden} leaked in repair record payload`);
      }
      return res;
    });

    report.passed = true;
  } catch (error) {
    report.error = error?.message || String(error);
  } finally {
    try {
      runWranglerSql({ context, sql: buildCleanupSql(context), label: 'cleanup', workerDir, tempDir });
      report.cleanup.push({ ok: true, action: 'cleanup applied' });
    } catch (error) {
      report.cleanup.push({ ok: false, action: 'cleanup failed', error: error?.message || String(error) });
    }

    try {
      const output = runWranglerSql({ context, sql: buildResidueSql(context), label: 'residue', workerDir, tempDir });
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
  const opts = parseMaterialSmokeArgs(process.argv.slice(2));
  const context = buildSmokeContext({ market: opts.market });
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const workerDir = resolve(scriptDir, '..');
  const reportPath = resolve(workerDir, `../.Codex/memory/material-write-smoke-${context.market}-${context.stamp}.json`);
  const report = await runMaterialSmoke({ context, workerDir, reportPath });
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
    console.log(`SAGEMRO material items production smoke: ${summary.passed ? 'PASS' : 'FAIL'}`);
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
