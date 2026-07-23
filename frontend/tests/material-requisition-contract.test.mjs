import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('frontend API exposes engineer material requisition routes and idempotent receipt headers', () => {
  const api = read('frontend/src/services/api.js');

  assert.match(api, /export async function getMaterialRequisitions/);
  assert.match(api, /\/api\/material-requisitions`[\s\S]*method:\s*'GET'/);
  assert.match(api, /export async function getMaterialRequisition/);
  assert.match(api, /\/api\/material-requisitions\/\$\{requisitionId\}`[\s\S]*method:\s*'GET'/);
  assert.match(api, /export async function createMaterialRequisition/);
  assert.match(api, /\/api\/material-requisitions`[\s\S]*method:\s*'POST'/);
  assert.match(api, /export async function submitMaterialRequisition/);
  assert.match(api, /\/api\/material-requisitions\/\$\{requisitionId\}\/submit`[\s\S]*method:\s*'POST'/);
  assert.match(api, /export async function confirmMaterialRequisitionReceipt/);
  assert.match(api, /\/api\/material-requisitions\/\$\{requisitionId\}\/engineer-receipt`[\s\S]*method:\s*'POST'/);
  assert.match(api, /'Idempotency-Key':\s*idempotencyKey/);
});

test('material requisition panel supports copied preparation lines and validated multi-line drafts', () => {
  const componentPath = 'frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx';
  assert.equal(existsSync(path.join(root, componentPath)), true, 'material requisition panel should exist');
  const panel = read(componentPath);

  assert.match(panel, /getWorkOrderMaterialItems\(workOrderId, 'preparation'\)/);
  assert.match(panel, /preparationData\.list/);
  assert.match(panel, /preparationItems\.map\(\(item\)\s*=>\s*\(\{/);
  assert.match(panel, /requested_quantity:\s*String\(item\.quantity/);
  assert.match(panel, /setDraftItems\(\(current\)\s*=>\s*\[\.\.\.current,/);
  assert.match(panel, /setDraftItems\(\(current\)\s*=>\s*current\.filter/);
  assert.match(panel, /Number\.isInteger\(quantity\)\s*&&\s*quantity\s*>\s*0/);
  assert.match(panel, /work_order_id:\s*workOrderId/);
  assert.match(panel, /items:\s*draftItems\.map/);
  assert.doesNotMatch(panel, /addWorkOrderMaterialItem|updateWorkOrderMaterialItem/);
});

test('engineer can list, open, submit, and track requisitions with bilingual progress', () => {
  const panel = read('frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx');

  assert.match(panel, /requisitions\.filter\(\(item\)\s*=>\s*item\.work_order_id\s*===\s*workOrderId\)/);
  assert.match(panel, /getMaterialRequisition\(requisition\.id\)/);
  assert.match(panel, /confirmDialog\(/);
  assert.match(panel, /submitMaterialRequisition\(selectedRequisition\.id\)/);
  for (const label of ['Requested', 'Allocated', 'Ordered', 'Purchased', 'Issued', 'Engineer received', 'Expected arrival', 'Status']) {
    assert.match(panel, new RegExp(label));
  }
  for (const label of ['申请数量', '已分配', '已采购', '已到货', '已发料', '工程师签收', '预计到货', '状态']) {
    assert.match(panel, new RegExp(label));
  }
  assert.doesNotMatch(panel, /history|audit_logs|after_state|before_state/);
});

test('receipt confirmation is line-scoped and keeps a stable retry key only for unchanged transient failures', () => {
  const panel = read('frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx');

  assert.match(panel, /Number\(item\.issued_quantity\s*\|\|\s*0\)\s*>\s*Number\(item\.engineer_received_quantity\s*\|\|\s*0\)/);
  assert.match(panel, /const fingerprint = JSON\.stringify\(payload\)/);
  assert.match(panel, /retryOperation\?\.fingerprint === fingerprint/);
  assert.match(panel, /confirmMaterialRequisitionReceipt\([\s\S]*operation\.key/);
  assert.match(panel, /if \(!isTransientReceiptError\(error\)\)[\s\S]*delete receiptRetryRef\.current\[item\.id\]/);
  assert.match(panel, /delete receiptRetryRef\.current\[item\.id\][\s\S]*applyRequisitionUpdate/);
});

test('work-order details place the panel in an assigned-engineer-only tab', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(modal, /import \{ MaterialRequisitionPanel \} from '\.\/MaterialRequisitionPanel';/);
  assert.match(modal, /const assignedEngineerId = detail\?\.id === workOrder\.id[\s\S]*detail\.engineer_id[\s\S]*workOrder\.engineer_id/);
  assert.match(modal, /const isAssignedEngineer = isEngineer[\s\S]*assignedEngineerId[\s\S]*userId/);
  assert.match(modal, /if \(isAssignedEngineer\)[\s\S]*materialRequisition/);
  assert.match(modal, /tab === 'materialRequisition' && isAssignedEngineer/);
  assert.match(modal, /<MaterialRequisitionPanel workOrderId=\{workOrder\.id\}/);
  assert.doesNotMatch(modal, /isCustomer[\s\S]{0,120}<MaterialRequisitionPanel/);
});
