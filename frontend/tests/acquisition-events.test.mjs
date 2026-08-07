import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';
import { getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';

const root = path.resolve(import.meta.dirname, '..');
const funnelAnalyticsModule = pathToFileURL(path.join(root, 'src/services/funnelAnalytics.js')).href;

function asDataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

async function loadApi() {
  const source = readFileSync(path.join(root, 'src/services/api.js'), 'utf8')
    .replace("from './funnelAnalytics'", `from '${funnelAnalyticsModule}'`)
    .replace("if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;", "return 'https://api.example.test';");
  const transformed = await transformWithOxc(source, 'api.js', { lang: 'js', format: 'esm' });
  return import(asDataUrl(transformed.code));
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) || null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function installGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
}

function readAllowlist(source, declaration) {
  const match = source.match(declaration);
  return match?.[1].match(/'([^']+)'/g)?.map((value) => value.slice(1, -1));
}

async function loadAcquisitionTracking(track) {
  const reactModule = pathToFileURL((await import('node:module')).createRequire(import.meta.url).resolve('react')).href;
  const diagnosticGuidesModule = pathToFileURL(path.join(root, 'src/data/diagnosticGuides.js')).href;
  const publicSeoRoutesModule = pathToFileURL(path.join(root, 'src/data/publicSeoRoutes.js')).href;
  const apiModule = asDataUrl(`export const trackFunnelEvent = ${track.toString()};`);
  const source = readFileSync(path.join(root, 'src/hooks/useAcquisitionTracking.js'), 'utf8')
    .replace("from 'react'", `from '${reactModule}'`)
    .replace("from '../data/diagnosticGuides'", `from '${diagnosticGuidesModule}'`)
    .replace("from '../data/publicSeoRoutes'", `from '${publicSeoRoutesModule}'`)
    .replace("from '../services/api'", `from '${apiModule}'`);
  const transformed = await transformWithOxc(source, 'useAcquisitionTracking.js', { lang: 'js', format: 'esm' });
  return import(asDataUrl(transformed.code));
}

