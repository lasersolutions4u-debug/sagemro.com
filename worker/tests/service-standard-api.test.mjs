import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function clone(value) {
  return structuredClone(value);
}

function createEnv() {
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    __workOrders: [{
      id: 'wo-1',
      order_no: 'WO-1',
      customer_id: 'customer-1',
      engineer_id: 'engineer-1',
      assigned_regional_lead_id: 'lead-1',
      status: 'in_service',
      service_mode: 'remote',
      arrival_verification_required: 0,
      onsite_conversion_status: 'not_requested',
    }],
    __engineers: [
      { id: 'engineer-1', engineer_role: 'engineer', regional_lead_id: 'lead-1' },
      { id: 'engineer-2', engineer_role: 'engineer', regional_lead_id: null },
      { id: 'lead-1', engineer_role: 'regional_lead', regional_lead_id: null },
    ],
    __staff: [{
      id: 'operations-1',
      role: 'operations',
      is_active: 1,
      market_scope: 'all',
      must_change_password: 0,
    }],
    __progress: [],
    __overrides: [],
    __auditLogs: [],
    __logs: [],
    __notifications: [],
    __repairRecords: [{
      work_order_id: 'wo-1',
      symptom: 'Intermittent output',
      diagnosis: 'Loose signal cable',
      solution: 'Reseated and secured the cable',
      parts_used: '[]',
      labor_hours: 1,
    }],
    __lastChanges: 0,
    __failNextAudit: false,
    __nextAuditError: null,
    __failWorkOrderLookup: false,
    __workOrderLookups: 0,
    KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
  };

  env.DB = {
    prepare(sql) {
      return createStatement(env, sql);
    },
    async batch(statements) {
      const snapshot = {
        workOrders: clone(env.__workOrders),
        progress: clone(env.__progress),
        overrides: clone(env.__overrides),
        auditLogs: clone(env.__auditLogs),
        logs: clone(env.__logs),
      };
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
      } catch (error) {
        env.__workOrders = snapshot.workOrders;
        env.__progress = snapshot.progress;
        env.__overrides = snapshot.overrides;
        env.__auditLogs = snapshot.auditLogs;
        env.__logs = snapshot.logs;
        throw error;
      }
    },
  };
  return env;
}

