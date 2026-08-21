import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import { buildWorkOrderSummaryPrompt, handleChat, handleChatTranscribe } from '../src/index.js';

const JWT_SECRET = 'chat-access-test-secret-32-chars';
const AI_TEMPORARY_FALLBACK = 'SAGEMRO AI is temporarily unavailable. Please try again shortly, or leave the equipment details and SAGEMRO will follow up through the service process.';
const SENTRY_ENVELOPE_URL = 'https://example.ingest.sentry.io/api/1/envelope/';

function makeRequest(body, token, url = 'https://api.sagemro.com/api/chat', origin = 'https://sagemro.com') {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '127.0.0.1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeEnv({ conversation = null, conversationInsertFailures = 0, commitConversationBeforeFailure = false } = {}) {
  const insertedConversations = [];
  let conversationInsertAttempts = 0;
  let loadedConversation = conversation;
  const db = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (/FROM conversations WHERE id = \?/.test(sql)) return loadedConversation;
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO conversations/.test(sql)) {
            conversationInsertAttempts++;
            const insertedConversation = {
              id: this.args[0],
              customer_id: this.args[3],
              engineer_id: this.args[4],
            };
            if (conversationInsertAttempts <= conversationInsertFailures) {
              if (commitConversationBeforeFailure) {
                insertedConversations.push(insertedConversation);
                loadedConversation = {
                  customer_id: insertedConversation.customer_id,
                  engineer_id: insertedConversation.engineer_id,
                };
              }
              throw new Error('D1_ERROR: D1 DB storage operation exceeded timeout which caused object to be reset.');
            }
            if (insertedConversations.some((row) => row.id === insertedConversation.id)) {
              throw new Error('D1_ERROR: UNIQUE constraint failed: conversations.id: SQLITE_CONSTRAINT');
            }
            insertedConversations.push(insertedConversation);
            loadedConversation = {
              customer_id: insertedConversation.customer_id,
              engineer_id: insertedConversation.engineer_id,
            };
          }
          return { success: true };
        },
      };
    },
  };

  const kv = {
    async get() { return null; },
    async put() {},
    async delete() {},
  };

  return {
    env: {
      DB: db,
      KV: kv,
      JWT_SECRET,
      OPENAI_API_ENDPOINT: 'https://llm.invalid',
      OPENAI_API_KEY: 'test-key',
      OPENAI_DAILY_PER_USER: '999',
      OPENAI_DAILY_TOTAL: '999',
    },
    insertedConversations,
    getConversationInsertAttempts: () => conversationInsertAttempts,
  };
}

