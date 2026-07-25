import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  Package,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  assignEngineerWorkOrder,
  acceptTicket,
  getEngineerCalendarEvents,
  getEngineerTeam,
  getEngineerTickets,
  rejectTicket,
  updateEngineerStatus,
} from '../../services/api';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { Modal } from '../common/Modal';
import { EngineerAvailabilityCalendar } from './EngineerAvailabilityCalendar';
import { categoryConfig, categoryL2Labels, typeLabels } from '../../data/workOrderConfig';
import { redactContactInfo } from '../../utils/contactRedaction';

const STATUS_LABELS = {
  pending: 'Pending Confirmation',
  pending_dispatch: 'Pending Regional Dispatch',
  assigned: 'Pending Confirmation',
  in_progress: 'In Service',
  pricing: 'Pending Quote',
  in_service: 'In Service',
  resolved: 'Awaiting Customer Confirmation',
  pending_review: 'Pending Archive',
  completed: 'Completed',
};

const CHECKLIST = [
  'Confirm customer issue, machine model, site contact, and arrival window',
  'Review the customer request summary and flag safety risks',
  'Check spare parts, tools, consumables, and protective equipment',
  'Record nameplate, alarm screen, and fault area photos on site',
  'Document service actions, parts replacement, and follow-up recommendations',
  'Submit the service report for customer confirmation',
];

const CALENDAR_PREVIEW_DAYS = 30;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// This component is the first shared implementation slice for the future
// engineer.sagemro.com portal. The customer main site should not remain the
// long-term engineer entry.
function groupTickets(tickets) {
  return {
    today: tickets.filter((ticket) => ['assigned', 'in_progress', 'in_service'].includes(ticket.status)),
    needsAction: tickets.filter((ticket) => ['assigned', 'pricing', 'in_service', 'pending_payment'].includes(ticket.status)),
    pending: tickets.filter((ticket) => ['pending', 'pending_dispatch', 'assigned'].includes(ticket.status)),
    regionalQueue: tickets.filter((ticket) => ticket.status === 'pending_dispatch'),
    active: tickets.filter((ticket) => ['in_progress', 'in_service', 'pricing'].includes(ticket.status)),
    quotePending: tickets.filter((ticket) => ticket.status === 'pricing'),
    paymentFollowUp: tickets.filter((ticket) => ['pending_payment', 'payment_review'].includes(ticket.status)),
    reports: tickets.filter((ticket) => ['resolved', 'pending_review'].includes(ticket.status)),
    parts: tickets.filter((ticket) => /parts|spare|consumable/i.test(`${ticket.type || ''} ${ticket.description || ''}`)),
  };
}

function getNextAction(ticket) {
  const actions = {
    pending: 'Wait for SAGEMRO dispatch review.',
    pending_dispatch: 'Regional Lead should assign a qualified engineer.',
    assigned: 'Confirm assignment or return it with a reason.',
    in_progress: 'Prepare quote, site plan, and customer communication.',
    pricing: 'Submit or update the quote for Admin review.',
    pending_payment: 'Follow up with the customer and request Admin approval after advance payment.',
    payment_review: 'Wait for Admin advance payment confirmation before starting service.',
    in_service: 'Complete the service report and submit it to the customer.',
    resolved: 'Wait for customer confirmation and review.',
    pending_review: 'Wait for customer confirmation and review.',
    completed: 'Confirm payout status and archive your notes.',
  };
  return actions[ticket?.status] || 'Open the task and review current details.';
}

function getDeviceLabel(ticket) {
  const label = ticket?.category_l1 && ticket.category_l1 !== 'other'
    ? categoryConfig[ticket.category_l1]?.label
    : typeLabels[ticket?.type];
  return label || '';
}

function getIssueLabel(ticket) {
  if (!ticket?.category_l2 || ticket.category_l2 === 'other') return '';
  return categoryConfig[ticket.category_l1]?.l2?.[ticket.category_l2] || categoryL2Labels[ticket.category_l2] || '';
}

