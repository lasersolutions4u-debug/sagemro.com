import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Admin receipt review identifies staff submitters without labelling their notes as engineer notes', async () => {
  const source = await readSource('./QuoteExecutionAdminPanel.jsx');
  assert.match(source, /submitter_type/);
  assert.match(source, /submitter_id/);
  assert.match(source, /submitter_note/);
  assert.match(source, /Submitter note/);
  assert.match(source, /提交人备注/);
});

test('business receipt upload preserves multipart boundary, scoped identity and CSRF', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  const sent = [];
  globalThis.localStorage = { getItem: key => key === 'admin_csrf_token' ? 'fictional-csrf' : null };
  globalThis.fetch = async (url, options) => { sent.push({ url, ...options }); return Response.json({ success: true }); };
  try {
    const api = await import('../services/api.js');
    const scope = { expected_staff_id: 'fictional-staff', scope_version: 'fictional-scope', quote_version: 2 };
    await api.getBusinessPayments('order/fictional', scope.expected_staff_id, scope.scope_version);
    assert.match(sent[0].url, /order%2Ffictional\/payments\?expected_staff_id=fictional-staff&scope_version=fictional-scope$/);
    await api.startBusinessCollection('order/fictional', 'installment/1', scope);
    assert.deepEqual(JSON.parse(sent[1].body), scope);
    assert.equal(sent[1].method, 'POST');
    const form = new FormData();
    for (const [key, value] of Object.entries(scope)) form.set(key, value);
    form.set('claimed_amount', '900');
    form.set('idempotency_key', 'fictional-receipt');
    form.set('evidence', new Blob(['%PDF-fictional'], { type: 'application/pdf' }), 'fixture.pdf');
    await api.submitBusinessReceipt('order/fictional', 'installment/1', form);
    assert.match(sent[2].url, /installments\/installment%2F1\/receipt-claims$/);
    assert.equal(sent[2].headers['Content-Type'], undefined);
    assert.equal(sent[2].headers['X-CSRF-Token'], 'fictional-csrf');
    assert.equal(sent[2].credentials, 'include');
    assert.equal(sent[2].body.get('expected_staff_id'), 'fictional-staff');
    assert.equal(sent[2].body.get('evidence').name, 'fixture.pdf');
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});

test('business review API pins identity and scope without allowing context to replace quote data', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  let sent;
  globalThis.localStorage = { getItem: () => null };
  globalThis.fetch = async (url, options) => { sent = { url, ...options, body: JSON.parse(options.body) }; return Response.json({ success: true }); };
  try {
    const { reviewWorkOrderQuote } = await import('../services/api.js');
    await reviewWorkOrderQuote('order-fixture', 'approve', 7, 'Example note', {
      expected_staff_id: 'admin', scope_version: 'scope-fixture', quote_version: 999, note: 'Not permitted', parts_cost: 500,
    });
    assert.equal(sent.method, 'PATCH');
    assert.equal(sent.credentials, 'include');
    assert.deepEqual(sent.body, { quote_version: 7, note: 'Example note', expected_staff_id: 'admin', scope_version: 'scope-fixture' });
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});

test('quote execution Admin APIs send an exact quote version and receipt decision payload', async () => {
  const api = await readSource('../services/api.js');

  assert.match(api, /export async function reviewWorkOrderQuote\(workOrderId, action, quoteVersion, note = '', businessContext\)[\s\S]*pricing\/\$\{action\}[\s\S]*method: 'PATCH'[\s\S]*quote_version: quoteVersion, note/);
  assert.match(api, /expected_staff_id: businessContext\.expected_staff_id/);
  assert.match(api, /scope_version: businessContext\.scope_version/);
  assert.match(api, /export async function decideInstallmentReceipt\(workOrderId, installmentId, claimId, payload\)[\s\S]*receipt-claims\/\$\{claimId\}\/decision[\s\S]*method: 'POST'[\s\S]*body: JSON\.stringify\(payload\)/);
  assert.match(api, /export async function getAuthenticatedReceiptEvidenceUrl\(workOrderId, evidenceId\)[\s\S]*receipt-evidence\/\$\{evidenceId\}[\s\S]*credentials: 'include'[\s\S]*headers: authHeaders\(\)[\s\S]*URL\.createObjectURL/);
});

