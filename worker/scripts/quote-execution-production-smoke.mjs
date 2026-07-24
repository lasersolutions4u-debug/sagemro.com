#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSalt, hashPasswordNew } from '../src/lib/auth.js';

const TARGETS = {
  com: {
    baseUrl: 'https://api.sagemro.com',
    database: 'sagemro-db',
    customerOrigin: 'https://sagemro.com',
    engineerOrigin: 'https://engineer.sagemro.com',
    adminOrigin: 'https://admin.sagemro.com',
    currency: 'USD',
    region: 'Texas',
  },
  cn: {
    baseUrl: 'https://api.sagemro.cn',
    database: 'sagemro-db-cn',
    customerOrigin: 'https://sagemro.cn',
    engineerOrigin: 'https://engineer.sagemro.cn',
    adminOrigin: 'https://admin.sagemro.cn',
    currency: 'CNY',
    region: '山东济南',
  },
};

const REQUIRED_OPTIONS = [
  'base-url', 'market', 'database', 'confirm-target',
  'admin-identity', 'admin-password',
  'customer-identity', 'customer-password',
  'engineer-identity', 'engineer-password',
];

function normalizeCliPath(value) {
  const normalized = String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/([A-Za-z]:\/)/, '$1');
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function isCliEntry(importMetaUrl, argvPath) {
  return Boolean(argvPath) && normalizeCliPath(fileURLToPath(importMetaUrl)) === normalizeCliPath(argvPath);
}

