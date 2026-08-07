import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

import {
  DIRECT_ATTRIBUTION_FILTER,
  PromotionAnalyticsInputError,
  buildEventWhere,
  evaluatePromotionHealth,
  loadOrganicAcquisition,
  loadPromotionChannels,
  loadPromotionOverview,
  mergeChannelRows,
  mergePromotionSnapshots,
  parsePromotionFilters,
  queryPromotionChannelsDb,
  queryPromotionOverviewDb,
  ratio,
  sanitizeAcquisitionDimension,
} from '../src/lib/promotionAnalytics.js';

const now = new Date('2026-08-05T06:00:00Z');
const DIRECT_SENTINEL = DIRECT_ATTRIBUTION_FILTER;

function filters(values, options = {}) {
  return parsePromotionFilters(new URLSearchParams(values), {
    allowedMarkets: ['com', 'cn'],
    now,
    ...options,
  });
}

function createD1Database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE funnel_events (
      id TEXT PRIMARY KEY, event_name TEXT NOT NULL, market TEXT NOT NULL DEFAULT 'com',
      anonymous_id TEXT, session_id TEXT, user_type TEXT, user_id TEXT,
      source TEXT, medium TEXT, campaign TEXT, page_path TEXT, referrer TEXT,
      properties_json TEXT, ip_hash TEXT, user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE admin_staff_accounts (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, is_active INTEGER NOT NULL,
      market_scope TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 0
    );
  `);
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
      };
    },
    close() { sqlite.close(); },
  };
}

function seedEvent(db, {
  id,
  eventName,
  anonymousId = 'anon-1',
  sessionId = 'session-1',
  source = 'google',
  medium = 'cpc',
  campaign = 'summer',
  pagePath = '/',
  properties = { analytics_version: '2' },
  createdAt = '2026-08-01 00:05:00',
}) {
  const statement = db.prepare(`
    INSERT INTO funnel_events (
      id, event_name, market, anonymous_id, session_id, source, medium, campaign, page_path,
      properties_json, created_at
    ) VALUES (?, ?, 'com', ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return statement.bind(
    id, eventName, anonymousId, sessionId, source, medium, campaign, pagePath,
    JSON.stringify(properties), createdAt,
  ).all();
}

async function seedComLikeEvents(db) {
  await seedEvent(db, { id: 'before-boundary', eventName: 'traffic_source_captured', createdAt: '2026-07-31 15:59:59' });
  await seedEvent(db, { id: 'visit-a', eventName: 'traffic_source_captured', anonymousId: 'anon-a', sessionId: 'session-a' });
  await seedEvent(db, { id: 'visit-b', eventName: 'traffic_source_captured', anonymousId: 'anon-b', sessionId: 'session-b' });
  await seedEvent(db, { id: 'visit-direct', eventName: 'traffic_source_captured', anonymousId: 'anon-c', sessionId: 'session-c', source: null, medium: null, campaign: null });
  await seedEvent(db, { id: 'ai-start-1', eventName: 'ai_conversation_started', anonymousId: 'anon-a', sessionId: 'session-a', properties: { analytics_version: '2', request_id: 'request-success' }, createdAt: '2026-08-01 01:00:00' });
  await seedEvent(db, { id: 'ai-success-1', eventName: 'ai_response_received', anonymousId: 'anon-a', sessionId: 'session-a', properties: { analytics_version: '2', request_id: 'request-success' }, createdAt: '2026-08-01 01:00:01' });
  await seedEvent(db, { id: 'ai-start-2', eventName: 'ai_conversation_started', anonymousId: 'anon-b', sessionId: 'session-b', properties: { analytics_version: '2', request_id: 'request-failed' }, createdAt: '2026-08-01 02:00:00' });
  await seedEvent(db, { id: 'signup-1', eventName: 'signup_completed', anonymousId: 'anon-a', sessionId: 'session-a' });
  await seedEvent(db, { id: 'signup-repeat', eventName: 'signup_completed', anonymousId: 'anon-a', sessionId: 'session-a', createdAt: '2026-08-01 03:00:00' });
  await seedEvent(db, { id: 'service-1', eventName: 'service_request_created', anonymousId: 'anon-b', sessionId: 'session-b' });
  await seedEvent(db, { id: 'service-repeat', eventName: 'service_request_created', anonymousId: 'anon-b', sessionId: 'session-b', createdAt: '2026-08-01 03:30:00' });
  await seedEvent(db, { id: 'legacy', eventName: 'traffic_source_captured', anonymousId: 'legacy-anon', sessionId: 'legacy-session', properties: {}, createdAt: '2026-08-01 04:00:00' });
  await seedEvent(db, { id: 'after-boundary', eventName: 'traffic_source_captured', createdAt: '2026-08-01 16:00:00' });
}

function queryFilters(overrides = {}) {
  return {
    fromUtc: '2026-07-31 16:00:00',
    toUtcExclusive: '2026-08-01 16:00:00',
    effectiveToUtcExclusive: '2026-08-01 16:00:00',
    source: '', medium: '', campaign: '', markets: ['com'],
    ...overrides,
  };
}

async function seedOrganicAcquisitionEvents(db) {
  const repairPage = '/services/laser-cutting-machine-repair';
  await seedEvent(db, { id: 'organic-google-landing', eventName: 'seo_landing_viewed', anonymousId: 'google-anon', sessionId: 'google-session', source: 'google_organic', medium: 'organic', pagePath: repairPage });
  await seedEvent(db, { id: 'organic-google-landing-duplicate', eventName: 'seo_landing_viewed', anonymousId: 'google-anon', sessionId: 'google-session', source: 'google_organic', medium: 'organic', pagePath: repairPage, createdAt: '2026-08-01 00:06:00' });
  await seedEvent(db, { id: 'organic-baidu-landing', eventName: 'seo_landing_viewed', anonymousId: 'baidu-anon', sessionId: 'baidu-session', source: 'baidu_organic', medium: 'organic', pagePath: '/services/press-brake-repair' });
  await seedEvent(db, { id: 'organic-chatgpt-landing', eventName: 'seo_landing_viewed', anonymousId: 'chatgpt-anon', sessionId: 'chatgpt-session', source: 'chatgpt_referral', medium: 'ai_referral', pagePath: '/insights/laser-repair' });
  await seedEvent(db, { id: 'organic-duplicate-landing', eventName: 'seo_landing_viewed', anonymousId: 'duplicate-anon', sessionId: 'duplicate-session', source: 'google_organic', medium: 'organic', pagePath: '/tools/metal-weight-calculator' });
  await seedEvent(db, { id: 'organic-duplicate-landing-repeat', eventName: 'seo_landing_viewed', anonymousId: 'duplicate-anon', sessionId: 'duplicate-session', source: 'google_organic', medium: 'organic', pagePath: '/tools/metal-weight-calculator', createdAt: '2026-08-01 00:06:00' });
  await seedEvent(db, { id: 'direct-landing', eventName: 'seo_landing_viewed', anonymousId: 'direct-anon', sessionId: 'direct-session', source: '', medium: 'direct', pagePath: repairPage });
  await seedEvent(db, { id: 'direct-landing-disguised', eventName: 'seo_landing_viewed', anonymousId: 'direct-disguised-anon', sessionId: 'direct-disguised-session', source: '', medium: 'organic', pagePath: repairPage });
  await seedEvent(db, { id: 'google-engaged', eventName: 'content_engaged', anonymousId: 'google-anon', sessionId: 'google-session', source: 'google_organic', medium: 'organic', pagePath: repairPage });
  await seedEvent(db, { id: 'chatgpt-engaged', eventName: 'content_engaged', anonymousId: 'chatgpt-anon', sessionId: 'chatgpt-session', source: 'chatgpt_referral', medium: 'ai_referral', pagePath: '/insights/laser-repair' });
  await seedEvent(db, { id: 'baidu-tool', eventName: 'tool_completed', anonymousId: 'baidu-anon', sessionId: 'baidu-session', source: 'baidu_organic', medium: 'organic', pagePath: '/tools/metal-weight-calculator' });
  await seedEvent(db, { id: 'google-cta-one', eventName: 'conversion_cta_clicked', anonymousId: 'google-anon', sessionId: 'google-session', source: 'google_organic', medium: 'organic', pagePath: repairPage });
  await seedEvent(db, { id: 'google-cta-two', eventName: 'conversion_cta_clicked', anonymousId: 'google-anon', sessionId: 'google-session', source: 'google_organic', medium: 'organic', pagePath: repairPage, createdAt: '2026-08-01 00:07:00' });
  await seedEvent(db, { id: 'google-ai', eventName: 'ai_conversation_started', anonymousId: 'google-anon', sessionId: 'google-session', source: 'google_organic', medium: 'organic', pagePath: repairPage, properties: { analytics_version: '2', request_id: 'organic-request' } });
  await seedEvent(db, { id: 'chatgpt-service', eventName: 'service_request_created', anonymousId: 'chatgpt-anon', sessionId: 'chatgpt-session', source: 'chatgpt_referral', medium: 'ai_referral', pagePath: '/insights/laser-repair' });
}

test('loadOrganicAcquisition aggregates only organic and AI-referral acquisition without identifiers', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedOrganicAcquisitionEvents(db);

  const result = await loadOrganicAcquisition({ com: db }, filters({
    from: '2026-08-01', to: '2026-08-01', market: 'com',
  }));

  assert.deepEqual(result.summary, {
    landingSessions: 4,
    engagedSessions: 2,
    toolCompletions: 1,
    ctaClicks: 2,
    aiRequests: 1,
    serviceRequests: 1,
  });
  assert.equal(result.pages[0].pagePath, '/services/laser-cutting-machine-repair');
  assert.equal(result.sources.some((row) => row.source === 'chatgpt_referral'), true);
  assert.equal(result.sources.some((row) => row.source === '' || row.source === 'direct'), false);
  assert.equal(result.reportingTimezone, 'Asia/Shanghai');
  assert.equal(/anonymous_id|session_id|user_id|properties_json|request_id|ip_hash|user_agent/i.test(JSON.stringify(result)), false);
});

