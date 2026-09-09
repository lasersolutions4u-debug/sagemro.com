import { useEffect, useRef, useState } from 'react';
import { useAdminLocale, getAdminLocale } from '../config/locale';
import { getBusinessPayments, startBusinessCollection, submitBusinessReceipt } from '../services/api';

const TEXT = {
  en: {
    title: 'Business payments', policy: 'Submit receipts here without assigning an engineer. Only Admin verifies money received. Dispatch and service-start approval remain separate.',
    refresh: 'Refresh payments', loading: 'Loading payments…', waiting: 'Collection becomes available after the customer confirms the business quote.',
    received: 'Verified receipts', outstanding: 'Remaining balance', ready: 'Pre-start payment requirements met', notReady: 'Pre-start payment requirements not yet met',
    installment: 'Installment', required: 'Required before start', start: 'Start installment collection', submit: 'Submit receipt for review', working: 'Processing…',
    amount: 'Receipt amount to verify', reference: 'Transaction reference', note: 'Internal receipt note', evidence: 'Receipt evidence (optional)',
    fileHelp: 'Images or PDF, up to 10 MB. Internal notes are not shown to customers.', milestone: 'Milestone confirmation',
    invalid: 'Enter a positive whole amount no greater than the remaining installment balance.', fileInvalid: 'Use a supported image or PDF no larger than 10 MB.',
    pending: 'Awaiting Admin verification', confirmed: 'Admin verified', rejected: 'Returned for correction',
    changed: 'Your account, access scope or payment data changed. Close and reopen this order.',
    retry: 'If the outcome is uncertain, retry the same receipt unchanged; its request reference is retained until you leave this view.',
    started: 'Collection opened', sent: 'Receipt submitted; the amount is not counted as received until Admin verifies it.',
    refreshFailed: 'The action succeeded, but payment details could not refresh. Refresh before continuing.', history: 'Receipt review history',
    not_due: 'Not yet due', collectible: 'Ready to collect', collecting: 'Collecting', partially_received: 'Partially verified', pending_confirmation: 'Receipt under review',
    scheduled: 'Scheduled', due: 'Due for collection', exception: 'Needs review',
    overdue: 'Overdue', settled: 'Paid', before_start: 'Before start', on_arrival: 'On arrival', milestone_trigger: 'Milestone', on_completion: 'On completion', on_acceptance: 'On acceptance', fixed_date: 'Specified date',
  },
  'zh-CN': {
    title: '商务收款', policy: '无需先派工程师即可提交收款记录。仅 Admin 确认实际到账；派单与批准开工仍分开处理。',
    refresh: '刷新收款信息', loading: '加载收款信息…', waiting: '客户确认商务报价后，才可按付款计划发起收款。',
    received: '已确认到账', outstanding: '待收余额', ready: '开工前付款条件已满足', notReady: '开工前付款条件尚未满足',
    installment: '付款期次', required: '开工前必付', start: '发起本期收款', submit: '提交到账审核', working: '处理中…',
    amount: '本次申请确认金额', reference: '交易流水号', note: '内部收款备注', evidence: '到账凭证（可选）',
    fileHelp: '支持图片或 PDF，最大 10 MB。内部备注不会展示给客户。', milestone: '里程碑完成说明',
    invalid: '请填写大于零且不超过本期待收余额的整数金额。', fileInvalid: '请使用支持的图片或 PDF，文件不可超过 10 MB。',
    pending: '待 Admin 确认', confirmed: 'Admin 已确认', rejected: '已退回修改',
    changed: '账号、授权范围或付款数据已变化，请关闭并重新打开工单。',
    retry: '若提交结果不确定，请保持内容不变重试；离开当前页面前会保留同一请求编号。',
    started: '已发起收款', sent: '收款记录已提交，Admin 确认前不会计入已到账金额。',
    refreshFailed: '操作已成功，但刷新收款信息失败。请刷新后继续。', history: '到账审核记录',
    not_due: '未到付款节点', collectible: '可发起收款', collecting: '收款中', partially_received: '部分到账', pending_confirmation: '到账审核中',
    scheduled: '已安排付款计划', due: '已到收款节点', exception: '异常待核查',
    overdue: '已逾期', settled: '已付清', before_start: '服务开始前', on_arrival: '到场时', milestone_trigger: '里程碑', on_completion: '服务完成时', on_acceptance: '验收时', fixed_date: '指定日期',
  },
};
const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm';
const buttonClass = 'rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-40';
const emptyForm = () => ({ amount: '', reference: '', note: '', evidence: null, milestone: '' });
const integer = value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const money = (value, currency) => Number.isFinite(value) ? `${value.toLocaleString(getAdminLocale())} ${currency}` : '—';
const blockedStatuses = [401, 403, 404, 409];
const fileTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function BusinessPaymentPanel({ workOrderId, expectedStaffId, scopeVersion, isCurrent, onAccessError }) {
  const locale = useAdminLocale();
  const t = TEXT[locale] || TEXT.en;
  const [state, setState] = useState(null), [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(''), [pending, setPending] = useState('load'), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [blocked, setBlocked] = useState(false), [fileKey, setFileKey] = useState(0);
  const generation = useRef(0), controller = useRef(null), busy = useRef(false), receiptKey = useRef(null);
  const accessError = useRef(onAccessError); accessError.current = onAccessError;
  function clearForm() { setForm(emptyForm()); setFileKey(key => key + 1); receiptKey.current = null; }
  function verify(data) {
    if (!isCurrent() || data.scope_version !== scopeVersion) throw Object.assign(new Error(t.changed), { status: 403 });
  }
  function fail(err) {
    if (blockedStatuses.includes(err.status)) {
      setState(null); clearForm(); setBlocked(true); setError(t.changed); accessError.current?.(err, 'detail');
    } else setError(err.message);
  }
  useEffect(() => {
    const id = ++generation.current, abort = new AbortController(); controller.current = abort;
    setState(null); setBlocked(false); setSelected(''); setError(''); setNotice(''); setPending('load'); clearForm(); busy.current = false;
    const check = () => {
      if (!isCurrent()) { generation.current++; controller.current?.abort(); setState(null); clearForm(); setBlocked(true); setError(t.changed); }
    };
    window.addEventListener('storage', check); window.addEventListener('focus', check);
    (async () => {
      try {
        if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
        const data = await getBusinessPayments(workOrderId, expectedStaffId, scopeVersion, abort.signal);
        if (id !== generation.current || abort.signal.aborted) return;
        verify(data); setState(data);
      } catch (err) { if (err.name !== 'AbortError' && id === generation.current) fail(err); }
      finally { if (id === generation.current) setPending(''); }
    })();
    return () => { generation.current++; controller.current?.abort(); window.removeEventListener('storage', check); window.removeEventListener('focus', check); };
  }, [workOrderId, expectedStaffId, scopeVersion, isCurrent]);

  async function perform(action, row) {
    if (busy.current || blocked) return;
    const amount = integer(form.amount);
    const fileValid = !form.evidence || (fileTypes.includes(form.evidence.type) && form.evidence.size > 0 && form.evidence.size <= 10 * 1024 * 1024);
    if (action === 'receipt' && (!row?.can_submit_receipt || !amount || amount > row.amount - row.received_amount || !fileValid)) return;
    if (action === 'start' && (!row?.can_start_collection || (row.trigger_type === 'milestone' && !form.milestone.trim()))) return;
    busy.current = true; setPending(action); setError(''); setNotice('');
    const id = generation.current, abort = new AbortController(); controller.current = abort;
    let succeeded = false;
    try {
      if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
      const context = { expected_staff_id: expectedStaffId, scope_version: scopeVersion, quote_version: state?.quote_version };
      if (action === 'start') await startBusinessCollection(workOrderId, row.id, { ...context, ...(row.trigger_type === 'milestone' ? { milestone_confirmation: form.milestone.trim() } : {}) }, abort.signal);
      if (action === 'receipt') {
        receiptKey.current ||= crypto.randomUUID();
        const body = new FormData();
        for (const [key, value] of Object.entries(context)) body.set(key, String(value));
        body.set('claimed_amount', String(amount)); body.set('idempotency_key', receiptKey.current);
        body.set('transaction_reference', form.reference); body.set('note', form.note);
        if (form.evidence) body.set('evidence', form.evidence);
        await submitBusinessReceipt(workOrderId, row.id, body, abort.signal);
      }
      if (id !== generation.current || abort.signal.aborted) return;
      if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
      succeeded = action !== 'refresh';
      if (succeeded) { clearForm(); setSelected(action === 'start' ? row.id : ''); setNotice(action === 'start' ? t.started : t.sent); }
      const data = await getBusinessPayments(workOrderId, expectedStaffId, scopeVersion, abort.signal);
      if (id !== generation.current || abort.signal.aborted) return;
      verify(data); setState(data);
    } catch (err) {
      if (err.name === 'AbortError' || id !== generation.current) return;
      if (succeeded && !blockedStatuses.includes(err.status)) { setState(null); setError(t.refreshFailed); }
      else fail(err);
    } finally { if (id === generation.current) { busy.current = false; setPending(''); } }
  }
  function edit(values) { setForm(current => ({ ...current, ...values })); receiptKey.current = null; setError(''); }
  const execution = state?.quote_execution;
  const selectedId = selected || execution?.installments?.find(row => row.can_submit_receipt)?.id;
  return <section aria-label={t.title} className="mt-5 min-w-0 space-y-4 border-t border-[var(--color-border)] pt-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{t.title}</h3><button type="button" className={buttonClass} disabled={!!pending || blocked} onClick={() => perform('refresh')}>{t.refresh}</button></header>
    <p className="text-xs text-[var(--color-text-muted)]">{t.policy}</p>
    {error && <p role="alert" className="break-words text-sm text-amber-500">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {pending === 'load' && <p role="status" className="text-sm">{t.loading}</p>}
    {state && !state.available && <p className="text-sm text-[var(--color-text-muted)]">{t.waiting}</p>}
    {state?.available && execution && !blocked && <>
      <div className="border-l-4 border-[var(--color-primary)] bg-[var(--color-primary)]/10 p-3"><dl className="grid grid-cols-2 gap-3"><div><dt className="text-xs">{t.received}</dt><dd className="font-semibold tabular-nums">{money(execution.received_amount, state.currency)}</dd></div><div><dt className="text-xs">{t.outstanding}</dt><dd className="font-semibold tabular-nums">{money(execution.outstanding_amount, state.currency)}</dd></div></dl><p className="mt-2 text-xs">{execution.start_ready ? t.ready : t.notReady}</p></div>
      {(execution.installments || []).map(row => {
        const active = selectedId === row.id;
        const amount = integer(form.amount), remaining = row.amount - row.received_amount;
        const invalidFile = form.evidence && (!fileTypes.includes(form.evidence.type) || !form.evidence.size || form.evidence.size > 10 * 1024 * 1024);
        return <article key={row.id} className="min-w-0 rounded-lg border border-[var(--color-border)] p-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><h4 className="font-medium">{t.installment} {row.sequence} · {money(row.amount, row.currency)}</h4><span>{row.status === 'received' ? t.settled : t[row.status] || row.status}</span></div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{row.trigger_type === 'milestone' ? t.milestone_trigger : t[row.trigger_type]}{row.required_before_start ? ` · ${t.required}` : ''}{row.due_date ? ` · ${row.due_date}` : ''}</p>
          {row.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.description}</p>}
          <p className="mt-2 text-xs">{t.received}: {money(row.received_amount, row.currency)} · {t.outstanding}: {money(remaining, row.currency)}</p>
          {row.can_start_collection && <div className="mt-3 space-y-2">{row.trigger_type === 'milestone' && <label className="block text-sm">{t.milestone}<textarea maxLength={500} className={inputClass} value={selected === row.id ? form.milestone : ''} onChange={event => { setSelected(row.id); edit({ milestone: event.target.value }); }} /></label>}<button type="button" disabled={!!pending || (row.trigger_type === 'milestone' && (selected !== row.id || !form.milestone.trim()))} className={buttonClass} onClick={() => perform('start', row)}>{t.start}</button></div>}
          {row.can_submit_receipt && !active && <button type="button" disabled={!!pending} className={`${buttonClass} mt-3`} onClick={() => { clearForm(); setSelected(row.id); }}>{t.submit}</button>}
          {row.can_submit_receipt && active && <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); perform('receipt', row); }}><fieldset disabled={!!pending} className="min-w-0 space-y-3">
            <label className="block text-sm">{t.amount}<input inputMode="numeric" autoComplete="off" className={inputClass} value={form.amount} onChange={event => { setSelected(row.id); edit({ amount: event.target.value }); }} /></label>
            <label className="block text-sm">{t.reference}<input maxLength={200} autoComplete="off" className={inputClass} value={form.reference} onChange={event => edit({ reference: event.target.value })} /></label>
            <label className="block text-sm">{t.note}<textarea maxLength={1000} autoComplete="off" className={inputClass} value={form.note} onChange={event => edit({ note: event.target.value })} /></label>
            <label className="block text-sm">{t.evidence}<input key={fileKey} type="file" accept={fileTypes.join(',')} className={`${inputClass} text-xs`} onChange={event => edit({ evidence: event.target.files?.[0] || null })} /></label>
            <p className="text-xs text-[var(--color-text-muted)]">{t.fileHelp}</p>
            {invalidFile && <p role="alert" className="text-xs text-amber-500">{t.fileInvalid}</p>}
            {form.amount && (!amount || amount > remaining) && <p className="text-xs text-amber-500">{t.invalid}</p>}
            <button disabled={!amount || amount > remaining || !!invalidFile} type="submit" className={`${buttonClass} bg-[var(--color-primary)] text-white`}>{pending === 'receipt' ? t.working : t.submit}</button>
          </fieldset><p className="text-xs text-[var(--color-text-muted)]">{t.retry}</p></form>}
        </article>;
      })}
      {!!execution.receipt_claims?.length && <div className="space-y-2"><h4 className="text-sm font-medium">{t.history}</h4>{execution.receipt_claims.map(claim => <article key={claim.id} className="border-l-2 border-[var(--color-border)] pl-3 text-sm"><p><span>{t[claim.status] || claim.status}</span> · {money(claim.claimed_amount, state.currency)}</p>{claim.confirmed_amount != null && <p className="text-xs">{t.received}: {money(claim.confirmed_amount, state.currency)}</p>}{claim.decision_reason && <p className="whitespace-pre-wrap break-words text-amber-500">{claim.decision_reason}</p>}{claim.evidence?.file_name && <p className="break-words text-xs">{claim.evidence.file_name}</p>}</article>)}</div>}
    </>}
  </section>;
}
