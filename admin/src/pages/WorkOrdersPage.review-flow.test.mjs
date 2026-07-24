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
  assert.match(drawerSource, /handleApprovePricing\(detail\)/);
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
