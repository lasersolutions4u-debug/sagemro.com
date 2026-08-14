import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileClock,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  approveAdminKnowledgeCandidate,
  getAdminKnowledgeCandidate,
  getAdminKnowledgeCandidates,
  rejectAdminKnowledgeCandidate,
  requestAdminKnowledgeCandidateChanges,
  submitAdminKnowledgeCandidateReview,
  updateAdminKnowledgeCandidateEditorial,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';

// TESTABLE_HELPERS_START
const STATUS_LABELS = {
  en: {
    awaiting_operations: 'Awaiting operations',
    operations_editing: 'Operations editing',
    awaiting_technical_review: 'Awaiting technical review',
    changes_requested: 'Changes requested',
    approved: 'Approved · article draft',
    retrieval_testing: 'Retrieval testing',
    ai_active: 'AI active',
    rejected: 'Rejected',
    archived: 'Archived',
  },
  'zh-CN': {
    awaiting_operations: '等待运营处理',
    operations_editing: '运营编辑中',
    awaiting_technical_review: '等待技术复核',
    changes_requested: '已要求修改',
    approved: '已批准·文章草稿',
    retrieval_testing: '检索测试中',
    ai_active: 'AI 已启用',
    rejected: '已拒绝',
    archived: '已归档',
  },
};

const CATEGORY_LABELS = {
  en: { fault: 'Equipment fault', cutting_parameters: 'Cutting parameters', parts: 'Parts', maintenance: 'Maintenance', machine_selection: 'Machine selection', health: 'Equipment health', safety: 'Safety', other: 'Other' },
  'zh-CN': { fault: '设备故障', cutting_parameters: '切割参数', parts: '配件', maintenance: '维护保养', machine_selection: '设备选型', health: '设备健康', safety: '安全', other: '其他' },
};

const RISK_LABELS = {
  en: { low: 'Low risk', medium: 'Medium risk', high: 'High risk' },
  'zh-CN': { low: '低风险', medium: '中风险', high: '高风险' },
};

const ACTION_LABELS = {
  en: { created: 'Candidate created', customer_confirmed_candidate: 'Customer confirmed evidence', editorial: 'Editorial update', save: 'Save sanitized draft', submit_review: 'Submit for technical review', request_changes: 'Request changes', approve: 'Approve to article draft', reject: 'Reject candidate' },
  'zh-CN': { created: '创建候选', customer_confirmed_candidate: '客户确认证据', editorial: '运营编辑', save: '保存脱敏草稿', submit_review: '提交技术复核', request_changes: '要求修改', approve: '批准生成文章草稿', reject: '拒绝候选' },
};

Object.assign(ACTION_LABELS.en, {
  candidate_created: 'Candidate created',
  admin_created_candidate: 'Administrator created candidate',
  unknown: 'Unknown workflow event',
});
Object.assign(ACTION_LABELS['zh-CN'], {
  candidate_created: '创建知识候选',
  admin_created_candidate: '管理员创建知识候选',
  unknown: '未知流程事件',
});