test('loadOrganicAcquisition retains capped source and page totals in explicit other rows', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  for (let index = 0; index < 101; index += 1) {
    await seedEvent(db, {
      id: `organic-cap-${index}`,
      eventName: 'seo_landing_viewed',
      anonymousId: `cap-anon-${index}`,
      sessionId: `cap-session-${index}`,
      source: `source-${String(index).padStart(3, '0')}`,
      medium: 'organic',
      pagePath: `/insights/cap-${String(index).padStart(3, '0')}`,
    });
  }

  const result = await loadOrganicAcquisition({ com: db }, filters({
    from: '2026-08-01', to: '2026-08-01', market: 'com',
  }));

  assert.equal(result.pages.length, 100);
  assert.equal(result.sources.length, 100);
  assert.equal(result.pages.at(-1).pagePath, 'other');
  assert.equal(result.sources.at(-1).source, 'other');
  assert.equal(result.pages.reduce((total, row) => total + row.landingSessions, 0), 101);
  assert.equal(result.sources.reduce((total, row) => total + row.landingSessions, 0), 101);
});

test('loadOrganicAcquisition redacts and merges PII-like page and attribution dimensions', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedEvent(db, {
    id: 'unsafe-source-email',
    eventName: 'seo_landing_viewed',
    anonymousId: 'safe-anon',
    sessionId: 'safe-session',
    source: 'buyer@example.com',
    medium: 'organic',
    pagePath: '/services/laser-cutting-machine-repair',
  });
  await seedEvent(db, {
    id: 'unsafe-source-phone',
    eventName: 'seo_landing_viewed',
    anonymousId: 'safe-anon-2',
    sessionId: 'safe-session-2',
    source: '4155550123',
    medium: 'organic',
    pagePath: '/services/laser-cutting-machine-repair',
  });
  await seedEvent(db, {
    id: 'unsafe-page-phone',
    eventName: 'seo_landing_viewed',
    anonymousId: 'safe-anon-3',
    sessionId: 'safe-session-3',
    source: 'google_organic',
    medium: 'organic',
    pagePath: '/services/4155550123',
  });
  await seedEvent(db, {
    id: 'unsafe-page-contact',
    eventName: 'seo_landing_viewed',
    anonymousId: 'safe-anon-4',
    sessionId: 'safe-session-4',
    source: 'google_organic',
    medium: 'organic',
    pagePath: '/services/contact-buyer@example.com',
  });
  await seedEvent(db, {
    id: 'unsafe-medium-phone',
    eventName: 'seo_landing_viewed',
    anonymousId: 'safe-anon-5',
    sessionId: 'safe-session-5',
    source: 'google_organic',
    medium: '4155550123',
    pagePath: '/services/laser-cutting-machine-repair',
  });

  const result = await loadOrganicAcquisition({ com: db }, filters({
    from: '2026-08-01', to: '2026-08-01', market: 'com',
  }));

  const unknownPage = result.pages.find((row) => row.pagePath === 'unknown');
  const unknownSource = result.sources.find((row) => row.source === 'unknown' && row.medium === 'organic');
  const serialized = JSON.stringify(result);
  assert.equal(result.summary.landingSessions, 4);
  assert.equal(unknownPage.landingSessions, 2);
  assert.equal(unknownSource.landingSessions, 2);
  for (const rawValue of ['buyer@example.com', '4155550123', 'contact-buyer']) {
    assert.equal(serialized.includes(rawValue), false);
  }
  assert.equal(/anonymous_id|session_id|user_id|properties_json|request_id|ip_hash|user_agent/i.test(serialized), false);
});

