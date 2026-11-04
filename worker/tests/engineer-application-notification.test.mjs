import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

function createEnv(overrides = {}) {
  const bindings = [];
  return {
    JWT_SECRET: 'test-secret-with-enough-length',
    VERIFICATION_EMAIL_FROM: 'SAGEMRO <verify@sagemro.com>',
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            bindings.push({ sql, args });
            return this;
          },
          async first() { return null; },
          async all() { return { results: [] }; },
          async run() { return { success: true }; },
        };
      },
    },
    KV: { async get() { return null; }, async put() {} },
    __bindings: bindings,
    ...overrides,
  };
}

function captureFetch(status = 200) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init?.body || '{}') });
    return new Response(JSON.stringify({ id: 'email_1' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

async function submit(env, { host = 'https://api.sagemro.com', origin = 'https://engineer.sagemro.com', payload }) {
  const pending = [];
  const response = await worker.fetch(new Request(`${host}/api/engineer-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(payload),
  }), env, { waitUntil(promise) { pending.push(promise); } });
  await Promise.all(pending);
  return response;
}

const COM_APPLICATION = {
  name: 'Alex Service',
  phone: '+1 555 0100',
  email: '  Alex.Service@Example.COM  ',
  country: 'US',
  city: 'Chicago',
  service_regions: ['Illinois'],
  equipment_types: ['Laser cutting machine'],
  skill_tags: ['Fiber laser repair'],
  can_travel: true,
  experience_summary: '8 years of field service.',
};

test('engineer application emails the full form to support@sagemro.com as an HTML attachment', async () => {
  const resend = captureFetch();
  const env = createEnv({ RESEND_API_KEY: 're_test' });
  try {
    const response = await submit(env, { payload: COM_APPLICATION });

    assert.equal(response.status, 200);
    assert.equal(resend.calls.length, 1);
    const { url, init, body } = resend.calls[0];
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init.headers.Authorization, 'Bearer re_test');
    assert.deepEqual(body.to, ['support@sagemro.com']);
    assert.equal(body.from, 'SAGEMRO <verify@sagemro.com>');
    assert.equal(body.reply_to, 'alex.service@example.com');
    assert.match(body.subject, /SAGEMRO·COM/);
    assert.match(body.subject, /Alex Service/);

    assert.equal(body.attachments.length, 1);
    assert.match(body.attachments[0].filename, /^sagemro-engineer-application-\d{8}-AlexService-[A-Za-z0-9_-]{8}\.html$/);
    const sheet = Buffer.from(body.attachments[0].content, 'base64').toString('utf8');
    assert.match(sheet, /<!doctype html>/i);
    assert.match(sheet, /Alex Service/);
    assert.match(sheet, /\+1 555 0100/);
    assert.match(sheet, /Chicago/);
    assert.match(sheet, /Fiber laser repair/);
    assert.match(sheet, /8 years of field service\./);
    assert.match(sheet, /是 \/ Yes/);
  } finally {
    resend.restore();
  }
});

test('engineer application notice keeps UTF-8 applicant names intact in the attachment', async () => {
  const resend = captureFetch();
  const env = createEnv({ RESEND_API_KEY: 're_test' });
  try {
    const response = await submit(env, {
      host: 'https://api.sagemro.cn',
      origin: 'https://engineer.sagemro.cn',
      payload: {
        name: '张三',
        phone: '13800000000',
        email: 'zhangsan@example.com',
        country: '中国',
        province: '浙江',
        city: '杭州',
        service_regions: ['浙江', '江苏'],
        skill_tags: ['激光切割机维修'],
        can_weekend: true,
        can_night: false,
      },
    });

    assert.equal(response.status, 200);
    const body = resend.calls[0].body;
    assert.match(body.subject, /SAGEMRO·CN/);
    assert.match(body.subject, /张三/);
    assert.match(body.subject, /杭州/);

    const sheet = Buffer.from(body.attachments[0].content, 'base64').toString('utf8');
    assert.match(sheet, /张三/);
    assert.match(sheet, /杭州/);
    assert.match(sheet, /浙江、江苏/);
    assert.match(sheet, /激光切割机维修/);
    assert.match(sheet, /sagemro\.cn/);
  } finally {
    resend.restore();
  }
});

test('engineer application still succeeds when no email provider is configured', async () => {
  const env = createEnv();
  const response = await submit(env, { payload: COM_APPLICATION });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(env.__bindings.some(({ sql }) => sql.includes('INSERT INTO engineer_applications')), true);
});

test('engineer application still succeeds when the notification provider fails', async () => {
  const resend = captureFetch(500);
  const env = createEnv({ RESEND_API_KEY: 're_test' });
  try {
    const response = await submit(env, { payload: COM_APPLICATION });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  } finally {
    resend.restore();
  }
});

test('engineer application notice recipients can be overridden with env', async () => {
  const resend = captureFetch();
  const env = createEnv({
    RESEND_API_KEY: 're_test',
    ENGINEER_APPLICATION_NOTIFY_TO: 'ops@sagemro.com, founder@sagemro.com',
  });
  try {
    await submit(env, { payload: COM_APPLICATION });
    assert.deepEqual(resend.calls[0].body.to, ['ops@sagemro.com', 'founder@sagemro.com']);
  } finally {
    resend.restore();
  }
});

function captureEmailBinding(env) {
  const sent = [];
  env.__EmailMessage = class {
    constructor(from, to, raw) {
      this.from = from;
      this.to = to;
      this.raw = raw;
    }
  };
  env.EMAIL = { async send(message) { sent.push(message); } };
  return sent;
}

function unfoldHeaderValue(value) {
  // RFC 2047：相邻 encoded-word 之间的折行空白要被丢弃。
  return value.replace(/\r\n[ \t]+/g, '');
}

function decodeHeaderValue(value) {
  return unfoldHeaderValue(value).replace(/=\?UTF-8\?B\?([^?]*)\?=/gi, (_, encoded) => Buffer.from(encoded, 'base64').toString('utf8'));
}

function mimeBodies(raw) {
  return raw
    .split(/\r\n--(?:sagemro-notice-[0-9a-f-]+|alt)/i)
    .map((chunk) => chunk.split('\r\n\r\n').slice(1).join('\r\n\r\n'))
    .filter(Boolean)
    .map((body) => Buffer.from(body.replace(/[\r\n]/g, ''), 'base64').toString('utf8'));
}

test('engineer application MIME keeps headers pure ASCII and RFC 2047-encodes the Chinese subject', async () => {
  const env = createEnv();
  const sent = captureEmailBinding(env);

  await submit(env, {
    host: 'https://api.sagemro.cn',
    origin: 'https://engineer.sagemro.cn',
    payload: {
      name: '张三',
      phone: '13800000000',
      email: 'zhangsan@example.com',
      city: '杭州',
      service_regions: ['浙江'],
      skill_tags: ['激光切割机维修'],
    },
  });

  assert.equal(sent.length, 1);
  const { raw } = sent[0];
  const headerBlock = raw.split('\r\n\r\n')[0];

  // 头区必须全是 ASCII：裸 UTF-8 字节会被收件端按 US-ASCII 解码，中文变成一个个 '?'。
  assert.equal(/[^\x00-\x7F]/.test(headerBlock), false);

  const unfoldedHeaders = unfoldHeaderValue(headerBlock);
  const subjectHeader = unfoldedHeaders.match(/^Subject: (.*)$/m)[1];
  assert.match(subjectHeader, /^=\?UTF-8\?B\?/);
  assert.equal(decodeHeaderValue(subjectHeader), '[SAGEMRO·CN] 新工程师申请：张三（杭州）');

  // 正文与附件改为 base64，解出来仍是中文原文。
  const bodyText = mimeBodies(raw).join('\n');
  assert.match(bodyText, /张三/);
  assert.match(bodyText, /杭州/);
  assert.match(bodyText, /激光切割机维修/);
  assert.match(bodyText, /<!doctype html>/i);

  // 没有任何一行超长（base64 行宽 / SMTP 998 字符限制）。
  const longLines = raw.split('\r\n').filter((line) => line.length > 998);
  assert.deepEqual(longLines, []);
});

test('engineer application notice prefers the Cloudflare email binding over Resend', async () => {
  const resend = captureFetch();
  const env = createEnv({ RESEND_API_KEY: 're_test' });
  const sent = captureEmailBinding(env);
  try {
    await submit(env, { payload: COM_APPLICATION });
    assert.equal(sent.length, 1);
    assert.equal(resend.calls.length, 0);
    assert.match(sent[0].raw, /^From: SAGEMRO <verify@sagemro\.com>/);
  } finally {
    resend.restore();
  }
});
