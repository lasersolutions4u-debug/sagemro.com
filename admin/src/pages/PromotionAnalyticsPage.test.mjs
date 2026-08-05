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
  filterChannelRows,
  formatChange,
  formatMetric,
  sortChannelRows,
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

function channelsFixture({ rows = channelRows(), daily = null } = {}) {
  return {
    reporting_timezone: 'Asia/Shanghai',
    allowed_markets: ['com', 'cn'],
    filters: { from: '2026-08-01', to: '2026-08-05', markets: ['com'], source: '', medium: '', campaign: '' },
    rows,
    daily: daily || [{ date: '2026-08-01', sessions: 24, aiRequests: 12, serviceRequests: 3 }],
    summary: {
      bestChannel: { source: 'google', medium: 'cpc', sessions: 40, serviceRequests: 4 },
      bestCampaign: { campaign: 'summer-launch', sessions: 40, serviceRequests: 4 },
      attributableServiceRequests: 6,
      attributionCoverage: 0.75,
    },
    data_quality: { attributionCoverage: 0.75 },
  };
}

function channelRows() {
  return [
    { source: 'google', medium: 'cpc', campaign: 'summer-launch', sessions: 40, aiRequests: 20, aiSuccesses: 19, registrations: 6, serviceRequests: 4 },
    { source: 'linkedin', medium: 'paid', campaign: 'industrial', sessions: 20, aiRequests: 10, aiSuccesses: 8, registrations: 4, serviceRequests: 4 },
    { source: '', medium: '', campaign: '', sessions: 6, aiRequests: 2, aiSuccesses: 1, registrations: 0, serviceRequests: 0 },
  ];
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

function findSelectField(root, label) {
  return root.findAllByType('label').find((field) => field.children[0] === label).findByType('select');
}

function metricText(root, label) {
  const labelNode = root.findAllByType('p').find((node) => textContent(node) === label);
  return textContent(labelNode.parent);
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

test('channel helpers sort stably without mutation and locally filter source, medium, and campaign', () => {
  const rows = [
    { source: 'zeta', medium: 'email', campaign: 'fall', sessions: 20, registrations: 2, serviceRequests: 1, aiSuccessRate: null },
    { source: 'alpha', medium: 'cpc', campaign: 'spring', sessions: 40, registrations: 2, serviceRequests: 4, aiSuccessRate: 0.8 },
    { source: 'beta', medium: 'paid', campaign: 'link launch', sessions: 20, registrations: 3, serviceRequests: 4, aiSuccessRate: 0.9 },
    { source: 'gamma', medium: 'paid', campaign: 'link launch', sessions: 20, registrations: 3, serviceRequests: 4, aiSuccessRate: null },
  ];
  const snapshot = [...rows];
  assert.deepEqual(sortChannelRows(rows).map((row) => row.source), ['beta', 'gamma', 'alpha', 'zeta']);
  assert.deepEqual(rows, snapshot);
  assert.deepEqual(sortChannelRows(rows, 'aiSuccessRate', 'desc').map((row) => row.source), ['beta', 'alpha', 'gamma', 'zeta']);
  assert.deepEqual(sortChannelRows(rows, 'aiSuccessRate', 'asc').map((row) => row.source), ['alpha', 'beta', 'gamma', 'zeta']);
  assert.deepEqual(filterChannelRows(rows, 'LINK').map((row) => row.source), ['beta', 'gamma']);
  assert.deepEqual(filterChannelRows(rows, 'EMAIL').map((row) => row.source), ['zeta']);
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
  assert.match(page, /getPromotionChannels/);
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

test('settled requests cannot publish state after switching tabs or unmounting', async () => {
  const lateResolve = deferred();
  let commits = 0;
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(
      React.Profiler,
      { id: 'promotion-page', onRender: () => { commits += 1; } },
      React.createElement(PromotionAnalyticsPage, { loadOverview: () => lateResolve.promise }),
    ));
  });
  await act(async () => {
    findButton(renderer.root, 'Channel Analysis').props.onClick();
  });
  const commitsAfterSwitch = commits;
  await act(async () => {
    lateResolve.resolve(overviewFixture({ sessions: 99 }));
    await lateResolve.promise;
  });
  assert.equal(commits, commitsAfterSwitch);
  assert.doesNotMatch(textContent(renderer.toJSON()), /99/);
  await act(async () => renderer.unmount());

  const lateReject = deferred();
  const consoleErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => { consoleErrors.push(args); };
  try {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, { loadOverview: () => lateReject.promise }));
    });
    await act(async () => renderer.unmount());
    await act(async () => {
      lateReject.reject(new Error('late rejection'));
      await lateReject.promise.catch(() => {});
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(consoleErrors, []);
});

