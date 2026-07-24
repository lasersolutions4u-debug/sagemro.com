import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  FilePenLine,
  LockKeyhole,
  ShieldCheck,
  TimerReset,
  X,
} from 'lucide-react';
import { runtimeConfig } from '../config/runtime';
import { formatApiDateTime } from '../utils/dateTime';
import { safeAuditEntries } from '../utils/fieldWorkAudit';
import {
  correctFieldDayReport,
  decideFieldExtension,
  getAuthenticatedFieldMediaUrl,
  openFieldEvidenceHold,
  overrideFieldDay,
  resolveFieldEvidenceHold,
  updateFieldPlan,
} from '../services/api';

const COPY = {
  en: {
    title: 'Field operations',
    subtitle: 'Plan onsite work, review daily evidence, and control audited exceptions.',
    readOnly: 'Read-only',
    plan: 'Field plan',
    quotePlan: 'Approved quote duration',
    quoteExpectedDays: 'expected onsite workdays',
    quoteUsedDays: 'used',
    quotePermittedDays: 'permitted',
    quoteRemainingDays: 'remaining',
    quoteAllowanceExhausted: 'Allowance exhausted',
    quoteAllowanceAvailable: 'Allowance available',
    executionUnavailable: 'Execution data unavailable. Check the confirmed quote before allowing field work.',
    extensionAllowanceHelp: 'Approved extensions add time allowance only and do not automatically add labor fees.',
    status: 'Status',
    timezone: 'IANA time zone',
    days: 'Expected days',
    completion: 'Expected completion',
    start: 'Daily start',
    end: 'Daily end',
    savePlan: 'Save plan',
    invalidTimezone: 'Enter a valid IANA time zone, such as Asia/Shanghai or America/Los_Angeles.',
    required: 'Complete all required fields.',
    saving: 'Saving...',
    daysWorked: 'Days recorded',
    labor: 'Labor hours',
    overdue: 'Overdue reports',
    extensions: 'Pending extensions',
    timeline: 'Daily timeline',
    noDays: 'No onsite workday has been recorded.',
    checkedIn: 'Checked in',
    reportOverdue: 'Report overdue',
    reportSubmitted: 'Report submitted',
    lateSubmitted: 'Late report submitted',
    adminOpen: 'Admin-created day',
    adminClosed: 'Admin closed',
    checkIn: 'Check-in',
    reportAt: 'Report submitted',
    completedWork: 'Completed work',
    risks: 'Issues and risks',
    nextPlan: 'Next plan',
    support: 'Customer support needed',
    internalNote: 'Internal note',
    lateReason: 'Late reason',
    location: 'Location',
    geofence: 'Geofence',
    locationUnavailable: 'Location unavailable · photo evidence accepted',
    locationOutsideGeofence: 'Outside configured geofence',
    locationVerified: 'Within geofence',
    locationRecorded: 'Location recorded',
    locationAdminOverride: 'Admin override',
    locationAllowed: 'Allowed evidence',
    geofenceNotEvaluated: 'Not evaluated',
    publicEvidence: 'Customer-visible progress',
    internalEvidence: 'Internal evidence',
    mediaUnavailable: 'Media unavailable',
    correctReport: 'Correct report',
    correction: 'Report correction',
    correctionReason: 'Required correction reason',
    saveCorrection: 'Save correction',
    exception: 'Day exception',
    createDay: 'Create day',
    closeDay: 'Close day',
    selectDay: 'Select a field day',
    siteDate: 'Site date',
    engineerId: 'Engineer ID',
    checkInAt: 'Check-in time',
    overrideReason: 'Required override reason',
    applyException: 'Apply exception',
    extensionReview: 'Extension review',
    noExtensions: 'No pending extension request.',
    requestedDays: 'Additional days',
    proposedDate: 'Proposed completion',
    customerExplanation: 'Customer explanation',
    extensionReason: 'Required decision reason',
    approve: 'Approve',
    reject: 'Reject',
    evidenceHold: 'Evidence hold',
    holdHint: 'An open hold prevents automatic deletion of private field evidence.',
    category: 'Reason category',
    holdReason: 'Required hold reason',
    openHold: 'Open hold',
    resolutionReason: 'Required resolution reason',
    resolveHold: 'Resolve hold',
    noHolds: 'No evidence hold is shown for this order.',
    revisions: 'Report revision history',
    noRevisions: 'No report revisions.',
    revisionReason: 'Revision reason',
    previousReport: 'Previous report',
    changedBy: 'Changed by',
    auditTrail: 'Field audit trail',
    noAuditLogs: 'No field audit record.',
    auditActor: 'Actor',
    auditBefore: 'Before',
    auditAfter: 'After',
    auditNoSummary: 'No safe summary',
    auditActionFallback: 'Field operation',
    openedBy: 'Opened by',
    openedAt: 'Opened at',
    resolvedBy: 'Resolved by',
    resolvedAt: 'Resolved at',
    resolution: 'Resolution',
    actionFailed: 'Action failed',
    savedRefreshFailed: 'Saved; refresh failed. Reopen the service order to see the latest data.',
    complaint: 'Complaint',
    warranty: 'Warranty review',
    safetyReview: 'Safety review',
    legalHold: 'Legal hold',
    dispute: 'Dispute',
    auditActions: {
      field_plan_updated: 'Field plan updated',
      field_extension_requested: 'Extension requested',
      field_extension_approved: 'Extension approved',
      field_extension_rejected: 'Extension rejected',
      field_day_checked_in: 'Field day checked in',
      field_day_report_submitted: 'Daily report submitted',
      field_day_report_corrected: 'Daily report corrected',
      field_day_admin_override_created: 'Admin-created field day',
      field_day_admin_override_closed: 'Admin closed field day',
      field_evidence_hold_opened: 'Evidence hold opened',
      field_evidence_hold_resolved: 'Evidence hold resolved',
    },
    auditFields: {
      status: 'Status', site_timezone: 'Time zone', expected_service_days: 'Expected days',
      expected_completion_date: 'Expected completion', planned_daily_start_time: 'Daily start',
      planned_daily_end_time: 'Daily end', requested_additional_days: 'Additional days',
      proposed_completion_date: 'Proposed completion', labor_hours: 'Labor hours',
      site_local_date: 'Site date', location_status: 'Location status', capture_source: 'Capture source',
      reason_category: 'Reason category',
    },
  },
  'zh-CN': {
    title: '现场作业运营',
    subtitle: '规划现场服务、审核每日证据，并管理有审计记录的例外操作。',
    readOnly: '只读',
    plan: '现场计划',
    quotePlan: '报价审核工期',
    quoteExpectedDays: '预计现场作业',
    quoteUsedDays: '已使用',
    quotePermittedDays: '可用额度',
    quoteRemainingDays: '剩余',
    quoteAllowanceExhausted: '额度已用完',
    quoteAllowanceAvailable: '额度可用',
    executionUnavailable: '执行数据暂不可用，请先核对已确认报价后再继续现场作业。',
    extensionAllowanceHelp: '批准延期只增加作业时间额度，不会自动增加人工费用。',
    status: '状态',
    timezone: '现场时区',
    days: '预计作业天数',
    completion: '预计完成日期',
    start: '每日开始时间',
    end: '每日结束时间',
    savePlan: '保存计划',
    invalidTimezone: '请输入有效的现场时区。',
    required: '请完整填写必填字段。',
    saving: '保存中...',
    daysWorked: '已记录天数',
    labor: '累计工时',
    overdue: '逾期日报',
    extensions: '待审延期',
    timeline: '每日作业时间线',
    noDays: '暂无现场作业日记录。',
    checkedIn: '已签到',
    reportOverdue: '日报逾期',
    reportSubmitted: '日报已提交',
    lateSubmitted: '逾期补交',
    adminOpen: 'Admin 补建作业日',
    adminClosed: 'Admin 已关闭',
    checkIn: '签到时间',
    reportAt: '日报提交时间',
    completedWork: '已完成工作',
    risks: '问题与风险',
    nextPlan: '下一步计划',
    support: '需客户配合',
    internalNote: '内部备注',
    lateReason: '迟报原因',
    location: '定位状态',
    geofence: '围栏结果',
    locationUnavailable: '无法定位 · 已接受照片证据',
    locationOutsideGeofence: '位于设定围栏外',
    locationVerified: '位于设定围栏内',
    locationRecorded: '已记录定位',
    locationAdminOverride: 'Admin 例外确认',
    locationAllowed: '允许作为证据',
    geofenceNotEvaluated: '未评估',
    publicEvidence: '客户可见进度照片',
    internalEvidence: '内部证据',
    mediaUnavailable: '无法加载媒体',
    correctReport: '修正日报',
    correction: '日报修正',
    correctionReason: '必填：修正原因',
    saveCorrection: '保存修正',
    exception: '作业日例外',
    createDay: '补建作业日',
    closeDay: '关闭作业日',
    selectDay: '选择现场作业日',
    siteDate: '现场日期',
    engineerId: '工程师 ID',
    checkInAt: '签到时间',
    overrideReason: '必填：例外操作原因',
    applyException: '执行例外操作',
    extensionReview: '延期审批',
    noExtensions: '暂无待审批延期。',
    requestedDays: '增加天数',
    proposedDate: '建议完成日期',
    customerExplanation: '客户说明',
    extensionReason: '必填：审批理由',
    approve: '批准',
    reject: '拒绝',
    evidenceHold: '证据保全',
    holdHint: '存在未解除的保全时，私有现场证据不会自动删除。',
    category: '原因类别',
    holdReason: '必填：保全原因',
    openHold: '开启保全',
    resolutionReason: '必填：解除原因',
    resolveHold: '解除保全',
    noHolds: '当前工单未显示证据保全记录。',
    revisions: '日报修正记录',
    noRevisions: '暂无日报修正记录。',
    revisionReason: '修正原因',
    previousReport: '修正前日报',
    changedBy: '修改人',
    auditTrail: '现场审计记录',
    noAuditLogs: '暂无现场审计记录。',
    auditActor: '操作人',
    auditBefore: '变更前',
    auditAfter: '变更后',
    auditNoSummary: '无可安全展示的摘要',
    auditActionFallback: '现场操作',
    openedBy: '开启人',
    openedAt: '开启时间',
    resolvedBy: '解除人',
    resolvedAt: '解除时间',
    resolution: '解除说明',
    actionFailed: '操作失败',
    savedRefreshFailed: '已保存，但刷新失败。重新打开工单即可查看最新数据。',
    complaint: '客户投诉',
    warranty: '质保审核',
    safetyReview: '安全审核',
    legalHold: '法律保全',
    dispute: '争议',
    auditActions: {
      field_plan_updated: '更新现场计划',
      field_extension_requested: '提交延期申请',
      field_extension_approved: '批准延期',
      field_extension_rejected: '拒绝延期',
      field_day_checked_in: '现场作业日签到',
      field_day_report_submitted: '提交现场日报',
      field_day_report_corrected: '修正现场日报',
      field_day_admin_override_created: 'Admin 补建作业日',
      field_day_admin_override_closed: 'Admin 关闭作业日',
      field_evidence_hold_opened: '开启证据保全',
      field_evidence_hold_resolved: '解除证据保全',
    },
    auditFields: {
      status: '状态', site_timezone: '时区', expected_service_days: '预计天数',
      expected_completion_date: '预计完成日期', planned_daily_start_time: '每日开始时间',
      planned_daily_end_time: '每日结束时间', requested_additional_days: '增加天数',
      proposed_completion_date: '建议完成日期', labor_hours: '工时',
      site_local_date: '现场日期', location_status: '定位状态', capture_source: '采集来源',
      reason_category: '原因类别',
    },
  },
};

