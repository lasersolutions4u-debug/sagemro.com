import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  createLatestWorkOrderTitleSaveRunner,
  issueWorkOrderInvoice,
} from './workOrderMutations.js';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('pending quote approval is only available inside the full order drawer', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const tableStart = source.indexOf('<table');
  const drawerStart = source.indexOf('{detailOpen &&');
  const tableSource = source.slice(tableStart, drawerStart);
  const drawerSource = source.slice(drawerStart);

  assert.equal(tableSource.includes('handleApprovePricing(wo)'), false);
  assert.match(tableSource, /openDetail\(wo\)/);
  assert.match(drawerSource, /<QuoteExecutionAdminPanel[\s\S]*detail=\{detail\}[\s\S]*readOnly=\{readOnly\}[\s\S]*onOpenDialog=\{openOperationDialog\}/);
  assert.doesNotMatch(tableSource, /pricing\/approve/);
});

test('Admin can edit the persisted short title while operations stays read-only', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(api, /export async function updateAdminWorkOrderTitle/);
  assert.match(api, /workorders\/\$\{workOrderId\}\/short-title/);
  assert.match(source, /updateAdminWorkOrderTitle/);
  assert.match(source, /const \[titleEditor, setTitleEditor\]/);
  assert.match(source, /maxLength=\{100\}/);
  assert.match(source, /\(\) => updateAdminWorkOrderTitle\(workOrderId, titleEditor\.value\)/);
  assert.match(source, /setDetail\(\(current\) => current\?\.id === workOrderId/);
  assert.match(source, /setData\(\(current\) => \(\{[\s\S]*short_title/);
  assert.match(source, /\{!readOnly && [\s\S]*titleEditor\.open/);
  assert.match(source, /titleEditor\.error/);
  assert.doesNotMatch(source, /window\.prompt/);
});

test('title save completion only mutates the editor instance that initiated it', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /workOrderId: null/);
  assert.match(source, /editorId: 0/);
  assert.match(source, /const editorId = titleEditor\.editorId/);
  assert.match(source, /const workOrderId = titleEditor\.workOrderId/);
  assert.match(source, /\(\) => updateAdminWorkOrderTitle\(workOrderId, titleEditor\.value\)/);
  assert.equal(
    source.match(/current\.editorId === editorId && current\.workOrderId === workOrderId/g)?.length,
    2,
  );
});

test('same-order title saves only apply the latest response when requests finish out of order', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const runLatestSave = createLatestWorkOrderTitleSaveRunner();
  const first = createDeferred();
  const second = createDeferred();
  const applied = [];
  const errors = [];

  const firstSave = runLatestSave(
    42,
    () => first.promise,
    (value) => applied.push(value),
    (error) => errors.push(error),
  );
  const secondSave = runLatestSave(
    42,
    () => second.promise,
    (value) => applied.push(value),
    (error) => errors.push(error),
  );

  second.resolve({ short_title: '最新标题' });
  await secondSave;
  first.resolve({ short_title: '旧标题' });
  await firstSave;

  assert.deepEqual(applied, [{ short_title: '最新标题' }]);
  assert.deepEqual(errors, []);
  assert.match(source, /createLatestWorkOrderTitleSaveRunner/);
  assert.match(source, /latestTitleSaveRunner\.current\(\s*workOrderId/);
});

test('China invoice issuing remains independent while a title save is pending', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const runLatestSave = createLatestWorkOrderTitleSaveRunner();
  const titleRequest = createDeferred();
  const invoiceRequest = createDeferred();
  const appliedTitles = [];
  const invoiceCalls = [];

  const titleSave = runLatestSave(
    42,
    () => titleRequest.promise,
    (value) => appliedTitles.push(value),
    () => {},
  );
  const invoiceIssue = issueWorkOrderInvoice({
    workOrderId: 42,
    invoiceNumber: 'CN-2026-001',
    processInvoice: (workOrderId, payload) => {
      invoiceCalls.push({ workOrderId, payload });
      return invoiceRequest.promise;
    },
  });

  invoiceRequest.resolve({ ok: true });
  assert.deepEqual(await invoiceIssue, {
    status: 'issued',
    invoice_number: 'CN-2026-001',
  });
  assert.deepEqual(invoiceCalls, [{
    workOrderId: 42,
    payload: { action: 'issue', invoice_number: 'CN-2026-001' },
  }]);
  assert.deepEqual(appliedTitles, []);

  titleRequest.resolve({ short_title: '泵站年度检修' });
  await titleSave;
  assert.deepEqual(appliedTitles, [{ short_title: '泵站年度检修' }]);
  assert.match(source, /issueWorkOrderInvoice\(\{/);
});

test('the complete title editor branch is structurally hidden from read-only operations', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /\{!readOnly && detail && titleEditor\.open \? \([\s\S]*<input/);
  assert.doesNotMatch(source, /\{detail && titleEditor\.open \? \([\s\S]*<input/);
});

test('versioned quote and receipt decisions use the controlled operation dialog with exact version and stable retry key', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /reviewWorkOrderQuote/);
  assert.match(source, /decideInstallmentReceipt/);
  assert.match(source, /'quote-approve'/);
  assert.match(source, /'quote-return'/);
  assert.match(source, /'receipt-confirm-full'/);
  assert.match(source, /'receipt-confirm-partial'/);
  assert.match(source, /'receipt-reject'/);
  assert.match(source, /reviewWorkOrderQuote\(wo\.id, action, quoteVersion, note\)/);
  assert.match(source, /confirmed_amount/);
  assert.match(source, /idempotency_key/);
  assert.match(source, /createOperationKey\(\)/);
  assert.doesNotMatch(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /setOperationDialog\(null\)/);
  assert.match(source, /!values\.reason\.trim\(\)/);
  assert.match(source, /operationDialog\.type === 'receipt-confirm-partial'/);
  assert.match(source, /operationDialog\.type === 'receipt-reject'/);
  assert.doesNotMatch(source, /window\.prompt/);
});

test('payment indicators retain the service status and render list/detail payment projections', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /function PaymentIndicators/);
  assert.match(source, /workOrder\.payment_state/);
  assert.match(source, /workOrder\.received_amount/);
  assert.match(source, /workOrder\.outstanding_amount/);
  assert.match(source, /workOrder\?\.payment_currency/);
  assert.match(source, /workOrder\?\.pending_receipt_claim_count/);
  assert.match(source, /pendingCount \?\? t\.paymentUnknown/);
  assert.match(source, /receivedAmount != null && <span/);
  assert.match(source, /outstandingAmount != null && <span/);
  assert.doesNotMatch(source, /pricing_total_amount \|\| wo\.pricing_subtotal\)\} USD/);
  assert.match(source, /pending_claim_count/);
  assert.match(source, /<PaymentIndicators workOrder=\{wo\} t=\{t\} \/>/);
  assert.match(source, /<PaymentIndicators workOrder=\{detail\} t=\{t\} \/>/);
  assert.match(source, /t\.statuses\[wo\.status\]/);
});

