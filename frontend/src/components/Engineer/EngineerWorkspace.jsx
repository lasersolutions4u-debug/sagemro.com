import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, FileText, Package, ShieldCheck, Wrench } from 'lucide-react';
import {
  assignEngineerWorkOrder,
  acceptTicket,
  getEngineerTeam,
  getEngineerTickets,
  rejectTicket,
  updateEngineerStatus,
} from '../../services/api';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { EngineerAvailabilityCalendar } from './EngineerAvailabilityCalendar';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  cn: {
    statusLabels: {
      pending: '待确认',
      pending_dispatch: '待区域派工',
      assigned: '待确认',
      in_progress: '服务中',
      pricing: '待报价',
      in_service: '服务中',
      resolved: '待客户确认',
      pending_review: '待归档',
      completed: '已完成',
    },
    checklist: [
      '确认客户问题、设备型号、现场联系人和到场时间窗口',
      '查看 SAGEMRO AI 初诊摘要，并标记安全风险',
      '检查备件、工具、耗材和防护用品',
      '现场记录铭牌、报警界面和故障区域照片',
      '记录服务动作、备件更换和后续建议',
      '提交服务报告，等待客户确认',
    ],
    loadTasksError: '服务任务加载失败',
    loadTeamError: '团队工程师加载失败',
    updateAvailabilityError: '服务状态更新失败',
    selectEngineerFirst: '请先选择服务工程师',
    assigned: '已分配',
    assignEngineerError: '工程师分配失败',
    assignmentConfirmed: '已确认任务',
    confirmAssignmentError: '任务确认失败',
    returnedToDispatch: '已退回派工',
    returnAssignmentError: '退回派工失败',
    regionalQueue: '区域待派工',
    todaysTasks: '今日任务',
    pendingConfirmation: '待确认',
    inService: '服务中',
    reportsDue: '待提交报告',
    partsNeeds: '备件需求',
    regionalLeadWorkspace: '区域负责人工作台',
    engineerWorkspace: '工程师工作台',
    serviceConsole: 'SAGEMRO 服务控制台',
    engineerProfile: '工程师资料',
    signOut: '退出登录',
    taskOverview: '任务概览',
    taskOverviewDesc: '这里只显示通过 SAGEMRO 分配的服务任务。',
    availability: {
      available: '可服务',
      paused: '暂停接单',
      offline: '离线',
    },
    serviceChecklist: '服务标准清单',
    serviceTasks: '服务任务',
    loading: '加载中...',
    noTasks: '暂无已分配服务任务',
    customer: '客户',
    regionPending: '地区待确认',
    noDescription: '暂无服务描述',
    customerIssue: '客户问题',
    safetyRisk: '安全风险',
    riskHigh: '高风险',
    riskPriority: '优先处理',
    riskStandard: '标准',
    currentEngineer: '当前工程师',
    pendingRegionalAssignment: '待区域派工',
    viewTask: '查看 / 处理任务',
    confirming: '确认中',
    confirmAssignment: '确认接单',
    returning: '退回中',
    returnToDispatch: '退回派工',
    conflictCheck: '冲突检查',
    engineerCannotReceive: '该工程师不能接收此工单',
    regionalLeadAssignment: '区域负责人派工',
    selectTeamEngineer: '选择团队工程师',
    assigning: '分配中',
    assignEngineer: '分配工程师',
    conflictPolicy: '当客户与工程师资料中出现手机号、公司或地址冲突时，SAGEMRO 会阻止派工。',
    aiSummaryTitle: 'AI 初诊摘要',
    aiSummaryDesc: '当任务包含初诊信息时，这里会显示症状、可能原因、安全风险、建议备件和现场检查重点。',
    equipmentRecordTitle: '客户设备档案',
    equipmentRecordDesc: '设备型号、品牌、服务历史、照片和服务报告会帮助工程师在到场前做好准备。',
  },
  en: {
    statusLabels: {
      pending: 'Pending Confirmation',
      pending_dispatch: 'Pending Regional Dispatch',
      assigned: 'Pending Confirmation',
      in_progress: 'In Service',
      pricing: 'Pending Quote',
      in_service: 'In Service',
      resolved: 'Awaiting Customer Confirmation',
      pending_review: 'Pending Archive',
      completed: 'Completed',
    },
    checklist: [
      'Confirm customer issue, machine model, site contact, and arrival window',
      'Review the SAGEMRO AI intake summary and flag safety risks',
      'Check spare parts, tools, consumables, and protective equipment',
      'Record nameplate, alarm screen, and fault area photos on site',
      'Document service actions, parts replacement, and follow-up recommendations',
      'Submit the service report for customer confirmation',
    ],
    loadTasksError: 'Failed to load service tasks',
    loadTeamError: 'Failed to load team engineers',
    updateAvailabilityError: 'Failed to update availability',
    selectEngineerFirst: 'Please select a service engineer first',
    assigned: 'Assigned',
    assignEngineerError: 'Failed to assign engineer',
    assignmentConfirmed: 'Assignment confirmed',
    confirmAssignmentError: 'Failed to confirm assignment',
    returnedToDispatch: 'Returned to dispatch',
    returnAssignmentError: 'Failed to return assignment',
    regionalQueue: 'Regional Queue',
    todaysTasks: "Today's Tasks",
    pendingConfirmation: 'Pending Confirmation',
    inService: 'In Service',
    reportsDue: 'Reports Due',
    partsNeeds: 'Parts Needs',
    regionalLeadWorkspace: 'Regional Lead Workspace',
    engineerWorkspace: 'Engineer Workspace',
    serviceConsole: 'SAGEMRO Service Console',
    engineerProfile: 'Engineer Profile',
    signOut: 'Sign Out',
    taskOverview: 'Task Overview',
    taskOverviewDesc: 'Only service tasks assigned through SAGEMRO are shown here.',
    availability: {
      available: 'Available',
      paused: 'Paused',
      offline: 'Offline',
    },
    serviceChecklist: 'Service Standard Checklist',
    serviceTasks: 'Service Tasks',
    loading: 'Loading...',
    noTasks: 'No assigned service tasks yet',
    customer: 'Customer',
    regionPending: 'Region pending',
    noDescription: 'No service description yet',
    customerIssue: 'Customer issue',
    safetyRisk: 'Safety risk',
    riskHigh: 'High risk',
    riskPriority: 'Priority',
    riskStandard: 'Standard',
    currentEngineer: 'Current engineer',
    pendingRegionalAssignment: 'Pending regional assignment',
    viewTask: 'View / Handle Task',
    confirming: 'Confirming',
    confirmAssignment: 'Confirm Assignment',
    returning: 'Returning',
    returnToDispatch: 'Return to Dispatch',
    conflictCheck: 'Conflict check',
    engineerCannotReceive: 'This engineer cannot receive this work order',
    regionalLeadAssignment: 'Regional Lead Assignment',
    selectTeamEngineer: 'Select team engineer',
    assigning: 'Assigning',
    assignEngineer: 'Assign Engineer',
    conflictPolicy: 'SAGEMRO blocks assignments when customer and engineer profiles show phone, company, or address conflicts.',
    aiSummaryTitle: 'AI Intake Summary',
    aiSummaryDesc: 'When a task has intake details, this area should show symptoms, possible causes, safety risks, suggested spare parts, and on-site inspection priorities.',
    equipmentRecordTitle: 'Customer Equipment Record',
    equipmentRecordDesc: 'Machine model, brand, service history, photos, and service reports will support better preparation before the site visit.',
  },
};

