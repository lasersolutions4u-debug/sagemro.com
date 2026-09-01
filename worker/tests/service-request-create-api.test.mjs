import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

const JWT_SECRET = 'service-request-create-api-test-secret';
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const pre047SchemaSql = schemaSql
  .replace(/\n    -- 047 \u7ed3\u6784\u5316\u670d\u52a1\u8bf7\u6c42\u5165\u53e3[\s\S]*?\n    FOREIGN KEY \(customer_id\)/, '\n    FOREIGN KEY (customer_id)')
  .replace(/\n    \('047_structured_service_request_intake'[^\n]*/, '');

function createD1Database(t, { migrated = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(migrated ? schemaSql : pre047SchemaSql);
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

function createEnv(t, options) {
  const DB = createD1Database(t, options);
  DB.__sqlite.exec(`
    INSERT INTO customers (id, user_no, name, phone, email, password_hash) VALUES
      ('customer-1', 'U000001', 'Customer One', '+15550000001', 'owner@example.com', 'hash'),
      ('customer-2', 'U000002', 'Customer Two', '+15550000002', 'other@example.com', 'hash');
    INSERT INTO engineers (
      id, user_no, name, phone, email, password_hash, engineer_role, regional_lead_id, status
    ) VALUES
      ('engineer-1', 'E000001', 'Engineer One', '+15550000011', 'engineer@example.com', 'hash', 'engineer', NULL, 'available'),
      ('lead-1', 'E000002', 'Regional Lead', '+15550000012', 'lead@example.com', 'hash', 'regional_lead', NULL, 'available');
  `);
  const pending = [];
  t.after(async () => Promise.all(pending.splice(0)));
  return {
    JWT_SECRET,
    DB,
    KV: { async get() { return null; }, async put() {}, async delete() {} },
    __pending: pending,
  };
}

async function tokenFor(userId, userType = 'customer', extra = {}) {
  return signJwt({
    userId,
    userType,
    market: 'com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...extra,
  }, JWT_SECRET);
}

async function api(env, path, {
  method = 'GET',
  body,
  userId = 'customer-1',
  userType = 'customer',
  cookie,
  csrf,
} = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: userType === 'admin'
      ? 'https://admin.sagemro.com'
      : userType === 'engineer'
      ? 'https://engineer.sagemro.com'
      : 'https://sagemro.com',
  };
  if (cookie) {
    headers.Cookie = cookie;
    if (csrf) headers['X-CSRF-Token'] = csrf;
  } else {
    headers.Authorization = `Bearer ${await tokenFor(userId, userType)}`;
  }
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil(promise) { env.__pending.push(promise); } });
  return { response, json: await response.json() };
}

const fullIntake = Object.freeze({
  service_request_kind: 'repair',
  device_types: ['fiber_laser_cutting_machine'],
  device_brands: ['TRUMPF', 'IPG Photonics'],
  device_model: 'TruLaser 3030',
  region: ['United States', 'Illinois', 'Chicago'],
  alarm_code: 'E204',
  production_impact: 'The cutting line is stopped.',
  contact: {
    name: 'Alex Example',
    email: 'alex@example.com',
    phone: '+1 312 555 0101',
    whatsapp: '+1 312 555 0102',
    preference: 'whatsapp',
  },
});

const basePayload = Object.freeze({
  idempotency_key: 'service-request-test-0001',
  customer_id: 'customer-2',
  type: 'fault',
  description: 'The cutting head stops after homing and displays alarm E204.',
  urgency: 'normal',
  category_l1: 'laser_cutting',
  category_l2: 'motion_control',
  service_mode: 'hybrid',
  intake: fullIntake,
});

const storageFields = Object.freeze([
  'service_request_version',
  'service_request_kind',
  'device_types_json',
  'device_brands_json',
  'device_model',
  'region_json',
  'alarm_code',
  'production_impact',
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_whatsapp',
  'contact_preference',
]);

