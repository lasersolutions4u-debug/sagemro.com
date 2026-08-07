import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';

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
