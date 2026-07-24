import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createD1Database(db, hooks) {
  function statement(sql) {
    hooks.queries.push(normalizeSql(sql));
    return {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async first() {
        return db.prepare(sql).get(...this.args) || null;
      },
      async all() {
        return { results: db.prepare(sql).all(...this.args) };
      },
      async run() {
        return this.runSync();
      },
      runSync() {
        const result = db.prepare(sql).run(...this.args);
        return { success: true, meta: { changes: result.changes } };
      },
    };
  }

  return {
    prepare: statement,
    async batch(statements) {
      const beforeBatch = hooks.beforeNextBatch;
      hooks.beforeNextBatch = null;
      if (beforeBatch) await beforeBatch();
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const prepared of statements) results.push(prepared.runSync());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function createQuoteExecutionEnv({ market = 'com', filename = ':memory:', initialize = true } = {}) {
  const db = new DatabaseSync(filename);
  const hooks = { beforeNextBatch: null, queries: [] };
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (initialize) {
    db.exec(schemaSql);
    db.exec(`
      INSERT INTO customers (id, user_no, name, phone, password_hash)
      VALUES ('customer-1', 'U000001', 'Customer', '13900000001', 'hash');
      INSERT INTO engineers (id, user_no, name, phone, password_hash, level, commission_rate)
      VALUES ('engineer-1', 'E000001', 'Engineer', '13800000001', 'hash', 'senior', 0.85);
      INSERT INTO work_orders (
        id, order_no, customer_id, engineer_id, type, description, status,
        quote_review_status, service_mode, active_quote_version
      ) VALUES (
        'wo-quote-1', 'WO-QUOTE-1', 'customer-1', 'engineer-1', 'maintenance',
        'Quote execution request', 'in_progress', 'not_required', 'onsite', NULL
      );
    `);
  }

  return {
    db,
    env: {
      JWT_SECRET: 'test-secret-with-enough-length',
      DB: createD1Database(db, hooks),
      KV: {
        async get() { return null; },
        async put() {},
        async delete() {},
      },
    },
    origin: market === 'cn' ? 'https://sagemro.cn' : 'https://sagemro.com',
    host: market === 'cn' ? 'https://api.sagemro.cn' : 'https://api.sagemro.com',
    beforeNextBatch(callback) {
      hooks.beforeNextBatch = callback;
    },
    resetQueries() {
      hooks.queries.length = 0;
    },
    queries() {
      return [...hooks.queries];
    },
    close() {
      db.close();
    },
  };
}

function createBatchBarrier(expected) {
  let arrived = 0;
  let release;
  let allArrived;
  const released = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { allArrived = resolve; });
  return {
    async wait() {
      arrived += 1;
      if (arrived === expected) allArrived();
      await released;
    },
    ready,
    release,
  };
}

async function token(env, userType, userId, market = 'com') {
  return signJwt({
    userId,
    userType,
    market,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function api(ctx, path, {
  method = 'POST',
  body,
  userType = 'engineer',
  userId = 'engineer-1',
} = {}) {
  const market = ctx.host.endsWith('.cn') ? 'cn' : 'com';
  const jwt = await token(ctx.env, userType, userId, market);
  const response = await worker.fetch(new Request(`${ctx.host}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: ctx.origin,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), ctx.env, { waitUntil() {} });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

function quotePayload(overrides = {}) {
  return {
    labor_fee: 9000,
    parts_fee: 2000,
    travel_fee: 1000,
    other_fee: 0,
    expected_service_days: 3,
    payment_plan_mode: 'installments',
    payment_schedule: [
      {
        sequence: 1,
        amount: 6000,
        currency: 'USD',
        trigger_type: 'before_start',
        required_before_start: true,
        description: 'Start payment',
      },
      {
        sequence: 2,
        amount: 6000,
        currency: 'USD',
        trigger_type: 'on_acceptance',
        required_before_start: false,
        description: 'Acceptance payment',
      },
    ],
    ...overrides,
  };
}

async function submitQuote(ctx, body = quotePayload()) {
  return api(ctx, '/api/workorders/wo-quote-1/pricing', { body });
}

async function reviewQuote(ctx, action, quoteVersion, note = '') {
  return api(ctx, `/api/admin/workorders/wo-quote-1/pricing/${action}`, {
    method: 'PATCH',
    body: { quote_version: quoteVersion, note },
    userType: 'admin',
    userId: 'admin',
  });
}

async function confirmQuote(ctx, quoteVersion, options = {}) {
  return api(ctx, '/api/workorders/wo-quote-1/pricing/confirm', {
    body: { quote_version: quoteVersion },
    userType: options.userType || 'customer',
    userId: options.userId || 'customer-1',
  });
}

async function confirmBaselineForReceiptTests(ctx) {
  // Test fixture only: Task 4 owns customer activation and installment creation.
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  ctx.db.exec(`
    UPDATE work_orders SET active_quote_version = 1 WHERE id = 'wo-quote-1';
    UPDATE work_order_pricing_history
    SET status = 'confirmed', confirmed_at = datetime('now')
    WHERE version = 1;
    INSERT INTO work_order_installments (
      id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start, status, received_amount
    ) SELECT
      'installment-baseline-1', id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start, 'due', 0
    FROM work_order_payment_schedule WHERE work_order_id = 'wo-quote-1' AND sequence = 1;
  `);
}

test('quote submission persists one pending immutable version and its complete schedule atomically', async () => {
  const ctx = createQuoteExecutionEnv();

  const { response, json } = await submitQuote(ctx);

  assert.equal(response.status, 200);
  assert.equal(json.quote_version, 1);
  assert.equal(json.status, 'pending_review');
  const projection = ctx.db.prepare('SELECT * FROM work_order_pricing WHERE work_order_id = ?').get('wo-quote-1');
  assert.equal(projection.quote_version, 1);
  assert.equal(projection.expected_service_days, 3);
  assert.equal(projection.payment_plan_mode, 'installments');

  const history = ctx.db.prepare('SELECT * FROM work_order_pricing_history WHERE pricing_id = ?').get(projection.id);
  assert.equal(history.version, 1);
  assert.equal(history.status, 'pending_review');
  assert.equal(history.expected_service_days, 3);
  assert.equal(history.payment_plan_mode, 'installments');
  assert.equal(history.quote_kind, 'baseline');
  assert.equal(history.parent_quote_version, null);

  const schedule = ctx.db.prepare(`
    SELECT quote_version, sequence, amount, currency, trigger_type, description, required_before_start
    FROM work_order_payment_schedule WHERE work_order_id = ? ORDER BY sequence
  `).all('wo-quote-1').map((row) => ({ ...row }));
  assert.deepEqual(schedule, [
    {
      quote_version: 1,
      sequence: 1,
      amount: 6000,
      currency: 'USD',
      trigger_type: 'before_start',
      description: 'Start payment',
      required_before_start: 1,
    },
    {
      quote_version: 1,
      sequence: 2,
      amount: 6000,
      currency: 'USD',
      trigger_type: 'on_acceptance',
      description: 'Acceptance payment',
      required_before_start: 0,
    },
  ]);

  const audit = ctx.db.prepare(`
    SELECT before_state, after_state FROM audit_logs
    WHERE target_id = ? AND action = 'pricing_submitted_for_review'
  `).get('wo-quote-1');
  assert.deepEqual(JSON.parse(audit.before_state), {
    pricing_projection: null,
    quote_review: {
      status: 'not_required',
      quote_version: null,
      pricing_status: null,
    },
  });
  assert.deepEqual(JSON.parse(audit.after_state), {
    quote_review_status: 'pending_review',
    quote_version: 1,
    quote_kind: 'baseline',
    parent_quote_version: null,
    subtotal: 12000,
    expected_service_days: 3,
    payment_plan_mode: 'installments',
    payment_schedule: schedule.map(({ quote_version: _quoteVersion, ...row }) => ({
      ...row,
      due_date: null,
      required_before_start: Boolean(row.required_before_start),
    })),
  });
});

test('quote submission validates service days, fees, and payment schedule through the domain', async () => {
  const cases = [
    [quotePayload({ expected_service_days: 0 }), 'Expected onsite service days must be a positive integer.'],
    [quotePayload({ labor_fee: -9000 }), 'Quote total must be a positive whole amount.'],
    [quotePayload({ payment_schedule: quotePayload().payment_schedule.map((row) => ({ ...row, amount: 5000 })) }), 'Payment schedule must total the quote amount.'],
  ];

  for (const [body, message] of cases) {
    const ctx = createQuoteExecutionEnv();
    const { response, json } = await submitQuote(ctx, body);
    assert.equal(response.status, 400);
    assert.equal(json.error, message);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_pricing').get().count, 0);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_payment_schedule').get().count, 0);
  }
});

test('supplemental submission and review preserve operational work-order status', async () => {
  for (const status of ['in_service', 'resolved', 'completed']) {
    const ctx = createQuoteExecutionEnv();
    await submitQuote(ctx);
    await reviewQuote(ctx, 'approve', 1);
    await confirmQuote(ctx, 1);
    ctx.db.prepare('UPDATE work_orders SET status = ? WHERE id = ?').run(status, 'wo-quote-1');

    const supplemental = await submitQuote(ctx, quotePayload({
      labor_fee: 1000,
      parts_fee: 0,
      travel_fee: 0,
      expected_service_days: 1,
      quote_kind: 'supplemental',
      parent_quote_version: 1,
      payment_plan_mode: 'single',
      payment_schedule: undefined,
    }));
    assert.equal(supplemental.response.status, 200, status);
    assert.equal(ctx.db.prepare('SELECT status FROM work_orders').get().status, status);

    const reviewed = await reviewQuote(ctx, 'approve', 2);
    assert.equal(reviewed.response.status, 200, status);
    assert.equal(ctx.db.prepare('SELECT status FROM work_orders').get().status, status);
    assert.equal(ctx.db.prepare('SELECT quote_review_status FROM work_orders').get().quote_review_status, 'approved');
  }
});

test('safe retry clears only the new unprotected schedule version', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  const pricingId = ctx.db.prepare('SELECT id FROM work_order_pricing').get().id;
  ctx.db.prepare(`
    INSERT INTO work_order_payment_schedule (
      id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, description, required_before_start
    ) VALUES (?, ?, 'wo-quote-1', 2, 1, 12000, 'USD', 'before_start', 'Orphan retry row', 1)
  `).run('schedule-orphan-v2', pricingId);
  const approvedSchedule = ctx.db.prepare(`
    SELECT * FROM work_order_payment_schedule WHERE quote_version = 1 ORDER BY sequence
  `).all();

  const retry = await submitQuote(ctx, quotePayload({
    expected_service_days: 4,
  }));

  assert.equal(retry.response.status, 200);
  assert.equal(retry.json.quote_version, 2);
  assert.deepEqual(
    ctx.db.prepare('SELECT * FROM work_order_payment_schedule WHERE quote_version = 1 ORDER BY sequence').all(),
    approvedSchedule,
  );
  const schedule = ctx.db.prepare(`
    SELECT quote_version, sequence, amount, description
    FROM work_order_payment_schedule WHERE quote_version = 2 ORDER BY sequence
  `).all();
  assert.equal(schedule.length, 2);
  assert.equal(schedule.some((row) => row.description === 'Orphan retry row'), false);
});

test('safe retry does not clear a rejected history version schedule', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  const pricingId = ctx.db.prepare('SELECT id FROM work_order_pricing').get().id;
  ctx.beforeNextBatch(() => {
    ctx.db.exec(`
      INSERT INTO work_order_pricing_history (
        id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal,
        total_amount, version, expected_service_days, payment_plan_mode, quote_kind, status
      ) VALUES (
        'history-rejected-v2', '${pricingId}', 9000, 2000, 1000, 0, 12000,
        12000, 2, 3, 'single', 'baseline', 'rejected'
      );
      INSERT INTO work_order_payment_schedule (
        id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
        trigger_type, description, required_before_start
      ) VALUES (
        'schedule-rejected-v2', '${pricingId}', 'wo-quote-1', 2, 1, 12000,
        'USD', 'before_start', 'Rejected version schedule', 1
      );
    `);
  });

  const retry = await submitQuote(ctx);

  assert.equal(retry.response.status, 409);
  assert.equal(
    ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_payment_schedule WHERE id = ?').get('schedule-rejected-v2').count,
    1,
  );
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_pricing_history').get().count, 2);
});

test('Admin approval targets the exact version and returns all reviewed terms', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);

  const { response, json } = await reviewQuote(ctx, 'approve', 1);

  assert.equal(response.status, 200);
  assert.equal(json.status, 'approved');
  assert.equal(json.quote.quote_version, 1);
  assert.equal(json.quote.status, 'approved');
  assert.equal(json.quote.labor_fee, 9000);
  assert.equal(json.quote.parts_fee, 2000);
  assert.equal(json.quote.travel_fee, 1000);
  assert.equal(json.quote.other_fee, 0);
  assert.equal(json.quote.total_amount, 12000);
  assert.equal(json.quote.expected_service_days, 3);
  assert.equal(json.quote.payment_plan_mode, 'installments');
  assert.equal(json.quote.payment_schedule.length, 2);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history WHERE version = 1').get().status, 'approved');
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing').get().status, 'submitted');

  const audit = ctx.db.prepare(`
    SELECT before_state, after_state FROM audit_logs
    WHERE action = 'pricing_review_approved'
  `).get();
  assert.equal(JSON.parse(audit.before_state).payment_schedule.length, 2);
  assert.equal(JSON.parse(audit.after_state).payment_schedule.length, 2);
});

test('Admin rejection requires a reason and returns the exact version for correction', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);

  const missingReason = await reviewQuote(ctx, 'reject', 1);
  assert.equal(missingReason.response.status, 400);

  const { response, json } = await reviewQuote(ctx, 'reject', 1, 'Clarify the acceptance trigger.');
  assert.equal(response.status, 200);
  assert.equal(json.status, 'rejected');
  assert.equal(json.quote.quote_version, 1);
  assert.equal(json.quote.status, 'rejected');
  assert.equal(json.quote.payment_schedule.length, 2);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history WHERE version = 1').get().status, 'rejected');
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing').get().status, 'draft');
});

test('Admin stale version action returns 409', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);

  const { response } = await reviewQuote(ctx, 'approve', 2);

  assert.equal(response.status, 409);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history WHERE version = 1').get().status, 'pending_review');
});

test('customer activates the exact approved baseline and its immutable schedule atomically', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);

  const stale = await confirmQuote(ctx, 2);
  assert.equal(stale.response.status, 409);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_installments').get().count, 0);

  const forbidden = await confirmQuote(ctx, 1, { userId: 'customer-2' });
  assert.equal(forbidden.response.status, 403);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_installments').get().count, 0);

  const confirmed = await confirmQuote(ctx, 1);
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.json.quote_version, 1);

  const workOrder = ctx.db.prepare('SELECT * FROM work_orders WHERE id = ?').get('wo-quote-1');
  assert.equal(workOrder.active_quote_version, 1);
  assert.equal(workOrder.quote_expected_service_days, 3);
  assert.equal(workOrder.expected_service_days, 3);
  assert.equal(workOrder.status, 'pending_payment');
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing').get().status, 'confirmed');
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history WHERE version = 1').get().status, 'confirmed');

  const installments = ctx.db.prepare(`
    SELECT quote_version, sequence, amount, trigger_type, status, received_amount
    FROM work_order_installments ORDER BY quote_version, sequence
  `).all().map((row) => ({ ...row }));
  assert.deepEqual(installments, [
    { quote_version: 1, sequence: 1, amount: 6000, trigger_type: 'before_start', status: 'due', received_amount: 0 },
    { quote_version: 1, sequence: 2, amount: 6000, trigger_type: 'on_acceptance', status: 'scheduled', received_amount: 0 },
  ]);

  const repeated = await confirmQuote(ctx, 1);
  assert.equal(repeated.response.status, 409);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_installments').get().count, 2);
});

test('customer activation guard rolls back projection and installment writes on a stale approval race', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  ctx.beforeNextBatch(() => {
    ctx.db.exec("UPDATE work_order_pricing_history SET status = 'confirmed' WHERE version = 1");
  });

  const result = await confirmQuote(ctx, 1);

  assert.equal(result.response.status, 409);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing').get().status, 'submitted');
  assert.equal(ctx.db.prepare('SELECT active_quote_version FROM work_orders').get().active_quote_version, null);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_installments').get().count, 0);
});

test('customer activation guard rolls back when work-order ownership changes before the batch', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  ctx.db.exec(`
    INSERT INTO customers (id, user_no, name, phone, password_hash)
    VALUES ('customer-2', 'U000002', 'Other Customer', '13900000002', 'hash');
  `);
  ctx.beforeNextBatch(() => {
    ctx.db.exec("UPDATE work_orders SET customer_id = 'customer-2' WHERE id = 'wo-quote-1'");
  });

  const result = await confirmQuote(ctx, 1);

  assert.equal(result.response.status, 409);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing').get().status, 'submitted');
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history').get().status, 'approved');
  assert.equal(ctx.db.prepare('SELECT active_quote_version FROM work_orders').get().active_quote_version, null);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_installments').get().count, 0);
});

test('customer activation remains successful when post-commit notification preparation fails', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  const originalPrepare = ctx.env.DB.prepare;
  ctx.env.DB.prepare = (sql) => {
    if (/SELECT engineer_id, order_no FROM work_orders WHERE id = \?/i.test(normalizeSql(sql))) {
      throw new Error('notification lookup failed');
    }
    return originalPrepare(sql);
  };

  const confirmed = await confirmQuote(ctx, 1);

  assert.equal(confirmed.response.status, 200);
  assert.equal(ctx.db.prepare('SELECT active_quote_version FROM work_orders').get().active_quote_version, 1);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history').get().status, 'confirmed');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_installments').get().count, 2);
});

test('hybrid activation stores the reviewed allowance but keeps field execution dormant', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec("UPDATE work_orders SET service_mode = 'hybrid' WHERE id = 'wo-quote-1'");
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);

  const confirmed = await confirmQuote(ctx, 1);

  assert.equal(confirmed.response.status, 200);
  const workOrder = ctx.db.prepare('SELECT * FROM work_orders WHERE id = ?').get('wo-quote-1');
  assert.equal(workOrder.quote_expected_service_days, 3);
  assert.equal(workOrder.expected_service_days, null);
  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(detail.json.quote_execution.expected_service_days, 3);
  assert.equal(detail.json.quote_execution.initial_workdays, 0);
  assert.equal(detail.json.quote_execution.permitted_workdays, 0);
});

test('confirmed onsite conversion activates the exact stored hybrid quote allowance', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec("UPDATE work_orders SET service_mode = 'hybrid' WHERE id = 'wo-quote-1'");
  await submitQuote(ctx, quotePayload({ expected_service_days: 4 }));
  await reviewQuote(ctx, 'approve', 1);
  await confirmQuote(ctx, 1);
  ctx.db.exec(`
    UPDATE work_orders
    SET onsite_conversion_status = 'requested'
    WHERE id = 'wo-quote-1'
  `);

  const before = ctx.db.prepare('SELECT * FROM work_orders WHERE id = ?').get('wo-quote-1');
  assert.equal(before.service_mode, 'hybrid');
  assert.equal(before.quote_expected_service_days, 4);
  assert.equal(before.expected_service_days, null);

  const converted = await api(ctx, '/api/workorders/wo-quote-1/onsite-conversion/confirm', {
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
  const after = ctx.db.prepare('SELECT * FROM work_orders WHERE id = ?').get('wo-quote-1');
  assert.equal(after.service_mode, 'onsite');
  assert.equal(after.quote_expected_service_days, 4);
  assert.equal(after.expected_service_days, 4);
  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(detail.json.quote_execution.initial_workdays, 4);
  assert.equal(detail.json.quote_execution.permitted_workdays, 4);
});

test('onsite conversion copies and audits the allowance persisted when its batch begins', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec("UPDATE work_orders SET service_mode = 'hybrid' WHERE id = 'wo-quote-1'");
  await submitQuote(ctx, quotePayload({ expected_service_days: 4 }));
  await reviewQuote(ctx, 'approve', 1);
  await confirmQuote(ctx, 1);
  ctx.db.exec("UPDATE work_orders SET onsite_conversion_status = 'requested' WHERE id = 'wo-quote-1'");
  ctx.beforeNextBatch(() => {
    ctx.db.exec("UPDATE work_orders SET quote_expected_service_days = 6 WHERE id = 'wo-quote-1'");
  });

  const converted = await api(ctx, '/api/workorders/wo-quote-1/onsite-conversion/confirm', {
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
  const workOrder = ctx.db.prepare('SELECT quote_expected_service_days, expected_service_days FROM work_orders').get();
  assert.equal(workOrder.quote_expected_service_days, 6);
  assert.equal(workOrder.expected_service_days, 6);
  const audit = ctx.db.prepare(`
    SELECT after_state FROM audit_logs
    WHERE action = 'onsite_conversion_confirmed' ORDER BY created_at DESC, id DESC LIMIT 1
  `).get();
  assert.equal(JSON.parse(audit.after_state).expected_service_days, 6);
});

test('onsite conversion rolls back its update and log when the audit insert fails', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    UPDATE work_orders
    SET service_mode = 'hybrid', onsite_conversion_status = 'requested',
      active_quote_version = 1, quote_expected_service_days = 4
    WHERE id = 'wo-quote-1';
    CREATE TRIGGER fail_onsite_conversion_audit
    BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'onsite_conversion_confirmed'
    BEGIN
      SELECT RAISE(ABORT, 'forced onsite conversion audit failure');
    END;
  `);

  const converted = await api(ctx, '/api/workorders/wo-quote-1/onsite-conversion/confirm', {
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

  assert.equal(converted.response.status, 500);
  assert.deepEqual(
    { ...ctx.db.prepare('SELECT service_mode, onsite_conversion_status, expected_service_days FROM work_orders').get() },
    { service_mode: 'hybrid', onsite_conversion_status: 'requested', expected_service_days: null },
  );
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM work_order_logs WHERE action = 'onsite_conversion_confirmed'").get().count, 0);
});

test('supplemental activation preserves the baseline and prior supplementals while adding installments', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  await confirmQuote(ctx, 1);

  for (const [version, amount] of [[2, 1500], [3, 700]]) {
    const submitted = await submitQuote(ctx, quotePayload({
      labor_fee: amount,
      parts_fee: 0,
      travel_fee: 0,
      expected_service_days: 1,
      quote_kind: 'supplemental',
      parent_quote_version: 1,
      payment_plan_mode: 'single',
      payment_schedule: undefined,
    }));
    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.json.quote_version, version);
    assert.equal((await reviewQuote(ctx, 'approve', version)).response.status, 200);
    assert.equal((await confirmQuote(ctx, version)).response.status, 200);
  }

  assert.equal(ctx.db.prepare('SELECT active_quote_version FROM work_orders').get().active_quote_version, 1);
  assert.deepEqual(
    ctx.db.prepare("SELECT version FROM work_order_pricing_history WHERE status = 'confirmed' ORDER BY version").all().map((row) => row.version),
    [1, 2, 3],
  );
  assert.deepEqual(
    ctx.db.prepare('SELECT quote_version FROM work_order_installments ORDER BY quote_version, sequence').all().map((row) => row.quote_version),
    [1, 1, 2, 3],
  );
  const projection = ctx.db.prepare('SELECT * FROM work_order_pricing').get();
  assert.equal(projection.quote_version, 3);
  assert.equal(projection.total_amount, 14200);
  assert.equal(projection.status, 'confirmed');
  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(detail.json.quote_execution.active_quote_version, 1);
  assert.equal(detail.json.quote_execution.total_amount, 14200);
  assert.equal(detail.json.quote_execution.scheduled_amount, 14200);
  assert.deepEqual(
    detail.json.quote_execution.installments.map((row) => row.quote_version),
    [1, 1, 2, 3],
  );
});

test('active execution loads all schedules with one parameterized IN query', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  await confirmQuote(ctx, 1);
  for (const [version, amount] of [[2, 1500], [3, 700]]) {
    await submitQuote(ctx, quotePayload({
      labor_fee: amount,
      parts_fee: 0,
      travel_fee: 0,
      expected_service_days: 1,
      quote_kind: 'supplemental',
      parent_quote_version: 1,
      payment_plan_mode: 'single',
      payment_schedule: undefined,
    }));
    await reviewQuote(ctx, 'approve', version);
    await confirmQuote(ctx, version);
  }
  ctx.resetQueries();

  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });

  assert.equal(detail.response.status, 200);
  const scheduleQueries = ctx.queries().filter((sql) => /FROM work_order_payment_schedule/i.test(sql));
  assert.equal(scheduleQueries.length, 2);
  assert.equal(scheduleQueries.every((sql) => /quote_version IN \(\?, \?, \?\)/i.test(sql)), true);
});

test('receipt claims use role-facing allowlists without idempotency or Admin identity leaks', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role)
    VALUES ('lead-1', 'E000002', 'Regional Lead', '13800000002', 'hash', 'regional_lead');
    UPDATE work_orders SET assigned_regional_lead_id = 'lead-1' WHERE id = 'wo-quote-1';
  `);
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  await confirmQuote(ctx, 1);
  const firstInstallment = ctx.db.prepare('SELECT id FROM work_order_installments WHERE sequence = 1').get();
  ctx.db.prepare(`
    UPDATE work_order_installments SET received_amount = amount, status = 'received', completed_at = datetime('now')
    WHERE id = ?
  `).run(firstInstallment.id);
  ctx.db.prepare(`
    INSERT INTO work_order_receipt_claims (
      id, installment_id, work_order_id, engineer_id, claimed_amount, engineer_note,
      transaction_reference, status, confirmed_amount, decision_reason, decided_by,
      decided_at, idempotency_key, decision_idempotency_key
    ) VALUES (?, ?, 'wo-quote-1', 'engineer-1', 6000, 'Internal collection note',
      'TX-PRIVATE-1', 'confirmed', 6000, 'Matched bank receipt', 'admin-1',
      datetime('now'), 'claim-detail-1', 'decision-detail-1')
  `).run('claim-detail-1', firstInstallment.id);

  for (const [userType, userId] of [
    ['customer', 'customer-1'],
    ['engineer', 'engineer-1'],
    ['engineer', 'lead-1'],
    ['admin', 'admin'],
  ]) {
    const detail = await api(ctx, '/api/workorders/wo-quote-1', { method: 'GET', userType, userId });
    assert.equal(detail.response.status, 200);
    const execution = detail.json.quote_execution;
    assert.equal(execution.quote_version, 1);
    assert.equal(execution.total_amount, 12000);
    assert.equal(execution.received_amount, 6000);
    assert.equal(execution.outstanding_amount, 6000);
    assert.equal(execution.payment_state, 'partially_received');
    assert.equal(execution.payment_schedule.length, 2);
    assert.equal(execution.installments.length, 2);
    assert.equal(execution.receipt_claims.length, 1);
    const claim = execution.receipt_claims[0];
    assert.equal(Object.hasOwn(claim, 'idempotency_key'), false);
    assert.equal(Object.hasOwn(claim, 'decision_idempotency_key'), false);
    if (userType === 'admin') assert.equal(claim.decided_by, 'admin-1');
    else assert.equal(Object.hasOwn(claim, 'decided_by'), false);
    if (userType === 'customer') {
      assert.equal(Object.hasOwn(claim, 'engineer_note'), false);
      assert.equal(Object.hasOwn(claim, 'transaction_reference'), false);
      assert.equal(Object.hasOwn(claim, 'decision_reason'), false);
    } else {
      assert.equal(claim.engineer_note, 'Internal collection note');
      assert.equal(claim.transaction_reference, 'TX-PRIVATE-1');
      assert.equal(claim.decision_reason, 'Matched bank receipt');
    }
  }
});

test('historical quotes project a read-only legacy installment without creating execution rows', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    INSERT INTO work_order_pricing (
      id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee,
      subtotal, total_amount, status
    ) VALUES ('legacy-pricing', 'wo-quote-1', 'engineer-1', 3600, 1200, 400, 200, 5400, 5400, 'confirmed');
    INSERT INTO work_order_payments (
      id, work_order_id, customer_id, amount, status, payment_stage
    ) VALUES ('legacy-payment', 'wo-quote-1', 'customer-1', 3500, 'completed', 'advance');
  `);

  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'admin', userId: 'admin',
  });

  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.quote_execution.legacy, true);
  assert.equal(detail.json.quote_execution.total_amount, 5400);
  assert.equal(detail.json.quote_execution.received_amount, 3500);
  assert.equal(detail.json.quote_execution.outstanding_amount, 1900);
  assert.equal(detail.json.quote_execution.installments.length, 1);
  assert.equal(detail.json.quote_execution.installments[0].source, 'legacy');
  assert.equal(detail.json.quote_execution.installments[0].currency, 'USD');
  assert.equal(Object.hasOwn(detail.json.quote_execution.installments[0], 'decided_by'), false);
  assert.equal(Object.hasOwn(detail.json.quote_execution.installments[0], 'decided_at'), false);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_installments').get().count, 0);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_payment_schedule').get().count, 0);
});