test('customer creation normalizes and stores intake on the existing work order', async (t) => {
  const env = createEnv(t);
  const created = await api(env, '/api/workorders', { method: 'POST', body: basePayload });

  assert.equal(created.response.status, 200);
  assert.deepEqual(created.json.work_order.service_request, fullIntake);

  const row = env.DB.__sqlite.prepare(`
    SELECT customer_id, type, description, urgency, category_l1, category_l2, service_mode,
           service_request_version, service_request_kind, device_types_json,
           device_brands_json, device_model, region_json, alarm_code, production_impact,
           contact_name, contact_email, contact_phone, contact_whatsapp, contact_preference
    FROM work_orders WHERE id = ?
  `).get(created.json.work_order.id);
  assert.deepEqual({ ...row }, {
    customer_id: 'customer-1',
    type: 'fault',
    description: basePayload.description,
    urgency: 'normal',
    category_l1: 'laser_cutting',
    category_l2: 'motion_control',
    service_mode: 'hybrid',
    service_request_version: 2,
    service_request_kind: 'repair',
    device_types_json: '["fiber_laser_cutting_machine"]',
    device_brands_json: '["TRUMPF","IPG Photonics"]',
    device_model: 'TruLaser 3030',
    region_json: '["United States","Illinois","Chicago"]',
    alarm_code: 'E204',
    production_impact: 'The cutting line is stopped.',
    contact_name: 'Alex Example',
    contact_email: 'alex@example.com',
    contact_phone: '+1 312 555 0101',
    contact_whatsapp: '+1 312 555 0102',
    contact_preference: 'whatsapp',
  });
});

test('structured creation replays the same work order for one idempotency key', async (t) => {
  const env = createEnv(t);
  const first = await api(env, '/api/workorders', { method: 'POST', body: basePayload });
  const replay = await api(env, '/api/workorders', { method: 'POST', body: basePayload });

  assert.equal(first.response.status, 200);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.json.idempotent, true);
  assert.equal(replay.json.work_order.id, first.json.work_order.id);
  assert.equal(
    env.DB.__sqlite.prepare('SELECT COUNT(*) AS count FROM work_orders').get().count,
    1,
  );
});

test('retry recovers the original work order after a post-insert failure', async (t) => {
  const env = createEnv(t);
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let failLogOnce = true;
  env.DB.prepare = (sql) => {
    if (failLogOnce && /INSERT INTO work_order_logs/i.test(sql)) {
      failLogOnce = false;
      return {
        bind() { return this; },
        async run() { throw new Error('simulated post-insert failure'); },
      };
    }
    return originalPrepare(sql);
  };

  const first = await api(env, '/api/workorders', { method: 'POST', body: basePayload });
  assert.equal(first.response.status, 500);

  const retry = await api(env, '/api/workorders', { method: 'POST', body: basePayload });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.json.idempotent, true);
  assert.equal(
    env.DB.__sqlite.prepare('SELECT COUNT(*) AS count FROM work_orders').get().count,
    1,
  );
});

test('legacy creation remains compatible and uses migration defaults', async (t) => {
  const env = createEnv(t);
  const created = await api(env, '/api/workorders', {
    method: 'POST',
    body: {
      type: 'maintenance',
      description: 'Annual preventive inspection request.',
      urgency: 'normal',
    },
  });

  assert.equal(created.response.status, 200);
  assert.equal(Object.hasOwn(created.json.work_order, 'service_request'), false);
  const row = env.DB.__sqlite.prepare(`
    SELECT service_request_version, service_request_kind, device_types_json,
           device_brands_json, region_json, contact_email
    FROM work_orders WHERE id = ?
  `).get(created.json.work_order.id);
  assert.deepEqual({ ...row }, {
    service_request_version: 1,
    service_request_kind: null,
    device_types_json: '[]',
    device_brands_json: '[]',
    region_json: '[]',
    contact_email: null,
  });
});

test('legacy creation still succeeds before migration 047', async (t) => {
  const env = createEnv(t, { migrated: false });
  const created = await api(env, '/api/workorders', {
    method: 'POST',
    body: {
      type: 'maintenance',
      description: 'Legacy maintenance request before the intake migration.',
      urgency: 'normal',
    },
  });

  assert.equal(created.response.status, 200);
  assert.equal(env.DB.__sqlite.prepare(
    'SELECT description FROM work_orders WHERE id = ?',
  ).get(created.json.work_order.id).description, 'Legacy maintenance request before the intake migration.');
});

