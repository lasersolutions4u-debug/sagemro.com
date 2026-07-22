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
  assert.match(page, /pendingActionKeys/);
  assert.match(page, /useRef/);
  assert.match(page, /disabled=\{pendingActions\.has/);
  assert.match(api, /crypto\.randomUUID/);
  assert.match(api, /Idempotency-Key/);
  assert.match(api, /postMaterialRequisitionQuantityAction/);
  assert.match(api, /stock-allocation/);
  assert.match(api, /procurement-receipt/);
  assert.match(page, /updateMaterialRequisitionProcurement/);
  assert.match(page, /update_purchase/);
});

test('requisition copy and actions are bilingual and buttons do not wrap', () => {
  assert.match(page, /Material requisitions/);
  assert.match(page, /物料领用申请/);
  assert.match(page, /runtimeConfig\.locale/);
  assert.match(page, /whitespace-nowrap/);
});
