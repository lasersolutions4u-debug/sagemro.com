import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

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
  return { DB, JWT_SECRET: secret, ENVIRONMENT: 'development', KV: { async get() { return null; }, async put() {}, async delete() {} } };
}
async function api(env, route = path, { id = 'a', method = 'GET', body, userType = 'admin', omitReviewScope = false } = {}) {
  if (id === 'admin' && /\/pricing\/(approve|reject)$/.test(route) && !omitReviewScope) body = { ...await context(env, id), ...body };
  const market = env.testMarket || 'com';
  const token = await signJwt({ userId: id, userType, market, ...(userType === 'admin' && id !== 'admin' ? { staffId: id, staffRole: 'admin' } : {}), exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
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
async function save(env, ctx, revision = 0, value = draft()) { return api(env, path, { method: 'PUT', body: { ...ctx, revision, ...value } }); }
async function submit(env, ctx, revision = 1) { return api(env, `${path}/submit`, { method: 'POST', body: { ...ctx, revision } }); }
async function lifecycle(env, action) {
  const admin = action.startsWith('admin');
  return api(env, admin ? `/api/admin/workorders/order-a/pricing/${action.slice(6)}` : `/api/workorders/order-a/pricing/${action.slice(9)}`, {
    id: admin ? 'admin' : 'customer-a', userType: admin ? 'admin' : 'customer', method: admin ? 'PATCH' : 'POST',
    body: { quote_version: 1, note: 'Fictional correction', reason: 'Fictional correction' },
  });
}
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

for (const route of dispatchRoutes) test('overseas unowned order cannot bypass paid business dispatch: ' + route, async t => {
  const env = dispatchFixture(t, route);
  env.DB.sqlite.exec("DELETE FROM business_record_assignments WHERE record_id='order-a'");
  const before = state(env);
  const result = await dispatch(env, route);
  assert.equal(result.status, 409, JSON.stringify(result.data));
  assert.deepEqual(state(env), before);
});

test('overseas engineer quote is forbidden without a business draft', async t => {
  const env = dispatchFixture(t, 'accept');
  env.DB.sqlite.exec("DELETE FROM business_record_assignments WHERE record_id='order-a'");
  const before = state(env);
  const result = await api(env, '/api/workorders/order-a/pricing', {
    id: 'technician', userType: 'engineer', method: 'POST', body: draft(),
  });
  assert.equal(result.status, 403, JSON.stringify(result.data));
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM work_order_pricing').get().n, 0);
  assert.deepEqual(state(env), before);
});

for (const admin of [false, true]) test('overseas legacy start requires confirmed business payment: ' + admin, async t => {
  const env = dispatchFixture(t, 'accept');
  env.DB.sqlite.exec("DELETE FROM business_record_assignments WHERE record_id='order-a'; UPDATE work_orders SET status='payment_review' WHERE id='order-a'; INSERT INTO work_order_payments(id,work_order_id,amount,status,payment_stage) VALUES ('legacy-payment','order-a',1500,'instructions_requested','advance')");
  const before = state(env);
  const result = await api(env, admin ? '/api/admin/workorders/order-a/payment/approve-start' : '/api/workorders/order-a/payment/start-request', {
    id: admin ? 'admin' : 'technician', userType: admin ? 'admin' : 'engineer', method: 'POST', body: {},
  });
  assert.equal(result.status, 409, JSON.stringify(result.data));
  assert.equal(result.data.code, 'business_dispatch_not_ready');
  assert.deepEqual(state(env), before);
});

for (const admin of [false, true]) test('overseas start rejects a stale unversioned order snapshot: ' + admin, async t => {
  const env = dispatchFixture(t, 'accept');
  await confirmedDispatchQuote(env, 'accept');
  confirmDispatchReceipts(env);
  env.DB.sqlite.exec("UPDATE work_orders SET status='payment_review' WHERE id='order-a'; INSERT INTO work_order_payments(id,work_order_id,amount,status,payment_stage) VALUES ('legacy-payment','order-a',1500,'instructions_requested','advance')");
  const before = state(env), prepare = env.DB.prepare.bind(env.DB);
  let injected = false;
  env.DB.prepare = sql => {
    const statement = prepare(sql), first = statement.first.bind(statement);
    statement.first = async () => {
      const row = await first();
      if (!injected && /SELECT id, engineer_id, status, order_no, customer_id, service_mode,\s+active_quote_version/.test(sql)) {
        injected = true;
        return { ...row, active_quote_version: null };
      }
      return row;
    };
    return statement;
  };
  const result = await api(env, admin ? '/api/admin/workorders/order-a/payment/approve-start' : '/api/workorders/order-a/payment/start-request', {
    id: admin ? 'admin' : 'technician', userType: admin ? 'admin' : 'engineer', method: 'POST', body: {},
  });
  assert.equal(injected, true);
  assert.equal(result.status, 409, JSON.stringify(result.data));
  assert.equal(result.data.code, 'business_dispatch_not_ready');
  assert.deepEqual(state(env), before);
});

for (const change of ["role='operations'", "is_active=0"]) test('historical Admin receipt confirmation remains valid after reviewer changes: ' + change, async t => {
  const env = dispatchFixture(t, 'assign');
  env.DB.sqlite.exec("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password) VALUES ('receipt-admin','receipt-admin@example.invalid','hash','salt','admin','Fictional Reviewer','com',0)");
  await confirmedDispatchQuote(env, 'assign');
  for (const installment of (await payments(env)).data.quote_execution.installments.filter(row => row.required_before_start)) {
    assert.equal((await startCollection(env, installment)).status, 200);
    const submitted = await submitReceipt(env, installment); assert.equal(submitted.status, 201);
    const decision = await decideReceipt(env, installment, submitted.data.claim, { id: 'receipt-admin' });
    assert.equal(decision.status, 200, JSON.stringify(decision.data));
  }
  assert.equal((await execution(env)).data.can_assign, true);
  env.DB.sqlite.exec("UPDATE admin_staff_accounts SET " + change + " WHERE id='receipt-admin'");
  const result = await assign(env);
  assert.equal(result.status, 201, JSON.stringify(result.data));
});
const receiptAuditMutations = [
  "DELETE FROM audit_logs WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET actor_type='business_director' WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET actor_id='a' WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET target_id='wrong-claim' WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET target_type='work_order' WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET action='installment_receipt_rejected' WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET after_state=json_set(after_state,'$.confirmed_amount',1) WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET after_state=json_set(after_state,'$.claim_status','rejected') WHERE action='installment_receipt_confirmed'",
  "UPDATE audit_logs SET after_state='invalid-json' WHERE action='installment_receipt_confirmed'",
];
for (const mutation of receiptAuditMutations) test('receipt confirmation requires matching trustworthy Admin audit: ' + mutation, async t => {
  const env = await ready(t); env.DB.sqlite.exec(mutation);
  const before = state(env), preview = await execution(env);
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.blocked_reason, 'payment_required');
  assert.equal((await assign(env)).status, 409); assert.deepEqual(state(env), before);
});
for (const mutation of receiptAuditMutations) test('receipt audit mutation at assignment commit is atomic: ' + mutation, async t => {
  const env = await ready(t), batch = env.DB.batch.bind(env.DB); let injected = false;
  env.DB.batch = async statements => { if (!injected) { injected = true; env.DB.sqlite.exec(mutation); } return batch(statements); };
  const notificationCount = env.DB.sqlite.prepare('SELECT COUNT(*) n FROM notifications').get().n;
  assert.equal((await assign(env)).status, 409); assert.equal(injected, true);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM business_execution_assignments').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM notifications').get().n, notificationCount);
});

