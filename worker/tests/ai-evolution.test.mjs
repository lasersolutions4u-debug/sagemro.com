import test from 'node:test';
import assert from 'node:assert/strict';

import { handleChat, logAiInteraction } from '../src/index.js';

const JWT_SECRET = 'ai-evolution-test-secret-32-chars';

test('logAiInteraction stores market, locale, prompt version, and response metadata', async () => {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            calls.push({ sql, args });
            return { run: async () => ({ success: true }) };
          },
        };
      },
    },
  };

  await logAiInteraction(env, {
    id: 'ai-1',
    conversationId: 'conv-1',
    userId: 'customer-1',
    userType: 'customer',
    market: 'cn',
    locale: 'zh-CN',
    intent: 'cutting_parameters',
    message: '6000W 能切多厚？',
    response: '碳钢建议...',
    model: 'deepseek-chat',
    promptVersion: 'prompt-2026-06-19',
    knowledgeVersion: 'none',
    responseTimeMs: 1200,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO ai_interactions/);
  assert.equal(calls[0].args[3], 'customer');
  assert.equal(calls[0].args[4], 'cn');
  assert.equal(calls[0].args[5], 'zh-CN');
  assert.equal(calls[0].args[10], 'prompt-2026-06-19');
  assert.equal(calls[0].args[12], 1200);
});

test('handleChat logs an AI interaction after a response is completed', async () => {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          args: [],
          bind(...args) {
            this.args = args;
            calls.push({ sql, args });
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            return { success: true };
          },
        };
      },
    },
    KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
    JWT_SECRET,
    OPENAI_API_ENDPOINT: 'https://llm.invalid',
    OPENAI_API_KEY: 'test-key',
    OPENAI_CHAT_MODEL: 'deepseek-chat',
    OPENAI_DAILY_PER_USER: '999',
    OPENAI_DAILY_TOTAL: '999',
  };
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response([
    'data: {"choices":[{"delta":{"content":"碳钢建议先按 12-16mm。"}}]}',
    '',
    'data: [DONE]',
    '',
  ].join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

  try {
    const response = await handleChat(new Request('https://api.sagemro.cn/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '127.0.0.1',
        Origin: 'https://sagemro.cn',
      },
      body: JSON.stringify({
        conversation_id: 'ai-log-conv-1',
        message: '6000W 切管坡口能切多厚？',
        client_market: 'cn',
        client_locale: 'zh-CN',
      }),
    }), env);

    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    while (!(await reader.read()).done) {}

    const interactionInsert = calls.find((call) => /INSERT INTO ai_interactions/.test(call.sql));
    assert.ok(interactionInsert);
    assert.equal(interactionInsert.args[1], 'ai-log-conv-1');
    assert.equal(interactionInsert.args[3], 'guest');
    assert.equal(interactionInsert.args[4], 'cn');
    assert.equal(interactionInsert.args[5], 'zh-CN');
    assert.equal(interactionInsert.args[6], 'cutting_parameters');
    assert.equal(interactionInsert.args[9], 'deepseek-chat');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
