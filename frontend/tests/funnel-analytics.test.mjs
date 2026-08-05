import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SESSION_IDLE_MS,
  createAnalyticsRequestId,
  resolveAnalyticsSession,
} from '../src/services/funnelAnalytics.js';

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test('resolveAnalyticsSession creates and stores a first session', () => {
  const storage = new MemoryStorage();
  const now = 1_000_000;

  const sessionId = resolveAnalyticsSession(storage, now, () => 'session_first');

  assert.equal(sessionId, 'session_first');
  assert.equal(storage.getItem('sagemro_analytics_session_id'), 'session_first');
  assert.equal(storage.getItem('sagemro_analytics_last_activity_ms'), String(now));
});

test('resolveAnalyticsSession reuses a session after 29 minutes', () => {
  const now = 1_000_000;
  const storage = new MemoryStorage({
    sagemro_analytics_session_id: 'session_existing',
    sagemro_analytics_last_activity_ms: String(now),
  });

  const sessionId = resolveAnalyticsSession(storage, now + (29 * 60 * 1000), () => 'session_new');

  assert.equal(sessionId, 'session_existing');
  assert.equal(storage.getItem('sagemro_analytics_last_activity_ms'), String(now + (29 * 60 * 1000)));
});

test('resolveAnalyticsSession reuses a session at exactly 30 minutes', () => {
  const now = 1_000_000;
  const storage = new MemoryStorage({
    sagemro_analytics_session_id: 'session_existing',
    sagemro_analytics_last_activity_ms: String(now),
  });

  assert.equal(resolveAnalyticsSession(storage, now + SESSION_IDLE_MS, () => 'session_new'), 'session_existing');
});

test('resolveAnalyticsSession rotates after 31 minutes from the most recently updated activity', () => {
  const now = 1_000_000;
  const storage = new MemoryStorage({
    sagemro_analytics_session_id: 'session_existing',
    sagemro_analytics_last_activity_ms: String(now),
  });

  resolveAnalyticsSession(storage, now + (29 * 60 * 1000), () => 'session_new');
  const sessionId = resolveAnalyticsSession(storage, now + (60 * 60 * 1000), () => 'session_rotated');

  assert.equal(sessionId, 'session_rotated');
  assert.equal(storage.getItem('sagemro_analytics_last_activity_ms'), String(now + (60 * 60 * 1000)));
});

test('resolveAnalyticsSession rotates stored session IDs with missing or invalid activity', () => {
  for (const lastActivity of [null, 'not-a-number']) {
    const values = { sagemro_analytics_session_id: 'session_existing' };
    if (lastActivity !== null) values.sagemro_analytics_last_activity_ms = lastActivity;
    const storage = new MemoryStorage(values);

    assert.equal(resolveAnalyticsSession(storage, 1_000_000, () => 'session_rotated'), 'session_rotated');
  }
});

test('resolveAnalyticsSession returns an ephemeral ID when storage throws', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };

  assert.equal(resolveAnalyticsSession(storage, 1_000_000, () => 'session_ephemeral'), 'session_ephemeral');
});

test('resolveAnalyticsSession does not reuse a stored ID when activity writes fail', () => {
  const storage = {
    getItem(key) {
      return {
        sagemro_analytics_session_id: 'session_existing',
        sagemro_analytics_last_activity_ms: '1000000',
      }[key] || null;
    },
    setItem() { throw new Error('blocked'); },
  };

  assert.equal(resolveAnalyticsSession(storage, 1_000_000, () => 'session_ephemeral'), 'session_ephemeral');
});

test('createAnalyticsRequestId uses the request prefix with an injected factory', () => {
  let receivedPrefix;
  const requestId = createAnalyticsRequestId((prefix) => {
    receivedPrefix = prefix;
    return `${prefix}_id_value`;
  });

  assert.equal(receivedPrefix, 'request');
  assert.equal(requestId, 'request_id_value');
});
