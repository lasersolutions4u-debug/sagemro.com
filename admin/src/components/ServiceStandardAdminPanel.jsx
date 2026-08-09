import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, LockKeyhole, RefreshCw } from 'lucide-react';
import { runtimeConfig } from '../config/runtime';
import {
  currentServiceGateForStatus,
  serviceStandardItemTone,
  serviceStandardStageTone,
} from '../pages/workOrderDetailView';
import {
  getAdminWorkOrderServiceStandard,
  overrideAdminWorkOrderServiceStandardGate,
} from '../services/api';

const TEXT = {
  en: {
    title: 'Service-standard progress',
    subtitle: 'Review required service controls before advancing the work order lifecycle.',
    readOnly: 'Read-only',
    loading: 'Loading service-standard progress...',
    loadFailed: 'Failed to load service-standard progress.',
    actionFailed: 'Action failed',
    savedRefreshFailed: 'Override saved, but refresh failed. Reopen the service order to view the latest controls.',
    noItems: 'No service-standard items are available.',
    progressSummary: (recorded, total) => `${recorded}/${total} controls recorded`,
    noCurrentGate: 'No service gate is active at this stage.',
    historicalHint: 'Historical record — not required by the current gate.',
    showAudit: 'Review controls',
    stages: ['Task alignment', 'Risk control', 'One-visit readiness', 'Evidence & execution', 'Recovery verification', 'Transparent handover'],
    itemLabels: {
      'task.device_identity': 'Device identity',
      'task.problem_and_goal': 'Problem and service goal',
      'task.contact_and_window': 'Contact and service window',
      'risk.hazards_reviewed': 'Hazards reviewed',
      'risk.isolation_permission': 'Isolation permission',
      'risk.ppe_and_access': 'PPE and site access',
      'ready.tools_and_documents': 'Tools and documents',
      'ready.parts_and_consumables': 'Parts and consumables',
      'ready.start_conditions': 'Service start conditions',
      'execute.baseline_evidence': 'Baseline evidence',
      'execute.actions_recorded': 'Service actions recorded',
      'execute.scope_authorized': 'Work scope authorized',
      'verify.functional_test': 'Functional test',
      'verify.safety_restored': 'Safety restored',
      'verify.residual_risk': 'Residual risk',
      'handover.service_report': 'Service report',
      'handover.customer_confirmation': 'Customer confirmation',
      'handover.follow_up': 'Follow-up plan',
    },
    state: 'State',
    owner: 'Owner',
    required: 'Required',
    optional: 'Optional',
    blocking: 'Active lifecycle blockers',
    noBlockers: 'No active blockers.',
    gate: 'Gate',
    override: 'Override a gate',
    overrideHint: 'Use only for an approved exception; the reason is retained in the audit trail.',
    reason: 'Override reason',
    reasonHint: '1–500 characters',
    submitOverride: 'Record gate override',
    saving: 'Saving...',
    overrides: 'Active overrides',
    noOverrides: 'No active gate overrides.',
    reasonRequired: 'Enter an override reason of 1–500 characters.',
    owners: { admin: 'Admin', engineer: 'Engineer', customer: 'Customer', system: 'System' },
    states: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      not_applicable: 'Not applicable',
      legacy_not_recorded: 'Legacy — not recorded',
    },
    gates: { start: 'Start service', resolve: 'Resolve service', handover: 'Customer handover' },
  },
  'zh-CN': {
    title: '服务标准进度',
    subtitle: '在推进工单生命周期前，先查看必需的服务控制项。',
    readOnly: '只读',
    loading: '正在加载服务标准进度...',
    loadFailed: '加载服务标准进度失败。',
    actionFailed: '操作失败',
    savedRefreshFailed: '放行已保存，但刷新失败。请重新打开工单查看最新控制项。',
    noItems: '暂无服务标准项目。',
    progressSummary: (recorded, total) => `已记录 ${recorded}/${total} 项控制`,
    noCurrentGate: '当前阶段没有生效中的服务关卡。',
    historicalHint: '历史记录——不属于当前关卡要求。',
    showAudit: '查看控制项',
    stages: ['任务对齐', '风险控制', '一次到位准备', '证据与执行', '恢复验证', '透明交接'],
    itemLabels: {
      'task.device_identity': '设备身份信息',
      'task.problem_and_goal': '问题与服务目标',
      'task.contact_and_window': '联系人与服务时间',
      'risk.hazards_reviewed': '已核对危险因素',
      'risk.isolation_permission': '隔离许可',
      'risk.ppe_and_access': '个人防护与现场准入',
      'ready.tools_and_documents': '工具与资料',
      'ready.parts_and_consumables': '配件与耗材',
      'ready.start_conditions': '开工条件',
      'execute.baseline_evidence': '基准证据',
      'execute.actions_recorded': '服务操作记录',
      'execute.scope_authorized': '工作范围授权',
      'verify.functional_test': '功能测试',
      'verify.safety_restored': '安全状态恢复',
      'verify.residual_risk': '剩余风险',
      'handover.service_report': '服务报告',
      'handover.customer_confirmation': '客户确认',
      'handover.follow_up': '后续跟进计划',
    },
    state: '状态',
    owner: '责任方',
    required: '必做',
    optional: '可选',
    blocking: '当前生命周期阻塞项',
    noBlockers: '当前没有阻塞项。',
    gate: '关卡',
    override: '人工放行关卡',
    overrideHint: '仅用于已获批准的例外情况；放行原因会保留在审计记录中。',
    reason: '放行原因',
    reasonHint: '1–500 个字符',
    submitOverride: '记录关卡放行',
    saving: '保存中...',
    overrides: '生效中的放行',
    noOverrides: '没有生效中的关卡放行。',
    reasonRequired: '请填写 1–500 个字符的放行原因。',
    owners: { admin: '管理员', engineer: '工程师', customer: '客户', system: '系统' },
    states: {
      pending: '待完成',
      confirmed: '已确认',
      not_applicable: '不适用',
      legacy_not_recorded: '历史工单 — 未记录',
    },
    gates: { start: '开始服务', resolve: '完成服务', handover: '客户交接' },
  },
};

