import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getWorkOrderServiceGuidance,
  refreshWorkOrderServiceGuidance,
} from '../services/api';

function mergeGuidanceState(current, data) {
  return {
    ...current,
    ...data,
    guidance: data?.guidance ?? current?.guidance ?? null,
    generated_at: data?.generated_at ?? current?.generated_at ?? null,
  };
}

export function useServiceGuidance({ workOrderId, enabled, canGenerate }) {
  const [guidanceState, setGuidanceState] = useState(null);
  const [pollingExpired, setPollingExpired] = useState(false);
  const pollAttemptsRef = useRef(0);
  const activeWorkOrderIdRef = useRef(null);

  const applyGuidance = useCallback((id, data) => {
    if (activeWorkOrderIdRef.current !== id) return;
    setGuidanceState((current) => mergeGuidanceState(current, data));
    if (data?.state !== 'generating') {
      pollAttemptsRef.current = 0;
      setPollingExpired(false);
    }
  }, []);

  const markFailed = useCallback((id) => {
    if (activeWorkOrderIdRef.current !== id) return;
    setGuidanceState((current) => ({
      ...current,
      state: 'failed',
    }));
  }, []);

  const startRefresh = useCallback(async (force) => {
    if (!enabled || !workOrderId || !canGenerate) return null;
    const id = workOrderId;
    try {
      const data = await refreshWorkOrderServiceGuidance(id, { force });
      applyGuidance(id, data);
      return data;
    } catch {
      markFailed(id);
      return null;
    }
  }, [applyGuidance, canGenerate, enabled, markFailed, workOrderId]);

  const refresh = useCallback(() => {
    pollAttemptsRef.current = 0;
    setPollingExpired(false);
    return startRefresh(true);
  }, [startRefresh]);

  useEffect(() => {
    const id = enabled && workOrderId ? workOrderId : null;
    activeWorkOrderIdRef.current = id;
    pollAttemptsRef.current = 0;
    setPollingExpired(false);
    setGuidanceState(null);
    if (!id) return undefined;

    let cancelled = false;
    getWorkOrderServiceGuidance(id)
      .then(async (data) => {
        if (cancelled) return;
        applyGuidance(id, data);
        if ((data?.state === 'missing' || data?.state === 'failed') && canGenerate) {
          await startRefresh(false);
        }
      })
      .catch(() => {
        if (!cancelled) markFailed(id);
      });

    return () => {
      cancelled = true;
      if (activeWorkOrderIdRef.current === id) activeWorkOrderIdRef.current = null;
    };
  }, [applyGuidance, canGenerate, enabled, markFailed, startRefresh, workOrderId]);

  const checkGuidance = useCallback(async () => {
    if (!enabled || !workOrderId) return;
    const id = workOrderId;
    try {
      const data = await getWorkOrderServiceGuidance(id);
      applyGuidance(id, data);
      if (data?.state === 'stale' && canGenerate) {
        await startRefresh(true);
      }
    } catch {
      markFailed(id);
    }
  }, [applyGuidance, canGenerate, enabled, markFailed, startRefresh, workOrderId]);

  useEffect(() => {
    if (!enabled || !workOrderId) return undefined;
    const interval = setInterval(checkGuidance, 15000);
    return () => clearInterval(interval);
  }, [checkGuidance, enabled, workOrderId]);

  const pollGuidance = useCallback(async () => {
    if (!enabled || !workOrderId || pollAttemptsRef.current >= 10) return;
    const id = workOrderId;
    pollAttemptsRef.current += 1;
    try {
      const data = await getWorkOrderServiceGuidance(id);
      applyGuidance(id, data);
      if (data?.state === 'generating' && pollAttemptsRef.current >= 10) {
        setPollingExpired(true);
      }
    } catch {
      markFailed(id);
    }
  }, [applyGuidance, enabled, markFailed, workOrderId]);

  useEffect(() => {
    if (guidanceState?.state !== 'generating' || pollingExpired) return undefined;
    const interval = setInterval(pollGuidance, 2000);
    return () => clearInterval(interval);
  }, [guidanceState?.state, pollingExpired, pollGuidance]);

  return {
    guidanceState: guidanceState?.state || 'missing',
    guidance: guidanceState?.guidance || null,
    generatedAt: guidanceState?.generated_at || null,
    pollingExpired,
    refresh,
  };
}
