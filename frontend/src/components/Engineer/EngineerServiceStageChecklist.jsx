import { useEffect, useState } from 'react';

const ITEM_COPY = {
  'task.device_identity': { en: 'Confirm machine identity and configuration', cn: '确认设备身份与配置' },
  'task.problem_and_goal': { en: 'Align on the problem and service goal', cn: '对齐问题与服务目标' },
  'task.contact_and_window': { en: 'Confirm site contact and service window', cn: '确认现场联系人与服务时间' },
  'risk.hazards_reviewed': { en: 'Review site and machine hazards', cn: '核查现场与设备风险' },
  'risk.isolation_permission': { en: 'Confirm isolation and work permission', cn: '确认隔离条件与作业许可' },
  'risk.ppe_and_access': { en: 'Confirm PPE and safe access', cn: '确认防护用品与安全通行' },
  'ready.tools_and_documents': { en: 'Prepare tools and technical documents', cn: '准备工具与技术资料' },
  'ready.parts_and_consumables': { en: 'Prepare parts and consumables', cn: '准备备件与耗材' },
  'ready.start_conditions': { en: 'Admin confirms start conditions', cn: 'Admin 确认开始条件' },
  'execute.baseline_evidence': { en: 'Record baseline evidence', cn: '记录作业前基线证据' },
  'execute.actions_recorded': { en: 'Record service actions as work proceeds', cn: '随作业记录服务动作' },
  'execute.scope_authorized': { en: 'Keep work within the authorized scope', cn: '确保作业处于授权范围内' },
  'verify.functional_test': { en: 'Complete the functional test', cn: '完成设备功能测试' },
  'verify.safety_restored': { en: 'Verify safety protections are restored', cn: '确认安全防护已恢复' },
  'verify.residual_risk': { en: 'Record residual risks and next steps', cn: '记录剩余风险与后续措施' },
  'handover.service_report': { en: 'Service report is submitted', cn: '服务报告已提交' },
  'handover.customer_confirmation': { en: 'Customer confirms the service outcome', cn: '客户确认服务结果' },
  'handover.follow_up': { en: 'Record follow-up recommendations', cn: '记录后续服务建议' },
};

const STEP_COPY = {
  task_alignment: { en: 'Task alignment', cn: '任务对齐' },
  risk_control: { en: 'Risk control', cn: '风险控制' },
  one_visit_readiness: { en: 'One-visit readiness', cn: '一次到位准备' },
  evidence_execution: { en: 'Evidence-led work', cn: '留证执行' },
  recovery_verification: { en: 'Recovery check', cn: '恢复验证' },
  transparent_handover: { en: 'Clear handover', cn: '透明交付' },
};

const STATE_STYLES = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  not_applicable: 'bg-slate-100 text-slate-600',
  legacy_not_recorded: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-50 text-amber-800',
};

