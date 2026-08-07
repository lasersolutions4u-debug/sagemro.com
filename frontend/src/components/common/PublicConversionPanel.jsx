import { useMemo } from 'react';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { createTrackedConversionClick, getAcquisitionContentType, getPublicContentSlug, useAcquisitionTracking } from '../../hooks/useAcquisitionTracking';
import { isCnLocale } from '../../utils/locale';

export function PublicConversionPanel({ context, primaryLabel, secondaryLabel, onStartDiagnosis, onOpenServiceRequest }) {
  const acquisitionContext = useMemo(() => {
    const path = typeof window === 'undefined' ? '' : window.location.pathname;
    const route = getPublicSeoRoute(path, isCnLocale() ? 'zh-CN' : 'en');
    return {
      path,
      contentType: getAcquisitionContentType(route, isCnLocale() ? 'zh-CN' : 'en'),
      contentSlug: getPublicContentSlug(route),
      indexable: route?.robots === 'index,follow',
    };
  }, []);
  const { onConversionClick } = useAcquisitionTracking({ ...acquisitionContext, trackLanding: false });
  const startDiagnosis = createTrackedConversionClick(onConversionClick, {
    contentType: acquisitionContext.contentType,
    contentSlug: acquisitionContext.contentSlug,
    ctaType: 'ai_diagnosis',
  }, onStartDiagnosis);
  const openServiceRequest = createTrackedConversionClick(onConversionClick, {
    contentType: acquisitionContext.contentType,
    contentSlug: acquisitionContext.contentSlug,
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
