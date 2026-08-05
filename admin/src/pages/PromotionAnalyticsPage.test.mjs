import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');
const { getPromotionChannels, getPromotionOverview } = await import('../services/api.js');

test('promotion analytics page shell supplies bilingual accessible copy', async () => {
  const page = await readFile(new URL('./PromotionAnalyticsPage.jsx', import.meta.url), 'utf8');

  assert.match(page, /Promotion Analytics/);
  assert.match(page, /推广分析/);
  assert.match(page, /runtimeConfig\.locale/);
  assert.match(page, /<h1/);
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
