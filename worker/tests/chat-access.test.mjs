import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import { buildWorkOrderSummaryPrompt, handleChat, handleChatTranscribe } from '../src/index.js';

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
  assert.match(prompt, /Add a short SAGEMRO service follow-up offer only when manual confirmation, quotation, parts, service scheduling, safety handling, or reviewed parameter verification is clearly useful/);
  assert.match(prompt, /If the user did not explicitly request a detailed plan, table, report, or full checklist, write exactly 5 compact lines/);
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
