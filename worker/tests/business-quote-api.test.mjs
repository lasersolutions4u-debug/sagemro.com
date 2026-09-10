import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { signEnvSession, fixtureAdminEnv } from './helpers/session-jwt.mjs';

const secret = 'fictional-business-quote-test-secret';
const path = '/api/admin/business/work-orders/order-a/quote';
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const DB = { sqlite, prepare(sql) { let args = []; return {
    bind(...values) { args = values; return this; },
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
  }; }, async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  for (const id of ['a', 'b']) {
    sqlite.prepare("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES (?,?,'hash','salt','operations',?,'com',0,1)").run(id, `${id}@example.invalid`, id);
    sqlite.prepare("INSERT INTO business_staff_profiles(staff_id,role,grade) VALUES (?,'business_director',1)").run(id);
    sqlite.prepare("INSERT INTO business_territories(id,name,market) VALUES (?,?,'com')").run(id, id);
    sqlite.prepare('INSERT INTO business_director_territories(staff_id,territory_id) VALUES (?,?)').run(id, id);
    sqlite.prepare("INSERT INTO customers(id,user_no,name,password_hash) VALUES (?, ?, 'Fictional Customer','fictional-hash')").run(`customer-${id}`, `CUSTOMER-${id}`);
    sqlite.prepare("INSERT INTO work_orders(id,order_no,customer_id,type,description,status,service_mode) VALUES (?,?,?,'fault','Fictional request','pending','onsite')").run(`order-${id}`, `ORDER-${id}`, `customer-${id}`);
    sqlite.prepare("INSERT INTO business_record_assignments(kind,record_id,territory_id,owner_staff_id) VALUES ('work_order',?,?,?)").run(`order-${id}`, id, id);
  }
  return { DB, ...fixtureAdminEnv, JWT_SECRET: secret, ENVIRONMENT: 'development', KV: { async get() { return null; }, async put() {}, async delete() {} } };
}
async function api(env, route = path, { id = 'a', method = 'GET', body, userType = 'admin', omitReviewScope = false } = {}) {
  if (id === 'admin' && /\/pricing\/(approve|reject)$/.test(route) && !omitReviewScope) body = { ...await context(env, id), ...body };
  const market = env.testMarket || 'com';
  const token = await signEnvSession({ userId: id, userType, market, ...(userType === 'admin' && id !== 'admin' ? { staffId: id, staffRole: 'admin' } : {}), exp: Math.floor(Date.now() / 1000) + 3600 }, env);
  const pending = [];
  const response = await worker.fetch(new Request(`https://api.sagemro.com${route}`, { method, headers: { Origin: `https://admin.sagemro.${market}`, Authorization: `Bearer ${token}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) }), env, { waitUntil(task) { pending.push(task); } });
  await Promise.all(pending);
  return { status: response.status, data: response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : await response.text(), headers: response.headers };
}
async function context(env, id = 'a') {
  const result = await api(env, `/api/admin/business/organization?expected_staff_id=${id}`, { id });
  assert.equal(result.status, 200);
  return { expected_staff_id: id, scope_version: result.data.scope_version };
}
const draft = (overrides = {}) => ({ labor_fee: 1000, parts_fee: 500, travel_fee: 0, other_fee: 0, parts_detail: '', expected_service_days: 2, payment_plan_mode: 'single', payment_schedule: [], costs: { parts_cost: 200, engineer_cost: 300, travel_cost: 0, other_cost: 0 }, ...overrides });

const dispatchRoutes = ['assign', 'assign-regional-lead', 'regional', 'accept'];
const paymentsPath = '/api/admin/business/work-orders/order-a/payments';
const installmentPath = id => `/api/admin/business/work-orders/order-a/installments/${id}`;
async function payments(env, id = 'a', ctx) {
  return api(env, `${paymentsPath}?${new URLSearchParams(ctx || await context(env, id))}`, { id });
}
async function startCollection(env, installment, id = 'a', extra = {}) {
  return api(env, `${installmentPath(installment.id)}/collection/start`, { id, method: 'POST', body: { ...await context(env, id), quote_version: installment.quote_version, ...extra } });
}
async function submitReceipt(env, installment, { id = 'a', amount = installment.amount, key = `receipt-${installment.id}`, extra = {} } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...await context(env, id), quote_version: installment.quote_version, claimed_amount: amount, idempotency_key: key, note: 'Internal fictional note', ...extra })) form.set(k, v);
  return api(env, `${installmentPath(installment.id)}/receipt-claims`, { id, method: 'POST', body: form });
}
async function decideReceipt(env, installment, claim, { id = 'admin', amount = installment.amount, decision = 'confirmed', key = `decision-${claim.id}`, extra = {} } = {}) {
  return api(env, `/api/admin/workorders/order-a/installments/${installment.id}/receipt-claims/${claim.id}/decision`, { id, method: 'POST', body: { ...await context(env, id), quote_version: installment.quote_version, confirmed_amount: amount, decision, idempotency_key: key, ...extra } });
}
async function rawBusinessPayment(env, route, body, headers = {}) {
  const token = await signEnvSession({ userId: 'a', staffId: 'a', staffRole: 'admin', userType: 'admin', market: 'com', exp: Math.floor(Date.now() / 1000) + 3600 }, env);
  const response = await worker.fetch(new Request(`https://api.sagemro.com${route}`, { method: 'POST', body, duplex: 'half', headers: { Origin: 'https://admin.sagemro.com', Authorization: `Bearer ${token}`, ...headers } }), env, {});
  return { status: response.status, data: await response.json() };
}
function businessPaymentState(env) {
  return Object.fromEntries(['work_order_receipt_claims','work_order_receipt_evidence','work_order_installments','audit_logs','notifications'].map(table => [table, env.DB.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
}
for (const declaredLength of [null, '1', String(20 * 1024 * 1024)]) test(`business multipart bounds actual stream before parsing with declared length ${declaredLength}`, async t => {
  const env = fixture(t); let reads = 0, cancelled = false, uploads = 0;
  env.FIELD_EVIDENCE = { async put() { uploads += 1; } };
  const before = businessPaymentState(env);
  const stream = new ReadableStream({ pull(controller) { reads += 1; if (reads <= 12) controller.enqueue(new Uint8Array(1024 * 1024).fill(120)); else controller.close(); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const result = await rawBusinessPayment(env, '/api/admin/business/work-orders/order-a/installments/fictional/receipt-claims', stream, { 'Content-Type': 'multipart/form-data; boundary=fictional', ...(declaredLength === null ? {} : { 'Content-Length': declaredLength }) });
  assert.equal(result.status, 413, JSON.stringify(result.data));
  assert.equal(cancelled, true);
  assert.ok(reads <= 11); if (declaredLength === String(20 * 1024 * 1024)) assert.equal(reads, 0);
  assert.deepEqual(businessPaymentState(env), before); assert.equal(uploads, 0);
});
test('business multipart total body includes extra fields and rejects before evidence upload', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  const installment = (await payments(env)).data.quote_execution.installments[0]; await startCollection(env, installment);
  const before = businessPaymentState(env); let uploads = 0;
  env.FIELD_EVIDENCE = { async put() { uploads += 1; } };
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...await context(env), quote_version: 1, claimed_amount: 500, idempotency_key: 'oversized-extras' })) form.set(key, value);
  form.set('evidence', new Blob(['%PDF-1.7\nFictional proof'], { type: 'application/pdf' }));
  for (let index = 0; index < 11; index += 1) form.append(`unused-${index}`, 'x'.repeat(1024 * 1024));
  const result = await rawBusinessPayment(env, `${installmentPath(installment.id)}/receipt-claims`, form);
  assert.equal(result.status, 413, JSON.stringify(result.data));
  assert.deepEqual(businessPaymentState(env), before); assert.equal(uploads, 0);
});
for (const [body, status] of [['{', 400], ['null', 400], ['[]', 400], ['x'.repeat(65537), 413]]) test(`business collection bounded JSON rejects ${body.length > 100 ? 'oversized' : body} with ${status}`, async t => {
  const env = fixture(t), before = businessPaymentState(env);
  const result = await rawBusinessPayment(env, '/api/admin/business/work-orders/order-a/installments/fictional/collection/start', body, { 'Content-Type': 'application/json', 'Content-Length': '1' });
  assert.equal(result.status, status, JSON.stringify(result.data));
  assert.deepEqual(businessPaymentState(env), before);
});
test('business payments wait before customer confirmation and stay scoped', async t => {
  const env = fixture(t);
  const result = await payments(env);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.available, false);
  assert.equal(result.data.quote_execution, null);
  assert.equal((await payments(env, 'b')).status, 404);
  assert.equal((await payments(env, 'a', { ...await context(env), scope_version: 'stale' })).status, 409);
});
test('business collection guards fit D1 function argument limits and reject stale version or actor', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  const installment = (await payments(env)).data.quote_execution.installments[0];
  assert.equal((await startCollection(env, installment, 'a', { quote_version: 2 })).status, 409);
  assert.equal((await startCollection(env, installment, 'a', { expected_staff_id: 'b' })).status, 403);
  assert.equal((await startCollection(env, installment, 'b')).status, 404);
  const prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = sql => {
    for (const match of sql.matchAll(/json_object\(([^)]*)\)/g)) assert.ok(match[1].split(',').length <= 100, 'D1 json_object argument limit');
    return prepare(sql);
  };
  const result = await startCollection(env, installment);
  assert.equal(result.status, 200, JSON.stringify(result.data));
});
test('unassigned business quote collects and Admin receipts unlock dispatch without inventing engineer', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  let result = await payments(env);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.available, true);
  assert.equal(env.DB.sqlite.prepare("SELECT engineer_id FROM work_orders WHERE id='order-a'").get().engineer_id, null);
  for (const installment of result.data.quote_execution.installments.filter(i => i.required_before_start)) {
    assert.equal(installment.can_start_collection, true);
    assert.equal((await startCollection(env, installment)).status, 200);
    assert.equal((await api(env, `/api/workorders/order-a/installments/${installment.id}/payment-method`, { id: 'customer-a', userType: 'customer', method: 'POST', body: { payment_method: 'bank_transfer' } })).status, 200);
    const submitted = await submitReceipt(env, installment, { extra: { engineer_id: 'technician', submitted_by_staff_id: 'b' } });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
    const row = env.DB.sqlite.prepare('SELECT * FROM work_order_receipt_claims WHERE id=?').get(submitted.data.claim.id);
    assert.equal(row.engineer_id, null); assert.equal(row.submitted_by_staff_id, 'a');
    assert.equal((await dispatch(env, 'assign')).status, 409);
    assert.equal((await decideReceipt(env, installment, row, { id: 'a' })).status, 403);
    assert.equal((await submitReceipt(env, installment)).status, 200);
    assert.equal((await submitReceipt(env, installment, { amount: installment.amount - 1 })).status, 409);
    const decided = await decideReceipt(env, installment, row);
    assert.equal(decided.status, 200, JSON.stringify(decided.data));
    assert.equal((await decideReceipt(env, installment, row)).status, 200);
  }
  assert.equal((await dispatch(env, 'assign')).status, 200);
  const claims = (await payments(env)).data.quote_execution.receipt_claims;
  assert.equal(claims[0].submitter_type, 'business'); assert.equal(claims[0].submitter_id, 'a');
  assert.equal(claims[0].submitter_note, 'Internal fictional note');
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM notifications WHERE user_type='engineer' AND type LIKE 'installment_%'").get().n, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id='a' AND type='installment_payment_method_selected'").get().n, 2);
});

