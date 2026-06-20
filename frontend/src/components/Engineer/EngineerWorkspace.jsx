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

const STATUS_LABELS = {
  pending: '待确认派工',
  pending_dispatch: '待区域派工',
  assigned: '待确认派工',
  in_progress: '服务中',
  pricing: '待报价',
  in_service: '服务中',
  resolved: '待客户确认',
  pending_review: '待归档',
  completed: '已完成',
};

const CHECKLIST = [
  '确认客户问题、设备型号、现场联系人和到场时间',
  '阅读 SAGEMRO AI 初诊摘要，标记安全风险',
  '核对备件、工具、耗材和防护用品',
  '到场后拍照记录设备铭牌、报警界面和故障部位',
  '完成处理动作、备件更换和后续建议记录',
  '提交服务报告，等待客户确认',
];

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
      setMessage(error.message || '服务任务加载失败');
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
      setMessage(error.message || '团队工程师加载失败');
    }
  }, [isRegionalLead]);

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
      setMessage(error.message || '派工状态更新失败');
    }
  };

  const assignToEngineer = async (ticket) => {
    const engineerIdToAssign = selectedEngineer[ticket.id];
    if (!engineerIdToAssign) {
      setMessage('请先选择具体工程师');
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
      setMessage(`已分配：${ticket.order_no || ticket.id}`);
    } catch (error) {
      setMessage(error.message || '分配工程师失败');
    } finally {
      setAssigningId('');
    }
  };

  const confirmAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:accept`);
    setMessage('');
    try {
      await acceptTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(`已确认派工：${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || '确认派工失败');
    } finally {
      setAssigningId('');
    }
  };

  const returnAssignment = async (ticket) => {
    setAssigningId(`${ticket.id}:reject`);
    setMessage('');
    try {
      await rejectTicket({ work_order_id: ticket.id, engineer_id: engineerId });
      setMessage(`已退回调度：${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || '退回调度失败');
    } finally {
      setAssigningId('');
    }
  };

  const grouped = groupTickets(tickets);
  const metrics = [
    ...(isRegionalLead ? [{ icon: ClipboardCheck, label: '区域待分配', value: grouped.pending.length }] : []),
    { icon: ClipboardCheck, label: '今日派工', value: grouped.today.length },
    { icon: AlertTriangle, label: '待确认派工', value: grouped.pending.length },
    { icon: Wrench, label: '服务中', value: grouped.active.length },
    { icon: FileText, label: '待填写服务报告', value: grouped.reports.length },
    { icon: Package, label: '备件需求', value: grouped.parts.length },
  ];

  return (
    <>
    <div className="h-[100dvh] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
            <h1 className="text-xl font-semibold">
              {isRegionalLead ? '区域服务负责人工作台' : 'SAGEMRO 工程师工作台'}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">官方服务任务与现场记录中心</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenProfile}
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {currentUser?.name || '工程师档案'}
            </button>
            <button
              onClick={onLogout}
              className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              退出
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
                <h2 className="font-semibold">任务概览</h2>
                <p className="text-sm text-[var(--color-text-muted)]">只显示 SAGEMRO 已派发给你的服务任务。</p>
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'available', label: '可派工' },
                  { value: 'paused', label: '暂停派工' },
                  { value: 'offline', label: '离线' },
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
              <h2 className="font-semibold">服务标准检查清单</h2>
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
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 font-semibold">服务任务</h2>
            {loading ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">加载中...</div>
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">当前没有已派服务任务</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{ticket.order_no || ticket.id}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {ticket.customer_name || '客户'} · {ticket.customer_region || '地区待确认'}
                        </div>
                      </div>
                      <span className="rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">{ticket.description || '暂无服务描述'}</p>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
                      <div>客户问题：{ticket.type || '-'}</div>
                      <div>安全风险：{ticket.urgency === 'critical' ? '高风险' : ticket.urgency === 'urgent' ? '需优先处理' : '常规'}</div>
                      <div>当前工程师：{ticket.engineer_name || '待区域分配'}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
                      >
                        查看/处理服务任务
                      </button>
                      {!isRegionalLead && ticket.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => confirmAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:accept`}
                            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:accept` ? '确认中' : '确认派工'}
                          </button>
                          <button
                            onClick={() => returnAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:reject`}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:reject` ? '退回中' : '退回调度'}
                          </button>
                        </>
                      )}
                    </div>
                    {ticket.conflict_status === 'blocked' && (
                      <div className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                        利益冲突：{ticket.conflict_reason || '该工程师不可接收此工单'}
                      </div>
                    )}
                    {isRegionalLead && (
                      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="text-xs font-medium text-[var(--color-text-primary)]">区域负责人分配</div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            value={selectedEngineer[ticket.id] || ticket.engineer_id || ''}
                            onChange={(event) => setSelectedEngineer((prev) => ({ ...prev, [ticket.id]: event.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                          >
                            <option value="">选择团队工程师</option>
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
                            {assigningId === ticket.id ? '分配中' : '分配工程师'}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          系统会阻止客户账号与工程师档案存在手机号、公司或地址冲突的派工。
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
              <h2 className="mb-3 font-semibold">AI 诊断摘要</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                服务任务进入详情后，这里应显示客户对话整理出的故障现象、可能原因、安全风险、建议携带备件和现场检查重点。
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">客户设备档案</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                后续接入设备型号、品牌、历史服务记录、照片和服务报告，帮助工程师到场前完成准备。
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
