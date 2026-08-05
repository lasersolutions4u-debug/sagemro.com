import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');
const { getPromotionChannels, getPromotionOverview } = await import('../services/api.js');
const {
  buildLinePoints,
  formatChange,
  formatMetric,
  statusTone,
} = await import('./promotionAnalyticsView.js');
const vite = await createServer({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
});
const { PromotionAnalyticsPage } = await vite.ssrLoadModule('/src/pages/PromotionAnalyticsPage.jsx');
const { PromotionOverview } = await vite.ssrLoadModule('/src/components/promotion/PromotionOverview.jsx');

after(() => vite.close());

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function overviewFixture({ sampleStatus = 'ready', sessions = 20 } = {}) {
  const noData = sampleStatus === 'no_data';
  return {
    reporting_timezone: 'Asia/Shanghai',
    allowed_markets: ['com', 'cn'],
    filters: { from: '2026-08-01', to: '2026-08-05', markets: ['com'], source: '', medium: '', campaign: '' },
    health: { level: 'normal', reasons: [] },
    current: {
      sampleStatus,
      sessions: noData ? 0 : sessions,
      aiRequests: noData ? 0 : 10,
      aiSuccessRate: noData ? null : 0.9,
      registrationEvents: noData ? 0 : 3,
      serviceRequestEvents: noData ? 0 : 2,
      visitors: noData ? 0 : sessions,
      aiVisitors: noData ? 0 : 8,
      registrationVisitors: noData ? 0 : 3,
      serviceVisitors: noData ? 0 : 2,
    },
    previous: { sessions: 10, aiRequests: 5, aiSuccessRate: 0.8, registrationEvents: 1, serviceRequestEvents: 1 },
    daily: [{ date: '2026-08-01', sessions: noData ? 0 : sessions, serviceRequests: noData ? 0 : 2 }],
    data_quality: { coverageStart: '2026-08-01 00:05:00', legacyEvents: 1, missingAnonymousEvents: 0, attributionCoverage: 0.8 },
  };
}

function textContent(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node) return '';
  const children = Array.isArray(node) ? node : node.children;
  return (children || []).map(textContent).join('');
}

function findButton(root, label) {
  return root.findAllByType('button').find((button) => textContent(button) === label);
}

function findField(root, label) {
  return root.findAllByType('label').find((field) => field.children[0] === label).findByType('input');
}

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

test('draft filters wait for Apply and stale aborted responses cannot overwrite the active result', async () => {
  const first = deferred();
  const second = deferred();
  const requests = [];
  const loadOverview = (filters, signal) => {
    requests.push({ filters, signal });
    return requests.length === 1 ? first.promise : second.promise;
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, { loadOverview }));
  });

  assert.equal(requests.length, 1);
  await act(async () => {
    findField(renderer.root, 'Source').props.onChange({ target: { value: 'newsletter' } });
  });
  assert.equal(requests.length, 1);

  await act(async () => {
    findButton(renderer.root, 'Apply filters').props.onClick();
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].filters.source, 'newsletter');

  await act(async () => {
    second.resolve(overviewFixture({ sessions: 7 }));
    await second.promise;
  });
  assert.match(textContent(renderer.toJSON()), /7/);
  await act(async () => {
    first.resolve(overviewFixture({ sessions: 99 }));
    await first.promise;
  });
  assert.doesNotMatch(textContent(renderer.toJSON()), /99/);
  await act(async () => renderer.unmount());
});

