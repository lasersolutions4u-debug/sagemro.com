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

  const DB = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          const row = sqlite.prepare(sql).get(...args) || null;
          if (DB.__afterWorkOrderTitleRead && /SELECT id, short_title, updated_at FROM work_orders/i.test(sql)) {
            const afterRead = DB.__afterWorkOrderTitleRead;
            DB.__afterWorkOrderTitleRead = null;
            await afterRead();
          }
          return row;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          return this.runSync();
        },
        runSync() {
          if (DB.__failNextAudit && /INSERT INTO audit_logs/i.test(sql)) {
            DB.__failNextAudit = false;
            throw new Error('audit insert failed');
          }
          const result = sqlite.prepare(sql).run(...args);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement) => statement.runSync());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    __sqlite: sqlite,
  };
  return DB;
}

function titleAuditRows(sqlite) {
  return sqlite.prepare(`
    SELECT target_type, target_id, actor_type, actor_id, action, before_state, after_state
    FROM audit_logs WHERE action = 'work_order_short_title_updated'
    ORDER BY created_at, rowid
  `).all().map((row) => ({ ...row }));
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
  market = 'com',
} = {}) {
  const token = await signJwt({
    userId,
    userType,
    market,
    staffId,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  const suffix = market === 'cn' ? '.cn' : '.com';
  const origin = userType === 'admin'
    ? `https://admin.sagemro${suffix}`
    : `https://engineer.sagemro${suffix}`;
  const response = await worker.fetch(new Request(`https://api.sagemro${suffix}${path}`, {
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
  assert.deepEqual(titleAuditRows(env.DB.__sqlite), [{
    target_type: 'work_order',
    target_id: 'wo-title',
    actor_type: 'admin',
    actor_id: 'admin',
    action: 'work_order_short_title_updated',
    before_state: JSON.stringify({ short_title: null }),
    after_state: JSON.stringify({ short_title: "Han's Laser 3015 repair" }),
  }]);
});

test('Admin-role staff can edit but operations staff cannot', async (t) => {
  const allowedEnv = createEnv(t);
  insertStaff(allowedEnv.DB.__sqlite, { id: 'staff-admin', role: 'admin' });

  const allowed = await api(allowedEnv, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'staff-admin', staffId: 'staff-admin',
    body: { short_title: 'Admin staff title' },
  });
  assert.equal(allowed.response.status, 200);
  assert.deepEqual(titleAuditRows(allowedEnv.DB.__sqlite), [{
    target_type: 'work_order',
    target_id: 'wo-title',
    actor_type: 'admin',
    actor_id: 'staff-admin',
    action: 'work_order_short_title_updated',
    before_state: JSON.stringify({ short_title: null }),
    after_state: JSON.stringify({ short_title: 'Admin staff title' }),
  }]);

  const forbiddenEnv = createEnv(t);
  insertStaff(forbiddenEnv.DB.__sqlite, { id: 'staff-operations', role: 'operations' });
  const forbidden = await api(forbiddenEnv, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'staff-operations', staffId: 'staff-operations',
    body: { short_title: 'Operations title' },
  });
  assert.equal(forbidden.response.status, 403);
  assert.equal(
    forbiddenEnv.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    null,
  );
  assert.deepEqual(titleAuditRows(forbiddenEnv.DB.__sqlite), []);
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
  assert.deepEqual(titleAuditRows(env.DB.__sqlite), []);
});

test('Regional Leads cannot edit work-order titles', async (t) => {
  const env = createEnv(t);
  const { response } = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'engineer', userId: 'lead-1', body: { short_title: 'Unauthorized edit' },
  });
  assert.equal(response.status, 403);
  assert.equal(
    env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    null,
  );
  assert.deepEqual(titleAuditRows(env.DB.__sqlite), []);
});

test('missing work orders are rejected without changing titles or writing audit records', async (t) => {
  const env = createEnv(t);
  const { response } = await api(env, '/api/admin/workorders/wo-missing/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'admin', body: { short_title: 'Missing title' },
  });

  assert.equal(response.status, 404);
  assert.equal(
    env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    null,
  );
  assert.deepEqual(titleAuditRows(env.DB.__sqlite), []);
});

for (const [market, conflictMessage] of [
  ['com', 'The work-order title was changed by another admin. Refresh and try again.'],
  ['cn', '工单标题已被其他管理员更新，请刷新后重试'],
]) {
  test(`stale ${market.toUpperCase()} Admin title updates are rejected without a false audit`, async (t) => {
    const env = createEnv(t);
    env.DB.__afterWorkOrderTitleRead = async () => {
      const winning = await api(env, '/api/admin/workorders/wo-title/short-title', {
        method: 'PATCH', userType: 'admin', userId: 'winning-admin', market,
        body: { short_title: 'Winning title' },
      });
      assert.equal(winning.response.status, 200);
    };

    const stale = await api(env, '/api/admin/workorders/wo-title/short-title', {
      method: 'PATCH', userType: 'admin', userId: 'stale-admin', market,
      body: { short_title: 'Stale title' },
    });

    assert.equal(stale.response.status, 409);
    assert.equal(stale.json.error, conflictMessage);
    assert.equal(
      env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
      'Winning title',
    );
    assert.deepEqual(titleAuditRows(env.DB.__sqlite), [{
      target_type: 'work_order',
      target_id: 'wo-title',
      actor_type: 'admin',
      actor_id: 'winning-admin',
      action: 'work_order_short_title_updated',
      before_state: JSON.stringify({ short_title: null }),
      after_state: JSON.stringify({ short_title: 'Winning title' }),
    }]);
  });
}

test('audit insertion failure rolls back the title and does not return success', async (t) => {
  const env = createEnv(t);
  env.DB.__failNextAudit = true;

  const { response, json } = await api(env, '/api/admin/workorders/wo-title/short-title', {
    method: 'PATCH', userType: 'admin', userId: 'admin', body: { short_title: 'Atomic title' },
  });

  assert.equal(response.status, 500);
  assert.notEqual(json.success, true);
  assert.equal(
    env.DB.__sqlite.prepare('SELECT short_title FROM work_orders WHERE id = ?').get('wo-title').short_title,
    null,
  );
  assert.deepEqual(titleAuditRows(env.DB.__sqlite), []);
});