test('legacy projection counts each completed stage once and ignores pending or failed rows', async () => {
  const ctx = createQuoteExecutionEnv({ market: 'cn' });
  ctx.db.exec(`
    INSERT INTO work_order_pricing (
      id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee,
      subtotal, total_amount, status
    ) VALUES ('legacy-pricing', 'wo-quote-1', 'engineer-1', 3600, 1200, 400, 200, 5400, 5400, 'confirmed');
    INSERT INTO work_order_payments (
      id, work_order_id, customer_id, amount, status, payment_stage, transaction_id, created_at
    ) VALUES
      ('advance-complete', 'wo-quote-1', 'customer-1', 3500, 'completed', 'advance', 'TX-A', '2026-01-01 00:00:00'),
      ('advance-duplicate', 'wo-quote-1', 'customer-1', 3500, 'completed', 'advance', 'TX-A-DUP', '2026-01-02 00:00:00'),
      ('advance-pending', 'wo-quote-1', 'customer-1', 3500, 'pending', 'advance', 'TX-P', '2026-01-03 00:00:00'),
      ('balance-failed', 'wo-quote-1', 'customer-1', 1900, 'failed', 'balance', 'TX-F', '2026-01-04 00:00:00'),
      ('balance-complete', 'wo-quote-1', 'customer-1', 1900, 'completed', 'balance', 'TX-B', '2026-01-05 00:00:00');
  `);

  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'admin', userId: 'admin',
  });

  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.quote_execution.received_amount, 5400);
  assert.equal(detail.json.quote_execution.outstanding_amount, 0);
  assert.equal(detail.json.quote_execution.payment_state, 'settled');
  assert.equal(detail.json.quote_execution.installments[0].currency, 'CNY');
});

