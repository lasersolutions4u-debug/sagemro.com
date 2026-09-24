import { useMemo } from 'react';
import { createAcquisitionEventActions, createTrackedConversionClick } from '../../hooks/useAcquisitionTracking';
import { buildCustomerPortalUrl } from '../../utils/portalTarget';
import { openConsultationForm } from '../../utils/consultation';

export function PublicConversionPanel({ context, acquisitionContext, serviceRequestPreset }) {
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
  });
  const openServiceRequest = createTrackedConversionClick(onConversionClick, {
    contentType: safeAcquisitionContext.contentType,
    contentSlug: safeAcquisitionContext.contentSlug,
    ctaType: 'service_request',
  });
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const market = safeAcquisitionContext.locale === 'zh-CN' || hostname.endsWith('.cn') ? 'cn' : 'com';
  const sharedPresets = {
    ...serviceRequestPreset,
    service: serviceRequestPreset?.service,
    source: serviceRequestPreset?.source || [contentType, contentSlug].filter(Boolean).join(':'),
  };
  const diagnosisHref = buildCustomerPortalUrl({
    hostname,
    market,
    presets: { ...sharedPresets, mode: 'assist' },
  });

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5" aria-label={context}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={(event) => { openServiceRequest(event); openConsultationForm(); }}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {market === 'cn' ? '提交咨询需求' : 'Request a consultation'}
        </button>
        <a
          href={diagnosisHref}
          onClick={startDiagnosis}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
        >
          {market === 'cn' ? '与 AI 助手对话' : 'Talk to the AI assistant'}
        </a>
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{market === 'cn' ? '留下联系方式与需求，工程师会直接回复；也可以先与 AI 助手沟通整理。' : 'Send your contact details and requirement and an engineer replies directly, or talk to the AI assistant first.'}</p>
    </section>
  );
}