test('tabs expose linked panels, move focus with keys, and request only the active panel', async () => {
  const request = deferred();
  const calls = [];
  const channelCalls = [];
  let focused = '';
  const loadOverview = (filters, signal) => {
    calls.push({ filters, signal });
    return request.promise;
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, { loadOverview, loadChannels: (filters, signal) => {
      channelCalls.push({ filters, signal });
      return new Promise(() => {});
    } }), {
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
  assert.equal(channelCalls.length, 1);
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
  assert.equal(channelCalls[0].signal.aborted, true);
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
  assert.equal(channelCalls.length, 2);
  await act(async () => {
    tabs[1].props.onKeyDown({ key: 'ArrowLeft', preventDefault: () => { prevented += 1; } });
  });
  tabs = renderer.root.findAll((node) => node.props.role === 'tab');
  assert.equal(focused, 'promotion-overview-tab');
  assert.equal(tabs[0].props['aria-selected'], true);
  assert.equal(calls.length, 3);
  assert.equal(channelCalls[1].signal.aborted, true);
  assert.equal(prevented, 4);
  await act(async () => renderer.unmount());
});

test('channel analysis loads only while active, keeps local search local, and applies then clears an exact channel filter', async () => {
  const channelRequests = [];
  const loadChannels = (filters, signal) => {
    channelRequests.push({ filters, signal });
    return Promise.resolve(channelsFixture());
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => Promise.resolve(overviewFixture()),
      loadChannels,
    }));
  });
  assert.equal(channelRequests.length, 0);
  await act(async () => {
    findButton(renderer.root, 'Channel Analysis').props.onClick();
  });
  assert.equal(channelRequests.length, 1);
  assert.match(textContent(renderer.toJSON()), /Best channel/);
  assert.match(textContent(renderer.toJSON()), /Direct \/ Unattributed/);
  assert.match(textContent(renderer.toJSON()), /Insufficient sample/);

  const search = findField(renderer.root, 'Search channels');
  await act(async () => {
    search.props.onChange({ target: { value: 'linked' } });
  });
  assert.equal(channelRequests.length, 1);
  const selectButtons = renderer.root.findAllByType('button').filter((node) => String(node.props['aria-label'] || '').startsWith('Select '));
  assert.deepEqual(selectButtons.map((node) => node.props['aria-label']), ['Select linkedin / paid / industrial']);
  assert.equal(selectButtons[0].parent.type, 'td');
  assert.equal(selectButtons[0].parent.parent.type, 'tr');
  assert.equal(selectButtons[0].parent.parent.props.role, undefined);
  assert.equal(selectButtons[0].parent.parent.props.tabIndex, undefined);

  await act(async () => {
    selectButtons[0].props.onClick();
  });
  assert.equal(channelRequests.length, 2);
  assert.deepEqual(channelRequests[1].filters, {
    ...channelRequests[0].filters,
    source: 'linkedin', medium: 'paid', campaign: 'industrial',
  });
  assert.match(textContent(renderer.toJSON()), /Active channel/);
  await act(async () => {
    findButton(renderer.root, 'Clear channel filter').props.onClick();
  });
  assert.equal(channelRequests.length, 3);
  assert.deepEqual(channelRequests[2].filters, {
    ...channelRequests[0].filters,
    source: '', medium: '', campaign: '',
  });
  await act(async () => renderer.unmount());
});