function makeSseResponse(text = 'Captured.') {
  return new Response([
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
    '',
    'data: [DONE]',
    '',
  ].join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function parseSentryEnvelope(body) {
  return JSON.parse(body.split('\n')[2]);
}

function attachWaitUntilCollector(request) {
  const promises = [];
  request._ctx = {
    waitUntil(promise) {
      promises.push(promise);
    },
  };
  return promises;
}

function assertFallbackSse(sseText, { conversationId, canaries }) {
  assert.ok(sseText.includes(
    `data: ${JSON.stringify({ content: AI_TEMPORARY_FALLBACK, conversation_id: conversationId, response_status: 'failed' })}\n`,
  ));
  assert.ok(sseText.includes('data: [DONE]\n'));
  for (const canary of canaries) {
    assert.ok(!sseText.includes(canary), `SSE response leaked canary: ${canary}`);
  }
}

async function runChatSentryFailure({ conversationId, requestUrl, referer, makeLlmResponse }) {
  const { env } = makeEnv();
  env.SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
  env.ENVIRONMENT = 'test';
  const request = makeRequest({
    conversation_id: conversationId,
    message: 'My laser will not start.',
  }, null, requestUrl);
  request.headers.set('Referer', referer);
  request.headers.set('User-Agent', 'chat-sentry-test');
  request.headers.set('CF-Ray', 'test-ray');
  const waitUntilPromises = attachWaitUntilCollector(request);
  const originalFetch = globalThis.fetch;
  const sentryEnvelopes = [];

  globalThis.fetch = async (url, init) => {
    if (url === env.OPENAI_API_ENDPOINT) return makeLlmResponse();
    if (url === SENTRY_ENVELOPE_URL) {
      sentryEnvelopes.push(init.body);
      return new Response(null, { status: 200 });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  let sseText;
  try {
    const response = await handleChat(request, env);
    assert.equal(response.status, 200);
    sseText = await response.text();
    assert.equal(waitUntilPromises.length, 1);
    await Promise.all(waitUntilPromises);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(sentryEnvelopes.length, 1);
  return {
    envelope: sentryEnvelopes[0],
    event: parseSentryEnvelope(sentryEnvelopes[0]),
    sseText,
  };
}

async function captureChatPrompt({ request }) {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return makeSseResponse();
  };

  try {
    const response = await handleChat(request, env);
    assert.equal(response.status, 200);
    await response.text();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedBody, 'expected chat request body to be sent to the LLM');
  return capturedBody.messages[0].content;
}

test('handleChat rejects a customer reading another customer conversation', async () => {
  const token = await signJwt({
    userId: 'customer-b',
    userType: 'customer',
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);
  const { env } = makeEnv({ conversation: { customer_id: 'customer-a', engineer_id: null } });

  const response = await handleChat(makeRequest({
    conversation_id: 'conv-a',
    message: '继续刚才的话题',
    user_type: 'customer',
    customer_id: 'customer-a',
  }, token), env);

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, '您无权访问该对话');
});

test('handleChat creates a new conversation using caller-provided local id when it does not exist', async () => {
  const token = await signJwt({
    userId: 'customer-a',
    userType: 'customer',
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);
  const { env, insertedConversations } = makeEnv();

  const response = await handleChat(makeRequest({
    conversation_id: 'local-conv-1',
    message: '激光切割机不出光',
    user_type: 'customer',
    customer_id: 'attacker-supplied-id',
  }, token), env);

  assert.equal(response.status, 200);
  await response.body?.cancel();
  assert.equal(insertedConversations.length, 1);
  assert.equal(insertedConversations[0].id, 'local-conv-1');
  assert.equal(insertedConversations[0].customer_id, 'customer-a');
});

test('handleChat reports a redacted upstream LLM failure to Sentry', async () => {
  const conversationId = 'upstream-sentry-conversation';
  const upstreamEmail = 'buyer@example.com';
  const upstreamSecret = 'upstream-secret-canary';
  const queryEmail = 'query-buyer@example.com';
  const querySecret = 'query-secret-canary';
  const refererEmail = 'referer-buyer@example.com';
  const refererSecret = 'referer-secret-canary';
  const { envelope, event, sseText } = await runChatSentryFailure({
    conversationId,
    requestUrl: `https://api.sagemro.com/api/chat?email=${queryEmail}&token=${querySecret}#query-fragment`,
    referer: `https://sagemro.com/account?email=${refererEmail}&token=${refererSecret}#referer-fragment`,
    makeLlmResponse: () => new Response(
      `LLM failure for ${upstreamEmail} with ${upstreamSecret}`,
      { status: 502 },
    ),
  });

  assert.equal(event.extra.feature, 'ai_chat');
  assert.equal(event.extra.stage, 'upstream');
  assert.equal(event.extra.status, 502);
  assert.equal(event.extra.market, 'com');
  assert.equal(event.extra.iteration, 0);
  assert.equal(event.exception.values[0].value, 'LLM upstream request failed with status 502');
  assert.equal(event.request.url, 'https://api.sagemro.com/api/chat');
  assert.equal(event.request.method, 'POST');
  assert.equal(event.tags.route, '/api/chat');
  assert.equal(event.tags.method, 'POST');
  assert.equal(event.request.headers['user-agent'], 'chat-sentry-test');
  assert.equal(event.request.headers['cf-ray'], 'test-ray');
  assert.equal(event.request.headers.referer, undefined);
  for (const canary of [
    upstreamEmail,
    upstreamSecret,
    queryEmail,
    querySecret,
    refererEmail,
    refererSecret,
  ]) {
    assert.ok(!envelope.includes(canary), `Sentry envelope leaked canary: ${canary}`);
  }
  assertFallbackSse(sseText, {
    conversationId,
    canaries: [upstreamEmail, upstreamSecret],
  });
});

test('handleChat reports an LLM stream failure to Sentry', async () => {
  const conversationId = 'stream-sentry-conversation';
  const streamEmail = 'stream-buyer@example.com';
  const streamSecret = 'stream-secret-canary';
  const queryEmail = 'stream-query@example.com';
  const querySecret = 'stream-query-secret-canary';
  const refererEmail = 'stream-referer@example.com';
  const refererSecret = 'stream-referer-secret-canary';
  const { envelope, event, sseText } = await runChatSentryFailure({
    conversationId,
    requestUrl: `https://api.sagemro.com/api/chat?email=${queryEmail}&token=${querySecret}`,
    referer: `https://sagemro.com/history?email=${refererEmail}&token=${refererSecret}`,
    makeLlmResponse: () => new Response(new ReadableStream({
      start(controller) {
        controller.error(new Error(`stream exploded for ${streamEmail} with ${streamSecret}`));
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  });

  assert.equal(event.extra.feature, 'ai_chat');
  assert.equal(event.extra.stage, 'stream');
  assert.equal(event.extra.market, 'com');
  assert.equal(event.exception.values[0].value, 'LLM stream processing failed');
  assert.equal(event.request.url, 'https://api.sagemro.com/api/chat');
  assert.equal(event.request.method, 'POST');
  assert.equal(event.tags.route, '/api/chat');
  assert.equal(event.tags.method, 'POST');
  assert.equal(event.request.headers['user-agent'], 'chat-sentry-test');
  assert.equal(event.request.headers['cf-ray'], 'test-ray');
  assert.equal(event.request.headers.referer, undefined);
  for (const canary of [
    streamEmail,
    streamSecret,
    queryEmail,
    querySecret,
    refererEmail,
    refererSecret,
  ]) {
    assert.ok(!envelope.includes(canary), `Sentry envelope leaked canary: ${canary}`);
  }
  assertFallbackSse(sseText, {
    conversationId,
    canaries: [streamEmail, streamSecret],
  });
});

test('handleChat marks a second-round stream failure after first-round content as failed', async () => {
  const conversationId = 'multi-round-stream-failure';
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let llmRequestCount = 0;

  globalThis.fetch = async (url) => {
    if (url !== env.OPENAI_API_ENDPOINT) throw new Error(`Unexpected fetch URL: ${url}`);
    llmRequestCount++;
    if (llmRequestCount === 1) {
      return new Response([
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'First-round context.' } }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{
          index: 0,
          id: 'call_search',
          type: 'function',
          function: { name: 'search_knowledge_base', arguments: '{"query":"alarm"}' },
        }] } }] })}`,
        'data: [DONE]',
        '',
      ].join('\n'), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    return new Response(new ReadableStream({
      start(controller) {
        controller.error(new Error('second round disconnected'));
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: conversationId,
      message: 'Search for this alarm.',
    }), env);
    const sseText = await response.text();

    assert.equal(llmRequestCount, 2);
    assert.doesNotMatch(sseText, /First-round context\./);
    assertFallbackSse(sseText, { conversationId, canaries: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat retries a transient D1 timeout while creating a guest conversation', async () => {
  const { env, insertedConversations, getConversationInsertAttempts } = makeEnv({
    conversationInsertFailures: 1,
  });

  const response = await handleChat(makeRequest({
    conversation_id: 'retry-conv-1',
    message: 'My fiber laser cutter shows alarm E012.',
  }), env);

  assert.equal(response.status, 200);
  await response.body?.cancel();
  assert.equal(getConversationInsertAttempts(), 2);
  assert.equal(insertedConversations.length, 1);
  assert.equal(insertedConversations[0].id, 'retry-conv-1');
});

test('handleChat treats retried conversation create as idempotent when D1 committed before timing out', async () => {
  const { env, insertedConversations, getConversationInsertAttempts } = makeEnv({
    conversationInsertFailures: 1,
    commitConversationBeforeFailure: true,
  });

  const response = await handleChat(makeRequest({
    conversation_id: 'retry-conv-committed',
    message: 'My fiber laser cutter shows alarm E012.',
  }), env);

  assert.equal(response.status, 200);
  await response.body?.cancel();
  assert.equal(getConversationInsertAttempts(), 1);
  assert.equal(insertedConversations.length, 1);
  assert.equal(insertedConversations[0].id, 'retry-conv-committed');
});

test('handleChat returns a friendly 503 when transient D1 timeout persists before streaming starts', async () => {
  const { env, getConversationInsertAttempts } = makeEnv({
    conversationInsertFailures: 2,
  });
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return makeSseResponse();
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'retry-conv-fail',
      message: 'My fiber laser cutter shows alarm E012.',
    }), env);

    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error, 'SAGEMRO chat service is temporarily busy. Please try again shortly.');
    assert.equal(getConversationInsertAttempts(), 2);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat tells CN site to answer Simplified Chinese even when alarm text is English', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'cn-prompt-1',
      message: 'My fiber laser cutter shows alarm E012. What should I check first?',
    }, null, 'https://api.sagemro.cn/api/chat', 'https://sagemro.cn'),
  });

  assert.match(prompt, /You MUST answer this turn in Simplified Chinese/);
  assert.match(prompt, /English alarm codes, brand names, CNC terms, or short English phrases do not count as a request to answer in English/);
  assert.doesNotMatch(prompt, /You MUST answer this turn in English/);
});

test('handleChat prompt teaches CN users the correct portal and auth entry details', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'cn-platform-guide-1',
      message: '怎么注册和登录？',
    }, null, 'https://api.sagemro.cn/api/chat', 'https://sagemro.cn'),
  });

  assert.match(prompt, /sagemro\.cn/);
  assert.match(prompt, /engineer\.sagemro\.cn/);
  assert.match(prompt, /admin\.sagemro\.cn/);
  assert.match(prompt, /左侧工具栏底部/);
  assert.match(prompt, /移动端.*左上角菜单/s);
  assert.match(prompt, /公司名称、姓名、密码、手机号和短信验证码/);
  assert.doesNotMatch(prompt, /邮箱和邮箱验证码/);
  assert.doesNotMatch(prompt, /右上角.*登录/);
  assert.doesNotMatch(prompt, /真实姓名/);
});

test('handleChat prompt keeps customer-facing machine recommendations neutral', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'machine-brand-neutrality-1',
      message: '我需要购买一台新的3015 单平台 激光切割机，3000W，买哪个品牌比较好？',
    }, null, 'https://api.sagemro.com/api/chat', 'https://sagemro.com'),
  });

  assert.match(prompt, /Customer-facing machine recommendations must stay neutral/i);
  assert.match(prompt, /Do not mention affiliated machine suppliers, affiliated corporate operators, related sales websites, sales handoff, or internal lead routing/i);
  assert.match(prompt, /public market evidence/i);
  assert.doesNotMatch(prompt, /EUCHIO/i);
  assert.doesNotMatch(prompt, /Jinan Euchio/i);
  assert.doesNotMatch(prompt, /euchio\.com/i);
  assert.doesNotMatch(prompt, /EUCHIO 主要产品线/);
  assert.doesNotMatch(prompt, /济南钰峭机械有限公司（EUCHIO）/);
  assert.doesNotMatch(prompt, /Jinan Euchio Machinery Co\., Ltd\. 承接新机选型/);
  assert.doesNotMatch(prompt, /引导用户访问 euchio\.com/);
});

test('handleChat tells COM site to follow the customer language while keeping system UI in English', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'com-prompt-1',
      message: 'My fiber laser cutter shows alarm E012. What should I check first?',
    }, null, 'https://api.sagemro.com/api/chat', 'https://sagemro.com'),
  });

  assert.match(prompt, /Reply in the same natural language the customer uses in their latest message/);
  assert.match(prompt, /If the latest customer message is in Russian, reply in Russian/);
  assert.match(prompt, /SAGEMRO system UI labels, button names, routes, account type names, and portal names remain in English/);
  assert.match(prompt, /Internal service-ready summaries, work-order summaries, progress text, and AI analysis must remain in English/);
  assert.match(prompt, /Market: International edition \/ sagemro\.com/);
});

test('handleChat lets COM customer-facing replies follow Chinese input language', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'com-chinese-input-1',
      message: '激光切割机自动对焦失败，Z 轴不动作，怎么办？',
    }, null, 'https://api.sagemro.com/api/chat', 'https://sagemro.com'),
  });

  assert.match(prompt, /Reply in the same natural language the customer uses in their latest message/);
  assert.doesNotMatch(prompt, /You MUST answer this turn in English/);
  assert.doesNotMatch(prompt, /keep all AI-generated replies/);
});

test('handleChat prompt keeps simple questions useful without pushing a work order', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'simple-question-1',
      message: 'What does a laser cutting nozzle do?',
    }),
  });

  assert.match(prompt, /Do not push a work order or service request after a simple question is already answered clearly/);
  assert.match(prompt, /Routine maintenance and answer-only questions must end after the answer/);
  assert.match(prompt, /Use at most one short SAGEMRO next step/);
});

test('handleChat aborts an upstream request that produces no response headers', async () => {
  const conversationId = 'chat-first-byte-timeout';
  const { env } = makeEnv();
  env.OPENAI_CHAT_FIRST_BYTE_TIMEOUT_MS = '15';
  env.OPENAI_CHAT_IDLE_TIMEOUT_MS = '100';
  env.OPENAI_CHAT_TOTAL_TIMEOUT_MS = '200';
  const originalFetch = globalThis.fetch;
  let providerSignal;

  globalThis.fetch = async (url, init) => {
    if (url !== env.OPENAI_API_ENDPOINT) throw new Error(`Unexpected fetch URL: ${url}`);
    providerSignal = init.signal;
    return new Promise((_resolve, reject) => {
      providerSignal?.addEventListener('abort', () => reject(providerSignal.reason), { once: true });
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: conversationId,
      message: 'The machine is not cutting well.',
    }), env);
    const sseText = await Promise.race([
      response.text(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('chat first-byte timeout was not enforced')), 250)),
    ]);

    assert.ok(providerSignal, 'expected provider AbortSignal');
    assert.equal(providerSignal.aborted, true);
    assert.match(sseText, /The AI response took too long and was stopped\. Please try again\./);
    assert.match(sseText, /"response_status":"failed"/);
    assert.match(sseText, /data: \[DONE\]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat aborts a stream that becomes idle after its first chunk', async () => {
  const conversationId = 'chat-idle-timeout';
  const { env } = makeEnv();
  env.OPENAI_CHAT_FIRST_BYTE_TIMEOUT_MS = '100';
  env.OPENAI_CHAT_IDLE_TIMEOUT_MS = '15';
  env.OPENAI_CHAT_TOTAL_TIMEOUT_MS = '200';
  const originalFetch = globalThis.fetch;
  let providerSignal;

  globalThis.fetch = async (url, init) => {
    if (url !== env.OPENAI_API_ENDPOINT) throw new Error(`Unexpected fetch URL: ${url}`);
    providerSignal = init.signal;
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'working' } }] })}\n\n`,
        ));
        providerSignal?.addEventListener('abort', () => controller.error(providerSignal.reason), { once: true });
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: conversationId,
      message: 'The machine is not cutting well.',
    }), env);
    const sseText = await Promise.race([
      response.text(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('chat idle timeout was not enforced')), 250)),
    ]);

    assert.ok(providerSignal, 'expected provider AbortSignal');
    assert.equal(providerSignal.aborted, true);
    assert.match(sseText, /The AI response took too long and was stopped\. Please try again\./);
    assert.match(sseText, /"response_status":"failed"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat enforces a total provider deadline even while chunks keep arriving', async () => {
  const conversationId = 'chat-total-timeout';
  const { env } = makeEnv();
  env.OPENAI_CHAT_FIRST_BYTE_TIMEOUT_MS = '100';
  env.OPENAI_CHAT_IDLE_TIMEOUT_MS = '100';
  env.OPENAI_CHAT_TOTAL_TIMEOUT_MS = '30';
  const originalFetch = globalThis.fetch;
  let providerSignal;
  let heartbeat;

  globalThis.fetch = async (url, init) => {
    if (url !== env.OPENAI_API_ENDPOINT) throw new Error(`Unexpected fetch URL: ${url}`);
    providerSignal = init.signal;
    return new Response(new ReadableStream({
      start(controller) {
        heartbeat = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'working' } }] })}\n\n`,
          ));
        }, 5);
        providerSignal?.addEventListener('abort', () => {
          clearInterval(heartbeat);
          controller.error(providerSignal.reason);
        }, { once: true });
      },
      cancel() {
        clearInterval(heartbeat);
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: conversationId,
      message: 'The machine is not cutting well.',
    }), env);
    const sseText = await Promise.race([
      response.text(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('chat total timeout was not enforced')), 250)),
    ]);

    assert.ok(providerSignal, 'expected provider AbortSignal');
    assert.equal(providerSignal.aborted, true);
    assert.match(sseText, /The AI response took too long and was stopped\. Please try again\./);
    assert.match(sseText, /"response_status":"failed"/);
  } finally {
    clearInterval(heartbeat);
    globalThis.fetch = originalFetch;
  }
});

test('handleChat records bounded provider timing without customer content', async () => {
  const conversationId = 'chat-timing-metrics';
  const customerMessage = 'Private machine symptom must not be logged.';
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const timingEntries = [];

  globalThis.fetch = async (url) => {
    if (url !== env.OPENAI_API_ENDPOINT) throw new Error(`Unexpected fetch URL: ${url}`);
    return makeSseResponse('Measured response.');
  };
  console.info = (label, details) => {
    if (label === '[chat] LLM timing') timingEntries.push(details);
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: conversationId,
      message: customerMessage,
    }), env);
    await response.text();
  } finally {
    console.info = originalInfo;
    globalThis.fetch = originalFetch;
  }

  assert.equal(timingEntries.length, 1);
  assert.equal(timingEntries[0].market, 'com');
  assert.equal(timingEntries[0].status, 'completed');
  assert.equal(timingEntries[0].iterations, 1);
  assert.ok(Number.isSafeInteger(timingEntries[0].first_byte_ms));
  assert.ok(timingEntries[0].first_byte_ms >= 0);
  assert.ok(Number.isSafeInteger(timingEntries[0].total_ms));
  assert.ok(timingEntries[0].total_ms >= timingEntries[0].first_byte_ms);
  assert.doesNotMatch(JSON.stringify(timingEntries[0]), new RegExp(`${conversationId}|${customerMessage}`));
});

test('handleChat does not wait for an unbounded upstream error body', async () => {
  const conversationId = 'chat-upstream-error-body';
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let bodyCancelled = false;

  globalThis.fetch = async (url) => {
    if (url !== env.OPENAI_API_ENDPOINT) throw new Error(`Unexpected fetch URL: ${url}`);
    return new Response(new ReadableStream({
      cancel() {
        bodyCancelled = true;
      },
    }), { status: 502 });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: conversationId,
      message: 'The machine is not cutting well.',
    }), env);
    const sseText = await Promise.race([
      response.text(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('upstream error body blocked the chat response')), 250)),
    ]);

    assert.equal(bodyCancelled, true);
    assert.match(sseText, new RegExp(AI_TEMPORARY_FALLBACK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(sseText, /"response_status":"failed"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat uses low-variance generation for repeatable technical guidance', async () => {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return makeSseResponse();
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'low-variance-guidance-1',
      message: 'What should I inspect first?',
    }), env);
    await response.text();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedBody.temperature, 0.2);
});

test('handleChat hides tool-round narration and emits only the final customer answer', async () => {
  const conversationId = 'tool-round-narration-hidden';
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let llmRequestCount = 0;

  globalThis.fetch = async (url) => {
    if (url !== env.OPENAI_API_ENDPOINT) throw new Error(`Unexpected fetch URL: ${url}`);
    llmRequestCount++;
    if (llmRequestCount === 1) {
      return new Response([
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'Let me search the knowledge base first.' } }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{
          index: 0,
          id: 'call_search_hidden',
          type: 'function',
          function: { name: 'search_knowledge_base', arguments: '{"query":"alarm"}' },
        }] } }] })}`,
        'data: [DONE]',
        '',
      ].join('\n'), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    return makeSseResponse('Final customer answer.');
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: conversationId,
      message: 'Search for this alarm.',
    }), env);
    const sseText = await response.text();

    assert.equal(llmRequestCount, 2);
    assert.doesNotMatch(sseText, /Let me search/);
    assert.match(sseText, /Final customer answer\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat prompt keeps the first answer compact without an exact line-count trap', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'compact-first-answer-1',
      message: 'What should I inspect when cut quality suddenly drops?',
    }),
  });

  assert.match(prompt, /Chinese: 100-180 characters/);
  assert.match(prompt, /English: 80-140 words/);
  assert.match(prompt, /one conclusion, up to three checks, and at most one necessary question/);
  assert.doesNotMatch(prompt, /write exactly 5 compact lines/);
});

