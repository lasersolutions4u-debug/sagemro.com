import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const reactModule = pathToFileURL(require.resolve('react')).href;
const funnelAnalyticsModule = pathToFileURL(path.join(root, 'src/services/funnelAnalytics.js')).href;

function asDataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

async function loadChatModules() {
  const apiSource = readFileSync(path.join(root, 'src/services/api.js'), 'utf8')
    .replace("from './funnelAnalytics'", `from '${funnelAnalyticsModule}'`)
    .replace("if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;", "return 'https://api.example.test';");
  const apiTransformed = await transformWithOxc(apiSource, 'api.js', { lang: 'js', format: 'esm' });
  const apiModuleUrl = asDataUrl(apiTransformed.code);

  const hookSource = readFileSync(path.join(root, 'src/hooks/useChat.js'), 'utf8')
    .replace("from 'react'", `from '${reactModule}'`)
    .replace("from '../services/api'", `from '${apiModuleUrl}'`);
  const hookTransformed = await transformWithOxc(hookSource, 'useChat.js', { lang: 'js', format: 'esm' });

  const [api, hook] = await Promise.all([
    import(apiModuleUrl),
    import(asDataUrl(hookTransformed.code)),
  ]);
  return { api, hook };
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

async function runChatFlow(sseBody, requestId) {
  const { api, hook } = await loadChatModules();
  const analyticsPayloads = [];
  const restoreGlobals = [
    installGlobal('localStorage', new MemoryStorage()),
    installGlobal('window', {
      location: {
        hostname: 'sagemro.com',
        origin: 'https://sagemro.com',
        pathname: '/',
        search: '',
      },
    }),
    installGlobal('document', { referrer: '' }),
    installGlobal('navigator', {}),
    installGlobal('fetch', async (url, init = {}) => {
      if (url === 'https://api.example.test/api/chat') {
        return new Response(sseBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      if (url === 'https://api.example.test/api/analytics/funnel') {
        analyticsPayloads.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ success: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  ];

  try {
    api.trackFunnelEvent('ai_conversation_started', {
      entry: 'main_chat',
      conversation_id: 'conversation-1',
      request_id: requestId,
    });

    let chat;
    function Harness() {
      chat = hook.useChat();
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    await chat.sendMessage('Help diagnose this alarm', undefined, 'conversation-1', requestId);
    return analyticsPayloads;
  } finally {
    for (const restore of restoreGlobals.reverse()) restore();
  }
}

test('failed fallback SSE content does not emit ai_response_received', async () => {
  const payloads = await runChatFlow([
    `data: ${JSON.stringify({
      content: 'AI is temporarily unavailable.',
      conversation_id: 'conversation-1',
      response_status: 'failed',
    })}`,
    'data: [DONE]',
    '',
  ].join('\n'), 'request-failed-1');

  assert.deepEqual(payloads.map((payload) => payload.event_name), ['ai_conversation_started']);
  assert.equal(payloads[0].properties.request_id, 'request-failed-1');
});

test('successful SSE content emits start and success with the same request ID', async () => {
  const payloads = await runChatFlow([
    `data: ${JSON.stringify({ content: 'Check the alarm history.', conversation_id: 'conversation-1' })}`,
    'data: [DONE]',
    '',
  ].join('\n'), 'request-success-1');

  assert.deepEqual(payloads.map((payload) => payload.event_name), [
    'ai_conversation_started',
    'ai_response_received',
  ]);
  assert.deepEqual(payloads.map((payload) => payload.properties.request_id), [
    'request-success-1',
    'request-success-1',
  ]);
});

test('partial SSE content followed by bare EOF does not emit ai_response_received', async () => {
  const payloads = await runChatFlow([
    `data: ${JSON.stringify({ content: 'Partial answer.', conversation_id: 'conversation-1' })}`,
    '',
  ].join('\n'), 'request-incomplete-1');

  assert.deepEqual(payloads.map((payload) => payload.event_name), ['ai_conversation_started']);
});

test('trackFunnelEvent safely sends guest analytics when storage reads are blocked', async () => {
  const { api } = await loadChatModules();
  const analyticsPayloads = [];
  const blockedStorage = {
    getItem() { throw new Error('storage blocked'); },
    setItem() { throw new Error('storage blocked'); },
  };
  const restoreGlobals = [
    installGlobal('localStorage', blockedStorage),
    installGlobal('window', {
      location: {
        hostname: 'sagemro.com',
        origin: 'https://sagemro.com',
        pathname: '/blocked-storage',
        search: '',
      },
    }),
    installGlobal('document', { referrer: '' }),
    installGlobal('navigator', {}),
    installGlobal('fetch', async (_url, init = {}) => {
      analyticsPayloads.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ success: true }), { status: 202 });
    }),
  ];

  try {
    assert.doesNotThrow(() => api.trackFunnelEvent('traffic_source_captured', { entry: 'app_loaded' }));
    assert.equal(analyticsPayloads.length, 1);
    assert.equal(analyticsPayloads[0].user_type, 'guest');
    assert.match(analyticsPayloads[0].anonymous_id, /^anon_/);
    assert.match(analyticsPayloads[0].session_id, /^session_/);
  } finally {
    for (const restore of restoreGlobals.reverse()) restore();
  }
});

test('startup fetch wrapper preserves analytics fallback delivery when storage is blocked', async () => {
  const nativeFetchCalls = [];
  let beaconCalls = 0;
  const nativeFetch = async (url, init = {}) => {
    nativeFetchCalls.push({ url, init });
    return new Response(JSON.stringify({ success: true }), { status: 202 });
  };
  const blockedStorage = {
    getItem() { throw new Error('storage blocked'); },
    setItem() { throw new Error('storage blocked'); },
  };
  const startupWindow = {
    fetch: nativeFetch,
    location: {
      hostname: 'sagemro.com',
      origin: 'https://sagemro.com',
      pathname: '/startup',
      search: '',
    },
  };
  const restoreGlobals = [
    installGlobal('localStorage', blockedStorage),
    installGlobal('window', startupWindow),
    installGlobal('document', { referrer: '' }),
    installGlobal('navigator', {
      sendBeacon() {
        beaconCalls++;
        return true;
      },
    }),
    installGlobal('fetch', nativeFetch),
  ];

  try {
    const apiSource = `${readFileSync(path.join(root, 'src/services/api.js'), 'utf8')}\n// startup-storage-fallback`
      .replace("from './funnelAnalytics'", `from '${funnelAnalyticsModule}'`)
      .replace("if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;", "return 'https://api.example.test';");
    const transformed = await transformWithOxc(apiSource, 'api-startup.js', { lang: 'js', format: 'esm' });
    const api = await import(asDataUrl(transformed.code));
    globalThis.fetch = startupWindow.fetch;

    assert.doesNotThrow(() => api.trackFunnelEvent('traffic_source_captured', { entry: 'app_loaded' }));
    await Promise.resolve();

    assert.equal(beaconCalls, 0);
    assert.equal(nativeFetchCalls.length, 1);
    const [{ url, init }] = nativeFetchCalls;
    assert.equal(url, 'https://api.example.test/api/analytics/funnel');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.headers.has('Authorization'), false);
    assert.equal(init.headers.has('X-CSRF-Token'), false);
    const payload = JSON.parse(init.body);
    assert.equal(payload.user_type, 'guest');
    assert.match(payload.anonymous_id, /^anon_/);
    assert.match(payload.session_id, /^session_/);
  } finally {
    for (const restore of restoreGlobals.reverse()) restore();
  }
});

test('startup fetch wrapper keeps credentials for normal API requests when storage is readable', async () => {
  const nativeFetchCalls = [];
  const nativeFetch = async (url, init = {}) => {
    nativeFetchCalls.push({ url, init });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const storage = new MemoryStorage();
  storage.setItem('sagemro_token', 'legacy-token');
  storage.setItem('sagemro_csrf_token', 'csrf-token');
  const startupWindow = {
    fetch: nativeFetch,
    location: {
      hostname: 'sagemro.com',
      origin: 'https://sagemro.com',
      pathname: '/startup',
      search: '',
    },
  };
  const restoreGlobals = [
    installGlobal('localStorage', storage),
    installGlobal('window', startupWindow),
    installGlobal('document', { referrer: '' }),
    installGlobal('navigator', {}),
    installGlobal('fetch', nativeFetch),
  ];

  try {
    const apiSource = `${readFileSync(path.join(root, 'src/services/api.js'), 'utf8')}\n// startup-readable-storage`
      .replace("from './funnelAnalytics'", `from '${funnelAnalyticsModule}'`)
      .replace("if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;", "return 'https://api.example.test';");
    const transformed = await transformWithOxc(apiSource, 'api-readable-storage.js', { lang: 'js', format: 'esm' });
    await import(asDataUrl(transformed.code));
    globalThis.fetch = startupWindow.fetch;

    await globalThis.fetch('https://api.example.test/api/devices', { method: 'POST' });

    assert.equal(nativeFetchCalls.length, 1);
    const [{ init }] = nativeFetchCalls;
    assert.equal(init.credentials, 'include');
    assert.equal(init.headers.get('Authorization'), 'Bearer legacy-token');
    assert.equal(init.headers.get('X-CSRF-Token'), 'csrf-token');
  } finally {
    for (const restore of restoreGlobals.reverse()) restore();
  }
});
