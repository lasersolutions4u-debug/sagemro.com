import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('./MaterialRequisitionsPage.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

test('admin navigation exposes material requisitions to operational staff without exposing unrelated admin pages', () => {
  assert.match(app, /MaterialRequisitionsPage/);
  assert.match(app, /materialRequisitions/);
  assert.match(app, /\['admin', 'operations', 'warehouse', 'procurement'\]/);
  assert.match(app, /OPERATIONAL_NAV_KEYS/);
  assert.match(app, /user\.staffRole/);
});

test('material requisitions use a dense list and a responsive detail drawer with lines and history', () => {
  assert.match(page, /<table/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /selectedRequisition/);
  assert.match(page, /requisition\.items/);
  assert.match(page, /selectedRequisition\.history/);
  assert.doesNotMatch(page, /<article[^>]*>[\s\S]*<article/);
});

test('requisition actions are role-gated and quantity changes are idempotent and pending-safe', () => {
  assert.match(page, /admin:.*approve.*reject.*cancel.*close/s);
  assert.doesNotMatch(page, /^\s*admin:.*allocate_stock.*$/m);
  assert.match(page, /operations:.*approve.*reject.*cancel.*close/s);
  assert.match(page, /warehouse:.*allocate_stock.*receive_purchase.*issue.*return/s);
  assert.match(page, /procurement:.*record_purchase.*update_purchase.*receive_purchase/s);
  assert.match(page, /pendingActions/);
  assert.match(page, /retryOperations/);
  assert.match(page, /getRetryOperation/);
  assert.match(page, /isRetryableActionError/);
  assert.match(page, /retryOperationMatches/);
  assert.match(page, /const handleLineAction = \(item, action\) => \{\s+if \(pendingActionKeys\.current\.size > 0\) return;/);
  assert.match(page, /if \(retryOperationMatches\(current\[itemId\], current\[itemId\]\.action, nextPayload\)\) return current;/);
  assert.match(page, /disabled=\{drawerPending\}/);
  assert.match(page, /pendingActions\.size > 0/);
  assert.doesNotMatch(api, /postMaterialRequisitionQuantityAction[\s\S]*crypto\.randomUUID/);
  assert.match(api, /postMaterialRequisitionQuantityAction\(requisitionId, action, payload, idempotencyKey\)/);
  assert.match(api, /Idempotency-Key/);
  assert.match(api, /postMaterialRequisitionQuantityAction/);
  assert.match(api, /stock-allocation/);
  assert.match(api, /procurement-receipt/);
  assert.match(page, /updateMaterialRequisitionProcurement/);
  assert.match(page, /update_purchase/);
});

test('admin and operations can cancel eligible unissued and unreceived requisition lines', () => {
  assert.match(page, /cancelMaterialRequisitionItem/);
  assert.match(page, /action === 'cancel_item'/);
  assert.match(page, /!TERMINAL\.has\(requisition\.status\)/);
  assert.match(page, /issued_quantity/);
  assert.match(page, /engineer_received_quantity/);
  assert.match(page, /cancelMaterialRequisitionItem\(selectedRequisition\.id, item\.id, note\)/);
  assert.match(page, /if \(!note\.trim\(\)\)/);
  assert.match(page, /t\.noteRequired/);
  assert.match(page, /admin:.*cancel_item/s);
  assert.match(page, /operations:.*cancel_item/s);
});

test('drawer mutations expose a visible pending state and disable all conflicting controls', () => {
  assert.match(page, /drawerPending/);
  assert.match(page, /t\.pendingAction/);
  assert.match(page, /disabled=\{drawerPending\}/);
  assert.match(page, /aria-busy=\{drawerPending\}/);
  assert.match(page, /if \(!drawerPending && event\.target === event\.currentTarget\)/);
});

test('requisition copy and actions are bilingual and buttons do not wrap', () => {
  assert.match(page, /Material requisitions/);
  assert.match(page, /物料领用申请/);
  assert.match(page, /runtimeConfig\.locale/);
  assert.match(page, /requisitionLabel/);
  assert.match(page, /whitespace-nowrap/);
});
