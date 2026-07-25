import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const JWT_SECRET = 'engineer-workspace-access-test-secret';
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

function insertEngineer(sqlite, {
  id,
  userNo,
  name,
  phone,
  role = 'engineer',
  regionalLeadId = null,
}) {
  sqlite.prepare(`
    INSERT INTO engineers (
      id, user_no, name, phone, password_hash, engineer_role, regional_lead_id
    ) VALUES (?, ?, ?, ?, 'hash', ?, ?)
  `).run(id, userNo, name, phone, role, regionalLeadId);
}

function insertWorkOrder(sqlite, {
  id,
  orderNo,
  engineerId = null,
  regionalLeadId = null,
  createdAt,
}) {
  sqlite.prepare(`
    INSERT INTO work_orders (
      id, order_no, customer_id, engineer_id, type, description, status,
      assigned_regional_lead_id, created_at
    ) VALUES (?, ?, 'customer-1', ?, 'maintenance', ?, 'assigned', ?, ?)
  `).run(id, orderNo, engineerId, `${orderNo} service task`, regionalLeadId, createdAt);
}

function createEnv(t) {
  const DB = createD1Database(t);
  const sqlite = DB.__sqlite;
  sqlite.prepare(`
    INSERT INTO customers (id, user_no, name, phone, password_hash)
    VALUES ('customer-1', 'U000001', 'Customer One', '+15550000001', 'hash')
  `).run();
  insertEngineer(sqlite, {
    id: 'lead-1', userNo: 'E000001', name: 'Regional Lead', phone: '+15550000011', role: 'regional_lead',
  });
  insertEngineer(sqlite, {
    id: 'eng-1', userNo: 'E000002', name: 'Amy Engineer', phone: '+15550000012', regionalLeadId: 'lead-1',
  });
  insertEngineer(sqlite, {
    id: 'lead-2', userNo: 'E000003', name: 'Other Lead', phone: '+15550000013', role: 'regional_lead',
  });
  insertEngineer(sqlite, {
    id: 'eng-2', userNo: 'E000004', name: 'Outside Engineer', phone: '+15550000014', regionalLeadId: 'lead-2',
  });
  insertWorkOrder(sqlite, {
    id: 'wo-queue', orderNo: 'WO-QUEUE', regionalLeadId: 'lead-1', createdAt: '2026-07-25 12:00:00',
  });
  insertWorkOrder(sqlite, {
    id: 'wo-lead', orderNo: 'WO-LEAD', engineerId: 'lead-1', regionalLeadId: 'lead-1', createdAt: '2026-07-25 11:00:00',
  });
  insertWorkOrder(sqlite, {
    id: 'wo-member', orderNo: 'WO-MEMBER', engineerId: 'eng-1', createdAt: '2026-07-25 10:00:00',
  });
  insertWorkOrder(sqlite, {
    id: 'wo-outsider', orderNo: 'WO-OUTSIDER', engineerId: 'eng-2', regionalLeadId: 'lead-2', createdAt: '2026-07-25 09:00:00',
  });

  return {
    JWT_SECRET,
    DB,
    KV: { async get() { return null; }, async put() {} },
  };
}

