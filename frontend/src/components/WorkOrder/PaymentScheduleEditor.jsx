import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { createDefaultInstallment, scheduleTotals } from './pricingDraft';

function resequence(rows) {
  return rows.map((row, index) => ({ ...row, sequence: index + 1 }));
}

export function PaymentScheduleEditor({ form, onChange, totalAmount, currency, copy }) {
  const setMode = (payment_plan_mode) => {
    let payment_schedule = form.payment_schedule;
    if (payment_plan_mode === 'installments' && payment_schedule.length < 2) {
      const firstAmount = Math.floor(totalAmount / 2);
      payment_schedule = [
        { ...createDefaultInstallment(1), amount: firstAmount > 0 ? String(firstAmount) : '' },
        { ...createDefaultInstallment(2), amount: totalAmount > 0 ? String(totalAmount - firstAmount) : '' },
      ];
    }
    if (payment_plan_mode === 'single') payment_schedule = [];
    onChange({ ...form, payment_plan_mode, payment_schedule });
  };

  const updateRow = (index, patch) => {
    const payment_schedule = form.payment_schedule.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    ));
    onChange({ ...form, payment_schedule });
  };

  const addRow = () => {
    if (form.payment_schedule.length < 6) {
      const { difference } = scheduleTotals(form.payment_schedule, totalAmount);
      const next = {
        ...createDefaultInstallment(form.payment_schedule.length + 1),
        amount: difference > 0 ? String(difference) : '',
      };
      onChange({ ...form, payment_schedule: [...form.payment_schedule, next] });
    }
  };

  const removeRow = (index) => {
    if (form.payment_schedule.length > 2) {
      onChange({
        ...form,
        payment_schedule: resequence(form.payment_schedule.filter((_, rowIndex) => rowIndex !== index)),
      });
    }
  };

  const moveRow = (index, offset) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= form.payment_schedule.length) return;
    const payment_schedule = [...form.payment_schedule];
    [payment_schedule[index], payment_schedule[nextIndex]] = [payment_schedule[nextIndex], payment_schedule[index]];
    onChange({ ...form, payment_schedule: resequence(payment_schedule) });
  };

  const displaySchedule = form.payment_plan_mode === 'installments'
    ? form.payment_schedule
    : [{ amount: String(totalAmount || 0) }];
  const totals = scheduleTotals(displaySchedule, totalAmount);
  const percent = totalAmount > 0 ? Math.round((totals.scheduled / totalAmount) * 100) : 0;

  return (
    <section className="space-y-3" aria-label={copy.paymentPlanLabel}>
      <div>
        <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">{copy.paymentPlanLabel}</div>
        <div className="grid grid-cols-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1">
          {['single', 'installments'].map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={form.payment_plan_mode === mode}
              onClick={() => setMode(mode)}
              className={`min-h-9 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors ${
                form.payment_plan_mode === mode
                  ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {mode === 'single' ? copy.single : copy.installments}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          {form.payment_plan_mode === 'single' ? copy.singleHelp : copy.installmentsHelp}
        </p>
      </div>

      {form.payment_plan_mode === 'installments' && (
        <div className="space-y-2">
          {form.payment_schedule.map((installment, index) => (
            <div key={installment.sequence} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(100px,0.7fr)_minmax(160px,1fr)_minmax(130px,0.8fr)_auto] md:items-end">
                <label className="min-w-0 text-xs text-[var(--color-text-secondary)]">
                  <span className="mb-1 block">{copy.amount}</span>
                  <div className="relative">
                    <input
                      aria-label={`${copy.installment} ${index + 1} ${copy.amount}`}
                      type="number"
                      min="1"
                      step="1"
                      value={installment.amount}
                      onChange={(event) => updateRow(index, { amount: event.target.value })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 pr-12 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">{currency}</span>
                  </div>
                </label>

                <label className="min-w-0 text-xs text-[var(--color-text-secondary)]">
                  <span className="mb-1 block">{copy.trigger}</span>
                  <select
                    aria-label={`${copy.installment} ${index + 1} ${copy.trigger}`}
                    value={installment.trigger_type}
                    onChange={(event) => updateRow(index, {
                      trigger_type: event.target.value,
                      due_date: event.target.value === 'fixed_date' ? installment.due_date : '',
                    })}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    {Object.entries(copy.triggerLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-xs text-[var(--color-text-secondary)]">
                  <span className="mb-1 block">{copy.dueDate}</span>
                  <input
                    aria-label={`${copy.installment} ${index + 1} ${copy.dueDate}`}
                    type="date"
                    value={installment.due_date}
                    disabled={installment.trigger_type !== 'fixed_date'}
                    onChange={(event) => updateRow(index, { due_date: event.target.value })}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </label>

                <div className="flex h-9 shrink-0 items-center justify-end gap-1">
                  <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} aria-label={copy.moveUp} title={copy.moveUp} className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-30">
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" onClick={() => moveRow(index, 1)} disabled={index === form.payment_schedule.length - 1} aria-label={copy.moveDown} title={copy.moveDown} className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-30">
                    <ArrowDown size={16} />
                  </button>
                  <button type="button" onClick={() => removeRow(index)} disabled={form.payment_schedule.length <= 2} aria-label={copy.remove} title={copy.remove} className="rounded-md p-2 text-red-500 hover:bg-red-500/10 disabled:opacity-30">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <label className="min-w-0 text-xs text-[var(--color-text-secondary)]">
                  <span className="mb-1 block">{copy.description}</span>
                  <input
                    aria-label={`${copy.installment} ${index + 1} ${copy.description}`}
                    type="text"
                    value={installment.description}
                    onChange={(event) => updateRow(index, { description: event.target.value })}
                    placeholder={installment.trigger_type === 'milestone' ? copy.milestonePlaceholder : copy.descriptionPlaceholder}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </label>
                <label className="flex min-h-9 items-center gap-2 whitespace-nowrap text-xs text-[var(--color-text-secondary)] md:mt-5">
                  <input
                    type="checkbox"
                    checked={installment.required_before_start}
                    onChange={(event) => updateRow(index, { required_before_start: event.target.checked })}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                  />
                  {copy.requiredBeforeStart}
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            disabled={form.payment_schedule.length >= 6}
            aria-label={copy.addInstallment}
            title={copy.addInstallment}
            className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
          >
            <Plus size={16} />
            {copy.addInstallment}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-[var(--color-surface-elevated)] p-3 text-xs sm:grid-cols-4">
        <div><span className="block text-[var(--color-text-muted)]">{copy.total}</span><strong className="text-[var(--color-text-primary)]">{totalAmount} {currency}</strong></div>
        <div><span className="block text-[var(--color-text-muted)]">{copy.scheduled}</span><strong className="text-[var(--color-text-primary)]">{totals.scheduled} {currency}</strong></div>
        <div><span className="block text-[var(--color-text-muted)]">{copy.difference}</span><strong className={totals.difference === 0 ? 'text-green-500' : 'text-red-500'}>{totals.difference} {currency}</strong></div>
        <div><span className="block text-[var(--color-text-muted)]">{copy.percent}</span><strong className="text-[var(--color-text-primary)]">{percent}%</strong></div>
      </div>
    </section>
  );
}
