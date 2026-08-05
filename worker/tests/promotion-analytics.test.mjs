import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PromotionAnalyticsInputError,
  evaluatePromotionHealth,
  mergeChannelRows,
  mergePromotionSnapshots,
  parsePromotionFilters,
  ratio,
} from '../src/lib/promotionAnalytics.js';

const now = new Date('2026-08-05T06:00:00Z');

function filters(values, options = {}) {
  return parsePromotionFilters(new URLSearchParams(values), {
    allowedMarkets: ['com', 'cn'],
    now,
    ...options,
  });
}

test('parsePromotionFilters uses inclusive Shanghai report days and a five-minute live cutoff', () => {
  assert.deepEqual(filters({
    from: '2026-08-01',
    to: '2026-08-05',
    market: 'all',
  }), {
    from: '2026-08-01',
    to: '2026-08-05',
    fromUtc: '2026-07-31 16:00:00',
    toUtcExclusive: '2026-08-05 16:00:00',
    effectiveToUtcExclusive: '2026-08-05 05:55:00',
    markets: ['com', 'cn'],
    source: '',
    medium: '',
    campaign: '',
  });
});

test('parsePromotionFilters accepts exactly 90 report days and rejects a 91-day range', () => {
  assert.equal(filters({
    from: '2026-05-08',
    to: '2026-08-05',
    market: 'com',
  }).markets[0], 'com');

  assert.throws(() => filters({
    from: '2026-05-07',
    to: '2026-08-05',
    market: 'com',
  }), PromotionAnalyticsInputError);
});

test('parsePromotionFilters rejects malformed and non-round-trip dates', () => {
  for (const dates of [
    { from: '2026-8-01', to: '2026-08-05' },
    { from: '2026-02-29', to: '2026-08-05' },
    { from: '2026-08-06', to: '2026-08-05' },
  ]) {
    assert.throws(() => filters({ ...dates, market: 'com' }), (error) => {
      assert.equal(error.status, 400);
      return error instanceof PromotionAnalyticsInputError;
    });
  }
});

test('parsePromotionFilters rejects invalid or unauthorized markets and normalizes text filters', () => {
  assert.throws(() => filters({
    from: '2026-08-01', to: '2026-08-05', market: 'de',
  }), PromotionAnalyticsInputError);
  assert.throws(() => filters({
    from: '2026-08-01', to: '2026-08-05', market: 'cn',
  }, { allowedMarkets: ['com'] }), PromotionAnalyticsInputError);
  assert.throws(() => filters({
    from: '2026-08-01', to: '2026-08-05', market: 'all',
  }, { allowedMarkets: [] }), PromotionAnalyticsInputError);

  const parsed = filters({
    from: '2026-08-01', to: '2026-08-05', market: 'com',
    source: ` ${'s'.repeat(150)} `, medium: ` ${'m'.repeat(150)} `, campaign: ` ${'x'.repeat(250)} `,
  });
  assert.equal(parsed.source.length, 100);
  assert.equal(parsed.medium.length, 100);
  assert.equal(parsed.campaign.length, 200);
});

test('ratio returns null for zero and missing denominators', () => {
  assert.equal(ratio(3, 4), 0.75);
  assert.equal(ratio(-3, 4), 0);
  assert.equal(ratio(3, 0), null);
  assert.equal(ratio(3, null), null);
});

test('mergePromotionSnapshots sums raw counts and recomputes rates', () => {
  const merged = mergePromotionSnapshots([
    { sessions: 40, aiRequests: 10, aiSuccesses: 10, registrationEvents: 2, serviceRequestEvents: 2 },
    { sessions: 60, aiRequests: 90, aiSuccesses: 45, registrationEvents: 18, serviceRequestEvents: 5 },
  ]);

  assert.equal(merged.sessions, 100);
  assert.equal(merged.aiRequests, 100);
  assert.equal(merged.aiSuccesses, 55);
  assert.equal(merged.registrationEvents, 20);
  assert.equal(merged.serviceRequestEvents, 7);
  assert.equal(merged.aiSuccessRate, 0.55);
  assert.equal(merged.sessionToRequestRate, 0.07);
  assert.equal(merged.sampleStatus, 'ready');
  assert.equal(mergePromotionSnapshots([{ sessions: 0 }]).sampleStatus, 'no_data');
  assert.equal(mergePromotionSnapshots([{ sessions: 19 }]).sampleStatus, 'insufficient');
});

