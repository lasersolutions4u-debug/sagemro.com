import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  FileWarning,
  ImagePlus,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  checkInFieldDay,
  checkInWorkOrder,
  fieldMediaUrl,
  getFieldDays,
  requestFieldExtension,
  submitFieldDayReport,
} from '../../services/api';
import { getBrowserLocation } from '../../utils/browserGeolocation';
import { isCnLocale } from '../../utils/locale';
import { toastError, toastSuccess, toastWarning } from '../../utils/feedback';

const COPY = {
  en: {
    plan: 'On-site plan',
    days: 'Planned days',
    completion: 'Expected completion',
    timezone: 'Site time zone',
    schedule: 'Daily schedule',
    noPlan: 'Admin must complete the on-site plan before the first field-day check-in.',
    legacyCheckIn: 'Legacy location check-in',
    legacyChecking: 'Getting current location...',
    legacyHelp: 'This older work order does not use daily field-work planning. Location verification remains available only for compatibility.',
    legacySuccess: 'Legacy arrival verification was recorded.',
    startCheckIn: 'Start today\'s photo check-in',
    cameraTitle: 'Live site check-in',
    cameraHelp: 'Show your face clearly with the serviced equipment or recognizable site context behind you.',
    cameraUnavailable: 'Camera access is unavailable. Open this work order on a phone and allow camera access.',
    startCamera: 'Open front camera',
    capture: 'Capture check-in photo',
    retake: 'Retake photo',
    checkIn: 'Check in for today',
    checkingIn: 'Checking in...',
    checkout: 'Expected finish time',
    locationOptional: 'Browser location is optional supporting evidence and never replaces the photo.',
    checkedIn: 'Today\'s check-in is recorded. Submit the daily report before finishing work.',
    reportTitle: 'Daily field report',
    completeOverdue: 'Complete overdue report',
    completedWork: 'Work completed today',
    issues: 'Problems or risks found',
    nextPlan: 'Plan for the next workday',
    customerSupport: 'Customer preparation or cooperation needed',
    labor: 'Labor hours',
    internalNote: 'Internal note (not visible to customer)',
    lateReason: 'Reason for late submission',
    progressPhotos: 'Progress photos',
    progressHelp: 'At least one customer-visible photo of the work result or site condition is required.',
    internalPhotos: 'Internal photos (optional, private)',
    submitReport: 'Submit daily report',
    submitting: 'Submitting...',
    required: 'Complete all required report fields and add at least one progress photo.',
    lateRequired: 'Explain why this report is late.',
    extension: 'Request more service time',
    extensionReason: 'Operational reason',
    extensionCustomer: 'Explanation visible to customer',
    extensionDays: 'Additional days',
    extensionDate: 'Proposed completion date',
    extensionInternal: 'Internal note (optional)',
    requestExtensionWithReport: 'Request more service time with this report',
    extensionIncomplete: 'Complete every extension request field or remove the request from this report.',
    requestExtension: 'Send extension request',
    extensionPending: 'An extension request is waiting for Admin review.',
    extensionHistory: 'Extension history',
    proposedCompletion: 'Proposed completion',
    decisionReason: 'Decision',
    timeline: 'Field-work timeline',
    empty: 'No field work has been recorded yet.',
    reload: 'Reload',
    loading: 'Loading field work...',
    loadFailed: 'Unable to load field work.',
    checkInSuccess: 'Today\'s field-work check-in was recorded.',
    reportSuccess: 'Daily field report submitted.',
    extensionSuccess: 'Extension request sent to Admin.',
    savedRefreshFailed: 'Saved, but the latest data could not be refreshed. Reload this work order.',
    internal: 'Internal note',
    locationVerified: 'Location supporting evidence verified',
    locationUnavailable: 'Location supporting evidence unavailable',
    locationOutside: 'Location is outside the configured service radius',
    revisedCompletion: 'Current expected completion',
    customerOverdue: 'Daily update pending',
    customerOverdueHelp: 'The engineer has not yet submitted this day\'s progress update.',
    protectedMedia: 'Protected service evidence',
    finalHint: 'Complete every field-day report before submitting the final service report.',
  },
  cn: {
    plan: '现场作业计划',
    days: '计划天数',
    completion: '预计完成日期',
    timezone: '现场时区',
    schedule: '每日计划时间',
    noPlan: '首次现场签到前，需要由 Admin 完成现场作业计划。',
    legacyCheckIn: '旧工单定位签到',
    legacyChecking: '正在获取当前位置...',
    legacyHelp: '此历史工单尚未启用现场作业日计划，定位核验仅作为兼容入口保留。',
    legacySuccess: '旧工单到场核验已记录。',
    startCheckIn: '开始今日拍照签到',
    cameraTitle: '实时现场签到',
    cameraHelp: '请确保面部清晰，并让背景显示正在服务的设备或可识别的现场环境。',
    cameraUnavailable: '无法使用摄像头。请在手机上打开此工单，并允许浏览器使用摄像头。',
    startCamera: '打开前置摄像头',
    capture: '拍摄签到照片',
    retake: '重新拍摄',
    checkIn: '确认今日签到',
    checkingIn: '正在签到...',
    checkout: '预计今日结束时间',
    locationOptional: '浏览器定位仅作为可选辅助证据，不会替代现场照片。',
    checkedIn: '今日签到已记录，请在结束作业前提交现场日报。',
    reportTitle: '现场日报',
    completeOverdue: '补交逾期日报',
    completedWork: '今日完成的工作',
    issues: '发现的问题或风险',
    nextPlan: '下一个工作日计划',
    customerSupport: '需要客户配合或准备的事项',
    labor: '今日工时',
    internalNote: '内部备注（客户不可见）',
    lateReason: '逾期补交原因',
    progressPhotos: '进度照片',
    progressHelp: '至少上传一张客户可见的作业结果或现场情况照片。',
    internalPhotos: '内部照片（可选，仅内部可见）',
    submitReport: '提交现场日报',
    submitting: '正在提交...',
    required: '请填写全部必填项，并至少添加一张进度照片。',
    lateRequired: '请说明日报逾期补交的原因。',
    extension: '申请延长现场服务时间',
    extensionReason: '作业原因',
    extensionCustomer: '客户可见说明',
    extensionDays: '增加天数',
    extensionDate: '建议的新完成日期',
    extensionInternal: '内部备注（可选）',
    requestExtensionWithReport: '随本次日报申请延长现场服务时间',
    extensionIncomplete: '请填写延期申请的全部字段，或取消本次日报中的延期申请。',
    requestExtension: '提交延期申请',
    extensionPending: '延期申请正在等待 Admin 审批。',
    extensionHistory: '延期记录',
    proposedCompletion: '申请完成日期',
    decisionReason: '审批意见',
    timeline: '现场作业时间线',
    empty: '尚未记录现场作业。',
    reload: '重新加载',
    loading: '正在加载现场作业...',
    loadFailed: '现场作业加载失败。',
    checkInSuccess: '今日现场作业签到已记录。',
    reportSuccess: '现场日报已提交。',
    extensionSuccess: '延期申请已提交给 Admin。',
    savedRefreshFailed: '已保存，但最新数据刷新失败，请重新加载此工单。',
    internal: '内部备注',
    locationVerified: '定位辅助证据已核验',
    locationUnavailable: '无法获取定位辅助证据',
    locationOutside: '定位在设定的现场范围之外',
    revisedCompletion: '当前预计完成日期',
    customerOverdue: '日报待补充',
    customerOverdueHelp: '工程师尚未提交该工作日的进度更新。',
    protectedMedia: '受保护的服务证据',
    finalHint: '提交最终服务报告前，请先完成所有现场日报。',
  },
};