test('acquisition dimension sanitizer preserves real date and v-prefixed version tokens without allowing phone-like values', () => {
  const cases = [
    ['page', '/insights/2026-08-07', '/insights/2026-08-07'],
    ['source', 'google_2026-08-07', 'google_2026-08-07'],
    ['medium', 'organic_2026-08-07', 'organic_2026-08-07'],
    ['page', '/release/v2.10.3', '/release/v2.10.3'],
    ['page', '/release/v2026.08.07', '/release/v2026.08.07'],
    ['source', 'google_v2.10.3', 'google_v2.10.3'],
    ['medium', 'organic_v2.10.3', 'organic_v2.10.3'],
    ['page', '/insights/13800138000', 'unknown'],
    ['source', '138-0013-8000', 'unknown'],
    ['medium', '+86 138 0013 8000', 'unknown'],
    ['page', '/insights/2026-08-07-13800138000', 'unknown'],
    ['source', 'google_2026-08-07_138-0013-8000', 'unknown'],
    ['medium', 'organic_v2.10.3+8613800138000', 'unknown'],
    ['medium', 'v2.10.3@example.com', 'unknown'],
    ['source', 'v13800138000.1', 'unknown'],
    ['page', '/insights/v13800138000.1', 'unknown'],
    ['medium', 'v1380.0138.0000', 'unknown'],
    ['source', 'google_2026-08-07_v2.10.3_13800138000', 'unknown'],
  ];

  for (const [dimension, value, expected] of cases) {
    assert.equal(sanitizeAcquisitionDimension(dimension, value), expected, `${dimension}: ${value}`);
  }
});

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

