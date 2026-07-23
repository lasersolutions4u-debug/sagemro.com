import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('frontend API scopes lists and sends idempotency headers for draft creation and receipt', () => {
  const api = read('frontend/src/services/api.js');
  const createApi = api.slice(
    api.indexOf('export async function createMaterialRequisition'),
    api.indexOf('export async function submitMaterialRequisition'),
  );
  const receiptApi = api.slice(
    api.indexOf('export async function confirmMaterialRequisitionReceipt'),
    api.indexOf('/**\n * 提交评价'),
  );

  assert.match(api, /export async function getMaterialRequisitions\(workOrderId\)/);
  assert.match(api, /work_order_id=\$\{encodeURIComponent\(workOrderId\)\}/);
  assert.match(api, /export async function getMaterialRequisition/);
  assert.match(api, /\/api\/material-requisitions\/\$\{requisitionId\}`[\s\S]*method:\s*'GET'/);
  assert.match(api, /export async function createMaterialRequisition\(data, idempotencyKey\)/);
  assert.match(api, /\/api\/material-requisitions`[\s\S]*method:\s*'POST'/);
  assert.match(createApi, /'Idempotency-Key':\s*idempotencyKey/);
  assert.match(createApi, /const data = await response\.json\(\)/);
  assert.doesNotMatch(createApi, /response\.json\(\)\.catch/);
  assert.match(api, /export async function submitMaterialRequisition/);
  assert.match(api, /\/api\/material-requisitions\/\$\{requisitionId\}\/submit`[\s\S]*method:\s*'POST'/);
  assert.match(api, /export async function confirmMaterialRequisitionReceipt/);
  assert.match(api, /\/api\/material-requisitions\/\$\{requisitionId\}\/engineer-receipt`[\s\S]*method:\s*'POST'/);
  assert.match(api, /'Idempotency-Key':\s*idempotencyKey/);
  assert.match(receiptApi, /const data = await response\.json\(\)/);
  assert.doesNotMatch(receiptApi, /response\.json\(\)\.catch/);
  assert.doesNotMatch(receiptApi, /try \{/);
});

test('material requisition panel supports copied preparation lines and validated multi-line drafts', () => {
  const componentPath = 'frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx';
  assert.equal(existsSync(path.join(root, componentPath)), true, 'material requisition panel should exist');
  const panel = read(componentPath);

  assert.match(panel, /getWorkOrderMaterialItems\(workOrderId, 'preparation'\)/);
  assert.match(panel, /preparationResult\.value\.list/);
  assert.match(panel, /Promise\.allSettled\(/);
  assert.match(panel, /getMaterialRequisitions\(workOrderId\)/);
  assert.match(panel, /requisitionResult\.status === 'rejected'/);
  assert.match(panel, /preparationResult\.status === 'fulfilled'/);
  assert.match(panel, /setPreparationItems\(\[\]\)/);
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

test('receipt confirmation is line-scoped and clears a stable retry key only for definitive failures', () => {
  const panel = read('frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx');

  assert.match(panel, /Number\(item\.issued_quantity\s*\|\|\s*0\)\s*>\s*Number\(item\.engineer_received_quantity\s*\|\|\s*0\)/);
  assert.match(panel, /const fingerprint = JSON\.stringify\(payload\)/);
  assert.match(panel, /getMaterialRequisitionRetryOperation\([\s\S]*retryOperation[\s\S]*payload/);
  assert.match(panel, /const receiptRequest = \{[\s\S]*payload[\s\S]*key:\s*operation\.key/);
  assert.match(panel, /receiptInFlightRef\.current = receiptRequest/);
  assert.match(panel, /confirmMaterialRequisitionReceipt\([\s\S]*receiptRequest\.payload[\s\S]*receiptRequest\.key/);
  assert.match(panel, /disabled=\{pendingReceiptId === item\.id\}/);
  assert.match(panel, /if \(receiptInFlightRef\.current\?\.itemId === item\.id\) return/);
  assert.match(panel, /if \(!shouldPreserveReceiptRetryKey\(error\)\)[\s\S]*delete receiptRetryRef\.current\[item\.id\]/);
  assert.match(panel, /delete receiptRetryRef\.current\[item\.id\][\s\S]*applyRequisitionUpdate/);
});

test('draft creation keeps one retry operation per payload and locks draft controls while pending', () => {
  const panel = read('frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx');

  assert.match(panel, /const draftRetryRef = useRef\(/);
  assert.match(panel, /const fingerprint = JSON\.stringify\(payload\)/);
  assert.match(panel, /draftRetry\?\.fingerprint === fingerprint/);
  assert.match(panel, /const draftRequest = \{[\s\S]*payload[\s\S]*key:\s*operation\.key/);
  assert.match(panel, /createMaterialRequisition\(draftRequest\.payload, draftRequest\.key\)/);
  assert.match(panel, /if \(!shouldPreserveReceiptRetryKey\(createError\)\)[\s\S]*draftRetryRef\.current = null/);
  assert.match(panel, /const clearDraftRetry = \(\) => \{[\s\S]*if \(creating \|\| draftInFlightRef\.current\) return/);
  assert.match(panel, /onChange=\{\(event\) => updateDraftItem[\s\S]*disabled=\{creating\}/);
});

test('only the latest requisition detail request may update panel state', () => {
  const panel = read('frontend/src/components/WorkOrder/MaterialRequisitionPanel.jsx');

  assert.match(panel, /const detailRequestIdRef = useRef\(0\)/);
  assert.match(panel, /const requestId = \+\+detailRequestIdRef\.current/);
  assert.match(panel, /if \(requestId !== detailRequestIdRef\.current\) return/);
  assert.match(panel, /const closeRequisitionDetails = \(\) => \{[\s\S]*detailRequestIdRef\.current \+= 1/);
  assert.match(panel, /return \(\) => \{[\s\S]*detailRequestIdRef\.current \+= 1/);
});

test('work-order details place the panel in an assigned-engineer-only tab', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(modal, /import \{ MaterialRequisitionPanel \} from '\.\/MaterialRequisitionPanel';/);
  assert.match(modal, /const assignedEngineerId = detail\?\.id === workOrder\.id[\s\S]*detail\.engineer_id[\s\S]*workOrder\.engineer_id/);
  assert.match(modal, /const isAssignedEngineer = isEngineer[\s\S]*assignedEngineerId[\s\S]*userId/);
  assert.match(modal, /if \(isAssignedEngineer\)[\s\S]*materialRequisition/);
  assert.match(modal, /isCnLocale\(\) \? '物料领用申请' : 'Material Requisition'/);
  assert.match(modal, /role="tablist"/);
  assert.match(modal, /role="tab"/);
  assert.match(modal, /aria-selected=\{tab === t\.key\}/);
  assert.match(modal, /tab === 'materialRequisition' && isAssignedEngineer/);
  assert.match(modal, /<MaterialRequisitionPanel workOrderId=\{workOrder\.id\}/);
  assert.doesNotMatch(modal, /isCustomer[\s\S]{0,120}<MaterialRequisitionPanel/);
});
