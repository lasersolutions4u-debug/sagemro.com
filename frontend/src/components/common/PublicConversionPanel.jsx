import { useMemo } from 'react';
import { createAcquisitionEventActions, createTrackedConversionClick } from '../../hooks/useAcquisitionTracking';
import { buildCustomerPortalUrl } from '../../utils/portalTarget';

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
  const serviceRequestHref = buildCustomerPortalUrl({
    hostname,
    market,
    presets: { mode: 'manual', ...sharedPresets },
  });

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5" aria-label={context}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={serviceRequestHref}
          onClick={openServiceRequest}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {market === 'cn' ? '填写服务需求' : 'Request service'}
        </a>
        <a
          href={diagnosisHref}
          onClick={startDiagnosis}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
        >
          {market === 'cn' ? 'AI 协助填写' : 'Get help filling the form'}
        </a>
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{market === 'cn' ? '直接填写，或先与 AI 聊天整理信息。两种方式使用同一份服务单，由您核对后提交。' : 'Fill in the form directly, or chat with AI first. Both use the same service request, which you review before submitting.'}</p>
    </section>
  );
}
