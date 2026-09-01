import { useMemo } from 'react';
import { createAcquisitionEventActions, createTrackedConversionClick } from '../../hooks/useAcquisitionTracking';
import { buildCustomerPortalUrl } from '../../utils/portalTarget';

export function PublicConversionPanel({ context, acquisitionContext, primaryLabel, secondaryLabel, onStartDiagnosis, onOpenServiceRequest, serviceRequestPreset }) {
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
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const market = safeAcquisitionContext.locale === 'zh-CN' ? 'cn' : 'com';
  const sharedPresets = {
    ...serviceRequestPreset,
    source: serviceRequestPreset?.source || [contentType, contentSlug].filter(Boolean).join(':'),
  };
  const diagnosisHref = buildCustomerPortalUrl({
    hostname,
    market,
    presets: { ...sharedPresets, mode: 'assist' },
  });
  const serviceRequestHref = buildCustomerPortalUrl({
    hostname,
    market,
    presets: { mode: 'manual', ...sharedPresets },
  });

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5" aria-label={context}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={diagnosisHref}
          onClick={startDiagnosis}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {primaryLabel}
        </a>
        <a
          href={serviceRequestHref}
          onClick={openServiceRequest}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
        >
          {secondaryLabel}
        </a>
      </div>
    </section>
  );
}