function createSqliteEnv() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schemaSql);
  sqlite.prepare(`
    INSERT INTO customers (id, user_no, name, phone, password_hash, salt)
    VALUES ('customer-1', 'U900001', 'Test Customer', '13800000001', 'hash', 'salt')
  `).run();
  sqlite.prepare(`
    INSERT INTO engineers (id, user_no, name, phone, password_hash, salt)
    VALUES ('engineer-1', 'E900001', 'Test Engineer', '13800000002', 'hash', 'salt')
  `).run();
  sqlite.prepare(`
    INSERT INTO work_orders (
      id, order_no, customer_id, engineer_id, type, description, status,
      service_mode, arrival_verification_required, onsite_conversion_status
    ) VALUES (
      'wo-1', 'WO-1', 'customer-1', 'engineer-1', 'maintenance', 'Test order',
      'in_service', 'remote', 0, 'not_requested'
    )
  `).run();

  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    __sqlite: sqlite,
    __conversionBatchHook: null,
    KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
  };
  env.DB = {
    prepare(sql) {
      return {
        normalizedSql: normalizeSql(sql),
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
        if (statements.some((statement) =>
          /UPDATE work_orders SET service_address = \?/i.test(statement.normalizedSql))) {
          env.__conversionBatchHook?.(sqlite);
          env.__conversionBatchHook = null;
        }
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

function createStatement(env, sql) {
  return {
    args: [],
    bind(...args) {
      this.args = args;
      return this;
    },
    async first() {
      const normalized = normalizeSql(sql);
      if (/FROM admin_staff_accounts WHERE id = \?/i.test(normalized)) {
        return clone(env.__staff.find((item) => item.id === this.args[0]) || null);
      }
      if (/FROM work_orders WHERE id = \?/i.test(normalized)) {
        env.__workOrderLookups += 1;
        if (env.__failWorkOrderLookup) {
          throw new Error('SQLITE_SECRET work_orders lookup exploded');
        }
        return clone(env.__workOrders.find((item) => item.id === this.args[0]) || null);
      }
      if (/SELECT id FROM engineers WHERE id = \? AND engineer_role = 'regional_lead'/i.test(normalized)) {
        return clone(env.__engineers.find((item) =>
          item.id === this.args[0] && item.engineer_role === 'regional_lead') || null);
      }
      if (/SELECT id FROM engineers WHERE id = \? AND regional_lead_id = \?/i.test(normalized)) {
        return clone(env.__engineers.find((item) =>
          item.id === this.args[0] && item.regional_lead_id === this.args[1]) || null);
      }
      if (/FROM work_order_service_standard_progress/i.test(normalized)
        && /item_key = \?/i.test(normalized)) {
        return clone(env.__progress.find((item) =>
          item.work_order_id === this.args[0]
          && item.standard_version === this.args[1]
          && item.item_key === this.args[2]) || null);
      }
      if (/FROM work_order_service_standard_progress/i.test(normalized)
        && /item_key = 'risk\.ppe_and_access'/i.test(normalized)) {
        return clone(env.__progress.find((item) =>
          item.work_order_id === this.args[0]
          && item.standard_version === this.args[1]
          && item.item_key === 'risk.ppe_and_access') || null);
      }
      if (/FROM work_order_repair_records WHERE work_order_id = \?/i.test(normalized)) {
        return clone(env.__repairRecords.find((item) => item.work_order_id === this.args[0]) || null);
      }
      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);
      if (/FROM work_order_service_standard_progress/i.test(normalized)) {
        return {
          results: clone(env.__progress
            .filter((item) =>
              item.work_order_id === this.args[0] && item.standard_version === this.args[1])
            .sort((left, right) =>
              left.step_key.localeCompare(right.step_key) || left.item_key.localeCompare(right.item_key))),
        };
      }
      if (/FROM work_order_service_gate_overrides/i.test(normalized)) {
        return {
          results: clone(env.__overrides.filter((item) =>
            item.work_order_id === this.args[0] && !item.revoked_at)),
        };
      }
      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT OR IGNORE INTO work_order_service_standard_progress/i.test(normalized)) {
        const [workOrderId, standardVersion, stepKey, itemKey, isRequired, ownerType] = this.args;
        const existing = env.__progress.find((item) =>
          item.work_order_id === workOrderId
          && item.standard_version === standardVersion
          && item.item_key === itemKey);
        if (!existing) {
          env.__progress.push({
            work_order_id: workOrderId,
            standard_version: standardVersion,
            step_key: stepKey,
            item_key: itemKey,
            state: 'pending',
            is_required: isRequired,
            owner_type: ownerType,
            confirmed_by_type: null,
            confirmed_by_id: null,
            confirmed_at: null,
            evidence_type: null,
            evidence_id: null,
            not_applicable_reason: null,
          });
        } else if (existing.state === 'pending') {
          existing.is_required = isRequired;
          existing.owner_type = ownerType;
        }
        env.__lastChanges = 1;
      } else if (/UPDATE work_order_service_standard_progress SET state = \?/i.test(normalized)) {
        const [
          state, actorType, actorId, evidenceType, evidenceId, reason,
          workOrderId, standardVersion, itemKey,
        ] = this.args;
        const item = env.__progress.find((row) =>
          row.work_order_id === workOrderId
          && row.standard_version === standardVersion
          && row.item_key === itemKey);
        if (item) {
          Object.assign(item, {
            state,
            confirmed_by_type: actorType,
            confirmed_by_id: actorId,
            confirmed_at: '2026-07-29 00:00:00',
            evidence_type: evidenceType,
            evidence_id: evidenceId,
            not_applicable_reason: reason,
          });
          env.__lastChanges = 1;
        }
      } else if (/UPDATE work_order_service_standard_progress SET state = 'pending'/i.test(normalized)) {
        const [workOrderId, standardVersion] = this.args;
        const item = env.__progress.find((row) =>
          row.work_order_id === workOrderId
          && row.standard_version === standardVersion
          && row.item_key === 'risk.ppe_and_access'
          && row.state === 'not_applicable'
          && row.is_required === 0);
        if (item) {
          Object.assign(item, {
            state: 'pending',
            is_required: 1,
            confirmed_by_type: null,
            confirmed_by_id: null,
            confirmed_at: null,
            evidence_type: null,
            evidence_id: null,
            not_applicable_reason: null,
          });
          env.__lastChanges = 1;
        }
      } else if (/INSERT INTO work_order_service_gate_overrides/i.test(normalized)) {
        const [id, workOrderId, gate, reason, overriddenBy] = this.args;
        if (env.__overrides.some((item) =>
          item.work_order_id === workOrderId && item.gate_key === gate && !item.revoked_at)) {
          throw new Error('UNIQUE constraint failed: work_order_service_gate_overrides.work_order_id, work_order_service_gate_overrides.gate_key');
        }
        env.__overrides.push({
          id,
          work_order_id: workOrderId,
          gate_key: gate,
          reason,
          overridden_by: overriddenBy,
          revoked_at: null,
        });
        env.__lastChanges = 1;
      } else if (/UPDATE work_orders SET service_address = \?/i.test(normalized)) {
        const workOrder = env.__workOrders.find((item) => item.id === this.args.at(-1));
        if (workOrder
          && workOrder.service_mode === 'hybrid'
          && workOrder.onsite_conversion_status === 'requested') {
          Object.assign(workOrder, {
            service_address: this.args[0],
            service_latitude: this.args[1],
            service_longitude: this.args[2],
            service_accuracy_m: this.args[3],
            service_coordinate_system: this.args[4],
            service_location_source: this.args[5],
            service_mode: 'onsite',
            arrival_verification_required: 1,
            onsite_conversion_status: 'confirmed',
            onsite_conversion_confirmation_note: this.args[6],
            onsite_conversion_confirmed_by: this.args[7],
          });
          env.__lastChanges = 1;
        }
      } else if (/UPDATE work_orders SET status = 'resolved'/i.test(normalized)) {
        const workOrder = env.__workOrders.find((item) => item.id === this.args[0]);
        if (workOrder && ['in_service', 'pricing'].includes(workOrder.status)) {
          workOrder.status = 'resolved';
          env.__lastChanges = 1;
        } else {
          env.__lastChanges = 0;
        }
      } else if (/SELECT CASE WHEN changes\(\) = 1/i.test(normalized)) {
        if (env.__lastChanges !== 1) throw new Error('onsite conversion concurrent update');
      } else if (/INSERT INTO work_order_logs/i.test(normalized)) {
        env.__logs.push({ args: this.args });
        env.__lastChanges = 1;
      } else if (/INSERT INTO notifications/i.test(normalized)) {
        env.__notifications.push({ args: this.args });
        env.__lastChanges = 1;
      } else if (/INSERT INTO audit_logs/i.test(normalized)) {
        if (env.__nextAuditError) {
          const error = env.__nextAuditError;
          env.__nextAuditError = null;
          throw new Error(error);
        }
        if (env.__failNextAudit) {
          env.__failNextAudit = false;
          throw new Error('audit insert failed');
        }
        if (/service_standard_item_revalidated/i.test(normalized)) {
          const [
            id, actorType, actorId, targetId, beforeState, afterState,
            ip, device, workOrderId, standardVersion,
          ] = this.args;
          const item = env.__progress.find((row) =>
            row.work_order_id === workOrderId
            && row.standard_version === standardVersion
            && row.item_key === 'risk.ppe_and_access'
            && row.state === 'not_applicable'
            && row.is_required === 0);
          if (item) env.__auditLogs.push({
            args: [
              id, actorType, actorId, 'work_order', targetId,
              'service_standard_item_revalidated', beforeState, afterState, ip, device,
            ],
          });
        } else {
          env.__auditLogs.push({ args: this.args });
        }
        env.__lastChanges = 1;
      }
      return { success: true, meta: { changes: env.__lastChanges } };
    },
  };
}

async function api(env, path, {
  body,
  userType = 'engineer',
  userId = 'engineer-1',
  staffId,
  method = 'GET',
  market = 'com',
} = {}) {
  const jwt = await signJwt({
    userId,
    userType,
    staffId,
    market,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const requestOptions = {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: market === 'cn' ? 'https://sagemro.cn' : 'https://sagemro.com',
    },
  };
  if (!['GET', 'HEAD'].includes(method)) requestOptions.body = JSON.stringify(body || {});
  const response = await worker.fetch(
    new Request(`https://api.sagemro.${market}${path}`, requestOptions),
    env,
    { waitUntil() {} },
  );
  return { response, json: await response.json().catch(() => ({})) };
}

test('service-standard snapshot is visible to assigned and management readers but never customers', async () => {
  const env = createEnv();

  const own = await api(env, '/api/workorders/wo-1/service-standard');
  assert.equal(own.response.status, 200);
  assert.equal(own.json.standard_version, 1);
  assert.equal(own.json.items.length, 18);

  const foreign = await api(env, '/api/workorders/wo-1/service-standard', {
    userId: 'engineer-2',
  });
  assert.equal(foreign.response.status, 403);

  const regional = await api(env, '/api/workorders/wo-1/service-standard', {
    userId: 'lead-1',
  });
  assert.equal(regional.response.status, 200);

  const operations = await api(env, '/api/workorders/wo-1/service-standard', {
    userType: 'admin',
    userId: 'operations-1',
    staffId: 'operations-1',
  });
  assert.equal(operations.response.status, 200);

  const customer = await api(env, '/api/workorders/wo-1/service-standard', {
    userType: 'customer',
    userId: 'customer-1',
  });
  assert.equal(customer.response.status, 403);
  assert.equal(customer.json.standard_version, undefined);
  assert.equal(customer.json.items, undefined);
});

test('resolve gate returns deterministic blockers before mutating the work order', async () => {
  const env = createEnv();

  const result = await api(env, '/api/workorders/wo-1/resolve', {
    method: 'POST',
    userType: 'engineer',
    userId: 'engineer-1',
  });

  assert.equal(result.response.status, 409);
  assert.equal(result.json.code, 'service_standard_gate_blocked');
  assert.equal(result.json.gate, 'resolve');
  assert.deepEqual(result.json.blocking_items.slice(0, 3), [
    'task.device_identity',
    'task.problem_and_goal',
    'task.contact_and_window',
  ]);
  assert.equal(env.__workOrders[0].status, 'in_service');
});

test('real SQLite blocked gate is read-only for missing and pending progress rows', async () => {
  const env = createSqliteEnv();
  try {
    env.__sqlite.exec(`
      INSERT INTO work_order_repair_records (
        id, work_order_id, symptom, diagnosis, solution, parts_used, labor_hours
      ) VALUES (
        'repair-read-only', 'wo-1', 'Low output', 'Loose cable',
        'Reseated cable', '[]', 1
      );
      INSERT INTO work_order_service_standard_progress (
        work_order_id, standard_version, step_key, item_key, state,
        is_required, owner_type, updated_at
      ) VALUES (
        'wo-1', 1, 'task_alignment', 'task.device_identity', 'pending',
        1, 'engineer', '2000-01-01 00:00:00'
      );
    `);

    const blocked = await api(env, '/api/workorders/wo-1/resolve', {
      method: 'POST',
      userType: 'engineer',
      userId: 'engineer-1',
    });

    assert.equal(blocked.response.status, 409);
    assert.equal(blocked.json.code, 'service_standard_gate_blocked');
    assert.equal(
      env.__sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM work_order_service_standard_progress
        WHERE work_order_id = 'wo-1'
      `).get().count,
      1,
    );
    assert.equal(
      env.__sqlite.prepare(`
        SELECT updated_at
        FROM work_order_service_standard_progress
        WHERE work_order_id = 'wo-1' AND item_key = 'task.device_identity'
      `).get().updated_at,
      '2000-01-01 00:00:00',
    );
  } finally {
    env.__sqlite.close();
  }
});

test('generic confirmation enforces state validation and item ownership', async () => {
  const env = createEnv();
  await api(env, '/api/workorders/wo-1/service-standard');

  const missingReason = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/risk.ppe_and_access/confirm',
    { method: 'POST', body: { state: 'not_applicable', reason: '' } },
  );
  assert.equal(missingReason.response.status, 400);

  const invalidState = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/risk.ppe_and_access/confirm',
    { method: 'POST', body: { state: 'pending' } },
  );
  assert.equal(invalidState.response.status, 400);

  const confirmed = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/risk.ppe_and_access/confirm',
    {
      method: 'POST',
      body: {
        state: 'not_applicable',
        reason: 'Remote service does not require site PPE.',
        evidence_type: 'engineer_note',
        evidence_id: 'note-1',
      },
    },
  );
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.json.item.state, 'not_applicable');
  assert.equal(confirmed.json.item.evidence_id, 'note-1');
  assert.equal(env.__auditLogs.at(-1).args[5], 'service_standard_item_not_applicable');

  const readAgain = await api(env, '/api/workorders/wo-1/service-standard');
  assert.equal(readAgain.response.status, 200);
  assert.equal(
    readAgain.json.items.find((item) => item.key === 'risk.ppe_and_access').state,
    'not_applicable',
  );

  const foreign = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/task.device_identity/confirm',
    { method: 'POST', userId: 'engineer-2', body: { state: 'confirmed' } },
  );
  assert.equal(foreign.response.status, 403);

  const regionalMutation = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/task.device_identity/confirm',
    { method: 'POST', userId: 'lead-1', body: { state: 'confirmed' } },
  );
  assert.equal(regionalMutation.response.status, 403);

  const adminOwnedByEngineer = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/ready.start_conditions/confirm',
    { method: 'POST', body: { state: 'confirmed' } },
  );
  assert.equal(adminOwnedByEngineer.response.status, 403);

  const adminConfirmation = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/ready.start_conditions/confirm',
    {
      method: 'POST',
      userType: 'admin',
      userId: 'admin',
      body: { state: 'confirmed', evidence_type: 'approval', evidence_id: 'approval-1' },
    },
  );
  assert.equal(adminConfirmation.response.status, 200);
  assert.equal(adminConfirmation.json.item.confirmed_by_type, 'admin');
  assert.equal(env.__auditLogs.at(-1).args[5], 'service_standard_item_confirmed');

  for (const itemKey of ['handover.customer_confirmation', 'handover.service_report']) {
    const rejected = await api(
      env,
      `/api/workorders/wo-1/service-standard/items/${itemKey}/confirm`,
      {
        method: 'POST',
        userType: 'admin',
        userId: 'admin',
        body: { state: 'confirmed' },
      },
    );
    assert.equal(rejected.response.status, 403);
  }

  const operationsMutation = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/ready.start_conditions/confirm',
    {
      method: 'POST',
      userType: 'admin',
      userId: 'operations-1',
      staffId: 'operations-1',
      body: { state: 'confirmed' },
    },
  );
  assert.equal(operationsMutation.response.status, 403);
});

test('confirmation and audit writes are atomic', async () => {
  const env = createEnv();
  await api(env, '/api/workorders/wo-1/service-standard');
  env.__failNextAudit = true;

  const originalError = console.error;
  console.error = () => {};
  let failed;
  try {
    failed = await api(
      env,
      '/api/workorders/wo-1/service-standard/items/task.device_identity/confirm',
      { method: 'POST', body: { state: 'confirmed' } },
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(failed.response.status, 500);
  assert.equal(
    env.__progress.find((item) => item.item_key === 'task.device_identity').state,
    'pending',
  );
  assert.equal(env.__auditLogs.length, 0);
});

test('read-only regional management cannot initialize progress through confirmation', async () => {
  const env = createEnv();

  const denied = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/task.device_identity/confirm',
    { method: 'POST', userId: 'lead-1', body: { state: 'confirmed' } },
  );

  assert.equal(denied.response.status, 403);
  assert.equal(env.__progress.length, 0);
  assert.equal(env.__auditLogs.length, 0);
});

test('Admin identity cannot confirm engineer-owned items even when its user id matches the assignment', async () => {
  const env = createEnv();

  const denied = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/task.device_identity/confirm',
    {
      method: 'POST',
      userType: 'admin',
      userId: 'engineer-1',
      body: { state: 'confirmed' },
    },
  );

  assert.equal(denied.response.status, 403);
  assert.equal(env.__progress.length, 0);
  assert.equal(env.__auditLogs.length, 0);
});

test('onsite conversion atomically revalidates remote PPE without a GET side effect', async () => {
  const env = createEnv();
  await api(env, '/api/workorders/wo-1/service-standard');
  await api(
    env,
    '/api/workorders/wo-1/service-standard/items/risk.ppe_and_access/confirm',
    {
      method: 'POST',
      body: { state: 'not_applicable', reason: 'Remote service does not require site PPE.' },
    },
  );
  env.__workOrders[0].service_mode = 'hybrid';
  env.__workOrders[0].onsite_conversion_status = 'requested';

  const converted = await api(env, '/api/workorders/wo-1/onsite-conversion/confirm', {
    method: 'POST',
    userType: 'customer',
    userId: 'customer-1',
    body: {
      service_address: '88 Test Road, Jinan',
      service_latitude: 36.6512,
      service_longitude: 117.1201,
      service_accuracy_m: 20,
      service_coordinate_system: 'gcj02',
      service_location_source: 'customer_map',
    },
  });

  assert.equal(converted.response.status, 200);
  const ppe = env.__progress.find((item) => item.item_key === 'risk.ppe_and_access');
  assert.equal(ppe.state, 'pending');
  assert.equal(ppe.is_required, 1);
  assert.equal(ppe.confirmed_by_id, null);
  assert.equal(ppe.not_applicable_reason, null);
  assert.equal(
    env.__auditLogs.some((entry) => entry.args[5] === 'service_standard_item_revalidated'),
    true,
  );
});

async function confirmConversion(env) {
  return api(env, '/api/workorders/wo-1/onsite-conversion/confirm', {
    method: 'POST',
    userType: 'customer',
    userId: 'customer-1',
    body: {
      service_address: '88 Test Road, Jinan',
      service_latitude: 36.6512,
      service_longitude: 117.1201,
      service_accuracy_m: 20,
      service_coordinate_system: 'gcj02',
      service_location_source: 'customer_map',
    },
  });
}

test('real SQLite conversion batch couples conditional PPE audit and reset after race-state changes', async () => {
  const becameIneligible = createSqliteEnv();
  const becameEligible = createSqliteEnv();
  const pending = createSqliteEnv();
  try {
    await api(becameIneligible, '/api/workorders/wo-1/service-standard');
    await api(
      becameIneligible,
      '/api/workorders/wo-1/service-standard/items/risk.ppe_and_access/confirm',
      {
        method: 'POST',
        body: {
          state: 'not_applicable',
          reason: 'Remote service does not require site PPE.',
        },
      },
    );
    becameIneligible.__sqlite.prepare(`
      UPDATE work_orders
      SET service_mode = 'hybrid', onsite_conversion_status = 'requested'
      WHERE id = 'wo-1'
    `).run();
    becameIneligible.__conversionBatchHook = (sqlite) => sqlite.prepare(`
      UPDATE work_order_service_standard_progress
      SET state = 'confirmed', confirmed_by_type = 'engineer',
          confirmed_by_id = 'engineer-race', not_applicable_reason = NULL
      WHERE work_order_id = 'wo-1' AND item_key = 'risk.ppe_and_access'
    `).run();

    const skipped = await confirmConversion(becameIneligible);
    assert.equal(skipped.response.status, 200);
    assert.equal(
      becameIneligible.__sqlite.prepare(`
        SELECT state FROM work_order_service_standard_progress
        WHERE work_order_id = 'wo-1' AND item_key = 'risk.ppe_and_access'
      `).get().state,
      'confirmed',
    );
    assert.equal(
      becameIneligible.__sqlite.prepare(`
        SELECT COUNT(*) AS count FROM audit_logs
        WHERE action = 'service_standard_item_revalidated'
      `).get().count,
      0,
    );

    await api(becameEligible, '/api/workorders/wo-1/service-standard');
    await api(
      becameEligible,
      '/api/workorders/wo-1/service-standard/items/risk.ppe_and_access/confirm',
      { method: 'POST', body: { state: 'confirmed' } },
    );
    becameEligible.__sqlite.prepare(`
      UPDATE work_orders
      SET service_mode = 'hybrid', onsite_conversion_status = 'requested'
      WHERE id = 'wo-1'
    `).run();
    becameEligible.__conversionBatchHook = (sqlite) => sqlite.prepare(`
      UPDATE work_order_service_standard_progress
      SET state = 'not_applicable', is_required = 0,
          confirmed_by_type = 'engineer', confirmed_by_id = 'engineer-race',
          not_applicable_reason = 'Concurrent remote-only decision.'
      WHERE work_order_id = 'wo-1' AND item_key = 'risk.ppe_and_access'
    `).run();

    const reset = await confirmConversion(becameEligible);
    assert.equal(reset.response.status, 200);
    assert.deepEqual(
      { ...becameEligible.__sqlite.prepare(`
        SELECT state, is_required, confirmed_by_id, not_applicable_reason
        FROM work_order_service_standard_progress
        WHERE work_order_id = 'wo-1' AND item_key = 'risk.ppe_and_access'
      `).get() },
      {
        state: 'pending',
        is_required: 1,
        confirmed_by_id: null,
        not_applicable_reason: null,
      },
    );
    assert.equal(
      becameEligible.__sqlite.prepare(`
        SELECT COUNT(*) AS count FROM audit_logs
        WHERE action = 'service_standard_item_revalidated'
      `).get().count,
      1,
    );

    await api(pending, '/api/workorders/wo-1/service-standard');
    pending.__sqlite.prepare(`
      UPDATE work_orders
      SET service_mode = 'hybrid', onsite_conversion_status = 'requested'
      WHERE id = 'wo-1'
    `).run();

    const required = await confirmConversion(pending);
    assert.equal(required.response.status, 200);
    assert.deepEqual(
      { ...pending.__sqlite.prepare(`
        SELECT state, is_required
        FROM work_order_service_standard_progress
        WHERE work_order_id = 'wo-1' AND item_key = 'risk.ppe_and_access'
      `).get() },
      { state: 'pending', is_required: 1 },
    );
    assert.equal(
      pending.__sqlite.prepare(`
        SELECT COUNT(*) AS count FROM audit_logs
        WHERE action = 'service_standard_item_revalidated'
      `).get().count,
      0,
    );
  } finally {
    becameIneligible.__sqlite.close();
    becameEligible.__sqlite.close();
    pending.__sqlite.close();
  }
});

test('only full Admin can create an override and duplicate active overrides return localized 409', async () => {
  const env = createEnv();

  const operations = await api(env, '/api/admin/workorders/wo-1/service-standard/override', {
    method: 'POST',
    userType: 'admin',
    userId: 'operations-1',
    staffId: 'operations-1',
    body: { gate: 'start', reason: 'Operational exception.' },
  });
  assert.equal(operations.response.status, 403);

  const missingReason = await api(env, '/api/admin/workorders/wo-1/service-standard/override', {
    method: 'POST',
    userType: 'admin',
    userId: 'admin',
    body: { gate: 'start', reason: '' },
  });
  assert.equal(missingReason.response.status, 400);

  const created = await api(env, '/api/admin/workorders/wo-1/service-standard/override', {
    method: 'POST',
    userType: 'admin',
    userId: 'admin',
    body: { gate: 'start', reason: 'Customer-approved emergency start.' },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.override.gate, 'start');
  assert.equal(env.__auditLogs.at(-1).args[5], 'service_standard_gate_overridden');

  const duplicate = await api(env, '/api/admin/workorders/wo-1/service-standard/override', {
    method: 'POST',
    userType: 'admin',
    userId: 'admin',
    body: { gate: 'start', reason: 'Second exception.' },
  });
  assert.equal(duplicate.response.status, 409);
  assert.doesNotMatch(duplicate.json.error, /sqlite|unique|constraint/i);
  assert.equal(env.__overrides.length, 1);
  assert.equal(
    env.__auditLogs.filter((entry) => entry.args[5] === 'service_standard_gate_overridden').length,
    1,
  );
});

test('service-standard handlers decode valid route segments and reject malformed encodings', async () => {
  const getEnv = createEnv();
  const encodedGet = await api(getEnv, '/api/workorders/wo%2D1/service-standard');
  assert.equal(encodedGet.response.status, 200);

  const confirmEnv = createEnv();
  const encodedConfirm = await api(
    confirmEnv,
    '/api/workorders/wo%2D1/service-standard/items/task%2Edevice_identity/confirm',
    { method: 'POST', body: { state: 'confirmed' } },
  );
  assert.equal(encodedConfirm.response.status, 200);

  const overrideEnv = createEnv();
  const encodedOverride = await api(
    overrideEnv,
    '/api/admin/workorders/wo%2D1/service-standard/override',
    {
      method: 'POST',
      userType: 'admin',
      userId: 'admin',
      body: { gate: 'start', reason: 'Encoded route validation.' },
    },
  );
  assert.equal(encodedOverride.response.status, 201);

  for (const malformed of [
    {
      path: '/api/workorders/%E0%A4%A/service-standard',
      options: {},
    },
    {
      path: '/api/workorders/wo-1/service-standard/items/%E0%A4%A/confirm',
      options: { method: 'POST', body: { state: 'confirmed' } },
    },
    {
      path: '/api/admin/workorders/%E0%A4%A/service-standard/override',
      options: {
        method: 'POST',
        userType: 'admin',
        userId: 'admin',
        body: { gate: 'start', reason: 'Malformed route validation.' },
      },
    },
  ]) {
    const result = await api(createEnv(), malformed.path, malformed.options);
    assert.equal(result.response.status, 400);
    assert.match(result.json.error, /route encoding/i);
    assert.doesNotMatch(result.json.error, /uri|malformed|percent/i);
  }

  const cnMalformed = await api(
    createEnv(),
    '/api/workorders/%E0%A4%A/service-standard',
    { market: 'cn' },
  );
  assert.equal(cnMalformed.response.status, 400);
  assert.equal(cnMalformed.json.error, '路由参数编码无效');
});

test('customer snapshot denial precedes lookup and internal DB errors are redacted from 500 responses', async () => {
  const customerEnv = createEnv();
  customerEnv.__failWorkOrderLookup = true;
  const customer = await api(customerEnv, '/api/workorders/missing/service-standard', {
    userType: 'customer',
    userId: 'customer-1',
  });
  assert.equal(customer.response.status, 403);
  assert.equal(customerEnv.__workOrderLookups, 0);

  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    const getEnv = createEnv();
    getEnv.__failWorkOrderLookup = true;
    const failedGet = await api(getEnv, '/api/workorders/wo-1/service-standard');
    assert.equal(failedGet.response.status, 500);
    assert.doesNotMatch(failedGet.json.error, /SQLITE_SECRET|work_orders|lookup exploded/i);

    const confirmEnv = createEnv();
    await api(confirmEnv, '/api/workorders/wo-1/service-standard');
    confirmEnv.__failNextAudit = true;
    const failedConfirm = await api(
      confirmEnv,
      '/api/workorders/wo-1/service-standard/items/task.device_identity/confirm',
      { method: 'POST', body: { state: 'confirmed' } },
    );
    assert.equal(failedConfirm.response.status, 500);
    assert.doesNotMatch(failedConfirm.json.error, /audit insert failed|sqlite|constraint/i);

    const overrideEnv = createEnv();
    overrideEnv.__nextAuditError = 'UNIQUE constraint failed: audit_logs.id';
    const failedOverride = await api(
      overrideEnv,
      '/api/admin/workorders/wo-1/service-standard/override',
      {
        method: 'POST',
        userType: 'admin',
        userId: 'admin',
        body: { gate: 'resolve', reason: 'Audit failure test.' },
      },
    );
    assert.equal(failedOverride.response.status, 500);
    assert.doesNotMatch(failedOverride.json.error, /audit_logs|unique|sqlite|constraint/i);
    assert.equal(overrideEnv.__overrides.length, 0);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.some((entry) => entry.includes('SQLITE_SECRET')), true);
  assert.equal(logged.some((entry) => entry.includes('audit insert failed')), true);
});
