const PAYMENT_STATUSES = new Set(['pending_payment']);
const ACTIVE_STATUSES = new Set(['in_progress', 'in_service']);
const PENDING_STATUSES = new Set(['pending', 'pending_dispatch', 'assigned']);
const TODAY_STATUSES = new Set(['assigned', 'in_progress', 'in_service']);
const REPORT_STATUSES = new Set(['resolved', 'pending_review']);
const PRICING_STATUSES = new Set(['pricing']);

function isCurrentMonth(dateValue) {
  if (!dateValue) return false;
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return false;
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

function mentionsParts(ticket) {
  return /parts|备件|配件|物料/i.test(`${ticket.type || ''} ${ticket.description || ''}`);
}

export function groupEngineerTickets(tickets = [], isRegionalLead = false) {
  const list = Array.isArray(tickets) ? tickets : [];
  return {
    today: list.filter((ticket) => TODAY_STATUSES.has(ticket.status)),
    pending: list.filter((ticket) => PENDING_STATUSES.has(ticket.status)),
    active: list.filter((ticket) => ACTIVE_STATUSES.has(ticket.status)),
    pricing: list.filter((ticket) => PRICING_STATUSES.has(ticket.status)),
    reports: list.filter((ticket) => REPORT_STATUSES.has(ticket.status)),
    customerConfirm: list.filter((ticket) => REPORT_STATUSES.has(ticket.status)),
    payment: list.filter((ticket) => PAYMENT_STATUSES.has(ticket.status)),
    completedThisMonth: list.filter((ticket) => ticket.status === 'completed' && isCurrentMonth(ticket.completed_at)),
    parts: list.filter(mentionsParts),
    regionalPending: isRegionalLead ? list.filter((ticket) => ticket.status === 'pending_dispatch') : [],
  };
}

export function derivePaymentBadge(ticket = {}) {
  if (ticket.status === 'pending_payment') return { label: '待回款', tone: 'amber', visible: true };
  if (ticket.status === 'completed') return { label: '已完成', tone: 'green', visible: true };
  if (ticket.status === 'in_service') return { label: '客户已确认报价', tone: 'blue', visible: true };
  return { label: '回款待运营记录', tone: 'slate', visible: false };
}

export function deriveWorkOrderActionLabel(ticket = {}) {
  const status = ticket.status;
  if (status === 'assigned') return { label: '待确认派工', tone: 'amber' };
  if (status === 'pricing') return { label: '待报价', tone: 'purple' };
  if (status === 'pending_payment') return { label: '待回款', tone: 'amber' };
  if (status === 'resolved' || status === 'pending_review') return { label: '待客户确认', tone: 'teal' };
  if (status === 'in_progress' || status === 'in_service') return { label: '服务中', tone: 'blue' };
  if (status === 'completed') return { label: '已完成', tone: 'green' };
  return { label: status || '待处理', tone: 'slate' };
}

const STATUS_PRIORITY = {
  assigned: 10,
  pending_dispatch: 20,
  pending_payment: 30,
  pricing: 40,
  in_progress: 50,
  in_service: 60,
  resolved: 70,
  pending_review: 80,
  completed: 900,
};

export function sortEngineerWorkQueue(tickets = []) {
  return [...tickets].sort((a, b) => {
    const urgencyDelta = (b.urgency === 'critical' ? 100 : b.urgency === 'urgent' ? 50 : 0)
      - (a.urgency === 'critical' ? 100 : a.urgency === 'urgent' ? 50 : 0);
    if (urgencyDelta !== 0) return urgencyDelta;
    return (STATUS_PRIORITY[a.status] || 500) - (STATUS_PRIORITY[b.status] || 500);
  });
}