const REPORT_INITIAL = {
  completed_work: '',
  issues_risks: '',
  next_plan: '',
  customer_support_needed: '',
  labor_hours: '',
  internal_note: '',
  late_reason: '',
  request_extension: false,
  extension_reason: '',
  extension_customer_explanation: '',
  requested_additional_days: '1',
  proposed_completion_date: '',
  extension_internal_note: '',
};

function operationKey(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function siteToday(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return '';
  }
}

function normalizeFieldDays(fieldDays = [], media = []) {
  const mediaByDay = new Map();
  for (const item of media) {
    const list = mediaByDay.get(item.field_day_id) || [];
    list.push(item);
    mediaByDay.set(item.field_day_id, list);
  }
  return fieldDays.map((day) => ({ ...day, media: day.media || mediaByDay.get(day.id) || [] }));
}

function customerTimelineDay(fieldDay) {
  return {
    id: fieldDay.id,
    site_local_date: fieldDay.site_local_date,
    status: fieldDay.status,
    check_in_at: fieldDay.check_in_at,
    report_submitted_at: fieldDay.report_submitted_at,
    labor_hours: fieldDay.labor_hours,
    completed_work: fieldDay.completed_work,
    issues_risks: fieldDay.issues_risks,
    next_plan: fieldDay.next_plan,
    customer_support_needed: fieldDay.customer_support_needed,
    media: (fieldDay.media || []).filter((item) => item.customer_visible),
  };
}