const ERROR_LABELS = {
  en: {
    sensitive_content_detected: 'Sensitive customer or commercial information was detected. Remove it before continuing.',
    required_field: 'Complete the required field.',
    invalid_field: 'This field is invalid.',
    field_too_long: 'This field is too long.',
    unsupported_field: 'This field cannot be changed.',
    invalid_payload: 'The draft data is invalid. Refresh and try again.',
    no_editorial_fields: 'No editable draft fields were provided.',
    invalid_notes: 'Review notes must be text.',
    notes_required: 'Review notes are required.',
    notes_too_long: 'Review notes are too long.',
    invalid_transition: 'This action is no longer valid for the candidate status. Refresh the queue.',
    candidate_changed: 'Another reviewer changed this candidate. Refresh before continuing.',
    forbidden: 'You do not have permission for this action.',
    self_review_forbidden: 'The contributing engineer cannot approve this high-risk knowledge candidate.',
    knowledge_article_source_conflict: 'The target knowledge article is linked to another source. Approval was stopped.',
    knowledge_candidate_not_found: 'The candidate was not found.',
    knowledge_candidate_operation_failed: 'The candidate operation failed. Try again.',
    unable_to_list_knowledge_candidates: 'Unable to load the candidate queue. Try again.',
    invalid_status: 'The selected candidate status is invalid.',
    invalid_pagination: 'The requested page is invalid.',
    invalid_page: 'The requested page is invalid.',
    invalid_page_size: 'The requested page size is invalid.',
  },
  'zh-CN': {
    sensitive_content_detected: '检测到客户或商业敏感信息，请删除后再继续。',
    required_field: '请填写必填字段。',
    invalid_field: '此字段内容无效。',
    field_too_long: '此字段内容过长。',
    unsupported_field: '此字段不允许修改。',
    invalid_payload: '草稿数据无效，请刷新后重试。',
    no_editorial_fields: '没有可保存的草稿字段。',
    invalid_notes: '复核说明必须为文本。',
    notes_required: '必须填写复核说明。',
    notes_too_long: '复核说明过长。',
    invalid_transition: '候选状态已变化，此操作不再适用，请刷新列表。',
    candidate_changed: '其他审核人员已修改此候选，请刷新后继续。',
    forbidden: '当前账号没有执行此操作的权限。',
    self_review_forbidden: '贡献工程师不能批准自己提交的高风险知识候选。',
    knowledge_article_source_conflict: '目标知识文章已关联其他来源，批准操作已停止。',
    knowledge_candidate_not_found: '未找到该知识候选。',
    knowledge_candidate_operation_failed: '知识候选操作失败，请重试。',
    unable_to_list_knowledge_candidates: '无法加载知识候选列表，请重试。',
    invalid_status: '所选知识候选状态无效。',
    invalid_pagination: '请求的分页参数无效。',
    invalid_page: '请求的页码无效。',
    invalid_page_size: '请求的每页数量无效。',
  },
};

export function candidateStatusLabel(status, locale = 'en') {
  return STATUS_LABELS[locale]?.[status] || STATUS_LABELS.en[status] || status || '—';
}

export function candidateCategoryLabel(category, locale = 'en') {
  return CATEGORY_LABELS[locale]?.[category] || CATEGORY_LABELS.en[category] || category || '—';
}

export function candidateRiskLabel(risk, locale = 'en') {
  return RISK_LABELS[locale]?.[risk] || RISK_LABELS.en[risk] || risk || '—';
}

export function candidateActionLabel(action, locale = 'en') {
  return ACTION_LABELS[locale]?.[action] || ACTION_LABELS.en[action] || ACTION_LABELS[locale]?.unknown || ACTION_LABELS.en.unknown;
}

export function createLatestRequestCoordinator() {
  let latest = 0;
  return {
    begin() { latest += 1; return latest; },
    isLatest(token) { return token === latest; },
    invalidate() { latest += 1; },
  };
}

export function createSelectionGuard(initialId = '') {
  let selectedId = initialId;
  return {
    select(id) { selectedId = id; },
    capture() { return selectedId; },
    isCurrent(id) { return id === selectedId; },
  };
}

export function focusTrapTargetIndex(currentIndex, count, shiftKey) {
  if (count < 1) return -1;
  if (currentIndex < 0) return shiftKey ? count - 1 : 0;
  if (shiftKey && currentIndex === 0) return count - 1;
  if (!shiftKey && currentIndex === count - 1) return 0;
  return null;
}

export function candidateActions(status) {
  if (status === 'awaiting_operations') return ['save', 'reject'];
  if (status === 'operations_editing' || status === 'changes_requested') return ['save', 'submit_review', 'reject'];
  if (status === 'awaiting_technical_review') return ['request_changes', 'approve', 'reject'];
  return [];
}

export function mapCandidateError(error, locale = 'en') {
  const code = error?.message || 'knowledge_candidate_operation_failed';
  const message = ERROR_LABELS[locale]?.[code] || ERROR_LABELS.en[code] || code;
  const fields = Array.isArray(error?.fields)
    ? error.fields
    : error?.field
      ? [error.field]
      : [];
  return { message, fields };
}