function createClock() {
  let now = 0;
  let nextTimer = 1;
  const timers = new Map();

  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextTimer++;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

test('acquisition controller emits landing once and engages only after 30 visible seconds', async () => {
  const events = [];
  const clock = createClock();
  const { createAcquisitionTrackingController } = await loadAcquisitionTracking(() => {});
  const controller = createAcquisitionTrackingController({
    path: '/services/laser-cutting-machine-repair',
    contentType: 'service',
    contentSlug: 'laser-cutting-machine-repair',
    indexable: true,
    track: (name, properties) => events.push({ name, properties }),
    visibilityState: () => 'visible',
    now: clock.now,
    setTimer: clock.setTimeout,
    clearTimer: clock.clearTimeout,
  });

  controller.mount();
  assert.deepEqual(events, []);
  clock.tick(0);
  clock.tick(29_999);
  assert.deepEqual(events.map((event) => event.name), ['seo_landing_viewed']);
  clock.tick(1);
  assert.deepEqual(events.map((event) => event.name), ['seo_landing_viewed', 'content_engaged']);
  assert.deepEqual(events[1].properties, {
    content_type: 'service', content_slug: 'laser-cutting-machine-repair', engagement_bucket: '30s',
  });
});

test('acquisition controller pauses hidden time and never engages after unmount', async () => {
  const events = [];
  const clock = createClock();
  let visibility = 'visible';
  const { createAcquisitionTrackingController } = await loadAcquisitionTracking(() => {});
  const controller = createAcquisitionTrackingController({
    path: '/insights/laser-cutting-basics', contentType: 'insight', contentSlug: 'laser-cutting-basics', indexable: true,
    track: (name) => events.push(name),
    visibilityState: () => visibility, now: clock.now, setTimer: clock.setTimeout, clearTimer: clock.clearTimeout,
  });

  controller.mount();
  clock.tick(0);
  clock.tick(12_000);
  visibility = 'hidden';
  controller.onVisibilityChange();
  clock.tick(60_000);
  assert.deepEqual(events, ['seo_landing_viewed']);
  visibility = 'visible';
  controller.onVisibilityChange();
  clock.tick(18_000);
  assert.deepEqual(events, ['seo_landing_viewed', 'content_engaged']);

  const unmounted = createAcquisitionTrackingController({
    path: '/tools/metal-weight-calculator', contentType: 'tool', contentSlug: 'metal-weight-calculator', indexable: true,
    track: (name) => events.push(name),
    visibilityState: () => 'visible', now: clock.now, setTimer: clock.setTimeout, clearTimer: clock.clearTimeout,
  });
  unmounted.mount();
  unmounted.unmount();
  clock.tick(30_000);
  assert.equal(events.filter((event) => event === 'content_engaged').length, 1);
});

test('tool actions track the first input and first valid result only', async () => {
  const events = [];
  const { createAcquisitionEventActions } = await loadAcquisitionTracking(() => {});
  const actions = createAcquisitionEventActions({
    path: '/tools/metal-weight-calculator', contentType: 'tool', contentSlug: 'metal-weight-calculator', indexable: true,
    track: (name, properties) => events.push({ name, properties }),
  });

  actions.onToolStarted('metal-weight');
  actions.onToolStarted('metal-weight');
  actions.onToolCompleted('metal-weight', false);
  actions.onToolCompleted('metal-weight', true);
  actions.onToolCompleted('metal-weight', true);

  assert.deepEqual(events, [
    { name: 'tool_started', properties: { content_type: 'tool', content_slug: 'metal-weight-calculator', tool_id: 'metal-weight' } },
    { name: 'tool_completed', properties: { content_type: 'tool', content_slug: 'metal-weight-calculator', tool_id: 'metal-weight', result_state: 'valid' } },
  ]);
});

test('noindex or unknown contexts do not emit acquisition events', async () => {
  const events = [];
  const { createAcquisitionEventActions } = await loadAcquisitionTracking(() => {});
  const actions = createAcquisitionEventActions({
    path: '/tools/steel-price-watch', contentType: 'tool', contentSlug: 'steel-price-watch', indexable: false,
    track: (name) => events.push(name), visibilityState: () => 'visible',
  });

  actions.onToolStarted('steel-price');
  actions.onToolCompleted('steel-price', true);
  actions.onConversionClick({ ctaType: 'ai_diagnosis' });
  assert.deepEqual(events, []);
});

test('central public route context covers every manifest route and excludes pending or private sessions', async () => {
  const { getPublicAcquisitionContext } = await loadAcquisitionTracking(() => {});
  const base = { locale: 'en', sessionRestoreComplete: true, isEngineerHost: false, userType: null };

  for (const route of getPublicSeoRoutes('en')) {
    const context = getPublicAcquisitionContext({ ...base, pathname: route.path, route });
    assert.equal(context.indexable, true, route.path);
    assert.match(context.contentType, /^(service|diagnostic_guide|insight|tool)$/);
    assert.match(context.contentSlug, /^[a-z0-9-]+$/i);
  }
  assert.deepEqual(getPublicAcquisitionContext({ ...base, pathname: '/tools' }), {
    path: '/tools', contentType: 'tool', contentSlug: 'tools', indexable: true,
  });
  assert.equal(getPublicAcquisitionContext({ ...base, pathname: '/tools', sessionRestoreComplete: false }).indexable, false);
  assert.equal(getPublicAcquisitionContext({ ...base, pathname: '/tools', userType: 'customer' }).indexable, false);
  assert.equal(getPublicAcquisitionContext({ ...base, pathname: '/private' }).indexable, false);
  assert.equal(getPublicAcquisitionContext({ ...base, pathname: '/tools/steel-price-watch' }).indexable, false);
});

test('StrictMode probe cleanup leaves one landing and engagement event for the real mount', async () => {
  const events = [];
  const clock = createClock();
  const { createAcquisitionTrackingController } = await loadAcquisitionTracking(() => {});
  const controller = createAcquisitionTrackingController({
    path: '/tools', contentType: 'tool', contentSlug: 'tools', indexable: true,
    track: (name) => events.push(name), visibilityState: () => 'visible',
    now: clock.now, setTimer: clock.setTimeout, clearTimer: clock.clearTimeout,
  });

  controller.mount();
  controller.unmount();
  clock.tick(0);
  controller.mount();
  clock.tick(0);
  clock.tick(30_000);
  clock.tick(30_000);
  assert.deepEqual(events, ['seo_landing_viewed', 'content_engaged']);
});

test('conversion tracking runs before its existing callback', async () => {
  const calls = [];
  const { createTrackedConversionClick } = await loadAcquisitionTracking(() => {});
  const handleClick = createTrackedConversionClick(
    (context) => calls.push(['event', context]),
    { contentType: 'service', contentSlug: 'laser-cutting-machine-repair', ctaType: 'ai_diagnosis' },
    () => calls.push(['callback']),
  );

  handleClick();
  assert.deepEqual(calls, [
    ['event', { contentType: 'service', contentSlug: 'laser-cutting-machine-repair', ctaType: 'ai_diagnosis' }],
    ['callback'],
  ]);
});

test('client adds only the approved acquisition properties', () => {
  const client = readFileSync(path.join(root, 'src/services/api.js'), 'utf8');
  const worker = readFileSync(path.join(root, '..', 'worker/src/index.js'), 'utf8');
  const acquisitionProperties = [
    'content_type', 'content_slug', 'cta_type', 'engagement_bucket', 'result_state',
  ];

  assert.deepEqual(
    readAllowlist(client, /const FUNNEL_EVENT_NAMES = \[([\s\S]*?)\];/),
    readAllowlist(worker, /const FUNNEL_EVENTS = new Set\(\[([\s\S]*?)\]\);/),
  );
  assert.deepEqual(
    readAllowlist(client, /const FUNNEL_PROPERTY_ALLOWLIST = \[([\s\S]*?)\];/),
    [
      'entry', 'market', 'locale', 'user_type', 'authenticated', 'conversation_id', 'has_images',
      'response_status', 'device_type', 'service_type', 'urgency', 'tool_id', 'request_id',
      'analytics_version', ...acquisitionProperties,
    ],
  );
  assert.deepEqual(
    readAllowlist(worker, /const FUNNEL_PROPERTY_ALLOWLIST = new Set\(\[([\s\S]*?)\]\);/)
      .filter((property) => acquisitionProperties.includes(property)),
    acquisitionProperties,
  );
});

test('trackFunnelEvent sends only approved acquisition properties', async () => {
  const api = await loadApi();
  const payloads = [];
  const restores = [
    installGlobal('localStorage', new MemoryStorage()),
    installGlobal('window', {
      location: {
        hostname: 'sagemro.com',
        origin: 'https://sagemro.com',
        pathname: '/services/laser-cutting-machine-repair',
        search: '',
      },
    }),
    installGlobal('document', { referrer: '' }),
    installGlobal('navigator', {}),
    installGlobal('fetch', async (_url, init = {}) => {
      payloads.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ success: true }), { status: 202 });
    }),
  ];

  try {
    api.trackFunnelEvent('conversion_cta_clicked', {
      content_type: 'service',
      content_slug: 'laser-cutting-machine-repair',
      cta_type: 'ai_diagnosis',
      engagement_bucket: '30s',
      result_state: 'valid',
      prompt: 'My laser alarm is E012',
      email: 'buyer@example.com',
      phone: '+15551234567',
      serial_number: 'SN-12345678',
      file_name: 'laser-photo.jpg',
      device_info: 'Fiber laser 6kW',
    });

    assert.equal(payloads.length, 1);
    assert.deepEqual(payloads[0].properties, {
      content_type: 'service',
      content_slug: 'laser-cutting-machine-repair',
      cta_type: 'ai_diagnosis',
      engagement_bucket: '30s',
      result_state: 'valid',
      analytics_version: '2',
      market: 'com',
      locale: 'en',
    });
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});

test('trackFunnelEvent resolves and stores only non-direct attribution', async () => {
  const api = await loadApi();
  const storage = new MemoryStorage();
  const payloads = [];
  const restores = [
    installGlobal('localStorage', storage),
    installGlobal('window', {
      location: {
        hostname: 'sagemro.com',
        origin: 'https://sagemro.com',
        pathname: '/tools',
        search: '',
      },
    }),
    installGlobal('document', { referrer: 'https://chatgpt.com/' }),
    installGlobal('navigator', {}),
    installGlobal('fetch', async (_url, init = {}) => {
      payloads.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ success: true }), { status: 202 });
    }),
  ];

  try {
    api.trackFunnelEvent('tool_started', { content_type: 'tool' });

    assert.equal(payloads[0].source, 'chatgpt_referral');
    assert.equal(payloads[0].medium, 'ai_referral');
    assert.deepEqual(JSON.parse(storage.getItem('sagemro_analytics_source')), {
      source: 'chatgpt_referral', medium: 'ai_referral', campaign: '', content: '', term: '',
    });
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});