function fieldDayStatusLabel(status, isCn) {
  const labels = {
    checked_in: ['Checked in', '已签到'],
    report_submitted: ['Report submitted', '日报已提交'],
    report_overdue: ['Daily update pending', '日报待补交'],
    late_report_submitted: ['Late report submitted', '逾期日报已补交'],
    admin_closed: ['Closed by operations', '运营已关闭'],
  };
  return labels[status]?.[isCn ? 1 : 0] || status || '-';
}

function statusTone(status) {
  if (['report_submitted', 'late_report_submitted', 'admin_closed'].includes(status)) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
  }
  if (status === 'report_overdue') return 'border-amber-500/30 bg-amber-500/10 text-amber-700';
  return 'border-blue-500/30 bg-blue-500/10 text-blue-700';
}

function formatDateTime(value, isCn) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(isCn ? 'zh-CN' : 'en-US');
}

function approvedCompletionDate(extension) {
  if (extension.status !== 'approved') return '';
  try {
    const approvedPlan = typeof extension.approved_plan === 'string'
      ? JSON.parse(extension.approved_plan)
      : extension.approved_plan;
    return approvedPlan?.expected_completion_date || extension.proposed_completion_date || '';
  } catch {
    return extension.proposed_completion_date || '';
  }
}

async function bestEffortRefresh(refresh, warning) {
  try {
    await refresh?.();
  } catch {
    toastWarning(warning);
  }
}

function FieldMedia({ workOrderId, media, label }) {
  return (
    <img
      src={fieldMediaUrl(workOrderId, media.id)}
      alt={label}
      loading="lazy"
      className="aspect-[4/3] w-full rounded-lg border border-[var(--color-border)] object-cover"
    />
  );
}

