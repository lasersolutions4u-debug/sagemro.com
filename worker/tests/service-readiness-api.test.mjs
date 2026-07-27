import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker, { executeTool } from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const JWT_SECRET = 'service-readiness-api-test-secret';
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

function createD1Database(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(schemaSql);
  t.after(() => sqlite.close());

  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...args);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
    __sqlite: sqlite,
  };
}

function createEnv(t) {
  const DB = createD1Database(t);
  const sqlite = DB.__sqlite;
  sqlite.exec(`
    INSERT INTO customers (id, user_no, name, phone, password_hash) VALUES
      ('customer-1', 'U000001', 'Customer One', '+15550000001', 'hash'),
      ('customer-2', 'U000002', 'Customer Two', '+15550000002', 'hash');
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role)
      VALUES ('eng-1', 'E000001', 'Assigned Engineer', '+15550000011', 'hash', 'engineer');
    INSERT INTO conversations (id, title, customer_id) VALUES
      ('conversation-customer-1', 'Customer One AI chat', 'customer-1'),
      ('conversation-customer-2', 'Customer Two AI chat', 'customer-2');
    INSERT INTO messages (id, conversation_id, role, content, image_urls) VALUES
      ('message-chat-image-1', 'conversation-customer-1', 'user',
       'The laser head leaks light like this.',
       '["https://cdn.sagemro.com/chat-images/diag-1.jpg"]');
  `);

  // waitUntil 只收集后台 promise，测试断言完 HTTP 响应后才统一 await，
  // 避免 AI 摘要等后台任务让请求时序变得不确定。
  const pending = [];
  t.after(async () => {
    await Promise.all(pending.splice(0));
  });

  return {
    JWT_SECRET,
    DB,
    KV: { async get() { return null; }, async put() {} },
    __pending: pending,
  };
}

async function tokenFor(userId, userType = 'customer') {
  return signJwt({
    userId,
    userType,
    market: 'com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
}

async function api(env, path, { method = 'GET', body, userId = 'customer-1', userType = 'customer' } = {}) {
  const token = await tokenFor(userId, userType);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: 'https://sagemro.com',
  };
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil(promise) { env.__pending.push(promise); } });
  const json = await response.json();
  return { response, json };
}

test('manual work-order creation stores only an authenticated customer-owned source conversation', async (t) => {
  const env = createEnv(t);
  const created = await api(env, '/api/workorders', {
    method: 'POST', userType: 'customer', userId: 'customer-1',
    body: {
      customer_id: 'customer-2', // ignored; JWT is authoritative
      conversation_id: 'conversation-customer-1',
      type: 'fault', description: 'Laser stops with alarm E203.', urgency: 'urgent',
    },
  });

  assert.equal(created.response.status, 200);
  const workOrderId = created.json.work_order.id;
  assert.equal(
    env.DB.__sqlite.prepare(
      'SELECT customer_id FROM work_orders WHERE id = ?',
    ).get(workOrderId).customer_id,
    'customer-1',
  );
  assert.equal(
    env.DB.__sqlite.prepare(
      'SELECT source_conversation_id FROM work_order_service_readiness WHERE work_order_id = ?',
    ).get(workOrderId).source_conversation_id,
    'conversation-customer-1',
  );
  assert.equal(
    env.DB.__sqlite.prepare(
      'SELECT COUNT(*) AS count FROM work_order_attachments WHERE work_order_id = ?',
    ).get(workOrderId).count,
    1,
  );
});

test('foreign conversation IDs are not linked or copied into a customer work order', async (t) => {
  const env = createEnv(t);
  const created = await api(env, '/api/workorders', {
    method: 'POST', userType: 'customer', userId: 'customer-1',
    body: {
      conversation_id: 'conversation-customer-2',
      type: 'fault', description: 'Machine stops intermittently.', urgency: 'normal',
    },
  });

  assert.equal(created.response.status, 200);
  const workOrderId = created.json.work_order.id;
  assert.equal(env.DB.__sqlite.prepare(
    'SELECT source_conversation_id FROM work_order_service_readiness WHERE work_order_id = ?',
  ).get(workOrderId).source_conversation_id, null);
  assert.equal(env.DB.__sqlite.prepare(
    'SELECT COUNT(*) AS count FROM work_order_attachments WHERE work_order_id = ?',
  ).get(workOrderId).count, 0);
});

test('schema keeps the readiness cache out of work_orders and enforces its state set', (t) => {
  const env = createEnv(t);
  const tableSql = env.DB.__sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'work_order_service_readiness'",
  ).get().sql;
  assert.match(tableSql, /generation_state TEXT NOT NULL DEFAULT 'missing'/);
  assert.match(tableSql, /ON DELETE SET NULL/);
  assert.equal(env.DB.__sqlite.prepare(
    "SELECT COUNT(*) AS count FROM pragma_table_info('work_orders') WHERE name = 'source_conversation_id'",
  ).get().count, 0);
});

test('AI create_work_order tool links a customer-owned source conversation and its images', async (t) => {
  const env = createEnv(t);
  const result = await executeTool({
    toolName: 'create_work_order',
    args: {
      type: 'fault',
      description: 'The fiber laser cutter stops mid-cut with alarm E203.',
      urgency: 'urgent',
    },
    env,
    ctx: { waitUntil(promise) { env.__pending.push(promise); } },
    userRole: 'customer',
    customerId: 'customer-1',
    conversationId: 'conversation-customer-1',
    market: 'com',
    iteration: 0,
  });

  assert.equal(result.success, true);
  const workOrderId = result.work_order.id;
  assert.equal(
    env.DB.__sqlite.prepare(
      'SELECT source_conversation_id FROM work_order_service_readiness WHERE work_order_id = ?',
    ).get(workOrderId).source_conversation_id,
    'conversation-customer-1',
  );
  assert.equal(
    env.DB.__sqlite.prepare(
      'SELECT COUNT(*) AS count FROM work_order_attachments WHERE work_order_id = ?',
    ).get(workOrderId).count,
    1,
  );
  assert.equal(result.attached_images_count, 1);
});
