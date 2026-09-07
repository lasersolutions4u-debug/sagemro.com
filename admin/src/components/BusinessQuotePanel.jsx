import { useEffect, useRef, useState } from 'react';
import { runtimeConfig } from '../config/runtime';
import { getBusinessQuote, saveBusinessQuote, submitBusinessQuote } from '../services/api';
import { calculateBusinessQuoteEstimate } from '../../../worker/src/lib/businessQuoteEstimate';
import { validateQuoteExecution } from '../../../worker/src/lib/quoteExecution';

const FEES = ['labor_fee', 'parts_fee', 'travel_fee', 'other_fee'];
const COSTS = ['parts_cost', 'engineer_cost', 'travel_cost', 'other_cost'];
const TRIGGERS = ['before_start', 'on_arrival', 'milestone', 'on_completion', 'on_acceptance', 'fixed_date'];
const TEXT = {
  en: {
    title: 'Business quotation', customer: 'Customer quotation', private: 'Internal direct costs',
    note: 'Customer prices and costs use whole currency units. Costs are internal only; use the same currency throughout.',
    labor_fee: 'Customer labor fee', parts_fee: 'Customer parts fee', travel_fee: 'Customer travel fee', other_fee: 'Customer other fee',
    parts_cost: 'Parts procurement cost', engineer_cost: 'Engineer labor cost', travel_cost: 'Travel cost', other_cost: 'Other direct cost',
    costHelp: 'Leave unknown costs blank. Enter 0 only when no cost applies. All four costs must be confirmed before review.',
    profit: 'Estimated gross profit', margin: 'Gross margin', total: 'Customer quote total', costTotal: 'Total direct costs',
    formula: 'Quote total − parts − engineer labor − travel − other direct costs. Estimate only, not settled profit or compensation.',
    incomplete: 'Incomplete costs — profit not yet available', loss: 'Estimated loss. Check the price and costs before submitting.',
    days: 'Expected onsite days', partsDetail: 'Customer-visible quote notes', payment: 'Payment plan', single: 'Full payment before start', installments: 'Installments',
    add: 'Add installment', remove: 'Remove last installment', amount: 'Amount', trigger: 'Due at', description: 'Milestone / description', due: 'Due date', required: 'Required before start',
    before_start: 'Before start', on_arrival: 'On arrival', milestone: 'Milestone', on_completion: 'On completion', on_acceptance: 'On acceptance', fixed_date: 'Fixed date',
    save: 'Save quote draft', submit: 'Submit for Admin review', saving: 'Saving…', sending: 'Submitting…', loading: 'Loading quotation…', saved: 'Draft saved',
    dirty: 'Unsaved changes — save before submitting.', submitted: 'Awaiting Admin review', approved: 'Approved — awaiting customer confirmation', confirmed: 'Customer confirmed',
    adminFeedback: 'Admin requested changes', customerFeedback: 'Customer requested changes',
    policy: 'Only Admin can approve. Customers cannot see drafts or pending quotes. This does not dispatch an engineer.',
    locked: 'This quote cannot be edited here. Existing quotation and payment records are preserved.',
    changed: 'Quote, account or access scope changed. Close and reopen the order before continuing.',
    invalid: 'Use whole nonnegative amounts and a positive quote total. Check onsite days and installment totals.',
  },
  'zh-CN': {
    title: '商务报价', customer: '客户报价', private: '内部直接成本',
    note: '报价和成本均按整元填写，统一使用当前币种。内部成本不会展示给客户。',
    labor_fee: '客户人工费', parts_fee: '客户备件费', travel_fee: '客户差旅费', other_fee: '客户其他费用',
    parts_cost: '备件采购成本', engineer_cost: '工程师人工成本', travel_cost: '差旅成本', other_cost: '其他直接成本',
    costHelp: '尚不确定的成本留空，确认无此费用才填 0。四项成本确认完整后才能提交审核。',
    profit: '预计毛利润', margin: '毛利率', total: '客户报价总额', costTotal: '直接成本合计',
    formula: '报价总额 − 备件 − 工程师人工 − 差旅 − 其他直接成本。仅为估算，不等于结算利润或薪酬分红。',
    incomplete: '成本未完整确认，暂不显示利润', loss: '预计亏损，请核对报价与成本后再提交。',
    days: '预计现场天数', partsDetail: '客户可见的报价说明', payment: '付款计划', single: '服务前全额付款', installments: '分期付款',
    add: '增加一期', remove: '移除最后一期', amount: '金额', trigger: '付款节点', description: '里程碑／说明', due: '到期日期', required: '服务开始前必须到账',
    before_start: '服务开始前', on_arrival: '到场时', milestone: '里程碑', on_completion: '服务完成时', on_acceptance: '验收时', fixed_date: '指定日期',
    save: '保存报价草稿', submit: '提交 Admin 审核', saving: '保存中…', sending: '提交中…', loading: '加载报价中…', saved: '草稿已保存',
    dirty: '有未保存的修改，请先保存再提交审核。', submitted: '等待 Admin 审核', approved: '审核通过，等待客户确认', confirmed: '客户已确认',
    adminFeedback: 'Admin 退回说明', customerFeedback: '客户协商意见',
    policy: '仅 Admin 可批准报价。草稿和待审核报价对客户不可见；提交报价不代表派单给工程师。',
    locked: '此报价暂不可在此编辑，既有报价和收款记录保持不变。',
    changed: '报价、账号或授权范围已变化，请关闭并重新打开工单后继续。',
    invalid: '请填写非负整数金额，报价总额须大于零；同时核对现场天数和分期金额合计。',
  },
};
const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm disabled:opacity-60';
const buttonClass = 'rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-40';
const integer = value => /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const money = (value, currency) => value == null ? '—' : `${value.toLocaleString(runtimeConfig.locale)} ${currency}`;
const installment = sequence => ({ sequence, amount: '', trigger_type: sequence === 1 ? 'before_start' : 'on_completion', description: '', due_date: '', required_before_start: sequence === 1 });