test('admin drawer supports onsite confirmation, arrival audit, and manual override', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(api, /onsite-conversion\/confirm/);
  assert.match(api, /arrival-override/);
  assert.match(source, /confirmAdminOnsiteConversion/);
  assert.match(source, /overrideAdminArrival/);
  assert.match(source, /arrival_checks/);
  assert.match(source, /onsite_conversion_status/);
  assert.match(source, /adminSiteLocation\.service_latitude === ''/);
  assert.match(source, /adminSiteLocation\.service_longitude === ''/);
  assert.doesNotMatch(source, /window\.prompt/);
  assert.match(source, /role="dialog" aria-modal="true" aria-label=\{operationDialog\.title\}/);
  assert.match(source, /operationDialog\.type === 'arrival-override'/);
  assert.match(source, /!values\.reason\.trim\(\)/);
});

test('service-order actions and China invoice processing use one controlled operation dialog', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /const \[operationDialog, setOperationDialog\] = useState\(null\)/);
  assert.match(source, /operationDialog\.type === 'payout'/);
  assert.match(source, /name="amount"/);
  assert.match(source, /name="transaction_reference"/);
  assert.match(source, /name="internal_note"/);
  assert.match(source, /operationDialog\.type === 'invoice'/);
  assert.match(source, /name="invoice_number"/);
  assert.match(source, /!values\.invoice_number\.trim\(\)/);
  assert.match(source, /setOperationDialog\(\(current\) => \(current \? \{ \.\.\.current, error: operationError \} : current\)\)/);
  assert.match(source, /!readOnly && detailInvoice\.status === 'pending'/);
});

test('admin drawer can confirm the completed service balance payment', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(api, /payment\/approve-balance/);
  assert.match(source, /approveAdminWorkOrderBalance/);
  assert.match(source, /detail\.balance_payment\?\.status/);
  assert.match(source, /确认尾款到账/);
});

test('engineer payout controls are limited to completed work orders and lock after completion', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /detail\.status === 'completed'[\s\S]*t\.engineerPayoutTitle/);
  assert.match(source, /detail\.payout_status !== 'completed'[\s\S]*t\.markPayoutProcessing/);
});

