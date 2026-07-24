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
        hooks.binds.push({ sql: normalizeSql(sql), count: args.length });
        return this;
      },
      async first() {
        const row = db.prepare(sql).get(...this.args) || null;
        if (row && hooks.receiptEvidenceFileName !== undefined
          && /FROM work_order_receipt_evidence evidence/i.test(normalizeSql(sql))) {
          row.file_name = hooks.receiptEvidenceFileName;
        }
        return row;
      },
      async all() {
        if (/SELECT \* FROM work_order_payments WHERE work_order_id = \?/i.test(normalizeSql(sql))
          && hooks.legacyPaymentRows) {
          return { results: hooks.legacyPaymentRows };
        }
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
      const afterCommit = hooks.afterNextBatchCommit;
      hooks.afterNextBatchCommit = null;
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const prepared of statements) results.push(prepared.runSync());
        db.exec('COMMIT');
        if (afterCommit) await afterCommit();
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function createQuoteExecutionEnv({
  market = 'com', filename = ':memory:', initialize = true, sharedEvidenceObjects = null,
} = {}) {
  const db = new DatabaseSync(filename);
  const evidenceObjects = sharedEvidenceObjects || new Map();
  const hooks = {
    beforeNextBatch: null,
    afterNextBatchCommit: null,
    queries: [],
    binds: [],
    waitUntil: [],
    failEvidencePut: false,
    evidencePutStoresThenThrows: false,
    failEvidenceDelete: false,
    receiptEvidenceFileName: undefined,
  };
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
      FIELD_EVIDENCE: {
        async put(key, value, options = {}) {
          if (hooks.failEvidencePut) throw new Error('evidence upload failed');
          const bytes = value instanceof Uint8Array
            ? value
            : new Uint8Array(await new Response(value).arrayBuffer());
          evidenceObjects.set(key, {
            bytes,
            httpMetadata: options.httpMetadata || {},
          });
          if (hooks.evidencePutStoresThenThrows) throw new Error('evidence upload outcome unknown');
        },
        async get(key) {
          const object = evidenceObjects.get(key);
          if (!object) return null;
          return { body: object.bytes };
        },
        async head(key) {
          return evidenceObjects.has(key) ? {} : null;
        },
        async delete(key) {
          if (hooks.failEvidenceDelete) throw new Error('evidence delete failed');
          evidenceObjects.delete(key);
        },
      },
    },
    origin: market === 'cn' ? 'https://sagemro.cn' : 'https://sagemro.com',
    host: market === 'cn' ? 'https://api.sagemro.cn' : 'https://api.sagemro.com',
    beforeNextBatch(callback) {
      hooks.beforeNextBatch = callback;
    },
    afterNextBatchCommit(callback) {
      hooks.afterNextBatchCommit = callback;
    },
    resetQueries() {
      hooks.queries.length = 0;
      hooks.binds.length = 0;
    },
    queries() {
      return [...hooks.queries];
    },
    binds() {
      return [...hooks.binds];
    },
    waitUntilPromises() {
      return [...hooks.waitUntil];
    },
    captureWaitUntil(promise) {
      hooks.waitUntil.push(promise);
    },
    setLegacyPaymentRows(rows) {
      hooks.legacyPaymentRows = rows;
    },
    failEvidencePut(value = true) {
      hooks.failEvidencePut = value;
    },
    evidencePutStoresThenThrows(value = true) {
      hooks.evidencePutStoresThenThrows = value;
    },
    failEvidenceDelete(value = true) {
      hooks.failEvidenceDelete = value;
    },
    setReceiptEvidenceFileName(value) {
      hooks.receiptEvidenceFileName = value;
    },
    evidenceKeys() {
      return [...evidenceObjects.keys()];
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

async function token(env, userType, userId, market = 'com', { staffId, staffRole } = {}) {
  return signJwt({
    userId,
    userType,
    market,
    staffId,
    staffRole,
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
  staffId,
  staffRole,
  headers = {},
} = {}) {
  const market = ctx.host.endsWith('.cn') ? 'cn' : 'com';
  const jwt = await token(ctx.env, userType, userId, market, { staffId, staffRole });
  const response = await worker.fetch(new Request(`${ctx.host}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: ctx.origin,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), ctx.env, { waitUntil(promise) { ctx.captureWaitUntil(promise); } });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function multipartApi(ctx, path, fields, {
  userType = 'engineer',
  userId = 'engineer-1',
} = {}) {
  const market = ctx.host.endsWith('.cn') ? 'cn' : 'com';
  const jwt = await token(ctx.env, userType, userId, market);
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) body.set(key, value);
  }
  const response = await worker.fetch(new Request(`${ctx.host}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Origin: ctx.origin,
    },
    body,
  }), ctx.env, { waitUntil(promise) { ctx.captureWaitUntil(promise); } });
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

async function activateBaseline(ctx, body = quotePayload()) {
  await submitQuote(ctx, body);
  await reviewQuote(ctx, 'approve', 1);
  const confirmed = await confirmQuote(ctx, 1);
  assert.equal(confirmed.response.status, 200, JSON.stringify(confirmed.json));
}

async function confirmBaselineForReceiptTests(ctx) {
  // Test fixture only: Task 4 owns customer activation and installment creation.
  const currency = ctx.host.endsWith('.cn') ? 'CNY' : 'USD';
  await submitQuote(ctx, quotePayload({
    payment_schedule: quotePayload().payment_schedule.map((row) => ({ ...row, currency })),
  }));
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

function installment(ctx) {
  return ctx.db.prepare(`
    SELECT * FROM work_order_installments
    WHERE work_order_id = 'wo-quote-1' AND sequence = 1
  `).get();
}

function installments(ctx) {
  return ctx.db.prepare(`
    SELECT * FROM work_order_installments
    WHERE work_order_id = 'wo-quote-1'
    ORDER BY sequence
  `).all();
}

async function startCollection(ctx, options = {}) {
  const row = installment(ctx);
  return api(ctx, `/api/workorders/wo-quote-1/installments/${row.id}/collect`, options);
}

async function selectPaymentMethod(ctx, paymentMethod = 'bank_transfer', options = {}) {
  const row = installment(ctx);
  return api(ctx, `/api/workorders/wo-quote-1/installments/${row.id}/payment-method`, {
    body: { payment_method: paymentMethod },
    userType: 'customer',
    userId: 'customer-1',
    ...options,
  });
}

async function submitReceiptClaim(ctx, fields = {}, options = {}) {
  const row = installment(ctx);
  return multipartApi(ctx, `/api/workorders/wo-quote-1/installments/${row.id}/receipt-claims`, {
    claimed_amount: '2000',
    transaction_reference: 'TX-RECEIPT-1',
    note: 'Bank receipt submitted',
    idempotency_key: 'claim-key-1',
    ...fields,
  }, options);
}

async function decideReceiptClaim(ctx, claimId, fields = {}, options = {}) {
  const row = installment(ctx);
  return api(ctx, `/api/admin/workorders/wo-quote-1/installments/${row.id}/receipt-claims/${claimId}/decision`, {
    body: {
      decision: 'confirmed',
      confirmed_amount: 2000,
      reason: 'Matched bank receipt',
      idempotency_key: 'decision-key-1',
      ...fields,
    },
    userType: 'admin',
    userId: 'admin',
    ...options,
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

test('onsite conversion remains successful when its post-commit notification fails', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    UPDATE work_orders
    SET service_mode = 'hybrid', onsite_conversion_status = 'requested',
      active_quote_version = 1, quote_expected_service_days = 4
    WHERE id = 'wo-quote-1';
    CREATE TRIGGER fail_onsite_conversion_notification
    BEFORE INSERT ON notifications
    WHEN NEW.type = 'onsite_conversion_confirmed'
    BEGIN
      SELECT RAISE(ABORT, 'forced onsite conversion notification failure');
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
  await Promise.allSettled(ctx.waitUntilPromises());

  assert.equal(converted.response.status, 200);
  assert.equal(ctx.waitUntilPromises().length, 1);
  assert.equal(ctx.db.prepare('SELECT service_mode FROM work_orders').get().service_mode, 'onsite');
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM work_order_logs WHERE action = 'onsite_conversion_confirmed'").get().count, 1);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'onsite_conversion_confirmed'").get().count, 1);
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

test('active execution keeps receipt-claim query binds fixed across many supplementals', async () => {
  const ctx = createQuoteExecutionEnv();
  await submitQuote(ctx);
  await reviewQuote(ctx, 'approve', 1);
  await confirmQuote(ctx, 1);
  for (const [version, amount] of [[2, 1500], [3, 700], [4, 600], [5, 500], [6, 400]]) {
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
  const latestInstallment = ctx.db.prepare(
    'SELECT id FROM work_order_installments WHERE quote_version = 6'
  ).get();
  ctx.db.prepare(`
    INSERT INTO work_order_receipt_claims (
      id, installment_id, work_order_id, engineer_id, claimed_amount,
      status, idempotency_key
    ) VALUES ('claim-v6', ?, 'wo-quote-1', 'engineer-1', 400, 'pending', 'claim-v6')
  `).run(latestInstallment.id);
  ctx.resetQueries();

  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });

  assert.equal(detail.response.status, 200);
  assert.deepEqual(detail.json.quote_execution.installments.map((row) => row.quote_version), [1, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(detail.json.quote_execution.receipt_claims.map((row) => row.id), ['claim-v6']);
  const claimBinds = ctx.binds().filter(({ sql }) => /FROM work_order_receipt_claims/i.test(sql));
  assert.equal(claimBinds.length, 1);
  assert.equal(claimBinds[0].count, 1);
});

test('receipt claims use role-facing allowlists without idempotency or Admin identity leaks', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role)
    VALUES
      ('lead-1', 'E000002', 'Assigned Regional Lead', '13800000002', 'hash', 'regional_lead'),
      ('lead-2', 'E000003', 'Unassigned Regional Lead', '13800000003', 'hash', 'regional_lead');
    INSERT INTO admin_staff_accounts (
      id, normalized_login, password_hash, salt, role, display_name, market_scope, must_change_password
    ) VALUES (
      'operations-1', 'operations@example.com', 'hash', 'salt', 'operations', 'Operations', 'all', 0
    ), (
      'warehouse-1', 'warehouse@example.com', 'hash', 'salt', 'warehouse', 'Warehouse', 'all', 0
    );
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
  ctx.db.prepare(`
    INSERT INTO work_order_receipt_evidence (
      id, claim_id, work_order_id, object_key, file_name, mime_type, file_size,
      uploader_type, uploader_id, created_at
    ) VALUES (
      'evidence-detail-1', 'claim-detail-1', 'wo-quote-1', 'private/receipt-detail.pdf',
      'bank receipt.pdf', 'application/pdf', 321, 'engineer', 'engineer-1', '2026-07-24 12:00:00'
    )
  `).run();

  for (const [userType, userId, auth] of [
    ['customer', 'customer-1', {}],
    ['engineer', 'engineer-1', {}],
    ['admin', 'admin', {}],
    ['admin', 'operations-1', { staffId: 'operations-1', staffRole: 'operations' }],
  ]) {
    const detail = await api(ctx, '/api/workorders/wo-quote-1', { method: 'GET', userType, userId, ...auth });
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
    assert.deepEqual(claim.evidence, {
      id: 'evidence-detail-1',
      file_name: 'bank receipt.pdf',
      mime_type: 'application/pdf',
      file_size: 321,
      created_at: '2026-07-24 12:00:00',
      url: '/api/workorders/wo-quote-1/receipt-evidence/evidence-detail-1',
    });
    assert.equal(Object.hasOwn(claim.evidence, 'object_key'), false);
    assert.equal(Object.hasOwn(claim.evidence, 'uploader_id'), false);
    assert.equal(Object.hasOwn(claim.evidence, 'uploader_type'), false);
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

  const regionalLeadDetail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'engineer', userId: 'lead-1',
  });
  assert.equal(regionalLeadDetail.response.status, 200);
  assert.equal(Object.hasOwn(regionalLeadDetail.json.quote_execution.receipt_claims[0], 'evidence'), false);
  assert.equal(JSON.stringify(regionalLeadDetail.json).includes('evidence-detail-1'), false);
  assert.equal(JSON.stringify(regionalLeadDetail.json).includes('private/receipt-detail.pdf'), false);

  const unassignedLeadDetail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'engineer', userId: 'lead-2',
  });
  assert.equal(unassignedLeadDetail.response.status, 403);
  assert.equal(JSON.stringify(unassignedLeadDetail.json).includes('evidence-detail-1'), false);
});