function ReportForm({ workOrderId, fieldDay, isCn, extensionPending, onSaved, onBusyChange }) {
  const t = isCn ? COPY.cn : COPY.en;
  const fieldDayId = fieldDay.id;
  const draftKey = `sagemro_field_report_${fieldDayId}`;
  const [report, setReport] = useState(REPORT_INITIAL);
  const [progressPhotos, setProgressPhotos] = useState([]);
  const [internalPhotos, setInternalPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const retryRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || '{}');
      setReport({ ...REPORT_INITIAL, ...saved });
    } catch {
      setReport(REPORT_INITIAL);
    }
  }, [draftKey]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(report)); } catch { /* storage unavailable */ }
    }, 250);
    return () => clearTimeout(timeout);
  }, [draftKey, report]);

  useEffect(() => {
    onBusyChange?.(submitting);
    return () => onBusyChange?.(false);
  }, [onBusyChange, submitting]);

  const update = (field, value) => setReport((current) => ({ ...current, [field]: value }));

  const submit = async () => {
    const requestExtension = report.request_extension && !extensionPending;
    const requiredText = [report.completed_work, report.issues_risks, report.next_plan, report.customer_support_needed];
    const laborHours = Number(report.labor_hours);
    if (requiredText.some((value) => !value.trim())
      || !Number.isFinite(laborHours) || laborHours <= 0 || laborHours > 24
      || progressPhotos.length === 0) {
      toastWarning(t.required);
      return;
    }
    if (fieldDay.status === 'report_overdue' && !report.late_reason.trim()) {
      toastWarning(t.lateRequired);
      return;
    }
    if (requestExtension && (
      !report.extension_reason.trim()
      || !report.extension_customer_explanation.trim()
      || !report.proposed_completion_date
      || !Number.isInteger(Number(report.requested_additional_days))
      || Number(report.requested_additional_days) < 1
    )) {
      toastWarning(t.extensionIncomplete);
      return;
    }

    const payload = {
      completed_work: report.completed_work,
      issues_risks: report.issues_risks,
      next_plan: report.next_plan,
      customer_support_needed: report.customer_support_needed,
      labor_hours: laborHours,
      internal_note: report.internal_note,
      late_reason: report.late_reason,
      progress_photos: progressPhotos,
      internal_photos: internalPhotos,
      ...(requestExtension ? {
        extension_reason: report.extension_reason,
        extension_customer_explanation: report.extension_customer_explanation,
        requested_additional_days: Number(report.requested_additional_days),
        proposed_completion_date: report.proposed_completion_date,
        extension_internal_note: report.extension_internal_note,
      } : {}),
    };
    const fingerprint = JSON.stringify({
      ...report,
      labor_hours: laborHours,
      progress: progressPhotos.map((file) => [file.name, file.size, file.lastModified]),
      internal: internalPhotos.map((file) => [file.name, file.size, file.lastModified]),
    });
    if (retryRef.current?.fingerprint !== fingerprint) {
      retryRef.current = { fingerprint, key: operationKey(`field-report-${fieldDayId}`) };
    }

    setSubmitting(true);
    try {
      await submitFieldDayReport(workOrderId, fieldDayId, payload, retryRef.current.key);
    } catch (error) {
      toastError(error.message || t.loadFailed);
      return;
    } finally {
      setSubmitting(false);
    }
    try { localStorage.removeItem(draftKey); } catch { /* storage unavailable */ }
    retryRef.current = null;
    toastSuccess(t.reportSuccess);
    await bestEffortRefresh(onSaved, t.savedRefreshFailed);
  };

  return (
    <section data-field-work-report className="space-y-4 border-t border-[var(--color-border)] pt-4">
      <div className="flex items-center gap-2">
        {fieldDay.status === 'report_overdue'
          ? <FileWarning size={18} className="text-amber-600" />
          : <CheckCircle2 size={18} className="text-[var(--color-primary)]" />}
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {fieldDay.status === 'report_overdue' ? t.completeOverdue : t.reportTitle} · {fieldDay.site_local_date}
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.completedWork} *</span>
          <textarea value={report.completed_work} onChange={(event) => update('completed_work', event.target.value)} rows={3} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.issues} *</span>
          <textarea value={report.issues_risks} onChange={(event) => update('issues_risks', event.target.value)} rows={3} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.nextPlan} *</span>
          <textarea value={report.next_plan} onChange={(event) => update('next_plan', event.target.value)} rows={3} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.customerSupport} *</span>
          <textarea value={report.customer_support_needed} onChange={(event) => update('customer_support_needed', event.target.value)} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.labor} *</span>
          <input type="number" min="0.1" max="24" step="0.1" value={report.labor_hours} onChange={(event) => update('labor_hours', event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
        </label>
        {fieldDay.status === 'report_overdue' && (
          <label>
            <span className="mb-1 block text-xs text-amber-700">{t.lateReason} *</span>
            <input value={report.late_reason} onChange={(event) => update('late_reason', event.target.value)} className="w-full rounded-lg border border-amber-500/40 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-amber-500/40" />
          </label>
        )}
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.internalNote}</span>
          <textarea value={report.internal_note} onChange={(event) => update('internal_note', event.target.value)} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
        </label>
      </div>

      {extensionPending ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">{t.extensionPending}</p>
      ) : (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
            <input type="checkbox" checked={report.request_extension} onChange={(event) => update('request_extension', event.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
            {t.requestExtensionWithReport}
          </label>
          {report.request_extension && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionReason} *</span><textarea value={report.extension_reason} onChange={(event) => update('extension_reason', event.target.value)} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
              <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionCustomer} *</span><textarea value={report.extension_customer_explanation} onChange={(event) => update('extension_customer_explanation', event.target.value)} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
              <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionDays} *</span><input type="number" min="1" max="365" value={report.requested_additional_days} onChange={(event) => update('requested_additional_days', event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
              <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionDate} *</span><input type="date" value={report.proposed_completion_date} onChange={(event) => update('proposed_completion_date', event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
              <label className="sm:col-span-2"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionInternal}</span><input value={report.extension_internal_note} onChange={(event) => update('extension_internal_note', event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-lg border border-dashed border-[var(--color-primary)]/50 p-3">
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]"><ImagePlus size={17} />{t.progressPhotos} *</span>
          <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">{t.progressHelp}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setProgressPhotos(Array.from(event.target.files || []))} className="mt-2 block w-full text-xs text-[var(--color-text-secondary)] file:mr-2 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-white" />
          {progressPhotos.length > 0 && <span className="mt-2 block text-xs text-emerald-600">{progressPhotos.length} {isCn ? '张照片' : 'photo(s)'}</span>}
        </label>
        <label className="rounded-lg border border-dashed border-[var(--color-border)] p-3">
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]"><ShieldCheck size={17} />{t.internalPhotos}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setInternalPhotos(Array.from(event.target.files || []))} className="mt-3 block w-full text-xs text-[var(--color-text-secondary)] file:mr-2 file:rounded-md file:border-0 file:bg-[var(--color-border-strong)] file:px-3 file:py-2 file:text-[var(--color-text-primary)]" />
        </label>
      </div>

      <button type="button" onClick={submit} disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
        {submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        {submitting ? t.submitting : t.submitReport}
      </button>
    </section>
  );
}

function ExtensionForm({ workOrderId, isCn, pending, onSaved, onBusyChange }) {
  const t = isCn ? COPY.cn : COPY.en;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    reason: '',
    customer_explanation: '',
    requested_additional_days: '1',
    proposed_completion_date: '',
    internal_note: '',
  });

  useEffect(() => {
    onBusyChange?.(submitting);
    return () => onBusyChange?.(false);
  }, [onBusyChange, submitting]);

  if (pending) {
    return <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">{t.extensionPending}</p>;
  }

  const submit = async () => {
    if (!form.reason.trim() || !form.customer_explanation.trim()
      || !form.proposed_completion_date || Number(form.requested_additional_days) < 1) {
      toastWarning(t.required);
      return;
    }
    setSubmitting(true);
    try {
      await requestFieldExtension(workOrderId, {
        ...form,
        requested_additional_days: Number(form.requested_additional_days),
      });
    } catch (error) {
      toastError(error.message || t.loadFailed);
      return;
    } finally {
      setSubmitting(false);
    }
    setOpen(false);
    toastSuccess(t.extensionSuccess);
    await bestEffortRefresh(onSaved, t.savedRefreshFailed);
  };

  return (
    <section className="border-t border-[var(--color-border)] pt-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-[var(--color-primary)] hover:underline">{t.extension}</button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t.extension}</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close extension form" className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"><X size={17} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionReason} *</span><textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
            <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionCustomer} *</span><textarea value={form.customer_explanation} onChange={(event) => setForm({ ...form, customer_explanation: event.target.value })} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
            <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionDays} *</span><input type="number" min="1" max="365" value={form.requested_additional_days} onChange={(event) => setForm({ ...form, requested_additional_days: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
            <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionDate} *</span><input type="date" value={form.proposed_completion_date} onChange={(event) => setForm({ ...form, proposed_completion_date: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.extensionInternal}</span><input value={form.internal_note} onChange={(event) => setForm({ ...form, internal_note: event.target.value })} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
          </div>
          <button type="button" onClick={submit} disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] disabled:opacity-50">
            {submitting && <Loader2 size={16} className="animate-spin" />}{t.requestExtension}
          </button>
        </div>
      )}
    </section>
  );
}

