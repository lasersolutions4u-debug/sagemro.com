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
