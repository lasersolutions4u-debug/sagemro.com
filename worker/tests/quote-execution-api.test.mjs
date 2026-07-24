import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

function createD1Database(db) {
  function statement(sql) {
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
        const result = db.prepare(sql).run(...this.args);
        return { success: true, meta: { changes: result.changes } };
      },
    };
  }

  return {
    prepare: statement,
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const prepared of statements) results.push(await prepared.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function createQuoteExecutionEnv({ market = 'com' } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
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

  return {
    db,
    env: {
      JWT_SECRET: 'test-secret-with-enough-length',
      DB: createD1Database(db),
      KV: {
        async get() { return null; },
        async put() {},
        async delete() {},
      },
    },
    origin: market === 'cn' ? 'https://sagemro.cn' : 'https://sagemro.com',
    host: market === 'cn' ? 'https://api.sagemro.cn' : 'https://api.sagemro.com',
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
    SELECT after_state FROM audit_logs
    WHERE target_id = ? AND action = 'pricing_submitted_for_review'
  `).get('wo-quote-1');
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

test('confirmed receipts block baseline replacement but allow a linked supplemental quote', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  ctx.db.exec(`
    UPDATE work_orders SET active_quote_version = 1 WHERE id = 'wo-quote-1';
    UPDATE work_order_pricing_history SET status = 'confirmed', confirmed_at = datetime('now')
    WHERE version = 1;
    INSERT INTO work_order_installments (
      id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start, status, received_amount
    ) SELECT
      'installment-baseline-1', id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start, 'received', amount
    FROM work_order_payment_schedule WHERE work_order_id = 'wo-quote-1' AND sequence = 1;
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

  const approval = await reviewQuote(ctx, 'approve', 2);
  assert.equal(approval.response.status, 200);
  assert.equal(approval.json.quote.quote_kind, 'supplemental');
  assert.equal(approval.json.quote.parent_quote_version, 1);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_pricing_history WHERE version = 1').get().status, 'confirmed');
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