function formFromDraft(draft) {
  return {
    ...Object.fromEntries(FEES.map(key => [key, draft?.[key] == null ? '' : String(draft[key])])),
    costs: Object.fromEntries(COSTS.map(key => [key, draft?.costs?.[key] == null ? '' : String(draft.costs[key])])),
    parts_detail: draft?.parts_detail || '', expected_service_days: draft?.expected_service_days == null ? '' : String(draft.expected_service_days),
    payment_plan_mode: draft?.payment_plan_mode || 'single',
    payment_schedule: (draft?.payment_schedule || []).map(row => ({ ...row, amount: String(row.amount), due_date: row.due_date || '' })),
  };
}

function normalizeForm(form, state) {
  const fees = Object.fromEntries(FEES.map(key => [key, integer(form[key])]));
  const costs = Object.fromEntries(COSTS.map(key => [key, form.costs[key] === '' ? null : integer(form.costs[key])]));
  if (FEES.some(key => fees[key] === null) || COSTS.some(key => form.costs[key] !== '' && costs[key] === null)) return null;
  const total = FEES.reduce((sum, key) => sum + fees[key], 0);
  const estimate = calculateBusinessQuoteEstimate({ currency: state.currency, quoted_amount: total, costs }).value;
  const terms = validateQuoteExecution({ currency: state.currency, total_amount: total, service_mode: state.service_mode,
    expected_service_days: integer(form.expected_service_days), payment_plan_mode: form.payment_plan_mode,
    payment_schedule: form.payment_schedule.map((row, i) => ({ ...row, sequence: i + 1, amount: integer(row.amount), currency: state.currency })) }).value;
  if (!estimate) return null;
  return { estimate, draft: terms ? { ...fees, costs, parts_detail: form.parts_detail, expected_service_days: terms.expected_service_days,
    payment_plan_mode: terms.payment_plan_mode, payment_schedule: terms.payment_schedule } : null };
}

