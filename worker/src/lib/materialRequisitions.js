const ROLE_ACTIONS = Object.freeze({
  admin: new Set(['approve', 'reject', 'cancel', 'allocate_stock', 'record_purchase', 'receive_purchase', 'issue', 'return', 'close']),
  operations: new Set(['approve', 'reject', 'cancel', 'close']),
  warehouse: new Set(['allocate_stock', 'receive_purchase', 'issue', 'return']),
  procurement: new Set(['record_purchase', 'receive_purchase']),
  engineer: new Set(['create_draft', 'submit', 'confirm_receipt']),
});

const TERMINAL_REQUISITION_STATUSES = new Set(['rejected', 'cancelled', 'closed']);

function quantity(value) {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Quantities must be finite, non-negative number primitives');
  }
  return value;
}

export function canManageMaterialRequisition(role, action) {
  return Object.hasOwn(ROLE_ACTIONS, role) && ROLE_ACTIONS[role].has(action);
}

export function canCloseMaterialRequisition(items = []) {
  return items.length > 0 && items.every((item) => ['received', 'cancelled'].includes(item.status));
}

export function validateFulfillmentQuantities(input = {}) {
  const requested = quantity(input.requested);
  const stockAllocated = quantity(input.stockAllocated);
  const procurementOrdered = quantity(input.procurementOrdered);
  const procurementReceived = quantity(input.procurementReceived);
  const issued = quantity(input.issued);
  const engineerReceived = quantity(input.engineerReceived);

  if (!requested) throw new Error('Requested quantity must be greater than zero');
  if (stockAllocated > requested) throw new Error('Stock allocation cannot exceed requested quantity');
  if (procurementOrdered > requested - stockAllocated) throw new Error('Procurement order cannot exceed requested shortage');
  if (procurementReceived > procurementOrdered) throw new Error('Purchased receipt cannot exceed ordered quantity');
  if (issued > stockAllocated + procurementReceived) throw new Error('Issued quantity cannot exceed available quantity');
  if (engineerReceived > issued) throw new Error('Engineer receipt cannot exceed issued quantity');

  return { requested, stockAllocated, procurementOrdered, procurementReceived, issued, engineerReceived };
}

export function deriveItemStatus(input = {}) {
  if (input.cancelled) return 'cancelled';
  const values = validateFulfillmentQuantities({
    requested: input.requested,
    stockAllocated: input.stockAllocated,
    procurementOrdered: input.procurementOrdered,
    procurementReceived: input.procurementReceived,
    issued: input.issued,
    engineerReceived: input.engineerReceived,
  });
  if (values.engineerReceived >= values.requested) return 'received';
  if (values.issued > 0) return values.issued >= values.requested ? 'issued' : 'partially_ready';
  const ready = values.stockAllocated + values.procurementReceived;
  if (ready >= values.requested) return 'ready';
  if (values.procurementReceived > 0) return 'partially_ready';
  if (values.procurementOrdered > 0) return 'purchasing';
  if (values.stockAllocated > 0) return 'stock_allocated';
  return 'pending';
}

export function deriveRequisitionStatus(requisition = {}, items = []) {
  if (TERMINAL_REQUISITION_STATUSES.has(requisition.status)) return requisition.status;
  if (['draft', 'submitted'].includes(requisition.status)) return requisition.status;
  const active = items.filter((item) => item.status !== 'cancelled');
  if (!active.length) return requisition.status || 'draft';
  if (active.every((item) => item.status === 'received')) return 'received';
  if (active.every((item) => ['received', 'issued'].includes(item.status))) return 'issued';
  if (active.every((item) => ['received', 'issued', 'ready'].includes(item.status))) return 'ready';
  if (active.some((item) => ['stock_allocated', 'purchasing', 'partially_ready', 'ready', 'issued', 'received'].includes(item.status))) {
    return 'partially_fulfilled';
  }
  return 'processing';
}