export function buildEditorialPayload(form) {
  const alarmCodes = String(form.alarm_codes_text || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item, index, list) => item && list.indexOf(item) === index);
  return {
    title: String(form.title || '').trim(),
    category: form.category,
    sanitized_content: String(form.sanitized_content || '').trim(),
    equipment_type: String(form.equipment_type || '').trim(),
    brand: String(form.brand || '').trim(),
    model: String(form.model || '').trim(),
    alarm_codes_json: alarmCodes,
    risk_level: form.risk_level,
    evidence_notes: String(form.evidence_notes || '').trim(),
    internal_use_allowed: Boolean(form.internal_use_allowed),
    public_use_allowed: Boolean(form.public_use_allowed),
  };
}

export async function submitCandidateReviewWorkflow({ id, form, notes, save, submit }) {
  const saved = await save(id, buildEditorialPayload(form));
  const trimmedNotes = String(notes || '').trim();
  return submit(saved.candidate.id, trimmedNotes ? { notes: trimmedNotes } : {});
}

export function queueStartMessage(message, preserveMessage = false) {
  return preserveMessage ? message : '';
}
// TESTABLE_HELPERS_END

const CATEGORIES = ['fault', 'cutting_parameters', 'parts', 'maintenance', 'machine_selection', 'health', 'safety', 'other'];
const RISKS = ['low', 'medium', 'high'];
const STATUSES = ['all', ...Object.keys(STATUS_LABELS.en)];
const PAGE_SIZE = 20;

const COPY = {
  en: {
    eyebrow: 'Evidence review desk',
    title: 'Knowledge Candidates',
    subtitle: 'Turn verified service evidence into reviewed knowledge without exposing customer or commercial data.',
    roleNotice: 'Phase 1 permission note: the current administrator currently has both operations and technical review permissions. Independent reviewer roles are not implemented yet.',
    privacyNotice: 'Never include customer contact details, addresses, identities, or prices in the sanitized draft. Automatic redaction reduces exposure but still requires human review.',
    filter: 'Candidate status', all: 'All statuses', refresh: 'Refresh', loading: 'Loading candidates…', loadingDetail: 'Loading candidate details…', empty: 'No candidates in this status.',
    original: 'Original service facts', draft: 'Sanitized knowledge draft', source: 'Source', contributor: 'Contributor engineer', owner: 'Operations owner', reviewer: 'Technical reviewer', events: 'Review history', evidence: 'Evidence', workOrder: 'Source work order', customerActor: 'Customer', systemActor: 'System',
    select: 'Select a candidate to inspect service facts and edit the sanitized draft.', updated: 'Updated', category: 'Category', equipment: 'Equipment', brand: 'Brand', model: 'Model', risk: 'Risk', titleLabel: 'Title', content: 'Knowledge content', alarm: 'Alarm codes', evidenceNotes: 'Evidence notes', internal: 'Allow internal use', public: 'Allow public use', publicHelp: 'Off by default. Approval does not change this setting or publish content.',
    save: 'Save sanitized draft', saving: 'Saving…', submit_review: 'Submit for technical review', request_changes: 'Request changes', approve: 'Approve to article draft', reject: 'Reject candidate',
    saveScope: 'Saves only the editable sanitized fields. Original service facts are never overwritten.', saved: 'Sanitized draft saved.', actionDone: 'Workflow status updated.',
    previous: 'Previous', next: 'Next', page: (page, pages) => `Page ${page} of ${pages}`,
    confirmTitle: 'Confirm workflow action', notes: 'Review notes', notesOptional: 'Optional for submission', notesRequired: 'Required for this action', cancel: 'Cancel', confirm: 'Confirm action',
    approveWarning: 'Approval creates a draft knowledge article. It does not publish the article and does not make it immediately available to AI retrieval.',
    approveConfirm: 'I understand this creates a draft knowledge article only.',
    genericConfirm: 'This changes the candidate workflow status and records an audit event.',
  },
  'zh-CN': {
    eyebrow: '证据审核台',
    title: '知识候选',
    subtitle: '把已验证的服务事实转为经过审核的知识，同时避免泄露客户和商业信息。',
    roleNotice: '第一阶段权限说明：当前管理员暂时兼具运营编辑和技术复核权限，尚未实现独立的审核岗位隔离。',
    privacyNotice: '脱敏知识稿不得包含客户联系方式、地址、身份信息或价格。自动遮蔽仍需人工检查。',
    filter: '候选状态', all: '全部状态', refresh: '刷新', loading: '正在加载知识候选…', loadingDetail: '正在加载候选详情…', empty: '当前状态下没有知识候选。',
    original: '原始服务事实', draft: '脱敏知识稿', source: '来源', contributor: '贡献工程师', owner: '运营负责人', reviewer: '技术复核人', events: '审核记录', evidence: '证据', workOrder: '来源工单', customerActor: '客户', systemActor: '系统',
    select: '请选择一个知识候选，核对服务事实并编辑脱敏知识稿。', updated: '更新时间', category: '分类', equipment: '设备', brand: '品牌', model: '型号', risk: '风险', titleLabel: '标题', content: '知识内容', alarm: '报警代码', evidenceNotes: '证据说明', internal: '允许内部使用', public: '允许公开使用', publicHelp: '默认关闭。批准不会改变此设置，也不会发布内容。',
    save: '保存脱敏草稿', saving: '保存中…', submit_review: '提交技术复核', request_changes: '要求修改', approve: '批准生成文章草稿', reject: '拒绝候选',
    saveScope: '仅保存右侧可编辑的脱敏字段，绝不会覆盖原始服务事实。', saved: '脱敏草稿已保存。', actionDone: '流程状态已更新。',
    previous: '上一页', next: '下一页', page: (page, pages) => `第 ${page} / ${pages} 页`,
    confirmTitle: '确认流程操作', notes: '复核说明', notesOptional: '提交复核时可选', notesRequired: '此操作必须填写', cancel: '取消', confirm: '确认执行',
    approveWarning: '批准只会生成知识文章草稿，不会发布，也不会立即用于 AI 检索。',
    approveConfirm: '我已了解：本次仅生成知识文章草稿。',
    genericConfirm: '此操作会变更候选流程状态，并记录审核事件。',
  },
};