test('promotion overview accepts a live cutoff with non-zero milliseconds', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  const reportFilters = filters({
    from: '2026-08-01',
    to: '2026-08-05',
    market: 'com',
  }, { now: new Date('2026-08-05T06:00:00.123Z') });

  assert.equal(reportFilters.effectiveToUtcExclusive, '2026-08-05 05:55:00');
  const result = await loadPromotionOverview({ com: db }, reportFilters);
  assert.equal(result.current.sessions, 0);
  assert.equal(result.previous.sessions, 0);
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

test('buildEventWhere binds attribution filters instead of interpolating them', () => {
  const injectedSource = "x' OR 1=1 --";
  const where = buildEventWhere(queryFilters({ source: injectedSource, medium: 'cpc' }));

  assert.equal(where.sql.includes(injectedSource), false);
  assert.deepEqual(where.params, [
    '2026-07-31 16:00:00', '2026-08-01 16:00:00', injectedSource, 'cpc',
  ]);
  assert.equal(where.sql, 'created_at >= ? AND created_at < ? AND source = ? AND medium = ?');
});

test('direct attribution sentinel compiles to fixed COALESCE clauses without sentinel params', () => {
  const parsed = filters({
    from: '2026-08-01', to: '2026-08-05', market: 'com',
    source: DIRECT_SENTINEL, medium: DIRECT_SENTINEL, campaign: DIRECT_SENTINEL,
  });
  assert.equal(parsed.source, DIRECT_SENTINEL);
  assert.equal(parsed.medium, DIRECT_SENTINEL);
  assert.equal(parsed.campaign, DIRECT_SENTINEL);

  const where = buildEventWhere(queryFilters({
    source: DIRECT_SENTINEL, medium: DIRECT_SENTINEL, campaign: DIRECT_SENTINEL,
  }));
  assert.equal(where.sql, "created_at >= ? AND created_at < ? AND COALESCE(source, '') = '' AND COALESCE(medium, '') = '' AND COALESCE(campaign, '') = ''");
  assert.deepEqual(where.params, ['2026-07-31 16:00:00', '2026-08-01 16:00:00']);
  assert.equal(where.sql.includes(DIRECT_SENTINEL), false);
});

test('queryPromotionOverviewDb counts only v2 records with Shanghai report boundaries', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedComLikeEvents(db);

  const snapshot = await queryPromotionOverviewDb(db, queryFilters());

  assert.equal(snapshot.sessions, 3);
  assert.equal(snapshot.aiRequests, 2);
  assert.equal(snapshot.aiSuccesses, 1);
  assert.equal(snapshot.registrationEvents, 2);
  assert.equal(snapshot.serviceRequestEvents, 2);
  assert.equal(snapshot.visitors, 3);
  assert.equal(snapshot.aiVisitors, 2);
  assert.equal(snapshot.registrationVisitors, 1);
  assert.equal(snapshot.serviceVisitors, 1);
  assert.equal(snapshot.missingAnonymousEvents, 0);
  assert.equal(snapshot.unattributedSessions, 1);
  assert.equal(snapshot.legacyEvents, 1);
  assert.equal(snapshot.coverageStart, '2026-08-01 00:05:00');
  assert.equal(JSON.stringify(snapshot).match(/anonymous_id|session_id|request_id/), null);
});

test('queryPromotionChannelsDb normalizes direct attribution and uses unique converting visitors', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedComLikeEvents(db);

  const result = await queryPromotionChannelsDb(db, queryFilters());
  const direct = result.rows.find((row) => row.source === '');
  const google = result.rows.find((row) => row.source === 'google');

  assert.deepEqual(direct, {
    source: '', medium: '', campaign: '', sessions: 1, aiRequests: 0,
    aiSuccesses: 0, registrations: 0, serviceRequests: 0,
  });
  assert.equal(google.sessions, 2);
  assert.equal(google.aiRequests, 2);
  assert.equal(google.aiSuccesses, 1);
  assert.equal(google.registrations, 1);
  assert.equal(google.serviceRequests, 1);
  assert.deepEqual(result.daily, [{
    date: '2026-08-01', sessions: 3, aiRequests: 2, aiSuccesses: 1,
    registrations: 1, serviceRequests: 1,
  }]);
  assert.equal(JSON.stringify(result).match(/anonymous_id|session_id|request_id/), null);
});

test('orphan v2 AI responses do not count as successes in overview, daily, channels, or health', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedEvent(db, {
    id: 'orphan-response',
    eventName: 'ai_response_received',
    properties: { analytics_version: '2', request_id: 'orphan-request' },
  });

  const overview = await queryPromotionOverviewDb(db, queryFilters());
  const channels = await queryPromotionChannelsDb(db, queryFilters());
  const loaded = await loadPromotionOverview({ com: db }, queryFilters());

  assert.equal(overview.aiRequests, 0);
  assert.equal(overview.aiSuccesses, 0);
  assert.equal(overview.daily[0].aiSuccesses, 0);
  assert.equal(channels.rows.length, 0);
  assert.equal(channels.daily[0].aiSuccesses, 0);
  assert.deepEqual(loaded.recentAi, []);
  assert.deepEqual(loaded.health, { level: 'normal', reasons: [] });
  assert.equal(JSON.stringify({ overview, channels, loaded }).match(/request_id|orphan-request/), null);
});