test('successful market scope survives channel loading and errors with the selected market still valid', async () => {
  const channel = deferred();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => Promise.resolve(overviewFixture()),
      loadChannels: () => channel.promise,
    }));
  });
  let market = findSelectField(renderer.root, 'Market');
  assert.deepEqual(market.findAllByType('option').map((option) => option.props.value), ['all', 'com', 'cn']);
  await act(async () => market.props.onChange({ target: { value: 'all' } }));
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  market = findSelectField(renderer.root, 'Market');
  assert.equal(market.props.value, 'all');
  assert.deepEqual(market.findAllByType('option').map((option) => option.props.value), ['all', 'com', 'cn']);
  await act(async () => {
    channel.reject(new Error('Channel scope unavailable'));
    await channel.promise.catch(() => {});
  });
  market = findSelectField(renderer.root, 'Market');
  assert.equal(market.props.value, 'all');
  assert.deepEqual(market.findAllByType('option').map((option) => option.props.value), ['all', 'com', 'cn']);
  await act(async () => renderer.unmount());
});

test('market scope may come from a successful channel response but never from a rejected request', async () => {
  const pendingOverview = deferred();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => pendingOverview.promise,
      loadChannels: () => Promise.resolve(channelsFixture()),
    }));
  });
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  assert.deepEqual(findSelectField(renderer.root, 'Market').findAllByType('option').map((option) => option.props.value), ['all', 'com', 'cn']);
  await act(async () => renderer.unmount());

  const unauthorizedError = Object.assign(new Error('Rejected scope'), { allowed_markets: ['com', 'cn'] });
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => pendingOverview.promise,
      loadChannels: () => Promise.reject(unauthorizedError),
    }));
  });
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  assert.deepEqual(findSelectField(renderer.root, 'Market').findAllByType('option').map((option) => option.props.value), ['com']);
  await act(async () => renderer.unmount());
});

test('sortable channel headers reorder native table rows without refetching', async () => {
  let channelRequests = 0;
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => Promise.resolve(overviewFixture()),
      loadChannels: () => {
        channelRequests += 1;
        return Promise.resolve(channelsFixture());
      },
    }));
  });
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  const sessionsHeaderButton = findButton(renderer.root, 'Sessions');
  assert.equal(sessionsHeaderButton.parent.props['aria-sort'], 'none');
  await act(async () => sessionsHeaderButton.props.onClick());
  assert.equal(sessionsHeaderButton.parent.props['aria-sort'], 'descending');
  await act(async () => sessionsHeaderButton.props.onClick());
  assert.equal(sessionsHeaderButton.parent.props['aria-sort'], 'ascending');
  assert.deepEqual(renderer.root.findAllByType('button').filter((button) => String(button.props['aria-label'] || '').startsWith('Select ')).map((button) => button.props['aria-label']), [
    'Select direct / unattributed / unattributed',
    'Select linkedin / paid / industrial',
    'Select google / cpc / summer-launch',
  ]);
  assert.equal(channelRequests, 1);
  await act(async () => renderer.unmount());
});

test('channel no-data response renders an explicit empty state', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => Promise.resolve(overviewFixture()),
      loadChannels: () => Promise.resolve(channelsFixture({ rows: [] })),
    }));
  });
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  assert.match(textContent(renderer.toJSON()), /No data/);
  assert.equal(renderer.root.findAllByType('table').length, 0);
  await act(async () => renderer.unmount());
});

