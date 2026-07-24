import { useState } from 'react';
import { CheckCircle2, Clock3, FileUp, Loader2, ReceiptText, WalletCards } from 'lucide-react';
import { startInstallmentCollection, submitInstallmentReceiptClaim } from '../../services/api';
import { toastError, toastSuccess, toastWarning } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  en: {
    title: 'Collection workspace',
    summary: 'Payment schedule and confirmed receipts remain separate from service progress.',
    scheduled: 'Scheduled',
    received: 'Received',
    remaining: 'Remaining',
    total: 'Quote total',
    outstanding: 'Outstanding',
    installment: 'Installment',
    requiredBeforeStart: 'Required before service starts',
    dueDate: 'Due date',
    description: 'Payment term',
    start: 'Start this installment collection',
    starting: 'Starting...',
    chooseMethod: 'Choose payment method',
    waiting: 'Waiting for Admin confirmation',
    receivedReadOnly: 'Receipt confirmed. This installment is read-only.',
    legacyReadOnly: 'Historical payment record. Use the legacy payment flow for this work order.',
    claimTitle: 'Request receipt confirmation',
    claimAmount: 'Claimed amount',
    reference: 'Transaction reference (optional)',
    evidence: 'Evidence (optional JPG, PNG, or PDF)',
    note: 'Collection note (optional)',
    submitClaim: 'Request receipt confirmation',
    submittingClaim: 'Submitting...',
    amountInvalid: 'Enter a positive whole amount.',
    amountTooHigh: 'The claimed amount cannot exceed the installment balance.',
    evidenceInvalid: 'Evidence must be a JPG, PNG, or PDF file no larger than 10 MB.',
    started: 'Installment collection started.',
    claimSubmitted: 'Receipt claim submitted for Admin confirmation.',
    claimRefreshFailed: 'The receipt claim was submitted, but the latest work-order details could not be loaded. The submitted claim remains locked to prevent a duplicate. Refresh the work order to recover.',
    empty: 'No active payment schedule is available.',
    states: {
      scheduled: 'Scheduled', due: 'Due', collecting: 'Collecting', pending_confirmation: 'Pending confirmation',
      partially_received: 'Partially received', overdue: 'Overdue', received: 'Received', exception: 'Exception',
    },
    triggers: {
      before_start: 'Before service starts', on_arrival: 'On arrival', milestone: 'At agreed milestone',
      on_completion: 'On service completion', on_acceptance: 'On customer acceptance', fixed_date: 'On fixed date',
    },
  },
  cn: {
    title: '收款工作台',
    summary: '付款计划与确认到账独立于服务进度，未结清前可持续跟进。',
    scheduled: '计划金额',
    received: '已到账',
    remaining: '待到账',
    total: '报价总额',
    outstanding: '未结金额',
    installment: '第',
    requiredBeforeStart: '开工前必须到账',
    dueDate: '到期日期',
    description: '付款说明',
    start: '发起本期收款',
    starting: '正在发起...',
    chooseMethod: '选择本期付款方式',
    waiting: '等待 Admin 确认到账',
    receivedReadOnly: '本期已确认到账，仅供查看。',
    legacyReadOnly: '历史付款记录，请继续使用此工单原有付款流程。',
    claimTitle: '申请 Admin 确认到账',
    claimAmount: '申请确认金额',
    reference: '交易流水号（选填）',
    evidence: '到账凭证（选填，JPG、PNG 或 PDF）',
    note: '收款备注（选填）',
    submitClaim: '申请 Admin 确认到账',
    submittingClaim: '正在提交...',
    amountInvalid: '请输入正整数金额。',
    amountTooHigh: '申请确认金额不能超过本期待到账金额。',
    evidenceInvalid: '凭证须为不超过 10 MB 的 JPG、PNG 或 PDF 文件。',
    started: '已发起本期收款。',
    claimSubmitted: '到账申请已提交，等待 Admin 确认。',
    claimRefreshFailed: '到账申请已提交，但未能加载最新工单详情。为避免重复提交，本次申请已锁定，请刷新工单后继续。',
    empty: '暂无可执行的付款计划。',
    states: {
      scheduled: '未到付款节点', due: '待发起收款', collecting: '收款中', pending_confirmation: '待确认到账',
      partially_received: '部分到账', overdue: '已逾期', received: '已到账', exception: '异常',
    },
    triggers: {
      before_start: '服务开始前', on_arrival: '工程师到场时', milestone: '约定里程碑完成时',
      on_completion: '服务完成时', on_acceptance: '客户验收时', fixed_date: '指定日期',
    },
  },
};

const RECEIPT_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const RECEIPT_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

function idempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `receipt-claim-${crypto.randomUUID()}`;
  return `receipt-claim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function formatAmount(amount, currency) {
  return `${Number(amount || 0).toLocaleString()} ${currency}`;
}

function emptyClaimForm() {
  return { amount: '', reference: '', note: '', evidence: null, idempotency: idempotencyKey() };
}

export function CollectionPanel({ workOrderId, quoteExecution, userType, onChanged, onSelectPayment }) {
  const copy = isCnLocale() ? COPY.cn : COPY.en;
  const installments = quoteExecution?.installments || [];
  const currency = isCnLocale() ? 'CNY' : 'USD';
  const [startingId, setStartingId] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [claimForms, setClaimForms] = useState({});
  const [submittedClaimIds, setSubmittedClaimIds] = useState(() => new Set());

  if (installments.length === 0) {
    return <p className="py-6 text-sm text-[var(--color-text-secondary)]">{copy.empty}</p>;
  }

  const getClaimForm = (installmentId) => claimForms[installmentId] || emptyClaimForm();
  const updateClaimForm = (installmentId, values) => {
    setClaimForms((current) => ({
      ...current,
      [installmentId]: { ...(current[installmentId] || emptyClaimForm()), ...values },
    }));
  };

  const handleStart = async (installment) => {
    if (startingId) return;
    setStartingId(installment.id);
    try {
      await startInstallmentCollection(workOrderId, installment.id);
      toastSuccess(copy.started);
      await onChanged?.();
    } catch (error) {
      toastError(error.message);
    } finally {
      setStartingId(null);
    }
  };

  const handleClaim = async (installment) => {
    if (submittingId) return;
    const form = getClaimForm(installment.id);
    const claimedAmount = Number(form.amount);
    const remainingAmount = Math.max(0, Number(installment.amount || 0) - Number(installment.received_amount || 0));
    if (!/^\d+$/.test(form.amount) || !Number.isSafeInteger(claimedAmount) || claimedAmount <= 0) {
      toastWarning(copy.amountInvalid);
      return;
    }
    if (claimedAmount > remainingAmount) {
      toastWarning(copy.amountTooHigh);
      return;
    }
    if (form.evidence && (!RECEIPT_EVIDENCE_TYPES.has(form.evidence.type)
      || form.evidence.size <= 0 || form.evidence.size > RECEIPT_EVIDENCE_MAX_BYTES)) {
      toastWarning(copy.evidenceInvalid);
      return;
    }

    setSubmittingId(installment.id);
    try {
      const response = await submitInstallmentReceiptClaim(workOrderId, installment.id, {
        claimed_amount: claimedAmount,
        transaction_reference: form.reference.trim(),
        note: form.note.trim(),
        evidence: form.evidence,
        idempotency_key: form.idempotency,
      });
      setSubmittedClaimIds((current) => new Set(current).add(installment.id));
      toastSuccess(copy.claimSubmitted);
      try {
        if (typeof onChanged !== 'function') throw new Error('Work-order refresh is unavailable.');
        await onChanged(response);
        setClaimForms((current) => ({ ...current, [installment.id]: emptyClaimForm() }));
        setSubmittedClaimIds((current) => {
          const next = new Set(current);
          next.delete(installment.id);
          return next;
        });
      } catch {
        toastWarning(copy.claimRefreshFailed);
      }
    } catch (error) {
      toastError(error.message);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <section aria-labelledby="collection-workspace-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="collection-workspace-title" className="text-base font-semibold text-[var(--color-text-primary)]">{copy.title}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{copy.summary}</p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-1 text-xs sm:text-right">
          <span className="text-[var(--color-text-secondary)]">{copy.total}</span>
          <strong className="text-[var(--color-text-primary)]">{formatAmount(quoteExecution.total_amount, currency)}</strong>
          <span className="text-[var(--color-text-secondary)]">{copy.scheduled}</span>
          <strong className="text-[var(--color-text-primary)]">{formatAmount(quoteExecution.scheduled_amount, currency)}</strong>
          <span className="text-[var(--color-text-secondary)]">{copy.received}</span>
          <strong className="text-green-600">{formatAmount(quoteExecution.received_amount, currency)}</strong>
          <span className="text-[var(--color-text-secondary)]">{copy.outstanding}</span>
          <strong className="text-amber-600">{formatAmount(quoteExecution.outstanding_amount, currency)}</strong>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {installments.map((installment, index) => {
          const installmentCurrency = installment.currency || currency;
          const remainingAmount = Math.max(0, Number(installment.amount || 0) - Number(installment.received_amount || 0));
          const pendingClaim = installment.status === 'pending_confirmation'
            || Number(installment.pending_claim_count || 0) > 0
            || submittedClaimIds.has(installment.id);
          const canStart = userType === 'engineer'
            && installment.source !== 'legacy'
            && ['due', 'partially_received', 'overdue'].includes(installment.status);
          const canClaim = userType === 'engineer'
            && installment.source !== 'legacy'
            && !pendingClaim
            && (installment.status === 'collecting'
              || (['partially_received', 'overdue'].includes(installment.status) && installment.collection_started_at));
          const canChooseMethod = userType === 'customer'
            && installment.source !== 'legacy'
            && ['collecting', 'partially_received', 'overdue'].includes(installment.status);
          const form = getClaimForm(installment.id);

          return (
            <article key={installment.id || `legacy-${index}`} className="py-4 first:pt-3 last:pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {isCnLocale() ? `${copy.installment} ${index + 1} 期` : `${copy.installment} ${index + 1}`}
                    </h3>
                    <span className="rounded bg-[var(--color-surface-elevated)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                      {copy.states[installment.status] || installment.status}
                    </span>
                    {installment.required_before_start && (
                      <span className="text-xs font-medium text-amber-600">{copy.requiredBeforeStart}</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-primary)]">
                    {copy.triggers[installment.trigger_type] || installment.trigger_type}
                    {installment.due_date ? ` · ${copy.dueDate}: ${installment.due_date}` : ''}
                  </p>
                  {installment.description && (
                    <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{copy.description}: {installment.description}</p>
                  )}
                </div>

                <dl className="grid min-w-full grid-cols-3 gap-2 text-xs lg:min-w-[310px]">
                  <div><dt className="text-[var(--color-text-secondary)]">{copy.scheduled}</dt><dd className="mt-1 font-semibold text-[var(--color-text-primary)]">{formatAmount(installment.amount, installmentCurrency)}</dd></div>
                  <div><dt className="text-[var(--color-text-secondary)]">{copy.received}</dt><dd className="mt-1 font-semibold text-green-600">{formatAmount(installment.received_amount, installmentCurrency)}</dd></div>
                  <div><dt className="text-[var(--color-text-secondary)]">{copy.remaining}</dt><dd className="mt-1 font-semibold text-amber-600">{formatAmount(remainingAmount, installmentCurrency)}</dd></div>
                </dl>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canStart && (
                  <button
                    type="button"
                    onClick={() => handleStart(installment)}
                    disabled={Boolean(startingId)}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                  >
                    {startingId === installment.id ? <Loader2 size={16} className="animate-spin" /> : <WalletCards size={16} />}
                    {startingId === installment.id ? copy.starting : copy.start}
                  </button>
                )}
                {canChooseMethod && (
                  <button
                    type="button"
                    onClick={() => onSelectPayment?.({ installmentId: installment.id, amount: remainingAmount, trigger: installment.trigger_type, currency: installmentCurrency })}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                  >
                    <WalletCards size={16} />
                    {copy.chooseMethod}
                  </button>
                )}
                {pendingClaim && (
                  <p role="status" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-amber-600">
                    <Clock3 size={16} /> {copy.waiting}
                  </p>
                )}
                {installment.status === 'received' && (
                  <p className="inline-flex min-h-10 items-center gap-2 text-sm text-green-600"><CheckCircle2 size={16} /> {copy.receivedReadOnly}</p>
                )}
                {installment.source === 'legacy' && installment.status !== 'received' && (
                  <p className="text-sm text-[var(--color-text-secondary)]">{copy.legacyReadOnly}</p>
                )}
              </div>

              {canClaim && (
                <div className="mt-4 border-t border-dashed border-[var(--color-border)] pt-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]"><ReceiptText size={16} /> {copy.claimTitle}</h4>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.claimAmount}
                      <input type="text" inputMode="numeric" value={form.amount} onChange={(event) => updateClaimForm(installment.id, { amount: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.reference}
                      <input type="text" value={form.reference} onChange={(event) => updateClaimForm(installment.id, { reference: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.evidence}
                      <span className="mt-1 flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                        <FileUp size={16} />
                        <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => updateClaimForm(installment.id, { evidence: event.target.files?.[0] || null })} className="min-w-0 flex-1 text-xs" />
                      </span>
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.note}
                      <textarea rows="2" value={form.note} onChange={(event) => updateClaimForm(installment.id, { note: event.target.value })} className="mt-1 w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClaim(installment)}
                    disabled={Boolean(submittingId)}
                    className="mt-3 inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-green-600 px-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {submittingId === installment.id ? <Loader2 size={16} className="animate-spin" /> : <ReceiptText size={16} />}
                    {submittingId === installment.id ? copy.submittingClaim : copy.submitClaim}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
