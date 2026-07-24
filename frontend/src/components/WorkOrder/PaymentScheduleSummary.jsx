function formatAmount(value) {
  return Number(value || 0).toLocaleString();
}

export function PaymentScheduleSummary({ pricing, currency, copy, note = '' }) {
  const totalAmount = Number(pricing.total_amount || pricing.subtotal || 0);
  const payment_schedule = pricing.payment_schedule?.length > 0
    ? pricing.payment_schedule
    : [{
      sequence: 1,
      amount: totalAmount,
      trigger_type: 'before_start',
      due_date: null,
      description: '',
      required_before_start: true,
    }];
  const triggerLabels = copy.triggerLabels;

  return (
    <section className="space-y-3" aria-label={copy.completeQuote}>
      <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3 text-sm">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2">
          <span className="font-medium text-[var(--color-text-primary)]">{copy.completeQuote}</span>
          {Number(pricing.quote_version) > 0 && (
            <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">{copy.version} {pricing.quote_version}</span>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between gap-3"><span className="text-[var(--color-text-secondary)]">{copy.laborFee}</span><span>{formatAmount(pricing.labor_fee)} {currency}</span></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--color-text-secondary)]">{copy.partsFee}</span><span>{formatAmount(pricing.parts_fee)} {currency}</span></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--color-text-secondary)]">{copy.travelFee}</span><span>{formatAmount(pricing.travel_fee)} {currency}</span></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--color-text-secondary)]">{copy.otherFee}</span><span>{formatAmount(pricing.other_fee)} {currency}</span></div>
          {note && <div className="border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-secondary)]">{copy.otherFeeNote}: {note}</div>}
          {pricing.expected_service_days != null && (
            <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-2">
              <span className="text-[var(--color-text-secondary)]">{copy.expectedDays}</span>
              <span>{pricing.expected_service_days} {copy.days}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-2 text-base font-semibold text-[var(--color-primary)]">
            <span>{copy.total}</span><span>{formatAmount(totalAmount)} {currency}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">{copy.paymentSchedule}</div>
        <div className="space-y-2">
          {payment_schedule.map((installment, index) => {
            const percent = totalAmount > 0 ? Math.round((Number(installment.amount || 0) / totalAmount) * 100) : 0;
            return (
              <div key={`${installment.quote_version || pricing.quote_version}-${installment.sequence || index + 1}`} className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--color-text-primary)]">{copy.installment} {index + 1}</div>
                    <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{triggerLabels[installment.trigger_type]}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold text-[var(--color-text-primary)]">{formatAmount(installment.amount)} {currency}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{percent}%</div>
                  </div>
                </div>
                {(installment.description || installment.due_date || installment.required_before_start) && (
                  <div className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-secondary)]">
                    {installment.description && <div>{installment.description}</div>}
                    {installment.due_date && <div>{copy.dueDate}: {installment.due_date}</div>}
                    {installment.required_before_start && <div>{copy.requiredBeforeStart}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