test('mergePromotionSnapshots accepts legacy count aliases without double-counting canonical event fields', () => {
  const merged = mergePromotionSnapshots([
    { sessions: 50, registrations: 3, serviceRequests: 2 },
    {
      sessions: 50,
      registrationEvents: 4,
      registrations: 40,
      serviceRequestEvents: 5,
      serviceRequests: 50,
    },
  ]);

  assert.equal(merged.registrationEvents, 7);
  assert.equal(merged.serviceRequestEvents, 7);
  assert.equal(merged.sessionToRegistrationRate, 0.07);
  assert.equal(merged.sessionToRequestRate, 0.07);
});

test('mergeChannelRows combines matching channels and recalculates rates and sample status', () => {
  const [google] = mergeChannelRows([
    [{ source: 'google', medium: 'cpc', campaign: 'summer', sessions: 10, aiRequests: 10, aiSuccesses: 10, registrations: 1, serviceRequests: 1 }],
    [{ source: 'google', medium: 'cpc', campaign: 'summer', sessions: 20, aiRequests: 90, aiSuccesses: 45, registrations: 9, serviceRequests: 9 }],
    [{ source: '', medium: '', campaign: '', sessions: 19 }],
  ]);
  const direct = mergeChannelRows([
    [{ source: '', medium: '', campaign: '', sessions: 19 }],
  ])[0];
  const empty = mergeChannelRows([
    [{ source: 'empty', sessions: 0 }],
  ])[0];

  assert.deepEqual(google, {
    source: 'google', medium: 'cpc', campaign: 'summer',
    sessions: 30, aiRequests: 100, aiSuccesses: 55, registrations: 10, serviceRequests: 10,
    aiSuccessRate: 0.55, sessionToRequestRate: 10 / 30, sampleStatus: 'ready',
  });
  assert.equal(direct.sampleStatus, 'insufficient');
  assert.equal(empty.sampleStatus, 'no_data');
});

test('negative and non-finite counts are clamped before rates and health evaluation', () => {
  const snapshot = mergePromotionSnapshots([{
    sessions: -10,
    aiRequests: Number.POSITIVE_INFINITY,
    aiSuccesses: -2,
    registrationEvents: -3,
    serviceRequestEvents: -4,
  }]);
  assert.equal(snapshot.sessions, 0);
  assert.equal(snapshot.aiRequests, 0);
  assert.equal(snapshot.aiSuccesses, 0);
  assert.equal(snapshot.registrationEvents, 0);
  assert.equal(snapshot.serviceRequestEvents, 0);
  assert.equal(snapshot.aiSuccessRate, null);
  assert.equal(snapshot.sessionToRequestRate, null);

  const [channel] = mergeChannelRows([[{
    source: 'invalid',
    sessions: -10,
    aiRequests: -3,
    aiSuccesses: -2,
    registrations: -1,
    serviceRequests: Number.NaN,
  }]]);
  assert.equal(channel.sessions, 0);
  assert.equal(channel.aiRequests, 0);
  assert.equal(channel.aiSuccesses, 0);
  assert.equal(channel.registrations, 0);
  assert.equal(channel.serviceRequests, 0);
  assert.equal(channel.sampleStatus, 'no_data');

  const health = evaluatePromotionHealth(
    { aiRequests: 20, aiSuccesses: -1, sessions: 20, serviceRequestEvents: -1, unattributedSessions: -1 },
    { sessions: 20, serviceRequestEvents: 10 },
    [],
  );
  assert.equal(health.reasons.every((item) => item.value >= 0), true);
});

