import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWorkOrder } from '../../services/api';
import { WorkOrderDetailContent } from '../WorkOrder/WorkOrderDetailModal';
import { getEngineerScheduleLabel, getEngineerWorkOrderTitle } from './engineerWorkOrderDisplay';
import { getLocalizedCustomerContent } from './engineerWorkOrderContent';

const CHECKLIST = {
  en: [
    'Confirm the customer issue, machine model, site contact, and service window.',
    'Review the intake summary and flag safety risks.',
    'Check tools, spare parts, consumables, and protective equipment.',
    'Record nameplate, alarm screen, and fault-area evidence on site.',
    'Document service actions, parts replacement, and follow-up recommendations.',
    'Submit the service report for customer confirmation.',
  ],
  cn: [
    '确认客户问题、设备型号、现场联系人和服务时间。',
    '查看接单摘要，并标记安全风险。',
    '检查备件、工具、耗材和防护用品。',
    '现场记录铭牌、报警画面和故障区域资料。',
    '记录服务动作、配件更换和后续建议。',
    '提交服务报告给客户确认。',
  ],
};

const COPY = {
  en: {
    back: 'Back to work orders', kicker: 'Work order', loading: 'Loading work-order details...',
    failed: 'Failed to load work-order details', retry: 'Retry', nextStep: 'Current next step',
    customer: 'Customer', region: 'Region', engineer: 'Executing engineer', schedule: 'Service window',
    schedulePending: 'Schedule pending', unassigned: 'Unassigned', support: 'Admin support',
    tabs: { overview: 'Overview', messages: 'Messages', quote: 'Quote', material: 'Material request', field: 'Field service', report: 'Service report' },
    context: 'Current Task Context', preparation: 'Job Preparation', checklist: 'Service Standard Checklist',
    machine: 'Machine / service type', priority: 'Priority', intake: 'Intake summary', attachments: 'Attachments',
    original: 'View customer original', hideOriginal: 'Hide customer original',
    noTranslation: 'Customer original', confirm: 'Confirm Assignment', returnDispatch: 'Return with a reason',
    assign: 'Assign / Reassign', assigning: 'Assigning', selectEngineer: 'Select team engineer',
    managementQuote: 'Quote progress', noQuote: 'No quote has been submitted yet.',
    quoteStatus: 'Quote status', quoteTotal: 'Quoted total', quoteDetails: 'Quote details',
    payments: 'Payments & receipts', fieldRestricted: 'Field-service evidence remains private to the executing engineer and Admin.',
    unavailable: 'Unavailable for this work-order stage.',
    statusNames: { available: 'Available', paused: 'Paused', offline: 'Offline' },
  },
  cn: {
    back: '返回工单', kicker: '服务工单', loading: '正在加载工单详情...',
    failed: '工单详情加载失败', retry: '重试', nextStep: '当前下一步',
    customer: '客户', region: '地区', engineer: '执行工程师', schedule: '服务时间',
    schedulePending: '时间待安排', unassigned: '待分配', support: 'Admin 支持',
    tabs: { overview: '概览', messages: '消息', quote: '报价', material: '物料申请', field: '现场服务', report: '服务报告' },
    context: '当前任务上下文', preparation: '服务准备', checklist: '服务标准检查清单',
    machine: '设备 / 服务类型', priority: '优先级', intake: '接单摘要', attachments: '附件',
    original: '查看客户原文', hideOriginal: '收起客户原文', noTranslation: '客户原文',
    confirm: '确认派工', returnDispatch: '填写原因并退回', assign: '分配 / 重新分配', assigning: '派工中',
    selectEngineer: '选择团队工程师', managementQuote: '报价进度', noQuote: '当前还没有已提交报价。',
    quoteStatus: '报价状态', quoteTotal: '报价总额', quoteDetails: '报价详情',
    payments: '付款与到账', fieldRestricted: '现场作业证据仅对执行工程师和 Admin 开放。',
    unavailable: '当前工单阶段暂不可使用此功能。',
    statusNames: { available: '可接单', paused: '暂停接单', offline: '离线' },
  },
};

