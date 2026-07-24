import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildPendingReceiptClaimSql,
  buildQuoteExecutionCleanupSql,
  buildQuoteExecutionResidueSql,
  buildQuoteExecutionSmokeContext,
  parseQuoteExecutionSmokeArgs,
  sanitizeQuoteExecutionStepResult,
} from '../scripts/quote-execution-production-smoke.mjs';

const scriptSource = readFileSync(
  new URL('../scripts/quote-execution-production-smoke.mjs', import.meta.url),
  'utf8',
);
const deploySource = readFileSync(new URL('../../DEPLOY.md', import.meta.url), 'utf8');

const requiredArgs = [
  '--base-url', 'https://api.sagemro.com',
  '--market', 'com',
  '--database', 'sagemro-db',
  '--confirm-target', 'com:sagemro-db:api.sagemro.com',
  '--admin-identity', 'admin-smoke@example.invalid',
  '--admin-password', 'admin-secret',
  '--customer-identity', 'customer-smoke@example.invalid',
  '--customer-password', 'customer-secret',
  '--engineer-identity', 'engineer-smoke@example.invalid',
  '--engineer-password', 'engineer-secret',
  '--allow-write',
];

test('quote execution smoke requires an explicit known target, identities, and write confirmation', () => {
  assert.throws(() => parseQuoteExecutionSmokeArgs([]), /--base-url/);
  assert.throws(
    () => parseQuoteExecutionSmokeArgs(requiredArgs.filter((arg) => arg !== '--allow-write')),
    /--allow-write/,
  );
  assert.throws(
    () => parseQuoteExecutionSmokeArgs(requiredArgs.map((arg) => (
      arg === 'https://api.sagemro.com' ? 'https://api.example.com' : arg
    ))),
    /known production target/,
  );
  assert.throws(
    () => parseQuoteExecutionSmokeArgs(requiredArgs.map((arg) => (
      arg === 'com:sagemro-db:api.sagemro.com' ? 'cn:sagemro-db-cn:api.sagemro.cn' : arg
    ))),
    /--confirm-target/,
  );

  const parsed = parseQuoteExecutionSmokeArgs(requiredArgs);
  assert.equal(parsed.market, 'com');
  assert.equal(parsed.baseUrl, 'https://api.sagemro.com');
  assert.equal(parsed.database, 'sagemro-db');
  assert.equal(parsed.allowWrite, true);
});

test('quote execution context gives every temporary record a unique run scope', () => {
  const context = buildQuoteExecutionSmokeContext({
    market: 'cn',
    baseUrl: 'https://api.sagemro.cn',
    database: 'sagemro-db-cn',
    stamp: '20260725123045',
    customerIdentity: 'customer-smoke@example.invalid',
    engineerIdentity: 'engineer-smoke@example.invalid',
  });

  assert.equal(context.runId, 'SAGEMRO_SMOKE_QUOTE_EXECUTION_cn_20260725123045');
  assert.equal(context.customerOrigin, 'https://sagemro.cn');
  assert.equal(context.engineerOrigin, 'https://engineer.sagemro.cn');
  for (const key of [
    'customerId',
    'engineerId',
    'workOrderId',
    'pricingId',
    'quoteHistoryId',
    'partialClaimId',
    'requiredFinalClaimId',
    'laterFinalClaimId',
    'fieldDayScope',
  ]) {
    assert.match(context[key], /^SAGEMRO_SMOKE_QUOTE_EXECUTION_cn_20260725123045_/);
  }
  assert.deepEqual(context.pricingIds, [context.pricingId]);
  assert.deepEqual(context.quoteHistoryIds, [context.quoteHistoryId]);
  assert.deepEqual(context.scheduleIds, [
    'SAGEMRO_SMOKE_QUOTE_EXECUTION_cn_20260725123045_SCHEDULE_1',
    'SAGEMRO_SMOKE_QUOTE_EXECUTION_cn_20260725123045_SCHEDULE_2',
  ]);
  assert.deepEqual(context.installmentIds, context.scheduleIds.map((id) => `installment-${id}`));
  assert.deepEqual(context.receiptClaimIds, [
    'SAGEMRO_SMOKE_QUOTE_EXECUTION_cn_20260725123045_RECEIPT_CLAIM_PARTIAL',
    'SAGEMRO_SMOKE_QUOTE_EXECUTION_cn_20260725123045_RECEIPT_CLAIM_REQUIRED_FINAL',
    'SAGEMRO_SMOKE_QUOTE_EXECUTION_cn_20260725123045_RECEIPT_CLAIM_LATER_FINAL',
  ]);
});

