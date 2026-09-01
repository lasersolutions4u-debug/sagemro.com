import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';

const quotaMigrationSql = readFileSync(
  new URL('../migrations/048_service_request_assist_quota.sql', import.meta.url),
  'utf8',
);

function createKv() {
  const values = new Map();
  return {
    async get(key) { return values.get(key) ?? null; },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); },
    values,
  };
}

function createQuotaDatabase(t, { migrated = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);');
  if (migrated) sqlite.exec(quotaMigrationSql);
  t.after(() => sqlite.close());
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() {
          const result = sqlite.prepare(sql).run(...args);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
    __sqlite: sqlite,
  };
}

function createEnv(t, overrides = {}, databaseOptions) {
  return {
    KV: createKv(),
    DB: createQuotaDatabase(t, databaseOptions),
    OPENAI_API_ENDPOINT: 'https://provider.example/v1/chat/completions',
    OPENAI_API_KEY: 'test-key',
    OPENAI_JSON_MODEL: 'test-json-model',
    OPENAI_DAILY_PER_USER: '100',
    OPENAI_DAILY_TOTAL: '1000',
    SERVICE_REQUEST_ASSIST_HOURLY_LIMIT: '20',
    ...overrides,
  };
}

const draft = Object.freeze({
  version: 2,
  mode: 'ai',
  step: 2,
  service_kind: 'repair',
  device_types: ['Laser cutter'],
  device_brands: ['TRUMPF'],
  device_model: 'TruLaser 3030',
  alarm_code: 'E204',
  description: 'The cutting head stops after homing.',
  production_impact: 'The line is stopped.',
  service_mode: 'hybrid',
  region: ['United States', 'Illinois', 'Chicago'],
  urgency: 'urgent',
  contact: {
    name: 'Private Person',
    email: 'private@example.com',
    phone: '+1 312 555 0101',
    whatsapp: '+1 312 555 0102',
    preference: 'email',
  },
  service_location: {
    address: '123 Private Factory Road', latitude: 41.1, longitude: -87.1,
  },
  files: [{ name: 'secret.jpg' }],
});

