import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('quote execution Admin APIs send an exact quote version and receipt decision payload', async () => {
  const api = await readSource('../services/api.js');

  assert.match(api, /export async function reviewWorkOrderQuote\(workOrderId, action, quoteVersion, note = ''\)[\s\S]*pricing\/\$\{action\}[\s\S]*method: 'PATCH'[\s\S]*quote_version: quoteVersion, note/);
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
