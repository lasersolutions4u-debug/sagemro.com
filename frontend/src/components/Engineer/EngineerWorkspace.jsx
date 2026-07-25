import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  acceptTicket,
  assignEngineerWorkOrder,
  getEngineerCalendarEvents,
  getEngineerTeam,
  getEngineerTickets,
  rejectTicket,
  updateEngineerStatus,
} from '../../services/api';
import { redactContactInfo } from '../../utils/contactRedaction';
import { isCnLocale } from '../../utils/locale';
import { Modal } from '../common/Modal';
import { EngineerAvailabilityCalendar } from './EngineerAvailabilityCalendar';
import { EngineerMetricOverview } from './EngineerMetricOverview';
import { EngineerTeamWorkOrderList } from './EngineerTeamWorkOrderList';
import { EngineerWorkOrderDetail } from './EngineerWorkOrderDetail';
import { EngineerWorkOrderList } from './EngineerWorkOrderList';
import { getEngineerMachineLine } from './engineerWorkOrderDisplay';
import { buildEngineerMetrics } from './engineerWorkOrderMetrics';

const STATUS_LABELS = {
  pending: 'Pending', pending_dispatch: 'Pending Dispatch', assigned: 'Pending Confirmation',
  in_progress: 'In Service', pricing: 'Quote Pending', pending_payment: 'Payment Follow-up',
  payment_review: 'Payment Review', in_service: 'In Service', resolved: 'Customer Confirmation',
  pending_review: 'Report Review', completed: 'Completed',
};
const STATUS_LABELS_CN = {
  pending: '待处理', pending_dispatch: '待区域派工', assigned: '待确认派工',
  in_progress: '服务准备中', pricing: '待报价', pending_payment: '待付款跟进',
  payment_review: '付款审核中', in_service: '服务中', resolved: '待客户确认',
  pending_review: '报告审核中', completed: '已完成',
};
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_LABELS_CN = ['日', '一', '二', '三', '四', '五', '六'];
const CALENDAR_PREVIEW_DAYS = 28;

const COPY = {
  en: {
    regionalTitle: 'Regional Lead Workspace', engineerTitle: 'Engineer Workspace',
    subtitle: 'SAGEMRO Service Console', locale: 'EN · English workspace',
    profileFallback: 'Engineer Profile', signOut: 'Sign Out',
    loadTasksFailed: 'Failed to load service tasks', updateAvailabilityFailed: 'Failed to update availability',
    selectEngineerFirst: 'Select a team engineer first', assignFailed: 'Failed to assign engineer',
    assigned: (orderNo) => `Assigned: ${orderNo}`, confirmFailed: 'Failed to confirm assignment',
    assignmentConfirmed: (orderNo) => `Assignment confirmed: ${orderNo}`,
    returnPrompt: 'Enter the reason for returning this dispatch. SAGEMRO operations will see it.',
    returnReasonRequired: 'Enter a return reason before submitting.', returnFailed: 'Failed to return assignment',
    returned: (orderNo) => `Returned to dispatch: ${orderNo}`,
    statuses: { available: 'Available', paused: 'Paused', offline: 'Offline' },
    calendarTitle: 'Scheduling calendar', calendarNote: 'Availability, blocked dates and service windows.',
    openCalendar: 'Open calendar →', calendarRange: 'Next 28 days', scheduledCount: (count) => `${count} scheduled dates`,
    modalCalendarTitle: 'My Scheduling Calendar', machinePending: 'Machine details pending',
    nextActions: {
      pending: 'Wait for SAGEMRO dispatch review.', pending_dispatch: 'Assign a qualified engineer.',
      assigned: 'Confirm the assignment or return it with a reason.', in_progress: 'Prepare the service plan and quote.',
      pricing: 'Submit or revise the quote.', pending_payment: 'Follow up on payment and request Admin approval.',
      payment_review: 'Wait for Admin payment confirmation.', in_service: 'Complete field work and service records.',
      resolved: 'Wait for customer confirmation.', pending_review: 'Complete the service report review.',
      completed: 'Archive service notes.', fallback: 'Open the work order and review the next step.',
    },
  },
  cn: {
    regionalTitle: '区域负责人工作台', engineerTitle: '工程师工作台',
    subtitle: 'SAGEMRO 服务工作台', locale: '中文工作台',
    profileFallback: '工程师资料', signOut: '退出登录',
    loadTasksFailed: '服务任务加载失败', updateAvailabilityFailed: '可服务状态更新失败',
    selectEngineerFirst: '请先选择团队工程师', assignFailed: '工程师派工失败',
    assigned: (orderNo) => `已派工：${orderNo}`, confirmFailed: '派工确认失败',
    assignmentConfirmed: (orderNo) => `派工已确认：${orderNo}`,
    returnPrompt: '请输入退回派工的原因，该原因会记录给 SAGEMRO 运营。',
    returnReasonRequired: '提交前请填写退回原因。', returnFailed: '退回派工失败',
    returned: (orderNo) => `已退回派工：${orderNo}`,
    statuses: { available: '可接单', paused: '暂停接单', offline: '离线' },
    calendarTitle: '排期日历', calendarNote: '可服务时间、不可服务日期和现场服务窗口。',
    openCalendar: '打开日历 →', calendarRange: '未来 28 天', scheduledCount: (count) => `${count} 个已排期日期`,
    modalCalendarTitle: '我的排期日历', machinePending: '设备信息待补充',
    nextActions: {
      pending: '等待 SAGEMRO 派工审核。', pending_dispatch: '分配合适的工程师。',
      assigned: '确认派工，或填写原因退回。', in_progress: '准备服务方案和报价。',
      pricing: '提交或修改报价。', pending_payment: '跟进付款并请求 Admin 批准。',
      payment_review: '等待 Admin 确认付款。', in_service: '完成现场服务和服务记录。',
      resolved: '等待客户确认。', pending_review: '完成服务报告审核。',
      completed: '归档服务记录。', fallback: '打开工单并查看下一步。',
    },
  },
};

