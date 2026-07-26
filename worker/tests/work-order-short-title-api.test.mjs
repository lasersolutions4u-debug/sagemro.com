import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const JWT_SECRET = 'work-order-short-title-api-test-secret';
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

function insertStaff(sqlite, { id, role }) {
  sqlite.prepare(`
    INSERT INTO admin_staff_accounts (
      id, normalized_login, password_hash, salt, role, is_active,
      display_name, market_scope, must_change_password
    ) VALUES (?, ?, 'hash', 'salt', ?, 1, ?, 'com', 0)
  `).run(id, `${id}@example.com`, role, id);
}

function createEnv(t) {
  const DB = createD1Database(t);
  DB.__sqlite.exec(`
    INSERT INTO customers (id, user_no, name, phone, password_hash)
    VALUES ('customer-1', 'U000001', 'Customer One', '+15550000001', 'hash');
    INSERT INTO engineers (
      id, user_no, name, phone, password_hash, engineer_role
    ) VALUES (
      'lead-1', 'E000001', 'Regional Lead', '+15550000011', 'hash', 'regional_lead'
    );
    INSERT INTO work_orders (
      id, order_no, customer_id, type, description, status, assigned_regional_lead_id
    ) VALUES (
      'wo-title', 'WO-TITLE', 'customer-1', 'maintenance',
      'Title update fixture', 'assigned', 'lead-1'
    );
  `);

  return {
    JWT_SECRET,
    DB,
    KV: { async get() { return null; }, async put() {} },
  };
}

async function api(env, path, {
  method = 'GET',
  body,
  userType,
  userId,
  staffId,
} = {}) {
  const token = await signJwt({
    userId,
    userType,
    market: 'com',
    staffId,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  const origin = userType === 'admin'
    ? 'https://admin.sagemro.com'
    : 'https://engineer.sagemro.com';
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('Admin persists a normalized short title and writes an audit record', async (t) => {
  const env = createEnv(t);
  const { response, json } = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin',
    body: { short_title: "  Han's   Laser 3015 repair  " },
  });

  assert.equal(response.status, 200);
  assert.equal(json.work_order.short_title, "Han's Laser 3015 repair");
  assert.equal(json.work_order.display_title, "Han's Laser 3015 repair");
  assert.equal(
    env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    "Han's Laser 3015 repair",
  );
  assert.equal(
    env.DB.__sqlite.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'work_order_short_title_updated'").get().count,
    1,
  );
});

test('Admin-role staff can edit but operations staff cannot', async (t) => {
  const env = createEnv(t);
  insertStaff(env.DB.__sqlite, { id: 'staff-admin', role: 'admin' });
  insertStaff(env.DB.__sqlite, { id: 'staff-operations', role: 'operations' });

  const allowed = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'staff-admin', staffId: 'staff-admin',
    body: { short_title: 'Admin staff title' },
  });
  assert.equal(allowed.response.status, 200);

  const forbidden = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'staff-operations', staffId: 'staff-operations',
    body: { short_title: 'Operations title' },
  });
  assert.equal(forbidden.response.status, 403);
});

test('empty and over-limit titles are rejected without changing the row', async (t) => {
  const env = createEnv(t);
  for (const short_title of ['   ', 'x'.repeat(101)]) {
    const { response } = await api(env, '/api/admin/workorders/wo-title/short-title', {
      method: 'PATCH', userType: 'admin', userId: 'admin', body: { short_title },
    });
    assert.equal(response.status, 400);
  }
  assert.equal(
    env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    null,
  );
});

test('Regional Leads cannot edit work-order titles', async (t) => {
  const env = createEnv(t);
  const { response } = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'engineer', userId: 'lead-1', body: { short_title: 'Unauthorized edit' },
  });
  assert.equal(response.status, 403);
});