function parseNamedOptions(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--allow-write' || arg === '--json') {
      values[arg.slice(2)] = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2);
    if (!REQUIRED_OPTIONS.includes(key)) throw new Error(`Unknown option: --${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    if (Object.hasOwn(values, key)) throw new Error(`--${key} may only be provided once`);
    values[key] = value;
    index += 1;
  }
  return values;
}

export function parseQuoteExecutionSmokeArgs(argv = []) {
  const values = parseNamedOptions(argv);
  for (const key of REQUIRED_OPTIONS) {
    if (!values[key]) throw new Error(`quote execution production smoke requires --${key}`);
  }
  if (!values['allow-write']) {
    throw new Error('quote execution production smoke requires --allow-write because it creates temporary production rows.');
  }
  if (!['com', 'cn'].includes(values.market)) throw new Error('--market must be com or cn');

  const target = TARGETS[values.market];
  const baseUrl = new URL(values['base-url']);
  if (values['base-url'].replace(/\/$/, '') !== target.baseUrl || values.database !== target.database) {
    throw new Error('Refusing unknown production target: --market, --base-url, and --database must match a known production target.');
  }
  const expectedConfirmation = `${values.market}:${values.database}:${baseUrl.hostname}`;
  if (values['confirm-target'] !== expectedConfirmation) {
    throw new Error(`--confirm-target must exactly equal ${expectedConfirmation}`);
  }
  if (!values['customer-identity'].includes('@') || !values['engineer-identity'].includes('@')) {
    throw new Error('Temporary customer and engineer identities must be email addresses.');
  }

  return {
    market: values.market,
    baseUrl: target.baseUrl,
    database: target.database,
    allowWrite: true,
    json: Boolean(values.json),
    adminIdentity: values['admin-identity'],
    adminPassword: values['admin-password'],
    customerIdentity: values['customer-identity'].trim().toLowerCase(),
    customerPassword: values['customer-password'],
    engineerIdentity: values['engineer-identity'].trim().toLowerCase(),
    engineerPassword: values['engineer-password'],
  };
}

export function quoteSql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function exactIdList(ids = []) {
  const exactIds = [...new Set(ids.filter(Boolean))];
  return exactIds.length ? exactIds.map(quoteSql).join(',') : 'NULL';
}

export function buildQuoteExecutionSmokeContext({
  market,
  baseUrl,
  database,
  stamp,
  customerIdentity,
  engineerIdentity,
} = {}) {
  const selectedMarket = market || 'com';
  const target = TARGETS[selectedMarket];
  if (!target) throw new Error('market must be com or cn');
  const nowStamp = stamp || `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${randomBytes(4).toString('hex')}`;
  const runId = `SAGEMRO_SMOKE_QUOTE_EXECUTION_${selectedMarket}_${nowStamp}`;
  const id = (suffix) => `${runId}_${suffix}`;
  const pricingId = id('PRICING');
  const quoteHistoryId = id('QUOTE_HISTORY_1');
  const scheduleIds = [id('SCHEDULE_1'), id('SCHEDULE_2')];
  const installmentIds = scheduleIds.map((scheduleId) => `installment-${scheduleId}`);
  return {
    market: selectedMarket,
    stamp: nowStamp,
    runId,
    baseUrl: baseUrl || target.baseUrl,
    database: database || target.database,
    customerOrigin: target.customerOrigin,
    engineerOrigin: target.engineerOrigin,
    adminOrigin: target.adminOrigin,
    currency: target.currency,
    region: target.region,
    customerIdentity,
    engineerIdentity,
    customerId: id('CUSTOMER'),
    engineerId: id('ENGINEER'),
    workOrderId: id('WORK_ORDER'),
    pricingId,
    quoteHistoryId,
    pricingIds: [pricingId],
    quoteHistoryIds: [quoteHistoryId],
    scheduleIds,
    installmentIds,
    receiptClaimScope: id('RECEIPT_CLAIM'),
    fieldDayScope: id('FIELD_DAY'),
    repairRecordId: id('REPAIR_RECORD'),
    orderNo: `WO-SMOKE-QE-${selectedMarket.toUpperCase()}-${nowStamp}`,
  };
}

export function buildQuoteExecutionCleanupSql(context, ids = {}) {
  const workOrderId = quoteSql(context.workOrderId);
  const customerId = quoteSql(context.customerId);
  const engineerId = quoteSql(context.engineerId);
  const claimIds = exactIdList(ids.receiptClaimIds);
  const pricingIds = exactIdList(ids.pricingIds);
  const installmentIds = exactIdList(ids.installmentIds);
  const scheduleIds = exactIdList(ids.scheduleIds);
  const historyIds = exactIdList(ids.quoteHistoryIds);
  const fieldDayIds = exactIdList(ids.fieldDayIds);
  const messageIds = exactIdList(ids.messageIds);
  const notificationIds = exactIdList(ids.notificationIds);
  const auditLogIds = exactIdList(ids.auditLogIds);
  const workOrderLogIds = exactIdList(ids.workOrderLogIds);
  const repairRecordIds = exactIdList(ids.repairRecordIds);

  return `
DELETE FROM work_order_receipt_evidence WHERE claim_id IN (${claimIds});
DELETE FROM work_order_receipt_claims WHERE id IN (${claimIds});
DELETE FROM work_order_installments WHERE id IN (${installmentIds});
DELETE FROM work_order_field_day_media WHERE field_day_id IN (${fieldDayIds});
DELETE FROM work_order_field_days WHERE id IN (${fieldDayIds});
DELETE FROM work_order_pricing_history WHERE id IN (${historyIds});
DELETE FROM work_order_payment_schedule WHERE id IN (${scheduleIds});
DELETE FROM work_order_repair_records WHERE id IN (${repairRecordIds});
DELETE FROM work_order_messages WHERE id IN (${messageIds});
DELETE FROM notifications WHERE id IN (${notificationIds});
DELETE FROM audit_logs WHERE id IN (${auditLogIds});
DELETE FROM work_order_logs WHERE id IN (${workOrderLogIds});
DELETE FROM work_order_pricing WHERE id IN (${pricingIds});
DELETE FROM work_orders WHERE id=${workOrderId};
DELETE FROM account_identities WHERE owner_type='engineer' AND owner_id=${engineerId};
DELETE FROM engineers WHERE id=${engineerId};
DELETE FROM account_identities WHERE owner_type='customer' AND owner_id=${customerId};
DELETE FROM customers WHERE id=${customerId};
`;
}

export function buildQuoteExecutionResidueSql(context, ids = {}) {
  const workOrderId = quoteSql(context.workOrderId);
  const customerId = quoteSql(context.customerId);
  const engineerId = quoteSql(context.engineerId);
  return `
SELECT
  (SELECT COUNT(*) FROM work_order_receipt_evidence WHERE claim_id IN (${exactIdList(ids.receiptClaimIds)})) +
  (SELECT COUNT(*) FROM work_order_receipt_claims WHERE id IN (${exactIdList(ids.receiptClaimIds)})) +
  (SELECT COUNT(*) FROM work_order_installments WHERE id IN (${exactIdList(ids.installmentIds)})) +
  (SELECT COUNT(*) FROM work_order_payment_schedule WHERE id IN (${exactIdList(ids.scheduleIds)})) +
  (SELECT COUNT(*) FROM work_order_field_day_media WHERE field_day_id IN (${exactIdList(ids.fieldDayIds)})) +
  (SELECT COUNT(*) FROM work_order_field_days WHERE id IN (${exactIdList(ids.fieldDayIds)})) +
  (SELECT COUNT(*) FROM work_order_pricing_history WHERE id IN (${exactIdList(ids.quoteHistoryIds)})) +
  (SELECT COUNT(*) FROM work_order_repair_records WHERE id IN (${exactIdList(ids.repairRecordIds)})) +
  (SELECT COUNT(*) FROM work_order_messages WHERE id IN (${exactIdList(ids.messageIds)})) +
  (SELECT COUNT(*) FROM notifications WHERE json_valid(data) AND json_extract(data, '$.work_order_id')=${workOrderId}) +
  (SELECT COUNT(*) FROM audit_logs WHERE id IN (${exactIdList(ids.auditLogIds)})) +
  (SELECT COUNT(*) FROM work_order_logs WHERE id IN (${exactIdList(ids.workOrderLogIds)})) +
  (SELECT COUNT(*) FROM work_order_pricing WHERE id IN (${exactIdList(ids.pricingIds)})) +
  (SELECT COUNT(*) FROM work_orders WHERE id=${workOrderId}) +
  (SELECT COUNT(*) FROM account_identities WHERE (owner_type='customer' AND owner_id=${customerId}) OR (owner_type='engineer' AND owner_id=${engineerId})) +
  (SELECT COUNT(*) FROM customers WHERE id=${customerId}) +
  (SELECT COUNT(*) FROM engineers WHERE id=${engineerId}) AS total_residue;
`;
}

export function parseWranglerRows(output) {
  const parsed = JSON.parse(String(output));
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return result?.results || [];
}

export function parseWranglerResidueCount(output) {
  const rows = parseWranglerRows(output);
  return rows.length === 1 && Number.isInteger(Number(rows[0].total_residue))
    ? Number(rows[0].total_residue)
    : null;
}

export function sanitizeQuoteExecutionStepResult(result) {
  if (!result || typeof result !== 'object') return result;
  const out = { status: result.status, durationMs: result.durationMs, path: result.path };
  for (const key of ['quote', 'installment', 'claim', 'fieldDay', 'workOrder', 'residue']) {
    if (result.body?.[key] !== undefined) out[key] = result.body[key];
  }
  return out;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runWranglerSql({ context, sql, label, workerDir, tempDir, command = false }) {
  const args = ['wrangler', 'd1', 'execute', context.database, '--env', 'production', '--remote', '--json'];
  if (command) {
    args.push('--command', sql);
  } else {
    const file = join(tempDir, `${label}.sql`);
    writeFileSync(file, sql);
    args.push('--file', file);
  }
  return execFileSync('npx', args, { cwd: workerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function api(context, path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const started = Date.now();
  try {
    const headers = {
      Origin: init.admin
        ? context.adminOrigin
        : (init.customer ? context.customerOrigin : context.engineerOrigin),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.form ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers || {}),
    };
    const response = await fetch(`${context.baseUrl}${path}`, {
      ...Object.fromEntries(Object.entries(init).filter(([key]) => !['admin', 'customer', 'token', 'form'].includes(key))),
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { message: 'non-JSON response' }; }
    return { status: response.status, ok: response.ok, body, durationMs: Date.now() - started, path };
  } finally {
    clearTimeout(timeout);
  }
}

function receiptClaimForm({ amount, note, idempotencyKey }) {
  const form = new FormData();
  form.set('claimed_amount', String(amount));
  form.set('note', note);
  form.set('idempotency_key', idempotencyKey);
  return form;
}

async function step(report, name, fn) {
  const item = { name, ok: false };
  try {
    const result = await fn();
    item.ok = true;
    item.result = sanitizeQuoteExecutionStepResult(result);
    return result;
  } catch (error) {
    item.error = String(error?.message || error).replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]');
    throw error;
  } finally {
    report.steps.push(item);
  }
}

async function buildSeedSql(context, options) {
  const customerSalt = generateSalt();
  const engineerSalt = generateSalt();
  const [customerHash, engineerHash] = await Promise.all([
    hashPasswordNew(options.customerPassword, customerSalt),
    hashPasswordNew(options.engineerPassword, engineerSalt),
  ]);
  return `
INSERT INTO customers (id, user_no, name, phone, email, password_hash, salt, region, company, auth_status)
VALUES (${quoteSql(context.customerId)}, ${quoteSql(`U${context.stamp.slice(-6)}`)}, ${quoteSql(`${context.runId}_CUSTOMER`)}, ${quoteSql(`SMOKE-${context.stamp.slice(-10)}`)}, ${quoteSql(context.customerIdentity)}, ${quoteSql(customerHash)}, ${quoteSql(customerSalt)}, ${quoteSql(context.region)}, ${quoteSql(context.runId)}, 'authenticated');
INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
VALUES ('email', ${quoteSql(context.customerIdentity)}, 'customer', ${quoteSql(context.customerId)});
INSERT INTO engineers (id, user_no, name, phone, email, password_hash, salt, specialties, brands, services, service_region, bio, level, commission_rate, credit_score, wallet_balance, deposit_balance, company, auth_status, status, engineer_role, cooperation_status, certification_status, first_login_password_reset_required)
VALUES (${quoteSql(context.engineerId)}, ${quoteSql(`E${context.stamp.slice(-6)}`)}, ${quoteSql(`${context.runId}_ENGINEER`)}, ${quoteSql(`SMOKE-E-${context.stamp.slice(-9)}`)}, ${quoteSql(context.engineerIdentity)}, ${quoteSql(engineerHash)}, ${quoteSql(engineerSalt)}, '[]', '{}', '[]', ${quoteSql(context.region)}, ${quoteSql(context.runId)}, 'junior', 0.8, 100, 0, 0, ${quoteSql(context.runId)}, 'authenticated', 'available', 'engineer', 'confirmed', 'certified', 0);
INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
VALUES ('email', ${quoteSql(context.engineerIdentity)}, 'engineer', ${quoteSql(context.engineerId)});
INSERT INTO work_orders (id, order_no, customer_id, engineer_id, type, description, urgency, status, category_l1, category_l2, quote_review_status, service_mode, site_timezone, expected_completion_date, planned_daily_end_time, assigned_at, started_at)
VALUES (${quoteSql(context.workOrderId)}, ${quoteSql(context.orderNo)}, ${quoteSql(context.customerId)}, ${quoteSql(context.engineerId)}, 'fault', ${quoteSql(context.runId)}, 'normal', 'pricing', 'other', 'other', 'pending_review', 'onsite', 'Asia/Shanghai', '2099-12-31', '17:00', datetime('now'), NULL);
INSERT INTO work_order_pricing (
  id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee,
  subtotal, total_amount, platform_fee, deposit_withhold, status, submitted_at,
  quote_version, expected_service_days, payment_plan_mode
)
VALUES (
  ${quoteSql(context.pricingId)}, ${quoteSql(context.workOrderId)}, ${quoteSql(context.engineerId)},
  1000, 0, 0, 0, 1000, 1000, 200, 50, 'pending_review', datetime('now'), 1, 1, 'installments'
);
INSERT INTO work_order_pricing_history (
  id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal, total_amount,
  platform_fee, deposit_withhold, version, expected_service_days, payment_plan_mode,
  quote_kind, parent_quote_version, status
)
VALUES (
  ${quoteSql(context.quoteHistoryId)}, ${quoteSql(context.pricingId)},
  1000, 0, 0, 0, 1000, 1000, 200, 50, 1, 1, 'installments', 'baseline', NULL, 'pending_review'
);
INSERT INTO work_order_payment_schedule (
  id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
  trigger_type, due_date, description, required_before_start
)
VALUES
  (${quoteSql(context.scheduleIds[0])}, ${quoteSql(context.pricingId)}, ${quoteSql(context.workOrderId)}, 1, 1, 600, ${quoteSql(context.currency)}, 'before_start', NULL, ${quoteSql(context.runId)}, 1),
  (${quoteSql(context.scheduleIds[1])}, ${quoteSql(context.pricingId)}, ${quoteSql(context.workOrderId)}, 1, 2, 400, ${quoteSql(context.currency)}, 'on_completion', NULL, ${quoteSql(context.runId)}, 0);
`;
}

function responseFailure(label, response) {
  return `${label} failed HTTP ${response.status}`;
}

async function collectCleanupIds(context, ids, workerDir) {
  const sql = `
SELECT id, 'claim' AS kind FROM work_order_receipt_claims WHERE work_order_id=${quoteSql(context.workOrderId)}
UNION ALL SELECT id, 'field_day' FROM work_order_field_days WHERE work_order_id=${quoteSql(context.workOrderId)}
UNION ALL SELECT id, 'repair' FROM work_order_repair_records WHERE work_order_id=${quoteSql(context.workOrderId)}
UNION ALL SELECT id, 'message' FROM work_order_messages WHERE work_order_id=${quoteSql(context.workOrderId)}
UNION ALL SELECT id, 'work_order_log' FROM work_order_logs WHERE work_order_id=${quoteSql(context.workOrderId)}
UNION ALL SELECT id, 'notification' FROM notifications WHERE json_valid(data) AND json_extract(data, '$.work_order_id')=${quoteSql(context.workOrderId)}
UNION ALL SELECT audit.id, 'audit'
FROM audit_logs audit
WHERE audit.target_id=${quoteSql(context.workOrderId)}
  OR audit.target_id IN (SELECT id FROM work_order_installments WHERE work_order_id=${quoteSql(context.workOrderId)})
  OR audit.target_id IN (SELECT id FROM work_order_receipt_claims WHERE work_order_id=${quoteSql(context.workOrderId)})
  OR audit.target_id IN (SELECT id FROM work_order_field_days WHERE work_order_id=${quoteSql(context.workOrderId)});
`;
  const rows = parseWranglerRows(runWranglerSql({ context, sql, label: 'collect-cleanup-ids', workerDir, command: true }));
  for (const key of ['receiptClaimIds', 'fieldDayIds', 'repairRecordIds', 'messageIds', 'workOrderLogIds', 'notificationIds', 'auditLogIds']) ids[key] ||= [];
  const map = {
    claim: 'receiptClaimIds', field_day: 'fieldDayIds', repair: 'repairRecordIds', message: 'messageIds', work_order_log: 'workOrderLogIds',
    notification: 'notificationIds', audit: 'auditLogIds',
  };
  for (const row of rows) if (map[row.kind]) ids[map[row.kind]].push(row.id);
}

export async function runQuoteExecutionSmoke({ context, options, workerDir, reportPath }) {
  const tempDir = mkdtempSync(join(tmpdir(), 'sagemro-quote-execution-smoke-'));
  const report = {
    market: context.market,
    runId: context.runId,
    baseUrl: context.baseUrl,
    steps: [],
    cleanup: [],
    passed: false,
  };
  const ids = {
    pricingIds: [...context.pricingIds],
    quoteHistoryIds: [...context.quoteHistoryIds],
    scheduleIds: [...context.scheduleIds],
    installmentIds: [...context.installmentIds],
  };

  try {
    await step(report, 'seed exact temporary identities and work order', async () => {
      runWranglerSql({ context, sql: await buildSeedSql(context, options), label: 'seed', workerDir, tempDir });
      return { status: 0, durationMs: 0, path: 'wrangler d1 seed exact IDs' };
    });

    const customerLogin = await step(report, 'customer login', async () => {
      const response = await api(context, '/api/auth/login', { method: 'POST', customer: true, body: JSON.stringify({ email: options.customerIdentity, password: options.customerPassword }) });
      assert(response.ok && response.body?.token, responseFailure('customer login', response));
      return response;
    });
    const engineerLogin = await step(report, 'engineer login', async () => {
      const response = await api(context, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: options.engineerIdentity, password: options.engineerPassword }) });
      assert(response.ok && response.body?.token, responseFailure('engineer login', response));
      return response;
    });
    const adminLogin = await step(report, 'admin login', async () => {
      const response = await api(context, '/api/admin/login', { method: 'POST', admin: true, body: JSON.stringify({ phone: options.adminIdentity, password: options.adminPassword }) });
      assert(response.ok && response.body?.token, responseFailure('admin login', response));
      return response;
    });
    const customerToken = customerLogin.body.token;
    const engineerToken = engineerLogin.body.token;
    const adminToken = adminLogin.body.token;

    const quoteVersion = 1;

    await step(report, 'Admin approves exact quote version', async () => {
      const response = await api(context, `/api/admin/workorders/${context.workOrderId}/pricing/approve`, { method: 'PATCH', admin: true, token: adminToken, body: JSON.stringify({ quote_version: quoteVersion, note: context.quoteHistoryId }) });
      assert(response.ok, responseFailure('Admin quote approval', response));
      return response;
    });
    await step(report, 'customer confirms exact approved quote version', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/pricing/confirm`, { method: 'POST', customer: true, token: customerToken, body: JSON.stringify({ quote_version: quoteVersion }) });
      assert(response.ok, responseFailure('customer quote confirmation', response));
      return response;
    });

    const afterConfirmation = await step(report, 'read activated installment baseline', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}`, { method: 'GET', token: engineerToken });
      const execution = response.body?.quote_execution;
      const scheduleIds = (execution?.payment_schedule || []).map((row) => row.id).sort();
      const installmentIds = (execution?.installments || []).map((row) => row.id).sort();
      assert(
        response.ok
          && JSON.stringify(scheduleIds) === JSON.stringify([...context.scheduleIds].sort())
          && JSON.stringify(installmentIds) === JSON.stringify([...context.installmentIds].sort()),
        responseFailure('activated exact baseline read', response),
      );
      return response;
    });
    const firstInstallment = afterConfirmation.body.quote_execution.installments.find((row) => row.id === context.installmentIds[0]);
    const finalInstallment = afterConfirmation.body.quote_execution.installments.find((row) => row.id === context.installmentIds[1]);
    assert(
      firstInstallment?.schedule_id === context.scheduleIds[0]
        && finalInstallment?.schedule_id === context.scheduleIds[1],
      'activated installments do not match the exact seeded schedule IDs',
    );

    await step(report, 'engineer opens required-before-start installment', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/installments/${firstInstallment.id}/collect`, { method: 'POST', token: engineerToken, body: '{}' });
      assert(response.ok, responseFailure('start installment collection', response));
      return response;
    });
    await step(report, 'customer selects payment method for open installment', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/installments/${firstInstallment.id}/payment-method`, { method: 'POST', customer: true, token: customerToken, body: JSON.stringify({ payment_method: 'bank_transfer' }) });
      assert(response.ok, responseFailure('customer payment method selection', response));
      return response;
    });

    const partialClaim = await step(report, 'engineer submits partial receipt claim', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/installments/${firstInstallment.id}/receipt-claims`, { method: 'POST', token: engineerToken, form: true, body: receiptClaimForm({ amount: 300, note: context.receiptClaimScope, idempotencyKey: `${context.receiptClaimScope}_PARTIAL` }) });
      assert(response.status === 201 && response.body?.claim?.id, responseFailure('partial receipt claim', response));
      return response;
    });
    await step(report, 'Admin confirms partial receipt decision', async () => {
      const response = await api(context, `/api/admin/workorders/${context.workOrderId}/installments/${firstInstallment.id}/receipt-claims/${partialClaim.body.claim.id}/decision`, { method: 'POST', admin: true, token: adminToken, body: JSON.stringify({ decision: 'confirmed', confirmed_amount: 300, reason: context.receiptClaimScope, idempotency_key: `${context.receiptClaimScope}_PARTIAL_DECISION` }) });
      assert(response.ok, responseFailure('partial receipt decision', response));
      return response;
    });
    await step(report, 'verify partial receipt leaves the installment collectible', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}`, { method: 'GET', token: engineerToken });
      const installment = response.body?.quote_execution?.installments?.find((row) => row.id === firstInstallment.id);
      assert(response.ok && installment?.status === 'partially_received' && installment?.received_amount === 300, responseFailure('partial receipt state', response));
      return response;
    });
    await step(report, 'required installment blocks service start after partial receipt', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/payment/start-request`, { method: 'POST', token: engineerToken, body: JSON.stringify({ note: context.runId }) });
      assert(response.status === 409, `expected partial-receipt start gate HTTP 409, got ${response.status}`);
      return response;
    });
    const finalFirstClaim = await step(report, 'engineer submits remaining required receipt claim', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/installments/${firstInstallment.id}/receipt-claims`, { method: 'POST', token: engineerToken, form: true, body: receiptClaimForm({ amount: 300, note: context.receiptClaimScope, idempotencyKey: `${context.receiptClaimScope}_FINAL_FIRST` }) });
      assert(response.status === 201 && response.body?.claim?.id, responseFailure('final required receipt claim', response));
      return response;
    });
    await step(report, 'Admin confirms final required receipt decision', async () => {
      const response = await api(context, `/api/admin/workorders/${context.workOrderId}/installments/${firstInstallment.id}/receipt-claims/${finalFirstClaim.body.claim.id}/decision`, { method: 'POST', admin: true, token: adminToken, body: JSON.stringify({ decision: 'confirmed', confirmed_amount: 300, reason: context.receiptClaimScope, idempotency_key: `${context.receiptClaimScope}_FINAL_FIRST_DECISION` }) });
      assert(response.ok, responseFailure('final required receipt decision', response));
      return response;
    });

    await step(report, 'engineer passes the installment start gate', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/payment/start-request`, { method: 'POST', token: engineerToken, body: JSON.stringify({ note: context.runId }) });
      assert(response.ok && response.body?.status === 'payment_review', responseFailure('start gate request', response));
      return response;
    });
    await step(report, 'Admin grants final start approval', async () => {
      const response = await api(context, `/api/admin/workorders/${context.workOrderId}/payment/approve-start`, { method: 'POST', admin: true, token: adminToken, body: JSON.stringify({ note: context.runId }) });
      assert(response.ok && response.body?.status === 'in_service', responseFailure('Admin start approval', response));
      return response;
    });

    await step(report, 'seed exact submitted field day without optional evidence upload', async () => {
      const fieldDayId = `${context.fieldDayScope}_ONE`;
      ids.fieldDayIds = [fieldDayId];
      runWranglerSql({ context, workerDir, tempDir, label: 'seed-field-day', sql: `
INSERT INTO work_order_field_days (id, work_order_id, engineer_id, site_local_date, site_timezone, status, check_in_at, report_submitted_at, completed_work, labor_hours)
VALUES (${quoteSql(fieldDayId)}, ${quoteSql(context.workOrderId)}, ${quoteSql(context.engineerId)}, '2099-01-01', 'Asia/Shanghai', 'report_submitted', datetime('now'), datetime('now'), ${quoteSql(context.fieldDayScope)}, 1);
` });
      return { status: 0, durationMs: 0, path: 'wrangler d1 seed exact field day' };
    });
    await step(report, 'verify field-day allowance is exhausted after one submitted day', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}`, { method: 'GET', token: engineerToken });
      assert(response.ok && response.body?.quote_execution?.allowance_exhausted === true, responseFailure('field-day allowance read', response));
      return response;
    });
    await step(report, 'engineer records service completion with later installment outstanding', async () => {
      const saved = await api(context, `/api/workorders/${context.workOrderId}/repair-record`, { method: 'POST', token: engineerToken, body: JSON.stringify({ symptom: context.runId, diagnosis: 'Smoke lifecycle verification', solution: 'Smoke lifecycle complete', labor_hours: 1 }) });
      assert(saved.ok, responseFailure('repair record', saved));
      const response = await api(context, `/api/workorders/${context.workOrderId}/resolve`, { method: 'POST', token: engineerToken, body: '{}' });
      assert(response.ok, responseFailure('service completion', response));
      return response;
    });
    await step(report, 'financial archive is blocked while later installment remains outstanding', async () => {
      const response = await api(context, `/api/admin/workorders/${context.workOrderId}/archive`, { method: 'PATCH', admin: true, token: adminToken, body: '{}' });
      assert(response.status === 409, `expected outstanding-balance archive gate HTTP 409, got ${response.status}`);
      return response;
    });

    await step(report, 'engineer opens later installment collection', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/installments/${finalInstallment.id}/collect`, { method: 'POST', token: engineerToken, body: '{}' });
      assert(response.ok, responseFailure('later installment collection', response));
      return response;
    });
    await step(report, 'customer selects later installment payment method', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/installments/${finalInstallment.id}/payment-method`, { method: 'POST', customer: true, token: customerToken, body: JSON.stringify({ payment_method: 'bank_transfer' }) });
      assert(response.ok, responseFailure('later payment method', response));
      return response;
    });
    const finalClaim = await step(report, 'engineer submits final installment receipt claim', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}/installments/${finalInstallment.id}/receipt-claims`, { method: 'POST', token: engineerToken, form: true, body: receiptClaimForm({ amount: 400, note: context.receiptClaimScope, idempotencyKey: `${context.receiptClaimScope}_FINAL` }) });
      assert(response.status === 201 && response.body?.claim?.id, responseFailure('final installment claim', response));
      return response;
    });
    await step(report, 'Admin confirms final installment receipt', async () => {
      const response = await api(context, `/api/admin/workorders/${context.workOrderId}/installments/${finalInstallment.id}/receipt-claims/${finalClaim.body.claim.id}/decision`, { method: 'POST', admin: true, token: adminToken, body: JSON.stringify({ decision: 'confirmed', confirmed_amount: 400, reason: context.receiptClaimScope, idempotency_key: `${context.receiptClaimScope}_FINAL_DECISION` }) });
      assert(response.ok, responseFailure('final installment decision', response));
      return response;
    });
    await step(report, 'verify quote execution is financially settled', async () => {
      const response = await api(context, `/api/workorders/${context.workOrderId}`, { method: 'GET', token: adminToken, admin: true });
      assert(response.ok && response.body?.quote_execution?.financially_settled === true, responseFailure('financial settlement read', response));
      return response;
    });
    await step(report, 'Admin completes final financial archive', async () => {
      const response = await api(context, `/api/admin/workorders/${context.workOrderId}/archive`, { method: 'PATCH', admin: true, token: adminToken, body: '{}' });
      assert(response.ok && response.body?.status === 'completed', responseFailure('final archive', response));
      return response;
    });
    report.passed = true;
  } catch (error) {
    report.error = String(error?.message || error).replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]');
  } finally {
    try {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      await collectCleanupIds(context, ids, workerDir);
      runWranglerSql({ context, sql: buildQuoteExecutionCleanupSql(context, ids), label: 'cleanup', workerDir, tempDir });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      await collectCleanupIds(context, ids, workerDir);
      runWranglerSql({ context, sql: buildQuoteExecutionCleanupSql(context, ids), label: 'cleanup-late', workerDir, tempDir });
      report.cleanup.push({ ok: true, action: 'exact-ID child-first cleanup' });
    } catch (error) {
      report.cleanup.push({ ok: false, action: 'exact-ID child-first cleanup', error: String(error?.message || error).replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]') });
      report.passed = false;
    }
    try {
      const output = runWranglerSql({ context, sql: buildQuoteExecutionResidueSql(context, ids), label: 'verify-residue', workerDir, tempDir, command: true });
      const totalResidue = parseWranglerResidueCount(output);
      report.cleanup.push({ ok: totalResidue === 0, action: 'residue zero check', totalResidue });
      if (totalResidue !== 0) report.passed = false;
    } catch (error) {
      report.cleanup.push({ ok: false, action: 'residue zero check', error: String(error?.message || error) });
      report.passed = false;
    }
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
  return report;
}

async function main() {
  const options = parseQuoteExecutionSmokeArgs(process.argv.slice(2));
  const context = buildQuoteExecutionSmokeContext(options);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const workerDir = resolve(scriptDir, '..');
  const reportPath = resolve(workerDir, `../.Codex/memory/quote-execution-production-smoke-${context.market}-${context.stamp}.json`);
  const report = await runQuoteExecutionSmoke({ context, options, workerDir, reportPath });
  const summary = {
    market: context.market.toUpperCase(),
    status: report.passed ? 'PASS' : 'FAIL',
    runId: context.runId,
    reportPath,
    failedStep: report.steps.find((item) => !item.ok)?.name || null,
    cleanup: report.cleanup,
  };
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`[${summary.market}] ${summary.status} quote execution production smoke`);
    console.log(`Run: ${summary.runId}`);
    console.log(`Report: ${summary.reportPath}`);
    if (summary.failedStep) console.log(`Failed step: ${summary.failedStep}`);
    for (const item of summary.cleanup) console.log(`Cleanup ${item.ok ? 'PASS' : 'FAIL'}: ${item.action}`);
  }
  if (!report.passed) process.exitCode = 1;
}

if (isCliEntry(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error('Quote execution production smoke failed before execution.');
    process.exitCode = 1;
  });
}