test('execution candidate database queries stay bounded with thirty unrelated staff', async t => {
  const env = await ready(t), prepare = env.DB.prepare.bind(env.DB); let queries = 0;
  env.DB.prepare = sql => { queries += 1; return prepare(sql); };
  let ctx = await context(env, 'admin'); queries = 0;
  const small = await api(env, executionPath + '?' + new URLSearchParams(ctx), { id: 'admin' });
  assert.equal(small.status, 200); const baselineQueries = queries;
  for (let index = 0; index < 30; index += 1) {
    const id = 'unrelated-' + index;
    env.DB.sqlite.prepare("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES (?,?,'hash','salt','operations',?,'com',0,1)").run(id, id + '@example.invalid', id);
    env.DB.sqlite.prepare("INSERT INTO business_staff_profiles(staff_id,role,grade) VALUES (?,'business_director',1)").run(id);
  }
  ctx = await context(env, 'admin'); queries = 0;
  const large = await api(env, executionPath + '?' + new URLSearchParams(ctx), { id: 'admin' });
  assert.equal(large.status, 200); assert.deepEqual(large.data.candidates.map(row => row.id), ['a']);
  assert.ok(queries <= 35, 'GET queries must not grow with unrelated staff; actual=' + queries);
  assert.equal(queries, baselineQueries);
  const expandedQueries = queries;
  queries = 0;
  const result = await api(env, executionPath + '/assign', { id: 'admin', method: 'POST', body: {
    ...ctx, quote_version: 1, revision: 0, executor_staff_id: 'a', reason: 'No local cooperating engineer', idempotency_key: 'query-bound',
  } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(queries <= 65, 'POST queries must stay bounded; actual=' + queries);
  t.diagnostic(`GET: ${baselineQueries} queries for 2 staff, ${expandedQueries} for 32 staff; POST: ${queries} for 32 staff`);
});
test('invalid owner hierarchy never offers its otherwise valid director as executor', async t => {
  const env = await ready(t);
  env.DB.sqlite.exec("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES ('invalid-owner','invalid-owner@example.invalid','hash','salt','operations','Fictional invalid owner','com',0,1); INSERT INTO business_staff_profiles(staff_id,role,grade,supervisor_staff_id) VALUES ('invalid-owner','business_specialist',1,'a'); UPDATE business_record_assignments SET owner_staff_id='invalid-owner' WHERE record_id='order-a'");
  const result = await execution(env);
  assert.equal(result.status, 200); assert.deepEqual(result.data.candidates, []);
  assert.equal(result.data.blocked_reason, 'no_eligible_staff'); assert.equal((await assign(env)).status, 409);
});
for (const market of ['com','cn']) test('business execution internal notification follows market: ' + market, async t => {
  const env = dispatchFixture(t, 'assign');
  if (market === 'cn') {
    env.testMarket = 'cn';
    env.DB.sqlite.exec("UPDATE admin_staff_accounts SET market_scope='cn'; UPDATE business_territories SET market='cn'");
  }
  await confirmedDispatchQuote(env, 'assign'); confirmDispatchReceipts(env);
  assert.equal((await assign(env)).status, 201);
  const notification = env.DB.sqlite.prepare("SELECT * FROM notifications WHERE type='business_execution_assigned'").get();
  assert.equal(notification.user_type, 'admin'); assert.equal(notification.user_id, 'a');
  assert.equal(notification.title, market === 'cn' ? '商务执行指派' : 'Business execution assignment');
  assert.match(notification.body, market === 'cn' ? /完成服务标准后申请管理员批准开工/ : /Complete the service standard and request Admin approval to start/);
});

test('unquoted execution reports numeric zero quote version', async t => {
  const result = await execution(fixture(t)); assert.equal(result.data.quote_version, 0);
});
test('partial genuine receipts and unconfirmed business quote cannot assign', async t => {
  const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign'); confirmDispatchReceipts(env, 600);
  assert.equal((await execution(env)).data.blocked_reason, 'payment_required');
  assert.equal((await assign(env)).status, 409);
  env.DB.sqlite.exec("UPDATE work_order_pricing SET status='pending'");
  assert.equal((await execution(env)).data.blocked_reason, 'customer_confirmation_required');
});
test('candidate scope follows real hierarchy without extending manager or specialist ownership', async t => {
  const env = await ready(t);
  for (const [id, role, parent] of [['manager','business_manager','a'],['specialist','business_specialist','manager'],['other-manager','business_manager','a'],['other-specialist','business_specialist','other-manager']]) {
    env.DB.sqlite.prepare("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES (?,?,'hash','salt','operations',?,'com',0,1)").run(id, id + '@example.invalid', id);
    env.DB.sqlite.prepare('INSERT INTO business_staff_profiles(staff_id,role,grade,supervisor_staff_id) VALUES (?,?,1,?)').run(id, role, parent);
  }
  env.DB.sqlite.exec("UPDATE business_record_assignments SET owner_staff_id='specialist' WHERE record_id='order-a'");
  assert.deepEqual((await execution(env)).data.candidates.map(r => r.id), ['a','manager','specialist']);
  assert.equal((await assign(env, { executor_staff_id: 'other-manager' })).status, 403);
  assert.equal((await assign(env, { executor_staff_id: 'specialist' })).status, 201);
  assert.equal((await execution(env, 'specialist')).data.execution.staff_id, 'specialist');
  assert.equal((await execution(env, 'other-specialist')).status, 404);
});
test('real Admin can assign and Admin account disabled at commit rolls back all assignment writes', async t => {
  const env = await ready(t);
  env.DB.sqlite.exec("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password) VALUES ('actual-admin','admin@example.invalid','hash','salt','admin','Fictional Admin','com',0)");
  const batch = env.DB.batch.bind(env.DB); let injected = false;
  env.DB.batch = async statements => {
    if (!injected) { injected = true; env.DB.sqlite.exec("UPDATE admin_staff_accounts SET is_active=0 WHERE id='actual-admin'"); }
    return batch(statements);
  };
  assert.equal((await assign(env, {}, 'actual-admin')).status, 409);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM business_execution_assignments').get().n, 0);
  env.DB.batch = batch;
  env.DB.sqlite.exec("UPDATE admin_staff_accounts SET is_active=1 WHERE id='actual-admin'");
  assert.equal((await assign(env, {}, 'actual-admin')).status, 201);
});
test('ambiguous committed assignment recovers exactly once and rolls back internal notification failure', async t => {
  const env = await ready(t), batch = env.DB.batch.bind(env.DB); let lost = true;
  env.DB.batch = async statements => { const result = await batch(statements); if (lost) { lost = false; throw new Error('Fictional response lost after commit'); } return result; };
  assert.equal((await assign(env)).status, 200);
  const after = state(env); assert.equal((await assign(env)).status, 200); assert.deepEqual(state(env), after);
  const failed = await ready(t);
  failed.DB.sqlite.exec("CREATE TRIGGER reject_execution_notice BEFORE INSERT ON notifications WHEN NEW.type='business_execution_assigned' BEGIN SELECT RAISE(ABORT,'business execution notification failure'); END");
  const before = state(failed);
  assert.equal((await assign(failed)).status, 409); assert.deepEqual(state(failed), before);
});
test('full transaction final guards reject candidate changes injected after assignment insertion', async t => {
  const env = await ready(t);
  env.DB.sqlite.exec("CREATE TRIGGER disable_execution_candidate AFTER INSERT ON business_execution_assignments BEGIN UPDATE admin_staff_accounts SET is_active=0 WHERE id=NEW.staff_id; END");
  const before = state(env);
  assert.equal((await assign(env)).status, 409); assert.deepEqual(state(env), before);
  assert.equal(env.DB.sqlite.prepare("SELECT is_active FROM admin_staff_accounts WHERE id='a'").get().is_active, 1);
});
test('additive migration preserves legacy table definitions and rows and matches schema', async t => {
  const migration = readFileSync(new URL('../migrations/054_business_execution_assignments.sql', import.meta.url), 'utf8').trim();
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  assert.ok(schema.includes(migration));
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  sqlite.exec(schema.replace(migration, ''));
  sqlite.exec("INSERT INTO customers(id,user_no,name,password_hash) VALUES ('legacy-customer','LEGACY-C','Fictional Legacy','hash'); INSERT INTO engineers(id,user_no,name,phone,password_hash) VALUES ('legacy-engineer','LEGACY-E','Fictional Engineer','fictional-legacy','hash'); INSERT INTO work_orders(id,order_no,customer_id,type,description,status,engineer_id) VALUES ('legacy-order','LEGACY-O','legacy-customer','fault','Fictional legacy','in_service','legacy-engineer')");
  const definitions = sqlite.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const snapshots = definitions.filter(r => r.type === 'table' && r.name !== '_migrations').map(r => [r.name, sqlite.prepare('SELECT * FROM ' + r.name).all()]);
  sqlite.exec(migration);
  for (const row of definitions) assert.deepEqual(sqlite.prepare('SELECT type,name,sql FROM sqlite_master WHERE name=?').get(row.name), row);
  for (const [name, rows] of snapshots) assert.deepEqual(sqlite.prepare('SELECT * FROM ' + name).all(), rows);
  const reference = new DatabaseSync(':memory:'); t.after(() => reference.close()); reference.exec(schema);
  const additions = "SELECT type,name,sql FROM sqlite_master WHERE name LIKE 'business_execution_%' ORDER BY name";
  assert.deepEqual(sqlite.prepare(additions).all(), reference.prepare(additions).all());
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM _migrations WHERE version='054_business_execution_assignments'").get().n, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM business_execution_assignments').get().n, 0);
});
for (const route of ['assign','assign-regional-lead']) test('business assignment winning a concurrent engineer dispatch is not overwritten: ' + route, async t => {
  const env = await ready(t);
  const prepare = env.DB.prepare.bind(env.DB); let injected = false;
  env.DB.prepare = sql => {
    const statement = prepare(sql), run = statement.run.bind(statement);
    statement.run = async () => {
      if (!injected && /UPDATE work_orders/.test(sql)) {
        injected = true;
        env.DB.sqlite.exec("INSERT INTO business_execution_assignments(id,work_order_id,staff_id,staff_name,assigned_by,reason,revision,quote_version,market,idempotency_key,request_fingerprint,scope_snapshot) VALUES ('race','order-a','a','Fictional A','admin','No local engineer available',1,1,'com','race','race','{}')");
      }
      return run();
    };
    return statement;
  };
  const before = state(env), result = await dispatch(env, route);
  assert.equal(injected, true); assert.equal(result.status, 409, JSON.stringify(result.data));
  assert.deepEqual(state(env).work_orders, before.work_orders);
  assert.equal(env.DB.sqlite.prepare("SELECT staff_id FROM business_execution_assignments").get().staff_id, 'a');
  assert.deepEqual(state(env).notifications, before.notifications);
});

const executionPath = '/api/admin/business/work-orders/order-a/execution';
async function execution(env, id = 'admin', extra = {}) {
  return api(env, executionPath + '?' + new URLSearchParams({ ...await context(env, id), ...extra }), { id });
}
async function assign(env, extra = {}, id = 'admin') {
  return api(env, executionPath + '/assign', { id, method: 'POST', body: { ...await context(env, id), quote_version: 1, revision: 0, executor_staff_id: 'a', reason: '当地暂无合作工程师，由商务人员安排后续服务准备', idempotency_key: 'fictional-first-assignment', ...extra } });
}
async function ready(t) { const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign'); confirmDispatchReceipts(env); return env; }
function state(env) { return Object.fromEntries(['work_orders','business_execution_assignments','work_order_messages','work_order_logs','audit_logs','notifications'].map(table => [table, env.DB.sqlite.prepare('SELECT * FROM ' + table + ' ORDER BY id').all()])); }

test('unquoted execution is private read-only and owner is never implicitly executor', async t => {
  const env = fixture(t), before = env.DB.sqlite.prepare('SELECT total_changes() n').get().n;
  const result = await execution(env);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.execution, null); assert.equal(result.data.revision, 0);
  assert.equal(result.data.can_assign, false); assert.equal(result.data.blocked_reason, 'customer_confirmation_required');
  assert.deepEqual(result.data.candidates.map(s => s.id), ['a']);
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(env.DB.sqlite.prepare('SELECT total_changes() n').get().n, before);
});
test('paid assignment preserves service state and produces one private staff notification and audit', async t => {
  const env = await ready(t), before = state(env);
  const preview = await execution(env); assert.equal(preview.data.can_assign, true, JSON.stringify(preview.data));
  const result = await assign(env);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.execution.type, 'business'); assert.equal(result.data.execution.staff_id, 'a');
  assert.equal(result.data.execution.status, 'assigned'); assert.equal(result.data.revision, 1);
  assert.equal(result.data.blocked_reason, 'already_assigned');
  const after = state(env);
  for (const table of ['work_orders','work_order_messages','work_order_logs']) assert.deepEqual(after[table], before[table]);
  const notifications = after.notifications.filter(n => n.type === 'business_execution_assigned');
  assert.equal(notifications.length, 1); assert.equal(notifications[0].user_type, 'admin'); assert.equal(notifications[0].user_id, 'a');
  assert.equal(after.audit_logs.filter(a => a.action === 'business_execution_assigned').length, 1);
  assert.equal((await assign(env)).status, 200); assert.deepEqual(state(env), after);
  assert.equal((await assign(env, { reason: 'changed reason' })).status, 409);
  assert.equal((await assign(env, { idempotency_key: 'second' })).status, 409);
  assert.deepEqual(state(env), after);
});
for (const [mutation, code] of [
  ["UPDATE work_order_installments SET received_amount=0,status='scheduled' WHERE sequence=1", 'payment_required'],
  ["DELETE FROM work_order_receipt_claims", 'payment_required'],
  ["UPDATE work_order_receipt_claims SET decided_by=NULL", 'payment_required'],
  ["UPDATE work_order_receipt_claims SET decided_by='a'", 'payment_required'],
  ["UPDATE work_orders SET engineer_id='technician' WHERE id='order-a'", 'engineer_assigned'],
  ["UPDATE work_orders SET assigned_regional_lead_id='lead' WHERE id='order-a'", 'engineer_assigned'],
  ["UPDATE work_orders SET status='in_progress' WHERE id='order-a'", 'work_order_state_invalid'],
  ["UPDATE work_orders SET started_at='2026-09-07' WHERE id='order-a'", 'work_order_state_invalid'],
  ["UPDATE admin_staff_accounts SET is_active=0 WHERE id='a'", 'no_eligible_staff'],
  ["DELETE FROM business_record_assignments WHERE record_id='order-a'", 'no_eligible_staff'],
]) test('assignment rejects invalid eligibility: ' + mutation, async t => {
  const env = await ready(t); env.DB.sqlite.exec(mutation);
  const preview = await execution(env); assert.equal(preview.status, 200);
  assert.equal(preview.data.blocked_reason, code); assert.equal(preview.data.can_assign, false);
  const before = state(env); assert.equal((await assign(env)).status, 409); assert.deepEqual(state(env), before);
});
test('actual business role is read-only despite forged admin JWT role and out-of-scope staff cannot read', async t => {
  const env = await ready(t), before = state(env);
  const result = await execution(env, 'a'); assert.equal(result.status, 200);
  assert.deepEqual(result.data.candidates, []); assert.equal(result.data.blocked_reason, 'admin_required');
  assert.equal((await assign(env, {}, 'a')).status, 403); assert.equal((await execution(env, 'b')).status, 404);
  assert.deepEqual(state(env), before);
});
test('scope identity, payload bounds and target checks', async t => {
  const env = await ready(t);
  for (const [extra, status] of [[{ executor_staff_id: 'b' },403],[{ expected_staff_id: 'a' },403],[{ scope_version: 'stale' },409],[{ quote_version: 2 },409],[{ revision: 1 },409],[{ reason: '' },400],[{ reason: 'x'.repeat(65537) },413]]) {
    const before = state(env), result = await assign(env, extra); assert.equal(result.status, status, JSON.stringify(result.data)); assert.deepEqual(state(env), before);
  }
});
for (const mutation of [
  "UPDATE admin_staff_accounts SET is_active=0 WHERE id='a'",
  "UPDATE business_record_assignments SET owner_staff_id='b' WHERE record_id='order-a'",
  "UPDATE business_director_territories SET territory_id='b' WHERE staff_id='a'",
  "UPDATE work_order_receipt_claims SET confirmed_amount=1",
  "UPDATE work_order_pricing_history SET confirmed_at=NULL",
  "UPDATE work_orders SET engineer_id='technician' WHERE id='order-a'",
  "UPDATE work_orders SET started_at='2026-09-07' WHERE id='order-a'",
]) test('transaction guards reject mutation-time race: ' + mutation, async t => {
  const env = await ready(t), batch = env.DB.batch.bind(env.DB); let injected = false;
  env.DB.batch = async statements => { if (!injected) { injected = true; env.DB.sqlite.exec(mutation); } return batch(statements); };
  const before = env.DB.sqlite.prepare('SELECT COUNT(*) n FROM notifications').get().n;
  const result = await assign(env); assert.equal(injected, true); assert.equal(result.status, 409, JSON.stringify(result.data));
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM business_execution_assignments').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM notifications').get().n, before);
});
for (const route of dispatchRoutes) test('existing engineer route cannot overwrite business execution: ' + route, async t => {
  const env = await ready(t); assert.equal((await assign(env)).status, 201);
  const before = state(env), result = await dispatch(env, route);
  assert.ok(result.status >= 400 && result.status < 500, JSON.stringify(result.data)); assert.deepEqual(state(env), before);
});
test('business execution cannot pass legacy approve-start even after payment_review status manipulation', async t => {
  const env = await ready(t); assert.equal((await assign(env)).status, 201);
  env.DB.sqlite.exec("UPDATE work_orders SET status='payment_review' WHERE id='order-a'");
  const before = state(env);
  const result = await api(env, '/api/admin/workorders/order-a/payment/approve-start', { id: 'admin', method: 'POST', body: {} });
  assert.equal(result.status, 409, JSON.stringify(result.data)); assert.deepEqual(state(env), before);
  assert.throws(() => env.DB.sqlite.exec("UPDATE work_orders SET engineer_id='technician' WHERE id='order-a'"), /business execution/);
  assert.throws(() => env.DB.sqlite.exec("UPDATE work_orders SET status='in_service' WHERE id='order-a'"), /business execution/);
});
test('CN execution uses independent staff and market scope with private response', async t => {
  const env = fixture(t); env.testMarket = 'cn';
  assert.equal((await api(env, executionPath + '?expected_staff_id=a&scope_version=stale', { id: 'a' })).status, 403);
  env.DB.sqlite.exec("UPDATE admin_staff_accounts SET market_scope='cn'; UPDATE business_territories SET market='cn'");
  const cn = await execution(env); assert.equal(cn.status, 200); assert.equal(cn.headers.get('Cache-Control'), 'private, no-store');
  env.testMarket = 'com'; assert.equal((await execution(env)).status, 404);
});
