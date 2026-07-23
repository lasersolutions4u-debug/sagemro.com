import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';
import { REQUISITION_OPERATION_METRIC_QUERIES } from '../src/lib/requisitionMetrics.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createEnv(role = 'operations') {
  const staff = {
    id: `${role}-1`, role, is_active: 1, market_scope: 'all', must_change_password: 0,
  };
  return {
    JWT_SECRET: 'metrics-test-secret',
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'bootstrap-password',
    KV: { async get() { return null; } },
    DB: {
      prepare(sql) {
        return {
          args: [],
          bind(...args) { this.args = args; return this; },
          async all() { return { results: [] }; },
          async first() {
            const normalized = normalizeSql(sql);
            if (/FROM admin_staff_accounts WHERE id = \?/i.test(normalized)) return staff;
            if (/status = 'submitted'/i.test(normalized) && /material_requisitions/i.test(normalized)) return { count: 7 };
            if (/stock_allocated_quantity \+ procurement_received_quantity < requested_quantity/i.test(normalized)) return { count: 4 };
            if (/required_date < date\('now'\)/i.test(normalized)) return { count: 3 };
            if (/julianday\(received_at\)/i.test(normalized) && /ROW_NUMBER\(\) OVER/i.test(normalized)) return { value: 26.25 };
            if (/julianday\(approved_at\)/i.test(normalized) && /ROW_NUMBER\(\) OVER/i.test(normalized)) return { value: 5.5 };
            if (/status != 'draft'/i.test(normalized) && /closure/i.test(normalized)) return { closure_rate_percent: 62.5 };
            if (/COUNT\(\*\)/i.test(normalized)) return { count: 0 };
            return null;
          },
        };
      },
    },
  };
}

async function adminToken(env, { role = 'operations', userType = 'admin', staffId = `${role}-1` } = {}) {
  return signJwt({
    userId: staffId || 'admin', userType, staffId, staffRole: role,
    mustChangePassword: false, phone: '13800000000', market: 'com', iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function getWithToken(env, path, token) {
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Origin: 'https://admin.sagemro.com' },
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

test('operational metrics endpoint returns only the scoped requisition shape', async () => {
  const env = createEnv('operations');
  const result = await getWithToken(env, '/api/material-requisitions/metrics', await adminToken(env));

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.json, {
    requisitionOperations: {
      pendingApproval: 7,
      shortages: 4,
      overdue: 3,
      medianApprovalHours: 5.5,
      medianFulfillmentHours: 26.25,
      closureRatePercent: 62.5,
    },
  });
});

test('operational staff remain denied full admin stats and unrelated admin APIs', async () => {
  const env = createEnv('operations');
  const token = await adminToken(env);

  assert.equal((await getWithToken(env, '/api/admin/stats', token)).response.status, 403);
  assert.equal((await getWithToken(env, '/api/admin/users', token)).response.status, 403);
});

test('operations staff can read service orders and materials but cannot mutate them', async () => {
  const env = createEnv('operations');
  const token = await adminToken(env);

  assert.equal((await getWithToken(env, '/api/admin/workorders', token)).response.status, 200);
  assert.equal((await getWithToken(env, '/api/admin/materials', token)).response.status, 200);

  const write = async (path, method) => worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Origin: 'https://admin.sagemro.com' },
  }), env, { waitUntil() {} });
  assert.equal((await write('/api/admin/materials', 'POST')).status, 403);
  assert.equal((await write('/api/admin/workorders/wo-1/archive', 'PATCH')).status, 403);
});

test('scoped metrics deny engineers and customers while allowing bootstrap admin', async () => {
  const env = createEnv('operations');
  const bootstrap = await adminToken(env, { role: 'admin', staffId: null });
  const engineer = await adminToken(env, { role: 'engineer', userType: 'engineer', staffId: null });
  const customer = await adminToken(env, { role: 'customer', userType: 'customer', staffId: null });

  assert.equal((await getWithToken(env, '/api/material-requisitions/metrics', bootstrap)).response.status, 200);
  assert.equal((await getWithToken(env, '/api/material-requisitions/metrics', engineer)).response.status, 403);
  assert.equal((await getWithToken(env, '/api/material-requisitions/metrics', customer)).response.status, 403);
});

test('metrics queries handle active boundaries, even medians, and empty samples in SQLite', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE material_requisitions (
      id TEXT PRIMARY KEY, status TEXT, required_date TEXT, created_at TEXT,
      submitted_at TEXT, approved_at TEXT, received_at TEXT
    );
    CREATE TABLE material_requisition_items (
      id TEXT PRIMARY KEY, requisition_id TEXT, status TEXT, requested_quantity INTEGER,
      stock_allocated_quantity INTEGER DEFAULT 0, procurement_received_quantity INTEGER DEFAULT 0
    );
  `);

  assert.equal(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.medianApproval).get().value, null);
  assert.equal(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.closureRate).get().closure_rate_percent, null);

  const insertHeader = db.prepare('INSERT INTO material_requisitions VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertHeader.run('submitted', 'submitted', '2000-01-01', '2026-01-01 00:00:00', '2026-01-01 00:00:00', null, null);
  insertHeader.run('active', 'approved', '2000-01-01', '2020-01-01 00:00:00', '2026-01-01 01:00:00', '2026-01-01 02:00:00', null);
  insertHeader.run('closed', 'closed', '2000-01-01', '2026-01-01 00:00:00', '2026-01-01 02:00:00', '2026-01-01 06:00:00', '2026-01-01 16:00:00');
  insertHeader.run('draft', 'draft', '2000-01-01', '2010-01-01 00:00:00', null, null, null);
  const insertItem = db.prepare('INSERT INTO material_requisition_items VALUES (?, ?, ?, ?, ?, ?)');
  insertItem.run('short', 'active', 'pending', 5, 2, 1);
  insertItem.run('closed-short', 'closed', 'pending', 5, 0, 0);
  insertItem.run('cancelled', 'active', 'cancelled', 5, 0, 0);

  assert.equal(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.pendingApproval).get().count, 1);
  assert.equal(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.shortages).get().count, 1);
  assert.equal(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.overdue).get().count, 2);
  assert.ok(Math.abs(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.medianApproval).get().value - 2.5) < 0.001);
  assert.equal(Math.round(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.medianFulfillment).get().value), 10);
  assert.equal(db.prepare(REQUISITION_OPERATION_METRIC_QUERIES.closureRate).get().closure_rate_percent, 33.33);
});