function getMachineLine(ticket) {
  const deviceDetails = [ticket?.device_brand || ticket?.brand, ticket?.device_model || ticket?.model].filter(Boolean);
  const serviceContext = [getDeviceLabel(ticket), getIssueLabel(ticket)].filter(Boolean);
  return [...serviceContext, ...deviceDetails].filter(Boolean).join(' / ') || 'Machine details pending';
}

function tryParseAiSummary(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatAiIntakeSummary(ticket) {
  const raw = ticket?.ai_summary || ticket?.summary || '';
  const summary = tryParseAiSummary(raw);
  if (!summary) {
    return {
      text: raw || ticket?.description || 'Review the customer description, quote details, messages, attachments, and service report before taking action.',
      tags: [],
      notes: '',
    };
  }
  const tags = [
    ...(Array.isArray(summary.required_specialties) ? summary.required_specialties : []),
    ...(Array.isArray(summary.suggested_skills) ? summary.suggested_skills : []),
  ].filter(Boolean);
  return {
    text: summary.summary || ticket?.description || 'Review the customer issue and service context before taking action.',
    tags,
    notes: summary.urgency_notes || '',
  };
}

const CHINESE_ENGINEER_DESCRIPTION_TERMS = [
  ['客户', 'Customer'],
  ['所在地区', 'Region'],
  ['休斯顿地区', 'Houston area'],
  ['设备类型', 'Equipment type'],
  ['设备品牌', 'Brand'],
  ['设备型号', 'Model'],
  ['设备', 'Machine'],
  ['品牌', 'Brand'],
  ['型号', 'Model'],
  ['故障', 'Fault'],
  ['激光切割机', 'laser cutting machine'],
  ['激光切割头', 'laser cutting head'],
  ['光纤激光器', 'fiber laser source'],
  ['不锈钢', 'stainless steel'],
  ['主要加工', 'mainly processes'],
  ['搭载', 'equipped with'],
  ['自动对焦无法校准', 'auto-focus cannot be calibrated'],
  ['校准启动时', 'when calibration starts'],
  ['轴头部完全不动', 'axis head does not move at all'],
  ['无碰撞或撞头历史', 'no collision or cutting-head crash history'],
  ['尚未完成', 'has not completed'],
  ['手动 JOG 测试', 'manual JOG test'],
  ['手动JOG测试', 'manual JOG test'],
  ['电容放大器', 'capacitance amplifier'],
  ['指示灯检查', 'indicator light check'],
  ['控制器报警确认', 'controller alarm confirmation'],
  ['生产已停产', 'production is stopped'],
  ['紧急程度为', 'urgency is'],
];

function replaceChineseDeviceLabels(text) {
  return CHINESE_ENGINEER_DESCRIPTION_TERMS.reduce(
    (value, [source, replacement]) => value.split(source).join(replacement),
    String(text || ''),
  )
    .replace(/Equipment type[：:]/g, 'Equipment type: ')
    .replace(/Brand[：:]/g, 'Brand: ')
    .replace(/Model[：:]/g, 'Model: ')
    .replace(/Region[：:]/g, 'Region: ')
    .replace(/；/g, '; ')
    .replace(/，/g, ', ')
    .replace(/。/g, '. ');
}

function formatEngineerDescription(description) {
  return redactContactInfo(replaceChineseDeviceLabels(description));
}

function startOfLocalDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateKey(value) {
  const date = startOfLocalDay(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildCalendarPreviewDays(referenceDate = new Date(), length = CALENDAR_PREVIEW_DAYS) {
  const start = startOfLocalDay(referenceDate);
  return Array.from({ length }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: formatDateKey(date),
      date,
      day: date.getDate(),
      month: date.getMonth(),
      isToday: index === 0,
    };
  });
}

function getScheduledDateKeys(events, referenceDate = new Date(), length = CALENDAR_PREVIEW_DAYS) {
  const windowStart = startOfLocalDay(referenceDate);
  const windowEnd = addDays(windowStart, length - 1);
  const scheduled = new Set();

  events.forEach((event) => {
    const start = new Date(event.start_at);
    const end = new Date(event.end_at || event.start_at);
    if (Number.isNaN(start.getTime())) return;

    const eventStart = startOfLocalDay(start);
    const eventEnd = Number.isNaN(end.getTime()) ? eventStart : startOfLocalDay(end);
    const rangeStart = eventStart < windowStart ? windowStart : eventStart;
    const rangeEnd = eventEnd > windowEnd ? windowEnd : eventEnd;

    for (let day = rangeStart; day <= rangeEnd; day = addDays(day, 1)) {
      scheduled.add(formatDateKey(day));
    }
  });

  return scheduled;
}

export function EngineerWorkspace({ currentUser, onLogout, onOpenProfile }) {
  const engineerId = localStorage.getItem('sagemro_engineer_id');
  const isRegionalLead =
    currentUser?.role === 'regional_lead' ||
    currentUser?.engineer_role === 'regional_lead' ||
    currentUser?.level === 'regional_lead';
  const [tickets, setTickets] = useState([]);
  const [team, setTeam] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState({});
  const [assigningId, setAssigningId] = useState('');
  const [status, setStatus] = useState('available');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarPreviewEvents, setCalendarPreviewEvents] = useState([]);
  const [calendarPreviewLoading, setCalendarPreviewLoading] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!engineerId) return;
    setLoading(true);
    try {
      const data = await getEngineerTickets(engineerId);
      setTickets(data.work_orders || []);
    } catch (error) {
      setMessage(error.message || 'Failed to load service tasks');
    } finally {
      setLoading(false);
    }
  }, [engineerId]);

  const loadTeam = useCallback(async () => {
    if (!isRegionalLead) return;
    try {
      const data = await getEngineerTeam();
      setTeam(data.engineers || []);
    } catch (error) {
      setMessage(error.message || 'Failed to load team engineers');
    }
  }, [isRegionalLead]);

  const loadCalendarPreview = useCallback(async () => {
    setCalendarPreviewLoading(true);
    try {
      const from = startOfLocalDay(new Date());
      const to = addDays(from, CALENDAR_PREVIEW_DAYS);
      const data = await getEngineerCalendarEvents({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setCalendarPreviewEvents(data.events || []);
    } catch {
      setCalendarPreviewEvents([]);
    } finally {
      setCalendarPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    loadCalendarPreview();
  }, [loadCalendarPreview]);

  const updateStatus = async (nextStatus) => {
    setStatus(nextStatus);
    try {
      await updateEngineerStatus({ engineer_id: engineerId, status: nextStatus });
    } catch (error) {
      setMessage(error.message || 'Failed to update availability');
    }
  };

  const assignToEngineer = async (ticket) => {
    const engineerIdToAssign = selectedEngineer[ticket.id];
    if (!engineerIdToAssign) {
      setMessage('Please select a service engineer first');
      return;
    }
    setAssigningId(ticket.id);
    setMessage('');
    try {
      const data = await assignEngineerWorkOrder({
        work_order_id: ticket.id,
        engineer_id: engineerIdToAssign,
      });
      const assigned = data.work_order || {};
      setTickets((prev) => prev.map((item) => (
        item.id === ticket.id
          ? {
              ...item,
              status: assigned.status || 'assigned',
              engineer_id: assigned.engineer_id,
              engineer_name: assigned.engineer_name,
              conflict_status: 'clear',
              conflict_reason: '',
            }
          : item
      )));
      setMessage(`Assigned: ${ticket.order_no || ticket.id}`);
    } catch (error) {
      setMessage(error.message || 'Failed to assign engineer');
    } finally {
      setAssigningId('');
    }
  };

  const confirmAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:accept`);
    setMessage('');
    try {
      await acceptTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(`Assignment confirmed: ${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || 'Failed to confirm assignment');
    } finally {
      setAssigningId('');
    }
  };

  const returnAssignment = async (ticket) => {
    const reason = window.prompt(
      'Please enter the reason for returning this dispatch. It will be recorded for SAGEMRO operations.',
      '',
    )?.trim();
    if (!reason) {
      setMessage('Please enter a return reason before submitting.');
      return;
    }
    setAssigningId(`${ticket.id}:reject`);
    setMessage('');
    try {
      await rejectTicket({ work_order_id: ticket.id, engineer_id: engineerId, reason });
      setMessage(`Returned to dispatch: ${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || 'Failed to return assignment');
    } finally {
      setAssigningId('');
    }
  };

  const grouped = groupTickets(tickets);
  const activeTicket = selectedTicket || tickets[0] || null;
  const activeAiSummary = formatAiIntakeSummary(activeTicket);
  const calendarPreviewDays = buildCalendarPreviewDays();
  const scheduledDateKeys = getScheduledDateKeys(calendarPreviewEvents, calendarPreviewDays[0]?.date);
  const scheduledPreviewCount = calendarPreviewDays.filter((day) => scheduledDateKeys.has(day.key)).length;
  const personalMetrics = [
    { icon: AlertTriangle, label: 'Needs action', value: grouped.needsAction.length },
    { icon: ClipboardCheck, label: "Today's Tasks", value: grouped.today.length },
    { icon: AlertTriangle, label: 'Pending Confirmation', value: grouped.pending.length },
    { icon: Wrench, label: 'In Service', value: grouped.active.length },
    { icon: ReceiptText, label: 'Quote Pending', value: grouped.quotePending.length },
    { icon: CalendarDays, label: 'Scheduled Dates', value: scheduledPreviewCount },
    { icon: FileText, label: 'Reports Due', value: grouped.reports.length },
    { icon: Package, label: 'Parts Needs', value: grouped.parts.length },
  ];
  const regionalMetrics = isRegionalLead
    ? [
        { icon: ClipboardCheck, label: 'Regional Queue', value: grouped.regionalQueue.length },
        { icon: CreditCard, label: 'Payment Follow-up', value: grouped.paymentFollowUp.length },
      ]
    : [];
  const metrics = [...regionalMetrics, ...personalMetrics];

  return (
    <>
    <div className="h-[100dvh] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
            <h1 className="text-xl font-semibold">
              {isRegionalLead ? 'Regional Lead Workspace' : 'Engineer Workspace'}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">SAGEMRO Service Console</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <button
              onClick={onOpenProfile}
              className="min-h-10 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {currentUser?.name || 'Engineer Profile'}
            </button>
            <button
              onClick={onLogout}
              className="min-h-10 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
        {message && (
          <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            {message}
          </div>
        )}

        <section className="mb-6 grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">Task Overview</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Only service tasks assigned through SAGEMRO are shown here.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex">
                {[
                  { value: 'available', label: 'Available' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'offline', label: 'Offline' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => updateStatus(item.value)}
                    className={`min-h-8 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      status === item.value
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                  <metric.icon size={18} className="mb-2 text-[var(--color-primary)]" />
                  <div className="text-2xl font-semibold">{metric.value}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsCalendarOpen(true)}
            className="group flex h-full flex-col gap-3 rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-surface)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Scheduling Calendar</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                  Update availability, blocked dates, and service windows.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
                Open calendar
              </span>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-text-secondary)]">
                <span>Future 30 days · Scheduled dates</span>
                <span>{calendarPreviewLoading ? 'Loading' : `${scheduledPreviewCount} scheduled`}</span>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-[var(--color-text-muted)]">
                {WEEKDAY_LABELS.map((label, index) => (
                  <div key={`${label}-${index}`}>{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calendarPreviewDays.map((day) => {
                  const isScheduled = scheduledDateKeys.has(day.key);
                  return (
                    <div
                      key={day.key}
                      className={`flex aspect-square min-h-6 items-center justify-center rounded-md text-[10px] font-semibold ${
                        isScheduled
                          ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                          : day.isToday
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {day.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </button>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 font-semibold">Service Tasks</h2>
            {loading ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">No assigned service tasks yet</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div>
                        <div className="font-medium">{ticket.order_no || ticket.id}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {ticket.customer_name || 'Customer'} / {ticket.customer_region || 'Region pending'}
                        </div>
                      </div>
                      <span className="rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {ticket.description ? formatEngineerDescription(ticket.description) : 'No service description yet'}
                    </p>
                    <div className="mt-3 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-3 py-2 text-xs text-[var(--color-text-primary)]">
                      <span className="font-semibold text-[var(--color-primary)]">Next step:</span> {getNextAction(ticket)}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
                      <div>Customer issue: {ticket.type || '-'}</div>
                      <div>Safety risk: {ticket.urgency === 'critical' ? 'High risk' : ticket.urgency === 'urgent' ? 'Priority' : 'Standard'}</div>
                      <div>Current engineer: {ticket.engineer_name || 'Pending regional assignment'}</div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
                      >
                        View / Handle Task
                      </button>
                      {!isRegionalLead && ticket.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => confirmAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:accept`}
                            className="min-h-10 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:accept` ? 'Confirming' : 'Confirm Assignment'}
                          </button>
                          <button
                            onClick={() => returnAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:reject`}
                            className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:reject` ? 'Returning' : 'Return to Dispatch'}
                          </button>
                        </>
                      )}
                    </div>
                    {ticket.conflict_status === 'blocked' && (
                      <div className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                        Conflict check: {ticket.conflict_reason || 'This engineer cannot receive this work order'}
                      </div>
                    )}
                    {isRegionalLead && (
                      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="text-xs font-medium text-[var(--color-text-primary)]">Regional Lead Assignment</div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            value={selectedEngineer[ticket.id] || ticket.engineer_id || ''}
                            onChange={(event) => setSelectedEngineer((prev) => ({ ...prev, [ticket.id]: event.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                          >
                            <option value="">Select team engineer</option>
                            {team.map((engineer) => (
                              <option key={engineer.id} value={engineer.id}>
                                {engineer.name}{engineer.service_region ? ` / ${engineer.service_region}` : ''}{engineer.status ? ` / ${engineer.status}` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignToEngineer(ticket)}
                            disabled={assigningId === ticket.id}
                            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === ticket.id ? 'Assigning' : 'Assign Engineer'}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          SAGEMRO blocks assignments when customer and engineer profiles show phone, company, or address conflicts.
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">Current Task Context</h2>
              {activeTicket ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">Work Order</div>
                    <div className="font-medium text-[var(--color-text-primary)]">{activeTicket.order_no || activeTicket.id}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">Customer / Region</div>
                    <div className="text-[var(--color-text-secondary)]">{activeTicket.customer_name || 'Customer'} / {activeTicket.customer_region || 'Region pending'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">Machine / Service Type</div>
                    <div className="text-[var(--color-text-secondary)]">{getMachineLine(activeTicket)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-[var(--color-text-muted)]">Next Step</div>
                    <div className="text-[var(--color-text-secondary)]">{getNextAction(activeTicket)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">Select a task to view job details and service preparation.</p>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3">
                <h2 className="font-semibold">Job Preparation</h2>
                {activeTicket && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Preparation for {activeTicket.order_no || activeTicket.id}
                  </p>
                )}
              </div>
              {activeTicket ? (
                <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                  <div>
                    <div className="mb-1 text-xs uppercase text-[var(--color-text-muted)]">Service Request Summary</div>
                    <p>{formatEngineerDescription(activeAiSummary.text)}</p>
                    {activeAiSummary.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeAiSummary.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs text-[var(--color-primary)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {activeAiSummary.notes && (
                      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{activeAiSummary.notes}</p>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase text-[var(--color-text-muted)]">Customer Equipment Record</div>
                    <p>{getMachineLine(activeTicket)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Select a service task to review customer issue, machine record, and preparation notes.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={18} className="text-[var(--color-primary)]" />
                <h2 className="font-semibold">Service Standard Checklist</h2>
              </div>
              <div className="space-y-2">
                {CHECKLIST.map((item) => (
                  <label key={item} className="flex gap-2 text-sm text-[var(--color-text-secondary)]">
                    <input type="checkbox" className="mt-1" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
    <WorkOrderDetailModal
      isOpen={Boolean(selectedTicket)}
      onClose={() => setSelectedTicket(null)}
      workOrder={selectedTicket}
      userType="engineer"
      userId={engineerId}
      onRateSuccess={loadTickets}
      onConfirmed={loadTickets}
    />
    <Modal
      isOpen={isCalendarOpen}
      onClose={() => {
        setIsCalendarOpen(false);
        loadCalendarPreview();
      }}
      title="My Scheduling Calendar"
      size="2xl"
    >
      <EngineerAvailabilityCalendar />
    </Modal>
    </>
  );
}
