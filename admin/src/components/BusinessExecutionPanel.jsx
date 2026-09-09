import { useEffect, useRef, useState } from 'react';
import { useAdminLocale } from '../config/locale';
import { assignBusinessExecution, getBusinessExecution, getBusinessOrganization } from '../services/api';
import { formatApiDateTime } from '../utils/dateTime';

const TEXT = {
  en: {
    title: 'Service execution assignment', refresh: 'Refresh assignment', loading: 'Loading assignment…',
    policy: 'The business owner and service executor are separate roles. Only Admin assigns execution after required receipts are verified; no engineer account is created.',
    phase: 'After assignment, the assigned business staff member uses Business service execution below. Starting service still requires Admin approval.',
    executor: 'Service executor', reason: 'Assignment reason (e.g. no local partner engineer)', choose: 'Choose a business staff member…',
    assign: 'Assign business executor', assigned: 'Business executor assigned', when: 'Assigned at', by: 'Assigned by',
    retry: 'If the outcome is uncertain, retry without changing the form. The same request reference is kept until you leave this view.',
    changed: 'Your account or access scope changed, or this assignment is outdated. Close and reopen this order.',
    admin_required: 'Only Admin can assign the service executor.', customer_confirmation_required: 'The customer must confirm the business quote first.',
    payment_required: 'Required pre-start payments have not all been verified.', engineer_assigned: 'This order already has an engineer or regional lead assigned.',
    already_assigned: 'A business executor has already been assigned.', work_order_state_invalid: 'The current order state does not allow assignment.',
    no_eligible_staff: 'No active business staff member has access to this order. Check staff authorization and territory coverage.',
    execution_data_invalid: 'Assignment or payment data requires Admin review before continuing.',
  },
  'zh-CN': {
    title: '服务执行指派', refresh: '刷新执行状态', loading: '加载执行状态…',
    policy: '商务负责人和实际服务执行人分开记录。仅 Admin 可在开工前应付款确认到账后指定商务承接，不创建工程师账号。',
    phase: '指派后，由实际承接的商务人员在下方“商务服务执行”中处理服务；开工仍须 Admin 审批。',
    executor: '实际服务执行人', reason: '承接原因（当地无合作工程师等）', choose: '请选择商务人员…',
    assign: '指定商务承接', assigned: '已指定商务承接', when: '指派时间', by: '指派人',
    retry: '若结果不确定，请保持表单不变重试；离开当前页面前会沿用同一请求编号。',
    changed: '账号或权限范围已变化，或指派信息已过期，请关闭并重新打开工单。',
    admin_required: '仅 Admin 可以指定实际服务执行人。', customer_confirmation_required: '请先由客户确认商务报价。',
    payment_required: '开工前应付款尚未全部确认到账。', engineer_assigned: '此工单已指定工程师或区域主管，不能重复指派。',
    already_assigned: '此工单已指定商务承接。', work_order_state_invalid: '当前工单状态不允许指派执行人。',
    no_eligible_staff: '暂无具备此工单查看权限的在职商务人员，请检查人员授权和辖区配置。',
    execution_data_invalid: '指派或付款数据需要 Admin 核查后才能继续。',
  },
};
const buttonClass = 'rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-40';
const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm';
function savedIdentity() {
  try {
    const user = JSON.parse(localStorage.getItem('admin_user'));
    const role = user?.staffRole, id = user?.staffId || (role === 'admin' ? 'admin' : null);
    return id && ['admin', 'business_director', 'business_manager', 'business_specialist'].includes(role) ? { id, role } : null;
  } catch { return null; }
}

