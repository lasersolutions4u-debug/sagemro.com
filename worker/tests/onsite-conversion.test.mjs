import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createEnv() {
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    __workOrders: [{
      id: 'wo-remote-1',
      order_no: 'WO-REMOTE-1',
      customer_id: 'customer-1',
      engineer_id: 'engineer-1',
      status: 'in_service',
      service_mode: 'remote',
      arrival_verification_required: 0,
      onsite_conversion_status: 'not_requested',
    }],
    __arrivalChecks: [{
      id: 'check-1',
      work_order_id: 'wo-remote-1',
      engineer_id: 'engineer-1',
      distance_m: 820,
      radius_m: 150,
      within_geofence: 0,
      failure_reason: 'outside_geofence',
      created_at: '2026-07-15T08:00:00.000Z',
    }],
    __logs: [],
    __auditLogs: [],
    __notifications: [],
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
      if (/FROM work_orders w LEFT JOIN engineers e/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { ...order, engineer_name: 'Test Engineer', customer_name: 'Test Customer' } : null;
      }
      if (/FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { ...order } : null;
      }
      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);
      if (/FROM work_order_arrival_checks WHERE work_order_id = \?/i.test(normalized)) {
        return {
          results: env.__arrivalChecks
            .filter((item) => item.work_order_id === this.args[0])
            .slice(0, 20),
        };
      }
      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);
      const order = env.__workOrders.find((item) => item.id === this.args.at(-1));

      if (/UPDATE work_orders SET service_mode = 'hybrid'/i.test(normalized) && order) {
        order.service_mode = 'hybrid';
        order.onsite_conversion_status = 'requested';
        order.onsite_conversion_request_note = this.args[0];
        order.onsite_conversion_requested_by = this.args[1];
      }
      if (/UPDATE work_orders SET service_address = \?/i.test(normalized) && order) {
        order.service_address = this.args[0];
        order.service_latitude = this.args[1];
        order.service_longitude = this.args[2];
        order.service_accuracy_m = this.args[3];
        order.service_coordinate_system = this.args[4];
        order.service_location_source = this.args[5];
        order.service_mode = 'onsite';
        order.arrival_verification_required = 1;
        order.onsite_conversion_status = 'confirmed';
        order.onsite_conversion_confirmation_note = this.args[6];
        order.onsite_conversion_confirmed_by = this.args[7];
      }
      if (/UPDATE work_orders SET arrival_verified_at = datetime\('now'\)/i.test(normalized) && order) {
        order.arrival_verified_at = 'now';
        order.arrival_override_reason = this.args[0];
        order.arrival_override_by = this.args[1];
      }
      if (/INSERT INTO work_order_logs/i.test(normalized)) env.__logs.push({ args: this.args });
      if (/INSERT INTO audit_logs/i.test(normalized)) env.__auditLogs.push({ args: this.args });
      if (/INSERT INTO notifications/i.test(normalized)) env.__notifications.push({ args: this.args });
      return { success: true, meta: { changes: 1 } };
    },
  };
}

async function api(env, path, { body, userType, userId, method = 'POST' }) {
  const jwt = await signJwt({
    userId,
    userType,
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
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, requestOptions), env, { waitUntil() {} });
  return { response, json: await response.json().catch(() => ({})) };
}

test('assigned engineer can request converting a remote work order to onsite service', async () => {
  const env = createEnv();
  const { response, json } = await api(env, '/api/workorders/wo-remote-1/onsite-conversion/request', {
    userType: 'engineer',
    userId: 'engineer-1',
    body: { note: 'Remote guidance confirmed that a technician visit is required.' },
  });

  assert.equal(response.status, 200);
  assert.equal(json.onsite_conversion_status, 'requested');
  assert.equal(env.__workOrders[0].service_mode, 'hybrid');
  assert.equal(env.__notifications.length, 1);
  assert.equal(env.__notifications[0].args[1], 'customer-1');
});

test('customer confirms the onsite address before arrival verification becomes required', async () => {
  const env = createEnv();
  env.__workOrders[0].service_mode = 'hybrid';
  env.__workOrders[0].onsite_conversion_status = 'requested';

  const { response, json } = await api(env, '/api/workorders/wo-remote-1/onsite-conversion/confirm', {
    userType: 'customer',
    userId: 'customer-1',
    body: {
      service_address: '88 Test Road, Jinan',
      service_latitude: 36.6512,
      service_longitude: 117.1201,
      service_accuracy_m: 20,
      service_coordinate_system: 'gcj02',
      service_location_source: 'customer_map',
      note: 'Use the east factory entrance.',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(json.service_mode, 'onsite');
  assert.equal(json.arrival_verification_required, true);
  assert.equal(env.__workOrders[0].onsite_conversion_status, 'confirmed');
  assert.equal(env.__notifications.length, 1);
  assert.equal(env.__notifications[0].args[1], 'engineer-1');
});

test('admin arrival override requires a reason and preserves an audit trail', async () => {
  const env = createEnv();
  env.__workOrders[0].service_mode = 'onsite';
  env.__workOrders[0].arrival_verification_required = 1;

  const missingReason = await api(env, '/api/admin/workorders/wo-remote-1/arrival-override', {
    userType: 'admin',
    userId: 'admin-1',
    body: {},
  });
  assert.equal(missingReason.response.status, 400);

  const approved = await api(env, '/api/admin/workorders/wo-remote-1/arrival-override', {
    userType: 'admin',
    userId: 'admin-1',
    body: { reason: 'Customer confirmed the engineer is onsite; browser GPS is unavailable.' },
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.json.arrival_verified, true);
  assert.equal(env.__auditLogs.length, 1);
});

test('admin can confirm the onsite location on behalf of the customer with a reason', async () => {
  const env = createEnv();
  env.__workOrders[0].service_mode = 'hybrid';
  env.__workOrders[0].onsite_conversion_status = 'requested';

  const { response, json } = await api(env, '/api/admin/workorders/wo-remote-1/onsite-conversion/confirm', {
    userType: 'admin',
    userId: 'admin-1',
    body: {
      service_address: '88 Test Road, Jinan',
      service_latitude: 36.6512,
      service_longitude: 117.1201,
      service_accuracy_m: 20,
      service_coordinate_system: 'gcj02',
      service_location_source: 'admin_customer_confirmation',
      note: 'Customer confirmed by phone.',
      reason: 'Customer cannot access the map confirmation screen.',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(json.service_mode, 'onsite');
  assert.equal(env.__auditLogs.length, 1);
});

test('engineer work order detail includes recent arrival check attempts', async () => {
  const env = createEnv();
  const { response, json } = await api(env, '/api/workorders/wo-remote-1', {
    method: 'GET',
    userType: 'engineer',
    userId: 'engineer-1',
  });

  assert.equal(response.status, 200);
  assert.equal(json.arrival_checks.length, 1);
  assert.equal(json.arrival_checks[0].failure_reason, 'outside_geofence');
});
