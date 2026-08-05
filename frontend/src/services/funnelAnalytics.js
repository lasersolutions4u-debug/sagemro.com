export const ANALYTICS_VERSION = '2';
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export function createAnalyticsId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function resolveAnalyticsSession(storage, now = Date.now(), idFactory = createAnalyticsId) {
  try {
    const storedId = storage.getItem('sagemro_analytics_session_id');
    const storedActivity = storage.getItem('sagemro_analytics_last_activity_ms');
    const activity = Number(storedActivity);
    const canReuse = Boolean(storedId)
      && storedActivity !== null
      && storedActivity !== undefined
      && storedActivity !== ''
      && Number.isFinite(activity)
      && now - activity <= SESSION_IDLE_MS;

    const sessionId = canReuse ? storedId : idFactory('session');
    storage.setItem('sagemro_analytics_session_id', sessionId);
    storage.setItem('sagemro_analytics_last_activity_ms', String(now));
    return sessionId;
  } catch {
    return idFactory('session');
  }
}

export function createAnalyticsRequestId(idFactory = createAnalyticsId) {
  return idFactory('request');
}