async function api(env, body, { host = 'api.sagemro.com', ip = '203.0.113.10' } = {}) {
  const response = await worker.fetch(new Request(`https://${host}/api/service-request-assist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: host.endsWith('.cn') ? 'https://ai.sagemro.cn' : 'https://ai.sagemro.com',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify(body),
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

function providerResponse(value) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('public assist returns only a controlled patch and sends a minimized trusted-market prompt', async (t) => {
  const env = createEnv(t);
  let providerRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return providerResponse({
      patch: { device_model: 'TruLaser 3030', contact: { email: 'leak@example.com' } },
      missing_fields: ['contact.phone', 'photos'],
      next_question: 'An engineer will arrive today.',
      safety_notice: 'Safe to restart.',
      diagnosis: 'Servo failure',
      price: 1000,
    });
  };
  try {
    const result = await api(env, { market: 'cn', message: 'Alarm E204 after homing', draft });
    assert.equal(result.response.status, 200);
    assert.deepEqual(Object.keys(result.json), ['patch', 'missing_fields', 'next_question', 'safety_notice']);
    assert.deepEqual(result.json, {
      patch: { device_model: 'TruLaser 3030' },
      missing_fields: ['contact.phone'],
      next_question: 'contact.phone',
      safety_notice: '',
    });

    const serializedPrompt = JSON.stringify(providerRequest);
    assert.match(serializedPrompt, /service-request form assistant/i);
    assert.doesNotMatch(serializedPrompt, /Private Person|private@example\.com|312 555|Private Factory|latitude|longitude|secret\.jpg/);
    assert.match(serializedPrompt, /United States/);
    assert.doesNotMatch(serializedPrompt, /Illinois|Chicago/);
    assert.equal(Object.hasOwn(providerRequest, 'tools'), false);
    assert.equal(Object.hasOwn(providerRequest, 'functions'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('trusted request host selects CN even when the body claims another market', async (t) => {
  const env = createEnv(t);
  let providerRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    providerRequest = JSON.parse(init.body);
    return providerResponse({ patch: {}, missing_fields: [], next_question: '', safety_notice: '' });
  };
  try {
    const result = await api(env, { market: 'com', message: '设备报警', draft }, { host: 'api.sagemro.cn' });
    assert.equal(result.response.status, 200);
    assert.match(JSON.stringify(providerRequest), /表单整理助手/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid bodies fail with stable 400 responses before provider access', async (t) => {
  const env = createEnv(t);
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls += 1; return providerResponse({}); };
  try {
    for (const body of [
      { message: '', draft },
      { message: 'x'.repeat(4001), draft },
      { message: 'help', draft: [] },
      { message: 'help', draft: { ...draft, version: 1 } },
      { message: 'help', draft: { ...draft, contact: 'not-an-object' } },
      { message: 'help', draft: { ...draft, device_types: [{ unsafe: true }] } },
    ]) {
      const result = await api(env, body, { ip: `203.0.113.${providerCalls + 20}` });
      assert.equal(result.response.status, 400);
      assert.deepEqual(result.json, { error: 'Invalid service request assist input' });
    }
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('hourly rate limit returns stable 429 and does not call the provider again', async (t) => {
  const env = createEnv(t, { SERVICE_REQUEST_ASSIST_HOURLY_LIMIT: '1' });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse({ patch: {}, missing_fields: [], next_question: '', safety_notice: '' });
  };
  try {
    assert.equal((await api(env, { message: 'First request', draft })).response.status, 200);
    const limited = await api(env, { message: 'Second request', draft });
    assert.equal(limited.response.status, 429);
    assert.deepEqual(limited.json, { error: 'Service request AI rate limit exceeded' });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('atomic D1 quota caps concurrent provider calls and stores only hashed IP scopes', async (t) => {
  const env = createEnv(t, {
    SERVICE_REQUEST_ASSIST_HOURLY_LIMIT: '3',
    SERVICE_REQUEST_ASSIST_DAILY_IP_LIMIT: '20',
    SERVICE_REQUEST_ASSIST_DAILY_MARKET_LIMIT: '20',
  });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await Promise.resolve();
    return providerResponse({ patch: {}, missing_fields: [], next_question: '', safety_notice: '' });
  };
  try {
    const results = await Promise.all(Array.from({ length: 10 }, () => (
      api(env, { message: 'Concurrent service request', draft }, { ip: '203.0.113.77' })
    )));
    assert.equal(results.filter(({ response }) => response.status === 200).length, 3);
    assert.equal(results.filter(({ response }) => response.status === 429).length, 7);
    assert.equal(calls, 3);

    const rows = env.DB.__sqlite.prepare(`
      SELECT market, scope, bucket, count FROM service_request_assist_quotas ORDER BY scope
    `).all();
    assert.equal(rows.length, 3);
    assert.equal(rows.every((row) => row.market === 'com' && row.count === 3), true);
    assert.equal(rows.some((row) => row.scope.includes('203.0.113.77')), false);
    for (const row of rows.filter((item) => item.scope !== 'daily_market')) {
      assert.match(row.scope, /^(?:hourly_ip|daily_guest):[a-f0-9]{64}$/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('atomic quotas isolate markets and hashed visitor IPs', async (t) => {
  const env = createEnv(t, {
    SERVICE_REQUEST_ASSIST_HOURLY_LIMIT: '1',
    SERVICE_REQUEST_ASSIST_DAILY_IP_LIMIT: '10',
    SERVICE_REQUEST_ASSIST_DAILY_MARKET_LIMIT: '10',
  });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return providerResponse({ patch: {}, missing_fields: [], next_question: '', safety_notice: '' });
  };
  try {
    const firstCom = await api(env, { message: 'COM one', draft }, { ip: '198.51.100.1' });
    const secondCom = await api(env, { message: 'COM two', draft }, { ip: '198.51.100.1' });
    const cn = await api(env, { message: 'CN one', draft }, { host: 'api.sagemro.cn', ip: '198.51.100.1' });
    const otherIp = await api(env, { message: 'COM other', draft }, { ip: '198.51.100.2' });
    assert.deepEqual(
      [firstCom.response.status, secondCom.response.status, cn.response.status, otherIp.response.status],
      [200, 429, 200, 200],
    );
    assert.equal(calls, 3);
    const scopes = env.DB.__sqlite.prepare('SELECT market, scope FROM service_request_assist_quotas').all();
    assert.equal(scopes.some((row) => row.market === 'com'), true);
    assert.equal(scopes.some((row) => row.market === 'cn'), true);
    assert.doesNotMatch(JSON.stringify(scopes), /198\.51\.100\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('missing quota migration fails closed with a generic 503 before provider access', async (t) => {
  const env = createEnv(t, {}, { migrated: false });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return providerResponse({}); };
  try {
    const result = await api(env, { message: 'Organize this request', draft });
    assert.equal(result.response.status, 503);
    assert.deepEqual(result.json, { error: 'Service request AI is temporarily unavailable' });
    assert.doesNotMatch(JSON.stringify(result.json), /quota|table|sql|migration/i);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider timeout, exception, and HTTP failure return sanitized 503 errors', async (t) => {
  const cases = [
    { fetch: () => new Promise(() => {}), env: { SERVICE_REQUEST_ASSIST_TIMEOUT_MS: '10' } },
    {
      fetch: async () => new Response(new ReadableStream({ start() {} }), { status: 200 }),
      env: { SERVICE_REQUEST_ASSIST_TIMEOUT_MS: '10' },
    },
    { fetch: async () => { throw new Error('provider secret failure'); }, env: {} },
    { fetch: async () => new Response('provider internal details', { status: 500 }), env: {} },
  ];
  const originalFetch = globalThis.fetch;
  try {
    for (const [index, item] of cases.entries()) {
      globalThis.fetch = item.fetch;
      const result = await api(createEnv(t, item.env), { message: 'Please organize this', draft }, { ip: `203.0.113.${50 + index}` });
      assert.equal(result.response.status, 503);
      assert.deepEqual(result.json, { error: 'Service request AI is temporarily unavailable' });
      assert.doesNotMatch(JSON.stringify(result.json), /provider|secret|internal details/i);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('oversized streamed provider bodies abort before buffering and return an empty safe result', async (t) => {
  const env = createEnv(t);
  const originalFetch = globalThis.fetch;
  let providerSignal;
  globalThis.fetch = async (_url, init) => {
    providerSignal = init.signal;
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(129 * 1024));
        controller.close();
      },
    }), { status: 200 });
  };
  try {
    const result = await api(env, { message: 'Organize oversized response safely', draft });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.json, { patch: {}, missing_fields: [], next_question: '', safety_notice: '' });
    assert.equal(providerSignal.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('malformed or dangerous provider output fails closed without exposing free text', async (t) => {
  const outputs = [
    '{not-json',
    JSON.stringify({ patch: { description: 'Diagnosis confirmed. Engineer assigned for $100 today.' }, missing_fields: [], next_question: 'Unsafe', safety_notice: 'Unsafe' }),
    JSON.stringify({ patch: { production_impact: '质保两年，工程师今天到场' }, missing_fields: [], next_question: '', safety_notice: '' }),
  ];
  const originalFetch = globalThis.fetch;
  try {
    for (const [index, output] of outputs.entries()) {
      globalThis.fetch = async () => providerResponse(output);
      const result = await api(createEnv(t), { message: 'Organize this', draft }, { ip: `203.0.113.${60 + index}` });
      assert.equal(result.response.status, 200);
      assert.deepEqual(result.json, { patch: {}, missing_fields: [], next_question: '', safety_notice: '' });
      assert.doesNotMatch(JSON.stringify(result.json), /diagnosis|engineer|\$100|质保|到场/i);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