// This component is the first shared implementation slice for the future
// engineer.sagemro.com portal. The customer main site should not remain the
// long-term engineer entry.
function groupTickets(tickets) {
  return {
    today: tickets.filter((ticket) => ['assigned', 'in_progress', 'in_service'].includes(ticket.status)),
    pending: tickets.filter((ticket) => ['pending', 'pending_dispatch', 'assigned'].includes(ticket.status)),
    active: tickets.filter((ticket) => ['in_progress', 'in_service', 'pricing'].includes(ticket.status)),
    reports: tickets.filter((ticket) => ['resolved', 'pending_review'].includes(ticket.status)),
    parts: tickets.filter((ticket) => /parts|备件|配件/i.test(`${ticket.type || ''} ${ticket.description || ''}`)),
  };
}

export function EngineerWorkspace({ currentUser, onLogout, onOpenProfile }) {
  const copy = isCnLocale() ? COPY.cn : COPY.en;
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

  const loadTickets = useCallback(async () => {
    if (!engineerId) return;
    setLoading(true);
    try {
      const data = await getEngineerTickets(engineerId);
      setTickets(data.work_orders || []);
    } catch (error) {
      setMessage(error.message || copy.loadTasksError);
    } finally {
      setLoading(false);
    }
  }, [engineerId, copy.loadTasksError]);

  const loadTeam = useCallback(async () => {
    if (!isRegionalLead) return;
    try {
      const data = await getEngineerTeam();
      setTeam(data.engineers || []);
    } catch (error) {
      setMessage(error.message || copy.loadTeamError);
    }
  }, [isRegionalLead, copy.loadTeamError]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const updateStatus = async (nextStatus) => {
    setStatus(nextStatus);
    try {
      await updateEngineerStatus({ engineer_id: engineerId, status: nextStatus });
    } catch (error) {
      setMessage(error.message || copy.updateAvailabilityError);
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
      setMessage(`${copy.assigned}: ${ticket.order_no || ticket.id}`);
    } catch (error) {
      setMessage(error.message || copy.assignEngineerError);
    } finally {
      setAssigningId('');
    }
  };

  const confirmAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:accept`);
    setMessage('');
    try {
      await acceptTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(`${copy.assignmentConfirmed}: ${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || copy.confirmAssignmentError);
    } finally {
      setAssigningId('');
    }
  };

  const returnAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:reject`);
    setMessage('');
    try {
      await rejectTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(`${copy.returnedToDispatch}: ${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || copy.returnAssignmentError);
    } finally {
      setAssigningId('');
    }
  };

  const grouped = groupTickets(tickets);
  const metrics = [
    ...(isRegionalLead ? [{ icon: ClipboardCheck, label: copy.regionalQueue, value: grouped.pending.length }] : []),
    { icon: ClipboardCheck, label: copy.todaysTasks, value: grouped.today.length },
    { icon: AlertTriangle, label: copy.pendingConfirmation, value: grouped.pending.length },
    { icon: Wrench, label: copy.inService, value: grouped.active.length },
    { icon: FileText, label: copy.reportsDue, value: grouped.reports.length },
    { icon: Package, label: copy.partsNeeds, value: grouped.parts.length },
  ];

  return (
    <>
    <div className="h-[100dvh] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
            <h1 className="text-xl font-semibold">
              {isRegionalLead ? copy.regionalLeadWorkspace : copy.engineerWorkspace}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">{copy.serviceConsole}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenProfile}
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {currentUser?.name || copy.engineerProfile}
            </button>
            <button
              onClick={onLogout}
              className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              {copy.signOut}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {message && (
          <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{copy.taskOverview}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">{copy.taskOverviewDesc}</p>
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'available', label: copy.availability.available },
                  { value: 'paused', label: copy.availability.paused },
                  { value: 'offline', label: copy.availability.offline },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => updateStatus(item.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                  <metric.icon size={18} className="mb-2 text-[var(--color-primary)]" />
                  <div className="text-2xl font-semibold">{metric.value}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[var(--color-primary)]" />
              <h2 className="font-semibold">{copy.serviceChecklist}</h2>
            </div>
            <div className="space-y-2">
              {copy.checklist.map((item) => (
                <label key={item} className="flex gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input type="checkbox" className="mt-1" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 font-semibold">{copy.serviceTasks}</h2>
            {loading ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.loading}</div>
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">{copy.noTasks}</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{ticket.order_no || ticket.id}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {ticket.customer_name || copy.customer} · {ticket.customer_region || copy.regionPending}
                        </div>
                      </div>
                      <span className="rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">
                        {copy.statusLabels[ticket.status] || ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">{ticket.description || copy.noDescription}</p>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
                      <div>{copy.customerIssue}: {ticket.type || '-'}</div>
                      <div>{copy.safetyRisk}: {ticket.urgency === 'critical' ? copy.riskHigh : ticket.urgency === 'urgent' ? copy.riskPriority : copy.riskStandard}</div>
                      <div>{copy.currentEngineer}: {ticket.engineer_name || copy.pendingRegionalAssignment}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
                      >
                        {copy.viewTask}
                      </button>
                      {!isRegionalLead && ticket.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => confirmAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:accept`}
                            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:accept` ? copy.confirming : copy.confirmAssignment}
                          </button>
                          <button
                            onClick={() => returnAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:reject`}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:reject` ? copy.returning : copy.returnToDispatch}
                          </button>
                        </>
                      )}
                    </div>
                    {ticket.conflict_status === 'blocked' && (
                      <div className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                        {copy.conflictCheck}: {ticket.conflict_reason || copy.engineerCannotReceive}
                      </div>
                    )}
                    {isRegionalLead && (
                      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="text-xs font-medium text-[var(--color-text-primary)]">{copy.regionalLeadAssignment}</div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            value={selectedEngineer[ticket.id] || ticket.engineer_id || ''}
                            onChange={(event) => setSelectedEngineer((prev) => ({ ...prev, [ticket.id]: event.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                          >
                            <option value="">{copy.selectTeamEngineer}</option>
                            {team.map((engineer) => (
                              <option key={engineer.id} value={engineer.id}>
                                {engineer.name}{engineer.service_region ? ` · ${engineer.service_region}` : ''}{engineer.status ? ` · ${engineer.status}` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignToEngineer(ticket)}
                            disabled={assigningId === ticket.id}
                            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === ticket.id ? copy.assigning : copy.assignEngineer}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          {copy.conflictPolicy}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <EngineerAvailabilityCalendar />
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">{copy.aiSummaryTitle}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {copy.aiSummaryDesc}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">{copy.equipmentRecordTitle}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {copy.equipmentRecordDesc}
              </p>
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
    </>
  );
}