function CustomerContent({ record, isCn }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const copy = isCn ? COPY.cn : COPY.en;
  const content = getLocalizedCustomerContent(record, isCn ? 'cn' : 'en');
  return (
    <div>
      {content.primaryLabel && <div className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">{content.primaryLabel}</div>}
      {content.primaryText && <p className="whitespace-pre-wrap text-sm leading-6 text-[#394455]">{content.primaryText}</p>}
      {content.originalText && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowOriginal((value) => !value)} className="text-xs font-bold text-blue-700">{showOriginal ? copy.hideOriginal : copy.original}</button>
          {showOriginal && <div className="mt-2 rounded-lg bg-[#f7f8fa] p-3"><div className="mb-1 text-xs font-bold text-[#697386]">{content.originalLabel || copy.noTranslation}</div><p className="whitespace-pre-wrap text-sm text-[#394455]">{content.originalText}</p></div>}
        </div>
      )}
      {!content.primaryText && !content.originalText && <span className="text-sm text-[#929baa]">—</span>}
    </div>
  );
}

export function EngineerWorkOrderDetail({
  workOrderId, engineerId, isCn, isRegionalLead, team, selectedEngineer, assigningId,
  statusLabels, getNextAction, getMachineLine, formatDescription, onBack, onConfirmAssignment,
  onReturnAssignment, onAssignEngineer, onEngineerSelectionChange, onWorkOrderChanged,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [commercialView, setCommercialView] = useState('pricing');
  const [actionRefresh, setActionRefresh] = useState(0);
  const [checkedChecklistItems, setCheckedChecklistItems] = useState(() => new Set());

  const loadDetail = useCallback(async () => {
    setLoading(true); setError('');
    try { setDetail(await getWorkOrder(workOrderId)); }
    catch (requestError) { setError(requestError.message || copy.failed); }
    finally { setLoading(false); }
  }, [copy.failed, workOrderId]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const aiSummary = useMemo(() => {
    const fallback = detail?.description || '';
    if (!detail?.ai_summary) return { summary: fallback, tags: [], notes: '' };
    try {
      const summary = typeof detail.ai_summary === 'string' ? JSON.parse(detail.ai_summary) : detail.ai_summary;
      return {
        summary: summary.summary || fallback,
        tags: [...(summary.required_specialties || []), ...(summary.suggested_skills || [])].filter(Boolean),
        notes: summary.urgency_notes || '',
      };
    } catch { return { summary: String(detail.ai_summary), tags: [], notes: '' }; }
  }, [detail]);

  if (loading) return <div className="rounded-2xl border border-[#e5e8ed] bg-white p-10 text-center text-sm text-[#697386]">{copy.loading}</div>;
  if (error || !detail) return (
    <div className="rounded-2xl border border-red-200 bg-white p-8 text-center"><p className="text-sm text-red-600">{error || copy.failed}</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={loadDetail} className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white">{copy.retry}</button><button type="button" onClick={onBack} className="rounded-lg border px-4 py-2 text-sm">{copy.back}</button></div></div>
  );

  const isExecutingEngineer = String(detail.engineer_id || '') === String(engineerId || '');
  const isCurrentTeamWork = detail.ownership_relation === 'current_team_member' || detail.ownership_relation === 'regional_queue';
  const canReassignTeamWork = isRegionalLead && isCurrentTeamWork && ['pending', 'pending_dispatch', 'assigned'].includes(detail.status);
  const scheduledTime = getEngineerScheduleLabel(detail, isCn ? 'zh-CN' : 'en-US') || copy.schedulePending;
  const tabs = Object.entries(copy.tabs);
  const tabMap = { messages: 'messages', quote: 'pricing', material: 'materialRequisition', field: 'fieldWork', report: 'repairRecord' };
  const refreshAfter = async (action) => {
    const changed = await action(detail);
    if (changed) { await loadDetail(); setActionRefresh((value) => value + 1); }
  };
  const actionPanel = isExecutingEngineer && detail.status === 'assigned' ? (
    <div className="mt-4 grid gap-2 border-t border-white/15 pt-4"><button type="button" onClick={() => refreshAfter(onConfirmAssignment)} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white">{copy.confirm}</button><button type="button" onClick={() => refreshAfter(onReturnAssignment)} className="rounded-lg border border-white/25 px-3 py-2 text-xs font-bold text-white">{copy.returnDispatch}</button></div>
  ) : canReassignTeamWork ? (
    <div className="mt-4 border-t border-white/15 pt-4">
      <label className="mb-2 block text-xs font-bold text-slate-300">{copy.engineer}</label>
      <select value={selectedEngineer[detail.id] || detail.engineer_id || ''} onChange={(event) => onEngineerSelectionChange(detail.id, event.target.value)} className="w-full rounded-lg border-0 bg-white px-3 py-2 text-xs text-[#18202b]">
        <option value="">{copy.selectEngineer}</option>
        {team.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name}{engineer.status ? ` · ${copy.statusNames[engineer.status] || engineer.status}` : ''}</option>)}
      </select>
      <button type="button" onClick={() => refreshAfter(onAssignEngineer)} disabled={assigningId === detail.id} className="mt-2 w-full rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{assigningId === detail.id ? copy.assigning : copy.assign}</button>
    </div>
  ) : null;

  const tabAvailable = {
    messages: true,
    quote: Boolean(detail.pricing) || ['assigned', 'in_progress', 'pricing', 'pending_payment', 'payment_review', 'in_service'].includes(detail.status),
    material: isExecutingEngineer || Number(detail.material_requisition_count || 0) > 0,
    field: detail.service_mode === 'onsite' || Boolean(detail.field_days?.length),
    report: ['in_service', 'pricing', 'resolved', 'pending_review', 'completed'].includes(detail.status) || Boolean(detail.repair_record),
  };
  const toggleChecklistItem = (index) => {
    setCheckedChecklistItems((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600"><ArrowLeft size={16} />{copy.back}</button>
      <section className="grid gap-5 rounded-2xl border border-[#e5e8ed] bg-white p-5 shadow-[0_14px_36px_rgba(24,32,43,.07)] lg:grid-cols-[minmax(0,1.7fr)_minmax(270px,.7fr)]">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-[.12em] text-orange-600">{copy.kicker} · {detail.order_no || detail.id}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">{getEngineerWorkOrderTitle(detail, isCn, isCn ? '服务任务' : 'Service task')}</h1><span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: `var(--status-${detail.status}-bg)`, color: `var(--status-${detail.status}-text)` }}><span className="size-1.5 rounded-full" style={{ backgroundColor: `var(--status-${detail.status})` }} />{statusLabels[detail.status] || detail.status}</span></div>
          <div className="mt-5 grid grid-cols-2 border-t border-[#e5e8ed] sm:grid-cols-4">
            {[[copy.customer, detail.customer_name || '—'], [copy.region, detail.customer_region || '—'], [copy.engineer, detail.engineer_name || copy.unassigned], [copy.schedule, scheduledTime]].map(([label, value]) => <div key={label} className="pr-3 pt-4"><span className="block text-xs font-extrabold uppercase tracking-wide text-[#929baa]">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>)}
          </div>
        </div>
        <aside className="rounded-xl bg-[#18202b] p-4 text-white"><span className="text-xs font-bold uppercase tracking-wider text-slate-300">{copy.nextStep}</span><strong className="mt-2 block text-sm leading-6">{getNextAction(detail)}</strong>{actionPanel}</aside>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main className="min-w-0 overflow-hidden rounded-2xl border border-[#e5e8ed] bg-white">
          <nav role="tablist" className="flex overflow-x-auto border-b border-[#e5e8ed] bg-[#fbfcfd] px-3">
            {tabs.map(([key, label]) => <button id={`engineer-tab-${key}`} aria-controls={`engineer-panel-${key}`} key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)} className={`h-12 shrink-0 border-b-2 px-3 text-[13px] font-bold ${activeTab === key ? 'border-orange-500 text-orange-600' : 'border-transparent text-[#697386]'}`}>{label}</button>)}
          </nav>
          <div id={`engineer-panel-${activeTab}`} role="tabpanel" aria-labelledby={`engineer-tab-${activeTab}`} className="p-4 sm:p-5">
            {activeTab === 'overview' ? (
              <div className="grid gap-3 md:grid-cols-[1.15fr_.85fr]">
                <section className="rounded-xl border border-[#e5e8ed] p-4"><div className="text-xs font-extrabold uppercase tracking-wide text-orange-600">{copy.context}</div><h2 className="mt-2 text-sm font-semibold">{copy.machine}</h2><p className="mt-2 text-sm text-[#394455]">{getMachineLine(detail)}</p><div className="mt-4"><CustomerContent record={{ description: formatDescription(detail.description), description_en: detail.description_en, description_zh: detail.description_zh }} isCn={isCn} /></div></section>
                <section className="rounded-xl border border-[#e5e8ed] p-4"><div className="text-xs font-extrabold uppercase tracking-wide text-orange-600">{copy.preparation}</div><h2 className="mt-2 text-sm font-semibold">{copy.intake}</h2><CustomerContent record={{ description: formatDescription(aiSummary.summary), description_en: detail.ai_summary_en }} isCn={isCn} />{aiSummary.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{aiSummary.tags.map((tag) => <span key={tag} className="rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">{tag}</span>)}</div>}{aiSummary.notes && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{formatDescription(aiSummary.notes)}</p>}<p className="mt-3 text-xs text-[#697386]">{copy.attachments}: {detail.attachments?.length || 0}</p></section>
                <section className="rounded-xl border border-[#e5e8ed] p-4 md:col-span-2"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-orange-600"><ShieldCheck size={15} />{copy.checklist}</div><ol className="mt-3 grid gap-2 sm:grid-cols-2">{CHECKLIST[isCn ? 'cn' : 'en'].map((item, index) => <li key={item}><label className="flex cursor-pointer gap-2 rounded-lg bg-[#f7f8fa] p-3 text-sm leading-6 text-[#697386]"><input type="checkbox" checked={checkedChecklistItems.has(index)} onChange={() => toggleChecklistItem(index)} className="mt-1 size-4 shrink-0 accent-orange-500" /><span className={checkedChecklistItems.has(index) ? 'text-[#929baa] line-through' : ''}>{item}</span></label></li>)}</ol></section>
              </div>
            ) : activeTab === 'quote' && !isExecutingEngineer ? (
              <section className="rounded-xl border border-[#e5e8ed] p-5"><h2 className="font-semibold">{copy.managementQuote}</h2>{detail.pricing ? <dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-[#697386]">{copy.quoteStatus}</dt><dd className="mt-1 font-semibold">{detail.pricing.status || '—'}</dd></div><div><dt className="text-xs text-[#697386]">{copy.quoteTotal}</dt><dd className="mt-1 font-semibold">{detail.pricing.currency || ''} {detail.pricing.total_amount ?? detail.pricing.subtotal ?? '—'}</dd></div></dl> : <p className="mt-3 text-sm text-[#697386]">{copy.noQuote}</p>}</section>
            ) : activeTab === 'field' && !isExecutingEngineer ? (
              <div className="rounded-xl border border-[#e5e8ed] p-6 text-sm text-[#697386]">{copy.fieldRestricted}</div>
            ) : !tabAvailable[activeTab] ? (
              <div className="rounded-xl border border-[#e5e8ed] p-6 text-sm text-[#697386]">{copy.unavailable}</div>
            ) : (
              <>
                {activeTab === 'quote' && isExecutingEngineer && (
                  <div className="mb-4 inline-flex gap-1 rounded-lg border border-[#e5e8ed] bg-[#f7f8fa] p-1">
                    {[
                      ['pricing', copy.quoteDetails],
                      ['collection', copy.payments],
                    ].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setCommercialView(value)} aria-pressed={commercialView === value} className={`rounded-md px-3 py-2 whitespace-nowrap text-xs font-bold ${commercialView === value ? 'bg-[#18202b] text-white' : 'text-[#697386]'}`}>{label}</button>
                    ))}
                  </div>
                )}
                <WorkOrderDetailContent key={`${detail.id}:${actionRefresh}`} workOrder={detail} userType="engineer" userId={engineerId} controlledTab={activeTab === 'quote' ? commercialView : tabMap[activeTab]} showInfoTab={false} showTabNavigation={false} managementReadOnly={!isExecutingEngineer} isActive onConfirmed={() => { loadDetail(); onWorkOrderChanged?.(); }} onRateSuccess={() => { loadDetail(); onWorkOrderChanged?.(); }} />
              </>
            )}
          </div>
        </main>
        <aside className="space-y-3 self-start lg:sticky lg:top-4"><section className="rounded-xl border border-[#e5e8ed] bg-white p-4"><h2 className="text-sm font-semibold">{copy.support}</h2><a href="mailto:support@sagemro.com" className="mt-2 block text-sm font-bold text-orange-600">support@sagemro.com</a></section></aside>
      </div>
    </section>
  );
}