test('channel requests abort on tab changes, ignore stale responses, and retry only the channel query', async () => {
  const first = deferred();
  const second = deferred();
  const requests = [];
  const loadChannels = (filters, signal) => {
    requests.push({ filters, signal });
    return requests.length === 1 ? first.promise : second.promise;
  };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => Promise.resolve(overviewFixture()),
      loadChannels,
    }));
  });
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  assert.equal(requests.length, 1);
  await act(async () => findButton(renderer.root, 'Overview').props.onClick());
  assert.equal(requests[0].signal.aborted, true);
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  assert.equal(requests.length, 2);
  await act(async () => {
    second.resolve(channelsFixture({ rows: [{ source: 'fresh', medium: 'email', campaign: 'current', sessions: 20, aiRequests: 2, aiSuccesses: 2, registrations: 1, serviceRequests: 1 }] }));
    await second.promise;
  });
  await act(async () => {
    first.resolve(channelsFixture({ rows: [{ source: 'stale', medium: 'email', campaign: 'old', sessions: 20, aiRequests: 2, aiSuccesses: 2, registrations: 1, serviceRequests: 1 }] }));
    await first.promise;
  });
  assert.match(textContent(renderer.toJSON()), /fresh/);
  assert.doesNotMatch(textContent(renderer.toJSON()), /stale/);
  await act(async () => renderer.unmount());

  const retries = [];
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(PromotionAnalyticsPage, {
      loadOverview: () => Promise.resolve(overviewFixture()),
      loadChannels: (filters, signal) => {
        retries.push({ filters, signal });
        return retries.length === 1 ? Promise.reject(new Error('Channel query unavailable')) : Promise.resolve(channelsFixture());
      },
    }));
  });
  await act(async () => findButton(renderer.root, 'Channel Analysis').props.onClick());
  assert.match(textContent(renderer.toJSON()), /Channel query unavailable/);
  await act(async () => findButton(renderer.root, 'Retry').props.onClick());
  assert.equal(retries.length, 2);
  await act(async () => renderer.unmount());
});

test('channel analysis source contract stays bilingual, table-first, and excludes identity and advertising-cost data', async () => {
  const channels = await readFile(new URL('../components/promotion/ChannelAnalysis.jsx', import.meta.url), 'utf8');
  assert.match(channels, /Source \/ medium/);
  assert.match(channels, /来源 \/ 媒介/);
  assert.match(channels, /Service requests/);
  assert.match(channels, /服务请求/);
  assert.match(channels, /aria-sort/);
  assert.match(channels, /最多 100 聚合行/);
  assert.doesNotMatch(channels, /<tr[^>]+role="button"|<tr[^>]+tabIndex/);
  assert.doesNotMatch(channels, /anonymous_id|session_id|request_id|ip_hash|user_agent|CPA|ROAS|Ad spend|广告花费/i);
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

test('metric changes preserve unavailable values while comparing meaningful zeroes', () => {
  const unavailableData = overviewFixture();
  unavailableData.current.sessions = 0;
  unavailableData.current.aiSuccessRate = null;
  delete unavailableData.current.aiRequests;
  delete unavailableData.current.registrationEvents;
  unavailableData.current.serviceRequestEvents = Number.POSITIVE_INFINITY;
  const unavailable = TestRenderer.create(React.createElement(PromotionOverview, { data: unavailableData, isCn: false }));

  assert.equal(metricText(unavailable.root, 'Sessions'), 'Sessions0vs prior −100.0%');
  assert.equal(metricText(unavailable.root, 'AI requests'), 'AI requests—vs prior —');
  assert.equal(metricText(unavailable.root, 'AI success rate'), 'AI success rate—vs prior —');
  assert.equal(metricText(unavailable.root, 'Completed registrations'), 'Completed registrations—vs prior —');
  assert.equal(metricText(unavailable.root, 'Service requests'), 'Service requests—vs prior —');

  const zeroData = overviewFixture();
  zeroData.current.aiSuccessRate = 0;
  const zero = TestRenderer.create(React.createElement(PromotionOverview, { data: zeroData, isCn: false }));
  assert.equal(metricText(zero.root, 'AI success rate'), 'AI success rate0.0%vs prior −80.0%');
  unavailable.unmount();
  zero.unmount();
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
