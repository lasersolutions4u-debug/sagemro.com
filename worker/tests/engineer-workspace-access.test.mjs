import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const JWT_SECRET = 'engineer-workspace-access-test-secret';
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

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
  shortTitle = null,
  createdAt,
}) {
  sqlite.prepare(`
    INSERT INTO work_orders (
      id, order_no, customer_id, engineer_id, type, description, status,
      assigned_regional_lead_id, short_title, created_at
    ) VALUES (?, ?, 'customer-1', ?, 'maintenance', ?, 'assigned', ?, ?, ?)
  `).run(id, orderNo, engineerId, `${orderNo} service task`, regionalLeadId, shortTitle, createdAt);
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
    id: 'wo-member', orderNo: 'WO-MEMBER', engineerId: 'eng-1',
    shortTitle: "Han's Laser 3015 on-site repair", createdAt: '2026-07-25 10:00:00',
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
  env.DB.__sqlite.exec(`
    UPDATE work_orders
    SET expected_completion_date = '2026-07-28', assigned_at = '2026-07-25 08:00:00'
    WHERE id = 'wo-member';
    INSERT INTO engineer_calendar_events (
      id, engineer_id, event_type, title, start_at, end_at, work_order_id
    ) VALUES (
      'event-team-schedule', 'eng-1', 'reserved_for_service', 'WO-MEMBER',
      '2026-07-27T09:00:00Z', '2026-07-27T17:00:00Z', 'wo-member'
    );
    INSERT INTO material_requisitions (
      id, requisition_no, work_order_id, requested_by_type, requested_by_id,
      status, urgency, purpose
    ) VALUES (
      'mr-team-metric', 'MR-20260725-METRIC', 'wo-member', 'engineer', 'eng-1',
      'submitted', 'normal', 'Replacement sensor'
    );
  `);

  const personal = await api(env, '/api/engineers/tickets?scope=personal');
  assert.equal(personal.response.status, 200);
  assert.equal(personal.json.scope, 'personal');
  assert.deepEqual(personal.json.work_orders.map((row) => row.id), ['wo-lead']);
  assert.equal(personal.json.work_orders[0].ownership_relation, 'personal');
  assert.match(personal.json.work_orders[0].display_title, /^[\x20-\x7e]+$/);

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
  for (const row of team.json.work_orders) {
    assert.equal(Object.hasOwn(row, 'customer_phone'), false);
    assert.equal(Object.hasOwn(row, 'payment_state'), false);
    assert.equal(Object.hasOwn(row, 'received_amount'), false);
    assert.equal(Object.hasOwn(row, 'outstanding_amount'), false);
    assert.equal(Object.hasOwn(row, 'pending_receipt_claim_count'), false);
  }
  const memberTicket = team.json.work_orders.find((row) => row.id === 'wo-member');
  assert.equal(memberTicket.scheduled_at, '2026-07-27T09:00:00Z');
  assert.equal(memberTicket.expected_completion_date, '2026-07-28');
  assert.equal(memberTicket.material_requisition_count, 1);
  assert.equal(memberTicket.short_title, "Han's Laser 3015 on-site repair");
  assert.equal(memberTicket.display_title, "Han's Laser 3015 on-site repair");

  const memberDetail = await api(env, '/api/workorders/wo-member');
  assert.equal(memberDetail.json.short_title, "Han's Laser 3015 on-site repair");
  assert.equal(memberDetail.json.display_title, "Han's Laser 3015 on-site repair");

  const ordinaryEngineerTeam = await api(env, '/api/engineers/tickets?scope=team', { userId: 'eng-1' });
  assert.equal(ordinaryEngineerTeam.response.status, 403);

  const spoofedIdentity = await api(env, '/api/engineers/tickets?scope=personal&engineer_id=eng-2');
  assert.deepEqual(spoofedIdentity.json.work_orders.map((row) => row.id), ['wo-lead']);
});