const EMPTY_PLAN = {
  site_timezone: '',
  expected_service_days: '',
  expected_completion_date: '',
  planned_daily_start_time: '',
  planned_daily_end_time: '',
};

function isValidIanaTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return Boolean(value);
  } catch {
    return false;
  }
}

function siteLocalDateTimeToUtc(value, timeZone) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match || !isValidIanaTimezone(timeZone)) return '';
  const target = Date.UTC(...match.slice(1).map(Number).map((part, index) => index === 1 ? part - 1 : part));
  let estimate = target;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(estimate)).map((part) => [part.type, part.value]));
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const adjustment = target - rendered;
    if (adjustment === 0) return new Date(estimate).toISOString();
    estimate += adjustment;
  }
  return '';
}

function formatDateTime(value, locale, timeZone) {
  return formatApiDateTime(value, locale, timeZone ? { timeZone } : undefined);
}

function safeWorkdayCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function expectedWorkdaysLabel(count, isCn, copy) {
  if (count === null) return '-';
  return isCn ? `${copy.quoteExpectedDays} ${count} 天` : `${count} ${copy.quoteExpectedDays}`;
}

function workdayCountLabel(count, isCn, suffix) {
  if (count === null) return '-';
  return isCn ? `${suffix} ${count} 天` : `${count} ${suffix}`;
}

