import { useCallback, useEffect, useState } from 'react';
import {
  assignEngineerWorkOrder,
  acceptTicket,
  getEngineerCalendarEvents,
  getEngineerTeam,
  getEngineerTickets,
  rejectTicket,
  updateEngineerStatus,
} from '../../services/api';
import { Modal } from '../common/Modal';
import { EngineerAvailabilityCalendar } from './EngineerAvailabilityCalendar';
import { EngineerWorkOrderDetail } from './EngineerWorkOrderDetail';
import { EngineerWorkOrderList } from './EngineerWorkOrderList';
import {
  categoryConfig,
  categoryL2Labels,
  typeLabels,
} from '../../data/workOrderConfig';
import { redactContactInfo } from '../../utils/contactRedaction';
import { isCnLocale } from '../../utils/locale';

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

const STATUS_LABELS_CN = {
  pending: '待确认',
  pending_dispatch: '待区域派工',
  assigned: '待确认派工',
  in_progress: '服务处理中',
  pricing: '待报价',
  in_service: '服务中',
  resolved: '待客户确认',
  pending_review: '待归档',
  completed: '已完成',
};

const CALENDAR_PREVIEW_DAYS = 30;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_LABELS_CN = ['日', '一', '二', '三', '四', '五', '六'];

const WORKSPACE_COPY = {
  en: {
    regionalTitle: 'Regional Lead Workspace',
    engineerTitle: 'Engineer Workspace',
    subtitle: 'SAGEMRO Service Console',
    profileFallback: 'Engineer Profile',
    signOut: 'Sign Out',
    loadTasksFailed: 'Failed to load service tasks',
    loadTeamFailed: 'Failed to load team engineers',
    updateAvailabilityFailed: 'Failed to update availability',
    selectEngineerFirst: 'Please select a service engineer first',
    assigned: (orderNo) => `Assigned: ${orderNo}`,
    assignFailed: 'Failed to assign engineer',
    assignmentConfirmed: (orderNo) => `Assignment confirmed: ${orderNo}`,
    confirmFailed: 'Failed to confirm assignment',
    returnPrompt: 'Please enter the reason for returning this dispatch. It will be recorded for SAGEMRO operations.',
    returnReasonRequired: 'Please enter a return reason before submitting.',
    returned: (orderNo) => `Returned to dispatch: ${orderNo}`,
    returnFailed: 'Failed to return assignment',
    statuses: { available: 'Available', paused: 'Paused', offline: 'Offline' },
    calendarTitle: 'Scheduling Calendar',
    calendarNote: 'Update availability, blocked dates, and service windows.',
    openCalendar: 'Open calendar',
    calendarRange: 'Future 30 days · Scheduled dates',
    loadingShort: 'Loading',
    scheduledCount: (count) => `${count} scheduled`,
    modalCalendarTitle: 'My Scheduling Calendar',
    machinePending: 'Machine details pending',
    nextActions: {
      pending: 'Wait for SAGEMRO dispatch review.',
      pending_dispatch: 'Regional Lead should assign a qualified engineer.',
      assigned: 'Confirm assignment or return it with a reason.',
      in_progress: 'Prepare quote, site plan, and customer communication.',
      pricing: 'Submit or update the quote for Admin review.',
      pending_payment: 'Follow up with the customer and request Admin approval after payment.',
      payment_review: 'Wait for Admin payment confirmation before starting service.',
      in_service: 'Complete the service report and submit it to the customer.',
      resolved: 'Wait for customer confirmation and review.',
      pending_review: 'Wait for customer confirmation and review.',
      completed: 'Confirm payout status and archive your notes.',
      fallback: 'Open the task and review current details.',
    },
  },
  cn: {
    regionalTitle: '区域负责人工作台',
    engineerTitle: '工程师工作台',
    subtitle: 'SAGEMRO 服务工作台',
    profileFallback: '工程师资料',
    signOut: '退出登录',
    loadTasksFailed: '服务任务加载失败',
    loadTeamFailed: '团队工程师加载失败',
    updateAvailabilityFailed: '可服务状态更新失败',
    selectEngineerFirst: '请先选择服务工程师',
    assigned: (orderNo) => `已派工：${orderNo}`,
    assignFailed: '工程师派工失败',
    assignmentConfirmed: (orderNo) => `派工已确认：${orderNo}`,
    confirmFailed: '派工确认失败',
    returnPrompt: '请输入退回派工的原因，该原因会记录给 SAGEMRO 运营。',
    returnReasonRequired: '提交前请填写退回原因。',
    returned: (orderNo) => `已退回派工：${orderNo}`,
    returnFailed: '退回派工失败',
    statuses: { available: '可接单', paused: '暂停接单', offline: '离线' },
    calendarTitle: '排期日历',
    calendarNote: '维护可服务时间、不可服务日期和现场服务窗口。',
    openCalendar: '打开日历',
    calendarRange: '未来 30 天 · 已安排日期',
    loadingShort: '加载中',
    scheduledCount: (count) => `${count} 个已安排`,
    modalCalendarTitle: '我的排期日历',
    machinePending: '设备信息待补充',
    nextActions: {
      pending: '等待 SAGEMRO 派工审核。',
      pending_dispatch: '区域负责人需要分配合适的工程师。',
      assigned: '确认派工，或填写原因退回。',
      in_progress: '准备报价、现场计划和客户沟通。',
      pricing: '提交或更新报价，等待 Admin 审核。',
      pending_payment: '跟进客户付款，并在付款后请求 Admin 批准开始服务。',
      payment_review: '等待 Admin 确认付款后再开始服务。',
      in_service: '完成服务报告并提交给客户确认。',
      resolved: '等待客户确认和评价。',
      pending_review: '等待客户确认和评价。',
      completed: '确认结算状态并归档记录。',
      fallback: '打开任务并查看当前详情。',
    },
  },
};

