import { useCallback, useEffect, useMemo } from 'react';
import { getDiagnosticGuide } from '../data/diagnosticGuides';
import { trackFunnelEvent } from '../services/api';

const PUBLIC_CONTENT_TYPES = new Set([
  'service', 'diagnostic_guide', 'insight', 'tool',
]);

function isSafeContentContext(contentType, contentSlug) {
  return PUBLIC_CONTENT_TYPES.has(contentType)
    && typeof contentSlug === 'string'
    && /^[a-z0-9-]+$/i.test(contentSlug);
}

export function getPublicContentSlug(route) {
  if (!route?.path) return '';
  return route.path === '/' ? 'home' : route.path.split('/').filter(Boolean).at(-1) || '';
}

export function getAcquisitionContentType(route, locale = 'en') {
  if (!route) return '';
  if (route.type === 'service' || route.type === 'services-hub') return 'service';
  if (route.type === 'tool' || route.type === 'tools-hub') return 'tool';
  if (route.type === 'insight' && getDiagnosticGuide(getPublicContentSlug(route), locale)) return 'diagnostic_guide';
  return route.type === 'home' || route.type === 'insight' || route.type === 'insights-hub' || route.type === 'technical-review'
    ? 'insight'
    : '';
}

export function createTrackedConversionClick(onConversionClick, context, callback) {
  return () => {
    onConversionClick(context);
    callback?.();
  };
}

export function createAcquisitionTrackingController({
  path,
  contentType,
  contentSlug,
  indexable,
  track = trackFunnelEvent,
  visibilityState = () => (typeof document === 'undefined' ? 'hidden' : document.visibilityState),
  now = () => Date.now(),
  setTimer = (callback, delay) => window.setTimeout(callback, delay),
  clearTimer = (timer) => window.clearTimeout(timer),
  trackLanding = true,
}) {
  const enabled = Boolean(indexable && path && isSafeContentContext(contentType, contentSlug));
  let mounted = false;
  let landingSent = false;
  let engagedSent = false;
  let remaining = 30_000;
  let visibleSince = null;
  let timer = null;
  const startedTools = new Set();
  const completedTools = new Set();

  const fireEngaged = () => {
    if (!mounted || engagedSent || !enabled) return;
    engagedSent = true;
    timer = null;
    track('content_engaged', {
      content_type: contentType,
      content_slug: contentSlug,
      engagement_bucket: '30s',
    });
  };

  const pause = () => {
    if (visibleSince !== null) remaining = Math.max(0, remaining - (now() - visibleSince));
    visibleSince = null;
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const arm = () => {
    if (!mounted || !enabled || engagedSent || timer !== null) return;
    if (remaining <= 0) {
      fireEngaged();
      return;
    }
    visibleSince = now();
    timer = setTimer(fireEngaged, remaining);
  };

  const onVisibilityChange = () => {
    if (!mounted || !enabled) return;
    if (visibilityState() === 'visible') arm();
    else pause();
  };

  return {
    mount() {
      if (!enabled || mounted) return;
      mounted = true;
      if (trackLanding && !landingSent) {
        landingSent = true;
        track('seo_landing_viewed', { content_type: contentType, content_slug: contentSlug });
      }
      onVisibilityChange();
    },
    unmount() {
      if (!mounted) return;
      pause();
      mounted = false;
    },
    onVisibilityChange,
    onToolStarted(toolId) {
      if (!enabled || typeof toolId !== 'string' || !toolId || startedTools.has(toolId)) return;
      startedTools.add(toolId);
      track('tool_started', { content_type: contentType, content_slug: contentSlug, tool_id: toolId });
    },
    onToolCompleted(toolId, hasValidResult) {
      if (!enabled || !hasValidResult || typeof toolId !== 'string' || !toolId || !startedTools.has(toolId) || completedTools.has(toolId)) return;
      completedTools.add(toolId);
      track('tool_completed', {
        content_type: contentType,
        content_slug: contentSlug,
        tool_id: toolId,
        result_state: 'valid',
      });
    },
    onConversionClick({ contentType: clickedContentType = contentType, contentSlug: clickedContentSlug = contentSlug, ctaType } = {}) {
      if (!enabled || !isSafeContentContext(clickedContentType, clickedContentSlug) || typeof ctaType !== 'string' || !ctaType) return;
      track('conversion_cta_clicked', {
        content_type: clickedContentType,
        content_slug: clickedContentSlug,
        cta_type: ctaType,
      });
    },
  };
}

export function useAcquisitionTracking({ path, contentType, contentSlug, indexable, trackLanding = true }) {
  const controller = useMemo(() => createAcquisitionTrackingController({
    path,
    contentType,
    contentSlug,
    indexable,
    trackLanding,
  }), [contentSlug, contentType, indexable, path, trackLanding]);

  useEffect(() => {
    controller.mount();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', controller.onVisibilityChange);
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', controller.onVisibilityChange);
      controller.unmount();
    };
  }, [controller]);

  return {
    onToolStarted: useCallback((toolId) => controller.onToolStarted(toolId), [controller]),
    onToolCompleted: useCallback((toolId, hasValidResult) => controller.onToolCompleted(toolId, hasValidResult), [controller]),
    onConversionClick: useCallback((context) => controller.onConversionClick(context), [controller]),
  };
}
