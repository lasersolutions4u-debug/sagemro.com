import { useMemo } from 'react';
import { createAcquisitionEventActions, createTrackedConversionClick } from '../../hooks/useAcquisitionTracking';

export function PublicConversionPanel({ context, acquisitionContext, primaryLabel, secondaryLabel, onStartDiagnosis, onOpenServiceRequest }) {
  const safeAcquisitionContext = acquisitionContext || {};
  const { contentType, contentSlug, indexable } = safeAcquisitionContext;
  const { onConversionClick } = useMemo(
    () => createAcquisitionEventActions({ contentType, contentSlug, indexable }),
    [contentSlug, contentType, indexable],
  );
  const startDiagnosis = createTrackedConversionClick(onConversionClick, {
    contentType: safeAcquisitionContext.contentType,
    contentSlug: safeAcquisitionContext.contentSlug,
    ctaType: 'ai_diagnosis',
  }, onStartDiagnosis);
  const openServiceRequest = createTrackedConversionClick(onConversionClick, {
    contentType: safeAcquisitionContext.contentType,
    contentSlug: safeAcquisitionContext.contentSlug,
    ctaType: 'service_request',
  }, onOpenServiceRequest);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5" aria-label={context}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={startDiagnosis}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={openServiceRequest}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
        >
          {secondaryLabel}
        </button>
      </div>
    </section>
  );
}