test('quote execution detail shares valid consumed field days across customer, engineer, and Admin views', async () => {
  const ctx = createQuoteExecutionEnv();
  await activateBaseline(ctx, quotePayload({ expected_service_days: 2 }));
  ctx.db.exec(`
    INSERT INTO engineers (id, user_no, name, phone, password_hash, level, commission_rate)
    VALUES ('engineer-2', 'E000002', 'Second Engineer', '13800000002', 'hash', 'senior', 0.85);
    INSERT INTO work_order_field_days (
      id, work_order_id, engineer_id, site_local_date, site_timezone, status, check_in_at
    ) VALUES
      ('field-valid-1', 'wo-quote-1', 'engineer-1', '2026-07-21', 'Asia/Shanghai', 'report_submitted', '2026-07-21T01:00:00Z'),
      ('field-duplicate', 'wo-quote-1', 'engineer-2', '2026-07-21', 'Asia/Shanghai', 'late_report_submitted', '2026-07-21T02:00:00Z'),
      ('field-valid-2', 'wo-quote-1', 'engineer-1', '2026-07-22', 'Asia/Shanghai', 'late_report_submitted', '2026-07-22T01:00:00Z'),
      ('field-checked-in', 'wo-quote-1', 'engineer-1', '2026-07-23', 'Asia/Shanghai', 'checked_in', '2026-07-23T01:00:00Z'),
      ('field-overdue', 'wo-quote-1', 'engineer-1', '2026-07-24', 'Asia/Shanghai', 'report_overdue', '2026-07-24T01:00:00Z'),
      ('field-invalid-check-in', 'wo-quote-1', 'engineer-1', '2026-07-25', 'Asia/Shanghai', 'report_submitted', 'invalid'),
      ('field-invalid-date', 'wo-quote-1', 'engineer-1', 'invalid', 'Asia/Shanghai', 'report_submitted', '2026-07-26T01:00:00Z');
  `);

  for (const [userType, userId] of [
    ['customer', 'customer-1'],
    ['engineer', 'engineer-1'],
    ['admin', 'admin'],
  ]) {
    ctx.resetQueries();
    const detail = await api(ctx, '/api/workorders/wo-quote-1', { method: 'GET', userType, userId });

    assert.equal(detail.response.status, 200);
    assert.equal(detail.json.quote_execution.consumed_workdays, 2);
    assert.equal(detail.json.quote_execution.remaining_workdays, 0);
    assert.equal(detail.json.quote_execution.allowance_exhausted, true);
    assert.equal(ctx.queries().filter((sql) => (
      /SELECT site_local_date, status, check_in_at FROM work_order_field_days WHERE work_order_id = \?/i.test(sql)
    )).length, 1);
  }
});

test('assigned engineer opens scheduled trigger installments and owning customer controls payment method', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  const row = installment(ctx);

  const wrongEngineer = await startCollection(ctx, { userId: 'engineer-2' });
  assert.equal(wrongEngineer.response.status, 403);

  ctx.db.prepare("UPDATE work_order_installments SET status = 'scheduled' WHERE id = ?").run(row.id);
  const scheduled = await startCollection(ctx);
  assert.equal(scheduled.response.status, 200);
  assert.equal(scheduled.json.installment.status, 'collecting');

  for (const state of ['due', 'partially_received', 'overdue']) {
    ctx.db.prepare(`
      UPDATE work_order_installments
      SET status = ?, received_amount = ?, collection_started_at = NULL
      WHERE id = ?
    `).run(state, state === 'partially_received' ? 1000 : 0, row.id);
    const opened = await startCollection(ctx);
    assert.equal(opened.response.status, 200, state);
    assert.equal(opened.json.installment.id, row.id);
    assert.equal(opened.json.installment.status, state === 'partially_received' ? 'partially_received' : 'collecting');
    assert.ok(ctx.db.prepare('SELECT collection_started_at FROM work_order_installments WHERE id = ?').get(row.id).collection_started_at);
  }

  const engineerMethod = await selectPaymentMethod(ctx, 'bank_transfer', { userType: 'engineer', userId: 'engineer-1' });
  assert.equal(engineerMethod.response.status, 403);
  const wrongCustomer = await selectPaymentMethod(ctx, 'bank_transfer', { userId: 'customer-2' });
  assert.equal(wrongCustomer.response.status, 403);

  const selected = await selectPaymentMethod(ctx, 'bank_transfer');
  assert.equal(selected.response.status, 200);
  assert.equal(selected.json.installment.payment_method, 'bank_transfer');
  const changed = await selectPaymentMethod(ctx, 'wire_transfer');
  assert.equal(changed.response.status, 200);
  assert.equal(changed.json.installment.payment_method, 'wire_transfer');

  ctx.db.prepare("UPDATE work_order_installments SET status = 'received', received_amount = amount WHERE id = ?").run(row.id);
  const closed = await selectPaymentMethod(ctx, 'bank_transfer');
  assert.equal(closed.response.status, 409);

  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'installment_collection_started'").get().count, 4);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'installment_payment_method_selected'").get().count, 2);
  assert.ok(ctx.db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'installment_collection_started'").get().count >= 1);
});

