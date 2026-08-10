const CURRENT_GATE_BY_STATUS = Object.freeze({
  payment_review: 'start',
  in_service: 'resolve',
  resolved: 'handover',
  pending_review: 'handover',
});

const ACTION_BY_STATUS = Object.freeze({
  pending: 'dispatch',
  pending_dispatch: 'dispatch',
  assigned: 'dispatch',
  pricing: 'quoteReview',
  pending_payment: 'paymentFollowup',
  payment_review: 'approvePaymentStart',
  in_service: 'monitorService',
  resolved: 'handover',
  pending_review: 'handover',
  completed: 'complete',
});

export function currentServiceGateForStatus(status) {
  return CURRENT_GATE_BY_STATUS[status] || null;
}

export function currentWorkOrderActionKey(detail = {}) {
  return ACTION_BY_STATUS[detail.status] || 'none';
}

export function currentActionTone(actionKey) {
  if (actionKey === 'complete') return 'complete';
  if (actionKey === 'none') return 'neutral';
  return 'current';
}

export function serviceStandardItemTone(item, currentBlockingItemKeys) {
  if (item?.state === 'confirmed') return 'complete';
  if (currentBlockingItemKeys.has(item?.key)) return 'current';
  return 'neutral';
}

export function serviceStandardStageTone(items, currentBlockingItemKeys) {
  if (items.some((item) => currentBlockingItemKeys.has(item.key))) return 'current';
  if (items.length > 0 && items.every((item) => ['confirmed', 'not_applicable'].includes(item.state))) return 'complete';
  return 'neutral';
}

export function defaultOpenWorkOrderSections(detail = {}, { hasCurrentGateBlockers = false } = {}) {
  const open = ['overview'];
  if (['pending', 'pending_dispatch', 'assigned'].includes(detail.status)) open.push('dispatch');
  if (detail.pricing?.status === 'pending_review' || ['pricing', 'pending_payment', 'payment_review'].includes(detail.status)) open.push('quote');
  if (detail.status === 'completed' && detail.payout_status && detail.payout_status !== 'completed') open.push('quote');
  if (detail.status === 'in_service' && detail.field_plan?.site_timezone) open.push('service-operations');
  if (hasCurrentGateBlockers) open.push('service-controls');
  return [...new Set(open)];
}
