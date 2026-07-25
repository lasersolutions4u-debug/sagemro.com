import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const JWT_SECRET = 'cn-engineer-workspace-sync-secret';
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

function createEnv(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(schemaSql);
  t.after(() => sqlite.close());

  const DB = {
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
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };

  sqlite.exec(`
    INSERT INTO customers (id, user_no, name, phone, password_hash)
    VALUES ('customer-1', 'U000001', '客户一', '13800000001', 'hash');
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role)
    VALUES ('lead-1', 'E000001', '区域负责人', '13800000011', 'hash', 'regional_lead');
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role, regional_lead_id)
    VALUES ('eng-1', 'E000002', '张工程师', '13800000012', 'hash', 'engineer', 'lead-1');
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role)
    VALUES ('lead-2', 'E000003', '其他负责人', '13800000013', 'hash', 'regional_lead');
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role, regional_lead_id)
    VALUES ('eng-2', 'E000004', '其他工程师', '13800000014', 'hash', 'engineer', 'lead-2');
    INSERT INTO work_orders (
      id, order_no, customer_id, engineer_id, type, description, status,
      assigned_regional_lead_id, created_at
    ) VALUES
      ('wo-queue', 'WO-QUEUE', 'customer-1', NULL, 'maintenance', '区域待派工', 'assigned', 'lead-1', '2026-07-26 12:00:00'),
      ('wo-lead', 'WO-LEAD', 'customer-1', 'lead-1', 'maintenance', '负责人个人工单', 'assigned', 'lead-1', '2026-07-26 11:00:00'),
      ('wo-member', 'WO-MEMBER', 'customer-1', 'eng-1', 'maintenance', '下属工程师工单', 'assigned', NULL, '2026-07-26 10:00:00'),
      ('wo-outsider', 'WO-OUTSIDER', 'customer-1', 'eng-2', 'maintenance', '区域外工单', 'assigned', 'lead-2', '2026-07-26 09:00:00');
  `);

  return { JWT_SECRET, DB, KV: { async get() { return null; }, async put() {} } };
}

async function api(env, path, { method = 'GET', body, userId = 'lead-1' } = {}) {
  const token = await signJwt({
    userId,
    userType: 'engineer',
    market: 'cn',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  const response = await worker.fetch(new Request(`https://api.sagemro.cn${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: 'https://engineer.sagemro.cn',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

test('Chinese regional lead sees personal and direct team work orders without finance fields', async (t) => {
  const env = createEnv(t);

  const personal = await api(env, '/api/engineers/tickets?scope=personal');
  assert.equal(personal.response.status, 200);
  assert.equal(personal.json.scope, 'personal');
  assert.deepEqual(personal.json.work_orders.map((row) => row.id), ['wo-lead']);

  const team = await api(env, '/api/engineers/tickets?scope=team');
  assert.equal(team.response.status, 200);
  assert.equal(team.json.scope, 'team');
  assert.deepEqual(team.json.work_orders.map((row) => [row.id, row.ownership_relation]), [
    ['wo-queue', 'regional_queue'],
    ['wo-lead', 'personal'],
    ['wo-member', 'current_team_member'],
  ]);
  assert.deepEqual(team.json.team.map((row) => row.id), ['eng-1']);
  assert.equal(team.json.work_orders.some((row) => row.id === 'wo-outsider'), false);
  for (const row of team.json.work_orders) {
    assert.equal(Object.hasOwn(row, 'customer_phone'), false);
    assert.equal(Object.hasOwn(row, 'payment_state'), false);
    assert.equal(Object.hasOwn(row, 'received_amount'), false);
    assert.equal(Object.hasOwn(row, 'outstanding_amount'), false);
    assert.equal(Object.hasOwn(row, 'pending_receipt_claim_count'), false);
  }

  const ordinaryEngineer = await api(env, '/api/engineers/tickets?scope=team', { userId: 'eng-1' });
  assert.equal(ordinaryEngineer.response.status, 403);
});

test('Chinese regional lead reads a direct subordinate order but cannot write as the executor', async (t) => {
  const env = createEnv(t);

  const detail = await api(env, '/api/workorders/wo-member');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.id, 'wo-member');

  const messages = await api(env, '/api/workorders/wo-member/messages');
  assert.equal(messages.response.status, 200);

  const postMessage = await api(env, '/api/workorders/wo-member/messages', {
    method: 'POST',
    body: { content: '负责人管理备注' },
  });
  assert.equal(postMessage.response.status, 403);

  const unrelated = await api(env, '/api/workorders/wo-member', { userId: 'lead-2' });
  assert.equal(unrelated.response.status, 403);
});