test('evaluatePromotionHealth honors AI success-rate thresholds and sample minimum', () => {
  const previous = { sessions: 100 };
  const base = { sessions: 100, unattributedSessions: 0 };

  assert.equal(evaluatePromotionHealth(
    { ...base, aiRequests: 20, aiSuccesses: 19 }, previous, [],
  ).level, 'normal');
  const warning = evaluatePromotionHealth(
    { ...base, aiRequests: 20, aiSuccesses: 18 }, previous, [],
  );
  assert.equal(warning.level, 'warning');
  assert.deepEqual(warning.reasons[0], {
    metric: 'ai_success_rate', level: 'warning', value: 0.9, threshold: 0.95, sampleCount: 20,
  });
  assert.equal(evaluatePromotionHealth(
    { ...base, aiRequests: 20, aiSuccesses: 17 }, previous, [],
  ).level, 'critical');
  assert.equal(evaluatePromotionHealth(
    { ...base, aiRequests: 19, aiSuccesses: 0 }, previous, [],
  ).level, 'normal');
});

test('evaluatePromotionHealth flags recent consecutive AI failures as critical', () => {
  const health = evaluatePromotionHealth(
    { aiRequests: 100, aiSuccesses: 89, sessions: 100, unattributedSessions: 10 },
    { sessions: 100 },
    [{ success: false }, { success: false }, { success: false }, { success: false }, { success: false }],
  );

  assert.equal(health.level, 'critical');
  assert.deepEqual(health.reasons.find((reason) => reason.metric === 'recent_ai_failures'), {
    metric: 'recent_ai_failures', level: 'critical', value: 5, threshold: 5, sampleCount: 5,
  });
});

test('evaluatePromotionHealth flags traffic, conversion, and attribution quality at exact thresholds', () => {
  const health = evaluatePromotionHealth(
    { sessions: 60, serviceRequestEvents: 4, unattributedSessions: 18 },
    { sessions: 100, serviceRequestEvents: 10 },
    [],
  );

  assert.equal(health.level, 'warning');
  assert.deepEqual(health.reasons.map(({ metric, level, value, threshold, sampleCount }) => ({ metric, level, value, threshold, sampleCount })), [
    { metric: 'traffic_drop', level: 'warning', value: 0.4, threshold: 0.4, sampleCount: 100 },
    { metric: 'conversion_drop', level: 'warning', value: (0.1 - (4 / 60)) / 0.1, threshold: 0.3, sampleCount: 60 },
    { metric: 'unattributed_sessions', level: 'warning', value: 0.3, threshold: 0.3, sampleCount: 60 },
  ]);
});

test('evaluatePromotionHealth ignores conversion warnings with zero or undersized denominators', () => {
  for (const [current, previous] of [
    [{ sessions: 0, serviceRequests: 0 }, { sessions: 100, serviceRequests: 100 }],
    [{ sessions: 19, serviceRequests: 0 }, { sessions: 100, serviceRequests: 100 }],
    [{ sessions: 100, serviceRequests: 0 }, { sessions: 19, serviceRequests: 19 }],
  ]) {
    assert.equal(evaluatePromotionHealth(current, previous, []).reasons.some((reason) => (
      reason.metric === 'conversion_drop'
    )), false);
  }
});

test('evaluatePromotionHealth warns at an exact 30 percent conversion drop', () => {
  const health = evaluatePromotionHealth(
    { sessions: 100, serviceRequestEvents: 7 },
    { sessions: 100, serviceRequestEvents: 10 },
    [],
  );

  assert.deepEqual(health.reasons, [{
    metric: 'conversion_drop', level: 'warning', value: (0.1 - 0.07) / 0.1, threshold: 0.3, sampleCount: 100,
  }]);
});

test('evaluatePromotionHealth does not miss a mathematical 30 percent drop due to floating point rounding', () => {
  const health = evaluatePromotionHealth(
    { sessions: 200, serviceRequestEvents: 133 },
    { sessions: 20, serviceRequestEvents: 19 },
    [],
  );

  const conversionReason = health.reasons.find((item) => item.metric === 'conversion_drop');
  assert.equal(health.level, 'warning');
  assert.equal(conversionReason.threshold, 0.3);
  assert.equal(conversionReason.value < 0.3, true);
});
