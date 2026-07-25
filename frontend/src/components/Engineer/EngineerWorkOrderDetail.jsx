import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWorkOrder } from '../../services/api';
import { WorkOrderDetailContent } from '../WorkOrder/WorkOrderDetailModal';
import { getEngineerScheduleLabel, getEngineerWorkOrderTitle } from './engineerWorkOrderDisplay';

const CHECKLIST = {
  en: [
    'Confirm customer issue, machine model, site contact, and arrival window',
    'Review the intake summary and flag safety risks',
    'Check tools, spare parts, consumables, and protective equipment',
    'Record nameplate, alarm screen, and fault area photos on site',
    'Document service actions, parts replacement, and follow-up recommendations',
    'Submit the service report for customer confirmation',
  ],
  cn: [
    '确认客户问题、设备型号、现场联系人和到场时间',
    '查看接单摘要，并标记安全风险',
    '检查备件、工具、耗材和防护用品',
    '现场记录铭牌、报警画面和故障区域照片',
    '记录服务动作、配件更换和后续建议',
    '提交服务报告给客户确认',
  ],
};

function mergeTicketSummary(detail, ticket) {
  return {
    ...detail,
    ...(ticket.status !== undefined ? { status: ticket.status } : {}),
    ...(ticket.engineer_id !== undefined ? { engineer_id: ticket.engineer_id } : {}),
    ...(ticket.engineer_name !== undefined ? { engineer_name: ticket.engineer_name } : {}),
    ...(ticket.conflict_status !== undefined ? { conflict_status: ticket.conflict_status } : {}),
    ...(ticket.conflict_reason !== undefined ? { conflict_reason: ticket.conflict_reason } : {}),
  };
}
function mergeFetchedDetail(detail, ticket) {
  const merged = mergeTicketSummary(detail, { ...ticket, status: undefined });
  return detail?.status === undefined && ticket.status !== undefined
    ? { ...merged, status: ticket.status }
    : merged;
}