test('quote execution panel renders the complete versioned commercial package before review', async () => {
  const panel = await readSource('./QuoteExecutionAdminPanel.jsx');

  assert.match(panel, /export function QuoteExecutionAdminPanel\(\{ detail, readOnly = false, onRefresh, onOpenDialog \}\)/);
  assert.match(panel, /pricing\.quote_version/);
  assert.match(panel, /pricing\.expected_service_days/);
  assert.match(panel, /labor_fee/);
  assert.match(panel, /parts_fee/);
  assert.match(panel, /travel_fee/);
  assert.match(panel, /other_fee/);
  assert.match(panel, /payment_schedule/);
  assert.match(panel, /Number\(schedule\.quote_version\) === quoteVersion/);
  assert.match(panel, /triggerLabels/);
  assert.match(panel, /before_start:/);
  assert.match(panel, /on_arrival:/);
  assert.match(panel, /milestone:/);
  assert.match(panel, /on_completion:/);
  assert.match(panel, /on_acceptance:/);
  assert.match(panel, /fixed_date:/);
  assert.doesNotMatch(panel, /\{schedule\.trigger_type\}/);
});

test('quote execution panel renders pending receipt evidence and distinct decision choices', async () => {
  const panel = await readSource('./QuoteExecutionAdminPanel.jsx');

  assert.match(panel, /receipt_claims/);
  assert.match(panel, /claim\.status === 'pending'/);
  assert.match(panel, /installment\.amount/);
  assert.match(panel, /installment\.received_amount/);
  assert.match(panel, /claim\.claimed_amount/);
  assert.match(panel, /remainingAmount/);
  assert.match(panel, /claim\.evidence\?\.url/);
  assert.match(panel, /getAuthenticatedReceiptEvidenceUrl/);
  assert.match(panel, /type="button"/);
  assert.match(panel, /window\.open\('', '_blank'\)/);
  assert.ok(panel.indexOf("window.open('', '_blank')") < panel.indexOf('await getAuthenticatedReceiptEvidenceUrl'));
  assert.match(panel, /opened\.location\.replace\(objectUrl\)/);
  assert.match(panel, /opened\.close\(\)/);
  assert.match(panel, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.match(panel, /Loading evidence/);
  assert.match(panel, /正在加载凭证/);
  assert.match(panel, /Could not load evidence/);
  assert.match(panel, /凭证加载失败/);
  assert.doesNotMatch(panel, /href=\{`\$\{runtimeConfig\.apiBase\}\$\{claim\.evidence\.url\}`\}/);
  assert.match(panel, /claim\.transaction_reference/);
  assert.match(panel, /claim\.engineer_note/);
  assert.match(panel, /'receipt-confirm-full'/);
  assert.match(panel, /'receipt-confirm-partial'/);
  assert.match(panel, /'receipt-reject'/);
  assert.match(panel, /Confirm full receipt/);
  assert.match(panel, /Confirm partial amount/);
  assert.match(panel, /Reject receipt claim/);
});

test('quote execution panel localizes review and payment states without raw enum labels', async () => {
  const panel = await readSource('./QuoteExecutionAdminPanel.jsx');

  assert.match(panel, /Quote execution review/);
  assert.match(panel, /报价与收款审核/);
  assert.match(panel, /Pending confirmation/);
  assert.match(panel, /待确认到账/);
  assert.match(panel, /paymentStateLabels/);
  assert.match(panel, /pending_confirmation:/);
  assert.match(panel, /partially_received:/);
  assert.match(panel, /financially_settled:/);
  assert.doesNotMatch(panel, /\{execution\.payment_state\}/);
});

test('quote execution panel renders nullable execution balances as localized not applicable', async () => {
  const panel = await readSource('./QuoteExecutionAdminPanel.jsx');

  assert.match(panel, /function formatNullableAmount\(value, currency, fallback\)/);
  assert.match(panel, /if \(value == null\) return fallback/);
  assert.match(panel, /formatNullableAmount\(execution\.received_amount, [^,]+, t\.notApplicable\)/);
  assert.match(panel, /formatNullableAmount\(execution\.outstanding_amount, [^,]+, t\.notApplicable\)/);
  assert.match(panel, /notApplicable: 'Not applicable'/);
  assert.match(panel, /notApplicable: '不适用'/);
  assert.doesNotMatch(panel, /formatAmount\(execution\.(?:received_amount|outstanding_amount)/);
});

test('quote execution panel exposes no mutation controls to read-only operations staff', async () => {
  const panel = await readSource('./QuoteExecutionAdminPanel.jsx');

  assert.match(panel, /if \(readOnly\) return;/);
  assert.match(panel, /!readOnly && pricing\.status === 'pending_review'/);
  assert.match(panel, /!readOnly && pendingClaims\.length > 0/);
  assert.match(panel, /Read-only/);
  assert.match(panel, /只读/);
});

test('quote execution panel places versioned approval controls after the complete commercial package', async () => {
  const panel = await readSource('./QuoteExecutionAdminPanel.jsx');

  const controls = panel.indexOf("onOpenDialog?.('quote-approve'");
  assert.ok(controls > panel.indexOf('pricing.expected_service_days'));
  assert.ok(controls > panel.indexOf('pricing.labor_fee'));
  assert.ok(controls > panel.indexOf('reviewSchedule.map'));
});