for (const operation of ['collection','receipt','decision']) {
  for (const mutation of ["UPDATE work_orders SET status='cancelled' WHERE id='order-a'", "UPDATE business_record_assignments SET owner_staff_id='b' WHERE record_id='order-a'", "UPDATE work_orders SET active_quote_version=2 WHERE id='order-a'", "UPDATE work_order_pricing_history SET total_amount=1700", "UPDATE admin_staff_accounts SET is_active=0 WHERE id='a'", "UPDATE work_order_installments SET status='exception'", "UPDATE work_order_installments SET received_amount=1 WHERE sequence=1"]) {
    test(`business ${operation} rejects mutation-time lifecycle or scope change: ${mutation}`, async t => {
      const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
      const installment = (await payments(env)).data.quote_execution.installments[0];
      if (operation !== 'collection') await startCollection(env, installment);
      const claim = operation === 'decision' ? (await submitReceipt(env, installment)).data.claim : null;
      const prepare = env.DB.prepare.bind(env.DB); let injected = false;
      const before = env.DB.sqlite.prepare('SELECT * FROM work_order_installments').all();
      const notificationCount = env.DB.sqlite.prepare('SELECT COUNT(*) n FROM notifications').get().n;
      env.DB.prepare = sql => {
        const statement = prepare(sql), run = statement.run.bind(statement);
        statement.run = async () => {
          if (!injected && (operation === 'decision' ? /UPDATE work_order_receipt_claims/ : /UPDATE work_order_installments/).test(sql)) {
            injected = true; env.DB.sqlite.exec(mutation);
          }
          return run();
        };
        return statement;
      };
      const result = operation === 'collection' ? await startCollection(env, installment)
        : operation === 'receipt' ? await submitReceipt(env, installment) : await decideReceipt(env, installment, claim);
      assert.equal(injected, true);
      assert.equal(result.status, 409, JSON.stringify(result.data));
      assert.deepEqual(env.DB.sqlite.prepare('SELECT * FROM work_order_installments').all(), before);
      assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM notifications').get().n, notificationCount);
    });
  }
}
test('business receipts remain partial or rejected until full Admin confirmation and forbid overconfirmation', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  const installment = (await payments(env)).data.quote_execution.installments[0];
  await startCollection(env, installment);
  const submitted = await submitReceipt(env, installment);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim, { amount: installment.amount + 1 })).status, 409);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim, { amount: 100 })).status, 200);
  assert.equal((await dispatch(env, 'assign')).status, 409);
  const next = await submitReceipt(env, installment, { amount: 400, key: 'second' });
  assert.equal(next.status, 201);
  assert.equal((await decideReceipt(env, installment, next.data.claim, { decision: 'rejected', extra: { reason: 'Unverified fictional transfer' } })).status, 200);
  assert.equal((await payments(env)).data.quote_execution.installments[0].received_amount, 100);
  assert.equal((await dispatch(env, 'assign')).status, 409);
});
test('business receipt amount cannot exceed remaining balance and exact retries survive confirmed balance changes', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  const installment = (await payments(env)).data.quote_execution.installments[0];
  await startCollection(env, installment);
  const objects = new Map(); let uploads = 0;
  env.FIELD_EVIDENCE = { async put(key, value) { uploads += 1; objects.set(key, value); }, async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }, async delete(key) { objects.delete(key); } };
  const extra = { evidence: new Blob(['%PDF-1.7\nFictional balance proof'], { type: 'application/pdf' }) };
  const snapshot = () => Object.fromEntries(['work_order_receipt_claims','work_order_receipt_evidence','work_order_installments','audit_logs','notifications'].map(table => [table, env.DB.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
  const before = snapshot();
  const rejected = await submitReceipt(env, installment, { amount: 501, extra });
  assert.equal(rejected.status, 409, JSON.stringify(rejected.data));
  assert.deepEqual(snapshot(), before); assert.equal(uploads, 0); assert.equal(objects.size, 0);
  const submitted = await submitReceipt(env, installment, { amount: 500, extra });
  assert.equal(submitted.status, 201);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim, { amount: 100 })).status, 200);
  assert.equal((await submitReceipt(env, installment, { amount: 500, extra })).status, 200);
  const partial = snapshot();
  assert.equal((await submitReceipt(env, installment, { amount: 401, key: 'over-partial-balance', extra })).status, 409);
  assert.deepEqual(snapshot(), partial); assert.equal(uploads, 1); assert.equal(objects.size, 1);
  const remaining = await submitReceipt(env, installment, { amount: 400, key: 'remaining-balance', extra });
  assert.equal(remaining.status, 201);
  assert.equal((await decideReceipt(env, installment, remaining.data.claim, { amount: 400 })).status, 200);
  const settled = snapshot();
  assert.equal((await submitReceipt(env, installment, { amount: 400, key: 'remaining-balance', extra })).status, 200);
  assert.deepEqual(snapshot(), settled); assert.equal(uploads, 2); assert.equal(objects.size, 2);
});
test('business collection and receipt retries persist each audit and notification once, including ambiguous commit', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  const installment = (await payments(env)).data.quote_execution.installments[0];
  assert.equal((await startCollection(env, installment)).status, 200);
  assert.equal((await startCollection(env, installment)).status, 200);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='installment_collection_started'").get().n, 1);
  const batch = env.DB.batch.bind(env.DB); let ambiguous = true;
  env.DB.batch = async statements => { const result = await batch(statements); if (ambiguous) { ambiguous = false; throw new Error('Fictional transport lost after commit'); } return result; };
  const submitted = await submitReceipt(env, installment);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
  assert.equal((await submitReceipt(env, installment)).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM work_order_receipt_claims').get().n, 1);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='installment_receipt_claim_submitted'").get().n, 1);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM notifications WHERE type='installment_receipt_claim_submitted'").get().n, 1);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim)).status, 200);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim, { amount: 1 })).status, 409);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='installment_receipt_confirmed'").get().n, 1);
});
test('business Admin can submit and Operations cannot confirm receipts despite token role', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  env.DB.sqlite.exec("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password) VALUES ('ops','ops@example.invalid','hash','salt','operations','Fictional Ops','com',0)");
  const installment = (await payments(env)).data.quote_execution.installments[0];
  assert.equal((await startCollection(env, installment, 'admin')).status, 200);
  const submitted = await submitReceipt(env, installment, { id: 'admin' }); assert.equal(submitted.status, 201);
  assert.equal(env.DB.sqlite.prepare('SELECT submitted_by_staff_id FROM work_order_receipt_claims').get().submitted_by_staff_id, 'admin');
  const denied = await api(env, `/api/admin/workorders/order-a/installments/${installment.id}/receipt-claims/${submitted.data.claim.id}/decision`, { id: 'ops', method: 'POST', body: { decision: 'confirmed', confirmed_amount: 500, idempotency_key: 'ops-forbidden' } });
  assert.equal(denied.status, 403);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim)).status, 200);
});
for (const status of ['resolved','pending_review','completed']) for (const trigger of ['on_completion','on_acceptance']) test(`business contractual tail remains collectible at service ${status}: ${trigger}`, async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign', '', trigger);
  env.DB.sqlite.prepare("UPDATE work_orders SET status=? WHERE id='order-a'").run(status);
  if (trigger === 'on_acceptance') env.DB.sqlite.exec("INSERT INTO ratings(id,work_order_id,engineer_id,customer_id,rating_timeliness,rating_technical,rating_communication,rating_professional) VALUES ('rating','order-a','technician','customer-a',5,5,5,5)");
  const installment = (await payments(env)).data.quote_execution.installments[2];
  assert.equal(installment.can_start_collection, true);
  assert.equal((await startCollection(env, installment)).status, 200);
  assert.equal((await api(env, `/api/workorders/order-a/installments/${installment.id}/payment-method`, { id: 'customer-a', userType: 'customer', method: 'POST', body: { payment_method: 'bank_transfer' } })).status, 200);
  const submitted = await submitReceipt(env, installment); assert.equal(submitted.status, 201);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim)).status, 200);
});
for (const state of ['none','pending','confirmed','race']) test(`business cancellation respects receipts and atomic lifecycle: ${state}`, async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  env.DB.sqlite.exec("UPDATE work_orders SET status='assigned' WHERE id='order-a'");
  const installment = (await payments(env)).data.quote_execution.installments[0];
  if (['pending','confirmed'].includes(state)) {
    await startCollection(env, installment);
    const submitted = await submitReceipt(env, installment);
    if (state === 'confirmed') await decideReceipt(env, installment, submitted.data.claim);
  }
  if (state === 'race') {
    const prepare = env.DB.prepare.bind(env.DB); let injected = false;
    env.DB.prepare = sql => {
      const statement = prepare(sql), run = statement.run.bind(statement);
      statement.run = async () => {
        if (!injected && /UPDATE work_orders SET status = 'cancelled'/.test(sql)) {
          injected = true;
          env.DB.sqlite.prepare("INSERT INTO work_order_receipt_claims(id,installment_id,work_order_id,submitted_by_staff_id,claimed_amount,idempotency_key) VALUES ('race',?,'order-a','a',500,'race')").run(installment.id);
        }
        return run();
      }; return statement;
    };
  }
  const result = await api(env, '/api/workorders/order-a/cancel', { id: 'customer-a', userType: 'customer', method: 'POST', body: {} });
  assert.equal(result.status, state === 'none' ? 200 : 409, JSON.stringify(result.data));
  assert.equal(env.DB.sqlite.prepare("SELECT status FROM work_orders WHERE id='order-a'").get().status === 'cancelled', state === 'none');
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM work_order_logs WHERE action='cancelled'").get().n, state === 'none' ? 1 : 0);
});
for (const market of ['com', 'cn']) test(`business receipt evidence protects staff snapshots and private notes in ${market}`, async t => {
  const env = dispatchFixture(t, 'assign');
  if (market === 'cn') {
    env.testMarket = 'cn'; env.DB.sqlite.exec("UPDATE admin_staff_accounts SET market_scope='cn'; UPDATE business_territories SET market='cn'");
  }
  const objects = new Map();
  env.FIELD_EVIDENCE = { async put(key, value) { objects.set(key, value); }, async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }, async delete(key) { objects.delete(key); } };
  await confirmedDispatchQuote(env, 'assign');
  const installment = (await payments(env)).data.quote_execution.installments[0];
  assert.equal(installment.currency, market === 'cn' ? 'CNY' : 'USD');
  await startCollection(env, installment);
  const extra = { evidence: new Blob(['%PDF-1.7\nFictional proof'], { type: 'application/pdf' }) };
  const submitted = await submitReceipt(env, installment, { extra });
  assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
  assert.equal((await submitReceipt(env, installment, { extra })).status, 200);
  const evidenceId = submitted.data.evidence.id;
  const scopedPath = `/api/admin/business/work-orders/order-a/receipt-evidence/${evidenceId}`;
  assert.equal((await api(env, `${scopedPath}?${new URLSearchParams(await context(env))}`)).status, 200);
  assert.equal((await api(env, `${scopedPath}?${new URLSearchParams(await context(env, 'b'))}`, { id: 'b' })).status, 404);
  const genericPath = `/api/workorders/order-a/receipt-evidence/${evidenceId}`;
  assert.equal((await api(env, genericPath, { id: 'admin' })).status, 200);
  if (market === 'com') {
    env.testMarket = 'cn';
    assert.equal((await api(env, genericPath, { id: 'admin' })).status, 404);
    env.testMarket = 'com';
  }
  assert.equal((await api(env, genericPath, { id: 'customer-a', userType: 'customer' })).status, 200);
  env.DB.sqlite.exec("UPDATE work_orders SET engineer_id='technician' WHERE id='order-a'");
  assert.equal((await api(env, genericPath, { id: 'technician', userType: 'engineer' })).status, 403);
  const engineer = await api(env, '/api/workorders/order-a', { id: 'technician', userType: 'engineer' });
  const customer = await api(env, '/api/workorders/order-a', { id: 'customer-a', userType: 'customer' });
  assert.equal(engineer.status, 200); assert.equal(customer.status, 200);
  for (const output of [engineer, customer]) {
    const claim = output.data.quote_execution.receipt_claims[0];
    assert.equal(claim.submitter_id, undefined); assert.equal(claim.submitter_note, undefined); assert.equal(claim.engineer_note, undefined);
  }
  assert.equal(engineer.data.quote_execution.receipt_claims[0].evidence, undefined);
  assert.equal((await api(env, `/api/workorders/order-a/installments/${installment.id}/collect`, { id: 'technician', userType: 'engineer', method: 'POST', body: {} })).status, 403);
  const engineerForm = new FormData(); engineerForm.set('claimed_amount', '1'); engineerForm.set('idempotency_key', 'engineer-forbidden');
  assert.equal((await api(env, `/api/workorders/order-a/installments/${installment.id}/receipt-claims`, { id: 'technician', userType: 'engineer', method: 'POST', body: engineerForm })).status, 403);
  assert.equal((await decideReceipt(env, installment, submitted.data.claim)).status, 200);
});
function dispatchFixture(t, route) {
  const env = fixture(t);
  env.DB.sqlite.exec("INSERT INTO engineers(id,user_no,name,phone,password_hash,engineer_role) VALUES ('lead','LEAD','Fictional Lead','fictional-lead','hash','regional_lead'); INSERT INTO engineers(id,user_no,name,phone,password_hash,engineer_role,regional_lead_id) VALUES ('technician','TECH','Fictional Technician','fictional-tech','hash','engineer','lead');");
  if (route === 'regional') env.DB.sqlite.exec("UPDATE work_orders SET assigned_regional_lead_id='lead', status='pending_dispatch' WHERE id='order-a'");
  if (route === 'accept') env.DB.sqlite.exec("UPDATE work_orders SET engineer_id='technician', status='assigned' WHERE id='order-a'");
  return env;
}
async function dispatch(env, route, id) {
  return api(env, route === 'regional' ? '/api/engineers/assign-engineer' : route === 'accept' ? '/api/engineers/tickets/accept' : `/api/admin/workorders/order-a/${route}`, {
    id: id || (route === 'regional' ? 'lead' : route === 'accept' ? 'technician' : 'admin'),
    userType: ['regional', 'accept'].includes(route) ? 'engineer' : 'admin', method: ['regional', 'accept'].includes(route) ? 'POST' : 'PATCH',
    body: { work_order_id: 'order-a', engineer_id: 'technician', regional_lead_id: 'lead' },
  });
}
async function confirmedDispatchQuote(env, route, description = '', tailTrigger = 'on_acceptance') {
  env.DB.sqlite.exec("UPDATE work_orders SET status='pending' WHERE id='order-a'");
  const ctx = await context(env);
  const currency = env.testMarket === 'cn' ? 'CNY' : 'USD';
  const saved = await save(env, ctx, 0, draft({ payment_plan_mode: 'installments', payment_schedule: [
    { sequence: 1, amount: 500, currency, trigger_type: 'before_start', required_before_start: true },
    { sequence: 2, amount: 400, currency, trigger_type: 'before_start', required_before_start: true },
    { sequence: 3, amount: 600, currency, trigger_type: tailTrigger, required_before_start: false, description },
  ] }));
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal((await submit(env, ctx)).status, 200);
  assert.equal((await lifecycle(env, 'admin-approve')).status, 200);
  assert.equal((await lifecycle(env, 'customer-confirm')).status, 200);
  if (route === 'accept') env.DB.sqlite.exec("UPDATE work_orders SET status='assigned' WHERE id='order-a'");
}
function confirmDispatchReceipts(env, amount = 900) {
  for (const row of env.DB.sqlite.prepare('SELECT * FROM work_order_installments WHERE required_before_start=1 ORDER BY sequence').all()) {
    const paid = Math.min(amount, row.amount); amount -= paid;
    if (!paid) continue;
    env.DB.sqlite.prepare("INSERT INTO work_order_receipt_claims(id,installment_id,work_order_id,engineer_id,claimed_amount,confirmed_amount,status,decided_by,decided_at,idempotency_key) VALUES (?,?,'order-a','technician',?,?,'confirmed','admin','2026-09-07',?)").run(`claim-${row.id}`, row.id, paid, paid, `claim-${row.id}`);
    env.DB.sqlite.prepare("UPDATE work_order_installments SET received_amount=?,status=? WHERE id=?").run(paid, paid === row.amount ? 'received' : 'partially_received', row.id);
    env.DB.sqlite.prepare("INSERT INTO audit_logs(id,actor_type,actor_id,target_type,target_id,action,after_state) VALUES (?,'admin','admin','work_order_receipt_claim',?,'installment_receipt_confirmed',?)")
      .run(`audit-claim-${row.id}`, `claim-${row.id}`, JSON.stringify({ claim_status: 'confirmed', confirmed_amount: paid }));
  }
}
function dispatchState(env) {
  const db = env.DB.sqlite;
  return { orders: db.prepare('SELECT * FROM work_orders').all(), logs: db.prepare('SELECT * FROM work_order_logs').all(), ...lifecycleState(env) };
}
for (const route of dispatchRoutes) {
  for (const stage of ['unquoted', 'unpaid', 'partial', 'paid']) test(`dispatch ${route} requires confirmed business prestart receipts: ${stage}`, async t => {
    const env = dispatchFixture(t, route);
    if (stage !== 'unquoted') await confirmedDispatchQuote(env, route);
    if (stage === 'partial') confirmDispatchReceipts(env, 600);
    if (stage === 'paid') confirmDispatchReceipts(env);
    const before = dispatchState(env);
    const result = await dispatch(env, route);
    assert.equal(result.status, stage === 'paid' ? 200 : 409, JSON.stringify(result.data));
    if (stage !== 'paid') assert.deepEqual(dispatchState(env), before);
    else assert.equal(env.DB.sqlite.prepare('SELECT received_amount FROM work_order_installments WHERE sequence=3').get().received_amount, 0);
  });
  test(`CN dispatch ${route} preserves legacy nonbusiness orders`, async t => {
    const env = dispatchFixture(t, route);
    env.testMarket = 'cn';
    env.DB.sqlite.exec("DELETE FROM business_record_assignments WHERE record_id='order-a'");
    assert.equal((await dispatch(env, route)).status, 200);
  });
  for (const mutation of [
    "UPDATE work_orders SET status='cancelled' WHERE id='order-a'",
    "UPDATE work_order_installments SET received_amount=0",
    "UPDATE work_order_receipt_claims SET status='pending',confirmed_amount=NULL,decided_by=NULL,decided_at=NULL",
    "DELETE FROM audit_logs WHERE action='installment_receipt_confirmed'",
    "UPDATE audit_logs SET actor_type='engineer' WHERE action='installment_receipt_confirmed'",
    "UPDATE work_order_pricing_history SET total_amount=1600",
    "UPDATE work_orders SET active_quote_version=2 WHERE id='order-a'",
    "UPDATE work_orders SET service_mode='remote' WHERE id='order-a'",
    "UPDATE work_orders SET customer_id='customer-b' WHERE id='order-a'",
  ]) test(`dispatch ${route} rejects mutation-time change: ${mutation}`, async t => {
    const env = dispatchFixture(t, route);
    await confirmedDispatchQuote(env, route); confirmDispatchReceipts(env);
    const prepare = env.DB.prepare.bind(env.DB); let before; let injected = false;
    env.DB.prepare = sql => {
      const statement = prepare(sql), run = statement.run.bind(statement);
      statement.run = async () => {
        if (!injected && /UPDATE work_orders[\s\S]*SET[\s\S]*(?:engineer_id|assigned_regional_lead_id)/i.test(sql)) {
          injected = true; env.DB.sqlite.exec(mutation); before = dispatchState(env);
        }
        return run();
      };
      return statement;
    };
    const result = await dispatch(env, route);
    assert.equal(injected, true);
    assert.equal(result.status, 409, JSON.stringify(result.data));
    assert.deepEqual(dispatchState(env), before);
  });
}
for (const mutation of [
  'UPDATE work_order_installments SET received_amount=amount',
  "UPDATE work_order_receipt_claims SET decided_by=NULL",
  "UPDATE work_order_receipt_claims SET status='pending'",
  "DELETE FROM audit_logs WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET actor_type='engineer' WHERE action='installment_receipt_confirmed'",
  "UPDATE work_order_pricing_history SET total_amount=1600",
  "UPDATE work_orders SET active_quote_version=2 WHERE id='order-a'",
  "DELETE FROM work_order_receipt_claims WHERE installment_id IN (SELECT id FROM work_order_installments WHERE sequence=2); DELETE FROM work_order_installments WHERE sequence=2",
  "UPDATE work_order_payment_schedule SET currency='CNY'; UPDATE work_order_installments SET currency='CNY'",
  "UPDATE work_order_payment_schedule SET trigger_type='on_arrival' WHERE sequence=1; UPDATE work_order_installments SET trigger_type='on_arrival' WHERE sequence=1",
]) test(`business dispatch fails closed for malformed or unsupported receipts: ${mutation}`, async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign');
  if (!mutation.startsWith('UPDATE work_order_installments SET received_amount=amount')) confirmDispatchReceipts(env);
  for (const { name } of env.DB.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('work_order_payment_schedule','work_order_installments')").all()) env.DB.sqlite.exec(`DROP TRIGGER "${name}"`);
  env.DB.sqlite.exec(mutation);
  const before = dispatchState(env);
  assert.equal((await dispatch(env, 'assign')).status, 409);
  assert.deepEqual(dispatchState(env), before);
});
test('business actor cannot dispatch and paid unassigned business order cannot be self-accepted', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign'); confirmDispatchReceipts(env);
  assert.equal((await dispatch(env, 'assign', 'a')).status, 403);
  env.DB.sqlite.exec("UPDATE work_orders SET status='pending' WHERE id='order-a'");
  const before = dispatchState(env);
  assert.equal((await dispatch(env, 'accept')).status, 409);
  assert.deepEqual(dispatchState(env), before);
});
for (const status of ['resolved', 'pending_review', 'completed', 'cancelled', 'rejected']) test(`paid business dispatch rejects finished state ${status}`, async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign'); confirmDispatchReceipts(env);
  env.DB.sqlite.prepare("UPDATE work_orders SET status=? WHERE id='order-a'").run(status);
  const before = dispatchState(env);
  for (const route of ['assign', 'assign-regional-lead']) assert.equal((await dispatch(env, route)).status, 409);
  assert.deepEqual(dispatchState(env), before);
});
for (const source of ['draft', 'pricing']) test(`business ${source} alone prevents legacy dispatch bypass`, async t => {
  const env = dispatchFixture(t, 'assign'), ctx = await context(env);
  await save(env, ctx);
  if (source === 'pricing') await submit(env, ctx);
  env.DB.sqlite.exec("DELETE FROM business_record_assignments WHERE record_id='order-a'");
  if (source === 'pricing') env.DB.sqlite.exec("DELETE FROM business_quote_drafts WHERE work_order_id='order-a'");
  const before = dispatchState(env);
  for (const route of ['assign', 'assign-regional-lead']) assert.equal((await dispatch(env, route)).status, 409);
  assert.deepEqual(dispatchState(env), before);
});
for (const route of ['assign', 'regional']) test(`unpaid dispatch ${route} does not write conflict detection side effects`, async t => {
  const env = dispatchFixture(t, route);
  env.DB.sqlite.exec("UPDATE customers SET phone='fictional-tech' WHERE id='customer-a'");
  const before = dispatchState(env);
  assert.equal((await dispatch(env, route)).status, 409);
  assert.deepEqual(dispatchState(env), before);
});
test('CN legacy order cannot acquire business ownership during its assignment write', async t => {
  const env = dispatchFixture(t, 'assign');
  env.testMarket = 'cn';
  env.DB.sqlite.exec("DELETE FROM business_record_assignments WHERE record_id='order-a'");
  const prepare = env.DB.prepare.bind(env.DB); let before;
  env.DB.prepare = sql => {
    const statement = prepare(sql), run = statement.run.bind(statement);
    statement.run = async () => {
      if (/UPDATE work_orders\s+SET engineer_id/.test(sql)) {
        env.DB.sqlite.exec("INSERT INTO business_record_assignments(kind,record_id,territory_id,owner_staff_id) VALUES ('work_order','order-a','a','a')");
        before = dispatchState(env);
      }
      return run();
    };
    return statement;
  };
  assert.equal((await dispatch(env, 'assign')).status, 409);
  assert.deepEqual(dispatchState(env), before);
});
for (const description of ['', '虚构验收 "尾款" / service 🔧\n第二行']) test(`paid business dispatch accepts database rows with reordered object keys${description ? ' and Unicode descriptions' : ''}`, async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign', description); confirmDispatchReceipts(env);
  const prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = sql => {
    const statement = prepare(sql), all = statement.all.bind(statement);
    statement.all = async () => {
      const result = await all();
      return { ...result, results: result.results.map(row => Object.fromEntries(Object.entries(row).reverse())) };
    };
    return statement;
  };
  const result = await dispatch(env, 'assign');
  assert.equal(result.status, 200, JSON.stringify(result.data));
});
for (const regional of [false, true]) test(`paid business dispatch preserves Admin start approval through ${regional ? 'regional delegation' : 'direct assignment'}`, async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign'); confirmDispatchReceipts(env);
  assert.equal(env.DB.sqlite.prepare("SELECT status FROM work_orders WHERE id='order-a'").get().status, 'pending_payment');
  if (regional) {
    assert.equal((await dispatch(env, 'assign-regional-lead')).status, 200);
    assert.equal((await dispatch(env, 'regional')).status, 200);
  } else assert.equal((await dispatch(env, 'assign')).status, 200);
  const order = env.DB.sqlite.prepare("SELECT engineer_id,status,started_at FROM work_orders WHERE id='order-a'").get();
  assert.deepEqual({ ...order }, { engineer_id: 'technician', status: 'pending_payment', started_at: null });
  const before = dispatchState(env);
  assert.equal((await dispatch(env, 'accept')).status, 409);
  assert.deepEqual(dispatchState(env), before);
});
const url = (ctx, extra = '') => `${path}?${new URLSearchParams(ctx)}${extra}`;
async function save(env, ctx, revision = 0, value = draft()) { return api(env, path, { method: 'PUT', body: { ...ctx, revision, ...value } }); }
async function submit(env, ctx, revision = 1) { return api(env, `${path}/submit`, { method: 'POST', body: { ...ctx, revision } }); }