function hasValidQuoteAllowance(execution) {
  if (!execution || execution.payment_state === 'exception') return false;
  const expected = safeWorkdayCount(execution.expected_service_days);
  const consumed = safeWorkdayCount(execution.consumed_workdays);
  const permitted = safeWorkdayCount(execution.permitted_workdays);
  const remaining = safeWorkdayCount(execution.remaining_workdays);
  if (expected === null || expected < 1 || consumed === null || permitted === null || remaining === null) return false;
  if (permitted < expected || consumed > permitted || remaining !== permitted - consumed) return false;
  return execution.allowance_exhausted === (consumed >= permitted);
}

function siteTimezoneLabel(rawTimezone, displayTimezone, isCn) {
  if (displayTimezone && !displayTimezone.includes('/')) return displayTimezone;
  if (isCn && rawTimezone === 'Asia/Shanghai') return '中国标准时间（上海）';
  if (isCn) {
    try {
      const name = new Intl.DateTimeFormat('zh-CN', {
        timeZone: rawTimezone,
        timeZoneName: 'long',
      }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value;
      if (name && !name.includes('/')) return name;
    } catch {
      return '现场当地时间';
    }
    return '现场当地时间';
  }
  return rawTimezone || '-';
}

function statusTone(status) {
  if (status === 'report_overdue') return 'border-[var(--color-error)]/50 text-[var(--color-error)]';
  if (['report_submitted', 'late_report_submitted', 'admin_closed'].includes(status)) return 'border-[var(--color-success)]/40 text-[var(--color-success)]';
  return 'border-[var(--color-warning)]/40 text-[var(--color-warning)]';
}

function fieldDayLocationOutcome(day, t, locationStatusLabels) {
  if (day.location_status === 'location_unavailable' || day.location_status === 'unavailable') {
    return { locationLabel: t.locationUnavailable, geofenceLabel: t.geofenceNotEvaluated, tone: 'text-[var(--color-text-muted)]', allowed: true };
  }
  if (day.location_status === 'outside_geofence' || day.within_geofence === 0 || day.within_geofence === false) {
    return { locationLabel: locationStatusLabels[day.location_status] || t.locationRecorded, geofenceLabel: t.locationOutsideGeofence, tone: 'text-[var(--color-warning)]', allowed: false };
  }
  if (day.within_geofence === 1 || day.within_geofence === true || day.location_status === 'within_geofence' || day.location_status === 'verified') {
    return { locationLabel: locationStatusLabels[day.location_status] || t.locationRecorded, geofenceLabel: t.locationVerified, tone: 'text-[var(--color-success)]', allowed: true };
  }
  return { locationLabel: locationStatusLabels[day.location_status] || t.locationRecorded, geofenceLabel: t.geofenceNotEvaluated, tone: 'text-[var(--color-text-secondary)]', allowed: true };
}

function parseRevisionReport(revision) {
  if (!revision?.previous_report) return null;
  if (typeof revision.previous_report === 'object') return revision.previous_report;
  try {
    return JSON.parse(revision.previous_report);
  } catch {
    return null;
  }
}

function SecureFieldMedia({ workOrderId, media, label, unavailable }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setFailed(false);
    getAuthenticatedFieldMediaUrl(workOrderId, media.id)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
        else URL.revokeObjectURL(nextUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.id, workOrderId]);

  if (failed) return <div className="flex aspect-square items-center justify-center rounded-lg border border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)]">{unavailable}</div>;
  if (!url) return <div className="aspect-square animate-pulse rounded-lg bg-[var(--color-surface-elevated)]" />;
  return <a href={url} target="_blank" rel="noreferrer" aria-label={label}><img src={url} alt={label} className="aspect-square w-full rounded-lg border border-[var(--color-border)] object-cover" /></a>;
}

