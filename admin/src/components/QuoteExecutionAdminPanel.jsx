import { Check, ExternalLink, LockKeyhole, ReceiptText, RotateCcw, Split, X } from 'lucide-react';
import { runtimeConfig } from '../config/runtime';
import { money } from '../pages/workOrderDisplay';

const TEXT = {
  en: {
    title: 'Quote execution review',
    subtitle: 'Review the complete commercial version and verify actual receipts separately.',
    readOnly: 'Read-only',
    quoteVersion: 'Quote version',
    expectedDays: 'Expected onsite days',
    notApplicable: 'Not applicable',
    feeBreakdown: 'Fee breakdown',
    laborFee: 'Labor fee',
    partsFee: 'Parts fee',
    travelFee: 'Travel fee',
    otherFee: 'Other fee',
    total: 'Quote total',
    paymentSchedule: 'Payment schedule',
    installment: (sequence) => `Installment ${sequence}`,
    startRequired: 'Required before service start',
    dueDate: 'Due date',
    noSchedule: 'No payment schedule is available for this quote version.',
    approveQuote: 'Approve quote version',
    returnQuote: 'Return for revision',
    receiptReview: 'Pending receipt review',
    noClaims: 'No receipt claims are waiting for review.',
    scheduled: 'Scheduled',
    previouslyReceived: 'Previously received',
    claimed: 'Claimed',
    remaining: 'Remaining',
    evidence: 'Evidence',
    openEvidence: 'Open evidence',
    noEvidence: 'No evidence file',
    reference: 'Transaction reference',
    engineerNote: 'Engineer note',
    confirmFull: 'Confirm full receipt',
    confirmPartial: 'Confirm partial amount',
    rejectClaim: 'Reject receipt claim',
    paymentState: 'Payment state',
    received: 'Received',
    outstanding: 'Outstanding',
    financiallySettled: 'Financially settled',
    yes: 'Yes',
    no: 'No',
    triggerLabels: {
      before_start: 'Before service start',
      on_arrival: 'On arrival',
      milestone: 'Milestone',
      on_completion: 'On completion',
      on_acceptance: 'On acceptance',
      fixed_date: 'Fixed date',
    },
    paymentStateLabels: {
      unpaid: 'Unpaid',
      pending_confirmation: 'Pending confirmation',
      partially_received: 'Partially received',
      overdue: 'Overdue',
      settled: 'Settled',
      financially_settled: 'Financially settled',
      exception: 'Exception review',
    },
  },
  'zh-CN': {
    title: '报价与收款审核',
    subtitle: '先审核完整商务版本，再独立核验每笔实际到账。',
    readOnly: '只读',
    quoteVersion: '报价版本',
    expectedDays: '预计现场天数',
    notApplicable: '不适用',
    feeBreakdown: '费用明细',
    laborFee: '人工费',
    partsFee: '备件费',
    travelFee: '差旅费',
    otherFee: '其他费用',
    total: '报价总额',
    paymentSchedule: '完整付款计划',
    installment: (sequence) => `第 ${sequence} 期`,
    startRequired: '服务开始前须足额到账',
    dueDate: '到期日',
    noSchedule: '当前报价版本没有可用的付款计划。',
    approveQuote: '批准此报价版本',
    returnQuote: '退回修改',
    receiptReview: '待审核到账申请',
    noClaims: '暂无待审核到账申请。',
    scheduled: '计划金额',
    previouslyReceived: '此前已到账',
    claimed: '本次申请',
    remaining: '本期剩余',
    evidence: '到账凭证',
    openEvidence: '查看凭证',
    noEvidence: '未上传凭证',
    reference: '交易流水号',
    engineerNote: '工程师备注',
    confirmFull: '确认全额到账',
    confirmPartial: '确认部分到账',
    rejectClaim: '驳回到账申请',
    paymentState: '收款状态',
    received: '累计到账',
    outstanding: '待收金额',
    financiallySettled: '财务已结清',
    yes: '是',
    no: '否',
    triggerLabels: {
      before_start: '服务开始前',
      on_arrival: '到场时',
      milestone: '里程碑',
      on_completion: '服务完成时',
      on_acceptance: '验收时',
      fixed_date: '固定日期',
    },
    paymentStateLabels: {
      unpaid: '未收款',
      pending_confirmation: '待确认到账',
      partially_received: '部分到账',
      overdue: '已逾期',
      settled: '已结清',
      financially_settled: '财务已结清',
      exception: '异常待核查',
    },
  },
};

