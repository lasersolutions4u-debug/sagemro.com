import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currentActionTone,
  currentServiceGateForStatus,
  currentWorkOrderActionKey,
  defaultOpenWorkOrderSections,
  serviceStandardItemTone,
  serviceStandardStageTone,
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

test('in-service work orders do not expose an empty field-plan snapshot', () => {
  assert.deepEqual(
    defaultOpenWorkOrderSections({
      status: 'in_service',
      field_plan: {
        site_timezone: null,
        expected_service_days: null,
        expected_completion_date: null,
        planned_daily_start_time: null,
        planned_daily_end_time: null,
      },
    }),
    ['overview'],
  );
});

test('in-service work orders expose an active field plan', () => {
  assert.deepEqual(
    defaultOpenWorkOrderSections({ status: 'in_service', field_plan: { site_timezone: 'Asia/Shanghai' } }),
    ['overview', 'files-report'],
  );
});

test('current action keys are locale-independent', () => {
  assert.equal(currentWorkOrderActionKey({ status: 'pending_dispatch' }), 'dispatch');
  assert.equal(currentWorkOrderActionKey({ status: 'payment_review' }), 'approvePaymentStart');
  assert.equal(currentWorkOrderActionKey({ status: 'completed' }), 'complete');
});

test('overview actions reserve warning color for actionable states', () => {
  assert.equal(currentActionTone('dispatch'), 'current');
  assert.equal(currentActionTone('approvePaymentStart'), 'current');
  assert.equal(currentActionTone('complete'), 'complete');
  assert.equal(currentActionTone('none'), 'neutral');
});

test('pending service controls stay neutral when no current gate exists', () => {
  assert.equal(currentServiceGateForStatus('pending_payment'), null);
  const currentBlockingItemKeys = new Set();
  const items = [{ key: 'task.device_identity', state: 'pending' }];

  assert.equal(serviceStandardItemTone(items[0], currentBlockingItemKeys), 'neutral');
  assert.equal(serviceStandardStageTone(items, currentBlockingItemKeys), 'neutral');
});

test('a current-gate blocker is highlighted even when it is in a future progress step', () => {
  const snapshot = {
    current_step_index: 0,
    steps: [{ index: 4, items: [{ key: 'verify.functional_test', state: 'pending' }] }],
  };
  const currentBlockingItemKeys = new Set(['verify.functional_test']);
  const futureItems = snapshot.steps[0].items;
  const unrelatedPendingItems = [{ key: 'execute.actions_recorded', state: 'pending' }];

  assert.ok(snapshot.steps[0].index > snapshot.current_step_index);
  assert.equal(serviceStandardItemTone(futureItems[0], currentBlockingItemKeys), 'current');
  assert.equal(serviceStandardStageTone(futureItems, currentBlockingItemKeys), 'current');
  assert.equal(serviceStandardStageTone(unrelatedPendingItems, currentBlockingItemKeys), 'neutral');
});