test('channel grouping coalesces NULL and empty attribution before distinct aggregation', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedEvent(db, {
    id: 'direct-null', eventName: 'traffic_source_captured',
    anonymousId: 'direct-anon', sessionId: 'direct-session',
    source: null, medium: null, campaign: null,
  });
  await seedEvent(db, {
    id: 'direct-empty', eventName: 'traffic_source_captured',
    anonymousId: 'direct-anon', sessionId: 'direct-session',
    source: '', medium: '', campaign: '',
  });

  const { rows } = await queryPromotionChannelsDb(db, queryFilters());

  assert.deepEqual(rows, [{
    source: '', medium: '', campaign: '', sessions: 1, aiRequests: 0,
    aiSuccesses: 0, registrations: 0, serviceRequests: 0,
  }]);
});

test('direct attribution filters require source, medium, and campaign to all be empty', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedEvent(db, {
    id: 'direct-exact', eventName: 'traffic_source_captured',
    anonymousId: 'direct-exact-anon', sessionId: 'direct-exact-session',
    source: null, medium: null, campaign: null,
  });
  await seedEvent(db, {
    id: 'direct-medium', eventName: 'traffic_source_captured',
    anonymousId: 'direct-medium-anon', sessionId: 'direct-medium-session',
    source: null, medium: 'referral', campaign: null,
  });
  await seedEvent(db, {
    id: 'direct-campaign', eventName: 'traffic_source_captured',
    anonymousId: 'direct-campaign-anon', sessionId: 'direct-campaign-session',
    source: '', medium: '', campaign: 'brand',
  });

  const result = await queryPromotionChannelsDb(db, queryFilters({
    source: DIRECT_SENTINEL, medium: DIRECT_SENTINEL, campaign: DIRECT_SENTINEL,
  }));

  assert.deepEqual(result.rows, [{
    source: '', medium: '', campaign: '', sessions: 1, aiRequests: 0,
    aiSuccesses: 0, registrations: 0, serviceRequests: 0,
  }]);
  assert.deepEqual(result.daily, [{
    date: '2026-08-01', sessions: 1, aiRequests: 0, aiSuccesses: 0,
    registrations: 0, serviceRequests: 0,
  }]);
});

test('loadPromotionOverview merges market aggregates, previous period, and private recent statuses', async (t) => {
  const com = createD1Database();
  const cn = createD1Database();
  t.after(() => com.close());
  t.after(() => cn.close());
  await seedComLikeEvents(com);
  await seedEvent(cn, { id: 'cn-visit', eventName: 'traffic_source_captured', anonymousId: 'cn-anon', sessionId: 'cn-session', source: 'baidu', medium: 'cpc', campaign: 'cn-campaign', createdAt: '2026-08-01 12:00:00' });
  await seedEvent(cn, { id: 'cn-start', eventName: 'ai_conversation_started', anonymousId: 'cn-anon', sessionId: 'cn-session', source: 'baidu', medium: 'cpc', campaign: 'cn-campaign', properties: { analytics_version: '2', request_id: 'cn-failed' }, createdAt: '2026-08-01 12:01:00' });

  const result = await loadPromotionOverview({ com, cn }, queryFilters({ markets: ['com', 'cn'] }));

  assert.equal(result.current.sessions, 4);
  assert.equal(result.current.aiRequests, 3);
  assert.equal(result.current.aiSuccesses, 1);
  assert.equal(result.previous.sessions, 1);
  assert.deepEqual(result.daily, [{
    date: '2026-08-01', sessions: 4, aiRequests: 3, aiSuccesses: 1,
    registrations: 1, serviceRequests: 1,
  }]);
  assert.deepEqual(result.recentAi, [{ success: false }, { success: false }, { success: true }]);
  assert.equal(JSON.stringify(result).match(/anonymous_id|session_id|request_id|created_at|createdAt/), null);
});

test('loadPromotionOverview compares a partial same-day window with an equal effective interval', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  for (let index = 0; index < 20; index += 1) {
    await seedEvent(db, {
      id: `nominal-baseline-${index}`,
      eventName: 'traffic_source_captured',
      anonymousId: `nominal-anon-${index}`,
      sessionId: `nominal-session-${index}`,
      createdAt: '2026-08-03 20:00:00',
    });
  }
  await seedEvent(db, {
    id: 'partial-current', eventName: 'traffic_source_captured',
    anonymousId: 'partial-current-anon', sessionId: 'partial-current-session',
    createdAt: '2026-08-04 18:00:00',
  });

  const result = await loadPromotionOverview({ com: db }, filters({
    from: '2026-08-05', to: '2026-08-05', market: 'com',
  }));

  assert.equal(result.current.sessions, 1);
  assert.equal(result.previous.sessions, 0);
  assert.equal(result.health.reasons.some((reason) => reason.metric === 'traffic_drop'), false);
});

