import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';
import { buildServiceStandardDefinition } from '../src/lib/serviceStandard.js';

const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

function createEnv() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schemaSql);
  sqlite.exec(`
    INSERT INTO customers (id, user_no, name, phone, password_hash, salt) VALUES
      ('customer-1', 'U910001', 'Owner Customer', '13800000001', 'hash', 'salt'),
      ('customer-2', 'U910002', 'Other Customer', '13800000002', 'hash', 'salt');

    INSERT INTO engineers (id, user_no, name, phone, password_hash, salt)
    VALUES ('engineer-1', 'E910001', 'Assigned Engineer', '13800000003', 'hash', 'salt');

    INSERT INTO work_orders (
      id, order_no, customer_id, engineer_id, type, description, status,
      service_mode, arrival_verification_required, onsite_conversion_status
    ) VALUES
      (
        'wo-active', 'WO-ACTIVE', 'customer-1', 'engineer-1', 'maintenance',
        'Active order', 'in_service', 'remote', 0, 'not_requested'
      ),
      (
        'wo-legacy', 'WO-LEGACY', 'customer-1', 'engineer-1', 'maintenance',
        'Legacy assigned order', 'assigned', 'remote', 0, 'not_requested'
      ),
      (
        'wo-completed', 'WO-COMPLETED', 'customer-1', NULL, 'maintenance',
        'Historical completed order', 'completed', 'remote', 0, 'not_requested'
      );
  `);

  const insertProgress = sqlite.prepare(`
    INSERT INTO work_order_service_standard_progress (
      work_order_id, standard_version, step_key, item_key, state,
      is_required, owner_type
    ) VALUES (?, 1, ?, ?, ?, ?, ?)
  `);
  const definition = buildServiceStandardDefinition({ serviceMode: 'remote' });
  for (const item of definition.items) {
    insertProgress.run(
      'wo-legacy',
      item.stepKey,
      item.key,
      item.stepIndex === 0 ? 'legacy_not_recorded' : 'pending',
      item.required ? 1 : 0,
      item.owner,
    );
    insertProgress.run(
      'wo-completed',
      item.stepKey,
      item.key,
      'legacy_not_recorded',
      item.required ? 1 : 0,
      item.owner,
    );
  }

  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    __sqlite: sqlite,
    KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
  };
  env.DB = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...this.args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...this.args) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...this.args);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return env;
}

async function api(env, path, {
  userId = 'customer-1',
  userType = 'customer',
  staffId,
} = {}) {
  const jwt = await signJwt({
    userId,
    userType,
    staffId,
    market: 'com',
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const response = await worker.fetch(
    new Request(`https://api.sagemro.com${path}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Origin: 'https://sagemro.com',
      },
    }),
    env,
    { waitUntil() {} },
  );
  return { response, json: await response.json().catch(() => ({})) };
}

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

function assertPublicMilestoneShape(detail) {
  assert.equal(detail.public_service_milestones.length, 6);
  for (const milestone of detail.public_service_milestones) {
    assert.deepEqual(Object.keys(milestone).sort(), ['key', 'state']);
  }
}

function assertNoInternalServiceStandardData(detail) {
  const keys = collectKeys(detail);
  for (const forbidden of [
    'service_standard',
    'blocking_items',
    'owner_type',
    'confirmed_by_id',
    'not_applicable_reason',
    'overrides',
    'guidance',
    'guidance_json',
    'review_json',
  ]) {
    assert.equal(keys.has(forbidden), false, `customer response exposed ${forbidden}`);
  }
}

test('customer detail exposes only six public service milestone key/state pairs', async (t) => {
  const env = createEnv();
  t.after(() => env.__sqlite.close());

  const detail = await api(env, '/api/workorders/wo-active');

  assert.equal(detail.response.status, 200);
  assertPublicMilestoneShape(detail.json);
  assertNoInternalServiceStandardData(detail.json);
  assert.equal(
    detail.json.public_service_milestones.filter((milestone) => milestone.state === 'current').length,
    1,
  );
  assert.equal(detail.json.public_service_milestones[0].state, 'current');
});

test('legacy prior stages stay legacy_not_recorded and are never presented as completed', async (t) => {
  const env = createEnv();
  t.after(() => env.__sqlite.close());

  const detail = await api(env, '/api/workorders/wo-legacy');

  assert.equal(detail.response.status, 200);
  assertPublicMilestoneShape(detail.json);
  assert.equal(detail.json.public_service_milestones[0].state, 'legacy_not_recorded');
  assert.notEqual(detail.json.public_service_milestones[0].state, 'completed');
});

test('completed historical work orders do not fabricate recovery verification', async (t) => {
  const env = createEnv();
  t.after(() => env.__sqlite.close());

  const detail = await api(env, '/api/workorders/wo-completed');

  assert.equal(detail.response.status, 200);
  assertPublicMilestoneShape(detail.json);
  const verification = detail.json.public_service_milestones.find(
    (milestone) => milestone.key === 'recovery_verification',
  );
  assert.equal(verification.state, 'legacy_not_recorded');
  assert.notEqual(verification.state, 'completed');
});

test('other customers receive 403 without milestone or internal service-standard data', async (t) => {
  const env = createEnv();
  t.after(() => env.__sqlite.close());

  const denied = await api(env, '/api/workorders/wo-active', { userId: 'customer-2' });

  assert.equal(denied.response.status, 403);
  assert.equal('public_service_milestones' in denied.json, false);
  assertNoInternalServiceStandardData(denied.json);
});

test('engineer and Admin details do not receive the customer milestone projection or internal snapshot', async (t) => {
  const env = createEnv();
  t.after(() => env.__sqlite.close());

  for (const auth of [
    { userType: 'engineer', userId: 'engineer-1' },
    { userType: 'admin', userId: 'admin-1' },
  ]) {
    const detail = await api(env, '/api/workorders/wo-active', auth);
    assert.equal(detail.response.status, 200, auth.userType);
    assert.equal('public_service_milestones' in detail.json, false, auth.userType);
    assert.equal('service_standard' in detail.json, false, auth.userType);
  }
});
