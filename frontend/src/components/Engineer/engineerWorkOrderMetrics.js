const NEEDS_ACTION = new Set(['assigned', 'pending_dispatch', 'pricing', 'pending_payment']);
const IN_SERVICE = new Set(['in_progress', 'in_service', 'payment_review']);
const REPORT_DUE = new Set(['in_service', 'resolved', 'pending_review']);

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function hasPartsNeed(ticket) {
  return Number(ticket?.material_requisition_count || ticket?.parts_need_count || 0) > 0
    || ['requested', 'submitted', 'approved', 'processing', 'partially_fulfilled', 'ready', 'issued']
      .includes(ticket?.material_requisition_status)
    || Boolean(ticket?.parts_needed || ticket?.requires_parts);
}

export function buildEngineerMetrics(tickets = [], calendarEvents = [], now = new Date(), scope = 'personal') {
  const today = localDateKey(now);
  const todayTime = new Date(today).getTime();
  const scheduledDates = new Set(
    calendarEvents.map((event) => localDateKey(event.start_at)).filter((key) => key && new Date(key).getTime() >= todayTime),
  );
  for (const ticket of tickets) {
    const scheduledDate = localDateKey(ticket.scheduled_at);
    if (scheduledDate && new Date(scheduledDate).getTime() >= todayTime) scheduledDates.add(scheduledDate);
  }
  return {
    needsAction: tickets.filter((ticket) => NEEDS_ACTION.has(ticket.status)).length,
    todayTasks: tickets.filter((ticket) => localDateKey(ticket.scheduled_at) === today).length,
    pendingConfirmation: scope === 'team'
      ? tickets.filter((ticket) => ticket.ownership_relation === 'regional_queue').length
      : tickets.filter((ticket) => ['assigned', 'pending_dispatch'].includes(ticket.status)).length,
    inService: tickets.filter((ticket) => IN_SERVICE.has(ticket.status)).length,
    quotePending: tickets.filter((ticket) => ticket.status === 'pricing').length,
    scheduledDates: scheduledDates.size,
    reportsDue: tickets.filter((ticket) => REPORT_DUE.has(ticket.status)).length,
    partsNeeds: tickets.filter(hasPartsNeed).length,
  };
}

export function groupRegionalTeamWorkOrders(tickets = [], team = [], lead = {}) {
  const queue = {
    key: 'regional_queue',
    type: 'queue',
    engineer: null,
    tickets: tickets.filter((ticket) => ticket.ownership_relation === 'regional_queue'),
  };
  const leadGroup = {
    key: lead.id || 'regional_lead',
    type: 'lead',
    engineer: lead,
    tickets: tickets.filter((ticket) => ticket.ownership_relation === 'personal'),
  };
  const memberGroups = [...team]
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' }))
    .map((engineer) => ({
      key: engineer.id,
      type: 'member',
      engineer,
      tickets: tickets.filter((ticket) => ticket.engineer_id === engineer.id),
    }));
  const historical = tickets.filter((ticket) => ticket.ownership_relation === 'historical_supervision');
  const historicalGroup = historical.length ? [{
    key: 'historical_supervision',
    type: 'historical',
    engineer: { name: 'Historical supervision', status: '' },
    tickets: historical,
  }] : [];
  return [queue, leadGroup, ...memberGroups, ...historicalGroup];
}
