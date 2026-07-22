import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createEnv() {
  const staff = {
    id: 'operations-1', role: 'operations', is_active: 1, market_scope: 'all', must_change_password: 0,
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

async function operationalStats(env) {
  const token = await signJwt({
    userId: 'operations-1', userType: 'admin', staffId: 'operations-1', staffRole: 'operations',
    mustChangePassword: false, phone: '13800000000', market: 'com', iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/admin/stats', {
    headers: { Authorization: `Bearer ${token}`, Origin: 'https://admin.sagemro.com' },
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

test('operational staff can read requisition pilot metrics without opening unrelated admin APIs', async () => {
  const env = createEnv();
  const stats = await operationalStats(env);

  assert.equal(stats.response.status, 200);
  assert.deepEqual(stats.json.requisitionOperations, {
    pendingApproval: 7,
    shortages: 4,
    overdue: 3,
    medianApprovalHours: 5.5,
    medianFulfillmentHours: 26.25,
    closureRatePercent: 62.5,
  });

  const token = await signJwt({
    userId: 'operations-1', userType: 'admin', staffId: 'operations-1', staffRole: 'operations',
    mustChangePassword: false, phone: '13800000000', market: 'com', iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const denied = await worker.fetch(new Request('https://api.sagemro.com/api/admin/users', {
    headers: { Authorization: `Bearer ${token}`, Origin: 'https://admin.sagemro.com' },
  }), env, { waitUntil() {} });
  assert.equal(denied.status, 403);
});

test('metrics SQL encodes the pilot definitions and true middle-row medians', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/index.js', import.meta.url), 'utf8'));

  assert.match(source, /status = 'submitted'/);
  assert.match(source, /stock_allocated_quantity \+ procurement_received_quantity < requested_quantity/);
  assert.match(source, /required_date < date\('now'\)/);
  assert.match(source, /ROW_NUMBER\(\) OVER \(ORDER BY hours\)/);
  assert.match(source, /approved_at[\s\S]*created_at/);
  assert.match(source, /received_at[\s\S]*approved_at/);
  assert.match(source, /status != 'draft'/);
  assert.match(source, /closure/);
});