test('historical engineer compact detail includes work-order titles', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.exec(`
    UPDATE work_orders SET engineer_id = 'eng-2' WHERE id = 'wo-member';
    INSERT INTO work_order_field_days (
      id, work_order_id, engineer_id, site_local_date, site_timezone, status
    ) VALUES (
      'field-historical-member', 'wo-member', 'eng-1', '2026-07-24', 'Asia/Shanghai', 'reported'
    );
  `);

  const detail = await api(env, '/api/workorders/wo-member', { userId: 'eng-1' });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.short_title, "Han's Laser 3015 on-site repair");
  assert.equal(detail.json.display_title, "Han's Laser 3015 on-site repair");
  assert.deepEqual(detail.json.field_days.map((row) => row.id), ['field-historical-member']);
  assert.equal(Object.hasOwn(detail.json, 'description'), false);
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

test('regional lead can reassign a current subordinate work order without a retained lead assignment', async (t) => {
  const env = createEnv(t);

  const reassigned = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST',
    body: { work_order_id: 'wo-member', engineer_id: 'eng-1' },
  });

  assert.equal(reassigned.response.status, 200);
  assert.equal(reassigned.json.work_order.engineer_id, 'eng-1');
  assert.equal(
    env.DB.__sqlite.prepare('SELECT assigned_regional_lead_id FROM work_orders WHERE id = ?').get('wo-member').assigned_regional_lead_id,
    'lead-1',
  );
});

test('regional lead assignment aborts without side effects when ownership changes during the update', async (t) => {
  const env = createEnv(t);
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let raced = false;
  env.DB.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (!raced && /UPDATE work_orders\s+SET engineer_id = \?, assigned_regional_lead_id = \?, status = \?/s.test(sql)) {
      const originalRun = statement.run.bind(statement);
      statement.run = async () => {
        raced = true;
        env.DB.__sqlite.prepare(
          "UPDATE work_orders SET status = 'in_progress', engineer_id = 'eng-2', assigned_regional_lead_id = 'lead-2' WHERE id = 'wo-member'"
        ).run();
        return originalRun();
      };
    }
    return statement;
  };

  const reassigned = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST',
    body: { work_order_id: 'wo-member', engineer_id: 'eng-1' },
  });

  assert.equal(raced, true);
  assert.equal(reassigned.response.status, 409);
  const racedOrder = env.DB.__sqlite.prepare(
    'SELECT status, engineer_id, assigned_regional_lead_id FROM work_orders WHERE id = ?'
  ).get('wo-member');
  assert.equal(racedOrder.status, 'in_progress');
  assert.equal(racedOrder.engineer_id, 'eng-2');
  assert.equal(racedOrder.assigned_regional_lead_id, 'lead-2');
  assert.equal(
    env.DB.__sqlite.prepare("SELECT COUNT(*) AS count FROM work_order_logs WHERE action = 'assigned_engineer_by_regional_lead'").get().count,
    0,
  );
  assert.equal(
    env.DB.__sqlite.prepare("SELECT COUNT(*) AS count FROM work_order_messages WHERE message_type = 'service_assignment'").get().count,
    0,
  );
  assert.equal(env.DB.__sqlite.prepare('SELECT COUNT(*) AS count FROM notifications').get().count, 0);
});

test('regional lead blocked conflict marks the work order and writes one audit record', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.prepare(
    "UPDATE engineers SET phone = '+15550000001' WHERE id = 'eng-1'"
  ).run();

  const result = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST',
    body: { work_order_id: 'wo-member', engineer_id: 'eng-1' },
  });

  assert.equal(result.response.status, 409);
  assert.equal(result.json.error, 'A conflict of interest prevents this assignment.');
  const order = env.DB.__sqlite.prepare(
    'SELECT conflict_status, conflict_reason FROM work_orders WHERE id = ?'
  ).get('wo-member');
  assert.equal(order.conflict_status, 'blocked');
  assert.match(order.conflict_reason, /客户手机号与工程师手机号一致/);
  assert.equal(
    env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'regional_dispatch_blocked_conflict' AND target_id = 'wo-member'"
    ).get().count,
    1,
  );
});

