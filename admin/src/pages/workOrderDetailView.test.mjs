import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currentServiceGateForStatus,
  currentWorkOrderActionKey,
  defaultOpenWorkOrderSections,
} from './workOrderDetailView.js';

test('only the lifecycle transition that can happen next is presented as current', () => {
  assert.equal(currentServiceGateForStatus('payment_review'), 'start');
  assert.equal(currentServiceGateForStatus('in_service'), 'resolve');
  assert.equal(currentServiceGateForStatus('resolved'), 'handover');
  assert.equal(currentServiceGateForStatus('pending_review'), 'handover');
  for (const status of ['pending', 'pending_dispatch', 'assigned', 'in_progress', 'pricing', 'pending_payment', 'completed', 'rejected', 'cancelled']) {
    assert.equal(currentServiceGateForStatus(status), null, status);
  }
});

test('default sections expose the current operator task without expanding the entire record', () => {
  assert.deepEqual(defaultOpenWorkOrderSections({ status: 'pending_dispatch' }), ['overview', 'dispatch']);
  assert.deepEqual(defaultOpenWorkOrderSections({ status: 'payment_review' }), ['overview', 'quote']);
  assert.deepEqual(
    defaultOpenWorkOrderSections({ status: 'in_service' }, { hasCurrentGateBlockers: true }),
    ['overview', 'service-controls'],
  );
  assert.deepEqual(defaultOpenWorkOrderSections({ status: 'completed' }), ['overview']);
});

test('completed work orders expose pending engineer payout controls', () => {
  assert.deepEqual(
    defaultOpenWorkOrderSections({ status: 'completed', payout_status: 'pending' }),
    ['overview', 'quote'],
  );
  assert.deepEqual(
    defaultOpenWorkOrderSections({ status: 'completed', payout_status: 'completed' }),
    ['overview'],
  );
});

test('in-service work orders expose active field operations', () => {
  assert.deepEqual(
    defaultOpenWorkOrderSections({ status: 'in_service', field_plan: { expected_service_days: 4 } }),
    ['overview', 'files-report'],
  );
});

test('current action keys are locale-independent', () => {
  assert.equal(currentWorkOrderActionKey({ status: 'pending_dispatch' }), 'dispatch');
  assert.equal(currentWorkOrderActionKey({ status: 'payment_review' }), 'approvePaymentStart');
  assert.equal(currentWorkOrderActionKey({ status: 'completed' }), 'complete');
});
