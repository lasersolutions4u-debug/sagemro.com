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
    catch (error) { sqlite.exec('ROLLBACK'); t.diagnostic(error.message); throw error; }
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
  const response = await worker.fetch(new Request(`https://api.sagemro.com${route}`, { method, headers: { Origin: `https://admin.sagemro.${market}`, Authorization: `Bearer ${token}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) }), env, {});
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

const executionPath = '/api/admin/business/work-orders/order-a/execution';
async function execution(env, id = 'admin', extra = {}) {
  return api(env, executionPath + '?' + new URLSearchParams({ ...await context(env, id), ...extra }), { id });
}
async function assign(env, extra = {}, id = 'admin') {
  return api(env, executionPath + '/assign', { id, method: 'POST', body: { ...await context(env, id), quote_version: 1, revision: 0, executor_staff_id: 'a', reason: '当地暂无合作工程师，由商务人员安排后续服务准备', idempotency_key: 'fictional-first-assignment', ...extra } });
}
async function ready(t) { const env = dispatchFixture(t, 'assign'); await confirmedDispatchQuote(env, 'assign'); confirmDispatchReceipts(env); return env; }

const servicePath = '/api/admin/business/work-orders/order-a/service';

for(const resource of ['materials','field-media/fictional-media']) test('shared service read checks scope again before returning '+resource,async t=>{
  const env=await assigned(t);
  env.DB.sqlite.exec("INSERT INTO work_order_field_days(id,work_order_id,staff_id,site_local_date,site_timezone) VALUES ('fictional-day','order-a','a','2026-09-07','UTC');INSERT INTO work_order_field_day_media(id,work_order_id,field_day_id,purpose,object_key,mime_type,file_size,uploader_type,uploader_id,capture_source) VALUES ('fictional-media','order-a','fictional-day','check_in','fictional-key','image/png',8,'admin','a','check_in')");
  const ctx=await context(env);let injected=false;
  const revoke=()=>{injected=true;env.DB.sqlite.exec("UPDATE admin_staff_accounts SET is_active=0 WHERE id='a'");};
  if(resource==='materials'){const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=sql=>{const stmt=prepare(sql),all=stmt.all.bind(stmt);stmt.all=async()=>{if(sql.includes('SELECT id, material_code, category'))revoke();return all();};return stmt;};}
  else env.FIELD_EVIDENCE={async get(){revoke();return {body:new Uint8Array([137,80,78,71])};}};
  const result=await api(env,servicePath+'/'+resource+'?'+new URLSearchParams(ctx));
  assert.equal(injected,true);assert.ok([403,409].includes(result.status));
});


test('customer push is sent only after the service transaction commits',async t=>{
  const env=await assigned(t);
  env.DB.sqlite.exec("UPDATE customers SET onesignal_player_id='fictional-player' WHERE id='customer-a'");
  env.ONESIGNAL_APP_ID='fictional-app';env.ONESIGNAL_REST_API_KEY='fictional-nonproduction-key';
  const originalFetch=globalThis.fetch;let pushes=0;t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>{pushes+=1;return new Response('{}',{status:200});};
  const batch=env.DB.batch.bind(env.DB);env.DB.batch=async statements=>{assert.equal(pushes,0);return batch(statements);};
  const sent=await action(env,'messages',{content:'Fictional postcommit message'});
  assert.equal(sent.status,200);assert.equal(pushes,1);
});


test('business material catalog and report references stay inside the selected market',async t=>{
  const env=await started(t,'remote');
  env.DB.sqlite.exec("INSERT INTO materials(id,material_code,name,market) VALUES ('com-part','COM-1','Fictional COM part','com'),('cn-part','CN-1','Fictional CN part','cn')");
  const catalog=await api(env,servicePath+'/materials?'+new URLSearchParams({...await context(env),market:'cn'}));
  assert.equal(catalog.status,200,JSON.stringify(catalog.data));
  assert.deepEqual(catalog.data.list.map(row=>row.id),['com-part']);
  const rejected=await action(env,'report',{...completeReport,material_items:[{material_id:'cn-part',quantity:1,unit_price:0}]},'a','PUT');
  assert.equal(rejected.status,403);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM work_order_repair_records').get().n,0);
});


test('report material references survive save, refresh and a subsequent unchanged save', async t => {
  const env=await started(t,'remote');
  env.DB.sqlite.exec("INSERT INTO materials(id,material_code,name,market) VALUES ('fictional-part','FICT-1','Fictional service part','com')");
  const material={material_id:'fictional-part',quantity:2,unit_price:0,line_total:0};
  const saved=await action(env,'report',{...completeReport,material_items:[material]},'a','PUT');
  assert.equal(saved.status,200,JSON.stringify(saved.data));
  const refreshed=await service(env);
  assert.equal(refreshed.data.repair_record.material_items?.length,1);
  assert.equal(refreshed.data.repair_record.material_items[0].material_id,'fictional-part');
  const again=await action(env,'report',{...completeReport,material_items:refreshed.data.repair_record.material_items},'a','PUT');
  assert.equal(again.status,200,JSON.stringify(again.data));
  assert.equal((await service(env)).data.repair_record.material_items.length,1);
});
for(const mutation of [
  "UPDATE work_order_service_standard_progress SET state='pending' WHERE item_key='ready.start_conditions'",
  "UPDATE business_service_execution SET revision=revision+1",
  "UPDATE business_execution_assignments SET staff_id='b'",
]) test('authorization remains bound to the original view before snapshot guards: '+mutation, async t=>{
  const env=await assigned(t);await confirmStandards(env);
  const current=await service(env),values={...await context(env),quote_version:1,revision:current.data.revision,idempotency_key:'view-race'};
  const prepare=env.DB.prepare.bind(env.DB);let injected=false;
  env.DB.prepare=sql=>{if(!injected && sql.includes('SELECT CASE WHEN (SELECT COUNT(*) FROM work_orders')){injected=true;env.DB.sqlite.exec(mutation);}return prepare(sql);};
  const result=await api(env,servicePath+'/request-start',{method:'POST',body:values});
  assert.equal(injected,true);assert.equal(result.status,409,JSON.stringify(result.data));
  assert.equal(env.DB.sqlite.prepare('SELECT requested_at FROM business_service_execution').get().requested_at,null);
});
test('a postcommit view failure never deletes committed field evidence',async t=>{
  const env=await started(t),objects=new Map();
  env.FIELD_EVIDENCE={async put(key,bytes){objects.set(key,bytes);},async get(key){return objects.has(key)?{body:objects.get(key)}:null;},async delete(key){objects.delete(key);}};
  env.DB.sqlite.exec("UPDATE work_orders SET site_timezone='UTC',expected_service_days=2,expected_completion_date='2026-12-31',planned_daily_end_time='18:00' WHERE id='order-a'");
  const current=await service(env),form=new FormData();
  for(const [k,v] of Object.entries({...await context(env),quote_version:1,revision:current.data.revision,idempotency_key:'photo-committed'}))form.set(k,v);
  form.set('photo',new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0])],{type:'image/png'}),'fictional.png');
  const batch=env.DB.batch.bind(env.DB);env.DB.batch=async statements=>{const result=await batch(statements);env.DB.sqlite.exec("UPDATE admin_staff_accounts SET is_active=0 WHERE id='a'");return result;};
  await api(env,servicePath+'/field-days/check-in',{method:'POST',body:form});
  const media=env.DB.sqlite.prepare('SELECT object_key FROM work_order_field_day_media').get();
  assert.ok(media);assert.equal(objects.has(media.object_key),true);
});


test('accepted business service can collect its acceptance tail and archive only after audited settlement', async t => {
  const env=await started(t,'remote');await confirmStandards(env,4);await action(env,'report',completeReport,'a','PUT');await action(env,'complete');
  const accepted=await api(env,'/api/workorders/rating',{id:'customer-a',userType:'customer',method:'POST',body:{work_order_id:'order-a'}});
  assert.equal(accepted.status,200,JSON.stringify(accepted.data));
  const detail=await api(env,'/api/workorders/order-a',{id:'customer-a',userType:'customer'});
  assert.deepEqual(detail.data.service_execution,{type:'business',status:'accepted'});
  const tail=(await payments(env)).data.quote_execution.installments.find(row=>!row.required_before_start);
  assert.equal(tail.collection_start_ready,true);
  assert.equal((await startCollection(env,tail)).status,200);
  const claim=await submitReceipt(env,tail);assert.equal(claim.status,201,JSON.stringify(claim.data));
  assert.equal((await decideReceipt(env,tail,claim.data.claim)).status,200);
  const archived=await api(env,'/api/admin/workorders/order-a/archive',{id:'admin',method:'PATCH',body:{}});
  assert.equal(archived.status,200,JSON.stringify(archived.data));assert.equal(archived.data.status,'completed');
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM work_order_payouts").get().n,0);
});
test('business extension keeps real staff actor and approval notifies that staff', async t => {
  const env=await started(t);
  env.DB.sqlite.exec("UPDATE work_orders SET site_timezone='UTC',expected_service_days=2,expected_completion_date='2026-12-20' WHERE id='order-a'");
  const result=await action(env,'extensions',{reason:'Fictional part required',customer_explanation:'An additional planned visit is needed.',requested_additional_days:1,proposed_completion_date:'2026-12-21'});
  assert.equal(result.status,201,JSON.stringify(result.data));
  const extension=env.DB.sqlite.prepare('SELECT * FROM work_order_extension_requests').get();
  assert.equal(extension.staff_id,'a');assert.equal(extension.engineer_id,null);
  const approval=await api(env,'/api/admin/workorders/order-a/extension-requests/'+extension.id+'/decision',{id:'admin',method:'POST',body:{decision:'approved',decision_reason:'Fictional service schedule approved'}});
  assert.equal(approval.status,200,JSON.stringify(approval.data));
  const notice=env.DB.sqlite.prepare("SELECT * FROM notifications WHERE type='field_extension_approved' AND user_type='admin'").get();
  assert.equal(notice?.user_id,'a');
});
for(const market of ['com','cn']) test('service lifecycle uses actual market: '+market,async t=>{
  const env=dispatchFixture(t,'assign');env.testMarket=market;
  if(market==='cn')env.DB.sqlite.exec("UPDATE admin_staff_accounts SET market_scope='cn';UPDATE business_territories SET market='cn'");
  await confirmedDispatchQuote(env,'assign');confirmDispatchReceipts(env);assert.equal((await assign(env)).status,201);
  await confirmStandards(env);assert.equal((await action(env,'request-start')).status,200);assert.equal((await action(env,'approve-start',{},'admin')).status,200);
  const notice=env.DB.sqlite.prepare("SELECT title FROM notifications WHERE type='business_service_start' LIMIT 1").get();
  assert.equal(notice.title,market==='cn'?'服务开工审批':'Service start approval');
});


test('customer service message notifies only the assigned active business executor', async t => {
  const env=await assigned(t);
  const result=await api(env,'/api/workorders/order-a/messages',{id:'customer-a',userType:'customer',method:'POST',body:{content:'Fictional customer service question'}});
  assert.equal(result.status,200);
  const rows=env.DB.sqlite.prepare("SELECT user_id,user_type FROM notifications WHERE type='work_order_message'").all();
  assert.deepEqual(rows.map(row=>({...row})),[{user_id:'a',user_type:'admin'}]);
});
test('Admin archive requires customer acceptance as well as all settled installments for internal staff', async t => {
  const env=await started(t,'remote');await confirmStandards(env,4);assert.equal((await action(env,'report',completeReport,'a','PUT')).status,200);assert.equal((await action(env,'complete')).status,200);
  let result=await api(env,'/api/admin/workorders/order-a/archive',{id:'admin',method:'PATCH',body:{}});
  assert.equal(result.status,409);
  const tail=env.DB.sqlite.prepare('SELECT * FROM work_order_installments WHERE required_before_start=0').get();
  env.DB.sqlite.prepare("UPDATE work_order_installments SET received_amount=amount,status='received' WHERE id=?").run(tail.id);
  result=await api(env,'/api/admin/workorders/order-a/archive',{id:'admin',method:'PATCH',body:{}});
  assert.equal(result.status,409,JSON.stringify(result.data));
});
test('business service never issues statements above the D1 parameter limit', async t => {
  const env=await assigned(t),prepare=env.DB.prepare.bind(env.DB);let largest=0;
  env.DB.prepare=sql=>{const stmt=prepare(sql),bind=stmt.bind.bind(stmt);stmt.bind=(...args)=>{largest=Math.max(largest,args.length);assert.ok(args.length<=100,'D1 supports at most 100 bound parameters per statement: '+args.length);return bind(...args);};return stmt;};
  assert.equal((await action(env,'standard/items/task.device_identity/confirm',{state:'confirmed'})).status,200);
  t.diagnostic('Largest binding count: '+largest);
});


for (const mutation of [
  "UPDATE admin_staff_accounts SET is_active=0 WHERE id='a'",
  "UPDATE business_record_assignments SET territory_id='b' WHERE record_id='order-a'",
  "UPDATE work_orders SET status='cancelled' WHERE id='order-a'",
  "UPDATE work_order_service_standard_progress SET state='pending' WHERE item_key='ready.start_conditions'",
]) test('business start atomically rejects state races: ' + mutation, async t => {
  const env = await assigned(t); await confirmStandards(env);
  const current = await service(env), values = { ...await context(env), quote_version:1,revision:current.data.revision,idempotency_key:'race' };
  const before = env.DB.sqlite.prepare('SELECT COUNT(*) n FROM business_service_actions').get().n;
  const batch=env.DB.batch.bind(env.DB);let injected=false;
  env.DB.batch=async statements=>{if(!injected){injected=true;env.DB.sqlite.exec(mutation);}return batch(statements);};
  const result=await api(env,servicePath+'/request-start',{method:'POST',body:values});
  assert.equal(result.status,409,JSON.stringify(result.data));
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM business_service_actions').get().n,before);
  assert.equal(env.DB.sqlite.prepare('SELECT requested_at FROM business_service_execution').get().requested_at,null);
});
test('business service idempotency and original receipt audits remain authoritative', async t => {
  const env=await assigned(t);await confirmStandards(env);
  const current=await service(env), values={...await context(env),quote_version:1,revision:current.data.revision,idempotency_key:'request-start-once'};
  const first=await api(env,servicePath+'/request-start',{method:'POST',body:values});assert.equal(first.status,200,JSON.stringify(first.data));
  const replay=await api(env,servicePath+'/request-start',{method:'POST',body:values});assert.equal(replay.status,200);assert.equal(replay.data.revision,first.data.revision);
  const stale=await api(env,servicePath+'/request-start',{method:'POST',body:{...values,idempotency_key:'different'}});assert.equal(stale.status,409);
  env.DB.sqlite.exec("DELETE FROM audit_logs WHERE action='installment_receipt_confirmed'");
  assert.equal((await action(env,'approve-start',{},'admin')).status,409);
});
test('service approval snapshots every required installment audit at commit', async t => {
  const env=await assigned(t);await confirmStandards(env);assert.equal((await action(env,'request-start')).status,200);
  const batch=env.DB.batch.bind(env.DB);let injected=false;
  env.DB.batch=async statements=>{if(!injected){injected=true;env.DB.sqlite.exec("DELETE FROM audit_logs WHERE action='installment_receipt_confirmed'");}return batch(statements);};
  assert.equal((await action(env,'approve-start',{},'admin')).status,409);
  assert.equal(env.DB.sqlite.prepare("SELECT approved_at FROM business_service_execution").get().approved_at,null);
});
test('client crafted execution context and unrelated engineer cannot write original handlers', async t => {
  const env=await assigned(t);
  assert.equal((await api(env, '/api/workorders/order-a/repair-record',{id:'technician',userType:'engineer',method:'POST',body:{...completeReport,_businessService:{staffId:'a'}}})).status,403);
  assert.equal((await api(env,servicePath+'/messages',{id:'a',method:'POST',body:{expected_staff_id:'admin',scope_version:(await context(env)).scope_version,quote_version:1,revision:0,idempotency_key:'spoof',content:'forged'}})).status,403);
});


test('onsite work enforces original photo and daily report requirements with real staff identity', async t => {
  const env = await started(t), objects = new Map();
  env.FIELD_EVIDENCE = { async put(key, bytes) { objects.set(key, bytes); }, async get(key) { const bytes = objects.get(key); return bytes ? { body: bytes } : null; }, async delete(key) { objects.delete(key); } };
  env.DB.sqlite.exec("UPDATE work_orders SET site_timezone='UTC',expected_service_days=2,quote_expected_service_days=2,expected_completion_date='2026-12-31',planned_daily_end_time='18:00' WHERE id='order-a'");
  const sendForm = async (name, form) => {
    const current = await service(env);
    for (const [key,value] of Object.entries({ ...await context(env), quote_version: 1, revision: current.data.revision, idempotency_key: crypto.randomUUID() })) form.set(key,value);
    return api(env, servicePath + '/' + name, { method: 'POST', body: form });
  };
  const empty = new FormData();
  assert.equal((await sendForm('field-days/check-in', empty)).status, 400);
  const form = new FormData(); form.set('photo', new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0])], { type: 'image/png' }), 'fictional.png');
  const checked = await sendForm('field-days/check-in', form);
  assert.equal(checked.status, 201, JSON.stringify(checked.data));
  const day = checked.data.result.field_day;
  assert.ok(day?.id, JSON.stringify(checked.data.result));
  const row = env.DB.sqlite.prepare('SELECT * FROM work_order_field_days WHERE id=?').get(day.id);
  assert.equal(row.engineer_id, null); assert.equal(row.staff_id, 'a');
  const missing = new FormData(); missing.set('labor_hours','2');
  assert.equal((await sendForm('field-days/' + day.id + '/report', missing)).status, 400);
  const report = new FormData();
  for (const key of ['completed_work','issues_risks','next_plan','customer_support_needed']) report.set(key, 'Fictional work detail');
  report.set('labor_hours','2'); report.set('internal_note','Private fictional internal details');
  report.set('progress_photos', new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0])], { type: 'image/png' }), 'fictional.png');
  const submitted = await sendForm('field-days/' + day.id + '/report', report);
  assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM work_order_field_days WHERE id=?').get(day.id).status, 'report_submitted');
  assert.equal(env.DB.sqlite.prepare('SELECT staff_id FROM work_order_arrival_checks').get().staff_id,'a');
  const customer = await api(env, '/api/workorders/order-a/field-days', { id: 'customer-a', userType: 'customer' });
  assert.equal(customer.status, 200);
  assert.ok(!JSON.stringify(customer.data).includes('Private fictional internal details'));
});

test('business messages use the actual staff name and private notes never notify the customer', async t => {
  const env = await assigned(t);
  const sent = await action(env,'messages',{ content: 'Fictional service scheduling question',sender_name:'Forged',sender_type:'engineer' });
  assert.equal(sent.status,200,JSON.stringify(sent.data));
  const row = env.DB.sqlite.prepare("SELECT * FROM work_order_messages WHERE content='Fictional service scheduling question'").get();
  assert.equal(row.sender_type,'admin'); assert.equal(row.sender_id,'a'); assert.equal(row.sender_name,'a');
  const count = env.DB.sqlite.prepare("SELECT COUNT(*) n FROM notifications WHERE user_type='customer'").get().n;
  assert.equal((await action(env,'messages',{ content:'Fictional internal note',is_internal_note:true })).status,200);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM notifications WHERE user_type='customer'").get().n,count);
});


async function confirmStandards(env, through = 2) {
  const snapshot = await service(env);
  for (const item of snapshot.data.service_standard.items.filter(item => item.stepIndex <= through && !['system','customer'].includes(item.owner))) {
    const result = await action(env, 'standard/items/' + item.key + '/confirm', { state: 'confirmed' }, item.owner === 'admin' ? 'admin' : 'a');
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
}
async function started(t, mode = 'onsite') {
  const env = await ready(t);
  if (mode === 'remote') env.DB.sqlite.exec("UPDATE work_orders SET service_mode='remote',arrival_verification_required=0 WHERE id='order-a'");
  assert.equal((await assign(env)).status, 201);
  await confirmStandards(env);
  assert.equal((await action(env, 'request-start')).status, 200);
  assert.equal((await action(env, 'approve-start', {}, 'admin')).status, 200);
  return env;
}
const completeReport = { symptom: 'Fictional machine stops during operation.', inspection_process: 'Inspected power isolation and control connections.', diagnosis: 'Found a disconnected control terminal.', solution: 'Restored and secured the control terminal connection.', verification_result: 'Repeated operating cycle and verified stable function.', follow_up_advice: 'Inspect connections during the next planned maintenance.', parts_used: [], labor_hours: 2 };

test('start approval requires assigned business, all required receipts, current scope and service standard', async t => {
  const env = await assigned(t);
  assert.equal((await action(env, 'request-start')).status, 409);
  assert.equal((await action(env, 'standard/items/ready.start_conditions/confirm', { state: 'confirmed' })).status, 403);
  assert.equal((await action(env, 'standard/items/task.device_identity/confirm', { state: 'confirmed' }, 'admin')).status, 403);
  await confirmStandards(env);
  assert.equal((await service(env)).data.capabilities.can_request_start, true);
  assert.equal((await action(env, 'request-start')).status, 200);
  assert.equal((await service(env)).data.work_order_status, 'payment_review');
  assert.equal((await action(env, 'approve-start')).status, 403);
  const before = await service(env, 'admin');
  assert.equal(before.data.capabilities.can_approve_start, true);
  const approved = await action(env, 'approve-start', {}, 'admin');
  assert.equal(approved.status, 200, JSON.stringify(approved.data));
  assert.equal(approved.data.work_order_status, 'in_service');
  assert.equal(approved.data.execution.approved_by, 'admin');
  assert.ok(approved.data.execution.approved_at);
  assert.equal((await service(env)).data.capabilities.can_edit, true);
  assert.equal(env.DB.sqlite.prepare("SELECT engineer_id FROM work_orders WHERE id='order-a'").get().engineer_id, null);
});

test('business final report uses original quality rules and customer acceptance without an engineer rating', async t => {
  const env = await started(t, 'remote');
  assert.equal((await action(env, 'report', completeReport, 'admin', 'PUT')).status, 403);
  assert.equal((await action(env, 'report', { labor_hours: -1 }, 'a', 'PUT')).status, 400);
  assert.equal((await action(env, 'complete')).status, 409);
  await confirmStandards(env, 4);
  assert.equal((await action(env, 'report', { symptom: 'x' }, 'a', 'PUT')).status, 200);
  assert.equal((await action(env, 'complete')).status, 400);
  const saved = await action(env, 'report', completeReport, 'a', 'PUT');
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const result = await action(env, 'complete');
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.work_order_status, 'resolved');
  const acceptance = await api(env, '/api/workorders/rating', { userType: 'customer', id: 'customer-a', method: 'POST', body: { work_order_id: 'order-a', rating_timeliness: 5, rating_technical: 5, rating_communication: 5, rating_professional: 5 } });
  assert.equal(acceptance.status, 200, JSON.stringify(acceptance.data));
  assert.ok(env.DB.sqlite.prepare("SELECT customer_confirmed_at FROM work_order_repair_records WHERE work_order_id='order-a'").get().customer_confirmed_at);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM ratings WHERE work_order_id='order-a'").get().n, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT status FROM work_orders WHERE id='order-a'").get().status, 'resolved');
});

async function service(env, id = 'a') { return api(env, servicePath + '?' + new URLSearchParams(await context(env, id)), { id }); }
async function action(env, name, values = {}, id = 'a', method = 'POST') {
  const current = await service(env, id);
  return api(env, servicePath + '/' + name, { id, method, body: { ...await context(env, id), quote_version: 1, revision: current.data.revision, idempotency_key: crypto.randomUUID(), ...values } });
}
async function assigned(t) { const env = await ready(t); assert.equal((await assign(env)).status, 201); return env; }

test('business service view exposes actual executor and keeps owner-only read-only', async t => {
  const env = await assigned(t), result = await service(env);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.execution.staff_id, 'a');
  assert.equal(result.data.capabilities.can_request_start, false);
  assert.equal(result.data.capabilities.can_confirm_execution_items, true);
  assert.equal(result.data.capabilities.can_approve_start, false);
  assert.equal((await service(env, 'admin')).data.capabilities.can_confirm_execution_items, false);
  assert.equal((await service(env, 'b')).status, 404);
  assert.equal(env.DB.sqlite.prepare("SELECT engineer_id FROM work_orders WHERE id='order-a'").get().engineer_id, null);
});

test('055 migration preserves engineer days, media, revisions and extension foreign keys', t => {
  const env = fixture(t), db = env.DB.sqlite;
  db.exec("PRAGMA foreign_keys=ON; INSERT INTO engineers(id,user_no,name,phone,password_hash) VALUES ('legacy','LEGACY','Fictional engineer','fictional','hash'); INSERT INTO work_order_field_days(id,work_order_id,engineer_id,site_local_date,site_timezone) VALUES ('day','order-a','legacy','2026-09-07','UTC'); INSERT INTO work_order_field_day_media(id,work_order_id,field_day_id,purpose,object_key,mime_type,file_size,uploader_type,uploader_id,capture_source) VALUES ('media','order-a','day','check_in','fictional-key','image/png',8,'engineer','legacy','check_in'); INSERT INTO work_order_field_day_revisions(id,work_order_id,field_day_id,previous_report,changed_by_type,changed_by_id,reason) VALUES ('revision','order-a','day','{}','admin','admin','fictional'); INSERT INTO work_order_extension_requests(id,work_order_id,field_day_id,engineer_id,reason,customer_explanation,requested_additional_days,proposed_completion_date,original_plan) VALUES ('extension','order-a','day','legacy','fictional','fictional',1,'2026-09-09','{}');");
  const migration = readFileSync(new URL('../migrations/055_business_service_execution.sql', import.meta.url), 'utf8');
  db.exec('BEGIN'); db.exec(migration); db.exec('COMMIT');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM work_order_field_day_media').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM work_order_field_day_revisions').get().n, 1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.throws(() => db.exec("INSERT INTO work_order_field_days(id,work_order_id,site_local_date,site_timezone) VALUES ('invalid','order-a','2026-09-07','UTC')"), /CHECK/);
  db.exec("INSERT INTO work_order_field_days(id,work_order_id,staff_id,site_local_date,site_timezone) VALUES ('business-day','order-a','a','2026-09-07','UTC')");
  assert.throws(() => db.exec("INSERT INTO work_order_field_days(id,work_order_id,engineer_id,staff_id,site_local_date,site_timezone) VALUES ('both','order-a','legacy','a','2026-09-08','UTC')"), /CHECK/);
});
