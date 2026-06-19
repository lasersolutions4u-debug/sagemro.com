import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import { handleChat } from '../src/index.js';

const JWT_SECRET = 'chat-access-test-secret-32-chars';

function makeRequest(body, token, url = 'https://api.sagemro.com/api/chat') {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '127.0.0.1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeEnv({ conversation = null } = {}) {
  const insertedConversations = [];
  const db = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (/FROM conversations WHERE id = \?/.test(sql)) return conversation;
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO conversations/.test(sql)) {
            insertedConversations.push({
              id: this.args[0],
              customer_id: this.args[3],
              engineer_id: this.args[4],
            });
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
  };
}

test('handleChat passes international language context to the LLM', async () => {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response([
      'data: {"choices":[{"delta":{"content":"SAGEMRO AI is ready."}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'local-conv-en',
      message: 'What should I check first if my laser cutter has alarm E012?',
      client_market: 'com',
      client_locale: 'en',
      user_type: 'guest',
    }), env);

    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    while (!(await reader.read()).done) {}

    const systemPrompt = capturedBody.messages[0].content;
    assert.equal(capturedBody.max_tokens, 420);
    assert.equal(capturedBody.tools, undefined);
    assert.equal(capturedBody.tool_choice, undefined);
    assert.match(systemPrompt, /Critical output language for this turn/);
    assert.match(systemPrompt, /You MUST answer this turn in English/);
    assert.match(systemPrompt, /Market: International edition \/ sagemro\.com/);
    assert.match(systemPrompt, /Required default reply language: English/);
    assert.match(systemPrompt, /reply in the Required default reply language/);
    assert.match(systemPrompt, /Default first-turn structure/);
    assert.match(systemPrompt, /exactly 3 practical checks/);
    assert.match(systemPrompt, /Ask exactly 1 follow-up question/);
    assert.match(systemPrompt, /Exactly 5 short lines/);
    assert.match(systemPrompt, /This is the final response contract for the current turn/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat passes China edition language context to the LLM', async () => {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response([
      'data: {"choices":[{"delta":{"content":"收到，我先按中文帮你判断。"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'local-conv-cn',
      message: 'My fiber laser cutter shows alarm E012. What should I check first?',
      client_market: 'cn',
      client_locale: 'zh-CN',
      user_type: 'guest',
    }, undefined, 'https://api.sagemro.cn/api/chat'), env);

    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    while (!(await reader.read()).done) {}

    const systemPrompt = capturedBody.messages[0].content;
    assert.equal(capturedBody.max_tokens, 420);
    assert.equal(capturedBody.tools, undefined);
    assert.equal(capturedBody.tool_choice, undefined);
    assert.match(systemPrompt, /Critical output language for this turn/);
    assert.match(systemPrompt, /You MUST answer this turn in Simplified Chinese/);
    assert.match(systemPrompt, /Market: China edition \/ sagemro\.cn/);
    assert.match(systemPrompt, /Required default reply language: Simplified Chinese/);
    assert.match(systemPrompt, /English alarm codes, brand names, CNC terms, or short English phrases do not count as a request to answer in English/);
    assert.match(systemPrompt, /Default first-turn structure/);
    assert.match(systemPrompt, /exactly 3 practical checks/);
    assert.match(systemPrompt, /Ask exactly 1 follow-up question/);
    assert.match(systemPrompt, /Exactly 5 short lines/);
    assert.match(systemPrompt, /This is the final response contract for the current turn/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat keeps larger token budget when user asks for a detailed plan', async () => {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response([
      'data: {"choices":[{"delta":{"content":"Detailed plan ready."}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'local-conv-detailed',
      message: 'Please give me a detailed repair plan and checklist for alarm E012.',
      client_market: 'com',
      client_locale: 'en',
      user_type: 'guest',
    }), env);

    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    while (!(await reader.read()).done) {}

    assert.equal(capturedBody.max_tokens, 1200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat keeps tools enabled for authenticated customers', async () => {
  const token = await signJwt({
    userId: 'cust-tools-1',
    userType: 'customer',
  }, JWT_SECRET);
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let capturedBody = null;

  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response([
      'data: {"choices":[{"delta":{"content":"I can help."}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'local-conv-customer-tools',
      message: 'Please help me create a service case for alarm E012.',
      client_market: 'com',
      client_locale: 'en',
      user_type: 'customer',
    }, token), env);

    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    while (!(await reader.read()).done) {}

    assert.ok(Array.isArray(capturedBody.tools));
    assert.equal(capturedBody.tool_choice, 'auto');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat sends localized fallback when upstream returns an empty stream', async () => {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async () => {
    fetchCount += 1;
    const body = fetchCount === 1
      ? ['data: [DONE]', ''].join('\n')
      : [
          'data: {"choices":[{"delta":{"content":"请先检查报警页面和设备型号。"},"finish_reason":"stop"}]}',
          '',
          'data: [DONE]',
          '',
        ].join('\n');
    return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'local-conv-empty-cn',
      message: 'My fiber laser cutter shows alarm E012. What should I check first?',
      client_market: 'cn',
      client_locale: 'zh-CN',
      user_type: 'guest',
    }, undefined, 'https://api.sagemro.cn/api/chat'), env);

    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(fetchCount, 2);
    assert.match(text, /请先检查报警页面和设备型号/);
    assert.match(text, /data: \[DONE\]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat sends localized fallback when empty stream retry also returns empty', async () => {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response([
      'data: [DONE]',
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'local-conv-empty-retry-cn',
      message: 'My fiber laser cutter shows alarm E012. What should I check first?',
      client_market: 'cn',
      client_locale: 'zh-CN',
      user_type: 'guest',
    }, undefined, 'https://api.sagemro.cn/api/chat'), env);

    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(fetchCount, 2);
    assert.match(text, /SAGEMRO AI 暂时没有拿到有效回复/);
    assert.match(text, /data: \[DONE\]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('handleChat appends localized recovery when upstream finishes mid-answer', async () => {
  const { env } = makeEnv();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response([
    'data: {"choices":[{"delta":{"content":"E012 通常指向 Z 轴随动"},"finish_reason":null}]}',
    '',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
    '',
    'data: [DONE]',
    '',
  ].join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

  try {
    const response = await handleChat(makeRequest({
      conversation_id: 'local-conv-truncated-cn',
      message: 'My fiber laser cutter shows alarm E012. What should I check first?',
      client_market: 'cn',
      client_locale: 'zh-CN',
      user_type: 'guest',
    }, undefined, 'https://api.sagemro.cn/api/chat'), env);

    assert.equal(response.status, 200);
    const text = await response.text();
    assert.match(text, /E012 通常指向 Z 轴随动/);
    assert.match(text, /刚才的 AI 回复可能不完整/);
    assert.match(text, /data: \[DONE\]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