function getNextAction(ticket, copy = WORKSPACE_COPY.en) {
  return copy.nextActions[ticket?.status] || copy.nextActions.fallback;
}

function getDeviceLabel(ticket, isCn = false) {
  const categories = categoryConfig;
  const types = typeLabels;
  const label = ticket?.category_l1 && ticket.category_l1 !== 'other'
    ? categories[ticket.category_l1]?.label
    : types[ticket?.type];
  return label || '';
}

function getIssueLabel(ticket, isCn = false) {
  if (!ticket?.category_l2 || ticket.category_l2 === 'other') return '';
  const categories = categoryConfig;
  const labels = categoryL2Labels;
  return categories[ticket.category_l1]?.l2?.[ticket.category_l2] || labels[ticket.category_l2] || '';
}

function getMachineLine(ticket, isCn = false, copy = WORKSPACE_COPY.en) {
  const deviceDetails = [ticket?.device_brand || ticket?.brand, ticket?.device_model || ticket?.model].filter(Boolean);
  const serviceContext = [getDeviceLabel(ticket, isCn), getIssueLabel(ticket, isCn)].filter(Boolean);
  return [...serviceContext, ...deviceDetails].filter(Boolean).join(' / ') || copy.machinePending;
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

function formatEngineerDescription(description, isCn = false) {
  if (isCn) return redactContactInfo(description);
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
  const isCn = isCnLocale();
  const copy = isCn ? WORKSPACE_COPY.cn : WORKSPACE_COPY.en;
  const statusLabels = isCn ? STATUS_LABELS_CN : STATUS_LABELS;
  const weekdayLabels = isCn ? WEEKDAY_LABELS_CN : WEEKDAY_LABELS;
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
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [workOrderFilter, setWorkOrderFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarPreviewEvents, setCalendarPreviewEvents] = useState([]);
  const [calendarPreviewLoading, setCalendarPreviewLoading] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!engineerId) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await getEngineerTickets(engineerId);
      setTickets(data.work_orders || []);
    } catch (error) {
      setLoadError(error.message || copy.loadTasksFailed);
    } finally {
      setLoading(false);
    }
  }, [engineerId, copy.loadTasksFailed]);

  const refreshTicketsAndSelection = useCallback(async () => {
    const data = await getEngineerTickets(engineerId);
    const nextTickets = data.work_orders || [];
    setTickets(nextTickets);
    setSelectedTicket((current) => current
      ? nextTickets.find((ticket) => ticket.id === current.id) || current
      : null);
  }, [engineerId]);

  const loadTeam = useCallback(async () => {
    if (!isRegionalLead) return;
    try {
      const data = await getEngineerTeam();
      setTeam(data.engineers || []);
    } catch (error) {
      setMessage(error.message || copy.loadTeamFailed);
    }
  }, [isRegionalLead, copy.loadTeamFailed]);

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
      setMessage(error.message || copy.updateAvailabilityFailed);
    }
  };

  const assignToEngineer = async (ticket) => {
    const engineerIdToAssign = selectedEngineer[ticket.id];
    if (!engineerIdToAssign) {
      setMessage(copy.selectEngineerFirst);
      return;
    }
    setAssigningId(ticket.id);
    setMessage('');
    try {
      await assignEngineerWorkOrder({
        work_order_id: ticket.id,
        engineer_id: engineerIdToAssign,
      });
      await refreshTicketsAndSelection();
      setMessage(copy.assigned(ticket.order_no || ticket.id));
    } catch (error) {
      setMessage(error.message || copy.assignFailed);
    } finally {
      setAssigningId('');
    }
  };

  const confirmAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:accept`);
    setMessage('');
    try {
      await acceptTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(copy.assignmentConfirmed(ticket.order_no || ticket.id));
      await refreshTicketsAndSelection();
    } catch (error) {
      setMessage(error.message || copy.confirmFailed);
    } finally {
      setAssigningId('');
    }
  };

  const returnAssignment = async (ticket) => {
    const reason = window.prompt(
      copy.returnPrompt,
      '',
    )?.trim();
    if (!reason) {
      setMessage(copy.returnReasonRequired);
      return;
    }
    setAssigningId(`${ticket.id}:reject`);
    setMessage('');
    try {
      await rejectTicket({ work_order_id: ticket.id, engineer_id: engineerId, reason });
      setMessage(copy.returned(ticket.order_no || ticket.id));
      await refreshTicketsAndSelection();
    } catch (error) {
      setMessage(error.message || copy.returnFailed);
    } finally {
      setAssigningId('');
    }
  };

  const calendarPreviewDays = buildCalendarPreviewDays();
  const scheduledDateKeys = getScheduledDateKeys(calendarPreviewEvents, calendarPreviewDays[0]?.date);
  const scheduledPreviewCount = calendarPreviewDays.filter((day) => scheduledDateKeys.has(day.key)).length;

  return (
    <>
    <div className="h-[100dvh] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
            <h1 className="text-xl font-semibold">
              {isRegionalLead ? copy.regionalTitle : copy.engineerTitle}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">{copy.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <button
              onClick={onOpenProfile}
              className="min-h-10 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {currentUser?.name || copy.profileFallback}
            </button>
            <button
              onClick={onLogout}
              className="min-h-10 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              {copy.signOut}
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

        <section className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 gap-2 sm:flex">
              {[
                { value: 'available', label: copy.statuses.available },
                { value: 'paused', label: copy.statuses.paused },
                { value: 'offline', label: copy.statuses.offline },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => updateStatus(item.value)}
                  className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    status === item.value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCalendarOpen(true)}
              className="group min-w-0 flex-1 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-surface-elevated)] p-2 text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] lg:max-w-2xl"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)]">{copy.calendarTitle}</span>
                  <span className="ml-2 text-xs text-[var(--color-text-muted)]">{copy.calendarNote}</span>
                </div>
                <span className="text-xs font-medium text-[var(--color-primary)]">{copy.openCalendar}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                  <div>{copy.calendarRange}</div>
                  <div>{calendarPreviewLoading ? copy.loadingShort : copy.scheduledCount(scheduledPreviewCount)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 grid grid-cols-7 gap-0.5 text-center text-[9px] font-semibold text-[var(--color-text-muted)]">
                    {weekdayLabels.map((label, index) => (
                      <div key={`${label}-${index}`}>{label}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarPreviewDays.map((day) => {
                      const isScheduled = scheduledDateKeys.has(day.key);
                      return (
                        <div
                          key={day.key}
                          className={`flex min-h-6 items-center justify-center rounded text-[9px] font-semibold ${
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
              </div>
            </button>
          </div>
        </section>

        {selectedTicket ? (
          <EngineerWorkOrderDetail
            ticket={selectedTicket}
            engineerId={engineerId}
            isCn={isCn}
            isRegionalLead={isRegionalLead}
            team={team}
            selectedEngineer={selectedEngineer}
            assigningId={assigningId}
            statusLabels={statusLabels}
            getNextAction={(ticket) => getNextAction(ticket, copy)}
            getMachineLine={(ticket) => getMachineLine(ticket, isCn, copy)}
            formatDescription={(value) => formatEngineerDescription(value, isCn)}
            onBack={() => setSelectedTicket(null)}
            onRetry={loadTickets}
            onConfirmAssignment={confirmAssignment}
            onReturnAssignment={returnAssignment}
            onAssignEngineer={assignToEngineer}
            onEngineerSelectionChange={(ticketId, value) => setSelectedEngineer((current) => ({ ...current, [ticketId]: value }))}
            onWorkOrderChanged={refreshTicketsAndSelection}
          />
        ) : (
          <EngineerWorkOrderList
            tickets={tickets}
            loading={loading}
            error={loadError}
            isCn={isCn}
            statusLabels={statusLabels}
            getNextAction={(ticket) => getNextAction(ticket, copy)}
            getMachineLine={(ticket) => getMachineLine(ticket, isCn, copy)}
            formatDescription={(value) => formatEngineerDescription(value, isCn)}
            filter={workOrderFilter}
            onFilterChange={setWorkOrderFilter}
            onSelectTicket={setSelectedTicket}
            onRetry={loadTickets}
          />
        )}
      </main>
    </div>
    <Modal
      isOpen={isCalendarOpen}
      onClose={() => {
        setIsCalendarOpen(false);
        loadCalendarPreview();
      }}
      title={copy.modalCalendarTitle}
      size="2xl"
    >
      <EngineerAvailabilityCalendar />
    </Modal>
    </>
  );
}