test('regional lead blocked conflict aborts without side effects when ownership changes before its update', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.prepare(
    "UPDATE engineers SET phone = '+15550000001' WHERE id = 'eng-1'"
  ).run();
  const originalPrepare = env.DB.prepare.bind(env.DB);
  let raced = false;
  env.DB.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (!raced && /UPDATE work_orders SET conflict_status = 'blocked', conflict_reason = \? WHERE id = \?/.test(sql)) {
      const originalRun = statement.run.bind(statement);
      statement.run = async () => {
        raced = true;
        env.DB.__sqlite.prepare(`
          UPDATE work_orders
          SET status = 'in_progress', engineer_id = 'eng-2', assigned_regional_lead_id = 'lead-2',
              conflict_status = 'clear', conflict_reason = NULL
          WHERE id = 'wo-member'
        `).run();
        return originalRun();
      };
    }
    return statement;
  };

  const result = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST',
    body: { work_order_id: 'wo-member', engineer_id: 'eng-1' },
  });

  assert.equal(raced, true);
  assert.equal(result.response.status, 409);
  assert.equal(result.json.error, 'This service task changed. Refresh and try again.');
  const order = env.DB.__sqlite.prepare(`
    SELECT status, engineer_id, assigned_regional_lead_id, conflict_status, conflict_reason
    FROM work_orders WHERE id = ?
  `).get('wo-member');
  assert.equal(order.status, 'in_progress');
  assert.equal(order.engineer_id, 'eng-2');
  assert.equal(order.assigned_regional_lead_id, 'lead-2');
  assert.equal(order.conflict_status, 'clear');
  assert.equal(order.conflict_reason, null);
  assert.equal(
    env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'regional_dispatch_blocked_conflict' AND target_id = 'wo-member'"
    ).get().count,
    0,
  );
});

test('regional lead retained supervision is read-only for messages and hides engineer settlement data', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.exec(`
    UPDATE work_orders SET assigned_regional_lead_id = 'lead-1' WHERE id = 'wo-member';
    UPDATE engineers
    SET commission_rate = 0.91, credit_score = 37
    WHERE id = 'eng-1';
    INSERT INTO work_order_logs (
      id, work_order_id, action, actor_type, actor_id, content
    ) VALUES (
      'log-private-payment', 'wo-member', 'payment_collection_started',
      'admin', 'admin', 'Private payment collection note'
    );
    INSERT INTO work_order_messages (
      id, work_order_id, sender_type, sender_id, sender_name, content,
      message_type, is_internal_note, is_customer_visible
    ) VALUES
      ('msg-public', 'wo-member', 'engineer', 'eng-1', 'Amy Engineer', 'Public progress', 'text', 0, 1),
      ('msg-private', 'wo-member', 'admin', 'admin', 'Admin', 'Private payment note', 'payment_update', 1, 0),
      ('msg-financial-public', 'wo-member', 'system', '', 'SAGEMRO', 'Payment received', 'payment_update', 0, 1);
    INSERT INTO work_order_field_days (
      id, work_order_id, engineer_id, site_local_date, site_timezone, status,
      internal_note, latitude, longitude, completed_work
    ) VALUES (
      'field-member', 'wo-member', 'eng-1', '2026-07-25', 'Asia/Shanghai', 'reported',
      'Private field note', 31.2304, 121.4737, 'Customer-safe progress'
    );
    INSERT INTO work_order_field_day_media (
      id, field_day_id, work_order_id, purpose, object_key, mime_type, file_size,
      uploader_type, uploader_id, customer_visible, capture_source
    ) VALUES (
      'media-private', 'field-member', 'wo-member', 'internal_photo',
      'private/team-evidence.jpg', 'image/jpeg', 128, 'engineer', 'eng-1', 0, 'upload'
    );
  `);

  const postMessage = await api(env, '/api/workorders/wo-member/messages', {
    method: 'POST',
    body: { content: 'Management reply' },
  });
  assert.equal(postMessage.response.status, 403);

  const detail = await api(env, '/api/workorders/wo-member');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.payout, undefined);
  assert.equal(detail.json.payout_status, undefined);
  assert.deepEqual(detail.json.payments, []);
  assert.equal(detail.json.rating, undefined);
  assert.equal(detail.json.admin_reply, undefined);
  assert.equal(detail.json.engineer_review, undefined);
  assert.deepEqual(detail.json.logs, []);
  for (const field of [
    'customer_id', 'customer_phone', 'engineer_phone',
    'engineer_commission_rate', 'engineer_credit_score',
    'conflict_reason', 'service_latitude', 'service_longitude',
    'arrival_latitude', 'arrival_longitude',
  ]) {
    assert.equal(Object.hasOwn(detail.json, field), false, `${field} must not be exposed`);
  }

  const messages = await api(env, '/api/workorders/wo-member/messages');
  assert.equal(messages.response.status, 200);
  assert.deepEqual(messages.json.list.map((row) => row.id), ['msg-public']);

  const fieldDays = await api(env, '/api/workorders/wo-member/field-days');
  assert.equal(fieldDays.response.status, 200);
  assert.deepEqual(fieldDays.json.field_days, []);
  assert.deepEqual(fieldDays.json.media, []);

  const privateMedia = await api(env, '/api/workorders/wo-member/field-media/media-private');
  assert.equal(privateMedia.response.status, 403);

  const engineerReview = await api(env, '/api/workorders/wo-member/engineer-review');
  assert.equal(engineerReview.response.status, 403);

  const createMaterial = await api(env, '/api/workorders/wo-member/material-items', {
    method: 'POST',
    body: { purpose: 'preparation', name: 'Spoofed part', quantity: 1 },
  });
  assert.equal(createMaterial.response.status, 403);

  env.DB.__sqlite.exec(`
    INSERT INTO work_order_material_items (
      id, work_order_id, purpose, name, quantity, unit, status
    ) VALUES ('item-member', 'wo-member', 'preparation', 'Existing part', 1, 'pcs', 'active');
  `);
  const updateMaterial = await api(env, '/api/workorders/wo-member/material-items/item-member', {
    method: 'PATCH',
    body: { quantity: 2 },
  });
  assert.equal(updateMaterial.response.status, 403);
});