test('cleanup is child-first, exact-ID-only, and followed by a zero-residue query', () => {
  const context = buildQuoteExecutionSmokeContext({
    market: 'com',
    baseUrl: 'https://api.sagemro.com',
    database: 'sagemro-db',
    stamp: '20260725123045',
    customerIdentity: 'customer-smoke@example.invalid',
    engineerIdentity: 'engineer-smoke@example.invalid',
  });
  const ids = {
    pricingIds: ['pricing-exact-1'],
    quoteHistoryIds: ['history-exact-1'],
    scheduleIds: ['schedule-exact-1', 'schedule-exact-2'],
    installmentIds: ['installment-exact-1', 'installment-exact-2'],
    receiptClaimIds: ['claim-exact-1', 'claim-exact-2'],
    fieldDayIds: ['field-day-exact-1'],
    messageIds: ['message-exact-1'],
    notificationIds: ['notification-exact-1'],
    auditLogIds: ['audit-exact-1'],
    workOrderLogIds: ['work-order-log-exact-1'],
    repairRecordIds: ['repair-exact-1'],
  };
  const cleanup = buildQuoteExecutionCleanupSql(context, ids);

  assert.ok(cleanup.indexOf('DELETE FROM work_order_receipt_evidence') < cleanup.indexOf('DELETE FROM work_order_receipt_claims'));
  assert.ok(cleanup.indexOf('DELETE FROM work_order_receipt_claims') < cleanup.indexOf('DELETE FROM work_order_installments'));
  assert.ok(cleanup.indexOf('DELETE FROM work_order_installments') < cleanup.indexOf('DELETE FROM work_order_pricing_history'));
  assert.ok(cleanup.indexOf('DELETE FROM work_order_pricing_history') < cleanup.indexOf('DELETE FROM work_order_payment_schedule'));
  assert.ok(cleanup.indexOf('DELETE FROM work_order_field_days') < cleanup.indexOf('DELETE FROM work_orders'));
  assert.ok(cleanup.indexOf('DELETE FROM work_orders') < cleanup.indexOf('DELETE FROM engineers'));
  assert.ok(cleanup.indexOf('DELETE FROM work_orders') < cleanup.indexOf('DELETE FROM customers'));
  assert.doesNotMatch(cleanup, /WHERE\s+(?:email|phone|name|status)\s*=|LIKE|GLOB/i);
  assert.match(cleanup, /WHERE id IN \('claim-exact-1','claim-exact-2'\)/);

  const residue = buildQuoteExecutionResidueSql(context, ids);
  assert.match(residue, /total_residue/);
  assert.match(residue, /history-exact-1/);
  assert.match(residue, /SAGEMRO_SMOKE_QUOTE_EXECUTION_com_20260725123045_WORK_ORDER/);
});