function itemLabel(key) {
  return String(key || '').split('.').map((part) => part.replace(/_/g, ' ')).join(' · ');
}

function toneClasses(tone) {
  if (tone === 'complete') return 'border-green-500/30 bg-green-500/10 text-green-700';
  if (tone === 'current') return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
  return 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]';
}

export function ServiceStandardAdminPanel({
  workOrderId,
  workOrderStatus,
  readOnly = false,
  onRefresh,
  onBlockerStateChange,
}) {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const currentGate = currentServiceGateForStatus(workOrderStatus);
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotWorkOrderId, setSnapshotWorkOrderId] = useState(workOrderId);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const operationEpoch = useRef(0);

  useLayoutEffect(() => {
    const epoch = ++operationEpoch.current;
    return () => {
      if (operationEpoch.current === epoch) operationEpoch.current += 1;
    };
  }, [workOrderId]);

  useEffect(() => {
    const epoch = operationEpoch.current;
    const isCurrent = () => operationEpoch.current === epoch;
    setSnapshot(null);
    setSnapshotWorkOrderId(workOrderId);
    setLoading(true);
    setMessage('');
    setReason('');
    setSaving(false);
    getAdminWorkOrderServiceStandard(workOrderId)
      .then((nextSnapshot) => {
        if (isCurrent()) setSnapshot(nextSnapshot);
      })
      .catch((error) => {
        if (isCurrent()) setMessage(error.message || t.loadFailed);
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
  }, [workOrderId, t.loadFailed]);

  const currentSnapshot = snapshotWorkOrderId === workOrderId ? snapshot : null;
  const blockers = useMemo(
    () => currentGate ? currentSnapshot?.gates?.[currentGate]?.blocking_items || [] : [],
    [currentGate, currentSnapshot],
  );
  const currentBlockingItemKeys = useMemo(() => new Set(blockers), [blockers]);
  const steps = Array.isArray(currentSnapshot?.steps) ? currentSnapshot.steps : [];
  const currentStepIndex = currentSnapshot?.current_step_index;
  const overrides = Array.isArray(currentSnapshot?.overrides) ? currentSnapshot.overrides : [];
  const totalControls = steps.reduce((total, step) => total + (step.items || []).length, 0);
  const recordedControls = steps.reduce(
    (total, step) => total + (step.items || []).filter((item) => item.state !== 'pending').length,
    0,
  );

  useEffect(() => {
    onBlockerStateChange?.({ gate: currentGate, count: blockers.length });
  }, [blockers.length, currentGate, onBlockerStateChange]);

  async function submitOverride(event) {
    event.preventDefault();
    if (readOnly || saving || !currentGate) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length > 500) {
      setMessage(t.reasonRequired);
      return;
    }
    const operationEpochAtStart = operationEpoch.current;
    const isCurrent = () => operationEpoch.current === operationEpochAtStart;
    setSaving(true);
    setMessage('');
    try {
      await overrideAdminWorkOrderServiceStandardGate(workOrderId, currentGate, trimmedReason);
    } catch (error) {
      if (!isCurrent()) return;
      setMessage(error.message || t.actionFailed);
      setSaving(false);
      return;
    }
    if (!isCurrent()) return;

    const [snapshotResult, detailResult] = await Promise.allSettled([
      getAdminWorkOrderServiceStandard(workOrderId),
      Promise.resolve().then(() => isCurrent() && onRefresh?.(workOrderId, isCurrent)),
    ]);
    if (!isCurrent()) return;
    if (snapshotResult.status === 'fulfilled') setSnapshot(snapshotResult.value);
    if (snapshotResult.status === 'rejected' || detailResult.status === 'rejected') setMessage(t.savedRefreshFailed);
    else setReason('');
    setSaving(false);
  }

  return (
    <section className="break-words rounded-lg border border-[var(--color-border)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-primary)]" />
            <h4 className="font-medium text-[var(--color-text)]">{t.title}</h4>
            {readOnly && <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)]"><LockKeyhole className="h-3.5 w-3.5" />{t.readOnly}</span>}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.subtitle}</p>
        </div>
      </div>

      {message && <p role="alert" className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700">{message}</p>}
      {loading ? <p className="p-4 text-sm text-[var(--color-text-muted)]">{t.loading}</p> : (
        <>
          <div className="border-b border-[var(--color-border)] p-4">
            <h5 className="text-sm font-medium text-[var(--color-text)]">{t.blocking}</h5>
            {!currentGate ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t.noCurrentGate}</p> : blockers.length === 0 ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t.noBlockers}</p> : (
              <ul className="mt-3 space-y-2">
                {blockers.map((item) => <li key={item} className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><span className="font-medium">{t.gates[currentGate]}:</span> {t.itemLabels[item] || itemLabel(item)}</span></li>)}
              </ul>
            )}
          </div>

          <div className="border-b border-[var(--color-border)] p-4">
            <div className="grid grid-cols-6 gap-1" aria-label={t.progressSummary(recordedControls, totalControls)}>
              {steps.map((step) => {
                const items = step.items || [];
                const recordedCount = items.filter((item) => item.state !== 'pending').length;
                const stageTone = serviceStandardStageTone(items, currentBlockingItemKeys);
                return <div key={step.key} className={`h-2 rounded-full border ${toneClasses(stageTone)}`} title={`${t.stages[step.index] || itemLabel(step.key)}: ${recordedCount}/${items.length}`} />;
              })}
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t.progressSummary(recordedControls, totalControls)}</p>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {steps.length === 0 ? <p className="p-4 text-sm text-[var(--color-text-muted)]">{t.noItems}</p> : steps.map((step, index) => {
              const items = step.items || [];
              const recordedCount = items.filter((item) => item.state !== 'pending').length;
              const isHistoricalStep = step.index < currentStepIndex;
              return (
                <details key={step.key} open={step.index === currentStepIndex}>
                  <summary aria-label={`${t.showAudit}: ${t.stages[index] || itemLabel(step.key)}`} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3">
                    <span>{index + 1}. {t.stages[index] || itemLabel(step.key)}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{recordedCount}/{step.items.length}</span>
                  </summary>
                  <div className="space-y-2 border-t border-[var(--color-border)] p-4">
                    {isHistoricalStep && <p className="text-xs text-[var(--color-text-muted)]">{t.historicalHint}</p>}
                    {items.map((item) => <div key={item.key} className="grid gap-2 rounded-lg border border-[var(--color-border)] p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                      <div className="min-w-0"><div className="font-medium text-[var(--color-text)]">{t.itemLabels[item.key] || itemLabel(item.key)}</div>{item.notApplicableReason && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.notApplicableReason}</p>}</div>
                      <span className="text-xs text-[var(--color-text-secondary)]">{t.owner}: {t.owners[item.owner] || item.owner}</span>
                      <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs ${toneClasses(serviceStandardItemTone(item, currentBlockingItemKeys))}`}>{t.states[item.state] || item.state} · {item.required ? t.required : t.optional}</span>
                    </div>)}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="border-t border-[var(--color-border)] p-4">
            <h5 className="text-sm font-medium text-[var(--color-text)]">{t.overrides}</h5>
            {overrides.length === 0 ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t.noOverrides}</p> : <ul className="mt-3 space-y-2">{overrides.map((override) => <li key={override.id || override.gate_key} className="rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"><span className="font-medium text-[var(--color-text)]">{t.gates[override.gate_key] || override.gate_key}</span>: {override.reason}</li>)}</ul>}
          </div>

          {!readOnly && currentGate && blockers.length > 0 && (
          <form onSubmit={submitOverride} className="border-t border-[var(--color-border)] p-4">
            <h5 className="text-sm font-medium text-[var(--color-text)]">{t.override}</h5>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.overrideHint}</p>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{t.gate}: {t.gates[currentGate]}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="block text-sm text-[var(--color-text-secondary)]">{t.reason}
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} required className="mt-1 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]" placeholder={t.reasonHint} />
              </label>
              <button type="submit" disabled={saving || reason.trim().length < 1 || reason.trim().length > 500} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-medium text-white disabled:opacity-50"><RefreshCw className="h-4 w-4" />{saving ? t.saving : t.submitOverride}</button>
            </div>
          </form>
          )}
        </>
      )}
    </section>
  );
}