export function BusinessQuotePanel({ workOrderId, expectedStaffId, scopeVersion, isCurrent, onAccessError }) {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [state, setState] = useState(null), [form, setForm] = useState(() => formFromDraft(null));
  const [pending, setPending] = useState('load'), [dirty, setDirty] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const controller = useRef(null), generation = useRef(0), busy = useRef(false);
  const accessError = useRef(onAccessError); accessError.current = onAccessError;
  useEffect(() => {
    const id = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    setPending('load'); setState(null); setForm(formFromDraft(null)); setError(''); setBlocked(false); setDirty(false); setNotice('');
    const check = () => { if (!isCurrent()) { abort.abort(); controller.current?.abort(); generation.current++; setState(null); setForm(formFromDraft(null)); setBlocked(true); setError(t.changed); } };
    window.addEventListener('storage', check); window.addEventListener('focus', check);
    (async () => {
      try {
        if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
        const data = await getBusinessQuote(workOrderId, expectedStaffId, scopeVersion, abort.signal);
        if (generation.current !== id || abort.signal.aborted) return;
        if (!isCurrent() || data.scope_version !== scopeVersion) throw Object.assign(new Error(t.changed), { status: 403 });
        setState(data); setForm(formFromDraft(data.draft));
      } catch (err) {
        if (err.name === 'AbortError' || generation.current !== id) return;
        setError(err.message); setBlocked(true);
        if ([401, 403, 404, 409].includes(err.status)) accessError.current?.(err, 'detail');
      } finally { if (generation.current === id) setPending(''); }
    })();
    return () => { generation.current++; abort.abort(); controller.current?.abort(); window.removeEventListener('storage', check); window.removeEventListener('focus', check); };
  }, [workOrderId, expectedStaffId, scopeVersion, isCurrent, t.changed]);
  const parsed = state ? normalizeForm(form, state) : null;
  const status = state?.latest_quote?.status;
  const feedback = state?.latest_quote?.feedback;
  const locked = blocked || !state || state.can_edit === false || ['pending_review', 'submitted', 'confirmed'].includes(status);
  const edit = change => { setForm(current => ({ ...current, ...change })); setDirty(true); setNotice(''); };
  async function perform(action) {
    if (busy.current || locked || !parsed?.draft || (action === 'submit' && (dirty || !state.draft || !parsed.estimate.complete || state.can_submit === false))) return;
    busy.current = true;
    const id = generation.current;
    const abort = new AbortController(); controller.current = abort;
    setPending(action); setError(''); setNotice('');
    try {
      if (!isCurrent()) throw Object.assign(new Error(t.changed), { status: 403 });
      const payload = { expected_staff_id: expectedStaffId, scope_version: scopeVersion, revision: state.revision };
      const result = action === 'save' ? await saveBusinessQuote(workOrderId, { ...payload, ...parsed.draft }, abort.signal) : await submitBusinessQuote(workOrderId, payload, abort.signal);
      if (id !== generation.current || abort.signal.aborted) return;
      if (!isCurrent() || result.scope_version !== scopeVersion) throw Object.assign(new Error(t.changed), { status: 403 });
      setState(result); setForm(formFromDraft(result.draft)); setDirty(false); setNotice(action === 'save' ? t.saved : '');
    } catch (err) {
      if (err.name === 'AbortError' || generation.current !== id) return;
      if ([401, 403, 404, 409].includes(err.status)) { setState(null); setForm(formFromDraft(null)); setBlocked(true); setError(t.changed); accessError.current?.(err, 'detail'); }
      else setError(err.message);
    } finally { busy.current = false; if (id === generation.current) setPending(''); }
  }
  const amountField = (key, cost = false) => <label key={key} className="block text-sm">{t[key]}<input aria-label={t[key]} inputMode="numeric" autoComplete="off" className={inputClass} value={cost ? form.costs[key] : form[key]} onChange={event => edit(cost ? { costs: { ...form.costs, [key]: event.target.value } } : { [key]: event.target.value })} /></label>;
  const estimate = parsed?.estimate;
  return <section className="mt-5 space-y-4 border-t border-[var(--color-border)] pt-5">
    <header><h3 className="font-semibold">{t.title}</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.note}</p></header>
    {error && <p role="alert" className="text-sm text-amber-500">{error}</p>}
    {pending === 'load' && <p role="status">{t.loading}</p>}
    {state && !blocked && <>
      {status && <p role="status" className="text-sm font-medium text-[var(--color-primary)]">{status === 'pending_review' ? t.submitted : status === 'submitted' ? t.approved : status === 'confirmed' ? t.confirmed : `V${state.latest_quote.quote_version}`}</p>}
      {status === 'draft' && feedback?.quote_version === state.latest_quote.quote_version && <aside className="border-l-2 border-amber-500 bg-amber-500/10 p-3"><h4 className="text-sm font-medium">{feedback.source === 'customer' ? t.customerFeedback : t.adminFeedback} · V{feedback.quote_version}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm">{feedback.message}</p></aside>}
      {locked && <p className="text-sm text-[var(--color-text-muted)]">{t.locked}</p>}
      <fieldset disabled={locked || !!pending} className="min-w-0 space-y-4">
        <legend className="mb-3 font-medium">{t.customer} · {state.currency}</legend>
        <div className="grid gap-3 sm:grid-cols-2">{FEES.map(key => amountField(key))}</div>
        <label className="block text-sm">{t.partsDetail}<textarea aria-label={t.partsDetail} maxLength={2000} className={inputClass} value={form.parts_detail} onChange={event => edit({ parts_detail: event.target.value })} /></label>
        {state.service_mode !== 'remote' && <label className="block text-sm">{t.days}<input aria-label={t.days} inputMode="numeric" className={inputClass} value={form.expected_service_days} onChange={event => edit({ expected_service_days: event.target.value })} /></label>}
        <label className="block text-sm">{t.payment}<select aria-label={t.payment} className={inputClass} value={form.payment_plan_mode} onChange={event => edit({ payment_plan_mode: event.target.value, payment_schedule: event.target.value === 'installments' && form.payment_schedule.length < 2 ? [installment(1), installment(2)] : form.payment_schedule })}><option value="single">{t.single}</option><option value="installments">{t.installments}</option></select></label>
        {form.payment_plan_mode === 'installments' && <div className="space-y-3">{form.payment_schedule.map((row, i) => {
          const change = values => edit({ payment_schedule: form.payment_schedule.map((item, index) => index === i ? { ...item, ...values } : item) });
          return <fieldset key={i} className="min-w-0 rounded-lg border border-[var(--color-border)] p-3"><legend className="px-1 text-sm">{i + 1}</legend><div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t.amount}<input aria-label={`${t.amount} ${i + 1}`} className={inputClass} inputMode="numeric" value={row.amount} onChange={event => change({ amount: event.target.value })} /></label>
            <label className="text-sm">{t.trigger}<select aria-label={`${t.trigger} ${i + 1}`} className={inputClass} value={row.trigger_type} onChange={event => change({ trigger_type: event.target.value, required_before_start: event.target.value === 'before_start' && row.required_before_start, due_date: '' })}>{TRIGGERS.map(trigger => <option key={trigger} value={trigger}>{t[trigger]}</option>)}</select></label>
            <label className="text-sm">{t.description}<input aria-label={`${t.description} ${i + 1}`} className={inputClass} maxLength={500} value={row.description} onChange={event => change({ description: event.target.value })} /></label>
            {row.trigger_type === 'fixed_date' && <label className="text-sm">{t.due}<input aria-label={`${t.due} ${i + 1}`} type="date" className={inputClass} value={row.due_date} onChange={event => change({ due_date: event.target.value })} /></label>}
          </div>{row.trigger_type === 'before_start' && <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={row.required_before_start} onChange={event => change({ required_before_start: event.target.checked })} />{t.required}</label>}</fieldset>;
        })}<div className="flex flex-wrap gap-2"><button type="button" disabled={form.payment_schedule.length >= 6} className={buttonClass} onClick={() => edit({ payment_schedule: [...form.payment_schedule, installment(form.payment_schedule.length + 1)] })}>{t.add}</button><button type="button" disabled={form.payment_schedule.length <= 2} className={buttonClass} onClick={() => edit({ payment_schedule: form.payment_schedule.slice(0, -1) })}>{t.remove}</button></div></div>}
      </fieldset>
      <fieldset disabled={locked || !!pending} className="min-w-0 border-t border-dashed border-[var(--color-border)] pt-4"><legend className="pr-2 font-medium">{t.private}</legend><p className="mb-3 text-xs text-[var(--color-text-muted)]">{t.costHelp}</p><div className="grid gap-3 sm:grid-cols-2">{COSTS.map(key => amountField(key, true))}</div></fieldset>
      <div data-testid="business-gross-profit" className="border-l-4 border-[var(--color-primary)] bg-[var(--color-primary)]/10 p-4">
        <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs">{t.total}</dt><dd className="font-semibold tabular-nums">{money(estimate?.quoted_amount, state.currency)}</dd></div><div><dt className="text-xs">{t.costTotal}</dt><dd className="tabular-nums">{money(estimate?.total_cost, state.currency)}</dd></div><div><dt className="text-sm">{t.profit}</dt><dd className="text-2xl font-semibold tabular-nums">{money(estimate?.estimated_gross_profit, state.currency)}</dd></div><div><dt className="text-xs">{t.margin}</dt><dd className="font-semibold tabular-nums">{estimate?.estimated_gross_margin_bps == null ? '—' : `${(estimate.estimated_gross_margin_bps / 100).toFixed(2)}%`}</dd></div></dl>
        {!estimate?.complete && <p className="mt-2 text-sm">{t.incomplete}</p>}{estimate?.estimated_gross_profit < 0 && <p role="alert" className="mt-2 text-sm text-amber-500">{t.loss}</p>}<p className="mt-3 text-xs text-[var(--color-text-muted)]">{t.formula}</p>
      </div>
      {!parsed?.draft && dirty && <p className="text-xs text-amber-500">{t.invalid}</p>}
      <p className="text-xs text-[var(--color-text-muted)]">{t.policy}</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={locked || !!pending || !parsed?.draft || !dirty} className={buttonClass} onClick={() => perform('save')}>{pending === 'save' ? t.saving : t.save}</button><button type="button" disabled={locked || !!pending || dirty || !state.draft || !parsed?.draft || !parsed?.estimate.complete || state.can_submit === false} className={`${buttonClass} bg-[var(--color-primary)] text-white`} onClick={() => perform('submit')}>{pending === 'submit' ? t.sending : t.submit}</button></div>
      <p role="status" className="text-xs text-[var(--color-text-muted)]">{dirty ? t.dirty : notice}</p>
    </>}
  </section>;
}