test('handleChat prompt does not invent machine-specific numeric ranges without evidence', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'parameter-evidence-boundary-1',
      message: 'What pressure and focus should I use?',
    }),
  });

  assert.match(prompt, /Do not provide a machine-specific numeric range unless/);
  assert.match(prompt, /the user supplied the required machine facts or published SAGEMRO knowledge supports it/);
  assert.match(prompt, /ask for the missing facts instead of filling them with general model knowledge/);
  assert.doesNotMatch(prompt, /给出具体参数数值范围而非笼统描述/);
  assert.doesNotMatch(prompt, /涉及具体参数时，尽量给出数值范围/);
});

test('handleChat prompt makes high-risk boundaries the first instruction', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'safety-boundary-1',
      message: 'Can I bypass the door interlock and test the live circuit?',
    }),
  });

  assert.match(prompt, /Start the first line with a clear stop-work or do-not-bypass instruction/);
  assert.match(prompt, /Do not provide steps for live electrical measurement, bypassing an interlock, or disassembling a high-risk component/);
  assert.match(prompt, /qualified personnel/);
});

test('handleChat prompt applies safety and evidence gates before technical advice', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'priority-gates-1',
      message: 'The cutting head keeps alarming and the cabinet smells burnt. What should I adjust?',
    }),
  });

  const gatesIndex = prompt.indexOf('## Non-negotiable response gates');
  const adviceIndex = prompt.indexOf('### 回答技术问题时');
  assert.ok(gatesIndex >= 0 && gatesIndex < adviceIndex);
  assert.match(prompt, /The first sentence must tell the user to stop work, isolate hazardous energy, or not bypass the protection/);
  assert.match(prompt, /Never suggest energized inspection, thermal imaging under load, live electrical measurement, opening a hazardous cabinet, or touching or re-torquing electrical terminals/);
  assert.match(prompt, /When an electrical cabinet smells burnt, do not ask the user to power it, run it under load, or observe whether the smell changes during operation/);
  assert.match(prompt, /Non-invasive means no opening covers, cabinet doors, or cutting-head lens holders/);
  assert.match(prompt, /Never suggest changing guard muting, blanking, or safety-mode settings/);
  assert.match(prompt, /Do not instruct an operator to open a cutting-head lens holder or clean, remove, or reinstall a focusing or collimating lens/);
  assert.match(prompt, /Never recommend an empty laser emission, test firing, or exposing the beam as a routine inspection step/);
});