test('regional management quote views expose quote progress without internal finance fields', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.exec(`
    UPDATE work_orders SET assigned_regional_lead_id = 'lead-1' WHERE id = 'wo-member';
    INSERT INTO work_order_pricing (
      id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee,
      platform_fee, deposit_withhold, subtotal, total_amount, ai_price_check, status
    ) VALUES (
      'pricing-member', 'wo-member', 'eng-1', 1000, 200, 100, 0,
      300, 150, 1300, 1300, 'Internal pricing analysis', 'confirmed'
    );
  `);

  const detail = await api(env, '/api/workorders/wo-member');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.pricing.total_amount, 1300);
  for (const field of ['platform_fee', 'deposit_withhold', 'ai_price_check', 'payment_policy']) {
    assert.equal(Object.hasOwn(detail.json.pricing, field), false);
  }
  assert.equal(detail.json.quote_execution.total_amount, 1300);
  for (const field of ['payment_state', 'received_amount', 'outstanding_amount', 'financially_settled', 'start_ready']) {
    assert.equal(Object.hasOwn(detail.json.quote_execution, field), false);
  }
  const regionalQuoteSanitizer = workerSource.slice(
    workerSource.indexOf('function sanitizeRegionalManagementQuoteExecution'),
    workerSource.indexOf('async function listWorkOrderPaymentProjections'),
  );
  assert.match(regionalQuoteSanitizer, /visible\.receipt_claims = \[\];/);
  for (const privateClaimField of ['claimed_amount', 'confirmed_amount', 'status', 'decided_at', 'created_at']) {
    assert.doesNotMatch(regionalQuoteSanitizer, new RegExp(`claim\\.${privateClaimField}`));
  }

  const pricing = await api(env, '/api/workorders/wo-member/pricing');
  assert.equal(pricing.response.status, 200);
  assert.equal(pricing.json.pricing.total_amount, 1300);
  for (const field of ['platform_fee', 'deposit_withhold', 'ai_price_check', 'payment_policy']) {
    assert.equal(Object.hasOwn(pricing.json.pricing, field), false);
  }
});