test('customer selects payment method only after collection opens and outside Admin review', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  const row = installment(ctx);
  const allowed = new Set(['collecting', 'partially_received', 'overdue']);

  for (const state of ['scheduled', 'due', 'collecting', 'pending_confirmation', 'partially_received', 'overdue', 'received']) {
    ctx.db.prepare(`
      UPDATE work_order_installments
      SET status = ?, received_amount = ?, payment_method = NULL
      WHERE id = ?
    `).run(
      state,
      state === 'partially_received' ? 1000 : state === 'received' ? row.amount : 0,
      row.id,
    );

    const result = await selectPaymentMethod(ctx, 'bank_transfer');
    assert.equal(result.response.status, allowed.has(state) ? 200 : 409, state);
    assert.equal(
      ctx.db.prepare('SELECT payment_method FROM work_order_installments WHERE id = ?').get(row.id).payment_method,
      allowed.has(state) ? 'bank_transfer' : null,
      state,
    );
  }
});

test('receipt claim validates input, stores private PDF evidence, streams by work-order access, and retries idempotently', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role)
    VALUES
      ('lead-1', 'E000002', 'Assigned Regional Lead', '13800000002', 'hash', 'regional_lead'),
      ('lead-2', 'E000003', 'Unassigned Regional Lead', '13800000003', 'hash', 'regional_lead');
    INSERT INTO admin_staff_accounts (
      id, normalized_login, password_hash, salt, role, display_name, market_scope, must_change_password
    ) VALUES (
      'operations-1', 'operations@example.com', 'hash', 'salt', 'operations', 'Operations', 'all', 0
    ), (
      'warehouse-1', 'warehouse@example.com', 'hash', 'salt', 'warehouse', 'Warehouse', 'all', 0
    );
    UPDATE work_orders SET assigned_regional_lead_id = 'lead-1' WHERE id = 'wo-quote-1';
  `);
  await confirmBaselineForReceiptTests(ctx);
  await startCollection(ctx);

  const nonPositive = await submitReceiptClaim(ctx, { claimed_amount: '0' });
  assert.equal(nonPositive.response.status, 400);
  const missingKey = await submitReceiptClaim(ctx, { idempotency_key: '' });
  assert.equal(missingKey.response.status, 400);

  const evidence = new File([
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]),
  ], 'receipt.pdf', { type: 'application/pdf' });
  const submitted = await submitReceiptClaim(ctx, { evidence });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.json.claim.status, 'pending');
  assert.equal(Object.hasOwn(submitted.json.claim, 'idempotency_key'), false);
  assert.equal(Object.hasOwn(submitted.json.evidence, 'object_key'), false);
  assert.match(submitted.json.evidence.url, /^\/api\/workorders\/wo-quote-1\/receipt-evidence\//);
  assert.equal(ctx.evidenceKeys().length, 1);
  assert.match(ctx.evidenceKeys()[0], /^field-evidence\/com\/wo-quote-1\/receipt-claims\//);
  assert.equal(installment(ctx).status, 'pending_confirmation');

  const repeated = await submitReceiptClaim(ctx, { evidence });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.json.claim.id, submitted.json.claim.id);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_claims').get().count, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_evidence').get().count, 1);
  assert.equal(ctx.evidenceKeys().length, 1);

  const evidencePath = submitted.json.evidence.url;
  for (const [userType, userId] of [
    ['customer', 'customer-1'],
    ['engineer', 'engineer-1'],
    ['admin', 'admin'],
  ]) {
    const streamed = await api(ctx, evidencePath, { method: 'GET', userType, userId });
    assert.equal(streamed.response.status, 200, `${userType}:${userId}`);
    assert.equal(streamed.response.headers.get('content-type'), 'application/pdf');
    assert.equal(streamed.response.headers.get('cache-control'), 'private, no-store');
    assert.equal(streamed.response.headers.has('location'), false);
  }
  const operations = await api(ctx, evidencePath, {
    method: 'GET', userType: 'admin', userId: 'operations-1',
    staffId: 'operations-1', staffRole: 'operations',
  });
  assert.equal(operations.response.status, 200);
  assert.equal(operations.response.headers.get('cache-control'), 'private, no-store');
  const operationsWrite = await api(ctx, evidencePath, {
    method: 'POST', userType: 'admin', userId: 'operations-1',
    staffId: 'operations-1', staffRole: 'operations',
  });
  assert.equal(operationsWrite.response.status, 403);
  const warehouse = await api(ctx, evidencePath, {
    method: 'GET', userType: 'admin', userId: 'warehouse-1',
    staffId: 'warehouse-1', staffRole: 'warehouse',
  });
  assert.equal(warehouse.response.status, 403);
  for (const [userType, userId] of [
    ['customer', 'customer-2'],
    ['engineer', 'engineer-2'],
    ['engineer', 'lead-1'],
    ['engineer', 'lead-2'],
  ]) {
    const denied = await api(ctx, evidencePath, { method: 'GET', userType, userId });
    assert.equal(denied.response.status, 403, `${userType}:${userId}`);
  }
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'installment_receipt_claim_submitted'").get().count, 1);
});

test('receipt claim recovers an ambiguous committed batch without deleting evidence or notifications', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec(`
    INSERT INTO admin_staff_accounts (
      id, normalized_login, password_hash, salt, role, display_name, market_scope, must_change_password
    ) VALUES (
      'operations-1', 'operations@example.com', 'hash', 'salt', 'operations', 'Operations', 'all', 0
    );
  `);
  await confirmBaselineForReceiptTests(ctx);
  await startCollection(ctx);
  ctx.afterNextBatchCommit(() => { throw new Error('D1 outcome unknown after commit'); });
  const evidence = new File([
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]),
  ], 'committed.pdf', { type: 'application/pdf' });

  const submitted = await submitReceiptClaim(ctx, { evidence, idempotency_key: 'claim-ambiguous-commit' });

  assert.equal(submitted.response.status, 200);
  assert.equal(ctx.evidenceKeys().length, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM field_evidence_cleanup_queue').get().count, 0);
  assert.equal(ctx.db.prepare(`
    SELECT COUNT(*) AS count FROM notifications
    WHERE type IN ('installment_receipt_claim_submitted', 'installment_receipt_review_requested')
  `).get().count, 2);
  const streamed = await api(ctx, submitted.json.evidence.url, {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(streamed.response.status, 200);
});

test('receipt claim idempotency matches the full canonical payload across shared D1 and R2', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sagemro-receipt-idempotency-'));
  const filename = join(directory, 'quote-execution.sqlite');
  const sharedEvidenceObjects = new Map();
  const first = createQuoteExecutionEnv({ filename, sharedEvidenceObjects });
  const second = createQuoteExecutionEnv({ filename, initialize: false, sharedEvidenceObjects });
  const exactEvidence = new File([
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]),
  ], 'receipt.pdf', { type: 'application/pdf' });
  const changedEvidence = new File([
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0a]),
  ], 'receipt.pdf', { type: 'application/pdf' });

  try {
    await confirmBaselineForReceiptTests(first);
    await startCollection(first);
    const created = await submitReceiptClaim(first, {
      evidence: exactEvidence,
      claimed_amount: '2000',
      transaction_reference: '  TX-CANONICAL  ',
      note: '  Bank receipt submitted  ',
      idempotency_key: 'claim-shared-exact',
    });
    assert.equal(created.response.status, 201);
    const objectKey = first.evidenceKeys()[0];
    assert.match(objectKey, /sha256-[a-f0-9]{64}/);

    const exactRetry = await submitReceiptClaim(second, {
      evidence: exactEvidence,
      claimed_amount: '2000',
      transaction_reference: 'TX-CANONICAL',
      note: 'Bank receipt submitted',
      idempotency_key: 'claim-shared-exact',
    });
    assert.equal(exactRetry.response.status, 200);
    assert.equal(second.evidenceKeys().length, 1);
    assert.equal(exactRetry.json.claim.id, created.json.claim.id);

    for (const fields of [
      { claimed_amount: '2001', evidence: exactEvidence },
      { transaction_reference: 'TX-DIFFERENT', evidence: exactEvidence },
      { note: 'Different note', evidence: exactEvidence },
      { evidence: changedEvidence },
      { evidence: undefined },
    ]) {
      const conflict = await submitReceiptClaim(second, {
        claimed_amount: '2000',
        transaction_reference: 'TX-CANONICAL',
        note: 'Bank receipt submitted',
        idempotency_key: 'claim-shared-exact',
        ...fields,
      });
      assert.equal(conflict.response.status, 409, JSON.stringify(Object.keys(fields)));
      assert.deepEqual(second.evidenceKeys(), [objectKey]);
    }
  } finally {
    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('receipt evidence Content-Disposition safely represents quotes controls and Unicode', async () => {
  for (const [name, expected] of [
    ['bank "receipt".pdf', /filename="bank \\"receipt\\"\.pdf"/],
    ['bank\r\nX-Injected: yes.pdf', /filename="bankX-Injected: yes\.pdf"/],
    ['银行回单.pdf', /filename\*=UTF-8''%E9%93%B6%E8%A1%8C%E5%9B%9E%E5%8D%95\.pdf/],
    [`${'a'.repeat(254)}😀.pdf`, /filename\*=UTF-8''a+%F0%9F%98%80/],
  ]) {
    const ctx = createQuoteExecutionEnv();
    await confirmBaselineForReceiptTests(ctx);
    await startCollection(ctx);
    const evidence = new File([
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]),
    ], name, { type: 'application/pdf' });
    const submitted = await submitReceiptClaim(ctx, { evidence, idempotency_key: `filename-${name}` });
    const streamed = await api(ctx, submitted.json.evidence.url, {
      method: 'GET', userType: 'customer', userId: 'customer-1',
    });
    const disposition = streamed.response.headers.get('content-disposition');
    assert.equal(streamed.response.status, 200);
    assert.match(disposition, expected);
    assert.equal(/[\r\n]/.test(disposition), false);
  }
});

test('receipt evidence Content-Disposition replaces malformed legacy surrogates', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  await startCollection(ctx);
  const evidence = new File([
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]),
  ], 'receipt.pdf', { type: 'application/pdf' });
  const submitted = await submitReceiptClaim(ctx, { evidence, idempotency_key: 'legacy-surrogate' });
  ctx.setReceiptEvidenceFileName('legacy-\ud800.pdf');

  const streamed = await api(ctx, submitted.json.evidence.url, {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  const disposition = streamed.response.headers.get('content-disposition');
  assert.equal(streamed.response.status, 200);
  assert.match(disposition, /filename\*=UTF-8''legacy-%EF%BF%BD\.pdf/);
  assert.equal(/[\r\n]/.test(disposition), false);
});

test('receipt evidence failures leave no new claim and enqueue cleanup when rollback deletion fails', async () => {
  {
    const ctx = createQuoteExecutionEnv();
    await confirmBaselineForReceiptTests(ctx);
    await startCollection(ctx);
    ctx.failEvidencePut();

    const failed = await submitReceiptClaim(ctx, {
      evidence: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'receipt.jpg', { type: 'image/jpeg' }),
    });

    assert.equal(failed.response.status, 500);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_claims').get().count, 0);
    assert.equal(ctx.evidenceKeys().length, 0);
  }

  {
    const ctx = createQuoteExecutionEnv();
    await confirmBaselineForReceiptTests(ctx);
    await startCollection(ctx);
    const originalBatch = ctx.env.DB.batch;
    ctx.env.DB.batch = async () => { throw new Error('receipt persistence failed'); };

    const failed = await submitReceiptClaim(ctx, {
      evidence: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'receipt.jpg', { type: 'image/jpeg' }),
    });

    assert.equal(failed.response.status, 500);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_claims').get().count, 0);
    assert.equal(ctx.evidenceKeys().length, 0);
    ctx.env.DB.batch = originalBatch;
  }

  {
    const ctx = createQuoteExecutionEnv();
    await confirmBaselineForReceiptTests(ctx);
    await startCollection(ctx);
    ctx.failEvidenceDelete();
    ctx.env.DB.batch = async () => { throw new Error('receipt persistence failed'); };

    const failed = await submitReceiptClaim(ctx, {
      evidence: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'receipt.jpg', { type: 'image/jpeg' }),
    });

    assert.equal(failed.response.status, 500);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_claims').get().count, 0);
    assert.equal(ctx.evidenceKeys().length, 1);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM field_evidence_cleanup_queue').get().count, 1);
  }
});

test('uncertain R2 put outcomes are deleted or queued without persisting receipt rows', async () => {
  for (const deleteFails of [false, true]) {
    const ctx = createQuoteExecutionEnv();
    await confirmBaselineForReceiptTests(ctx);
    await startCollection(ctx);
    ctx.evidencePutStoresThenThrows();
    ctx.failEvidenceDelete(deleteFails);

    const failed = await submitReceiptClaim(ctx, {
      evidence: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'receipt.jpg', { type: 'image/jpeg' }),
      idempotency_key: `uncertain-put-${deleteFails}`,
    });

    assert.equal(failed.response.status, 500, String(deleteFails));
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_claims').get().count, 0);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_evidence').get().count, 0);
    assert.equal(ctx.evidenceKeys().length, deleteFails ? 1 : 0);
    assert.equal(
      ctx.db.prepare('SELECT COUNT(*) AS count FROM field_evidence_cleanup_queue').get().count,
      deleteFails ? 1 : 0,
    );
  }
});

test('receipt claims notify active Admin staff in the request market after commit', async () => {
  const ctx = createQuoteExecutionEnv({ market: 'cn' });
  ctx.db.exec(`
    INSERT INTO admin_staff_accounts (
      id, normalized_login, password_hash, salt, role, display_name, market_scope, must_change_password
    ) VALUES
      ('admin-cn', 'admin-cn@example.com', 'hash', 'salt', 'admin', 'CN Admin', 'cn', 0),
      ('ops-all', 'ops-all@example.com', 'hash', 'salt', 'operations', 'Global Ops', 'all', 0),
      ('admin-com', 'admin-com@example.com', 'hash', 'salt', 'admin', 'COM Admin', 'com', 0),
      ('admin-disabled', 'disabled@example.com', 'hash', 'salt', 'admin', 'Disabled', 'cn', 0);
    UPDATE admin_staff_accounts SET is_active = 0 WHERE id = 'admin-disabled';
  `);
  await confirmBaselineForReceiptTests(ctx);
  await startCollection(ctx);

  const submitted = await submitReceiptClaim(ctx);

  assert.equal(submitted.response.status, 201);
  const alerts = ctx.db.prepare(`
    SELECT user_id, user_type, title, body, data FROM notifications
    WHERE type = 'installment_receipt_review_requested' ORDER BY user_id
  `).all().map((row) => ({ ...row }));
  assert.deepEqual(alerts.map((row) => row.user_id), ['admin-cn', 'ops-all']);
  assert.ok(alerts.every((row) => row.user_type === 'admin'));
  assert.ok(alerts.every((row) => /到账|收款|工单/.test(`${row.title}${row.body}`)));
  assert.ok(alerts.every((row) => !/receipt|work order|review/i.test(`${row.title}${row.body}`)));
  assert.ok(alerts.every((row) => JSON.parse(row.data).claim_id === submitted.json.claim.id));
});

test('Admin receipt decisions are atomic, partial-aware, idempotent, and cannot over-confirm', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  await startCollection(ctx);
  const firstClaim = await submitReceiptClaim(ctx);

  const partial = await decideReceiptClaim(ctx, firstClaim.json.claim.id);
  assert.equal(partial.response.status, 200);
  assert.equal(partial.json.claim.status, 'confirmed');
  assert.equal(partial.json.installment.received_amount, 2000);
  assert.equal(partial.json.installment.status, 'partially_received');

  const duplicate = await decideReceiptClaim(ctx, firstClaim.json.claim.id);
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.json.installment.received_amount, 2000);
  const stale = await decideReceiptClaim(ctx, firstClaim.json.claim.id, { idempotency_key: 'decision-key-stale' });
  assert.equal(stale.response.status, 409);
  assert.equal(installment(ctx).received_amount, 2000);

  const secondClaim = await submitReceiptClaim(ctx, {
    claimed_amount: '3000',
    idempotency_key: 'claim-key-2',
  });
  assert.equal(secondClaim.response.status, 201);
  const aboveClaim = await decideReceiptClaim(ctx, secondClaim.json.claim.id, {
    confirmed_amount: 3500,
    idempotency_key: 'decision-key-2',
  });
  assert.equal(aboveClaim.response.status, 409);
  assert.equal(installment(ctx).received_amount, 2000);
  assert.equal(ctx.db.prepare('SELECT status FROM work_order_receipt_claims WHERE id = ?').get(secondClaim.json.claim.id).status, 'pending');

  const missingReason = await decideReceiptClaim(ctx, secondClaim.json.claim.id, {
    decision: 'rejected', reason: '', idempotency_key: 'decision-reject-2',
  });
  assert.equal(missingReason.response.status, 400);
  const rejected = await decideReceiptClaim(ctx, secondClaim.json.claim.id, {
    decision: 'rejected', confirmed_amount: undefined, reason: 'Amount does not match', idempotency_key: 'decision-reject-2',
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.json.installment.status, 'partially_received');
  assert.equal(rejected.json.installment.received_amount, 2000);

  const remainingBoundClaim = await submitReceiptClaim(ctx, {
    claimed_amount: '5000',
    idempotency_key: 'claim-key-remaining-bound',
  });
  const aboveRemaining = await decideReceiptClaim(ctx, remainingBoundClaim.json.claim.id, {
    confirmed_amount: 4500,
    idempotency_key: 'decision-key-over-remaining',
  });
  assert.equal(aboveRemaining.response.status, 409);
  assert.equal(installment(ctx).received_amount, 2000);
  const rejectRemainingBound = await decideReceiptClaim(ctx, remainingBoundClaim.json.claim.id, {
    decision: 'rejected', confirmed_amount: undefined,
    reason: 'Exceeds the remaining installment amount',
    idempotency_key: 'decision-reject-remaining-bound',
  });
  assert.equal(rejectRemainingBound.response.status, 200);

  const finalClaim = await submitReceiptClaim(ctx, {
    claimed_amount: '4000',
    idempotency_key: 'claim-key-3',
  });
  const full = await decideReceiptClaim(ctx, finalClaim.json.claim.id, {
    confirmed_amount: 4000,
    idempotency_key: 'decision-key-3',
  });
  assert.equal(full.response.status, 200);
  assert.equal(full.json.installment.received_amount, 6000);
  assert.equal(full.json.installment.status, 'received');
  assert.ok(full.json.installment.completed_at);

  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'installment_receipt_confirmed'").get().count, 2);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'installment_receipt_rejected'").get().count, 2);
  assert.ok(ctx.db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type IN ('installment_receipt_confirmed', 'installment_receipt_rejected')").get().count >= 4);
});

test('Admin decision key retries require an exact normalized decision payload', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  await startCollection(ctx);
  const submitted = await submitReceiptClaim(ctx, { claimed_amount: '2500' });
  const claimId = submitted.json.claim.id;

  const decided = await decideReceiptClaim(ctx, claimId, {
    confirmed_amount: 2000,
    reason: '  Matched bank receipt  ',
    idempotency_key: 'decision-exact-1',
  });
  assert.equal(decided.response.status, 200);
  assert.equal(installment(ctx).received_amount, 2000);

  const exactRetry = await decideReceiptClaim(ctx, claimId, {
    confirmed_amount: 2000,
    reason: 'Matched bank receipt',
    idempotency_key: 'decision-exact-1',
  });
  assert.equal(exactRetry.response.status, 200);
  assert.equal(installment(ctx).received_amount, 2000);

  for (const payload of [
    { decision: 'rejected', confirmed_amount: undefined, reason: 'Matched bank receipt' },
    { decision: 'confirmed', confirmed_amount: 1500, reason: 'Matched bank receipt' },
    { decision: 'confirmed', confirmed_amount: 2000, reason: 'Different reason' },
  ]) {
    const conflict = await decideReceiptClaim(ctx, claimId, {
      ...payload,
      idempotency_key: 'decision-exact-1',
    });
    assert.equal(conflict.response.status, 409, JSON.stringify(payload));
    assert.equal(installment(ctx).received_amount, 2000);
  }

  const stored = ctx.db.prepare('SELECT * FROM work_order_receipt_claims WHERE id = ?').get(claimId);
  assert.equal(stored.status, 'confirmed');
  assert.equal(stored.confirmed_amount, 2000);
  assert.equal(stored.decision_reason, 'Matched bank receipt');
  assert.equal(stored.decision_idempotency_key, 'decision-exact-1');
});

test('Admin decision recovers an ambiguous committed batch with deterministic notifications', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  await startCollection(ctx);
  const submitted = await submitReceiptClaim(ctx, {
    claimed_amount: '2500', idempotency_key: 'claim-decision-ambiguous',
  });
  ctx.afterNextBatchCommit(() => { throw new Error('D1 decision outcome unknown after commit'); });

  const decided = await decideReceiptClaim(ctx, submitted.json.claim.id, {
    confirmed_amount: 2000,
    reason: 'Matched bank receipt',
    idempotency_key: 'decision-ambiguous-commit',
  });

  assert.equal(decided.response.status, 200);
  assert.equal(decided.json.installment.received_amount, 2000);
  const notificationIds = ctx.db.prepare(`
    SELECT id FROM notifications
    WHERE type = 'installment_receipt_confirmed' ORDER BY id
  `).all().map((row) => row.id);
  assert.deepEqual(notificationIds, [
    `receipt-decision:${submitted.json.claim.id}:confirmed:customer:customer-1`,
    `receipt-decision:${submitted.json.claim.id}:confirmed:engineer:engineer-1`,
  ]);

  const retry = await decideReceiptClaim(ctx, submitted.json.claim.id, {
    confirmed_amount: 2000,
    reason: 'Matched bank receipt',
    idempotency_key: 'decision-ambiguous-commit',
  });
  assert.equal(retry.response.status, 200);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'installment_receipt_confirmed'").get().count, 2);
});

test('collection workflow errors and notifications follow the CN request market', async () => {
  const ctx = createQuoteExecutionEnv({ market: 'cn' });
  await confirmBaselineForReceiptTests(ctx);

  const denied = await startCollection(ctx, { userId: 'engineer-2' });
  assert.equal(denied.response.status, 403);
  assert.match(denied.json.error, /工程师|工单|指派/);

  const opened = await startCollection(ctx);
  assert.equal(opened.response.status, 200);
  const notification = ctx.db.prepare("SELECT title, body FROM notifications WHERE type = 'installment_collection_started' ORDER BY created_at DESC").get();
  assert.match(`${notification.title}${notification.body}`, /收款|付款|工单/);
  assert.doesNotMatch(`${notification.title}${notification.body}`, /collection|payment|work order/i);
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

test('legacy projection sums unique completed transactions and records across the same stage', async () => {
  const ctx = createQuoteExecutionEnv({ market: 'cn' });
  ctx.db.exec(`
    INSERT INTO work_order_pricing (
      id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee,
      subtotal, total_amount, status
    ) VALUES ('legacy-pricing', 'wo-quote-1', 'engineer-1', 3600, 1200, 400, 200, 5400, 5400, 'confirmed');
  `);
  ctx.setLegacyPaymentRows([
    { id: 'advance-partial-1', amount: 1200, status: 'completed', payment_stage: 'advance', transaction_id: 'TX-A' },
    { id: 'advance-duplicate', amount: 1200, status: 'completed', payment_stage: 'advance', transaction_id: 'TX-A' },
    { id: 'advance-partial-2', amount: 800, status: 'completed', payment_stage: 'advance', transaction_id: null },
    { id: 'advance-partial-3', amount: 600, status: 'completed', payment_stage: 'advance', transaction_id: null },
    { id: 'advance-pending', amount: 1000, status: 'pending', payment_stage: 'advance', transaction_id: 'TX-P' },
    { id: 'balance-failed', amount: 1000, status: 'failed', payment_stage: 'balance', transaction_id: 'TX-F' },
    { id: 'balance-complete', amount: 2800, status: 'completed', payment_stage: 'balance', transaction_id: 'TX-B' },
  ]);

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

test('pending receipt claims block baseline replacement until Admin decides them', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  ctx.db.exec(`
    INSERT INTO work_order_receipt_claims (
      id, installment_id, work_order_id, engineer_id, claimed_amount, status,
      idempotency_key
    ) VALUES (
      'claim-pending-replacement', 'installment-baseline-1', 'wo-quote-1',
      'engineer-1', 6000, 'pending', 'claim-pending-replacement'
    );
  `);

  const replacement = await submitQuote(ctx);

  assert.equal(replacement.response.status, 409);
  assert.equal(ctx.db.prepare('SELECT quote_version FROM work_order_pricing').get().quote_version, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_pricing_history').get().count, 1);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM work_order_payment_schedule WHERE quote_version = 2').get().count, 0);
});

test('pending baseline replacement preserves the active execution projection', async () => {
  const ctx = createQuoteExecutionEnv();
  await activateBaseline(ctx);

  const replacement = await submitQuote(ctx, quotePayload({
    labor_fee: 10000,
    parts_fee: 2000,
    travel_fee: 1000,
    expected_service_days: 4,
    payment_schedule: [
      {
        sequence: 1,
        amount: 7000,
        currency: 'USD',
        trigger_type: 'before_start',
        required_before_start: true,
        description: 'Replacement start payment',
      },
      {
        sequence: 2,
        amount: 6000,
        currency: 'USD',
        trigger_type: 'on_acceptance',
        required_before_start: false,
        description: 'Replacement acceptance payment',
      },
    ],
  }));
  assert.equal(replacement.response.status, 200);

  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });

  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.quote_execution.payment_state, 'unpaid');
  assert.equal(detail.json.quote_execution.active_quote_version, 1);
  assert.equal(detail.json.quote_execution.total_amount, 12000);
  assert.equal(detail.json.quote_execution.expected_service_days, 3);
  assert.deepEqual(
    detail.json.quote_execution.installments.map((row) => row.quote_version),
    [1, 1],
  );
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

test('baseline replacement fails when a receipt claim becomes pending between eligibility read and batch write', async () => {
  const ctx = createQuoteExecutionEnv();
  await confirmBaselineForReceiptTests(ctx);
  ctx.beforeNextBatch(() => {
    ctx.db.exec(`
      INSERT INTO work_order_receipt_claims (
        id, installment_id, work_order_id, engineer_id, claimed_amount, status,
        idempotency_key
      ) VALUES (
        'claim-pending-race', 'installment-baseline-1', 'wo-quote-1', 'engineer-1',
        6000, 'pending', 'claim-pending-race'
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

test('versioned start request waits for every required installment and keeps final Admin approval', async () => {
  const ctx = createQuoteExecutionEnv();
  await activateBaseline(ctx);
  const [startInstallment, laterInstallment] = installments(ctx);
  ctx.db.prepare(`
    UPDATE work_order_installments
    SET received_amount = ?, status = 'partially_received'
    WHERE id = ?
  `).run(startInstallment.amount - 1, startInstallment.id);

  const blocked = await api(ctx, '/api/workorders/wo-quote-1/payment/start-request', {
    body: { note: 'Ready to mobilize.' },
  });

  assert.equal(blocked.response.status, 409);
  assert.equal(ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status, 'pending_payment');

  ctx.db.prepare(`
    UPDATE work_order_installments
    SET received_amount = amount, status = 'received'
    WHERE id = ?
  `).run(startInstallment.id);
  const prematureApproval = await api(ctx, '/api/admin/workorders/wo-quote-1/payment/approve-start', {
    body: { note: 'Tried to skip engineer request.' }, userType: 'admin', userId: 'admin',
  });
  assert.equal(prematureApproval.response.status, 409);
  assert.equal(ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status, 'pending_payment');

  const requested = await api(ctx, '/api/workorders/wo-quote-1/payment/start-request', {
    body: { note: 'Prerequisite received.' },
  });
  assert.equal(requested.response.status, 200, JSON.stringify(requested.json));
  assert.equal(requested.json.status, 'payment_review');
  assert.equal(ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status, 'payment_review');

  const approved = await api(ctx, '/api/admin/workorders/wo-quote-1/payment/approve-start', {
    body: { note: 'Start approved.' }, userType: 'admin', userId: 'admin',
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.json));
  assert.equal(approved.json.status, 'in_service');
  assert.equal(ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status, 'in_service');
  assert.equal(ctx.db.prepare('SELECT received_amount FROM work_order_installments WHERE id = ?').get(laterInstallment.id).received_amount, 0);
});

test('active quote gates fail closed when the authoritative execution graph is incomplete', async () => {
  const corruptions = [
    ['missing pricing', (ctx) => ctx.db.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM work_order_pricing WHERE work_order_id = 'wo-quote-1';
      PRAGMA foreign_keys = ON;
    `)],
    ['projection version mismatch', (ctx) => ctx.db.exec(`
      UPDATE work_order_pricing SET quote_version = 99 WHERE work_order_id = 'wo-quote-1';
    `)],
    ['missing active history', (ctx) => ctx.db.exec(`
      DELETE FROM work_order_pricing_history WHERE version = 1;
    `)],
    ['missing active schedule', (ctx) => ctx.db.exec(`
      DELETE FROM work_order_installments WHERE quote_version = 1;
      DROP TRIGGER quote_execution_schedule_delete_guard;
      DELETE FROM work_order_payment_schedule WHERE quote_version = 1;
    `)],
  ];

  for (const [label, corrupt] of corruptions) {
    for (const gate of ['start', 'archive']) {
      const ctx = createQuoteExecutionEnv();
      await activateBaseline(ctx);
      ctx.db.exec(`
        UPDATE work_order_installments SET received_amount = amount, status = 'received';
        UPDATE work_orders SET status = '${gate === 'archive' ? 'resolved' : 'pending_payment'}'
        WHERE id = 'wo-quote-1';
      `);
      corrupt(ctx);

      const result = gate === 'start'
        ? await api(ctx, '/api/workorders/wo-quote-1/payment/start-request', {
          body: { note: 'Ready.' }, userType: 'engineer', userId: 'engineer-1',
        })
        : await api(ctx, '/api/admin/workorders/wo-quote-1/archive', {
          method: 'PATCH', body: {}, userType: 'admin', userId: 'admin',
        });

      assert.equal(result.response.status, 409, `${label} ${gate}`);
      assert.equal(result.json.code, 'quote_execution_inconsistent', `${label} ${gate}`);
      assert.equal(
        ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status,
        gate === 'archive' ? 'resolved' : 'pending_payment',
        `${label} ${gate}`,
      );
      ctx.close();
    }
  }
});

test('versioned start and archive transitions roll back when any mandatory lifecycle write fails', async () => {
  const transitions = [
    {
      name: 'engineer start request',
      priorStatus: 'pending_payment',
      action: 'payment_start_requested',
      logAction: 'payment_start_requested',
      request: (ctx) => api(ctx, '/api/workorders/wo-quote-1/payment/start-request', {
        body: { note: 'Ready.' }, userType: 'engineer', userId: 'engineer-1',
      }),
    },
    {
      name: 'Admin start approval',
      priorStatus: 'payment_review',
      action: 'payment_start_approved',
      logAction: 'payment_start_approved',
      request: (ctx) => api(ctx, '/api/admin/workorders/wo-quote-1/payment/approve-start', {
        body: { note: 'Approved.' }, userType: 'admin', userId: 'admin',
      }),
    },
    {
      name: 'financial archive',
      priorStatus: 'resolved',
      action: 'work_order_archived',
      logAction: 'archived',
      request: (ctx) => api(ctx, '/api/admin/workorders/wo-quote-1/archive', {
        method: 'PATCH', body: {}, userType: 'admin', userId: 'admin',
      }),
    },
  ];

  for (const transition of transitions) {
    for (const [table, triggerName] of [
      ['work_order_messages', 'fail_mandatory_message'],
      ['work_order_logs', 'fail_mandatory_log'],
      ['audit_logs', 'fail_mandatory_audit'],
    ]) {
      const ctx = createQuoteExecutionEnv();
      await activateBaseline(ctx);
      ctx.db.exec(`
        UPDATE work_order_installments SET received_amount = amount, status = 'received';
        UPDATE work_orders SET status = '${transition.priorStatus}' WHERE id = 'wo-quote-1';
        CREATE TRIGGER ${triggerName} BEFORE INSERT ON ${table}
        BEGIN SELECT RAISE(ABORT, 'forced mandatory lifecycle failure'); END;
      `);

      const result = await transition.request(ctx);

      assert.equal(result.response.status, 500, `${transition.name} ${table}`);
      assert.equal(
        ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status,
        transition.priorStatus,
        `${transition.name} ${table}`,
      );
      assert.equal(ctx.db.prepare(`
        SELECT COUNT(*) AS count FROM work_order_messages
        WHERE work_order_id = 'wo-quote-1' AND message_type = 'payment_update'
      `).get().count, 0, `${transition.name} ${table}`);
      assert.equal(ctx.db.prepare(`
        SELECT COUNT(*) AS count FROM work_order_logs
        WHERE work_order_id = 'wo-quote-1' AND action = ?
      `).get(transition.logAction).count, 0, `${transition.name} ${table}`);
      assert.equal(ctx.db.prepare(`
        SELECT COUNT(*) AS count FROM audit_logs
        WHERE target_id = 'wo-quote-1' AND action = ?
      `).get(transition.action).count, 0, `${transition.name} ${table}`);
      ctx.close();
    }
  }
});

test('concurrent versioned lifecycle transitions persist mandatory writes exactly once', async () => {
  const transitions = [
    {
      name: 'engineer start request',
      priorStatus: 'pending_payment',
      targetStatus: 'payment_review',
      logAction: 'payment_start_requested',
      auditAction: 'payment_start_requested',
      request: (ctx) => api(ctx, '/api/workorders/wo-quote-1/payment/start-request', {
        body: { note: 'Ready.' }, userType: 'engineer', userId: 'engineer-1',
      }),
    },
    {
      name: 'Admin start approval',
      priorStatus: 'payment_review',
      targetStatus: 'in_service',
      logAction: 'payment_start_approved',
      auditAction: 'payment_start_approved',
      request: (ctx) => api(ctx, '/api/admin/workorders/wo-quote-1/payment/approve-start', {
        body: { note: 'Approved.' }, userType: 'admin', userId: 'admin',
      }),
    },
    {
      name: 'financial archive',
      priorStatus: 'resolved',
      targetStatus: 'completed',
      logAction: 'archived',
      auditAction: 'work_order_archived',
      request: (ctx) => api(ctx, '/api/admin/workorders/wo-quote-1/archive', {
        method: 'PATCH', body: {}, userType: 'admin', userId: 'admin',
      }),
    },
  ];

  for (const transition of transitions) {
    const directory = mkdtempSync(join(tmpdir(), 'sagemro-lifecycle-race-'));
    const filename = join(directory, 'quote-execution.sqlite');
    const first = createQuoteExecutionEnv({ filename });
    const second = createQuoteExecutionEnv({ filename, initialize: false });
    let releaseFirst;
    let firstPaused;
    const paused = new Promise((resolve) => { firstPaused = resolve; });
    const release = new Promise((resolve) => { releaseFirst = resolve; });
    try {
      await activateBaseline(first);
      first.db.exec(`
        UPDATE work_order_installments SET received_amount = amount, status = 'received';
        UPDATE work_orders SET status = '${transition.priorStatus}' WHERE id = 'wo-quote-1';
      `);
      first.beforeNextBatch(async () => {
        firstPaused();
        await release;
      });
      const firstRequest = transition.request(first);
      await paused;
      const secondResult = await transition.request(second);
      releaseFirst();
      const firstResult = await firstRequest;
      const results = [firstResult, secondResult];

      assert.deepEqual(results.map((result) => result.response.status), [200, 200], transition.name);
      assert.equal(first.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status, transition.targetStatus, transition.name);
      assert.equal(first.db.prepare(`
        SELECT COUNT(*) AS count FROM work_order_messages
        WHERE work_order_id = 'wo-quote-1' AND message_type = 'payment_update'
      `).get().count, 1, transition.name);
      assert.equal(first.db.prepare(`
        SELECT COUNT(*) AS count FROM work_order_logs
        WHERE work_order_id = 'wo-quote-1' AND action = ?
      `).get(transition.logAction).count, 1, transition.name);
      assert.equal(first.db.prepare(`
        SELECT COUNT(*) AS count FROM audit_logs
        WHERE target_id = 'wo-quote-1' AND action = ?
      `).get(transition.auditAction).count, 1, transition.name);
    } finally {
      first.close();
      second.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('concurrent quote-driven check-ins reserve the final workday allowance atomically', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sagemro-workday-race-'));
  const filename = join(directory, 'quote-execution.sqlite');
  const sharedEvidenceObjects = new Map();
  const first = createQuoteExecutionEnv({ filename, sharedEvidenceObjects });
  const second = createQuoteExecutionEnv({ filename, initialize: false, sharedEvidenceObjects });
  let releaseFirst;
  let firstPaused;
  const paused = new Promise((resolve) => { firstPaused = resolve; });
  const release = new Promise((resolve) => { releaseFirst = resolve; });
  try {
    await activateBaseline(first);
    first.db.exec(`
      UPDATE work_order_installments SET received_amount = amount, status = 'received';
      UPDATE work_orders SET
        status = 'in_service', site_timezone = 'UTC', expected_service_days = 3,
        expected_completion_date = '2026-07-31', planned_daily_end_time = '17:30'
      WHERE id = 'wo-quote-1';
      INSERT INTO work_order_field_days (
        id, work_order_id, engineer_id, site_local_date, site_timezone, status, check_in_at
      ) VALUES
        ('reported-1', 'wo-quote-1', 'engineer-1', '2026-07-20', 'UTC', 'report_submitted', '2026-07-20T08:00:00Z'),
        ('reported-2', 'wo-quote-1', 'engineer-1', '2026-07-21', 'UTC', 'late_report_submitted', '2026-07-21T08:00:00Z');
    `);
    first.env.FIELD_WORK_NOW = '2026-07-22T08:00:00Z';
    second.env.FIELD_WORK_NOW = '2026-07-23T08:00:00Z';
    first.beforeNextBatch(async () => {
      firstPaused();
      await release;
    });
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], 'check-in.jpg', { type: 'image/jpeg' });

    const firstRequest = multipartApi(
      first,
      '/api/workorders/wo-quote-1/field-days/check-in',
      { photo, expected_checkout_time: '17:30' },
    );
    await paused;
    const secondResult = await multipartApi(
      second,
      '/api/workorders/wo-quote-1/field-days/check-in',
      { photo, expected_checkout_time: '17:30' },
    );
    releaseFirst();
    const firstResult = await firstRequest;
    const results = [firstResult, secondResult];
    const statuses = results.map((result) => result.response.status).sort();

    assert.deepEqual(statuses, [201, 409]);
    const rejected = results.find((result) => result.response.status === 409);
    assert.equal(rejected.json.code, 'workday_allowance_exhausted');
    assert.equal(first.db.prepare("SELECT COUNT(*) AS count FROM work_order_field_days WHERE status = 'checked_in'").get().count, 1);
    assert.equal(first.db.prepare("SELECT COUNT(*) AS count FROM work_order_field_day_media WHERE purpose = 'check_in'").get().count, 1);
    assert.equal(sharedEvidenceObjects.size, 1);
  } finally {
    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('versioned service completion allows a later unpaid installment but archive waits for settlement', async () => {
  const ctx = createQuoteExecutionEnv();
  ctx.db.exec("UPDATE work_orders SET service_mode = 'remote' WHERE id = 'wo-quote-1'");
  await activateBaseline(ctx, quotePayload({ expected_service_days: null }));
  const [startInstallment, laterInstallment] = installments(ctx);
  ctx.db.prepare(`
    UPDATE work_order_installments SET received_amount = amount, status = 'received' WHERE id = ?
  `).run(startInstallment.id);
  ctx.db.exec(`
    UPDATE work_orders SET status = 'in_service' WHERE id = 'wo-quote-1';
    INSERT INTO work_order_repair_records (
      id, work_order_id, symptom, diagnosis, solution, parts_used, labor_hours
    ) VALUES ('repair-quote-1', 'wo-quote-1', 'Low output', 'Dirty lens', 'Cleaned lens', '[]', 2);
  `);

  const resolved = await api(ctx, '/api/workorders/wo-quote-1/resolve', { body: {} });
  assert.equal(resolved.response.status, 200, JSON.stringify(resolved.json));
  assert.equal(ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status, 'resolved');

  const blockedArchive = await api(ctx, '/api/admin/workorders/wo-quote-1/archive', {
    method: 'PATCH', body: {}, userType: 'admin', userId: 'admin',
  });
  assert.equal(blockedArchive.response.status, 409);
  assert.equal(ctx.db.prepare("SELECT status FROM work_orders WHERE id = 'wo-quote-1'").get().status, 'resolved');

  ctx.db.prepare(`
    UPDATE work_order_installments SET received_amount = amount, status = 'received' WHERE id = ?
  `).run(laterInstallment.id);
  const archived = await api(ctx, '/api/admin/workorders/wo-quote-1/archive', {
    method: 'PATCH', body: {}, userType: 'admin', userId: 'admin',
  });
  assert.equal(archived.response.status, 200, JSON.stringify(archived.json));
  assert.equal(archived.json.status, 'completed');
});

test('detail and work-order lists expose payment state independently from service status', async () => {
  const ctx = createQuoteExecutionEnv();
  await activateBaseline(ctx);
  const [startInstallment] = installments(ctx);
  ctx.db.prepare(`
    UPDATE work_order_installments SET received_amount = 1000, status = 'partially_received' WHERE id = ?
  `).run(startInstallment.id);

  const detail = await api(ctx, '/api/workorders/wo-quote-1', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.status, 'pending_payment');
  assert.equal(detail.json.payment_state, 'partially_received');
  assert.equal(detail.json.received_amount, 1000);
  assert.equal(detail.json.outstanding_amount, 11000);

  const customerList = await api(ctx, '/api/workorders', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  assert.equal(customerList.response.status, 200);
  assert.equal(customerList.json.work_orders[0].status, 'pending_payment');
  assert.equal(customerList.json.work_orders[0].payment_state, 'partially_received');
  assert.equal(customerList.json.work_orders[0].received_amount, 1000);
  assert.equal(customerList.json.work_orders[0].outstanding_amount, 11000);

  const engineerList = await api(ctx, '/api/engineers/tickets', {
    method: 'GET', userType: 'engineer', userId: 'engineer-1',
  });
  assert.equal(engineerList.response.status, 200);
  assert.equal(engineerList.json.work_orders[0].payment_state, 'partially_received');

  const adminList = await api(ctx, '/api/admin/workorders', {
    method: 'GET', userType: 'admin', userId: 'admin',
  });
  assert.equal(adminList.response.status, 200);
  assert.equal(adminList.json.list[0].status, 'pending_payment');
  assert.equal(adminList.json.list[0].payment_state, 'partially_received');
  assert.equal(adminList.json.list[0].received_amount, 1000);
  assert.equal(adminList.json.list[0].outstanding_amount, 11000);
  assert.equal(adminList.json.list[0].payment_currency, 'USD');
  assert.equal(adminList.json.list[0].pending_receipt_claim_count, 0);
});

test('Admin list projects active receipt-review counts and currency across CN supplements without N+1 claim reads', async () => {
  const ctx = createQuoteExecutionEnv({ market: 'cn' });
  await activateBaseline(ctx, quotePayload({
    payment_schedule: quotePayload().payment_schedule.map((row) => ({ ...row, currency: 'CNY' })),
  }));
  const pricing = ctx.db.prepare('SELECT * FROM work_order_pricing WHERE work_order_id = ?').get('wo-quote-1');
  ctx.db.exec(`
    INSERT INTO work_order_pricing_history (
      id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal, total_amount,
      platform_fee, deposit_withhold, version, expected_service_days, payment_plan_mode,
      quote_kind, parent_quote_version, status, confirmed_at
    ) VALUES
      ('history-active-supplement-v2', '${pricing.id}', 500, 100, 0, 0, 600, 600,
        90, 30, 2, 3, 'single', 'supplemental', 1, 'confirmed', datetime('now')),
      ('history-active-supplement-v3', '${pricing.id}', 400, 0, 0, 0, 400, 400,
        60, 20, 3, 3, 'single', 'supplemental', 1, 'confirmed', datetime('now'));
    INSERT INTO work_order_payment_schedule (
      id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, description, required_before_start
    ) VALUES
      ('schedule-active-supplement-v2', '${pricing.id}', 'wo-quote-1', 2, 1, 600, 'CNY',
        'on_acceptance', 'Confirmed supplemental 2', 0),
      ('schedule-active-supplement-v3', '${pricing.id}', 'wo-quote-1', 3, 1, 400, 'CNY',
        'on_acceptance', 'Confirmed supplemental 3', 0);
    INSERT INTO work_order_installments (
      id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, description, required_before_start, status, received_amount
    ) VALUES
      ('installment-active-supplement-v2', 'schedule-active-supplement-v2', 'wo-quote-1', 2, 1,
        600, 'CNY', 'on_acceptance', 'Confirmed supplemental 2', 0, 'scheduled', 0),
      ('installment-active-supplement-v3', 'schedule-active-supplement-v3', 'wo-quote-1', 3, 1,
        400, 'CNY', 'on_acceptance', 'Confirmed supplemental 3', 0, 'pending_confirmation', 0);
    INSERT INTO work_order_receipt_claims (
      id, installment_id, work_order_id, engineer_id, claimed_amount, status, idempotency_key
    ) VALUES
      ('claim-active-supplement-pending', 'installment-active-supplement-v3', 'wo-quote-1', 'engineer-1', 400, 'pending', 'claim-supplement-pending'),
      ('claim-active-supplement-confirmed', 'installment-active-supplement-v2', 'wo-quote-1', 'engineer-1', 600, 'confirmed', 'claim-supplement-confirmed');
    UPDATE work_order_pricing
    SET quote_version = 3, labor_fee = 9900, parts_fee = 2100, travel_fee = 1000,
      subtotal = 13000, total_amount = 13000, platform_fee = 1950, deposit_withhold = 650,
      expected_service_days = 3, payment_plan_mode = 'installments', status = 'submitted'
    WHERE work_order_id = 'wo-quote-1';
  `);
  ctx.resetQueries();

  const adminList = await api(ctx, '/api/admin/workorders', {
    method: 'GET', userType: 'admin', userId: 'admin',
  });

  assert.equal(adminList.response.status, 200, JSON.stringify(adminList.json));
  assert.equal(adminList.json.list[0].payment_currency, 'CNY');
  assert.equal(adminList.json.list[0].pending_receipt_claim_count, 1);
  assert.equal(ctx.queries().filter((sql) => /work_order_receipt_claims/i.test(sql)).length, 1);
});

test('all work-order lists fail closed on a malformed active installment schedule', async () => {
  const ctx = createQuoteExecutionEnv();
  await activateBaseline(ctx);
  const [firstInstallment, secondInstallment] = installments(ctx);
  ctx.db.prepare(`
    UPDATE work_order_installments SET received_amount = amount, status = 'received' WHERE id = ?
  `).run(firstInstallment.id);
  ctx.db.prepare('DELETE FROM work_order_installments WHERE id = ?').run(secondInstallment.id);

  const customerList = await api(ctx, '/api/workorders', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  const engineerList = await api(ctx, '/api/engineers/tickets', {
    method: 'GET', userType: 'engineer', userId: 'engineer-1',
  });
  const adminList = await api(ctx, '/api/admin/workorders', {
    method: 'GET', userType: 'admin', userId: 'admin',
  });

  assert.equal(customerList.response.status, 200);
  assert.equal(engineerList.response.status, 200);
  assert.equal(adminList.response.status, 200);
  for (const row of [
    customerList.json.work_orders[0],
    engineerList.json.work_orders[0],
    adminList.json.list[0],
  ]) {
    assert.equal(row.payment_state, 'exception');
    assert.equal(row.received_amount, null);
    assert.equal(row.outstanding_amount, null);
    assert.equal(row.payment_currency, null);
    assert.equal(row.pending_receipt_claim_count, null);
  }
});

test('all work-order lists fail closed when an active execution mixes currencies', async () => {
  const ctx = createQuoteExecutionEnv({ market: 'cn' });
  await activateBaseline(ctx, quotePayload({
    payment_schedule: quotePayload().payment_schedule.map((row) => ({ ...row, currency: 'CNY' })),
  }));
  const pricing = ctx.db.prepare('SELECT * FROM work_order_pricing WHERE work_order_id = ?').get('wo-quote-1');
  ctx.db.exec(`
    INSERT INTO work_order_pricing_history (
      id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal, total_amount,
      platform_fee, deposit_withhold, version, expected_service_days, payment_plan_mode,
      quote_kind, parent_quote_version, status, confirmed_at
    ) VALUES (
      'history-mixed-currency-v2', '${pricing.id}', 500, 0, 0, 0, 500, 500,
      75, 25, 2, 3, 'single', 'supplemental', 1, 'confirmed', datetime('now')
    );
    INSERT INTO work_order_payment_schedule (
      id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, description, required_before_start
    ) VALUES (
      'schedule-mixed-currency-v2', '${pricing.id}', 'wo-quote-1', 2, 1, 500, 'USD',
      'on_acceptance', 'Mixed currency supplemental', 0
    );
    INSERT INTO work_order_installments (
      id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, description, required_before_start, status, received_amount
    ) VALUES (
      'installment-mixed-currency-v2', 'schedule-mixed-currency-v2', 'wo-quote-1', 2, 1,
      500, 'USD', 'on_acceptance', 'Mixed currency supplemental', 0, 'scheduled', 0
    );
    UPDATE work_order_pricing
    SET quote_version = 2, labor_fee = 9500, parts_fee = 2000, travel_fee = 1000,
      subtotal = 12500, total_amount = 12500, platform_fee = 1875, deposit_withhold = 625,
      expected_service_days = 3, payment_plan_mode = 'installments', status = 'submitted'
    WHERE work_order_id = 'wo-quote-1';
  `);

  const customerList = await api(ctx, '/api/workorders', {
    method: 'GET', userType: 'customer', userId: 'customer-1',
  });
  const engineerList = await api(ctx, '/api/engineers/tickets', {
    method: 'GET', userType: 'engineer', userId: 'engineer-1',
  });
  const adminList = await api(ctx, '/api/admin/workorders', {
    method: 'GET', userType: 'admin', userId: 'admin',
  });

  for (const row of [
    customerList.json.work_orders[0],
    engineerList.json.work_orders[0],
    adminList.json.list[0],
  ]) {
    assert.equal(row.payment_state, 'exception');
    assert.equal(row.payment_currency, null);
    assert.equal(row.pending_receipt_claim_count, null);
  }
});