test('handleChat prompt blocks guessed operating numbers and percentage adjustments', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'numeric-detail-boundary-2',
      message: 'The cut is rough. Give me a pressure, focus, speed, and cleaning interval.',
    }),
  });

  assert.match(prompt, /Do not output a guessed number or numeric range for operating parameters, maintenance intervals, percentage adjustments, pressure, speed, power, focus offset, tolerance, temperature, time, price, or service duration/);
  assert.match(prompt, /Example numbers are still guessed numbers and must not be supplied/);
  assert.match(prompt, /Describe an adjustment direction only when it is invariant across the relevant machine conventions/);
  assert.match(prompt, /change only one variable at a time in small steps and record each result/);
  assert.match(prompt, /End with no more than one question sentence. Do not present numbered questions/);
  assert.match(prompt, /The entire answer may contain at most one question mark/);
  assert.match(prompt, /Write checks as statements or imperative instructions, never as separate questions/);
  assert.match(prompt, /When the same symptom can require opposite adjustment directions on different setups, do not choose a direction without the missing machine facts/);
  assert.match(prompt, /For focus-position questions, never infer high, low, positive, negative, up, or down until the machine's focus convention is known/);
  assert.match(prompt, /For machine selection, do not invent example tonnage, power, bed size, working area, thickness, percentage coverage, controller brand, or price range/);
});

