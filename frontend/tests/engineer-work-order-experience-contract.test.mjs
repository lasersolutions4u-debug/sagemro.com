import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('engineer work-order display helpers sort by action and redact contact data', async () => {
  const { getEngineerWorkOrderTitle, sortEngineerWorkOrders } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');
  const tickets = [
    { id: 'done', status: 'completed', created_at: '2026-07-25T10:00:00Z' },
    { id: 'quote', status: 'pricing', created_at: '2026-07-24T10:00:00Z' },
    { id: 'assigned', status: 'assigned', created_at: '2026-07-23T10:00:00Z' },
  ];

  assert.deepEqual(sortEngineerWorkOrders(tickets).map((ticket) => ticket.id), ['assigned', 'quote', 'done']);
  assert.deepEqual(tickets.map((ticket) => ticket.id), ['done', 'quote', 'assigned']);
  assert.equal(
    getEngineerWorkOrderTitle({ description: 'Call jane@example.com about the laser fault.' }, false, 'Service task'),
    'Call XXX about the laser fault.',
  );
});

test('engineer workspace uses focused list/detail navigation without checklist persistence', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /EngineerWorkOrderList/);
  assert.match(workspace, /EngineerWorkOrderDetail/);
  assert.match(workspace, /const \[workOrderFilter, setWorkOrderFilter\] = useState\('all'\)/);
  assert.match(workspace, /selectedTicket \?/);
  assert.doesNotMatch(workspace, /<WorkOrderDetailModal/);
  assert.doesNotMatch(workspace, /personalMetrics|regionalMetrics|const metrics/);
  assert.doesNotMatch(workspace, /saveChecklist|updateChecklist|checklist_progress|type="checkbox"/);
  assert.match(workspace, /EngineerAvailabilityCalendar/);
  assert.match(workspace, /assignEngineerWorkOrder/);
  assert.match(workspace, /acceptTicket/);
  assert.match(workspace, /rejectTicket/);
});

test('engineer list has action filters, schedule context, retry, and support contact', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  assert.match(list, /sortEngineerWorkOrders\(tickets\)/);
  assert.match(list, /getEngineerWorkOrderTitle/);
  assert.match(list, /getEngineerScheduleLabel/);
  assert.match(list, /onFilterChange/);
  assert.match(list, /onRetry/);
  assert.match(list, /href="mailto:support@sagemro\.com"/);
  assert.match(list, /No assigned service tasks yet/);
});

test('engineer detail presents context, preparation, read-only checklist, conflict warning, and inline tools', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.ok(detail.indexOf('Current Task Context') < detail.indexOf('Job Preparation'));
  assert.ok(detail.indexOf('Job Preparation') < detail.indexOf('Service Standard Checklist'));
  assert.match(detail, /getWorkOrder\(ticket\.id\)/);
  assert.match(detail, /getEngineerScheduleLabel/);
  assert.match(detail, /conflict_status === 'blocked'/);
  assert.match(detail, /href="mailto:support@sagemro\.com"/);
  assert.match(detail, /WorkOrderDetailContent/);
  assert.doesNotMatch(detail, /type="checkbox"|saveChecklist|setChecklist/);
  assert.match(detail, /detailLoadedRef/);
  assert.match(detail, /effectiveStatus = detail\?\.status \?\? ticket\.status/);
});

test('work-order modal exposes inline content while retaining main advanced panels', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(modal, /export function WorkOrderDetailContent/);
  assert.match(modal, /export function WorkOrderDetailModal/);
  assert.match(modal, /showInfoTab/);
  assert.match(modal, /initialTab/);
  assert.match(modal, /isActive/);
  assert.match(modal, /CollectionPanel/);
  assert.match(modal, /FieldWorkPanel/);
  assert.match(modal, /MaterialRequisitionPanel/);
  assert.match(modal, /PaymentModal/);
  assert.match(modal, /EngineerPricingPanel/);
  assert.match(modal, /CustomerPricingPanel/);
  assert.match(modal, /MessagePanel/);
  assert.match(modal, /RepairRecordPanel/);
  assert.match(modal, /const effectiveStatus = detail\?\.status \?\? workOrder\?\.status/);
});

test('work-order modal syncs parent status without resetting the active tool tab', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const syncStart = modal.indexOf('previousIncomingSummaryRef');
  const syncEnd = modal.indexOf('const previousIsActiveRef');

  assert.ok(syncStart > -1 && syncEnd > syncStart);
  assert.match(modal, /status: incomingStatus/);
  assert.match(modal, /quote_review_status: incomingQuoteReviewStatus/);
  assert.match(modal.slice(syncStart, syncEnd), /setDetail\(\(current\) =>/);
  assert.doesNotMatch(modal.slice(syncStart, syncEnd), /setTab/);
});

test('work-order modal waits for refreshed detail before clearing a requested collection tab', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const tabGuardStart = modal.indexOf('const allowedTabKeyString');
  const tabGuardEnd = modal.indexOf('if (!workOrder) return null;', tabGuardStart);
  assert.ok(tabGuardStart > -1 && tabGuardEnd > tabGuardStart);
  const tabGuard = modal.slice(tabGuardStart, tabGuardEnd);
  assert.match(tabGuard, /if \(loading \|\| !detail\) return;/);
});

test('engineer inline tools retain the payment start approval action when details are hidden', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  assert.match(modal, /!showInfoTab && renderPaymentStartAction\(\)/);
  assert.match(modal, /Request Admin Approval to Start/);
});