test('business quote scope and identity fail closed and empty quote is private', async (t) => {
  const env = fixture(t), ctx = await context(env);
  const result = await api(env, url(ctx));
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.draft, null);
  assert.equal(result.data.currency, 'USD');
  assert.equal(result.data.service_mode, 'onsite');
  assert.match(result.headers.get('Cache-Control'), /private.*no-store/);
  assert.equal((await api(env, url(ctx).replace('order-a', 'order-b'))).status, 404);
  assert.equal((await api(env, url({ ...ctx, expected_staff_id: 'b' }))).status, 403);
  assert.equal((await api(env, `${path}?expected_staff_id=a`)).status, 409);
  env.DB.sqlite.prepare("INSERT INTO engineers(id,user_no,name,phone,password_hash) VALUES ('engineer-a','FICTIONAL-E-A','Fictional Unassigned Engineer','+12025550123','hash')").run();
  assert.equal((await api(env, url(ctx), { userType: 'engineer', id: 'engineer-a' })).status, 403);
});

test('incomplete direct costs save as unknown, explicit zero is complete and saved revisions submit once', async (t) => {
  const env = fixture(t), ctx = await context(env);
  const missing = await save(env, ctx, 0, draft({ costs: { parts_cost: 200 } }));
  assert.equal(missing.status, 200, JSON.stringify(missing.data));
  assert.equal(missing.data.estimate.total_cost, null);
  assert.equal((await submit(env, ctx)).status, 400);
  const saved = await save(env, ctx, 1);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.estimate.estimated_gross_profit, 1000);
  const submitted = await submit(env, ctx, 2);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
  assert.deepEqual(submitted.data.latest_quote, { quote_version: 1, status: 'pending_review', source: 'business' });
  assert.equal((await submit(env, ctx, 2)).status, 409);
  assert.equal(env.DB.sqlite.prepare('SELECT engineer_id FROM work_orders WHERE id=?').get('order-a').engineer_id, null);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM work_order_installments').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM business_quote_cost_snapshots').get().n, 1);
});