test('regional lead cannot reassign work after engineer acceptance', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.prepare(
    "UPDATE work_orders SET status = 'in_progress', started_at = '2026-07-25 13:00:00', assigned_regional_lead_id = 'lead-1' WHERE id = 'wo-member'"
  ).run();

  const reassigned = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST',
    body: { work_order_id: 'wo-member', engineer_id: 'eng-1' },
  });
  assert.equal(reassigned.response.status, 409);
  assert.equal(reassigned.json.error, 'This service task cannot be assigned in its current status.');
});

test('regional lead cannot reassign work after service has started', async (t) => {
  const env = createEnv(t);
  env.DB.__sqlite.prepare(
    "UPDATE work_orders SET status = 'in_service', assigned_regional_lead_id = 'lead-1' WHERE id = 'wo-member'"
  ).run();

  const reassigned = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST',
    body: { work_order_id: 'wo-member', engineer_id: 'eng-1' },
  });
  assert.equal(reassigned.response.status, 409);
});

test('COM regional workspace assignment and team errors are English', async (t) => {
  const env = createEnv(t);

  const unauthorizedTickets = await api(env, '/api/engineers/tickets?scope=team', { userId: 'eng-1' });
  assert.equal(unauthorizedTickets.response.status, 403);
  assert.equal(unauthorizedTickets.json.error, 'Only Regional Leads can view team work orders.');

  const unauthorizedTeam = await api(env, '/api/engineers/team', { userId: 'eng-1' });
  assert.equal(unauthorizedTeam.response.status, 403);
  assert.equal(unauthorizedTeam.json.error, 'Only Regional Leads can view team engineers.');

  const unauthorizedAssignment = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST', userId: 'eng-1', body: { work_order_id: 'wo-member', engineer_id: 'eng-1' },
  });
  assert.equal(unauthorizedAssignment.response.status, 403);
  assert.equal(unauthorizedAssignment.json.error, 'Only Regional Leads can assign work orders.');

  const outsideTeam = await api(env, '/api/engineers/assign-engineer', {
    method: 'POST', body: { work_order_id: 'wo-member', engineer_id: 'eng-2' },
  });
  assert.equal(outsideTeam.response.status, 403);
  assert.equal(outsideTeam.json.error, 'Work orders can only be assigned to engineers in your regional team.');
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
  assert.equal(updateOther.json.error, 'Calendar event not found.');

  const updateScheduled = await api(env, '/api/engineers/calendar-events/event-work-order', {
    method: 'PATCH',
    body: {
      event_type: 'reserved_for_service', title: 'Changed schedule',
      start_at: '2026-07-27T10:00:00Z', end_at: '2026-07-27T12:00:00Z',
    },
  });
  assert.equal(updateScheduled.response.status, 409);
  assert.equal(updateScheduled.json.error, 'Work-order schedules must be changed through the work-order workflow.');

  const deleteScheduled = await api(env, '/api/engineers/calendar-events/event-work-order', { method: 'DELETE' });
  assert.equal(deleteScheduled.response.status, 409);
  assert.equal(deleteScheduled.json.error, 'Work-order schedules must be changed through the work-order workflow.');

  const deletePersonal = await api(env, '/api/engineers/calendar-events/event-personal', { method: 'DELETE' });
  assert.equal(deletePersonal.response.status, 200);

  const spoofedScheduled = await api(env, '/api/engineers/calendar-events', {
    method: 'POST',
    body: {
      event_type: 'reserved_for_service',
      title: 'Spoofed schedule',
      start_at: '2026-07-29T09:00:00Z',
      end_at: '2026-07-29T17:00:00Z',
      work_order_id: 'wo-member',
    },
  });
  assert.equal(spoofedScheduled.response.status, 400);
  assert.equal(spoofedScheduled.json.error, 'Work-order schedules can only be created through the work-order workflow.');

  const invalidRange = await api(env, '/api/engineers/calendar-events', {
    method: 'POST',
    body: {
      event_type: 'engineer_available', title: 'Invalid range',
      start_at: '2026-07-29T17:00:00Z', end_at: '2026-07-29T09:00:00Z',
    },
  });
  assert.equal(invalidRange.response.status, 400);
  assert.equal(invalidRange.json.error, 'End time must be later than start time.');
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