test('loadPromotionOverview keeps future-only comparisons empty and health neutral', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  for (let index = 0; index < 20; index += 1) {
    await seedEvent(db, {
      id: `future-nominal-baseline-${index}`,
      eventName: 'traffic_source_captured',
      anonymousId: `future-nominal-anon-${index}`,
      sessionId: `future-nominal-session-${index}`,
      createdAt: '2026-08-04 18:00:00',
    });
  }

  const result = await loadPromotionOverview({ com: db }, filters({
    from: '2026-08-06', to: '2026-08-06', market: 'com',
  }));

  assert.equal(result.current.sessions, 0);
  assert.equal(result.previous.sessions, 0);
  assert.equal(result.previous.sampleStatus, 'no_data');
  assert.deepEqual(result.health, { level: 'normal', reasons: [] });
});

test('loadPromotionChannels merges then orders and limits combined channel rows', async (t) => {
  const com = createD1Database();
  const cn = createD1Database();
  t.after(() => com.close());
  t.after(() => cn.close());
  await seedComLikeEvents(com);
  await seedEvent(cn, { id: 'cn-visit', eventName: 'traffic_source_captured', anonymousId: 'cn-anon', sessionId: 'cn-session', source: 'google', medium: 'cpc', campaign: 'summer', createdAt: '2026-08-01 12:00:00' });
  await seedEvent(cn, { id: 'cn-service', eventName: 'service_request_created', anonymousId: 'cn-anon', sessionId: 'cn-session', source: 'google', medium: 'cpc', campaign: 'summer', createdAt: '2026-08-01 12:01:00' });

  const result = await loadPromotionChannels({ com, cn }, queryFilters({ markets: ['com', 'cn'] }));

  assert.equal(result.rows[0].source, 'google');
  assert.equal(result.rows[0].serviceRequests, 2);
  assert.equal(result.rows[0].sessions, 3);
  assert.equal(result.rows.length <= 100, true);
  assert.deepEqual(result.daily, [{
    date: '2026-08-01', sessions: 4, aiRequests: 2, aiSuccesses: 1,
    registrations: 1, serviceRequests: 2,
  }]);
  assert.equal(JSON.stringify(result).match(/anonymous_id|session_id|request_id/), null);
});

test('loadPromotionChannels applies the 100-row limit only after the complete cross-market merge', async (t) => {
  const com = createD1Database();
  const cn = createD1Database();
  t.after(() => com.close());
  t.after(() => cn.close());

  for (const [market, db] of [['com', com], ['cn', cn]]) {
    for (let channel = 0; channel < 100; channel += 1) {
      for (let visitor = 0; visitor < 2; visitor += 1) {
        await seedEvent(db, {
          id: `${market}-service-${channel}-${visitor}`,
          eventName: 'service_request_created',
          anonymousId: `${market}-anon-${channel}-${visitor}`,
          sessionId: `${market}-session-${channel}-${visitor}`,
          source: `${market}-${String(channel).padStart(3, '0')}`,
        });
      }
    }
    await seedEvent(db, {
      id: `${market}-common-service`, eventName: 'service_request_created',
      anonymousId: `${market}-common-anon`, sessionId: `${market}-common-session`, source: 'z-common',
    });
    await seedEvent(db, {
      id: `${market}-common-registration`, eventName: 'signup_completed',
      anonymousId: `${market}-common-anon`, sessionId: `${market}-common-session`, source: 'z-common',
    });
  }

  const comRows = await queryPromotionChannelsDb(com, queryFilters());
  const result = await loadPromotionChannels({ com, cn }, queryFilters({ markets: ['com', 'cn'] }));

  assert.equal(comRows.rows.length, 101);
  assert.equal(result.rows.length, 100);
  assert.equal(result.rows[0].source, 'z-common');
  assert.equal(result.rows[0].serviceRequests, 2);
  assert.equal(result.rows[0].registrations, 2);
  assert.equal(result.summary.bestChannel.source, 'z-common');
  assert.equal(result.summary.attributableServiceRequests, 402);
});

test('channel summary independently aggregates the best channel and best campaign', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  const channelCampaigns = [
    { source: 'alpha', campaign: 'alpha-one', visitors: 6 },
    { source: 'alpha', campaign: 'alpha-two', visitors: 6 },
    { source: 'beta', campaign: 'winner', visitors: 10 },
  ];
  for (const { source, campaign, visitors } of channelCampaigns) {
    for (let visitor = 0; visitor < visitors; visitor += 1) {
      const identity = `${source}-${campaign}-${visitor}`;
      for (const eventName of ['traffic_source_captured', 'service_request_created']) {
        await seedEvent(db, {
          id: `${identity}-${eventName}`,
          eventName,
          anonymousId: `${identity}-anon`,
          sessionId: `${identity}-session`,
          source,
          medium: 'cpc',
          campaign,
        });
      }
    }
  }

  const { summary, rows } = await loadPromotionChannels({ com: db }, queryFilters());

  assert.equal(rows[0].campaign, 'winner');
  assert.deepEqual(summary.bestChannel, {
    source: 'alpha', medium: 'cpc', sessions: 12, aiRequests: 0, aiSuccesses: 0,
    registrations: 0, serviceRequests: 12, aiSuccessRate: null,
    sessionToRequestRate: 1, sampleStatus: 'insufficient',
  });
  assert.deepEqual(summary.bestCampaign, {
    campaign: 'winner', sessions: 10, aiRequests: 0, aiSuccesses: 0,
    registrations: 0, serviceRequests: 10, aiSuccessRate: null,
    sessionToRequestRate: 1, sampleStatus: 'insufficient',
  });
});