function getNextAction(ticket, copy) {
  return copy.nextActions[ticket?.status] || copy.nextActions.fallback;
}
function formatDescription(value) {
  return redactContactInfo(String(value || ''));
}
function startOfLocalDay(value) {
  const date = new Date(value); date.setHours(0, 0, 0, 0); return date;
}
function addDays(value, days) {
  const date = startOfLocalDay(value); date.setDate(date.getDate() + days); return date;
}
function formatDateKey(value) {
  const date = startOfLocalDay(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function buildCalendarPreviewDays(referenceDate = new Date()) {
  return Array.from({ length: CALENDAR_PREVIEW_DAYS }, (_, index) => {
    const date = addDays(referenceDate, index);
    return { key: formatDateKey(date), day: date.getDate(), isToday: index === 0 };
  });
}
function getScheduledDateKeys(events) {
  return new Set(events.map((event) => formatDateKey(event.start_at)).filter(Boolean));
}

export function EngineerWorkspace({ currentUser, onLogout, onOpenProfile, workOrderId = '' }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const statusLabels = isCn ? STATUS_LABELS_CN : STATUS_LABELS;
  const weekdayLabels = isCn ? WEEKDAY_LABELS_CN : WEEKDAY_LABELS;
  const engineerId = localStorage.getItem('sagemro_engineer_id') || currentUser?.id || '';
  const isRegionalLead = currentUser?.role === 'regional_lead' || currentUser?.engineer_role === 'regional_lead' || currentUser?.level === 'regional_lead';
  const [scope, setScope] = useState('personal');
  const [tickets, setTickets] = useState([]);
  const [team, setTeam] = useState([]);
  const [engineerSummary, setEngineerSummary] = useState({ id: engineerId, name: currentUser?.name || '', status: 'available' });
  const [selectedEngineer, setSelectedEngineer] = useState({});
  const [assigningId, setAssigningId] = useState('');
  const [status, setStatus] = useState(currentUser?.status || 'available');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [workOrderFilter, setWorkOrderFilter] = useState('all');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);

  const loadTickets = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const data = await getEngineerTickets({ scope });
      setTickets(data.work_orders || []);
      if (scope === 'team') setTeam(data.team || []);
      setEngineerSummary((current) => ({ ...current, ...(data.engineer || {}) }));
    } catch (error) {
      setTickets([]);
      if (scope === 'team') setTeam([]);
      setLoadError(error.message || copy.loadTasksFailed);
    } finally { setLoading(false); }
  }, [copy.loadTasksFailed, scope]);

  const loadCalendar = useCallback(async () => {
    try {
      const data = await getEngineerCalendarEvents({ from: new Date().toISOString(), to: addDays(new Date(), CALENDAR_PREVIEW_DAYS).toISOString() });
      setCalendarEvents(data.events || []);
    } catch { setCalendarEvents([]); }
  }, []);

  const loadTeam = useCallback(async () => {
    if (!isRegionalLead) return;
    try {
      const data = await getEngineerTeam();
      setTeam(data.engineers || []);
    } catch {
      setTeam([]);
    }
  }, [isRegionalLead]);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => { loadCalendar(); }, [loadCalendar]);
  useEffect(() => { loadTeam(); }, [loadTeam]);

  const updateStatus = async (nextStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    try { await updateEngineerStatus({ status: nextStatus }); }
    catch (error) { setStatus(previousStatus); setMessage(error.message || copy.updateAvailabilityFailed); }
  };
  const assignToEngineer = async (ticket) => {
    const target = selectedEngineer[ticket.id];
    if (!target) return setMessage(copy.selectEngineerFirst);
    setAssigningId(ticket.id);
    try {
      await assignEngineerWorkOrder({ work_order_id: ticket.id, engineer_id: target });
      setMessage(copy.assigned(ticket.order_no || ticket.id)); await loadTickets(); return true;
    } catch (error) { setMessage(error.message || copy.assignFailed); }
    finally { setAssigningId(''); }
    return false;
  };
  const confirmAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:accept`);
    try { await acceptTicket({ work_order_id: ticket.id }); setMessage(copy.assignmentConfirmed(ticket.order_no || ticket.id)); await loadTickets(); return true; }
    catch (error) { setMessage(error.message || copy.confirmFailed); }
    finally { setAssigningId(''); }
    return false;
  };
  const returnAssignment = async (ticket) => {
    const reason = window.prompt(copy.returnPrompt, '')?.trim();
    if (!reason) return setMessage(copy.returnReasonRequired);
    setAssigningId(`${ticket.id}:reject`);
    try { await rejectTicket({ work_order_id: ticket.id, reason }); setMessage(copy.returned(ticket.order_no || ticket.id)); await loadTickets(); return true; }
    catch (error) { setMessage(error.message || copy.returnFailed); }
    finally { setAssigningId(''); }
    return false;
  };
  const openWorkOrder = (ticket) => {
    window.history.pushState({}, '', `/work-orders/${encodeURIComponent(ticket.id)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const backToOrders = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const metrics = useMemo(
    () => buildEngineerMetrics(tickets, scope === 'team' ? [] : calendarEvents, new Date(), scope),
    [calendarEvents, scope, tickets],
  );
  const previewDays = buildCalendarPreviewDays();
  const scheduledKeys = getScheduledDateKeys(calendarEvents);

  return (
    <>
      <div className="h-[100dvh] overflow-y-auto bg-[#f2f4f7] text-[#18202b]">
        <header className="border-b border-[#e5e8ed] bg-white">
          <div className="mx-auto flex max-w-[1540px] flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-7">
            <div className="flex items-center gap-4">
              <div className="border-r border-[#e5e8ed] pr-4 text-sm font-extrabold tracking-[.25em] text-orange-600">SAGEMRO</div>
              <div><h1 className="text-lg font-semibold">{isRegionalLead ? copy.regionalTitle : copy.engineerTitle}</h1><p className="mt-1 text-xs text-[#697386]">{copy.subtitle}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">{copy.locale}</span>
              <button type="button" onClick={onOpenProfile} className="rounded-[10px] border border-[#e5e8ed] bg-white px-3 py-2 text-xs font-bold">{currentUser?.name || copy.profileFallback}</button>
              <button type="button" onClick={onLogout} className="rounded-[10px] bg-orange-500 px-4 py-2 text-xs font-bold text-white">{copy.signOut}</button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1540px] px-3 py-4 sm:px-5 sm:py-6">
          {message && <div className="mb-4 rounded-xl border border-[#e5e8ed] bg-white px-4 py-3 text-sm text-[#697386]">{message}</div>}
          {workOrderId ? (
            <EngineerWorkOrderDetail
              workOrderId={workOrderId}
              engineerId={engineerId}
              isCn={isCn}
              isRegionalLead={isRegionalLead}
              team={team}
              selectedEngineer={selectedEngineer}
              assigningId={assigningId}
              statusLabels={statusLabels}
              getNextAction={(ticket) => getNextAction(ticket, copy)}
              getMachineLine={(ticket) => getEngineerMachineLine(ticket, isCn, copy.machinePending)}
              formatDescription={formatDescription}
              onBack={backToOrders}
              onConfirmAssignment={confirmAssignment}
              onReturnAssignment={returnAssignment}
              onAssignEngineer={assignToEngineer}
              onEngineerSelectionChange={(ticketId, value) => setSelectedEngineer((current) => ({ ...current, [ticketId]: value }))}
              onWorkOrderChanged={loadTickets}
            />
          ) : (
            <>
              <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,2.15fr)_minmax(330px,.85fr)]">
                <EngineerMetricOverview metrics={metrics} scope={scope} onScopeChange={setScope} isRegionalLead={isRegionalLead} isCn={isCn} loading={loading} />
                <section className="rounded-2xl border border-[#e5e8ed] bg-white p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold">{copy.calendarTitle}</h2><p className="mt-1 text-xs text-[#697386]">{copy.calendarNote}</p></div><button type="button" onClick={() => setIsCalendarOpen(true)} className="text-[11px] font-bold text-orange-600">{copy.openCalendar}</button></div>
                  <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-[#929baa]">{weekdayLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
                  <div className="mt-2 grid grid-cols-7 gap-1">{previewDays.map((day) => <span key={day.key} className={`grid h-7 place-items-center rounded-md text-[10px] font-bold ${scheduledKeys.has(day.key) ? 'bg-orange-50 text-orange-700' : day.isToday ? 'bg-[#18202b] text-white' : 'text-[#697386]'}`}>{day.day}</span>)}</div>
                  <div className="mt-4 flex justify-between text-[10px] text-[#929baa]"><span>{copy.calendarRange}</span><strong>{copy.scheduledCount(scheduledKeys.size)}</strong></div>
                  <div className="mt-4 flex flex-wrap gap-2">{Object.entries(copy.statuses).map(([value, label]) => <button key={value} type="button" onClick={() => updateStatus(value)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${status === value ? 'bg-emerald-600 text-white' : 'bg-[#f7f8fa] text-[#697386]'}`}>{label}</button>)}</div>
                </section>
              </div>
              {scope === 'team' && isRegionalLead ? (
                <EngineerTeamWorkOrderList tickets={tickets} team={team} lead={{ ...engineerSummary, id: engineerId, status }} loading={loading} error={loadError} isCn={isCn} statusLabels={statusLabels} getNextAction={(ticket) => getNextAction(ticket, copy)} getMachineLine={(ticket) => getEngineerMachineLine(ticket, isCn, copy.machinePending)} filter={workOrderFilter} onFilterChange={setWorkOrderFilter} onSelectTicket={openWorkOrder} onRetry={loadTickets} />
              ) : (
                <EngineerWorkOrderList tickets={tickets} loading={loading} error={loadError} isCn={isCn} statusLabels={statusLabels} getNextAction={(ticket) => getNextAction(ticket, copy)} getMachineLine={(ticket) => getEngineerMachineLine(ticket, isCn, copy.machinePending)} filter={workOrderFilter} onFilterChange={setWorkOrderFilter} onSelectTicket={openWorkOrder} onRetry={loadTickets} />
              )}
            </>
          )}
        </main>
      </div>
      <Modal isOpen={isCalendarOpen} onClose={() => { setIsCalendarOpen(false); loadCalendar(); }} title={copy.modalCalendarTitle} size="2xl"><EngineerAvailabilityCalendar /></Modal>
    </>
  );
}