test('operations staff receive a read-only service-order view', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /export function WorkOrdersPage\(\{ readOnly = false \}\)/);
  assert.match(source, /if \(readOnly\) return;/);
  assert.match(source, /\{!readOnly && wo\.status === 'payment_review'/);
  assert.match(source, /\{!readOnly && detail\.pricing\?\.status === 'pending_review'/);
  assert.match(source, /<QuoteExecutionAdminPanel[\s\S]*readOnly=\{readOnly\}/);
  assert.match(source, /\{!readOnly && \([\s\S]*submitInternalNote/);
});

test('service-order list and drawer integrate field operations with refreshable indicators', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ FieldWorkAdminPanel \} from '\.\.\/components\/FieldWorkAdminPanel'/);
  assert.match(source, /field_checked_in_today/);
  assert.match(source, /field_report_overdue_count/);
  assert.match(source, /field_extension_pending/);
  assert.match(source, /async function refreshOpenDetail\(expectedWorkOrderId, isCurrent = \(\) => true\)/);
  assert.match(source, /getAdminWorkOrder\(expectedWorkOrderId\)/);
  assert.match(source, /setDetail\(\(current\) => current\?\.id === expectedWorkOrderId \? detailData : current\)/);
  assert.match(source, /<FieldWorkAdminPanel[\s\S]*workOrder=\{detail\}[\s\S]*readOnly=\{readOnly\}[\s\S]*onRefresh=\{refreshOpenDetail\}/);
});

test('arrival audit treats unavailable location as allowed evidence instead of a failed geofence check', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /function arrivalCheckOutcome/);
  assert.match(source, /location_unavailable/);
  assert.match(source, /failure_reason === 'unavailable'/);
  assert.match(source, /function arrivalCheckOutcome\(check, t\)/);
  assert.match(source, /arrivalLocationUnavailable: 'Location unavailable · photo evidence accepted'/);
  assert.match(source, /arrivalLocationUnavailable: '无法定位 · 已接受照片证据'/);
  assert.match(source, /arrivalPassed: 'Passed'/);
  assert.match(source, /arrivalPassed: '已通过'/);
  assert.match(source, /arrivalOutsideGeofence: 'Outside geofence'/);
  assert.match(source, /arrivalOutsideGeofence: '位于围栏外'/);
  assert.match(source, /arrivalCheckOutcome\(check, t\)/);
  assert.doesNotMatch(source, /label: check\.failure_reason/);
  assert.match(source, /className=\{arrivalOutcome\.tone\}/);
  assert.match(source, /formatApiDateTime\(check\.created_at/);
  assert.match(source, /min-w-0[^"]*\[overflow-wrap:anywhere\]/);
});

test('detail drawer is summary-first with bilingual shortcut navigation', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const drawer = source.slice(source.indexOf('{detailOpen &&'));
  assert.match(drawer, /<WorkOrderDetailNav/);
  assert.match(drawer, /<WorkOrderDetailSummary/);
  assert.ok(drawer.indexOf('<WorkOrderDetailSummary') < drawer.indexOf('<ServiceStandardAdminPanel'));
  for (const key of ['overview', 'quote', 'dispatch', 'serviceControls', 'filesReport', 'reviewsMessages']) {
    assert.match(source, new RegExp(`${key}:`));
  }
});

test('shortcut navigation expands and scrolls to a detail section', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /function navigateToDetailSection\(sectionKey\)/);
  assert.match(source, /setOpenDetailSections/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
});

test('loaded detail opens the section containing its current operator control', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.match(
    source,
    /setDetail\(detailData\);\s*setOpenDetailSections\(new Set\(defaultOpenWorkOrderSections\(detailData\)\)\);/,
  );
});

test('legacy parts quote uses a horizontally scrollable readable-width table', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const legacyQuoteStart = source.indexOf("{!detail.pricing?.quote_version && <section");
  const legacyQuoteEnd = source.indexOf("{detail.status === 'completed' && (", legacyQuoteStart);
  assert.ok(legacyQuoteStart >= 0);
  assert.ok(legacyQuoteEnd >= 0);
  assert.ok(legacyQuoteEnd > legacyQuoteStart);
  const legacyQuote = source.slice(legacyQuoteStart, legacyQuoteEnd);
  assert.match(legacyQuote, /overflow-x-auto/);
  assert.match(legacyQuote, /<table className="min-w-/);
  assert.doesNotMatch(legacyQuote, /overflow-hidden rounded-lg border/);
});

test('overview current-action card uses current, completed, and neutral semantic tones', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /const actionTone = currentActionTone\(actionKey\)/);
  assert.match(source, /actionTone === 'current'/);
  assert.match(source, /actionTone === 'complete'/);
  assert.match(source, /color-success/);
  assert.match(source, /color-surface-elevated/);
});