export function EngineerServiceStageChecklist({
  isCn,
  step,
  savingItemKey,
  onConfirm,
  onMarkNotApplicable,
}) {
  const [reasonItemKey, setReasonItemKey] = useState(null);
  const [reason, setReason] = useState('');
  const locale = isCn ? 'cn' : 'en';
  const copy = isCn
    ? {
      eyebrow: '当前阶段',
      titleFallback: '服务标准项',
      required: '必需',
      optional: '可选',
      confirm: '确认完成',
      notApplicable: '标记不适用',
      reasonLabel: '不适用原因',
      reasonPlaceholder: '简要说明此项为何不适用于当前工单',
      submitReason: '提交不适用',
      cancel: '取消',
      saving: '保存中…',
      empty: '当前阶段没有需要人工处理的标准项。',
      ownerAdmin: '等待 Admin',
      ownerCustomer: '等待客户',
      ownerSystem: '由系统记录',
      states: {
        confirmed: '已确认',
        not_applicable: '不适用',
        legacy_not_recorded: '历史工单',
        pending: '待确认',
      },
    }
    : {
      eyebrow: 'Current stage',
      titleFallback: 'Service-standard items',
      required: 'Required',
      optional: 'Optional',
      confirm: 'Confirm complete',
      notApplicable: 'Mark not applicable',
      reasonLabel: 'Reason not applicable',
      reasonPlaceholder: 'Briefly explain why this item does not apply to this work order',
      submitReason: 'Submit as not applicable',
      cancel: 'Cancel',
      saving: 'Saving…',
      empty: 'There are no standard items requiring manual action at this stage.',
      ownerAdmin: 'Waiting for Admin',
      ownerCustomer: 'Waiting for customer',
      ownerSystem: 'Recorded by system',
      states: {
        confirmed: 'Confirmed',
        not_applicable: 'Not applicable',
        legacy_not_recorded: 'Legacy work order',
        pending: 'Pending',
      },
    };
  const items = step?.items || [];

  useEffect(() => {
    setReasonItemKey(null);
    setReason('');
  }, [step?.key]);

  const ownerLabel = (owner) => ({
    admin: copy.ownerAdmin,
    customer: copy.ownerCustomer,
    system: copy.ownerSystem,
  })[owner] || '';

  return (
    <section className="rounded-2xl border border-[#e5e8ed] bg-white p-4 sm:p-6" aria-labelledby="service-stage-checklist-title">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-600">{copy.eyebrow}</p>
      <h2 id="service-stage-checklist-title" className="mt-1 text-lg font-bold text-[#18202b]">
        {STEP_COPY[step?.key]?.[locale] || copy.titleFallback}
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm text-[#697386]">{copy.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-[#eef1f5] border-y border-[#eef1f5]">
          {items.map((item) => {
            const state = item.state || 'pending';
            const isSaving = savingItemKey === item.key;
            const isEngineerPending = state === 'pending' && item.owner === 'engineer';
            const isReasonOpen = reasonItemKey === item.key;
            return (
              <li key={item.key} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold leading-6 text-[#263140]">
                        {ITEM_COPY[item.key]?.[locale] || item.key}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_STYLES[state] || STATE_STYLES.pending}`}>
                        {copy.states[state] || copy.states.pending}
                      </span>
                      <span className="text-[11px] font-semibold text-[#7c8798]">
                        {item.required ? copy.required : copy.optional}
                      </span>
                    </div>
                    {state === 'not_applicable' && item.notApplicableReason && (
                      <p className="mt-1 text-xs leading-5 text-[#697386]">{item.notApplicableReason}</p>
                    )}
                    {state === 'pending' && item.owner !== 'engineer' && (
                      <p className="mt-1 text-xs font-medium text-[#697386]">{ownerLabel(item.owner)}</p>
                    )}
                  </div>

                  {isEngineerPending && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => onConfirm(item)}
                        className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSaving ? copy.saving : copy.confirm}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          setReasonItemKey(item.key);
                          setReason('');
                        }}
                        className="rounded-lg border border-[#d9dde4] px-3 py-2 text-xs font-bold text-[#394455] hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-60"
                      >
                        {copy.notApplicable}
                      </button>
                    </div>
                  )}
                </div>

                {isReasonOpen && isEngineerPending && (
                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                    <label htmlFor={`not-applicable-${item.key}`} className="text-xs font-bold text-[#394455]">
                      {copy.reasonLabel}
                    </label>
                    <textarea
                      id={`not-applicable-${item.key}`}
                      value={reason}
                      maxLength={500}
                      rows={2}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={copy.reasonPlaceholder}
                      className="mt-2 w-full resize-y rounded-lg border border-[#cfd5de] bg-white px-3 py-2 text-sm text-[#263140] outline-none placeholder:text-[#929baa] focus:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSaving || reason.trim().length === 0}
                        onClick={() => onMarkNotApplicable(item, reason.trim())}
                        className="rounded-lg bg-[#18202b] px-3 py-2 text-xs font-bold text-white hover:bg-[#263140] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isSaving ? copy.saving : copy.submitReason}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          setReasonItemKey(null);
                          setReason('');
                        }}
                        className="rounded-lg px-3 py-2 text-xs font-bold text-[#697386] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                      >
                        {copy.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
