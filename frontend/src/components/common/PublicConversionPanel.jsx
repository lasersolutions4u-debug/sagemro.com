export function PublicConversionPanel({ context, primaryLabel, secondaryLabel, onStartDiagnosis, onOpenServiceRequest }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5" aria-label={context}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onStartDiagnosis}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onOpenServiceRequest}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
        >
          {secondaryLabel}
        </button>
      </div>
    </section>
  );
}
