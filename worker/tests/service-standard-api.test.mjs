import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

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
    __lastChanges: 0,
    __failNextAudit: false,
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
      } else if (/SELECT CASE WHEN changes\(\) = 1/i.test(normalized)) {
        if (env.__lastChanges !== 1) throw new Error('onsite conversion concurrent update');
      } else if (/INSERT INTO work_order_logs/i.test(normalized)) {
        env.__logs.push({ args: this.args });
        env.__lastChanges = 1;
      } else if (/INSERT INTO notifications/i.test(normalized)) {
        env.__notifications.push({ args: this.args });
        env.__lastChanges = 1;
      } else if (/INSERT INTO audit_logs/i.test(normalized)) {
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
  const requestOptions = {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
    },
  };
  if (!['GET', 'HEAD'].includes(method)) requestOptions.body = JSON.stringify(body || {});
  const response = await worker.fetch(
    new Request(`https://api.sagemro.com${path}`, requestOptions),
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

  const failed = await api(
    env,
    '/api/workorders/wo-1/service-standard/items/task.device_identity/confirm',
    { method: 'POST', body: { state: 'confirmed' } },
  );

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