async function tokenFor(userId) {
  return signJwt({
    userId,
    userType: 'engineer',
    market: 'com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
}

async function api(env, path, { method = 'GET', body, userId = 'lead-1', idempotencyKey } = {}) {
  const token = await tokenFor(userId);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: 'https://engineer.sagemro.com',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('engineer ticket scopes use authenticated identity and include direct regional team work', async (t) => {
  const env = createEnv(t);

  const personal = await api(env, '/api/engineers/tickets?scope=personal');
  assert.equal(personal.response.status, 200);
  assert.equal(personal.json.scope, 'personal');
  assert.deepEqual(personal.json.work_orders.map((row) => row.id), ['wo-lead']);
  assert.equal(personal.json.work_orders[0].ownership_relation, 'personal');

  const team = await api(env, '/api/engineers/tickets?scope=team');
  assert.equal(team.response.status, 200);
  assert.equal(team.json.scope, 'team');
  assert.deepEqual(
    team.json.work_orders.map((row) => [row.id, row.ownership_relation]),
    [
      ['wo-queue', 'regional_queue'],
      ['wo-lead', 'personal'],
      ['wo-member', 'current_team_member'],
    ],
  );
  assert.deepEqual(team.json.team.map((row) => row.id), ['eng-1']);
  assert.equal(team.json.work_orders.some((row) => row.id === 'wo-outsider'), false);

  const ordinaryEngineerTeam = await api(env, '/api/engineers/tickets?scope=team', { userId: 'eng-1' });
  assert.equal(ordinaryEngineerTeam.response.status, 403);

  const spoofedIdentity = await api(env, '/api/engineers/tickets?scope=personal&engineer_id=eng-2');
  assert.deepEqual(spoofedIdentity.json.work_orders.map((row) => row.id), ['wo-lead']);
});

test('regional lead can read a direct subordinate work order but cannot send messages as a participant', async (t) => {
  const env = createEnv(t);

  const detail = await api(env, '/api/workorders/wo-member');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.id, 'wo-member');
  assert.deepEqual(detail.json.field_days, []);

  const messages = await api(env, '/api/workorders/wo-member/messages');
  assert.equal(messages.response.status, 200);

  const pricing = await api(env, '/api/workorders/wo-member/pricing');
  assert.equal(pricing.response.status, 200);

  const materialItems = await api(env, '/api/workorders/wo-member/material-items');
  assert.equal(materialItems.response.status, 200);

  const repairRecord = await api(env, '/api/workorders/wo-member/repair-record');
  assert.equal(repairRecord.response.status, 200);

  const unrelated = await api(env, '/api/workorders/wo-member', { userId: 'lead-2' });
  assert.equal(unrelated.response.status, 403);

  const postMessage = await api(env, '/api/workorders/wo-member/messages', {
    method: 'POST',
    body: { content: 'Management note' },
  });
  assert.equal(postMessage.response.status, 403);

  const submitQuote = await api(env, '/api/workorders/wo-member/pricing', {
    method: 'POST',
    body: { labor_fee: 1000, parts_fee: 0, travel_fee: 0, other_fee: 0 },
  });
  assert.equal(submitQuote.response.status, 403);

  const saveReport = await api(env, '/api/workorders/wo-member/repair-record', {
    method: 'POST',
    body: { symptom: 'Observed', diagnosis: 'Diagnosis', solution: 'Solution' },
  });
  assert.equal(saveReport.response.status, 403);
});

test('personal calendar events can be updated and deleted but work-order events are protected', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.exec(`
    INSERT INTO engineer_calendar_events (
      id, engineer_id, event_type, title, start_at, end_at, work_order_id
    ) VALUES
      ('event-personal', 'lead-1', 'engineer_available', 'Available', '2026-07-26T09:00:00Z', '2026-07-26T17:00:00Z', NULL),
      ('event-work-order', 'lead-1', 'reserved_for_service', 'WO-MEMBER', '2026-07-27T09:00:00Z', '2026-07-27T17:00:00Z', 'wo-member'),
      ('event-other', 'eng-1', 'engineer_unavailable', 'Blocked', '2026-07-28T09:00:00Z', '2026-07-28T17:00:00Z', NULL);
  `);

  const updated = await api(env, '/api/engineers/calendar-events/event-personal', {
    method: 'PATCH',
    body: {
      event_type: 'engineer_unavailable',
      title: 'Personal appointment',
      start_at: '2026-07-26T10:00:00Z',
      end_at: '2026-07-26T12:00:00Z',
      timezone: 'America/Chicago',
      region: 'Texas',
      notes: 'Unavailable',
    },
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.event.title, 'Personal appointment');

  const updateOther = await api(env, '/api/engineers/calendar-events/event-other', {
    method: 'PATCH',
    body: {
      event_type: 'engineer_available', title: 'Spoofed',
      start_at: '2026-07-28T10:00:00Z', end_at: '2026-07-28T12:00:00Z',
    },
  });
  assert.equal(updateOther.response.status, 404);

  const updateScheduled = await api(env, '/api/engineers/calendar-events/event-work-order', {
    method: 'PATCH',
    body: {
      event_type: 'reserved_for_service', title: 'Changed schedule',
      start_at: '2026-07-27T10:00:00Z', end_at: '2026-07-27T12:00:00Z',
    },
  });
  assert.equal(updateScheduled.response.status, 409);

  const deleteScheduled = await api(env, '/api/engineers/calendar-events/event-work-order', { method: 'DELETE' });
  assert.equal(deleteScheduled.response.status, 409);

  const deletePersonal = await api(env, '/api/engineers/calendar-events/event-personal', { method: 'DELETE' });
  assert.equal(deletePersonal.response.status, 200);
});

test('regional lead has read-only access to subordinate material requisitions', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.exec(`
    INSERT INTO material_requisitions (
      id, requisition_no, work_order_id, requested_by_type, requested_by_id,
      status, urgency, purpose
    ) VALUES (
      'mr-member', 'MR-20260725-MEMBER', 'wo-member', 'engineer', 'eng-1',
      'submitted', 'normal', 'Replacement sensor'
    );
    INSERT INTO material_requisition_items (
      id, requisition_id, name, unit, requested_quantity
    ) VALUES ('mri-member', 'mr-member', 'Sensor', 'pcs', 1);
  `);

  const list = await api(env, '/api/material-requisitions?work_order_id=wo-member');
  assert.equal(list.response.status, 200);
  assert.deepEqual(list.json.requisitions.map((row) => row.id), ['mr-member']);

  const detail = await api(env, '/api/material-requisitions/mr-member');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.requisition.id, 'mr-member');

  const create = await api(env, '/api/material-requisitions', {
    method: 'POST',
    idempotencyKey: 'lead-material-create',
    body: {
      work_order_id: 'wo-member',
      items: [{ name: 'Sensor', requested_quantity: 1 }],
    },
  });
  assert.equal(create.response.status, 403);

  const submit = await api(env, '/api/material-requisitions/mr-member/submit', { method: 'POST' });
  assert.equal(submit.response.status, 403);
});