export function FieldWorkPanel({ workOrderId, detail, userType, userId, onChanged, onBusyChange }) {
  const isCn = isCnLocale();
  const t = isCn ? COPY.cn : COPY.en;
  const isEngineer = userType === 'engineer';
  const isCustomer = userType === 'customer';
  const isAssignedEngineer = isEngineer && String(detail?.engineer_id || '') === String(userId || '');
  const [fieldDays, setFieldDays] = useState(() => normalizeFieldDays(detail?.field_days || []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [expectedCheckoutTime, setExpectedCheckoutTime] = useState(detail?.field_plan?.planned_daily_end_time || '17:00');
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [legacyArrivalSubmitting, setLegacyArrivalSubmitting] = useState(false);
  const [selectedOverdueId, setSelectedOverdueId] = useState('');
  const [busyChildren, setBusyChildren] = useState({});
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  const cameraRequestRef = useRef(0);
  const captureRequestRef = useRef(0);
  const checkInRetryRef = useRef(null);
  const panelBusy = checkInSubmitting || legacyArrivalSubmitting || Object.values(busyChildren).some(Boolean);
  const fieldPlan = detail?.field_plan || {};
  const hasCompletePlan = Boolean(fieldPlan.site_timezone
    && fieldPlan.expected_service_days
    && fieldPlan.expected_completion_date);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) setCameraReady(false);
  }, []);

  useEffect(() => {
    onBusyChange?.(panelBusy);
  }, [onBusyChange, panelBusy]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cameraRequestRef.current += 1;
      captureRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const loadFieldDays = useCallback(async ({ throwOnError = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const data = await getFieldDays(workOrderId);
      setFieldDays(normalizeFieldDays(data.field_days || [], data.media || []));
    } catch (loadError) {
      setError(loadError.message || t.loadFailed);
      if (throwOnError) throw loadError;
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed, workOrderId]);

  useEffect(() => {
    setFieldDays(normalizeFieldDays(detail?.field_days || []));
    loadFieldDays();
  }, [detail?.field_days, loadFieldDays]);

  const refresh = useCallback(async () => {
    await loadFieldDays({ throwOnError: true });
    await onChanged?.();
  }, [loadFieldDays, onChanged]);

  const today = siteToday(fieldPlan.site_timezone);
  const todayFieldDay = fieldDays.find((day) => day.site_local_date === today
    && String(day.engineer_id) === String(userId));
  const openDays = fieldDays.filter((day) => String(day.engineer_id) === String(userId)
    && ['checked_in', 'report_overdue'].includes(day.status));
  const todayReportDay = todayFieldDay?.status === 'checked_in' ? todayFieldDay : null;
  const overdueDays = openDays.filter((day) => day.status === 'report_overdue');
  const selectedOverdueDay = overdueDays.find((day) => day.id === selectedOverdueId) || overdueDays[0];
  const pendingExtension = (detail?.pending_extension_requests || []).length > 0;
  const setChildBusy = useCallback((key, busy) => {
    setBusyChildren((current) => ({ ...current, [key]: busy }));
  }, []);
  const handleTodayReportBusy = useCallback((busy) => setChildBusy('today-report', busy), [setChildBusy]);
  const handleOverdueReportBusy = useCallback((busy) => setChildBusy('overdue-report', busy), [setChildBusy]);
  const handleStandaloneExtensionBusy = useCallback((busy) => setChildBusy('standalone-extension', busy), [setChildBusy]);

  const startCamera = async () => {
    setCameraOpen(true);
    setCameraError('');
    setCapturedPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview('');
    stopCamera();
    const requestId = cameraRequestRef.current += 1;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!mountedRef.current || requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!mountedRef.current || requestId !== cameraRequestRef.current) {
        stopCamera();
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (mountedRef.current && requestId === cameraRequestRef.current) setCameraReady(true);
      }
    } catch {
      if (!mountedRef.current || requestId !== cameraRequestRef.current) return;
      stopCamera();
      setCameraError(t.cameraUnavailable);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const requestId = captureRequestRef.current += 1;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const latePreview = URL.createObjectURL(blob);
      if (!mountedRef.current || requestId !== captureRequestRef.current) {
        URL.revokeObjectURL(latePreview);
        return;
      }
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setCapturedPhoto(blob);
      setPhotoPreview(latePreview);
      checkInRetryRef.current = null;
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const submitCheckIn = async () => {
    if (!capturedPhoto || !expectedCheckoutTime) return;
    if (!checkInRetryRef.current) checkInRetryRef.current = operationKey(`field-check-in-${workOrderId}`);
    setCheckInSubmitting(true);
    try {
      const locationPromise = getBrowserLocation().catch(() => null);
      const position = await Promise.race([
        locationPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      const location = position ? {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
        coordinate_system: 'wgs84',
        location_source: 'browser',
      } : { location_status: 'unavailable' };

      await checkInFieldDay(workOrderId, {
        photo: capturedPhoto,
        expectedCheckoutTime,
        location,
      }, checkInRetryRef.current);
    } catch (submitError) {
      toastError(submitError.message || t.loadFailed);
      return;
    } finally {
      setCheckInSubmitting(false);
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setCapturedPhoto(null);
    setPhotoPreview('');
    setCameraOpen(false);
    checkInRetryRef.current = null;
    toastSuccess(t.checkInSuccess);
    await bestEffortRefresh(refresh, t.savedRefreshFailed);
  };

  const handleLegacyArrivalCheck = async () => {
    setLegacyArrivalSubmitting(true);
    try {
      const { coords } = await getBrowserLocation();
      await checkInWorkOrder(workOrderId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_m: coords.accuracy,
        coordinate_system: 'wgs84',
        location_source: 'browser',
      });
      toastSuccess(t.legacySuccess);
      await refresh();
    } catch (arrivalError) {
      toastError(arrivalError.message || t.loadFailed);
    } finally {
      setLegacyArrivalSubmitting(false);
    }
  };

  const timelineDays = useMemo(
    () => (isCustomer ? fieldDays.map(customerTimelineDay) : fieldDays),
    [fieldDays, isCustomer],
  );

  return (
    <div className="space-y-5">
      <section className="border-b border-[var(--color-border)] pb-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays size={18} className="text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t.plan}</h3>
        </div>
        {hasCompletePlan ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div><span className="block text-xs text-[var(--color-text-muted)]">{t.days}</span><span className="text-[var(--color-text-primary)]">{fieldPlan.expected_service_days}</span></div>
            <div><span className="block text-xs text-[var(--color-text-muted)]">{t.completion}</span><span className="text-[var(--color-text-primary)]">{fieldPlan.expected_completion_date}</span></div>
            <div><span className="block text-xs text-[var(--color-text-muted)]">{t.timezone}</span><span className="break-all text-[var(--color-text-primary)]">{fieldPlan.site_timezone}</span></div>
            <div><span className="block text-xs text-[var(--color-text-muted)]">{t.schedule}</span><span className="text-[var(--color-text-primary)]">{fieldPlan.planned_daily_start_time || '-'} - {fieldPlan.planned_daily_end_time || '-'}</span></div>
          </div>
        ) : (
          <p className="text-sm text-amber-700">{t.noPlan}</p>
        )}
        {isCustomer && fieldPlan.expected_completion_date && (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">{t.revisedCompletion}: {fieldPlan.expected_completion_date}</p>
        )}
      </section>

      {isAssignedEngineer && !hasCompletePlan
        && detail?.status === 'in_service'
        && detail?.arrival_verification_required
        && !detail?.arrival_verified_at && (
        <section className="space-y-3 border-b border-[var(--color-border)] pb-4">
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{t.legacyHelp}</p>
          <button type="button" onClick={handleLegacyArrivalCheck} disabled={legacyArrivalSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] disabled:opacity-50">
            {legacyArrivalSubmitting ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            {legacyArrivalSubmitting ? t.legacyChecking : t.legacyCheckIn}
          </button>
        </section>
      )}

      {isAssignedEngineer && detail?.status === 'in_service' && hasCompletePlan && !todayFieldDay && (
        <section data-field-work-check-in className="space-y-3 border-b border-[var(--color-border)] pb-5">
          {!cameraOpen ? (
            <button type="button" onClick={startCamera} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]">
              <Camera size={18} />{t.startCheckIn}
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t.cameraTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{t.cameraHelp}</p>
              </div>
              {!capturedPhoto && (
                <div className="overflow-hidden rounded-lg bg-black">
                  <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
                </div>
              )}
              {photoPreview && <img src={photoPreview} alt={t.cameraTitle} className="aspect-[4/3] w-full rounded-lg border border-[var(--color-border)] object-cover" />}
              {cameraError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{cameraError}</p>}
              {!capturedPhoto && !cameraError && (
                <button type="button" onClick={capturePhoto} disabled={!cameraReady} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] disabled:opacity-50"><Camera size={17} />{t.capture}</button>
              )}
              {cameraError && <button type="button" onClick={startCamera} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm"><RefreshCw size={17} />{t.startCamera}</button>}
              {capturedPhoto && (
                <>
                  <label><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{t.checkout}</span><input type="time" value={expectedCheckoutTime} onChange={(event) => setExpectedCheckoutTime(event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
                  <p className="flex items-start gap-2 text-xs leading-5 text-[var(--color-text-secondary)]"><MapPin size={15} className="mt-0.5 shrink-0" />{t.locationOptional}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={startCamera} disabled={checkInSubmitting} className="rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]">{t.retake}</button>
                    <button type="button" onClick={submitCheckIn} disabled={checkInSubmitting || !expectedCheckoutTime} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50">{checkInSubmitting && <Loader2 size={16} className="animate-spin" />}{checkInSubmitting ? t.checkingIn : t.checkIn}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <div data-field-work-report />

      {isAssignedEngineer && detail?.status === 'in_service' && todayFieldDay?.status === 'checked_in' && (
        <p className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-700"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{t.checkedIn}</p>
      )}

      {isAssignedEngineer && todayReportDay && (
        <ReportForm
          workOrderId={workOrderId}
          fieldDay={todayReportDay}
          isCn={isCn}
          extensionPending={pendingExtension}
          onSaved={refresh}
          onBusyChange={handleTodayReportBusy}
        />
      )}

      {isAssignedEngineer && overdueDays.length > 0 && (
        <section data-field-work-overdue className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <FileWarning size={17} />{t.completeOverdue}
          </div>
          {overdueDays.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {overdueDays.map((day) => (
                <button key={day.id} type="button" onClick={() => setSelectedOverdueId(day.id)} className={`rounded-md border px-3 py-1.5 text-xs ${selectedOverdueDay?.id === day.id ? 'border-amber-600 text-amber-700' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>{day.site_local_date}</button>
              ))}
            </div>
          )}
          {selectedOverdueDay && <ReportForm workOrderId={workOrderId} fieldDay={selectedOverdueDay} isCn={isCn} extensionPending={pendingExtension} onSaved={refresh} onBusyChange={handleOverdueReportBusy} />}
        </section>
      )}

      {isAssignedEngineer && detail?.status === 'in_service' && hasCompletePlan && (
        <ExtensionForm workOrderId={workOrderId} isCn={isCn} pending={pendingExtension} onSaved={refresh} onBusyChange={handleStandaloneExtensionBusy} />
      )}

      {(isCustomer || isAssignedEngineer) && (detail?.field_extension_requests || []).length > 0 && (
        <section className="border-t border-[var(--color-border)] pt-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">{t.extensionHistory}</h3>
          <div className="space-y-2">
            {detail.field_extension_requests.map((extension, index) => (
              <div key={`${extension.decided_at || extension.proposed_completion_date}-${index}`} className="border-l-2 border-[var(--color-border-strong)] pl-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[var(--color-text-primary)]">{extension.customer_explanation}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{extension.status}</span>
                </div>
                {extension.status === 'approved' && (() => {
                  const approvedCompletion = approvedCompletionDate(extension);
                  return approvedCompletion ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t.revisedCompletion}: {approvedCompletion}</p> : null;
                })()}
                {extension.status !== 'approved' && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t.proposedCompletion}: {extension.proposed_completion_date}</p>}
                {extension.status === 'rejected' && extension.decision_reason && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t.decisionReason}: {extension.decision_reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t.timeline}</h3>
          <button type="button" onClick={loadFieldDays} disabled={loading} title={t.reload} aria-label={t.reload} className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        {loading && fieldDays.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">{t.loading}</p>}
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
        {!loading && !error && timelineDays.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">{t.empty}</p>}
        <div className="space-y-3">
          {timelineDays.map((day) => {
            const visibleMedia = (day.media || []).filter((item) => (isCustomer ? item.customer_visible : true));
            return (
              <article key={day.id} className="border-l-2 border-[var(--color-border-strong)] pl-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{day.site_local_date}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(day.status)}`}>{fieldDayStatusLabel(day.status, isCn)}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDateTime(day.check_in_at, isCn)}</p>
                {day.status === 'report_overdue' && isCustomer && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700"><strong>{t.customerOverdue}</strong><br />{t.customerOverdueHelp}</p>}
                {day.completed_work && (
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-[var(--color-text-muted)]">{t.completedWork}</dt><dd className="mt-1 whitespace-pre-wrap text-[var(--color-text-primary)]">{day.completed_work}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-muted)]">{t.issues}</dt><dd className="mt-1 whitespace-pre-wrap text-[var(--color-text-primary)]">{day.issues_risks}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-muted)]">{t.nextPlan}</dt><dd className="mt-1 whitespace-pre-wrap text-[var(--color-text-primary)]">{day.next_plan}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-muted)]">{t.customerSupport}</dt><dd className="mt-1 whitespace-pre-wrap text-[var(--color-text-primary)]">{day.customer_support_needed}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-muted)]">{t.labor}</dt><dd className="mt-1 text-[var(--color-text-primary)]">{day.labor_hours || '-'}</dd></div>
                  </dl>
                )}
                {!isCustomer && day.internal_note && <p className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 text-xs text-[var(--color-text-secondary)]"><strong>{t.internal}:</strong> {day.internal_note}</p>}
                {!isCustomer && day.location_status && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{day.location_status === 'verified' ? t.locationVerified : day.location_status === 'outside_geofence' ? t.locationOutside : t.locationUnavailable}</p>}
                {visibleMedia.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs text-[var(--color-text-muted)]">{t.protectedMedia}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {visibleMedia.map((media) => <FieldMedia key={media.id} workOrderId={workOrderId} media={media} label={`${day.site_local_date} ${media.purpose}`} />)}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {isEngineer && <p className="rounded-lg bg-[var(--color-surface-elevated)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">{t.finalHint}</p>}
    </div>
  );
}