function formatAmount(value, currency) {
  return `${money(value)}${currency ? ` ${currency}` : ''}`;
}

function SummaryItem({ label, value }) {
  return (
    <div className="min-w-0 border-l-2 border-[var(--color-border)] pl-3">
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

export function QuoteExecutionAdminPanel({ detail, readOnly = false, onRefresh, onOpenDialog }) {
  const t = { ...TEXT.en, ...(TEXT[runtimeConfig.locale] || {}) };
  const pricing = detail?.pricing;
  const execution = detail?.quote_execution;
  const quoteVersion = Number(pricing?.quote_version || 0);
  const paymentSchedule = Array.isArray(pricing?.payment_schedule) ? pricing.payment_schedule : [];
  const reviewSchedule = paymentSchedule.filter((schedule) => Number(schedule.quote_version) === quoteVersion);
  const installments = Array.isArray(execution?.installments) ? execution.installments : [];
  const claims = Array.isArray(execution?.receipt_claims) ? execution.receipt_claims : [];
  const pendingClaims = claims.filter((claim) => claim.status === 'pending');
  const installmentById = new Map(installments.map((installment) => [installment.id, installment]));
  const currency = reviewSchedule[0]?.currency || installments[0]?.currency || pricing?.currency || '';
  const paymentStateLabels = t.paymentStateLabels;
  const triggerLabels = t.triggerLabels;

  if (!pricing || quoteVersion < 1) return null;

  function openReceiptDialog(type, claim) {
    if (readOnly) return;
    const installment = installmentById.get(claim.installment_id);
    if (!installment) return;
    const remainingAmount = Math.max(0, Number(installment.amount || 0) - Number(installment.received_amount || 0));
    const fullAmount = Math.min(Number(claim.claimed_amount || 0), remainingAmount);
    onOpenDialog?.(type, detail, { claim, installment, remainingAmount, fullAmount, onRefresh });
  }

  return (
    <section className="break-words rounded-lg border border-[var(--color-border)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptText className="h-4 w-4 text-[var(--color-primary)]" />
            <h4 className="font-medium text-[var(--color-text)]">{t.title}</h4>
            {readOnly && <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)]"><LockKeyhole className="h-3.5 w-3.5" />{t.readOnly}</span>}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.subtitle}</p>
        </div>
        {!readOnly && pricing.status === 'pending_review' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => onOpenDialog?.('quote-return', detail, { quoteVersion })} className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-secondary)]"><RotateCcw className="h-4 w-4" />{t.returnQuote}</button>
            <button type="button" onClick={() => onOpenDialog?.('quote-approve', detail, { quoteVersion })} className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 text-sm font-medium text-white"><Check className="h-4 w-4" />{t.approveQuote}</button>
          </div>
        )}
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <SummaryItem label={t.quoteVersion} value={`V${pricing.quote_version}`} />
          <SummaryItem label={t.expectedDays} value={pricing.expected_service_days ?? t.notApplicable} />
          <SummaryItem label={t.total} value={formatAmount(pricing.total_amount || pricing.subtotal, currency)} />
        </dl>
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="text-sm font-medium text-[var(--color-text)]">{t.feeBreakdown}</h5>
        <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
          {[
            [t.laborFee, pricing.labor_fee],
            [t.partsFee, pricing.parts_fee],
            [t.travelFee, pricing.travel_fee],
            [t.otherFee, pricing.other_fee],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)]/60 py-2">
              <dt className="text-[var(--color-text-secondary)]">{label}</dt>
              <dd className="whitespace-nowrap font-medium text-[var(--color-text)]">{formatAmount(value, currency)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <h5 className="text-sm font-medium text-[var(--color-text)]">{t.paymentSchedule}</h5>
        {reviewSchedule.length === 0 ? <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t.noSchedule}</p> : (
          <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {reviewSchedule.map((schedule) => (
              <div key={schedule.id || `${schedule.quote_version}:${schedule.sequence}`} className="grid min-w-0 gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--color-text)]">{t.installment(schedule.sequence)} · {triggerLabels[schedule.trigger_type] || t.notApplicable}</div>
                  {schedule.description && <p className="mt-1 [overflow-wrap:anywhere] text-[var(--color-text-secondary)]">{schedule.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    {schedule.required_before_start && <span>{t.startRequired}</span>}
                    {schedule.due_date && <span>{t.dueDate}: {schedule.due_date}</span>}
                  </div>
                </div>
                <div className="whitespace-nowrap font-semibold text-[var(--color-primary)]">{formatAmount(schedule.amount, schedule.currency)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {execution && (
        <div className="border-b border-[var(--color-border)] p-4">
          <dl className="grid gap-3 sm:grid-cols-4">
            <SummaryItem label={t.paymentState} value={paymentStateLabels[execution.payment_state] || t.notApplicable} />
            <SummaryItem label={t.received} value={formatAmount(execution.received_amount, installments[0]?.currency || currency)} />
            <SummaryItem label={t.outstanding} value={formatAmount(execution.outstanding_amount, installments[0]?.currency || currency)} />
            <SummaryItem label={t.financiallySettled} value={execution.financially_settled ? t.yes : t.no} />
          </dl>
        </div>
      )}

      <div className="p-4">
        <h5 className="text-sm font-medium text-[var(--color-text)]">{t.receiptReview}</h5>
        {pendingClaims.length === 0 ? <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t.noClaims}</p> : (
          <div className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {pendingClaims.map((claim) => {
              const installment = installmentById.get(claim.installment_id);
              if (!installment) return null;
              const remainingAmount = Math.max(0, Number(installment.amount || 0) - Number(installment.received_amount || 0));
              return (
                <div key={claim.id} className="min-w-0 py-4 [overflow-wrap:anywhere]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-[var(--color-text)]">{t.installment(installment.sequence)}</div>
                      <div className="mt-2 grid gap-x-5 gap-y-1 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2">
                        <div>{t.scheduled}: {formatAmount(installment.amount, installment.currency)}</div>
                        <div>{t.previouslyReceived}: {formatAmount(installment.received_amount, installment.currency)}</div>
                        <div>{t.claimed}: {formatAmount(claim.claimed_amount, installment.currency)}</div>
                        <div>{t.remaining}: {formatAmount(remainingAmount, installment.currency)}</div>
                      </div>
                    </div>
                    {!readOnly && pendingClaims.length > 0 && (
                      <div className="flex flex-col gap-2 sm:items-end">
                        <button type="button" onClick={() => openReceiptDialog('receipt-confirm-full', claim)} className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--color-success)] px-3 text-sm font-medium text-white"><Check className="h-4 w-4" />{t.confirmFull}</button>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button type="button" onClick={() => openReceiptDialog('receipt-confirm-partial', claim)} className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-warning)]/50 px-3 text-sm text-[var(--color-warning)]"><Split className="h-4 w-4" />{t.confirmPartial}</button>
                          <button type="button" onClick={() => openReceiptDialog('receipt-reject', claim)} className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--color-error)]/50 px-3 text-sm text-[var(--color-error)]"><X className="h-4 w-4" />{t.rejectClaim}</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-3">
                    <div><dt className="text-[var(--color-text-muted)]">{t.evidence}</dt><dd className="mt-1">{claim.evidence?.url ? <a href={`${runtimeConfig.apiBase}${claim.evidence.url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"><ExternalLink className="h-3.5 w-3.5" />{claim.evidence.file_name || t.openEvidence}</a> : t.noEvidence}</dd></div>
                    <div><dt className="text-[var(--color-text-muted)]">{t.reference}</dt><dd className="mt-1">{claim.transaction_reference || '-'}</dd></div>
                    <div><dt className="text-[var(--color-text-muted)]">{t.engineerNote}</dt><dd className="mt-1">{claim.engineer_note || '-'}</dd></div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
