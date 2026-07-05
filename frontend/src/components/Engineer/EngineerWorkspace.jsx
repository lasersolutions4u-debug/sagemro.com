import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, FileText, Lightbulb, Package, ShieldCheck, Wrench } from 'lucide-react';
import {
  assignEngineerWorkOrder,
  acceptTicket,
  getEngineerTeam,
  getEngineerTickets,
  getMyUpsellRequests,
  rejectTicket,
  updateEngineerStatus,
} from '../../services/api';
import { UpsellRequestModal } from '../Upsell/UpsellRequestModal';
import { getUpsellCategoryLabel, getUpsellStatusLabel } from '../Upsell/upsellRequestModel';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { EngineerAvailabilityCalendar } from './EngineerAvailabilityCalendar';
import {
  derivePaymentBadge,
  deriveWorkOrderActionLabel,
  groupEngineerTickets,
  sortEngineerWorkQueue,
} from './engineerWorkspaceModel';

const STATUS_LABELS = {
  pending: '待接单',
  pending_dispatch: '待区域派工',
  assigned: '待接单',
  in_progress: '服务中',
  pricing: '待提交报价',
  in_service: '服务中',
  resolved: '待客户确认',
  pending_review: '待归档',
  completed: '已完成',
};

const CHECKLIST = [
  '确认客户问题、设备型号、联系人和约定到场时间',
  '查看 AI 初诊摘要，留意激光、高压、气路等安全风险',
  '准备所需工具、备件、耗材和防护用品',
  '到场后拍摄设备铭牌、报警界面和故障位置',
  '记录处理过程、备件更换情况和后续建议',
  '完成服务报告，提交后等待客户确认',
];

function toneClass(tone) {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-600',
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    purple: 'bg-purple-500/10 text-purple-600',
    teal: 'bg-teal-500/10 text-teal-600',
    slate: 'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
  };
  return tones[tone] || tones.slate;
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
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellMessage, setUpsellMessage] = useState('');
  const [upsellRequests, setUpsellRequests] = useState([]);

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

  const loadUpsellRequests = useCallback(async () => {
    if (!engineerId) return;
    try {
      const data = await getMyUpsellRequests();
      setUpsellRequests(data.requests || []);
    } catch {
      setUpsellRequests([]);
    }
  }, [engineerId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    loadUpsellRequests();
  }, [loadUpsellRequests]);

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
    const reason = window.prompt('请填写退回调度的理由，该备注会记录给 SAGEMRO 运营团队查看。', '')?.trim();
    if (!reason) {
      setMessage('请先填写退回理由。');
      return;
    }
    setAssigningId(`${ticket.id}:reject`);
    setMessage('');
    try {
      await rejectTicket({ work_order_id: ticket.id, engineer_id: engineerId, reason });
      setMessage(`已退回调度：${ticket.order_no || ticket.id}`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || '退回调度失败');
    } finally {
      setAssigningId('');
    }
  };

  const grouped = groupEngineerTickets(tickets, isRegionalLead);
  const sortedTickets = sortEngineerWorkQueue(tickets);
  const metrics = [
    ...(isRegionalLead ? [{ icon: ClipboardCheck, label: '区域待分配', value: grouped.regionalPending.length }] : []),
    { icon: ClipboardCheck, label: '今日任务', value: grouped.today.length },
    { icon: AlertTriangle, label: '待接单', value: grouped.pending.length },
    { icon: Wrench, label: '服务中', value: grouped.active.length },
    { icon: FileText, label: '待提交报价', value: grouped.pricing.length },
    { icon: FileText, label: '待提交报告', value: grouped.reports.length },
    { icon: ShieldCheck, label: '待客户确认', value: grouped.customerConfirm.length },
    { icon: Package, label: '待回款确认', value: grouped.payment.length },
    { icon: ClipboardCheck, label: '本月完成', value: grouped.completedThisMonth.length },
    { icon: Package, label: '涉及备件', value: grouped.parts.length },
  ];

  return (
    <>
    <div className="h-[100dvh] overflow-y-auto bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
            <h1 className="text-xl font-semibold">
              {isRegionalLead ? '区域服务负责人工作台' : '工程师工作台'}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">现场服务任务与协作记录</p>
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
        {upsellMessage && (
          <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            {upsellMessage}
          </div>
        )}

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">我的任务概览</h2>
                <p className="text-sm text-[var(--color-text-muted)]">这里显示已经指派给你的现场服务任务。</p>
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
              <h2 className="font-semibold">到场前后检查</h2>
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
            <h2 className="mb-4 font-semibold">我的服务任务</h2>
            {loading ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">加载中...</div>
            ) : tickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">当前没有指派给你的服务任务</div>
            ) : (
              <div className="space-y-3">
                {sortedTickets.map((ticket) => {
                  const action = deriveWorkOrderActionLabel(ticket);
                  const paymentBadge = derivePaymentBadge(ticket);
                  return (
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
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${toneClass(action.tone)}`}>
                        {action.label}
                      </span>
                      {paymentBadge.visible && (
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${toneClass(paymentBadge.tone)}`}>
                          {paymentBadge.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
                      >
                        查看并处理
                      </button>
                      {!isRegionalLead && ticket.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => confirmAssignment(ticket)}
                            disabled={assigningId === `${ticket.id}:accept`}
                            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {assigningId === `${ticket.id}:accept` ? '确认中' : '确认接单'}
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
                  );
                })}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <EngineerAvailabilityCalendar />
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-3 font-semibold">工程师工具箱</h2>
              <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <button
                  onClick={() => setUpsellOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl bg-[var(--color-surface-elevated)] px-4 py-3 text-left text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <Lightbulb size={18} className="text-[var(--color-primary)]" />
                  <span>
                    <span className="block font-medium text-[var(--color-text-primary)]">增购与改造需求</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">把客户现场提到的配件、易损件、周边设备或改造需求记录下来。</span>
                  </span>
                </button>
                {upsellRequests.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {upsellRequests.slice(0, 3).map((request) => (
                      <div key={request.id} className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-[var(--color-text-primary)]">{request.title}</span>
                          <span className="shrink-0 text-[var(--color-primary)]">{getUpsellStatusLabel(request.status, 'zh-CN')}</span>
                        </div>
                        <div className="mt-1 text-[var(--color-text-muted)]">
                          {getUpsellCategoryLabel(request.category, 'zh-CN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2">
                  服务报告：把诊断结论、处理动作、配件更换和后续建议写清楚。
                </div>
                <div className="rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2">
                  物料申请：工单里找不到合适配件时，可提交新增物料申请。
                </div>
                <div className="rounded-xl bg-[var(--color-surface-elevated)] px-3 py-2">
                  回款进度：由运营维护，工程师端只作为服务闭环参考。
                </div>
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
    <UpsellRequestModal
      isOpen={upsellOpen}
      onClose={() => setUpsellOpen(false)}
      context={{ sourceType: 'engineer_workspace' }}
      onSubmitted={() => {
        setUpsellMessage('增购与改造需求已提交，Admin 会安排业务跟进。');
        loadUpsellRequests();
      }}
    />
    </>
  );
}