test('tabs expose linked panels and support roving focus keyboard navigation without loading Channel data', async () => {
  const request = deferred();
  const calls = [];
  let focused = '';
  const loadOverview = (filters, signal) => {
    calls.push({ filters, signal });
    return request.promise;
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, { loadOverview }), {
      createNodeMock(element) {
        return element.props?.role === 'tab' ? { focus: () => { focused = element.props.id; } } : {};
      },
    });
  });

  let tabs = renderer.root.findAll((node) => node.props.role === 'tab');
  assert.deepEqual(tabs.map((tab) => [tab.props.id, tab.props['aria-controls'], tab.props.tabIndex]), [
    ['promotion-overview-tab', 'promotion-overview-panel', 0],
    ['promotion-channels-tab', 'promotion-channels-panel', -1],
  ]);
  let panel = renderer.root.findByProps({ role: 'tabpanel' });
  assert.equal(panel.props.id, 'promotion-overview-panel');
  assert.equal(panel.props['aria-labelledby'], 'promotion-overview-tab');

  let prevented = 0;
  await act(async () => {
    tabs[0].props.onKeyDown({ key: 'ArrowRight', preventDefault: () => { prevented += 1; } });
  });
  tabs = renderer.root.findAll((node) => node.props.role === 'tab');
  assert.equal(focused, 'promotion-channels-tab');
  assert.equal(tabs[1].props['aria-selected'], true);
  assert.equal(prevented, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, true);
  panel = renderer.root.findByProps({ role: 'tabpanel' });
  assert.equal(panel.props.id, 'promotion-channels-panel');
  assert.equal(panel.props['aria-labelledby'], 'promotion-channels-tab');

  await act(async () => {
    tabs[1].props.onKeyDown({ key: 'Home', preventDefault: () => { prevented += 1; } });
  });
  tabs = renderer.root.findAll((node) => node.props.role === 'tab');
  assert.equal(focused, 'promotion-overview-tab');
  assert.equal(tabs[0].props['aria-selected'], true);
  assert.equal(calls.length, 2);
  await act(async () => {
    tabs[0].props.onKeyDown({ key: 'Enter', preventDefault: () => { prevented += 1; } });
  });
  assert.equal(prevented, 2);
  await act(async () => {
    tabs[0].props.onKeyDown({ key: 'End', preventDefault: () => { prevented += 1; } });
  });
  tabs = renderer.root.findAll((node) => node.props.role === 'tab');
  assert.equal(focused, 'promotion-channels-tab');
  assert.equal(tabs[1].props['aria-selected'], true);
  assert.equal(calls.length, 2);
  await act(async () => {
    tabs[1].props.onKeyDown({ key: 'ArrowLeft', preventDefault: () => { prevented += 1; } });
  });
  tabs = renderer.root.findAll((node) => node.props.role === 'tab');
  assert.equal(focused, 'promotion-overview-tab');
  assert.equal(tabs[0].props['aria-selected'], true);
  assert.equal(calls.length, 3);
  assert.equal(prevented, 4);
  await act(async () => renderer.unmount());
});

test('Retry reloads the active filters without applying later draft edits', async () => {
  const third = deferred();
  const requests = [];
  const loadOverview = (filters, signal) => {
    requests.push({ filters, signal });
    if (requests.length === 1) return Promise.resolve(overviewFixture());
    if (requests.length === 2) return Promise.reject(new Error('D1 temporarily unavailable'));
    return third.promise;
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, { loadOverview }));
  });
  await act(async () => {
    findField(renderer.root, 'Source').props.onChange({ target: { value: 'paid' } });
  });
  await act(async () => {
    findButton(renderer.root, 'Apply filters').props.onClick();
  });
  assert.match(textContent(renderer.toJSON()), /D1 temporarily unavailable/);
  await act(async () => {
    findField(renderer.root, 'Source').props.onChange({ target: { value: 'unapplied-draft' } });
  });
  await act(async () => {
    findButton(renderer.root, 'Retry').props.onClick();
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[1].filters.source, 'paid');
  assert.equal(requests[2].filters.source, 'paid');
  await act(async () => renderer.unmount());
});

test('no-data and insufficient-sample states render their bilingual runtime copy', () => {
  const noData = TestRenderer.create(React.createElement(PromotionOverview, { data: overviewFixture({ sampleStatus: 'no_data' }), isCn: false }));
  const insufficient = TestRenderer.create(React.createElement(PromotionOverview, { data: overviewFixture({ sampleStatus: 'insufficient', sessions: 5 }), isCn: true }));
  assert.match(textContent(noData.toJSON()), /No data/);
  assert.match(textContent(noData.toJSON()), /—/);
  assert.match(textContent(insufficient.toJSON()), /样本不足/);
  noData.unmount();
  insufficient.unmount();
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
