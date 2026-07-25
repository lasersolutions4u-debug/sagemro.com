import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('engineer work orders are sorted by required action without mutating input', async () => {
  const { sortEngineerWorkOrders } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');
  const tickets = [
    { id: 'done', status: 'completed', created_at: '2026-07-25T10:00:00Z' },
    { id: 'quote', status: 'pricing', created_at: '2026-07-24T10:00:00Z' },
    { id: 'assigned', status: 'assigned', created_at: '2026-07-23T10:00:00Z' },
  ];

  assert.deepEqual(sortEngineerWorkOrders(tickets).map((ticket) => ticket.id), ['assigned', 'quote', 'done']);
  assert.deepEqual(tickets.map((ticket) => ticket.id), ['done', 'quote', 'assigned']);
});

test('engineer work-order title and schedule helpers use existing fields only', async () => {
  const {
    getEngineerScheduleLabel,
    getEngineerWorkOrderTitle,
  } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');

  assert.equal(getEngineerWorkOrderTitle({ category_l2: 'other', description: 'Laser power drops after warm-up.' }, false, 'Service task'), 'Laser power drops after warm-up.');
  assert.equal(getEngineerWorkOrderTitle({}, true, '服务任务'), '服务任务');
  assert.equal(getEngineerScheduleLabel({ sla_deadline: '2026-07-25T06:00:00.000Z' }, 'zh-CN').length > 0, true);
  assert.equal(getEngineerScheduleLabel({}, 'en-US'), '');
});

test('engineer work-order redesign stays frontend-only', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  assert.doesNotMatch(workspace, /saveChecklist|updateChecklist|checklist_progress/);
});

test('engineer work-order list is a structured action-first list with support contact', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  assert.match(list, /sortEngineerWorkOrders\(tickets\)/);
  assert.match(list, /getEngineerWorkOrderTitle/);
  assert.match(list, /getEngineerScheduleLabel/);
  assert.match(list, /copy\.nextStep/);
  assert.match(list, /onSelectTicket\(ticket\)/);
  assert.match(list, /href="mailto:support@sagemro\.com"/);
  assert.match(list, /support@sagemro\.com/);
  assert.doesNotMatch(list, /grid-cols-5|personalMetrics|regionalMetrics/);
});

test('engineer work-order list exposes retry, empty, and localized labels', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  assert.match(list, /onRetry/);
  assert.match(list, /Failed to load service tasks/);
  assert.match(list, /服务任务加载失败/);
  assert.match(list, /No assigned service tasks yet/);
  assert.match(list, /暂无已分配服务任务/);
  assert.match(list, /View Details/);
  assert.match(list, /查看详情/);
});

test('existing work-order tools can render inline while the customer modal wrapper remains', () => {
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(detail, /export function WorkOrderDetailContent/);
  assert.match(detail, /export function WorkOrderDetailModal/);
  assert.match(detail, /<WorkOrderDetailContent/);
  assert.match(detail, /<Modal isOpen=\{isOpen\}/);
  assert.match(detail, /showInfoTab/);
  assert.match(detail, /MessagePanel/);
  assert.match(detail, /EngineerPricingPanel/);
  assert.match(detail, /RepairRecordPanel/);
});

test('inline customer review routing keeps the automatic rating tab when info is hidden', () => {
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(detail, /initialStatus === 'pending_review' \|\| initialStatus === 'resolved'/);
  assert.match(detail, /\? 'rating' : 'info'/);
  assert.match(detail, /setTab\(\(currentTab\) => \(currentTab === 'info' \? 'messages' : currentTab\)\)/);
  assert.match(detail, /\}, \[showInfoTab, tab\]\);/);
});

test('work-order modal retains detail content while closed after it has opened', () => {
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const modal = read('frontend/src/components/common/Modal.jsx');

  assert.match(detail, /<Modal isOpen=\{isOpen\}[^>]*keepMounted/);
  assert.match(modal, /keepMounted = false/);
  assert.match(modal, /hasBeenOpened/);
  assert.match(modal, /isOpen \|\| \(keepMounted && hasBeenOpened\)/);
  assert.match(modal, /hidden=\{!isOpen\}/);
});

test('work-order modal preserves drafts while inactive without background detail panels', () => {
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(detail, /isActive = true/);
  assert.match(detail, /if \(isActive && workOrderId\)/);
  assert.match(detail, /\}, \[isActive, workOrder, workOrderId, userType, loadDetail\]\);/);
  assert.match(detail, /isActive=\{isOpen\}/);
  assert.match(detail, /\{isActive && \([\s\S]*<MessagePanel[\s\S]*<EngineerPricingPanel[\s\S]*<CustomerPricingPanel[\s\S]*renderRatingTab\(\)[\s\S]*<RepairRecordPanel[\s\S]*renderMachineLeadTab\(\)/);
});

test('engineer detail uses the approved three-section reading order and inline tools', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  const contextIndex = detail.indexOf('Current Task Context');
  const preparationIndex = detail.indexOf('Job Preparation');
  const checklistIndex = detail.indexOf('Service Standard Checklist');

  assert.ok(contextIndex > -1 && contextIndex < preparationIndex && preparationIndex < checklistIndex);
  assert.match(detail, /当前任务上下文/);
  assert.match(detail, /服务准备/);
  assert.match(detail, /服务标准检查清单/);
  assert.match(detail, /WorkOrderDetailContent/);
  assert.match(detail, /sticky/);
  assert.match(detail, /lg:grid-cols-\[minmax\(0,1fr\)_/);
  assert.match(detail, /href="mailto:support@sagemro\.com"/);
});

test('engineer checklist is read-only and detail failures are recoverable', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.doesNotMatch(detail, /type="checkbox"/);
  assert.doesNotMatch(detail, /onChange=.*checklist|setChecklist|saveChecklist/);
  assert.match(detail, /getWorkOrder\(ticket\.id\)/);
  assert.match(detail, /onClick=\{loadDetail\}/);
  assert.match(detail, /Back to Work Orders/);
  assert.match(detail, /返回工单/);
});