test('intake creation before migration returns a stable error without database details', async (t) => {
  const env = createEnv(t, { migrated: false });
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args.map(String).join(' '));
  let result;
  try {
    result = await api(env, '/api/workorders', { method: 'POST', body: basePayload });
  } finally {
    console.error = originalError;
  }

  assert.equal(result.response.status, 500);
  assert.equal(result.json.error, 'Unable to create service request. Please try again later.');
  const clientText = JSON.stringify(result.json);
  assert.doesNotMatch(clientText, /work_orders|device_model|sqlite|sql|column/i);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /service request persistence failed/i);
  assert.doesNotMatch(logs[0], /E204|alex@example\.com|312 555|TruLaser/);
});

test('structured intake validation returns stable 400 responses', async (t) => {
  const cases = [
    {
      name: 'malformed arrays',
      body: { ...basePayload, intake: { ...fullIntake, device_types: 'laser' } },
      error: /device_types.*数组/,
    },
    {
      name: 'invalid service mode',
      body: { ...basePayload, service_mode: 'teleport' },
      error: /service_mode/i,
    },
    {
      name: 'kind and type mismatch',
      body: { ...basePayload, type: 'maintenance' },
      error: /service_request_kind.*type|type.*service_request_kind/i,
    },
    {
      name: 'missing type',
      body: { ...basePayload, type: '' },
      error: /Missing required fields/i,
    },
    {
      name: 'missing description',
      body: { ...basePayload, description: '' },
      error: /Missing required fields/i,
    },
  ];

  for (const item of cases) {
    const env = createEnv(t);
    const result = await api(env, '/api/workorders', { method: 'POST', body: item.body });
    assert.equal(result.response.status, 400, item.name);
    assert.match(result.json.error, item.error, item.name);
  }
});

test('cookie creation keeps the existing CSRF requirement', async (t) => {
  const env = createEnv(t);
  const csrf = 'service-request-csrf-token';
  const token = await tokenFor('customer-1', 'customer', { csrf });
  const cookie = `__Host-sagemro_customer_session=${token}`;

  const rejected = await api(env, '/api/workorders', {
    method: 'POST', body: basePayload, cookie,
  });
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.json.error, 'Invalid CSRF token');

  const accepted = await api(env, '/api/workorders', {
    method: 'POST', body: basePayload, cookie, csrf,
  });
  assert.equal(accepted.response.status, 200);
});

test('contact intake follows work-order ownership and the existing release threshold', async (t) => {
  const env = createEnv(t);
  const created = await api(env, '/api/workorders', { method: 'POST', body: basePayload });
  const workOrderId = created.json.work_order.id;

  const ownerDetail = await api(env, `/api/workorders/${workOrderId}`);
  assert.equal(ownerDetail.response.status, 200);
  assert.deepEqual(ownerDetail.json.service_request.contact, fullIntake.contact);

  const adminDetail = await api(env, `/api/workorders/${workOrderId}`, {
    userId: 'admin', userType: 'admin',
  });
  assert.equal(adminDetail.response.status, 200);
  assert.deepEqual(adminDetail.json.service_request.contact, fullIntake.contact);

  const otherCustomer = await api(env, `/api/workorders/${workOrderId}`, {
    userId: 'customer-2', userType: 'customer',
  });
  assert.equal(otherCustomer.response.status, 403);

  env.DB.__sqlite.prepare(`
    UPDATE work_orders SET engineer_id = 'engineer-1', status = 'assigned' WHERE id = ?
  `).run(workOrderId);
  const assignedDetail = await api(env, `/api/workorders/${workOrderId}`, {
    userId: 'engineer-1', userType: 'engineer',
  });
  assert.equal(assignedDetail.response.status, 200);
  assert.deepEqual(assignedDetail.json.service_request.contact, {
    name: '', email: '', phone: '', whatsapp: '', preference: '',
  });
  for (const rawField of [
    'contact_name', 'contact_email', 'contact_phone', 'contact_whatsapp', 'contact_preference',
  ]) {
    assert.equal(Object.hasOwn(assignedDetail.json, rawField), false, rawField);
  }

  const assignedList = await api(env, '/api/engineers/tickets?scope=personal', {
    userId: 'engineer-1', userType: 'engineer',
  });
  assert.equal(assignedList.response.status, 200);
  const serializedList = JSON.stringify(assignedList.json);
  assert.doesNotMatch(serializedList, /alex@example\.com|312 555 0101|312 555 0102/);
  for (const field of storageFields) {
    assert.equal(Object.hasOwn(assignedList.json.work_orders[0], field), false, field);
  }

  env.DB.__sqlite.prepare(`
    UPDATE work_orders SET status = 'in_service' WHERE id = ?
  `).run(workOrderId);
  const inServiceDetail = await api(env, `/api/workorders/${workOrderId}`, {
    userId: 'engineer-1', userType: 'engineer',
  });
  assert.equal(inServiceDetail.response.status, 200);
  assert.deepEqual(inServiceDetail.json.service_request.contact, fullIntake.contact);
});

