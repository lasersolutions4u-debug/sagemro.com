import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canCloseMaterialRequisition,
  canManageMaterialRequisition,
  deriveItemStatus,
  deriveRequisitionStatus,
  validateFulfillmentQuantities,
} from '../src/lib/materialRequisitions.js';

test('material requisition permissions separate review, warehouse, and procurement actions', () => {
  assert.equal(canManageMaterialRequisition('admin', 'approve'), true);
  assert.equal(canManageMaterialRequisition('operations', 'approve'), true);
  assert.equal(canManageMaterialRequisition('warehouse', 'allocate_stock'), true);
  assert.equal(canManageMaterialRequisition('warehouse', 'record_purchase'), false);
  assert.equal(canManageMaterialRequisition('procurement', 'record_purchase'), true);
  assert.equal(canManageMaterialRequisition('procurement', 'issue'), false);
  assert.equal(canManageMaterialRequisition('engineer', 'approve'), false);
  assert.equal(canManageMaterialRequisition('admin', 'unknown'), false);
  assert.equal(canManageMaterialRequisition('admin', 'manage_staff'), false);
});

test('engineer can create, submit, and confirm receipt for requisitions', () => {
  assert.equal(canManageMaterialRequisition('engineer', 'create_draft'), true);
  assert.equal(canManageMaterialRequisition('engineer', 'submit'), true);
  assert.equal(canManageMaterialRequisition('engineer', 'confirm_receipt'), true);
});

test('procurement can record and receive purchases', () => {
  assert.equal(canManageMaterialRequisition('procurement', 'record_purchase'), true);
  assert.equal(canManageMaterialRequisition('procurement', 'receive_purchase'), true);
});

test('unknown and prototype role names are denied safely', () => {
  assert.equal(canManageMaterialRequisition('unknown', 'approve'), false);
  assert.equal(canManageMaterialRequisition('toString', 'approve'), false);
  assert.equal(canManageMaterialRequisition('constructor', 'approve'), false);
  assert.equal(canManageMaterialRequisition('__proto__', 'approve'), false);
});

test('item status reflects stock, procurement, issue, and engineer receipt progress', () => {
  assert.equal(deriveItemStatus({ requested: 4, cancelled: true }), 'cancelled');
  assert.equal(deriveItemStatus({ requested: 4 }), 'pending');
  assert.equal(deriveItemStatus({ requested: 4, stockAllocated: 2 }), 'stock_allocated');
  assert.equal(deriveItemStatus({ requested: 4, stockAllocated: 2, procurementOrdered: 2 }), 'purchasing');
  assert.equal(deriveItemStatus({ requested: 4, stockAllocated: 2, procurementOrdered: 2, procurementReceived: 1 }), 'partially_ready');
  assert.equal(deriveItemStatus({ requested: 4, stockAllocated: 2, procurementOrdered: 2, procurementReceived: 2 }), 'ready');
  assert.equal(deriveItemStatus({ requested: 4, stockAllocated: 4, issued: 4 }), 'issued');
  assert.equal(deriveItemStatus({ requested: 4, stockAllocated: 4, issued: 4, engineerReceived: 4 }), 'received');
});

test('partial issuance remains non-final for the item and requisition', () => {
  const itemStatus = deriveItemStatus({ requested: 4, stockAllocated: 4, issued: 2 });

  assert.equal(itemStatus, 'partially_ready');
  assert.equal(deriveRequisitionStatus({ status: 'approved' }, [{ status: itemStatus }]), 'partially_fulfilled');
  assert.equal(deriveRequisitionStatus({ status: 'approved' }, [{ status: itemStatus }, { status: 'cancelled' }]), 'partially_fulfilled');
});

test('fulfillment quantities enforce non-negative upstream bounds', () => {
  assert.throws(() => validateFulfillmentQuantities({ requested: 0 }), /greater than zero/i);
  assert.throws(() => validateFulfillmentQuantities({ requested: 2, stockAllocated: 'invalid' }), /integer/i);
  assert.throws(() => validateFulfillmentQuantities({ requested: 2, stockAllocated: -1 }), /non-negative/i);
  assert.throws(() => validateFulfillmentQuantities({ requested: 2, stockAllocated: 3 }), /requested/i);
  assert.throws(() => validateFulfillmentQuantities({ requested: 5, stockAllocated: 3, procurementOrdered: 3 }), /shortage/i);
  assert.throws(() => validateFulfillmentQuantities({ requested: 5, stockAllocated: 2, procurementOrdered: 2, procurementReceived: 3 }), /ordered/i);
  assert.throws(() => validateFulfillmentQuantities({ requested: 5, stockAllocated: 2, procurementOrdered: 1, procurementReceived: 1, issued: 4 }), /available/i);
  assert.throws(() => validateFulfillmentQuantities({ requested: 5, issued: 3, engineerReceived: 4 }), /issued/i);
  assert.doesNotThrow(() => validateFulfillmentQuantities({ requested: 5, stockAllocated: 2, procurementOrdered: 3, procurementReceived: 3, issued: 5, engineerReceived: 5 }));
});

test('fulfillment quantities accept only finite number primitives', () => {
  for (const malformed of [true, null, [], [1], {}, '1', 1.5]) {
    assert.throws(
      () => validateFulfillmentQuantities({ requested: 2, stockAllocated: malformed }),
      /integer/i,
    );
  }
});

test('draft requisition status is preserved before item progress', () => {
  assert.equal(deriveRequisitionStatus({ status: 'draft' }, [{ status: 'ready' }]), 'draft');
});

test('submitted requisition status is preserved before item progress', () => {
  assert.equal(deriveRequisitionStatus({ status: 'submitted' }, [{ status: 'issued' }]), 'submitted');
});

test('requisition status derives partial, ready, issued, received, and closed states', () => {
  const base = { status: 'approved' };
  assert.equal(deriveRequisitionStatus(base, [{ status: 'pending' }]), 'processing');
  assert.equal(deriveRequisitionStatus({ status: 'draft' }, [{ status: 'pending' }]), 'draft');
  assert.equal(deriveRequisitionStatus({ status: 'submitted' }, [{ status: 'pending' }]), 'submitted');
  assert.equal(deriveRequisitionStatus(base, [{ status: 'ready' }, { status: 'partially_ready' }]), 'partially_fulfilled');
  assert.equal(deriveRequisitionStatus(base, [{ status: 'ready' }, { status: 'cancelled' }]), 'ready');
  assert.equal(deriveRequisitionStatus(base, [{ status: 'issued' }]), 'issued');
  assert.equal(deriveRequisitionStatus(base, [{ status: 'received' }]), 'received');
  assert.equal(deriveRequisitionStatus({ status: 'rejected' }, [{ status: 'received' }]), 'rejected');
  assert.equal(deriveRequisitionStatus({ status: 'cancelled' }, [{ status: 'received' }]), 'cancelled');
  assert.equal(deriveRequisitionStatus({ status: 'closed' }, [{ status: 'received' }]), 'closed');
});

test('requisition can close only when every line is received or cancelled', () => {
  assert.equal(canCloseMaterialRequisition([]), false);
  assert.equal(canCloseMaterialRequisition([{ status: 'cancelled' }]), true);
  assert.equal(canCloseMaterialRequisition([{ status: 'received' }, { status: 'cancelled' }]), true);
  assert.equal(canCloseMaterialRequisition([{ status: 'received' }, { status: 'issued' }]), false);
});