test('handleChat prompt limits service follow-up to one eligible next step', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'service-follow-up-boundary-1',
      message: 'How often should I inspect the nozzle?',
    }),
  });

  assert.match(prompt, /Use at most one short SAGEMRO next step/);
  assert.match(prompt, /Routine maintenance and answer-only questions must end after the answer/);
  assert.match(prompt, /For routine maintenance frequency questions, do not ask a follow-up question when safe condition-based guidance is already actionable/);
  assert.match(prompt, /do not ask, invite, or suggest that the user provide more machine facts when condition-based guidance is sufficient/);
  assert.match(prompt, /Use one compact paragraph with no heading or bullet list for routine maintenance frequency questions/);
  assert.match(prompt, /Distinguish inspection cadence from cleaning or replacement/);
  assert.match(prompt, /Do not invent a calendar or elapsed-hour cleaning or replacement interval when the manufacturer interval is unavailable/);
  assert.match(prompt, /Routine checklists and preventive-maintenance plans are answer-only unless the user explicitly requests service/);
  assert.match(prompt, /Never append a SAGEMRO summary, checklist offer, service-ready follow-up, or "if you'd like" sentence to an answer-only or routine response/);
  assert.match(prompt, /Never recommend a steel needle, reamer, drill bit, wire, abrasive, or other hard tool inside a nozzle orifice/);
  assert.match(prompt, /downtime, safety risk, formal quotation, parts confirmation, or an explicit remote or on-site service request/);
  const marketContextIndex = prompt.indexOf('## 当前请求上下文');
  const finalContractIndex = prompt.lastIndexOf('## Final response contract');
  assert.ok(finalContractIndex > marketContextIndex);
  assert.match(prompt, /Output only the final customer-facing answer. Never narrate a tool call, search, retrieval, or internal reasoning/);
  assert.match(prompt, /Role-specific conversion examples do not broaden the eligible service conversion triggers/);
  assert.match(prompt, /For routine maintenance or an answer-only response, never append a summary, checklist offer, service-ready offer, registration prompt, or follow-up invitation/);
  assert.match(prompt, /When a parameter direction depends on a manufacturer convention, do not state even a likely direction before that convention is known/);
  assert.match(prompt, /Never create service eligibility by adding a hypothetical condition such as "if this is causing downtime"/);
  assert.match(prompt, /Machine-selection advice is answer-only unless the user explicitly requests a formal quote or remote or on-site service/);
  assert.match(prompt, /A routine checklist must end after the checklist and must not ask for the machine model/);
  assert.match(prompt, /For routine maintenance and answer-only responses, do not mention SAGEMRO/);
});