test('invalid money never creates draft or audit and revision and epoch races roll back', async (t) => {
  const env = fixture(t), ctx = await context(env);
  for (const value of [draft({ labor_fee: -1 }), draft({ labor_fee: 1.1 }), draft({ labor_fee: '1' }), draft({ labor_fee: Number.MAX_SAFE_INTEGER }), draft({ costs: { parts_cost: -1 } })]) {
    assert.equal((await save(env, ctx, 0, value)).status, 400);
  }
  assert.equal((await save(env, ctx)).status, 200);
  assert.equal((await save(env, ctx)).status, 409);
  const batch = env.DB.batch.bind(env.DB);
  env.DB.batch = async statements => { env.DB.sqlite.prepare("DELETE FROM business_director_territories WHERE staff_id='a'").run(); return batch(statements); };
  assert.equal((await submit(env, ctx)).status, 409);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM work_order_pricing').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM business_quote_cost_snapshots').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT revision FROM business_quote_drafts').get().revision, 1);
});

test('Admin alone approves immutable exact version costs and customer confirms unassigned public quote', async (t) => {
  const env = fixture(t), ctx = await context(env);
  assert.equal((await save(env, ctx)).status, 200);
  assert.equal((await submit(env, ctx)).status, 200);
  const reviewPath = '/api/admin/workorders/order-a/pricing/approve';
  assert.equal((await api(env, reviewPath, { method: 'PATCH', body: { quote_version: 1 } })).status, 403);
  assert.equal((await api(env, reviewPath, { id: 'admin', method: 'PATCH', body: { quote_version: 2 } })).status, 409);
  const admin = await context(env, 'admin');
  const cost = await api(env, `${path}/costs?${new URLSearchParams(admin)}&quote_version=1`, { id: 'admin' });
  assert.equal(cost.status, 200, JSON.stringify(cost.data));
  assert.equal(cost.data.quote_version, 1);
  assert.equal(cost.data.estimate.total_cost, 500);
  assert.throws(() => env.DB.sqlite.prepare('UPDATE business_quote_cost_snapshots SET parts_cost=999').run(), /immutable/);
  assert.equal((await api(env, reviewPath, { id: 'admin', method: 'PATCH', body: { quote_version: 1 } })).status, 200);
  const publicQuote = await api(env, '/api/workorders/order-a/pricing', { userType: 'customer', id: 'customer-a' });
  assert.equal(publicQuote.status, 200);
  assert.equal(publicQuote.data.pricing.total_amount, 1500);
  assert.doesNotMatch(JSON.stringify(publicQuote.data), /parts_cost|engineer_cost|estimated_gross|author_staff_id/);
  const confirmed = await api(env, '/api/workorders/order-a/pricing/confirm', { userType: 'customer', id: 'customer-a', method: 'POST', body: { quote_version: 1 } });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
  assert.equal(env.DB.sqlite.prepare('SELECT engineer_id FROM work_orders WHERE id=?').get('order-a').engineer_id, null);
});