test('work-order headers localize pending review in both markets', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /statuses: \{[\s\S]*pending_review: 'Pending review'/);
  assert.match(source, /statuses: \{[\s\S]*pending_review: '待审核'/);
});

test('reviews and messages render once and messages do not create nested vertical scrolling', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.equal(source.match(/\{t\.customerReviewTitle\}/g)?.length, 1);
  assert.equal(source.match(/\{t\.engineerReviewTitle\}/g)?.length, 1);
  assert.equal(source.match(/\{t\.messagesTitle\}/g)?.length, 1);
  assert.doesNotMatch(source, /max-h-72 space-y-2 overflow-y-auto/);
});

test('visible detail labels are localized instead of hard-coded English', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, />Engineer service payment</);
  assert.doesNotMatch(source, /label="Labor Fee"/);
  assert.match(source, /engineerPayoutTitle: 'Engineer service payment'/);
  assert.match(source, /engineerPayoutTitle: '工程师服务费结算'/);
  assert.match(source, /laborFee: 'Labor fee'/);
  assert.match(source, /laborFee: '人工费'/);
});

test('detail summary falls back to the active market currency', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /function WorkOrderDetailSummary\(\{ detail, t, defaultCurrency = 'USD' \}\)/);
  assert.match(source, /paymentCurrency\(detail\) \|\| defaultCurrency/);
  assert.match(source, /<WorkOrderDetailSummary detail=\{detail\} t=\{t\} defaultCurrency=\{CURRENCY\} \/>/);
});

test('service controls receive work-order status and report current blockers to the drawer', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /workOrderStatus=\{detail\.status\}/);
  assert.match(source, /onBlockerStateChange/);
  assert.match(source, /count > 0[\s\S]*'service-controls'/);
});

test('balance payment statuses use bilingual labels instead of stored enum values', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /balancePaymentStatuses: \{[\s\S]*instructions_requested: 'Payment instructions requested'[\s\S]*pending_admin_confirmation: 'Pending Admin confirmation'/);
  assert.match(source, /balancePaymentStatuses: \{[\s\S]*instructions_requested: '已申请付款说明'[\s\S]*pending_admin_confirmation: '待管理员确认'/);
  assert.match(source, /t\.balancePaymentStatuses\[detail\.balance_payment\.status\] \|\| t\.sectionEmpty/);
  assert.doesNotMatch(source, /\{t\.statusLabel\}: \{detail\.balance_payment\.status\}/);
});

test('generic and historical drawer badges do not use the primary action color', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const drawer = source.slice(source.indexOf('{detailOpen &&'), source.indexOf('{operationDialog &&'));
  const headerStatus = drawer.slice(drawer.indexOf('{detail.order_no}'), drawer.indexOf('{detail.description}'));
  const pricingStatus = drawer.slice(drawer.indexOf('{detail.pricing?.status && ('), drawer.indexOf('</span>', drawer.indexOf('{detail.pricing?.status && (')) + 7);
  const completedPayout = drawer.slice(drawer.indexOf("{detail.status === 'completed'"), drawer.indexOf('<div className="flex flex-col', drawer.indexOf("{detail.status === 'completed'")));
  const customerAverage = drawer.slice(drawer.indexOf('{detail.rating && ('), drawer.indexOf('</span>', drawer.indexOf('{detail.rating && (')) + 7);
  const engineerAverage = drawer.slice(drawer.indexOf('{detail.engineer_review && ('), drawer.indexOf('</span>', drawer.indexOf('{detail.engineer_review && (')) + 7);

  for (const historicalBadge of [headerStatus, pricingStatus, customerAverage, engineerAverage]) {
    assert.doesNotMatch(historicalBadge, /color-primary/);
    assert.match(historicalBadge, /color-(?:surface-elevated|text-secondary|border)/);
  }
  assert.doesNotMatch(completedPayout, /color-primary/);
  assert.match(completedPayout, /color-success/);
});

test('historical internal notes are neutral while retaining the explicit privacy label', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const internalNoteRow = source.slice(
    source.indexOf("item.is_internal_note ?"),
    source.indexOf("' : 'bg-[var(--color-surface-elevated)]", source.indexOf("item.is_internal_note ?")),
  );

  assert.doesNotMatch(internalNoteRow, /amber|color-primary/);
  assert.match(internalNoteRow, /border-\[var\(--color-border\)\]/);
  assert.match(internalNoteRow, /bg-\[var\(--color-surface-elevated\)\]/);
  assert.match(internalNoteRow, /text-\[var\(--color-text-secondary\)\]/);
  assert.match(source, /internalNote: 'Internal note'/);
  assert.match(source, /internalNote: '内部备注'/);
  assert.match(source, /item\.is_internal_note \? ` · \$\{t\.internalNote\}` : ''/);
});