test('legacy projection fails closed on inconsistent overpayment', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    INSERT INTO work_order_pricing (
      id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee,
      subtotal, total_amount, status
    ) VALUES ('legacy-pricing', 'wo-quote-1', 'engineer-1', 3600, 1200, 400, 200, 5400, 5400, 'confirmed');
    INSERT INTO work_order_payments (
      id, work_order_id, customer_id, amount, status, payment_stage, transaction_id
    ) VALUES
      ('advance-overpaid', 'wo-quote-1', 'customer-1', 4000, 'completed', 'advance', 'TX-A'),
      ('balance-complete', 'wo-quote-1', 'customer-1', 1900, 'completed', 'balance', 'TX-B');
  `);

  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'admin', userId: 'admin',
  });

  assert.equal(detail.response.status, 500);
  assert.match(detail.json.error, /inconsistent/i);
});

test('confirmed receipts block baseline replacement but allow a linked supplemental quote', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  ctx.db.exec(`
    UPDATE work_order_installments
    SET status = 'received', received_amount = amount
    WHERE id = 'installment-baseline-1';
    INSERT INTO work_order_receipt_claims (
      id, installment_id, work_order_id, engineer_id, claimed_amount, status,
      confirmed_amount, decided_by, decided_at, idempotency_key
    ) VALUES (
      'claim-baseline-1', 'installment-baseline-1', 'wo-quote-1', 'engineer-1', 6000,
      'confirmed', 6000, 'admin', datetime('now'), 'claim-baseline-1'
    );
  `);
  const baselineScheduleBefore = ctx.db.prepare(`
    SELECT * FROM work_order_payment_schedule WHERE quote_version = 1 ORDER BY sequence
  `).all();
  const baselineHistoryBefore = {
    ...ctx.db.prepare('SELECT * FROM work_order_pricing_history WHERE version = 1').get(),
  };

  const blocked = await submitQuote(ctx, quotePayload());
  assert.equal(blocked.response.status, 409);

  const supplemental = await submitQuote(ctx, quotePayload({
    labor_fee: 1000,
    parts_fee: 500,
    travel_fee: 0,
    expected_service_days: 1,
    quote_kind: 'supplemental',
    parent_quote_version: 1,
    payment_plan_mode: 'single',
    payment_schedule: undefined,
  }));
  assert.equal(supplemental.response.status, 200);
  assert.equal(supplemental.json.quote_version, 2);
  const supplementalHistory = ctx.db.prepare('SELECT * FROM work_order_pricing_history WHERE version = 2').get();
  assert.equal(supplementalHistory.quote_kind, 'supplemental');
  assert.equal(supplementalHistory.parent_quote_version, 1);
  assert.equal(supplementalHistory.status, 'pending_review');
  assert.deepEqual(
    ctx.db.prepare('SELECT * FROM work_order_payment_schedule WHERE quote_version = 1 ORDER BY sequence').all(),
    baselineScheduleBefore,
  );
  const projection = ctx.db.prepare('SELECT * FROM work_order_pricing WHERE work_order_id = ?').get('wo-quote-1');
  assert.equal(projection.quote_version, 2);
  assert.equal(projection.labor_fee, 10000);
  assert.equal(projection.parts_fee, 2500);
  assert.equal(projection.travel_fee, 1000);
  assert.equal(projection.total_amount, 13500);
  assert.equal(projection.expected_service_days, 3);
  assert.equal(projection.payment_plan_mode, 'installments');
  assert.deepEqual(
    { ...ctx.db.prepare('SELECT * FROM work_order_pricing_history WHERE version = 1').get() },
    baselineHistoryBefore,
  );
  const audit = ctx.db.prepare(`
    SELECT before_state, after_state FROM audit_logs
    WHERE action = 'pricing_submitted_for_review' ORDER BY created_at DESC, id DESC LIMIT 1
  `).get();
  assert.deepEqual(JSON.parse(audit.before_state), {
    pricing_projection: {
      quote_version: 1,
      status: 'submitted',
      labor_fee: 9000,
      parts_fee: 2000,
      travel_fee: 1000,
      other_fee: 0,
      subtotal: 12000,
      total_amount: 12000,
      platform_fee: 1800,
      deposit_withhold: 600,
      expected_service_days: 3,
      payment_plan_mode: 'installments',
    },
    quote_review: {
      status: 'approved',
      quote_version: 1,
      pricing_status: 'submitted',
    },
  });
  assert.equal(JSON.parse(audit.after_state).quote_version, 2);
  assert.equal(JSON.parse(audit.after_state).payment_schedule.length, 1);

  const approval = await reviewQuote(ctx, 'approve', 2);
  assert.equal(approval.response.status, 200);
  assert.equal(approval.json.quote.quote_kind, 'supplemental');
  assert.equal(approval.json.quote.parent_quote_version, 1);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history WHERE version = 1').get().status, 'confirmed');
});

test('supplemental projection keeps the confirmed baseline visible to customers while staff sees review terms', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  await submitQuote(ctx, quotePayload({
    labor_fee: 1000,
    parts_fee: 500,
    travel_fee: 0,
    expected_service_days: 1,
    quote_kind: 'supplemental',
    parent_quote_version: 1,
    payment_plan_mode: 'single',
    payment_schedule: undefined,
  }));

  const customer = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(customer.response.status, 200);
  assert.equal(customer.json.pricing.quote_version, 1);
  assert.equal(customer.json.pricing.total_amount, 12000);
  assert.equal(customer.json.pricing.payment_schedule.length, 2);
  const customerPricing = await api(ctx, '/api/workorders/wo-quote-1/pricing', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(customerPricing.response.status, 200);
  assert.equal(customerPricing.json.pricing.quote_version, 1);
  assert.equal(customerPricing.json.pricing.total_amount, 12000);
  assert.equal(customerPricing.json.pricing.payment_schedule.length, 2);

  const engineer = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'engineer', userId: 'engineer-1',
  });
  assert.equal(engineer.response.status, 200);
  assert.equal(engineer.json.pricing.quote_version, 2);
  assert.equal(engineer.json.pricing.total_amount, 13500);
  assert.equal(engineer.json.pricing.payment_schedule.reduce((sum, row) => sum + row.amount, 0), 13500);
});

test('pending supplemental review terms do not change active quote execution for staff or Admin', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  await confirmQuote(ctx, 1);
  await submitQuote(ctx, quotePayload({
    labor_fee: 1000,
    parts_fee: 500,
    travel_fee: 0,
    expected_service_days: 1,
    quote_kind: 'supplemental',
    parent_quote_version: 1,
    payment_plan_mode: 'single',
    payment_schedule: undefined,
  }));

  for (const [userType, userId] of [['engineer', 'engineer-1'], ['admin', 'admin']]) {
    const detail = await api(ctx, '/api/workorders/wo-quote-1', { method: 'GET', userType, userId });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.json.pricing.quote_version, 2);
    assert.equal(detail.json.pricing.total_amount, 13500);
    assert.deepEqual(detail.json.pricing.payment_schedule.map((row) => row.quote_version), [1, 1, 2]);
    assert.equal(detail.json.quote_execution.quote_version, 1);
    assert.equal(detail.json.quote_execution.total_amount, 12000);
    assert.equal(detail.json.quote_execution.scheduled_amount, 12000);
    assert.equal(detail.json.quote_execution.outstanding_amount, 12000);
    assert.equal(detail.json.quote_execution.payment_state, 'unpaid');
    assert.deepEqual(detail.json.quote_execution.installments.map((row) => row.quote_version), [1, 1]);
  }
});

test('supplemental projection includes prior confirmed supplements but hides the pending schedule from customers', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  const pricingId = ctx.db.prepare('SELECT id FROM work_order_pricing').get().id;
  ctx.db.exec(`
    INSERT INTO work_order_pricing_history (
      id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal,
      total_amount, platform_fee, deposit_withhold, version, expected_service_days,
      payment_plan_mode, quote_kind, parent_quote_version, status, confirmed_at
    ) VALUES (
      'history-supplemental-v2', '${pricingId}', 500, 100, 0, 0, 600, 600, 90, 30,
      2, 3, 'single', 'supplemental', 1, 'confirmed', datetime('now')
    );
    INSERT INTO work_order_payment_schedule (
      id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, description, required_before_start
    ) VALUES (
      'schedule-supplemental-v2', '${pricingId}', 'wo-quote-1', 2, 1, 600, 'USD',
      'on_acceptance', 'Confirmed supplemental', 0
    );
  `);
  ctx.db.exec("UPDATE work_order_pricing SET quote_version = 2, labor_fee = 9500, parts_fee = 2100, travel_fee = 1000, subtotal = 12600, total_amount = 12600, platform_fee = 1890, deposit_withhold = 630, status = 'submitted' WHERE work_order_id = 'wo-quote-1'");

  const pending = await submitQuote(ctx, quotePayload({
    labor_fee: 300,
    parts_fee: 200,
    travel_fee: 0,
    expected_service_days: 1,
    quote_kind: 'supplemental',
    parent_quote_version: 1,
    payment_plan_mode: 'single',
    payment_schedule: undefined,
  }));
  assert.equal(pending.response.status, 200);
  assert.equal(pending.json.quote_version, 3);

  ctx.db.exec(`
    INSERT INTO work_order_pricing_history (
      id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal,
      total_amount, platform_fee, deposit_withhold, version, expected_service_days,
      payment_plan_mode, quote_kind, parent_quote_version, status
    ) VALUES
      ('history-rejected-v4', '${pricingId}', 900, 0, 0, 0, 900, 900, 135, 45,
       4, 3, 'single', 'supplemental', 1, 'rejected'),
      ('history-draft-v5', '${pricingId}', 800, 0, 0, 0, 800, 800, 120, 40,
       5, 3, 'single', 'supplemental', 1, 'draft');
    INSERT INTO work_order_payment_schedule (
      id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, description, required_before_start
    ) VALUES
      ('schedule-rejected-v4', '${pricingId}', 'wo-quote-1', 4, 1, 900, 'USD',
       'on_acceptance', 'Rejected supplemental', 0),
      ('schedule-draft-v5', '${pricingId}', 'wo-quote-1', 5, 1, 800, 'USD',
       'on_acceptance', 'Draft supplemental', 0);
  `);

  const projection = ctx.db.prepare('SELECT * FROM work_order_pricing WHERE work_order_id = ?').get('wo-quote-1');
  assert.equal(projection.labor_fee, 9800);
  assert.equal(projection.parts_fee, 2300);
  assert.equal(projection.travel_fee, 1000);
  assert.equal(projection.total_amount, 13100);

  const customer = await api(ctx, '/api/workorders/wo-quote-1/pricing', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(customer.response.status, 200);
  assert.equal(customer.json.pricing.total_amount, 12600);
  assert.deepEqual(customer.json.pricing.payment_schedule.map((row) => row.quote_version), [1, 1, 2]);

  const engineer = await api(ctx, '/api/workorders/wo-quote-1/pricing', {
    method: 'GET', userType: 'engineer', userId: 'engineer-1',
  });
  assert.equal(engineer.response.status, 200);
  assert.equal(engineer.json.pricing.total_amount, 13100);
  assert.deepEqual(engineer.json.pricing.payment_schedule.map((row) => row.quote_version), [1, 1, 2, 3]);
  assert.equal(engineer.json.pricing.payment_schedule.reduce((sum, row) => sum + row.amount, 0), 13100);
});

test('generic detail hides pending and rejected review schedules from customers', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);

  const pendingCustomer = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(pendingCustomer.response.status, 200);
  assert.equal(pendingCustomer.json.pricing, null);

  const engineer = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'engineer', userId: 'engineer-1',
  });
  assert.equal(engineer.json.pricing.payment_schedule.length, 2);

  await reviewQuote(ctx, 'reject', 1, 'Clarify the acceptance trigger.');
  const rejectedCustomer = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(rejectedCustomer.response.status, 200);
  assert.equal(rejectedCustomer.json.pricing, null);
});

test('first-quote race maps SQLite uniqueness to 409 and rolls back the losing batch', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sagemro-quote-race-'));
  const filename = join(directory, 'quote-execution.sqlite');
  const first = createQuoteExecutionEnv({ filename });
  const second = createQuoteExecutionEnv({ filename, initialize: false });
  const barrier = createBatchBarrier(2);
  first.beforeNextBatch(() => barrier.wait());
  second.beforeNextBatch(() => barrier.wait());

  try {
    const firstRequest = submitQuote(first);
    const secondRequest = submitQuote(second);
    await barrier.ready;
    barrier.release();
    const results = await Promise.all([firstRequest, secondRequest]);
    const statuses = results.map(({ response }) => response.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(results.find(({ response }) => response.status === 409).json.error, 'The quote changed. Refresh and try again.');
    assert.equal(first.db.prepare('SELECT COUNT(*) AS count FROM work_order_pricing').get().count, 1);
    assert.equal(first.db.prepare('SELECT COUNT(*) AS count FROM work_order_pricing_history').get().count, 1);
    assert.equal(first.db.prepare('SELECT COUNT(*) AS count FROM work_order_payment_schedule').get().count, 2);
  } finally {
    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('baseline replacement fails when a receipt is confirmed between eligibility read and batch write', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  ctx.beforeNextBatch(() => {
    ctx.db.exec(`
      INSERT INTO work_order_receipt_claims (
        id, installment_id, work_order_id, engineer_id, claimed_amount, status,
        confirmed_amount, decided_by, decided_at, idempotency_key
      ) VALUES (
        'claim-race', 'installment-baseline-1', 'wo-quote-1', 'engineer-1', 6000,
        'confirmed', 6000, 'admin', datetime('now'), 'claim-race'
      );
    `);
  });

  const replacement = await submitQuote(ctx);

  assert.equal(replacement.response.status, 409);
  assert.equal(ctx.db.prepare('SELECT quote_version FROM work_order_pricing').get().quote_version, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_pricing_history').get().count, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_payment_schedule WHERE quote_version = 2').get().count, 0);
});

test('supplemental submission requires the active parent history to be a confirmed baseline', async () => {
  for (const parentMutation of [
    "UPDATE work_order_pricing_history SET quote_kind = 'supplemental' WHERE version = 1",
    "UPDATE work_order_pricing_history SET status = 'approved', confirmed_at = NULL WHERE version = 1",
  ]) {
    const ctx = createQuoteExecutionEnv();
    await confirmBaselineForReceiptTests(ctx);
    ctx.db.exec(parentMutation);

    const supplemental = await submitQuote(ctx, quotePayload({
      labor_fee: 1000,
      parts_fee: 500,
      travel_fee: 0,
      expected_service_days: 1,
      quote_kind: 'supplemental',
      parent_quote_version: 1,
      payment_plan_mode: 'single',
      payment_schedule: undefined,
    }));

    assert.equal(supplemental.response.status, 409);
    assert.equal(ctx.db.prepare('SELECT quote_version FROM work_order_pricing').get().quote_version, 1);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_pricing_history').get().count, 1);
  }
});

test('Admin detail includes the complete immutable schedule', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);

  const { response, json } = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET',
    userType: 'admin',
    userId: 'admin',
  });

  assert.equal(response.status, 200);
  assert.equal(json.pricing.quote_version, 1);
  assert.equal(json.pricing.expected_service_days, 3);
  assert.equal(json.pricing.payment_plan_mode, 'installments');
  assert.equal(json.pricing.payment_schedule.length, 2);
});

test('Admin review messages follow the request market', async () => {
  const ctx = createQuoteExecutionEnv({ market: 'cn' });
  const payload = quotePayload({
    payment_schedule: quotePayload().payment_schedule.map((row) => ({ ...row, currency: 'CNY' })),
  });
  await submitQuote(ctx, payload);

  const { response, json } = await reviewQuote(ctx, 'reject', 1, '请补充验收节点说明。');

  assert.equal(response.status, 200);
  assert.match(json.message, /报价/);
  assert.doesNotMatch(json.message, /Quote/);
});