function parseAlarmCodes(value) {
  if (Array.isArray(value)) return value.join(', ');
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    return '';
  }
}

function candidateToForm(candidate) {
  return {
    title: candidate.title || '', category: candidate.category || 'other',
    sanitized_content: candidate.sanitized_content || '', equipment_type: candidate.equipment_type || '',
    brand: candidate.brand || '', model: candidate.model || '',
    alarm_codes_text: parseAlarmCodes(candidate.alarm_codes_json), risk_level: candidate.risk_level || 'medium',
    evidence_notes: candidate.evidence_notes || '', internal_use_allowed: Boolean(candidate.internal_use_allowed),
    public_use_allowed: Boolean(candidate.public_use_allowed),
  };
}

function statusTone(status) {
  if (status === 'approved' || status === 'ai_active') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (status === 'rejected' || status === 'changes_requested') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (status === 'awaiting_technical_review') return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

function eventActorLabel(event, t) {
  if (event.actor_type === 'customer') return t.customerActor;
  if (event.actor_type === 'system') return t.systemActor;
  if ((event.actor_type === 'admin' || event.actor_type === 'engineer') && event.actor_user_id) {
    return `${event.actor_type} · ${event.actor_user_id}`;
  }
  return event.actor_type || '—';
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function KnowledgeCandidatesPage() {
  const locale = runtimeConfig.locale === 'zh-CN' ? 'zh-CN' : 'en';
  const t = COPY[locale];
  const [queue, setQueue] = useState({ total: 0, list: [] });
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState('');
  const [notes, setNotes] = useState('');
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const queueAbortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const latestQueueRef = useRef(createLatestRequestCoordinator());
  const latestDetailRef = useRef(createLatestRequestCoordinator());
  const selectedIdRef = useRef('');
  const writeInFlightRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(queue.total / PAGE_SIZE));

  const loadQueue = useCallback(async (preserveMessage = false) => {
    queueAbortRef.current?.abort();
    const controller = new AbortController();
    queueAbortRef.current = controller;
    const requestToken = latestQueueRef.current.begin();
    setLoading(true);
    setMessage((current) => queueStartMessage(current, preserveMessage));
    try {
      const result = await getAdminKnowledgeCandidates(page, PAGE_SIZE, status, { signal: controller.signal });
      if (!latestQueueRef.current.isLatest(requestToken)) return;
      setQueue(result);
      if (selectedIdRef.current && !result.list.some((item) => item.id === selectedIdRef.current)) {
        selectedIdRef.current = '';
        setSelectedId(''); setDetail(null); setForm(null); setDetailLoading(false);
      }
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError' || !latestQueueRef.current.isLatest(requestToken)) return;
      setMessage(mapCandidateError(error, locale).message);
    } finally {
      if (latestQueueRef.current.isLatest(requestToken)) setLoading(false);
    }
  }, [locale, page, status]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const loadDetail = useCallback(async (id, preserveMessage = false) => {
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const requestToken = latestDetailRef.current.begin();
    selectedIdRef.current = id;
    setSelectedId(id); setDetail(null); setForm(null);
    setDetailLoading(true);
    setMessage((current) => queueStartMessage(current, preserveMessage)); setFieldErrors({});
    try {
      const result = await getAdminKnowledgeCandidate(id, { signal: controller.signal });
      if (!latestDetailRef.current.isLatest(requestToken) || selectedIdRef.current !== id) return;
      setDetail(result); setForm(candidateToForm(result.candidate));
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError' || !latestDetailRef.current.isLatest(requestToken)) return;
      setMessage(mapCandidateError(error, locale).message);
    } finally {
      if (latestDetailRef.current.isLatest(requestToken) && selectedIdRef.current === id) setDetailLoading(false);
    }
  }, [locale]);

  useEffect(() => () => {
    queueAbortRef.current?.abort();
    detailAbortRef.current?.abort();
    latestQueueRef.current.invalidate();
    latestDetailRef.current.invalidate();
  }, []);

  const reportError = (error) => {
    const mapped = mapCandidateError(error, locale);
    setMessage(mapped.message);
    setFieldErrors(Object.fromEntries(mapped.fields.map((field) => [field, mapped.message])));
  };

  const saveEditorial = async ({ quiet = false } = {}) => {
    if (!detail || !form || writeInFlightRef.current) return null;
    const capturedId = detail.candidate.id;
    writeInFlightRef.current = true;
    setBusy(true); setMessage(''); setFieldErrors({});
    try {
      const result = await updateAdminKnowledgeCandidateEditorial(capturedId, buildEditorialPayload(form));
      if (selectedIdRef.current === capturedId) {
        setDetail((current) => current ? ({ ...current, candidate: result.candidate }) : current);
        setForm(candidateToForm(result.candidate));
        if (!quiet) setMessage(t.saved);
      }
      await loadQueue(true);
      return result.candidate;
    } catch (error) {
      if (selectedIdRef.current === capturedId) reportError(error);
      return null;
    } finally {
      writeInFlightRef.current = false;
      setBusy(false);
    }
  };

  const openConfirm = (action) => {
    previousFocusRef.current = document.activeElement;
    setNotes(''); setConfirmAction(action);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
  };

  const closeConfirm = useCallback(() => {
    if (busy) return;
    setConfirmAction('');
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, [busy]);

  useEffect(() => {
    if (!confirmAction) return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), textarea:not([disabled])') || []);
    if (busy || focusable.length === 0) dialogRef.current?.focus();
    else if (!dialogRef.current?.contains(document.activeElement)) focusable[0]?.focus();
  }, [confirmAction, busy]);

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeConfirm(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), textarea:not([disabled])') || []);
    const currentIndex = focusable.indexOf(document.activeElement);
    const targetIndex = focusTrapTargetIndex(currentIndex, focusable.length, event.shiftKey);
    if (targetIndex === -1) { event.preventDefault(); dialogRef.current?.focus(); }
    else if (targetIndex !== null) { event.preventDefault(); focusable[targetIndex]?.focus(); }
  };

  const runAction = async () => {
    if (!detail || busy || writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    const capturedId = detail.candidate.id;
    const action = confirmAction;
    setBusy(true); setMessage(''); setFieldErrors({});
    try {
      let result;
      if (action === 'submit_review') {
        result = await submitCandidateReviewWorkflow({
          id: capturedId,
          form,
          notes,
          save: updateAdminKnowledgeCandidateEditorial,
          submit: submitAdminKnowledgeCandidateReview,
        });
      } else if (action === 'request_changes') {
        result = await requestAdminKnowledgeCandidateChanges(capturedId, notes.trim());
      } else if (action === 'approve') {
        result = await approveAdminKnowledgeCandidate(capturedId, notes.trim());
      } else if (action === 'reject') {
        result = await rejectAdminKnowledgeCandidate(capturedId, notes.trim());
      }
      if (selectedIdRef.current === capturedId) {
        setConfirmAction(''); setNotes(''); setMessage(t.actionDone);
        window.setTimeout(() => previousFocusRef.current?.focus(), 0);
      }
      await loadQueue(true);
      if (selectedIdRef.current === capturedId) await loadDetail(capturedId, true);
    } catch (error) {
      if (selectedIdRef.current === capturedId) reportError(error);
    } finally {
      writeInFlightRef.current = false;
      setBusy(false);
    }
  };

  const actions = useMemo(() => candidateActions(detail?.candidate?.status), [detail]);
  const editable = actions.includes('save');
  const inputClass = (field) => `w-full rounded-md border bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)] ${fieldErrors[field] ? 'border-red-400' : 'border-[var(--color-border)]'}`;
  const fieldProps = (field) => ({
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[var(--color-primary)]"><ClipboardCheck size={18} /><span className="text-xs font-semibold uppercase tracking-[0.18em]">{t.eyebrow}</span></div>
          <h2 className="text-xl font-semibold">{t.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">{t.subtitle}</p>
        </div>
        <div className="flex items-end gap-2">
          <label htmlFor="candidate-status" className="text-xs font-medium text-[var(--color-text-secondary)]">
            {t.filter}
            <select id="candidate-status" value={status} disabled={busy} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1 block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm disabled:opacity-50">
              {STATUSES.map((item) => <option key={item} value={item}>{item === 'all' ? t.all : candidateStatusLabel(item, locale)}</option>)}
            </select>
          </label>
          <button type="button" onClick={loadQueue} disabled={loading || busy} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] px-3 text-sm disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />{t.refresh}</button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100"><ShieldAlert size={19} className="mt-0.5 shrink-0" /><span>{t.roleNotice}</span></div>
        <div className="flex gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"><AlertTriangle size={19} className="mt-0.5 shrink-0" /><span>{t.privacyNotice}</span></div>
      </div>

      {message && <div role="status" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm">{message}</div>}

      <section className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[var(--color-surface-elevated)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]"><tr>
              <th className="px-3 py-3">{t.title}</th><th className="px-3 py-3">{t.category}</th><th className="px-3 py-3">{t.equipment}</th><th className="px-3 py-3">{t.contributor}</th><th className="px-3 py-3">{t.workOrder}</th><th className="px-3 py-3">{t.risk}</th><th className="px-3 py-3">{t.updated}</th><th className="px-3 py-3">{t.owner}</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="px-4 py-10 text-center text-[var(--color-text-muted)]">{t.loading}</td></tr>
                : queue.list.length === 0 ? <tr><td colSpan="8" className="px-4 py-10 text-center text-[var(--color-text-muted)]">{t.empty}</td></tr>
                  : queue.list.map((item) => <tr key={item.id} className={`border-t border-[var(--color-border)]/70 hover:bg-[var(--color-surface-elevated)] ${selectedId === item.id ? 'bg-[var(--color-primary)]/10' : ''}`}>
                    <td className="max-w-[260px] p-0"><button type="button" aria-label={`${t.title}: ${item.title || item.id}`} disabled={busy} onClick={() => loadDetail(item.id)} className="w-full px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"><div className="truncate font-medium">{item.title || item.id}</div><span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] ${statusTone(item.status)}`}>{candidateStatusLabel(item.status, locale)}</span></button></td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">{candidateCategoryLabel(item.category, locale)}</td><td className="px-3 py-3 text-[var(--color-text-secondary)]">{[item.equipment_type, item.brand, item.model].filter(Boolean).join(' · ') || '—'}</td><td className="px-3 py-3 font-mono text-xs">{item.contributor_engineer_id || '—'}</td><td className="px-3 py-3 font-mono text-xs">{item.source_work_order_id || '—'}</td><td className="px-3 py-3">{candidateRiskLabel(item.risk_level, locale)}</td><td className="px-3 py-3 text-xs text-[var(--color-text-muted)]">{item.updated_at || '—'}</td><td className="px-3 py-3 font-mono text-xs text-[var(--color-text-muted)]">{item.operations_owner_id || '—'}</td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading || busy} className="inline-flex items-center gap-1 rounded px-2 py-1 disabled:opacity-40"><ChevronLeft size={14} />{t.previous}</button>
          <span>{t.page(page, totalPages)}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading || busy} className="inline-flex items-center gap-1 rounded px-2 py-1 disabled:opacity-40">{t.next}<ChevronRight size={14} /></button>
        </div>
      </section>

      {!detail || !form ? <div className="rounded-md border border-dashed border-[var(--color-border)] py-16 text-center text-sm text-[var(--color-text-muted)]"><FileClock className="mx-auto mb-3" size={28} />{detailLoading ? t.loadingDetail : t.select}</div> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-4 py-3"><h3 className="font-semibold">{t.original}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.privacyNotice}</p></div>
            <div className="space-y-5 p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.source}</dt><dd>{detail.candidate.source_type || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.workOrder}</dt><dd className="font-mono text-xs">{detail.candidate.source_work_order_id || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.contributor}</dt><dd className="font-mono text-xs">{detail.candidate.contributor_engineer_id || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.owner}</dt><dd className="font-mono text-xs">{detail.candidate.operations_owner_id || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.reviewer}</dt><dd className="font-mono text-xs">{detail.candidate.technical_reviewer_id || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.evidence}</dt><dd>{detail.candidate.evidence_type || '—'}</dd></div>
                <div><dt className="text-xs text-[var(--color-text-muted)]">{t.updated}</dt><dd className="text-xs">{detail.candidate.updated_at || '—'}</dd></div>
              </dl>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-xs leading-6 text-[var(--color-text-secondary)]">{detail.candidate.safe_raw_content}</pre>
              <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{t.events}</h4><ol className="space-y-2 border-l border-[var(--color-border)] pl-4">
                {(detail.events || []).map((event) => <li key={event.id} className="text-xs"><div className="font-medium">{candidateActionLabel(event.action, locale)}: {candidateStatusLabel(event.from_status, locale)} → {candidateStatusLabel(event.to_status, locale)}</div><div className="mt-0.5 text-[var(--color-text-muted)]">{eventActorLabel(event, t)} · {event.created_at || '—'}</div>{event.notes && <p className="mt-1 text-[var(--color-text-secondary)]">{event.notes}</p>}</li>)}
              </ol></div>
            </div>
          </section>

          <section className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3"><div><h3 className="font-semibold">{t.draft}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.saveScope}</p></div><span className={`rounded border px-2 py-1 text-xs ${statusTone(detail.candidate.status)}`}>{candidateStatusLabel(detail.candidate.status, locale)}</span></div>
            <div className="grid gap-4 p-4">
              <Field id="title" label={t.titleLabel} error={fieldErrors.title}><input id="title" value={form.title} disabled={!editable || busy} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass('title')} {...fieldProps('title')} /></Field>
              <div className="grid gap-3 sm:grid-cols-2"><Field id="category" label={t.category} error={fieldErrors.category}><select id="category" value={form.category} disabled={!editable || busy} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass('category')} {...fieldProps('category')}>{CATEGORIES.map((item) => <option key={item} value={item}>{candidateCategoryLabel(item, locale)}</option>)}</select></Field><Field id="risk_level" label={t.risk} error={fieldErrors.risk_level}><select id="risk_level" value={form.risk_level} disabled={!editable || busy} onChange={(e) => setForm({ ...form, risk_level: e.target.value })} className={inputClass('risk_level')} {...fieldProps('risk_level')}>{RISKS.map((item) => <option key={item} value={item}>{candidateRiskLabel(item, locale)}</option>)}</select></Field></div>
              <Field id="sanitized_content" label={t.content} error={fieldErrors.sanitized_content}><textarea id="sanitized_content" rows="12" value={form.sanitized_content} disabled={!editable || busy} onChange={(e) => setForm({ ...form, sanitized_content: e.target.value })} className={`${inputClass('sanitized_content')} resize-y leading-6`} {...fieldProps('sanitized_content')} /></Field>
              <div className="grid gap-3 sm:grid-cols-3"><Field id="equipment_type" label={t.equipment} error={fieldErrors.equipment_type}><input id="equipment_type" value={form.equipment_type} disabled={!editable || busy} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} className={inputClass('equipment_type')} {...fieldProps('equipment_type')} /></Field><Field id="brand" label={t.brand} error={fieldErrors.brand}><input id="brand" value={form.brand} disabled={!editable || busy} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputClass('brand')} {...fieldProps('brand')} /></Field><Field id="model" label={t.model} error={fieldErrors.model}><input id="model" value={form.model} disabled={!editable || busy} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputClass('model')} {...fieldProps('model')} /></Field></div>
              <Field id="alarm_codes_json" label={t.alarm} error={fieldErrors.alarm_codes_json}><input id="alarm_codes_json" value={form.alarm_codes_text} disabled={!editable || busy} onChange={(e) => setForm({ ...form, alarm_codes_text: e.target.value })} className={inputClass('alarm_codes_json')} {...fieldProps('alarm_codes_json')} /></Field>
              <Field id="evidence_notes" label={t.evidenceNotes} error={fieldErrors.evidence_notes}><textarea id="evidence_notes" rows="4" value={form.evidence_notes} disabled={!editable || busy} onChange={(e) => setForm({ ...form, evidence_notes: e.target.value })} className={`${inputClass('evidence_notes')} resize-y`} {...fieldProps('evidence_notes')} /></Field>
              <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-2 rounded-md border border-[var(--color-border)] p-3 text-sm"><input type="checkbox" checked={form.internal_use_allowed} disabled={!editable || busy} onChange={(e) => setForm({ ...form, internal_use_allowed: e.target.checked })} className="mt-0.5" /><span>{t.internal}</span></label><label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><input type="checkbox" checked={form.public_use_allowed} disabled={!editable || busy} onChange={(e) => setForm({ ...form, public_use_allowed: e.target.checked })} className="mt-0.5" /><span>{t.public}<small className="mt-1 block text-[var(--color-text-muted)]">{t.publicHelp}</small></span></label></div>
              {actions.length > 0 && <div className="border-t border-[var(--color-border)] pt-4"><p className="mb-3 text-xs text-[var(--color-text-muted)]">{t.saveScope}</p><div className="flex flex-wrap gap-2">
                {actions.includes('save') && <button type="button" onClick={() => saveEditorial()} disabled={busy} className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium disabled:opacity-50">{busy ? t.saving : t.save}</button>}
                {actions.filter((action) => action !== 'save').map((action) => <button key={action} type="button" onClick={() => openConfirm(action)} disabled={busy} className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${action === 'approve' ? 'bg-green-600 text-white' : action === 'reject' ? 'border border-red-500/50 text-red-200' : 'bg-[var(--color-primary)] text-white'}`}>{candidateActionLabel(action, locale)}</button>)}
              </div></div>}
            </div>
          </section>
        </div>
      )}

      {confirmAction && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="candidate-confirm-title" tabIndex="-1" onKeyDown={handleDialogKeyDown} className="w-full max-w-lg rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3"><h3 id="candidate-confirm-title" className="font-semibold">{t.confirmTitle}</h3><button ref={closeButtonRef} type="button" aria-label={t.cancel} disabled={busy} onClick={closeConfirm} className="flex h-8 w-8 items-center justify-center rounded border border-[var(--color-border)]"><X size={15} /></button></div>
          <div className="space-y-4 p-4"><div className={`flex gap-3 rounded-md border px-3 py-3 text-sm leading-6 ${confirmAction === 'approve' ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}>{confirmAction === 'approve' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <FileClock size={18} className="mt-0.5 shrink-0" />}<span>{confirmAction === 'approve' ? t.approveWarning : t.genericConfirm}</span></div>
            <label htmlFor="review-notes" className="block text-xs font-medium text-[var(--color-text-secondary)]">{t.notes} · {confirmAction === 'submit_review' ? t.notesOptional : t.notesRequired}<textarea id="review-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows="4" disabled={busy} className="mt-1 w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" /></label>
            {confirmAction === 'approve' && <p className="text-xs font-medium text-amber-200">{t.approveConfirm}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3"><button type="button" disabled={busy} onClick={closeConfirm} className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">{t.cancel}</button><button type="button" onClick={runAction} disabled={busy || (confirmAction !== 'submit_review' && !notes.trim())} className="rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? t.saving : t.confirm}</button></div>
        </div>
      </div>}
    </div>
  );
}