test('pending receipt claim seed uses exact provenance and immediately enters Admin review', () => {
  const context = buildQuoteExecutionSmokeContext({
    market: 'com',
    baseUrl: 'https://api.sagemro.com',
    database: 'sagemro-db',
    stamp: '20260725123045',
    customerIdentity: 'customer-smoke@example.invalid',
    engineerIdentity: 'engineer-smoke@example.invalid',
  });
  const sql = buildPendingReceiptClaimSql({
    context,
    claimId: context.partialClaimId,
    installmentId: context.installmentIds[0],
    claimedAmount: 300,
    idempotencyKey: `${context.partialClaimId}_SUBMISSION`,
  });

  assert.match(sql, /INSERT INTO work_order_receipt_claims \(/);
  for (const exactValue of [
    context.partialClaimId,
    context.installmentIds[0],
    context.workOrderId,
    context.engineerId,
    `${context.partialClaimId}_SUBMISSION`,
  ]) assert.match(sql, new RegExp(exactValue));
  assert.match(sql, /300, NULL/);
  assert.match(sql, /'pending'/);
  assert.match(sql, /SET status = 'pending_confirmation'/);
  assert.match(sql, /status IN \('collecting', 'partially_received', 'overdue'\)/);
  assert.doesNotMatch(sql, /WHERE\s+(?:email|phone|name|status)\s*=|LIKE|GLOB/i);
});

test('smoke source exercises the complete quote execution lifecycle and guaranteed cleanup', () => {
  for (const marker of [
    '/pricing/approve',
    '/pricing/confirm',
    '/collect',
    '/payment-method',
    '/receipt-claims',
    '/decision',
    '/payment/start-request',
    '/payment/approve-start',
    'INSERT INTO work_order_field_days',
    '/resolve',
    '/archive',
    'partially_received',
    'financially_settled',
    'allowance_exhausted',
  ]) {
    assert.match(scriptSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(scriptSource, /try\s*\{/);
  assert.match(scriptSource, /finally\s*\{/);
  assert.match(scriptSource, /buildQuoteExecutionCleanupSql/);
  assert.match(scriptSource, /buildQuoteExecutionResidueSql/);
  assert.match(scriptSource, /audit\.target_id IN \(SELECT id FROM work_order_installments WHERE work_order_id=/);
  assert.match(scriptSource, /audit\.target_id IN \(SELECT id FROM work_order_receipt_claims WHERE work_order_id=/);
  assert.match(scriptSource, /audit\.target_id IN \(SELECT id FROM work_order_field_days WHERE work_order_id=/);
  assert.match(scriptSource, /init\.customer\s*\?\s*context\.customerOrigin\s*:\s*context\.engineerOrigin/);
  assert.match(scriptSource, /cleanup-late/);
  assert.match(scriptSource, /INSERT INTO work_order_pricing \(/);
  assert.match(scriptSource, /INSERT INTO work_order_pricing_history \(/);
  assert.match(scriptSource, /INSERT INTO work_order_payment_schedule \(/);
  assert.match(scriptSource, /context\.pricingId/);
  assert.match(scriptSource, /context\.quoteHistoryId/);
  assert.match(scriptSource, /context\.scheduleIds\[0\]/);
  assert.match(scriptSource, /context\.scheduleIds\[1\]/);
  assert.match(scriptSource, /INSERT INTO work_order_receipt_claims \(/);
  assert.match(scriptSource, /context\.partialClaimId/);
  assert.match(scriptSource, /context\.requiredFinalClaimId/);
  assert.match(scriptSource, /context\.laterFinalClaimId/);
  assert.match(scriptSource, /status = 'pending_confirmation'/);
  assert.match(scriptSource, /receiptClaimIds:\s*\[\.\.\.context\.receiptClaimIds\]/);
  assert.doesNotMatch(scriptSource, /ids\.installmentIds\s*=\s*\(execution\.installments/);
  assert.doesNotMatch(scriptSource, /ids\.scheduleIds\s*=\s*\(execution\.payment_schedule/);
  assert.doesNotMatch(scriptSource, /response\.body\?*\.claim\?*\.id|response\.body\.claim\.id/);
  assert.doesNotMatch(scriptSource, /method:\s*'POST'[^\n]*\/receipt-claims/);
  assert.doesNotMatch(scriptSource, /SELECT id, 'claim' AS kind FROM work_order_receipt_claims/);
  assert.match(scriptSource, /required installment blocks service start after partial receipt/);
  assert.match(scriptSource, /response\.status === 409/);
  assert.doesNotMatch(scriptSource, /DELETE[\s\S]{0,100}WHERE\s+(?:email|phone|name|status)\s*=|DELETE[\s\S]{0,100}(?:LIKE|GLOB)/i);
});

test('deployment runbook reflects parallel main deployment jobs before COM smoke', () => {
  assert.match(deploySource, /deploy\.yml[^\n]*Worker[^\n]*international frontend[^\n]*Admin[^\n]*parallel/i);
  assert.match(deploySource, /all three[^\n]*succeed[^\n]*COM smoke/i);
  assert.doesNotMatch(deploySource, /deploy the shared Worker from `main`, then the international frontend and Admin/i);
});

test('sanitized results and summaries do not retain credentials or tokens', () => {
  const sanitized = sanitizeQuoteExecutionStepResult({
    status: 200,
    durationMs: 7,
    path: '/api/auth/login',
    body: {
      token: 'jwt-secret',
      password: 'plain-secret',
      admin_identity: 'admin-secret@example.invalid',
      installment: { id: 'installment-1', status: 'received' },
    },
  });

  assert.deepEqual(sanitized, {
    status: 200,
    durationMs: 7,
    path: '/api/auth/login',
    installment: { id: 'installment-1', status: 'received' },
  });
  assert.doesNotMatch(JSON.stringify(sanitized), /jwt-secret|plain-secret|admin-secret/);
  assert.match(scriptSource, /status:\s*report\.passed\s*\?\s*'PASS'\s*:\s*'FAIL'/);
  assert.match(scriptSource, /\[\$\{summary\.market\}\]\s+\$\{summary\.status\}/);
  assert.doesNotMatch(scriptSource, /console\.(?:log|error)\([^\n]*(?:password|token|identity)/i);
});