test('handleChatTranscribe requires Deepgram configuration', async () => {
  const formData = new FormData();
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'voice.webm');

  const response = await handleChatTranscribe(new Request('https://api.sagemro.com/api/chat/transcribe', {
    method: 'POST',
    body: formData,
  }), {});

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /Voice input is not configured/);
});

test('handleChatTranscribe rejects cookie authentication without matching CSRF', async () => {
  const csrf = 'voice-csrf-token';
  const token = await signJwt({
    userId: 'customer-voice-1',
    userType: 'customer',
    csrf,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);
  const formData = new FormData();
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'voice.webm');

  const response = await handleChatTranscribe(new Request('https://api.sagemro.com/api/chat/transcribe', {
    method: 'POST',
    headers: {
      Origin: 'https://sagemro.com',
      Cookie: `__Host-sagemro_customer_session=${token}`,
    },
    body: formData,
  }), {
    JWT_SECRET,
    DEEPGRAM_API_KEY: 'deepgram-test-key',
  });

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, 'Invalid CSRF token');
});

test('handleChatTranscribe asks Deepgram to detect the spoken language for COM site', async () => {
  const formData = new FormData();
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'voice.webm');

  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({
      results: {
        channels: [
          { detected_language: 'fr', alternatives: [{ transcript: 'Check the laser alarm E012.' }] },
        ],
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await handleChatTranscribe(new Request('https://api.sagemro.com/api/chat/transcribe', {
      method: 'POST',
      body: formData,
    }), { DEEPGRAM_API_KEY: 'deepgram-test-key' });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.transcript, 'Check the laser alarm E012.');
    assert.equal(body.detectedLanguage, 'fr');
    assert.match(String(captured.url), /https:\/\/api\.deepgram\.com\/v1\/listen/);
    assert.match(String(captured.url), /model=whisper-large/);
    assert.match(String(captured.url), /smart_format=true/);
    assert.match(String(captured.url), /detect_language=true/);
    assert.doesNotMatch(String(captured.url), /language=multi/);
    assert.doesNotMatch(String(captured.url), /detect_language=zh/);
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.headers.Authorization, 'Token deepgram-test-key');
    assert.equal(captured.init.headers['Content-Type'], 'audio/webm');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChatTranscribe asks Deepgram to detect the spoken language for CN site', async () => {
  const formData = new FormData();
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'voice.webm');

  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({
      results: { channels: [{ detected_language: 'zh', alternatives: [{ transcript: '激 光 切 割 机 报 警 了' }] }] },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await handleChatTranscribe(new Request('https://api.sagemro.cn/api/chat/transcribe', {
      method: 'POST',
      headers: { Origin: 'https://sagemro.cn' },
      body: formData,
    }), { DEEPGRAM_API_KEY: 'deepgram-test-key' });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.transcript, '激光切割机报警了');
    assert.equal(body.detectedLanguage, 'zh');
    assert.match(capturedUrl, /detect_language=true/);
    assert.doesNotMatch(capturedUrl, /detect_language=zh/);
    assert.doesNotMatch(capturedUrl, /detect_language=en/);
    assert.doesNotMatch(capturedUrl, /language=multi/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChatTranscribe rate limits voice transcription before calling Deepgram', async () => {
  const formData = new FormData();
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'voice.webm');

  const originalFetch = globalThis.fetch;
  let deepgramCalled = false;
  let storedKey = '';
  globalThis.fetch = async () => {
    deepgramCalled = true;
    return new Response('{}', { status: 200 });
  };

  try {
    const response = await handleChatTranscribe(new Request('https://api.sagemro.com/api/chat/transcribe', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
      body: formData,
    }), {
      DEEPGRAM_API_KEY: 'deepgram-test-key',
      KV: {
        async get(key) {
          storedKey = key;
          return '20';
        },
        async put() {
          throw new Error('quota should not be incremented after limit is reached');
        },
      },
    });

    assert.equal(response.status, 429);
    const body = await response.json();
    assert.match(body.error, /Voice transcription limit reached/);
    assert.equal(deepgramCalled, false);
    assert.match(storedKey, /deepgram_voice_hour_guest:203\.0\.113\.10/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('work order summary prompt keeps COM generated summaries in English', () => {
  const prompt = buildWorkOrderSummaryPrompt({
    type: 'fault',
    description: '激光切割机自动对焦失败，Z 轴不动作。',
    urgency: 'urgent',
    market: 'com',
  });

  assert.match(prompt, /You are a work order analysis assistant/);
  assert.match(prompt, /Return JSON fields in English/);
  assert.match(prompt, /Work order summary, required specialties, suggested skills, urgency notes, and AI analysis must be written in English/);
  assert.doesNotMatch(prompt, /你是工单分析助手/);
});

test('work order summary prompt keeps CN generated summaries in Simplified Chinese', () => {
  const prompt = buildWorkOrderSummaryPrompt({
    type: 'fault',
    description: '激光切割机自动对焦失败，Z 轴不动作。',
    urgency: 'urgent',
    market: 'cn',
  });

  assert.match(prompt, /你是工单分析助手/);
  assert.match(prompt, /只返回 JSON/);
  assert.doesNotMatch(prompt, /Return JSON fields in English/);
});