test('rejection returns to business author and revised submission preserves both cost snapshots', async (t) => {
  const env = fixture(t), ctx = await context(env);
  await save(env, ctx); await submit(env, ctx);
  assert.equal((await save(env, ctx, 1)).status, 409);
  const rejected = await api(env, '/api/admin/workorders/order-a/pricing/reject', { id: 'admin', method: 'PATCH', body: { quote_version: 1, note: 'Fictional correction' } });
  assert.equal(rejected.status, 200);
  const notification = env.DB.sqlite.prepare("SELECT user_id,user_type FROM notifications WHERE type='quote_review_rejected'").get();
  assert.deepEqual({ ...notification }, { user_id: 'a', user_type: 'admin' });
  assert.equal((await submit(env, ctx, 1)).status, 409);
  assert.equal((await save(env, ctx, 1, draft({ costs: { parts_cost: 400, engineer_cost: 300, travel_cost: 0, other_cost: 0 } }))).status, 200);
  assert.equal((await submit(env, ctx, 2)).data.latest_quote.quote_version, 2);
  assert.deepEqual(env.DB.sqlite.prepare('SELECT parts_cost FROM business_quote_cost_snapshots ORDER BY quote_version').all().map(row => row.parts_cost), [200, 400]);
  const text = JSON.stringify(env.DB.sqlite.prepare('SELECT * FROM work_order_messages').all()) + JSON.stringify(env.DB.sqlite.prepare('SELECT * FROM audit_logs').all());
  assert.doesNotMatch(text, /parts_cost|engineer_cost|estimated_gross/);
});