export function FieldWorkAdminPanel({ workOrder, readOnly = false, onRefresh }) {
  const t = COPY[runtimeConfig.locale] || COPY.en;
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [correctionDayId, setCorrectionDayId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correction, setCorrection] = useState({});
  const [overrideMode, setOverrideMode] = useState('create_day');
  const [overrideReason, setOverrideReason] = useState('');
  const [override, setOverride] = useState({ field_day_id: '', site_local_date: '', site_timezone: '', engineer_id: '', check_in_at: '' });
  const [holdForm, setHoldForm] = useState({ reason_category: 'complaint', reason: '' });
  const [resolutionReason, setResolutionReason] = useState('');
  const [localHolds, setLocalHolds] = useState([]);

  const fieldDays = workOrder?.field_days || [];
  const summary = workOrder?.field_work_summary || {};
  const quoteExecution = workOrder?.quote_execution || {};
  const quoteDriven = Number(workOrder?.active_quote_version || 0) >= 1;
  const quoteExecutionAvailable = quoteDriven && hasValidQuoteAllowance(quoteExecution);
  const isCn = runtimeConfig.locale === 'zh-CN';
  const quoteExpectedDays = safeWorkdayCount(quoteExecution.expected_service_days);
  const quoteConsumedDays = safeWorkdayCount(quoteExecution.consumed_workdays);
  const quotePermittedDays = safeWorkdayCount(quoteExecution.permitted_workdays);
  const quoteRemainingDays = safeWorkdayCount(quoteExecution.remaining_workdays);
  const pendingExtensions = workOrder?.pending_extension_requests || [];
  const holds = localHolds.length ? localHolds : (workOrder?.field_evidence_holds || []);
  const revisions = workOrder?.field_day_revisions || [];
  const auditLogs = workOrder?.field_work_audit_logs || [];
  const selectedCorrectionDay = fieldDays.find((day) => day.id === correctionDayId);

  useEffect(() => {
    const nextPlan = workOrder?.field_plan || EMPTY_PLAN;
    setPlan({
      site_timezone: nextPlan.site_timezone || '',
      expected_service_days: nextPlan.expected_service_days ?? '',
      expected_completion_date: nextPlan.expected_completion_date || '',
      planned_daily_start_time: nextPlan.planned_daily_start_time || '',
      planned_daily_end_time: nextPlan.planned_daily_end_time || '',
    });
    setOverride((current) => ({
      ...current,
      site_timezone: nextPlan.site_timezone || '',
      engineer_id: workOrder?.engineer_id || '',
    }));
    if (Array.isArray(workOrder?.field_evidence_holds)) setLocalHolds(workOrder.field_evidence_holds);
  }, [workOrder]);

  useEffect(() => {
    if (!selectedCorrectionDay) return;
    setCorrection({
      labor_hours: selectedCorrectionDay.labor_hours ?? '',
      completed_work: selectedCorrectionDay.completed_work || '',
      issues_risks: selectedCorrectionDay.issues_risks || '',
      next_plan: selectedCorrectionDay.next_plan || '',
      customer_support_needed: selectedCorrectionDay.customer_support_needed || '',
      internal_note: selectedCorrectionDay.internal_note || '',
      late_reason: selectedCorrectionDay.late_reason || '',
    });
  }, [selectedCorrectionDay]);

  const statusLabels = useMemo(() => ({
    checked_in: t.checkedIn,
    report_overdue: t.reportOverdue,
    report_submitted: t.reportSubmitted,
    late_report_submitted: t.lateSubmitted,
    admin_override_open: t.adminOpen,
    admin_closed: t.adminClosed,
  }), [t]);
  const locationStatusLabels = useMemo(() => ({
    location_unavailable: t.locationUnavailable,
    unavailable: t.locationUnavailable,
    outside_geofence: t.locationOutsideGeofence,
    within_geofence: t.locationVerified,
    verified: t.locationVerified,
    admin_override: t.locationAdminOverride,
  }), [t]);
  const holdCategoryLabels = useMemo(() => ({
    complaint: t.complaint,
    warranty: t.warranty,
    safety_review: t.safetyReview,
    legal_hold: t.legalHold,
    dispute: t.dispute,
  }), [t]);

  async function runAction(key, action) {
    if (readOnly) return;
    setBusy(key);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error.message || t.actionFailed);
      setBusy('');
      return;
    }
    try {
      await onRefresh?.(workOrder.id);
    } catch {
      setMessage(t.savedRefreshFailed);
    }
    setBusy('');
  }

  function updatePlanField(field, value) {
    setPlan((current) => ({ ...current, [field]: value }));
  }

  function savePlan() {
    if (quoteDriven) return;
    if (!plan.expected_service_days || !plan.expected_completion_date) {
      setMessage(t.required);
      return;
    }
    if (!isValidIanaTimezone(plan.site_timezone)) {
      setMessage(t.invalidTimezone);
      return;
    }
    runAction('plan', () => updateFieldPlan(workOrder.id, { ...plan, expected_service_days: Number(plan.expected_service_days) }));
  }

  function decideExtension(requestId, decision) {
    if (!extensionReason.trim()) {
      setMessage(t.required);
      return;
    }
    runAction(`extension:${requestId}:${decision}`, async () => {
      await decideFieldExtension(workOrder.id, requestId, { decision, decision_reason: extensionReason.trim() });
      setExtensionReason('');
    });
  }

  function submitCorrection() {
    if (!correctionDayId || !correctionReason.trim()) {
      setMessage(t.required);
      return;
    }
    runAction(`correction:${correctionDayId}`, async () => {
      await correctFieldDayReport(workOrder.id, correctionDayId, {
        ...correction,
        labor_hours: Number(correction.labor_hours),
        reason: correctionReason.trim(),
      });
      setCorrectionDayId('');
      setCorrectionReason('');
    });
  }

  function submitOverride() {
    if (!overrideReason.trim()) {
      setMessage(t.required);
      return;
    }
    const payload = { action: overrideMode, reason: overrideReason.trim() };
    if (overrideMode === 'create_day') {
      if (!override.site_local_date || !override.site_timezone || !override.engineer_id || !override.check_in_at || !isValidIanaTimezone(override.site_timezone)) {
        setMessage(t.required);
        return;
      }
      const checkInAt = siteLocalDateTimeToUtc(override.check_in_at, override.site_timezone);
      if (!checkInAt) {
        setMessage(t.required);
        return;
      }
      Object.assign(payload, {
        site_local_date: override.site_local_date,
        site_timezone: override.site_timezone,
        engineer_id: override.engineer_id,
        check_in_at: checkInAt,
      });
    } else {
      if (!override.field_day_id) {
        setMessage(t.required);
        return;
      }
      payload.field_day_id = override.field_day_id;
    }
    runAction(`override:${overrideMode}`, async () => {
      await overrideFieldDay(workOrder.id, payload);
      setOverrideReason('');
    });
  }

  function openHold() {
    if (!holdForm.reason_category || !holdForm.reason.trim()) {
      setMessage(t.required);
      return;
    }
    runAction('hold:open', async () => {
      const response = await openFieldEvidenceHold(workOrder.id, { ...holdForm, reason: holdForm.reason.trim() });
      setLocalHolds((current) => [response.evidence_hold, ...current]);
      setHoldForm((current) => ({ ...current, reason: '' }));
    });
  }

  function resolveHold(holdId) {
    if (!resolutionReason.trim()) {
      setMessage(t.required);
      return;
    }
    runAction(`hold:${holdId}`, async () => {
      const response = await resolveFieldEvidenceHold(workOrder.id, holdId, { resolution_reason: resolutionReason.trim() });
      setLocalHolds((current) => current.map((hold) => hold.id === holdId ? response.evidence_hold : hold));
      setResolutionReason('');
    });
  }

  return (
    <section className="break-words overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" /><h4 className="font-semibold">{t.title}</h4></div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.subtitle}</p>
        </div>
        {readOnly && <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)]"><LockKeyhole className="h-3.5 w-3.5" />{t.readOnly}</span>}
      </header>

      {message && <div role="status" className="border-b border-[var(--color-border)] bg-[var(--color-warning)]/10 px-4 py-2 text-sm text-[var(--color-warning)]">{message}</div>}

      <div className="grid grid-cols-2 border-b border-[var(--color-border)] sm:grid-cols-4">
        {[
          [CalendarDays, t.daysWorked, summary.total_days ?? fieldDays.length],
          [Clock3, t.labor, Number(summary.total_labor_hours || 0).toFixed(1)],
          [AlertTriangle, t.overdue, summary.overdue_count || 0],
          [TimerReset, t.extensions, pendingExtensions.length],
        ].map(([Icon, label, value]) => <div key={label} className="border-r border-[var(--color-border)] px-3 py-3 last:border-r-0"><div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><Icon className="h-3.5 w-3.5" />{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>)}
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="mb-3 text-sm font-medium">{t.plan}</h5>
        {quoteDriven ? quoteExecutionAvailable ? (
          <div className="space-y-3">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6">
              <div><span className="block text-xs text-[var(--color-text-muted)]">{t.quotePlan}</span><span className="font-medium">{expectedWorkdaysLabel(quoteExpectedDays, isCn, t)}</span></div>
              <div><span className="block text-xs text-[var(--color-text-muted)]">{t.quoteUsedDays}</span><span className="font-medium">{workdayCountLabel(quoteConsumedDays, isCn, t.quoteUsedDays)}</span></div>
              <div><span className="block text-xs text-[var(--color-text-muted)]">{t.quotePermittedDays}</span><span className="font-medium">{workdayCountLabel(quotePermittedDays, isCn, t.quotePermittedDays)}</span></div>
              <div><span className="block text-xs text-[var(--color-text-muted)]">{t.quoteRemainingDays}</span><span className="font-medium">{workdayCountLabel(quoteRemainingDays, isCn, t.quoteRemainingDays)}</span></div>
              <div><span className="block text-xs text-[var(--color-text-muted)]">{t.timezone}</span><span className="font-medium">{siteTimezoneLabel(workOrder?.field_plan?.site_timezone, workOrder?.field_plan?.site_timezone_display, isCn)}</span></div>
              <div><span className="block text-xs text-[var(--color-text-muted)]">{t.status}</span><span className="font-medium">{quoteExecution.allowance_exhausted ? t.quoteAllowanceExhausted : t.quoteAllowanceAvailable}</span></div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">{t.extensionAllowanceHelp}</p>
          </div>
        ) : <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">{t.executionUnavailable}</p> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs text-[var(--color-text-muted)] sm:col-span-2 lg:col-span-1">{t.timezone}<input value={plan.site_timezone} onChange={(event) => updatePlanField('site_timezone', event.target.value)} disabled={readOnly} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm disabled:opacity-60" /></label>
              <label className="text-xs text-[var(--color-text-muted)]">{t.days}<input type="number" min="1" max="365" value={plan.expected_service_days} onChange={(event) => updatePlanField('expected_service_days', event.target.value)} disabled={readOnly} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm disabled:opacity-60" /></label>
              <label className="text-xs text-[var(--color-text-muted)]">{t.completion}<input type="date" value={plan.expected_completion_date} onChange={(event) => updatePlanField('expected_completion_date', event.target.value)} disabled={readOnly} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm disabled:opacity-60" /></label>
              <label className="text-xs text-[var(--color-text-muted)]">{t.start}<input type="time" value={plan.planned_daily_start_time} onChange={(event) => updatePlanField('planned_daily_start_time', event.target.value)} disabled={readOnly} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm disabled:opacity-60" /></label>
              <label className="text-xs text-[var(--color-text-muted)]">{t.end}<input type="time" value={plan.planned_daily_end_time} onChange={(event) => updatePlanField('planned_daily_end_time', event.target.value)} disabled={readOnly} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm disabled:opacity-60" /></label>
            </div>
            {!readOnly && !quoteDriven && <div className="mt-3 flex justify-end"><button type="button" onClick={savePlan} disabled={busy === 'plan'} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white disabled:opacity-50">{busy === 'plan' ? t.saving : t.savePlan}</button></div>}
          </>
        )}
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="mb-3 text-sm font-medium">{t.timeline}</h5>
        {fieldDays.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">{t.noDays}</p> : <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {fieldDays.map((day) => {
            const publicMedia = (day.media || []).filter((item) => item.customer_visible);
            const internalMedia = (day.media || []).filter((item) => !item.customer_visible);
            const locationOutcome = fieldDayLocationOutcome(day, t, locationStatusLabels);
            return <article key={day.id} className="min-w-0 py-4 first:pt-3 last:pb-3 [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="font-mono text-sm font-semibold">{day.site_local_date}</div><div className="mt-1 text-xs text-[var(--color-text-muted)]">{siteTimezoneLabel(day.site_timezone, day.site_timezone_display, isCn)}</div></div>
                <div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg border px-2 py-1 text-xs ${statusTone(day.status)}`}>{statusLabels[day.status] || day.status}</span>{!readOnly && ['report_submitted', 'late_report_submitted'].includes(day.status) && <button type="button" onClick={() => setCorrectionDayId(day.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs"><FilePenLine className="h-3.5 w-3.5" />{t.correctReport}</button>}</div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2 lg:grid-cols-5"><div>{t.checkIn}: {formatDateTime(day.check_in_at, runtimeConfig.locale, day.site_timezone)}</div><div>{t.reportAt}: {formatDateTime(day.report_submitted_at, runtimeConfig.locale, day.site_timezone)}</div><div>{t.labor}: {day.labor_hours ?? '-'} </div><div>{t.location}: <span className={locationOutcome.tone}>{locationOutcome.locationLabel}</span></div><div>{t.geofence}: <span className={locationOutcome.tone}>{locationOutcome.geofenceLabel}{locationOutcome.allowed ? ` · ${t.locationAllowed}` : ''}</span></div></div>
              {(day.completed_work || day.issues_risks || day.next_plan || day.customer_support_needed || day.internal_note || day.late_reason) && <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                {[[t.completedWork, day.completed_work], [t.risks, day.issues_risks], [t.nextPlan, day.next_plan], [t.support, day.customer_support_needed], [t.internalNote, day.internal_note], [t.lateReason, day.late_reason]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[var(--color-text-muted)]">{label}</dt><dd className="min-w-0 mt-0.5 whitespace-pre-wrap text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{value}</dd></div>)}
              </dl>}
              {(publicMedia.length > 0 || internalMedia.length > 0) && <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {[[t.publicEvidence, publicMedia], [t.internalEvidence, internalMedia]].map(([label, media]) => media.length > 0 && <div key={label}><div className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><Camera className="h-3.5 w-3.5" />{label}</div><div className="grid grid-cols-3 gap-2 lg:grid-cols-4">{media.map((item) => <SecureFieldMedia key={item.id} workOrderId={workOrder.id} media={item} label={label} unavailable={t.mediaUnavailable} />)}</div></div>)}
              </div>}
            </article>;
          })}
        </div>}
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="mb-3 text-sm font-medium">{t.revisions}</h5>
        {revisions.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">{t.noRevisions}</p> : <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{revisions.map((revision) => {
          const previousReport = parseRevisionReport(revision);
          return <article key={revision.id} className="min-w-0 py-3 [overflow-wrap:anywhere]"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs"><span className="font-mono text-[var(--color-text-secondary)]">{revision.field_day_id}</span><span className="text-[var(--color-text-muted)]">{formatDateTime(revision.created_at, runtimeConfig.locale)}</span></div><div className="mt-2 grid min-w-0 gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2"><div className="min-w-0 [overflow-wrap:anywhere]"><span className="text-[var(--color-text-muted)]">{t.revisionReason}: </span>{revision.reason}</div><div className="min-w-0 [overflow-wrap:anywhere]"><span className="text-[var(--color-text-muted)]">{t.changedBy}: </span>{[revision.changed_by_type, revision.changed_by_id].filter(Boolean).join(' · ') || '-'}</div></div>{previousReport && <dl className="mt-3 grid min-w-0 gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2">{[[t.completedWork, previousReport.completed_work], [t.labor, previousReport.labor_hours], [t.risks, previousReport.issues_risks], [t.nextPlan, previousReport.next_plan], [t.support, previousReport.customer_support_needed], [t.internalNote, previousReport.internal_note], [t.lateReason, previousReport.late_reason]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[var(--color-text-muted)]">{label}</dt><dd className="min-w-0 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{value ?? '-'}</dd></div>)}</dl>}</article>;
        })}</div>}
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="mb-3 text-sm font-medium">{t.auditTrail}</h5>
        {auditLogs.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">{t.noAuditLogs}</p> : <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{auditLogs.map((audit) => {
          const beforeEntries = safeAuditEntries(audit.before_state);
          const afterEntries = safeAuditEntries(audit.after_state);
          const summary = (entries) => entries.length
            ? entries.map(([key, value]) => `${t.auditFields[key] || key}: ${value}`).join(' · ')
            : t.auditNoSummary;
          return <article key={audit.id} className="min-w-0 py-2.5 text-xs [overflow-wrap:anywhere]"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><span className="font-medium text-[var(--color-text-secondary)]">{t.auditActions[audit.action] || t.auditActionFallback}</span><span className="text-[var(--color-text-muted)]">{formatDateTime(audit.created_at, runtimeConfig.locale)}</span></div><div className="mt-1 text-[var(--color-text-muted)]">{t.auditActor}: {[audit.actor_type, audit.actor_id].filter(Boolean).join(' · ') || '-'}</div><div className="mt-1 grid min-w-0 gap-1 text-[var(--color-text-secondary)] sm:grid-cols-2"><div className="min-w-0 [overflow-wrap:anywhere]"><span className="text-[var(--color-text-muted)]">{t.auditBefore}: </span>{summary(beforeEntries)}</div><div className="min-w-0 [overflow-wrap:anywhere]"><span className="text-[var(--color-text-muted)]">{t.auditAfter}: </span>{summary(afterEntries)}</div></div></article>;
        })}</div>}
      </div>

      {!readOnly && correctionDayId && <div className="border-b border-[var(--color-border)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h5 className="text-sm font-medium">{t.correction}</h5><button type="button" onClick={() => setCorrectionDayId('')} aria-label="Close correction"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--color-text-muted)]">{t.labor}<input type="number" min="0.1" step="0.1" value={correction.labor_hours || ''} onChange={(event) => setCorrection((current) => ({ ...current, labor_hours: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm" /></label>{[['completed_work', t.completedWork], ['issues_risks', t.risks], ['next_plan', t.nextPlan], ['customer_support_needed', t.support], ['internal_note', t.internalNote], ['late_reason', t.lateReason]].map(([field, label]) => <label key={field} className="text-xs text-[var(--color-text-muted)]">{label}<textarea rows="2" value={correction[field] || ''} onChange={(event) => setCorrection((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm" /></label>)}</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder={t.correctionReason} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-surface-elevated)] px-3 text-sm" /><button type="button" onClick={submitCorrection} disabled={busy.startsWith('correction:')} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white disabled:opacity-50">{t.saveCorrection}</button></div>
      </div>}

      <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="mb-3 text-sm font-medium">{t.extensionReview}</h5>
        {pendingExtensions.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">{t.noExtensions}</p> : <div className="space-y-4">{pendingExtensions.map((extension) => <div key={extension.id} className="min-w-0 border-l-2 border-[var(--color-warning)] pl-3 [overflow-wrap:anywhere]"><div className="grid min-w-0 gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-3"><div>{t.requestedDays}: {extension.requested_additional_days}</div><div>{t.proposedDate}: {extension.proposed_completion_date}</div><div className="min-w-0 [overflow-wrap:anywhere]">{t.customerExplanation}: {extension.customer_explanation || '-'}</div></div>{extension.reason && <p className="mt-2 min-w-0 text-sm [overflow-wrap:anywhere]">{extension.reason}</p>}{!readOnly && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={extensionReason} onChange={(event) => setExtensionReason(event.target.value)} placeholder={t.extensionReason} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-surface-elevated)] px-3 text-sm" /><button type="button" onClick={() => decideExtension(extension.id, 'rejected')} disabled={busy.startsWith(`extension:${extension.id}`)} className="inline-flex min-h-10 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-[var(--color-error)]/40 px-3 text-sm text-[var(--color-error)] disabled:opacity-50"><X className="h-4 w-4" />{t.reject}</button><button type="button" onClick={() => decideExtension(extension.id, 'approved')} disabled={busy.startsWith(`extension:${extension.id}`)} className="inline-flex min-h-10 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-[var(--color-success)] px-3 text-sm font-medium text-white disabled:opacity-50"><Check className="h-4 w-4" />{t.approve}</button></div>}</div>)}</div>}
      </div>

      {!readOnly && <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="mb-3 text-sm font-medium">{t.exception}</h5>
        <div className="mb-3 inline-flex rounded-lg border border-[var(--color-border)] p-1"><button type="button" onClick={() => setOverrideMode('create_day')} className={`rounded-md px-3 py-1.5 text-xs ${overrideMode === 'create_day' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>{t.createDay}</button><button type="button" onClick={() => setOverrideMode('close_day')} className={`rounded-md px-3 py-1.5 text-xs ${overrideMode === 'close_day' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>{t.closeDay}</button></div>
        {overrideMode === 'create_day' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-[var(--color-text-muted)]">{t.siteDate}<input type="date" value={override.site_local_date} onChange={(event) => setOverride((current) => ({ ...current, site_local_date: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm" /></label><label className="text-xs text-[var(--color-text-muted)]">{t.timezone}<input value={override.site_timezone} onChange={(event) => setOverride((current) => ({ ...current, site_timezone: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm" /></label><label className="text-xs text-[var(--color-text-muted)]">{t.engineerId}<input value={override.engineer_id} onChange={(event) => setOverride((current) => ({ ...current, engineer_id: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm" /></label><label className="text-xs text-[var(--color-text-muted)]">{t.checkInAt}<input type="datetime-local" value={override.check_in_at} onChange={(event) => setOverride((current) => ({ ...current, check_in_at: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm" /></label></div> : <select value={override.field_day_id} onChange={(event) => setOverride((current) => ({ ...current, field_day_id: event.target.value }))} className="min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm"><option value="">{t.selectDay}</option>{fieldDays.filter((day) => !['admin_closed', 'report_submitted', 'late_report_submitted'].includes(day.status)).map((day) => <option key={day.id} value={day.id}>{day.site_local_date} · {statusLabels[day.status] || day.status}</option>)}</select>}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder={t.overrideReason} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-surface-elevated)] px-3 text-sm" /><button type="button" onClick={submitOverride} disabled={busy.startsWith('override:')} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white disabled:opacity-50">{t.applyException}</button></div>
      </div>}

      <div className="p-4">
        <div className="flex items-start gap-2"><LockKeyhole className="mt-0.5 h-4 w-4 text-[var(--color-primary)]" /><div><h5 className="text-sm font-medium">{t.evidenceHold}</h5><p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.holdHint}</p></div></div>
        {holds.length === 0 ? <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t.noHolds}</p> : <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{holds.map((hold) => <div key={hold.id} className="min-w-0 py-3 [overflow-wrap:anywhere]"><div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="text-sm font-medium">{holdCategoryLabels[hold.reason_category] || hold.reason_category}</div><div className="mt-1 min-w-0 text-xs text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{hold.reason}</div></div><span className={`rounded-lg border px-2 py-1 text-xs ${hold.status === 'open' ? 'border-[var(--color-warning)]/40 text-[var(--color-warning)]' : 'border-[var(--color-success)]/40 text-[var(--color-success)]'}`}>{hold.status}</span></div><div className="mt-2 grid min-w-0 gap-1 text-xs text-[var(--color-text-muted)] sm:grid-cols-2"><div className="min-w-0 [overflow-wrap:anywhere]">{t.openedBy}: {hold.opened_by || '-'}{hold.opened_at ? ` · ${t.openedAt}: ${formatDateTime(hold.opened_at, runtimeConfig.locale)}` : ''}</div>{hold.status === 'resolved' && <div className="min-w-0 [overflow-wrap:anywhere]">{t.resolvedBy}: {hold.resolved_by || '-'}{hold.resolved_at ? ` · ${t.resolvedAt}: ${formatDateTime(hold.resolved_at, runtimeConfig.locale)}` : ''}</div>}</div>{hold.status === 'resolved' && hold.resolution_reason && <div className="mt-1 min-w-0 text-xs text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{t.resolution}: {hold.resolution_reason}</div>}{!readOnly && hold.status === 'open' && <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} placeholder={t.resolutionReason} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-surface-elevated)] px-3 text-sm" /><button type="button" onClick={() => resolveHold(hold.id)} disabled={busy === `hold:${hold.id}`} className="min-h-10 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 text-sm disabled:opacity-50">{t.resolveHold}</button></div>}</div>)}</div>}
        {!readOnly && <div className="mt-4 grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select value={holdForm.reason_category} onChange={(event) => setHoldForm((current) => ({ ...current, reason_category: event.target.value }))} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm"><option value="complaint">{t.complaint}</option><option value="warranty">{t.warranty}</option><option value="safety_review">{t.safetyReview}</option><option value="legal_hold">{t.legalHold}</option><option value="dispute">{t.dispute}</option></select><input value={holdForm.reason} onChange={(event) => setHoldForm((current) => ({ ...current, reason: event.target.value }))} placeholder={t.holdReason} className="min-h-10 min-w-0 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-surface-elevated)] px-3 text-sm" /><button type="button" onClick={openHold} disabled={busy === 'hold:open'} className="min-h-10 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white disabled:opacity-50">{t.openHold}</button></div>}
      </div>
    </section>
  );
}
