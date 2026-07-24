import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

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

test('service-order actions use one controlled operation dialog for payment, payout, and quote return', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /const \[operationDialog, setOperationDialog\] = useState\(null\)/);
  assert.match(source, /function openOperationDialog\(type, workOrder, values = \{\}\)/);
  assert.match(source, /operationDialog\.type === 'payout'/);
  assert.match(source, /name="amount"/);
  assert.match(source, /name="transaction_reference"/);
  assert.match(source, /name="internal_note"/);
  assert.match(source, /operationDialog\.type === 'quote-return'/);
  assert.match(source, /!values\.reason\.trim\(\)/);
});

test('engineer payout controls are limited to completed work orders', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /detail\.status === 'completed'[\s\S]*Engineer service payment/);
  assert.match(source, /detail\.payout_status !== 'completed'[\s\S]*Mark payout processing/);
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
  assert.match(source, /async function refreshOpenDetail\(expectedWorkOrderId\)/);
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