test('engineer cannot overwrite a business draft even before its first submission', async (t) => {
  const env = fixture(t), ctx = await context(env);
  env.DB.sqlite.exec("INSERT INTO engineers(id,user_no,name,phone,password_hash) VALUES ('engineer-a','E-FIXTURE','Fictional Engineer','000-fictional','hash'); UPDATE work_orders SET engineer_id='engineer-a' WHERE id='order-a';");
  assert.equal((await save(env, ctx)).status, 200);
  const engineer = await api(env, '/api/workorders/order-a/pricing', { method: 'POST', userType: 'engineer', id: 'engineer-a', body: draft() });
  assert.equal(engineer.status, 403, JSON.stringify(engineer.data));
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM work_order_pricing').get().n, 0);
});

test('revision and audit races leave pricing history schedules and private snapshot atomic', async (t) => {
  const env = fixture(t), ctx = await context(env);
  await save(env, ctx);
  const batch = env.DB.batch.bind(env.DB);
  env.DB.batch = async statements => { env.DB.sqlite.exec('UPDATE business_quote_drafts SET revision=2'); return batch(statements); };
  assert.equal((await submit(env, ctx)).status, 409);
  for (const table of ['work_order_pricing', 'work_order_pricing_history', 'work_order_payment_schedule', 'business_quote_cost_snapshots']) assert.equal(env.DB.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n, 0);
  env.DB.batch = batch;
  env.DB.sqlite.exec("CREATE TRIGGER fail_quote_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'fictional audit failure'); END;");
  assert.equal((await submit(env, ctx, 2)).status, 500);
  for (const table of ['work_order_pricing', 'work_order_pricing_history', 'work_order_payment_schedule', 'business_quote_cost_snapshots']) assert.equal(env.DB.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT submitted_revision FROM business_quote_drafts').get().submitted_revision, null);
});

test('customer stale rejection cannot reopen a business version and legacy quotes cannot be taken over', async (t) => {
  const env = fixture(t), ctx = await context(env);
  await save(env, ctx); await submit(env, ctx);
  await api(env, '/api/admin/workorders/order-a/pricing/approve', { id: 'admin', method: 'PATCH', body: { quote_version: 1 } });
  const rejected = await api(env, '/api/workorders/order-a/pricing/reject', { id: 'customer-a', userType: 'customer', method: 'POST', body: { quote_version: 2, reason: 'Fictional correction' } });
  assert.equal(rejected.status, 409);
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM work_order_pricing').get().status, 'submitted');
  env.DB.sqlite.prepare("INSERT INTO work_order_pricing(id,work_order_id,status,total_amount) VALUES ('legacy','order-b','confirmed',1000)").run();
  const b = await context(env, 'b');
  const legacy = await api(env, `${url(b).replace('order-a', 'order-b')}`, { id: 'b' });
  assert.equal(legacy.data.can_edit, false);
  assert.equal(legacy.data.edit_block_reason, 'business_quote_legacy_preserved');
});

test('052 preserves historical quotes and fresh schema has equivalent private tables', (t) => {
  const legacy = new DatabaseSync(':memory:'), fresh = fixture(t).DB.sqlite;
  t.after(() => legacy.close());
  legacy.exec("CREATE TABLE work_orders(id TEXT PRIMARY KEY); CREATE TABLE work_order_pricing(id TEXT PRIMARY KEY,status TEXT,total_amount INTEGER); CREATE TABLE work_order_pricing_history(id TEXT PRIMARY KEY,status TEXT); CREATE TABLE _migrations(version TEXT PRIMARY KEY,note TEXT); INSERT INTO work_order_pricing VALUES ('old','confirmed',2500);");
  legacy.exec(readFileSync(new URL('../migrations/052_business_quote_costs.sql', import.meta.url), 'utf8'));
  assert.deepEqual({ ...legacy.prepare('SELECT * FROM work_order_pricing').get() }, { id: 'old', status: 'confirmed', total_amount: 2500, quote_source: 'engineer' });
  for (const table of ['business_quote_drafts', 'business_quote_cost_snapshots']) assert.deepEqual(legacy.prepare(`PRAGMA table_info(${table})`).all(), fresh.prepare(`PRAGMA table_info(${table})`).all());
});

test('business approval requires fresh Admin identity scope and rejects a revocation race atomically', async (t) => {
  const env = fixture(t), ctx = await context(env);
  await save(env, ctx); await submit(env, ctx);
  const route = '/api/admin/workorders/order-a/pricing/approve';
  assert.equal((await api(env, route, { id: 'admin', method: 'PATCH', body: { quote_version: 1 }, omitReviewScope: true })).status, 400);
  const admin = await context(env, 'admin');
  env.DB.sqlite.exec("UPDATE business_scope_version SET revision=revision+1 WHERE id=1");
  assert.equal((await api(env, route, { id: 'admin', method: 'PATCH', body: { ...admin, quote_version: 1 } })).status, 409);
  const batch = env.DB.batch.bind(env.DB);
  env.DB.batch = async statements => { env.DB.sqlite.exec('UPDATE business_scope_version SET revision=revision+1 WHERE id=1'); return batch(statements); };
  assert.equal((await api(env, route, { id: 'admin', method: 'PATCH', body: { quote_version: 1 } })).status, 409);
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM work_order_pricing').get().status, 'pending_review');
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM work_order_pricing_history').get().status, 'pending_review');
});

test('review cannot approve public totals changed after loading the private exact-version snapshot', async (t) => {
  const env = fixture(t), ctx = await context(env);
  await save(env, ctx); await submit(env, ctx);
  const batch = env.DB.batch.bind(env.DB);
  env.DB.batch = async statements => { env.DB.sqlite.exec('UPDATE work_order_pricing_history SET total_amount=999'); return batch(statements); };
  const approved = await api(env, '/api/admin/workorders/order-a/pricing/approve', { id: 'admin', method: 'PATCH', body: { quote_version: 1 } });
  assert.equal(approved.status, 409);
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM work_order_pricing').get().status, 'pending_review');
});

const lifecycleActions = ['admin-approve', 'admin-reject', 'customer-reject', 'customer-confirm'];
async function lifecycle(env, action) {
  const admin = action.startsWith('admin');
  return api(env, admin ? `/api/admin/workorders/order-a/pricing/${action.slice(6)}` : `/api/workorders/order-a/pricing/${action.slice(9)}`, {
    id: admin ? 'admin' : 'customer-a', userType: admin ? 'admin' : 'customer', method: admin ? 'PATCH' : 'POST',
    body: { quote_version: 1, note: 'Fictional correction', reason: 'Fictional correction' },
  });
}
async function pendingLifecycle(env, action) {
  const ctx = await context(env);
  await save(env, ctx); await submit(env, ctx);
  if (action.startsWith('customer')) assert.equal((await lifecycle(env, 'admin-approve')).status, 200);
}
function lifecycleState(env) {
  const db = env.DB.sqlite;
  return {
    pricing: db.prepare('SELECT * FROM work_order_pricing').all(), history: db.prepare('SELECT * FROM work_order_pricing_history').all(),
    installments: db.prepare('SELECT * FROM work_order_installments').all(), messages: db.prepare('SELECT * FROM work_order_messages').all(),
    audit: db.prepare('SELECT * FROM audit_logs').all(), notifications: db.prepare('SELECT * FROM notifications').all(),
  };
}
for (const action of lifecycleActions) for (const race of [false, true]) {
  test(`cancelled business work order cannot be revived by ${action}${race ? ' racing cancellation' : ''}`, async (t) => {
    const env = fixture(t);
    await pendingLifecycle(env, action);
    const before = lifecycleState(env);
    const cancel = async () => assert.equal((await api(env, '/api/workorders/order-a/cancel', { id: 'customer-a', userType: 'customer', method: 'POST', body: {} })).status, 200);
    if (race) {
      const batch = env.DB.batch.bind(env.DB);
      env.DB.batch = async statements => { env.DB.batch = batch; await cancel(); return batch(statements); };
    } else await cancel();
    const result = await lifecycle(env, action);
    assert.equal(result.status, 409, JSON.stringify(result.data));
    assert.equal(env.DB.sqlite.prepare("SELECT status FROM work_orders WHERE id='order-a'").get().status, 'cancelled');
    assert.deepEqual(lifecycleState(env), before);
  });
}
for (const action of ['admin-approve', 'customer-reject', 'customer-confirm']) for (const active of ['version', 'installment']) {
  test(`${action} business transaction fails closed when an active ${active} appears before commit`, async (t) => {
    const env = fixture(t);
    await pendingLifecycle(env, action);
    const batch = env.DB.batch.bind(env.DB);
    let before;
    env.DB.batch = async statements => {
      env.DB.batch = batch;
      if (active === 'version') env.DB.sqlite.exec("UPDATE work_orders SET active_quote_version=1 WHERE id='order-a'");
      else env.DB.sqlite.exec("INSERT INTO work_order_installments(id,schedule_id,work_order_id,quote_version,sequence,amount,currency,trigger_type,due_date,description,required_before_start) SELECT 'fixture-active',id,work_order_id,quote_version,sequence,amount,currency,trigger_type,due_date,description,required_before_start FROM work_order_payment_schedule WHERE work_order_id='order-a'");
      before = lifecycleState(env);
      return batch(statements);
    };
    const result = await lifecycle(env, action);
    assert.equal(result.status, 409, JSON.stringify(result.data));
    assert.equal(env.DB.sqlite.prepare("SELECT status FROM work_orders WHERE id='order-a'").get().status, 'pricing');
    assert.deepEqual(lifecycleState(env), before);
  });
}

for (const market of ['com', 'cn']) test(`business rejection preserves customer counter offer in ${market === 'cn' ? 'CNY' : 'USD'} without changing formal amounts`, async (t) => {
  const env = fixture(t);
  if (market === 'cn') {
    env.testMarket = market;
    env.DB_CN = env.DB;
    env.DB.sqlite.exec("UPDATE admin_staff_accounts SET market_scope='cn'; UPDATE business_territories SET market='cn'");
  }
  await pendingLifecycle(env, 'customer-reject');
  const result = await api(env, '/api/workorders/order-a/pricing/reject', { id: 'customer-a', userType: 'customer', method: 'POST', body: { quote_version: 1, reason: 'Fictional negotiation', counter_offer: 1280 } });
  assert.equal(result.status, 200);
  const message = env.DB.sqlite.prepare("SELECT content FROM work_order_messages WHERE sender_type='customer'").get().content;
  assert.match(message, /Fictional negotiation/);
  assert.match(message, market === 'cn' ? /CNY 1280/ : /USD 1280/);
  assert.doesNotMatch(message, /parts_cost|engineer_cost|estimated_gross/);
  assert.equal(env.DB.sqlite.prepare('SELECT total_amount FROM work_order_pricing').get().total_amount, 1500);
  assert.equal(env.DB.sqlite.prepare('SELECT total_amount FROM work_order_pricing_history').get().total_amount, 1500);
  assert.equal(env.DB.sqlite.prepare('SELECT quoted_amount FROM business_quote_cost_snapshots').get().quoted_amount, 1500);
});

test('invalid business counter offers do not reopen quotes or create negotiation messages', async (t) => {
  const env = fixture(t);
  await pendingLifecycle(env, 'customer-reject');
  const before = lifecycleState(env);
  for (const counter_offer of [0, -1, 1.5, '1280', false, {}, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await api(env, '/api/workorders/order-a/pricing/reject', { id: 'customer-a', userType: 'customer', method: 'POST', body: { quote_version: 1, reason: 'Fictional negotiation', counter_offer } });
    assert.equal(result.status, 400, JSON.stringify(result.data));
    assert.deepEqual(lifecycleState(env), before);
  }
});

for (const source of ['admin', 'customer']) test(`scoped business quote exposes exact-version ${source} feedback without leaking another territory or old-version feedback`, async (t) => {
  const env = fixture(t), ctx = await context(env);
  await pendingLifecycle(env, `${source}-reject`);
  const note = 'Fictional revision: please explain the parts quantity';
  const result = source === 'admin'
    ? await api(env, '/api/admin/workorders/order-a/pricing/reject', { id: 'admin', method: 'PATCH', body: { quote_version: 1, note } })
    : await api(env, '/api/workorders/order-a/pricing/reject', { id: 'customer-a', userType: 'customer', method: 'POST', body: { quote_version: 1, reason: note, counter_offer: 1280 } });
  assert.equal(result.status, 200);
  const own = await api(env, url(ctx));
  assert.equal(own.status, 200);
  assert.equal(own.data.latest_quote.feedback?.quote_version, 1);
  assert.equal(own.data.latest_quote.feedback.source, source);
  assert.match(own.data.latest_quote.feedback.message, /please explain the parts quantity/);
  assert.doesNotMatch(own.data.latest_quote.feedback.message, /engineer|工程师|parts_cost|estimated_gross/);
  if (source === 'customer') assert.match(own.data.latest_quote.feedback.message, /USD 1280/);
  const other = await context(env, 'b');
  assert.equal((await api(env, url(other), { id: 'b' })).status, 404);
  assert.equal((await save(env, ctx, 1)).status, 200);
  assert.equal((await submit(env, ctx, 2)).status, 200);
  const next = await api(env, url(ctx));
  assert.equal(next.data.latest_quote.quote_version, 2);
  assert.equal(next.data.latest_quote.feedback ?? null, null);
});