export function EngineerWorkOrderDetail(props) {
  const {
    ticket, engineerId, isCn, isRegionalLead, team, selectedEngineer,
    assigningId, statusLabels, getNextAction, getMachineLine, formatDescription,
    onBack, onConfirmAssignment, onReturnAssignment, onAssignEngineer,
    onEngineerSelectionChange, onWorkOrderChanged,
  } = props;
  const [detail, setDetail] = useState(ticket);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const detailLoadedRef = useRef(false);
  const ticketSummaryRef = useRef(ticket);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const loadedDetail = await getWorkOrder(ticket.id);
      setDetail(mergeFetchedDetail(loadedDetail, ticketSummaryRef.current));
      detailLoadedRef.current = true;
    } catch (requestError) {
      setError(requestError.message || (isCn ? '工单详情加载失败' : 'Failed to load work-order details'));
    } finally {
      setLoading(false);
    }
  }, [isCn, ticket.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    const ticketSummary = {
      status: ticket.status,
      engineer_id: ticket.engineer_id,
      engineer_name: ticket.engineer_name,
      conflict_status: ticket.conflict_status,
      conflict_reason: ticket.conflict_reason,
    };
    ticketSummaryRef.current = ticketSummary;
    setDetail((current) => (detailLoadedRef.current ? mergeTicketSummary(current, ticketSummary) : current));
  }, [ticket.status, ticket.engineer_id, ticket.engineer_name, ticket.conflict_status, ticket.conflict_reason]);

  const copy = isCn ? {
    back: '返回工单', context: '当前任务上下文', preparation: '服务准备',
    checklist: '服务标准检查清单', tools: '工单处理工具', nextStep: '当前下一步',
    retry: '重试', loading: '工单详情加载中...', customerIssue: '客户问题',
    machine: '设备 / 服务类型', region: '客户 / 地区', risk: '安全 / 优先级',
    intake: '接单摘要', equipment: '客户设备档案', attachments: '附件',
    confirm: '确认派工', returning: '退回中', returnDispatch: '填写原因并退回',
    assign: '分配工程师', assigning: '派工中', selectEngineer: '选择团队工程师',
    support: '需要 Admin 协助？', loadFailed: '工单详情加载失败',
    conflictWarning: '冲突检查：', conflictFallback: '该工程师暂不能接收这个工单',
    scheduled: '到场 / 服务时间', schedulePending: '时间待安排',
    urgencyLabels: { normal: '常规', urgent: '优先处理', critical: '高风险' },
  } : {
    back: 'Back to Work Orders', context: 'Current Task Context', preparation: 'Job Preparation',
    checklist: 'Service Standard Checklist', tools: 'Work-Order Tools', nextStep: 'Current next step',
    retry: 'Retry', loading: 'Loading work-order details...', customerIssue: 'Customer issue',
    machine: 'Machine / Service Type', region: 'Customer / Region', risk: 'Safety / Priority',
    intake: 'Intake summary', equipment: 'Customer equipment record', attachments: 'Attachments',
    confirm: 'Confirm Assignment', returning: 'Returning', returnDispatch: 'Return with a reason',
    assign: 'Assign Engineer', assigning: 'Assigning', selectEngineer: 'Select team engineer',
    support: 'Need Admin support?', loadFailed: 'Failed to load work-order details',
    conflictWarning: 'Conflict check:', conflictFallback: 'This engineer cannot receive this work order',
    scheduled: 'Arrival / service time', schedulePending: 'Schedule pending',
    urgencyLabels: { normal: 'Standard', urgent: 'Priority', critical: 'High risk' },
  };
  const effectiveStatus = detail?.status ?? ticket.status;
  const scheduledTime = getEngineerScheduleLabel(detail || ticket, isCn ? 'zh-CN' : 'en-US');
  const conflictWarning = detail?.conflict_status === 'blocked'
    ? `${copy.conflictWarning} ${detail.conflict_reason || copy.conflictFallback}`
    : '';
  const aiSummary = useMemo(() => {
    const raw = detail?.ai_summary;
    const fallback = detail?.description || ticket.description || '-';
    if (!raw) return { text: fallback, tags: [], notes: '' };
    try {
      const summary = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        text: summary.summary || fallback,
        tags: [
          ...(Array.isArray(summary.required_specialties) ? summary.required_specialties : []),
          ...(Array.isArray(summary.suggested_skills) ? summary.suggested_skills : []),
        ].filter(Boolean),
        notes: summary.urgency_notes || '',
      };
    } catch {
      return { text: String(raw), tags: [], notes: '' };
    }
  }, [detail, ticket.description]);

  const header = (
    <header className="mb-4 flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]">
        <ArrowLeft size={16} />{copy.back}
      </button>
      <div className="sm:text-right">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Work Order Details</div>
        <div className="font-semibold">{getEngineerWorkOrderTitle(detail || ticket, isCn, isCn ? '服务任务' : 'Service task')}</div>
        <div className="text-xs text-[var(--color-text-muted)]">{detail?.order_no || ticket.order_no || ticket.id}</div>
        <div className="text-xs text-[var(--color-text-muted)]">{statusLabels[effectiveStatus] || effectiveStatus}</div>
      </div>
    </header>
  );

  if (loading) {
    return (
      <section>
        {header}
        <div className="rounded-xl border p-8 text-center text-sm text-[var(--color-text-muted)]">{copy.loading}</div>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        {header}
        <div className="rounded-xl border border-[var(--color-error)]/30 p-6 text-center">
          <p className="text-sm text-[var(--color-error)]">{error || copy.loadFailed}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={loadDetail} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm text-white">{copy.retry}</button>
            <button onClick={onBack} className="rounded-lg border px-3 py-2 text-sm">{copy.back}</button>
          </div>
        </div>
      </section>
    );
  }

  const sectionClass = 'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5';
  const actionPanel = (
    <>
      {!isRegionalLead && effectiveStatus === 'assigned' && (
        <div className="mt-4 grid gap-2">
          <button
            onClick={() => onConfirmAssignment(detail)}
            disabled={assigningId === `${detail.id}:accept`}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {copy.confirm}
          </button>
          <button
            onClick={() => onReturnAssignment(detail)}
            disabled={assigningId === `${detail.id}:reject`}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"
          >
            {assigningId === `${detail.id}:reject` ? copy.returning : copy.returnDispatch}
          </button>
        </div>
      )}
      {isRegionalLead && (
        <div className="mt-4 grid gap-2">
          <select
            value={selectedEngineer[detail.id] || detail.engineer_id || ''}
            onChange={(event) => onEngineerSelectionChange(detail.id, event.target.value)}
            className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm"
          >
            <option value="">{copy.selectEngineer}</option>
            {team.map((engineer) => (
              <option key={engineer.id} value={engineer.id}>
                {engineer.name}{engineer.service_region ? ` / ${engineer.service_region}` : ''}{engineer.status ? ` / ${engineer.status}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => onAssignEngineer(detail)}
            disabled={assigningId === detail.id}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {assigningId === detail.id ? copy.assigning : copy.assign}
          </button>
        </div>
      )}
    </>
  );

  return (
    <section>
      {header}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main className="space-y-4">
          <section className={sectionClass}>
            <div className="text-xs font-semibold text-[var(--color-primary)]">01 · {copy.context}</div>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">{copy.customerIssue}</div>
                <p className="mt-1">{formatDescription(detail?.description || ticket.description || '-')}</p>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">{copy.machine}</div>
                <p className="mt-1">{getMachineLine(detail)}</p>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">{copy.region}</div>
                <p className="mt-1">{detail?.customer_name || '-'} / {detail?.customer_region || '-'}</p>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">{copy.risk}</div>
                <p className="mt-1">{copy.urgencyLabels[detail?.urgency || 'normal'] || copy.urgencyLabels.normal}</p>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">{copy.scheduled}</div>
                <p className="mt-1">{scheduledTime || copy.schedulePending}</p>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="text-xs font-semibold text-[var(--color-primary)]">02 · {copy.preparation}</div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--color-surface-elevated)] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">{copy.intake}</div>
                <p className="mt-1">{formatDescription(aiSummary.text)}</p>
                {aiSummary.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {aiSummary.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs text-[var(--color-primary)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {aiSummary.notes && (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">{formatDescription(aiSummary.notes)}</p>
                )}
              </div>
              <div className="rounded-xl bg-[var(--color-surface-elevated)] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">{copy.equipment}</div>
                <p className="mt-1">{getMachineLine(detail)}</p>
              </div>
              <div className="rounded-xl bg-[var(--color-surface-elevated)] p-3 sm:col-span-2">
                <div className="text-xs text-[var(--color-text-muted)]">{copy.attachments}</div>
                <p className="mt-1">{detail?.attachments?.length || 0}</p>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)]">
              <ShieldCheck size={16} />03 · {copy.checklist}
            </div>
            <ol className="mt-4 space-y-3">
              {CHECKLIST[isCn ? 'cn' : 'en'].map((item, index) => (
                <li key={item} className="flex gap-3 text-sm text-[var(--color-text-secondary)]">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className={sectionClass}>
            <h2 className="mb-4 font-semibold">{copy.tools}</h2>
            <WorkOrderDetailContent
              workOrder={detail}
              userType="engineer"
              userId={engineerId}
              showInfoTab={false}
              initialTab="messages"
              onConfirmed={() => { loadDetail(); onWorkOrderChanged(); }}
              onRateSuccess={() => { loadDetail(); onWorkOrderChanged(); }}
            />
          </section>
        </main>

        <aside className="self-start rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:sticky lg:top-4">
          <div className="text-xs text-[var(--color-text-muted)]">{copy.nextStep}</div>
          <p className="mt-1 text-sm font-semibold">{getNextAction(detail)}</p>
          {conflictWarning && <div className="mt-4 rounded-lg border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-800">{conflictWarning}</div>}
          {actionPanel}
          <div className="mt-4 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">
            {copy.support} <a className="font-medium text-[var(--color-primary)]" href="mailto:support@sagemro.com">support@sagemro.com</a>
          </div>
        </aside>
      </div>
    </section>
  );
}
