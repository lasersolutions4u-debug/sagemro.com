import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getWorkOrderServiceGuidance,
  refreshWorkOrderServiceGuidance,
} from '../services/api';

// TESTABLE_GUIDANCE_COORDINATOR_START
export function createGuidanceRequestCoordinator(maxPollAttempts = 10) {
  let epoch = 0;
  let sequence = 0;
  let pollAttempts = 0;
  let refreshSequence = null;

  const beginRequest = () => {
    if (refreshSequence !== null) return null;
    sequence += 1;
    return { epoch, sequence };
  };

  return {
    reset() {
      epoch += 1;
      sequence = 0;
      pollAttempts = 0;
      refreshSequence = null;
    },
    beginRequest,
    beginRefresh() {
      sequence += 1;
      refreshSequence = sequence;
      return { epoch, sequence };
    },
    beginGenerationRound() {
      pollAttempts = 0;
    },
    beginPoll() {
      if (refreshSequence !== null) return null;
      if (pollAttempts >= maxPollAttempts) return null;
      pollAttempts += 1;
      return {
        token: beginRequest(),
        attempt: pollAttempts,
      };
    },
    isLatest(token) {
      return token?.epoch === epoch && token?.sequence === sequence;
    },
    isRefreshPending() {
      return refreshSequence !== null;
    },
    finish(token) {
      if (token?.epoch === epoch && token?.sequence === refreshSequence) {
        refreshSequence = null;
      }
    },
  };
}
// TESTABLE_GUIDANCE_COORDINATOR_END

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
  const activeWorkOrderIdRef = useRef(null);
  const requestCoordinatorRef = useRef(createGuidanceRequestCoordinator());

  const applyGuidance = useCallback((id, token, data) => {
    if (activeWorkOrderIdRef.current !== id
      || !requestCoordinatorRef.current.isLatest(token)) return false;
    setGuidanceState((current) => mergeGuidanceState(current, data));
    if (data?.state !== 'generating') {
      setPollingExpired(false);
    }
    return true;
  }, []);

  const markFailed = useCallback((id, token) => {
    if (activeWorkOrderIdRef.current !== id
      || !requestCoordinatorRef.current.isLatest(token)) return;
    setGuidanceState((current) => ({
      ...current,
      state: 'failed',
    }));
  }, []);

  const startRefresh = useCallback(async (force) => {
    if (!enabled || !workOrderId || !canGenerate) return null;
    const id = workOrderId;
    requestCoordinatorRef.current.beginGenerationRound();
    const token = requestCoordinatorRef.current.beginRefresh();
    setPollingExpired(false);
    try {
      const data = await refreshWorkOrderServiceGuidance(id, { force });
      applyGuidance(id, token, data);
      return data;
    } catch {
      markFailed(id, token);
      return null;
    } finally {
      requestCoordinatorRef.current.finish(token);
    }
  }, [applyGuidance, canGenerate, enabled, markFailed, workOrderId]);

  const refresh = useCallback(() => {
    return startRefresh(true);
  }, [startRefresh]);

  useEffect(() => {
    const id = enabled && workOrderId ? workOrderId : null;
    const coordinator = requestCoordinatorRef.current;
    coordinator.reset();
    activeWorkOrderIdRef.current = id;
    setPollingExpired(false);
    setGuidanceState(null);
    if (!id) return undefined;

    let cancelled = false;
    const token = coordinator.beginRequest();
    getWorkOrderServiceGuidance(id)
      .then(async (data) => {
        if (cancelled) return;
        const applied = applyGuidance(id, token, data);
        if (applied
          && (data?.state === 'missing' || data?.state === 'failed')
          && canGenerate) {
          await startRefresh(false);
        }
      })
      .catch(() => {
        if (!cancelled) markFailed(id, token);
      });

    return () => {
      cancelled = true;
      if (activeWorkOrderIdRef.current === id) {
        activeWorkOrderIdRef.current = null;
        coordinator.reset();
      }
    };
  }, [applyGuidance, canGenerate, enabled, markFailed, startRefresh, workOrderId]);

  const checkGuidance = useCallback(async () => {
    if (!enabled || !workOrderId) return;
    const id = workOrderId;
    const token = requestCoordinatorRef.current.beginRequest();
    if (!token) return;
    try {
      const data = await getWorkOrderServiceGuidance(id);
      const applied = applyGuidance(id, token, data);
      if (applied && data?.state === 'stale' && canGenerate) {
        await startRefresh(true);
      }
    } catch {
      markFailed(id, token);
    }
  }, [applyGuidance, canGenerate, enabled, markFailed, startRefresh, workOrderId]);

  useEffect(() => {
    if (!enabled || !workOrderId) return undefined;
    const interval = setInterval(checkGuidance, 15000);
    return () => clearInterval(interval);
  }, [checkGuidance, enabled, workOrderId]);

  const pollGuidance = useCallback(async () => {
    if (!enabled || !workOrderId) return;
    const id = workOrderId;
    if (requestCoordinatorRef.current.isRefreshPending()) return;
    const poll = requestCoordinatorRef.current.beginPoll();
    if (!poll) {
      setPollingExpired(true);
      return;
    }
    try {
      const data = await getWorkOrderServiceGuidance(id);
      const applied = applyGuidance(id, poll.token, data);
      if (applied && data?.state === 'generating' && poll.attempt >= 10) {
        setPollingExpired(true);
      }
    } catch {
      markFailed(id, poll.token);
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
