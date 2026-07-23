import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRetryOperation,
  isRetryableActionError,
  retryOperationMatches,
  requisitionLabel,
} from './materialRequisitionOperations.js';

test('quantity action retries reuse one key for the same canonical action payload', () => {
  let generated = 0;
  const makeKey = () => `operation-${++generated}`;
  const first = getRetryOperation(null, 'record_purchase', {
    quantity: 2,
    item_id: 'item-1',
    supplier_reference: 'PO-7',
  }, makeKey);
  const retry = getRetryOperation(first, 'record_purchase', {
    supplier_reference: 'PO-7',
    item_id: 'item-1',
    quantity: 2,
  }, makeKey);

  assert.equal(retry.idempotencyKey, 'operation-1');
  assert.equal(generated, 1);
});

test('quantity action changes retire the previous retry key', () => {
  let generated = 0;
  const makeKey = () => `operation-${++generated}`;
  const first = getRetryOperation(null, 'issue', { item_id: 'item-1', quantity: 1 }, makeKey);
  const changedPayload = getRetryOperation(first, 'issue', { item_id: 'item-1', quantity: 2 }, makeKey);
  const changedAction = getRetryOperation(changedPayload, 'return', { item_id: 'item-1', quantity: 2 }, makeKey);

  assert.equal(first.idempotencyKey, 'operation-1');
  assert.equal(changedPayload.idempotencyKey, 'operation-2');
  assert.equal(changedAction.idempotencyKey, 'operation-3');
});

test('stored retry identity detects canonical payload changes', () => {
  const operation = getRetryOperation(null, 'record_purchase', {
    item_id: 'item-1', quantity: 2, supplier_reference: 'PO-7', expected_arrival: '2026-08-01',
  }, () => 'operation-1');

  assert.equal(retryOperationMatches(operation, 'record_purchase', {
    expected_arrival: '2026-08-01', supplier_reference: 'PO-7', quantity: 2, item_id: 'item-1',
  }), true);
  assert.equal(retryOperationMatches(operation, 'record_purchase', {
    item_id: 'item-1', quantity: 2, supplier_reference: 'PO-8', expected_arrival: '2026-08-01',
  }), false);
});

test('only network, throttling, and server failures retain a retry operation', () => {
  assert.equal(isRetryableActionError(new Error('network unavailable')), true);
  assert.equal(isRetryableActionError({ status: 429 }), true);
  assert.equal(isRetryableActionError({ status: 503 }), true);
  assert.equal(isRetryableActionError({ status: 409 }), false);
  assert.equal(isRetryableActionError({ status: 400 }), false);
});

test('Chinese requisition labels never expose raw workflow identifiers', () => {
  const values = [
    requisitionLabel('zh-CN', 'status', 'partially_fulfilled'),
    requisitionLabel('zh-CN', 'urgency', 'critical'),
    requisitionLabel('zh-CN', 'action', 'material_requisition_procurement_updated'),
    requisitionLabel('zh-CN', 'actor', 'warehouse_staff'),
    requisitionLabel('zh-CN', 'status', 'future_status'),
  ];

  assert.deepEqual(values.slice(0, 4), ['部分履约', '非常紧急', '更新采购信息', '仓库人员']);
  assert.equal(values.every((value) => !value.includes('_')), true);
});
