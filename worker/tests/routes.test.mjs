import test from 'node:test';
import assert from 'node:assert/strict';
import { isKnownProtectedRoute, isTestRoute } from '../src/lib/routes.js';

test('test route classifier covers development-only diagnostics', () => {
  assert.equal(isTestRoute('/api/test-full-flow'), true);
  assert.equal(isTestRoute('/api/debug-engineers'), true);
  assert.equal(isTestRoute('/api/init-test-data'), true);
  assert.equal(isTestRoute('/api/init-db'), true);
  assert.equal(isTestRoute('/api/clear-test-data'), true);
  assert.equal(isTestRoute('/api/workorders'), false);
});

test('protected route classifier covers exact and parameterized authenticated paths', () => {
  assert.equal(isKnownProtectedRoute('/api/admin/stats'), true);
  assert.equal(isKnownProtectedRoute('/api/material-requisitions/metrics'), true);
  assert.equal(isKnownProtectedRoute('/api/conversations'), true);
  assert.equal(isKnownProtectedRoute('/api/conversations/conversation-1'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/messages'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/field-days'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/field-days/check-in'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/field-days/day-1/report'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/extension-requests'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/field-media/media-1'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/installments/installment-1/collect'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/installments/installment-1/payment-method'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/installments/installment-1/receipt-claims'), true);
  assert.equal(isKnownProtectedRoute('/api/workorders/work-order-1/receipt-evidence/evidence-1'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/workorders/work-order-1/field-plan'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/workorders/work-order-1/installments/installment-1/receipt-claims/claim-1/decision'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/workorders/work-order-1/extension-requests/request-1/decision'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/workorders/work-order-1/field-days/override'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/workorders/work-order-1/field-days/day-1/report'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/workorders/work-order-1/evidence-holds'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/workorders/work-order-1/evidence-holds/hold-1/resolve'), true);
  assert.equal(isKnownProtectedRoute('/api/customers/customer-1/reviews'), true);
  assert.equal(isKnownProtectedRoute('/api/auth/change-password'), true);
  assert.equal(isKnownProtectedRoute('/api/chat'), false);
  assert.equal(isKnownProtectedRoute('/api/not-a-route'), false);
});
