import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import { handleChat } from '../src/index.js';

const JWT_SECRET = 'chat-access-test-secret-32-chars';

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

test('handleChat tells COM site to answer English by default', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'com-prompt-1',
      message: 'My fiber laser cutter shows alarm E012. What should I check first?',
    }, null, 'https://api.sagemro.com/api/chat', 'https://sagemro.com'),
  });

  assert.match(prompt, /You MUST answer this turn in English/);
  assert.match(prompt, /Market: International edition \/ sagemro\.com/);
});

test('handleChat prompt keeps simple questions useful without pushing a work order', async () => {
  const prompt = await captureChatPrompt({
    request: makeRequest({
      conversation_id: 'simple-question-1',
      message: 'What does a laser cutting nozzle do?',
    }),
  });

  assert.match(prompt, /Do not push a work order or service request after a simple question is already answered clearly/);
  assert.match(prompt, /Add a short SAGEMRO official follow-up offer only when manual confirmation, quotation, parts, service scheduling, safety handling, or official parameter verification is clearly useful/);
  assert.match(prompt, /If the user did not explicitly request a detailed plan, table, report, or full checklist, write exactly 5 compact lines/);
});
