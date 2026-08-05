import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');
const { getPromotionChannels, getPromotionOverview } = await import('../services/api.js');
const {
  buildLinePoints,
  formatChange,
  formatMetric,
  statusTone,
} = await import('./promotionAnalyticsView.js');

test('promotion analytics page shell supplies bilingual accessible copy', async () => {
  const page = await readFile(new URL('./PromotionAnalyticsPage.jsx', import.meta.url), 'utf8');

  assert.match(page, /Promotion Analytics/);
  assert.match(page, /推广分析/);
  assert.match(page, /runtimeConfig\.locale/);
  assert.match(page, /<h1/);
});

test('promotion analytics view helpers format empty metrics, ratios, changes, and safe SVG points', () => {
  assert.equal(formatMetric(null, 'percent', 'en'), '—');
  assert.equal(formatMetric(0.978, 'percent', 'en'), '97.8%');
  assert.equal(formatMetric(1234, 'number', 'en'), '1,234');
  assert.equal(formatChange(null, 'number', 'en'), '—');
  assert.equal(formatChange(-0.125, 'percent', 'en'), '−12.5%');
  assert.equal(formatChange(5, 'number', 'zh-CN'), '+5');
  assert.deepEqual(buildLinePoints([0, 5, 10], 100, 40), ['0,40', '50,20', '100,0']);
  assert.deepEqual(buildLinePoints([], 100, 40), []);
  assert.deepEqual(buildLinePoints([0, 0], 100, 40), ['0,40', '100,40']);
  assert.equal(statusTone('critical'), 'error');
  assert.equal(statusTone('warning'), 'warning');
  assert.equal(statusTone('normal'), 'success');
});

test('promotion overview contracts retain safe async, filter, status, and privacy behavior', async () => {
  const [page, filters, overview] = await Promise.all([
    readFile(new URL('./PromotionAnalyticsPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/promotion/PromotionFilters.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/promotion/PromotionOverview.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /AbortController/);
  assert.match(page, /controller\.abort\(\)/);
  assert.match(page, /reloadKey/);
  assert.match(page, /activeFilters/);
  assert.match(page, /Channel Analysis/);
  assert.match(page, /渠道分析/);
  assert.doesNotMatch(page, /getPromotionChannels\(/);
  assert.match(filters, /Asia\/Shanghai/);
  assert.match(filters, /maxLength=\{100\}/);
  assert.match(filters, /maxLength=\{200\}/);
  assert.match(filters, /allowedMarkets/);
  assert.match(overview, /AI success rate/);
  assert.match(overview, /AI 成功率/);
  assert.match(overview, /sampleStatus|sample_status/);
  assert.match(overview, /No data/);
  assert.match(overview, /暂无样本/);
  assert.match(overview, /Insufficient sample/);
  assert.match(overview, /样本不足/);
  assert.match(overview, /Operational reminders/);
  assert.match(overview, /运营提醒/);
  assert.match(overview, /Daily trend/);
  assert.match(overview, /每日趋势/);
  assert.doesNotMatch(`${page}\n${overview}`, /anonymous_id|session_id|ip_hash|user_agent|Ad spend|ROAS|CPA/i);
});

test('promotion analytics clients send only allowed encoded filters with request signal and cookie auth', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const calls = [];
  const signal = new AbortController().signal;

  globalThis.localStorage = {
    getItem(key) { return key === 'admin_token' ? 'legacy-token' : null; },
    setItem() {},
    removeItem() {},
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await getPromotionOverview({
      from: '2026-08-01', to: '2026-08-05', market: 'cn', source: 'Google & Partners', medium: 'cpc/paid', campaign: '夏季 + launch',
      admin_token: 'must-not-leak', arbitrary: 'must-not-leak',
    }, signal);
    await getPromotionChannels({}, signal);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }

  assert.equal(calls.length, 2);
  const overview = new URL(calls[0].url);
  assert.equal(overview.pathname, '/api/admin/analytics/overview');
  assert.deepEqual(Object.fromEntries(overview.searchParams), {
    from: '2026-08-01',
    to: '2026-08-05',
    market: 'cn',
    source: 'Google & Partners',
    medium: 'cpc/paid',
    campaign: '夏季 + launch',
  });
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer legacy-token');
  assert.equal(calls[1].url.includes('/api/admin/analytics/channels?'), false);
  assert.equal(calls[1].options.signal, signal);
  assert.match(api, /const PROMOTION_ANALYTICS_FILTER_KEYS = \['from', 'to', 'market', 'source', 'medium', 'campaign'\]/);
});