export function BusinessExecutionPanel({ workOrderId, readOnly = false, expectedStaffId, scopeVersion, isCurrent, onAccessError }) {
  const locale = useAdminLocale();
  const t = TEXT[locale] || TEXT.en;
  const [identity] = useState(savedIdentity);
  const [state, setState] = useState(null), [executor, setExecutor] = useState(''), [reason, setReason] = useState('');
  const [pending, setPending] = useState('load'), [error, setError] = useState(''), [blocked, setBlocked] = useState(false);
  const generation = useRef(0), controller = useRef(null), busy = useRef(false), requestKey = useRef(null);
  const accessError = useRef(onAccessError); accessError.current = onAccessError;
  function current() {
    const saved = savedIdentity();
    return identity && saved?.id === identity.id && saved.role === identity.role && (!expectedStaffId || identity.id === expectedStaffId) && (!isCurrent || isCurrent());
  }
  function clearForm() { setExecutor(''); setReason(''); requestKey.current = null; }
  function fail(err) {
    if ([401, 403, 404, 409].includes(err.status)) {
      setState(null); clearForm(); setBlocked(true); setError(t.changed); accessError.current?.(err, 'detail');
    } else setError(err.message);
  }
  function verify(data, scope) {
    if (!current() || data.scope_version !== scope) throw Object.assign(new Error(t.changed), { status: 403 });
    if (!Number.isInteger(data.revision) || !Number.isInteger(data.quote_version) || !Array.isArray(data.candidates)) throw new Error(t.execution_data_invalid);
  }
  useEffect(() => {
    const id = ++generation.current, abort = new AbortController(); controller.current = abort;
    setState(null); clearForm(); setBlocked(false); setError(''); setPending('load'); busy.current = true;
    const check = () => {
      if (!current()) { generation.current++; controller.current?.abort(); setState(null); clearForm(); setBlocked(true); setPending(''); setError(t.changed); }
    };
    window.addEventListener('storage', check); window.addEventListener('focus', check);
    (async () => {
      try {
        if (!current()) throw Object.assign(new Error(t.changed), { status: 403 });
        const scope = scopeVersion || (await getBusinessOrganization(identity.id, abort.signal)).scope_version;
        if (id !== generation.current || abort.signal.aborted) return;
        if (!current() || !scope) throw Object.assign(new Error(t.changed), { status: 403 });
        const data = await getBusinessExecution(workOrderId, identity.id, scope, abort.signal);
        if (id !== generation.current || abort.signal.aborted) return;
        verify(data, scope); setState(data);
      } catch (err) { if (err.name !== 'AbortError' && id === generation.current) fail(err); }
      finally { if (id === generation.current) { setPending(''); busy.current = false; } }
    })();
    return () => { generation.current++; controller.current?.abort(); window.removeEventListener('storage', check); window.removeEventListener('focus', check); };
  }, [workOrderId, expectedStaffId, scopeVersion, isCurrent]);

  const canAssign = !readOnly && identity?.role === 'admin' && state?.can_assign === true && !state.execution;
  async function perform(action) {
    if (busy.current || blocked) return;
    if (action === 'assign' && (!canAssign || !state.candidates.some(row => row.id === executor) || !reason.trim())) return;
    busy.current = true; setPending(action); setError('');
    const id = generation.current, abort = new AbortController(); controller.current = abort;
    try {
      if (!current()) throw Object.assign(new Error(t.changed), { status: 403 });
      const scope = scopeVersion || state?.scope_version || (await getBusinessOrganization(identity.id, abort.signal)).scope_version;
      if (id !== generation.current || abort.signal.aborted) return;
      if (!current() || !scope) throw Object.assign(new Error(t.changed), { status: 403 });
      let data;
      if (action === 'assign') {
        requestKey.current ||= crypto.randomUUID();
        data = await assignBusinessExecution(workOrderId, { expected_staff_id: identity.id, scope_version: scope,
          quote_version: state.quote_version, revision: state.revision, executor_staff_id: executor,
          reason: reason.trim(), idempotency_key: requestKey.current }, abort.signal);
      } else data = await getBusinessExecution(workOrderId, identity.id, scope, abort.signal);
      if (id !== generation.current || abort.signal.aborted) return;
      verify(data, scope); setState(data);
      if (action === 'assign' || data.revision !== state?.revision || data.quote_version !== state?.quote_version) clearForm();
    } catch (err) { if (err.name !== 'AbortError' && id === generation.current) fail(err); }
    finally { if (id === generation.current) { busy.current = false; setPending(''); } }
  }
  const execution = state?.execution;
  return <section aria-label={t.title} className="mt-5 min-w-0 space-y-4 border-t border-[var(--color-border)] pt-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{t.title}</h3><button type="button" className={buttonClass} disabled={!!pending || blocked} onClick={() => perform('refresh')}>{t.refresh}</button></header>
    <p className="text-xs text-[var(--color-text-muted)]">{t.policy}</p>
    {error && <p role="alert" className="break-words text-sm text-amber-500">{error}</p>}
    {pending === 'load' && <p role="status" className="text-sm">{t.loading}</p>}
    {state && !blocked && <>
      {execution ? <div className="min-w-0 border-l-4 border-[var(--color-primary)] bg-[var(--color-primary)]/10 p-3">
        <p role="status" className="text-sm font-semibold">{t.assigned}</p>
        <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--color-text-muted)]">{t.executor}</dt><dd className="break-words">{execution.staff_name}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">{t.when}</dt><dd>{formatApiDateTime(execution.assigned_at, locale)}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">{t.by}</dt><dd className="break-words">{execution.assigned_by}</dd></div><div><dt className="text-xs text-[var(--color-text-muted)]">{t.reason}</dt><dd className="whitespace-pre-wrap break-words">{execution.reason}</dd></div></dl>
      </div> : !canAssign && <p className="text-sm text-[var(--color-text-muted)]">{readOnly ? t.admin_required : t[state.blocked_reason] || t.execution_data_invalid}</p>}
      {canAssign && <form onSubmit={event => { event.preventDefault(); perform('assign'); }}><fieldset disabled={!!pending} className="min-w-0 space-y-3">
        <label className="block text-sm">{t.executor}<select aria-label={t.executor} className={inputClass} value={executor} onChange={event => { setExecutor(event.target.value); requestKey.current = null; }}><option value="">{t.choose}</option>{state.candidates.map(row => <option key={row.id} value={row.id}>{row.display_name}</option>)}</select></label>
        <label className="block text-sm">{t.reason}<textarea className={inputClass} autoComplete="off" maxLength={500} value={reason} onChange={event => { setReason(event.target.value); requestKey.current = null; }} /></label>
        <button type="submit" disabled={!executor || !reason.trim()} className={`${buttonClass} bg-[var(--color-primary)] text-white`}>{t.assign}</button>
      </fieldset><p className="mt-2 text-xs text-[var(--color-text-muted)]">{t.retry}</p></form>}
      <p className="text-xs text-[var(--color-text-muted)]">{t.phase}</p>
    </>}
  </section>;
}