async function promotionApi(env, path, {
  auth,
  host = 'api.sagemro.com',
  method = 'GET',
  ctx = { waitUntil() {} },
} = {}) {
  const headers = { Origin: host.endsWith('.cn') ? 'https://admin.sagemro.cn' : 'https://admin.sagemro.com' };
  if (auth) {
    const token = await signJwt({
      iat: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...auth,
    }, env.JWT_SECRET);
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await worker.fetch(new Request(`https://${host}${path}`, { method, headers }), env, ctx);
  return { response, json: await response.clone().json().catch(() => ({})) };
}

function promotionEnv(com, cn = null) {
  return {
    DB: com,
    ...(cn ? { DB_CN: cn } : {}),
    JWT_SECRET: 'promotion-analytics-api-test-secret',
  };
}

async function seedStaff(db, id, role, marketScope = 'all', mustChangePassword = 0) {
  await db.prepare(`
    INSERT INTO admin_staff_accounts (id, role, is_active, market_scope, must_change_password)
    VALUES (?, ?, 1, ?, ?)
  `).bind(id, role, marketScope, mustChangePassword).all();
}

function staffAuth(id, role, market = 'com') {
  return { userId: id, userType: 'admin', staffId: id, staffRole: role, market };
}

test('promotion analytics endpoints enforce real worker authentication, roles, exact methods, and response privacy', async (t) => {
  const com = createD1Database();
  const cn = createD1Database();
  t.after(() => com.close());
  t.after(() => cn.close());
  await seedComLikeEvents(com);
  await seedEvent(cn, { id: 'cn-visit-api', eventName: 'traffic_source_captured', anonymousId: 'cn-anonymous-id', sessionId: 'cn-session-id', createdAt: '2026-08-01 12:00:00' });
  await Promise.all([
    seedStaff(com, 'staff-admin', 'admin'),
    seedStaff(com, 'staff-operations', 'operations'),
    seedStaff(com, 'staff-warehouse', 'warehouse'),
    seedStaff(com, 'staff-procurement', 'procurement'),
  ]);
  const env = promotionEnv(com, cn);
  const endpoint = '/api/admin/analytics/overview?from=2026-08-01&to=2026-08-01&market=com';
  const bootstrap = await promotionApi(env, endpoint, { auth: { userId: 'admin', userType: 'admin', market: 'com' } });
  const admin = await promotionApi(env, endpoint, { auth: staffAuth('staff-admin', 'admin') });
  const operations = await promotionApi(env, endpoint, { auth: staffAuth('staff-operations', 'operations') });
  const warehouse = await promotionApi(env, endpoint, { auth: staffAuth('staff-warehouse', 'warehouse') });
  const procurement = await promotionApi(env, endpoint, { auth: staffAuth('staff-procurement', 'procurement') });
  const customer = await promotionApi(env, endpoint, { auth: { userId: 'customer-1', userType: 'customer', market: 'com' } });
  const engineer = await promotionApi(env, endpoint, { auth: { userId: 'engineer-1', userType: 'engineer', market: 'com' } });
  const anonymous = await promotionApi(env, endpoint);
  const channels = await promotionApi(env, endpoint.replace('/overview', '/channels'), { auth: staffAuth('staff-operations', 'operations') });
  const acquisition = await promotionApi(env, endpoint.replace('/overview', '/organic-acquisition'), { auth: staffAuth('staff-operations', 'operations') });
  const post = await promotionApi(env, endpoint, { method: 'POST', auth: staffAuth('staff-operations', 'operations') });

  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(admin.response.status, 200);
  assert.equal(operations.response.status, 200);
  assert.equal(warehouse.response.status, 403);
  assert.equal(procurement.response.status, 403);
  assert.equal(customer.response.status, 403);
  assert.equal(engineer.response.status, 403);
  assert.equal(anonymous.response.status, 401);
  assert.equal(channels.response.status, 200);
  assert.equal(channels.response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(acquisition.response.status, 200);
  assert.equal(acquisition.response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(post.response.status, 403);
  assert.equal(bootstrap.json.reporting_timezone, 'Asia/Shanghai');
  assert.deepEqual(bootstrap.json.allowed_markets, ['com', 'cn']);
  assert.deepEqual(bootstrap.json.filters, {
    from: '2026-08-01', to: '2026-08-01', markets: ['com'], source: '', medium: '', campaign: '',
  });
  assert.ok(bootstrap.json.data_quality);
  assert.deepEqual(Object.keys(acquisition.json).sort(), ['dataQuality', 'pages', 'reportingTimezone', 'sources', 'summary']);
  assert.equal(acquisition.json.reportingTimezone, 'Asia/Shanghai');
  assert.equal(/anonymous_id|session_id|request_id|user_id|createdAt|created_at|user_agent|ip_hash|properties_json/i.test(JSON.stringify({ overview: bootstrap.json, channels: channels.json, acquisition: acquisition.json })), false);
});

test('promotion analytics preserves COM and CN bindings, merges all-market reads, and refuses unauthorized all-market requests', async (t) => {
  const com = createD1Database();
  const cn = createD1Database();
  t.after(() => com.close());
  t.after(() => cn.close());
  await seedComLikeEvents(com);
  await seedEvent(cn, { id: 'cn-visit-api', eventName: 'traffic_source_captured', anonymousId: 'cn-anon', sessionId: 'cn-session', createdAt: '2026-08-01 12:00:00' });
  await Promise.all([
    seedStaff(com, 'com-operations', 'operations', 'com'),
    seedStaff(cn, 'all-operations', 'operations', 'all'),
  ]);
  const env = promotionEnv(com, cn);
  const comOnly = staffAuth('com-operations', 'operations');
  const deniedCn = await promotionApi(env, '/api/admin/analytics/overview?from=2026-08-01&to=2026-08-01&market=cn', { auth: comOnly });
  const deniedAll = await promotionApi(env, '/api/admin/analytics/overview?from=2026-08-01&to=2026-08-01&market=all', { auth: comOnly });
  const allMarket = await promotionApi(env, '/api/admin/analytics/overview?from=2026-08-01&to=2026-08-01&market=all', {
    host: 'api.sagemro.cn', auth: staffAuth('all-operations', 'operations', 'cn'),
  });
  const cnOnly = await promotionApi(env, '/api/admin/analytics/channels?from=2026-08-01&to=2026-08-01&market=cn', {
    host: 'api.sagemro.cn', auth: staffAuth('all-operations', 'operations', 'cn'),
  });
  const deniedAcquisitionCn = await promotionApi(env, '/api/admin/analytics/organic-acquisition?from=2026-08-01&to=2026-08-01&market=cn', { auth: comOnly });
  const allAcquisition = await promotionApi(env, '/api/admin/analytics/organic-acquisition?from=2026-08-01&to=2026-08-01&market=all', {
    host: 'api.sagemro.cn', auth: staffAuth('all-operations', 'operations', 'cn'),
  });

  assert.equal(deniedCn.response.status, 403);
  assert.equal(deniedAll.response.status, 403);
  assert.equal(deniedAcquisitionCn.response.status, 403);
  assert.equal(allMarket.response.status, 200);
  assert.deepEqual(allMarket.json.filters.markets, ['com', 'cn']);
  assert.equal(allMarket.json.current.sessions, 4);
  assert.equal(cnOnly.response.status, 200);
  assert.equal(cnOnly.json.rows[0].sessions, 1);
  assert.equal(allAcquisition.response.status, 200);
});

test('promotion analytics maps invalid filters to 400 and reports unexpected query failures without raw query metadata', async (t) => {
  const db = createD1Database();
  t.after(() => db.close());
  await seedStaff(db, 'operations-error', 'operations', 'com');
  const env = promotionEnv(db);
  const auth = staffAuth('operations-error', 'operations');
  const invalidDate = await promotionApi(env, '/api/admin/analytics/overview?from=2026-8-01&to=2026-08-01&market=com', { auth });
  const overRange = await promotionApi(env, '/api/admin/analytics/channels?from=2026-05-01&to=2026-08-01&market=com', { auth });
  const invalidMarket = await promotionApi(env, '/api/admin/analytics/channels?from=2026-08-01&to=2026-08-01&market=de', { auth });
  const sentryPayloads = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sentryPayloads.push(String(init.body));
    return new Response('', { status: 200 });
  };
  const pending = [];
  const failingDb = {
    prepare(sql) {
      if (/FROM funnel_events/i.test(sql)) throw new Error('analytics database failed');
      return db.prepare(sql);
    },
  };
  try {
    const failed = await promotionApi({ ...env, DB: failingDb, SENTRY_DSN: 'https://public@example.invalid/1' }, '/api/admin/analytics/overview?from=2026-08-01&to=2026-08-01&market=com&sensitive=secret', {
      auth,
      ctx: { waitUntil(promise) { pending.push(promise); } },
    });
    await Promise.all(pending);
    assert.equal(failed.response.status, 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(invalidDate.response.status, 400);
  assert.equal(overRange.response.status, 400);
  assert.equal(invalidMarket.response.status, 400);
  assert.equal(sentryPayloads.length, 1);
  assert.equal(sentryPayloads[0].includes('sensitive=secret'), false);
  const sentryEvent = JSON.parse(sentryPayloads[0].split('\n').at(-1));
  assert.deepEqual(sentryEvent.extra, { feature: 'promotion_analytics', endpoint: 'overview' });
});