test('assigned engineer cannot read international contact details embedded in the description', async (t) => {
  const env = createEnv(t);
  const description = 'Call 415 555 0123 or WhatsApp (312) 555-0199; email field.tech@example.com.';
  const created = await api(env, '/api/workorders', {
    method: 'POST',
    body: { ...basePayload, description },
  });
  const workOrderId = created.json.work_order.id;

  const ownerDetail = await api(env, `/api/workorders/${workOrderId}`);
  assert.equal(ownerDetail.json.description, description);

  env.DB.__sqlite.prepare(`
    UPDATE work_orders SET engineer_id = 'engineer-1', status = 'assigned' WHERE id = ?
  `).run(workOrderId);
  const assignedDetail = await api(env, `/api/workorders/${workOrderId}`, {
    userId: 'engineer-1', userType: 'engineer',
  });
  assert.equal(assignedDetail.response.status, 200);
  assert.equal(assignedDetail.json.description, 'Call XXX or WhatsApp XXX; email XXX.');
});

test('list responses hide storage columns while detail separates registered and requested models', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.exec(`
    INSERT INTO devices (id, customer_id, type, brand, model)
    VALUES ('device-1', 'customer-1', 'laser', 'Registered Brand', 'Registered Model 9000');
  `);
  const created = await api(env, '/api/workorders', {
    method: 'POST',
    body: { ...basePayload, device_id: 'device-1' },
  });
  assert.equal(created.response.status, 200);

  const list = await api(env, '/api/workorders');
  assert.equal(list.response.status, 200);
  assert.equal(list.json.work_orders.length, 1);
  for (const field of storageFields) {
    assert.equal(Object.hasOwn(list.json.work_orders[0], field), false, field);
  }

  const detail = await api(env, `/api/workorders/${created.json.work_order.id}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.device_model, 'Registered Model 9000');
  assert.equal(detail.json.service_request.device_model, 'TruLaser 3030');
  for (const field of storageFields.filter((field) => field !== 'device_model')) {
    assert.equal(Object.hasOwn(detail.json, field), false, field);
  }
});

test('regional queue detail never exposes structured contact fields', async (t) => {
  const env = createEnv(t);
  const created = await api(env, '/api/workorders', { method: 'POST', body: basePayload });
  const workOrderId = created.json.work_order.id;
  env.DB.__sqlite.prepare(`
    UPDATE work_orders
    SET engineer_id = NULL, assigned_regional_lead_id = 'lead-1', status = 'pending_dispatch'
    WHERE id = ?
  `).run(workOrderId);

  const detail = await api(env, `/api/workorders/${workOrderId}`, {
    userId: 'lead-1', userType: 'engineer',
  });
  assert.equal(detail.response.status, 200);
  assert.equal(Object.hasOwn(detail.json, 'service_request'), false);
  assert.doesNotMatch(JSON.stringify(detail.json), /alex@example\.com|312 555 0101|312 555 0102/);
});
