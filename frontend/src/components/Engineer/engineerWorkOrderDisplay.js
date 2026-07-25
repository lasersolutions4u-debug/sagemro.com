export const ACTION_PRIORITY = {
  assigned: 0,
  pending_dispatch: 1,
  pricing: 2,
  pending_payment: 3,
  payment_review: 4,
  in_service: 5,
  in_progress: 6,
  pending: 7,
  resolved: 8,
  pending_review: 9,
  completed: 10,
};

export function sortEngineerWorkOrders(tickets = []) {
  return [...tickets].sort((left, right) => {
    const priority = (ACTION_PRIORITY[left.status] ?? 99) - (ACTION_PRIORITY[right.status] ?? 99);
    if (priority !== 0) return priority;
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });
}

export function getEngineerWorkOrderTitle(ticket = {}, isCn = false, fallback = '') {
  const description = String(ticket.description || '').match(/^[^。.!?\n]+[。.!?]?/)?.[0].trim();
  return ticket.issue_title || ticket.title || description || fallback || (isCn ? '服务任务' : 'Service task');
}

export function getEngineerScheduleLabel(ticket = {}, locale = 'en-US') {
  const value = ticket.scheduled_at || ticket.service_window_start || ticket.sla_deadline;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
