import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../worker/src/index.js';
import { signJwt } from '../../worker/src/lib/auth.js';
import { createServer } from '../../admin/node_modules/vite/dist/node/index.js';

const { chromium } = createRequire(import.meta.url)('playwright');

test('real business form and Admin dialogs collect and assign an unassigned order through Worker and SQLite', { timeout: 60_000 }, async t => {
  const sqlite = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true }); t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../../worker/schema.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; },
    async first() { return sqlite.prepare(sql).get(...args) || null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } }; },
    async batch(statements) { sqlite.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } } };
  sqlite.exec(`INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES ('biz-fixture','biz@example.invalid','fictional','fictional','operations','Fictional Director','com',0,1);
    INSERT INTO business_staff_profiles(staff_id,role,grade) VALUES ('biz-fixture','business_director',1);
    INSERT INTO business_territories(id,name,market) VALUES ('territory-fixture','Fictional territory','com');
    INSERT INTO business_director_territories(staff_id,territory_id) VALUES ('biz-fixture','territory-fixture');
    INSERT INTO customers(id,user_no,name,password_hash) VALUES ('customer-fixture','CUSTOMER-FIXTURE','Fictional Customer','fictional');
    INSERT INTO work_orders(id,order_no,customer_id,type,description,status,service_mode) VALUES ('order-fixture','ORDER-FIXTURE','customer-fixture','fault','Fictional request','pending','onsite');
    INSERT INTO business_record_assignments(kind,record_id,territory_id,owner_staff_id) VALUES ('work_order','order-fixture','territory-fixture','biz-fixture');`);
  const env = { DB, JWT_SECRET: 'fictional-local-receipt-browser-secret', ENVIRONMENT: 'development', KV: { async get() { return null; }, async put() {}, async delete() {} } };
  async function token(id) { return signJwt({ userId: id, userType: id === 'customer-fixture' ? 'customer' : 'admin', ...(id === 'biz-fixture' ? { staffId: id } : {}), market: 'com', exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET); }
  async function api(path, id = 'biz-fixture', method = 'GET', body) {
    const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, { method, headers: { Origin: 'https://admin.sagemro.com', Authorization: `Bearer ${await token(id)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }), env, {});
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data;
  }
  async function scope(id) { return { expected_staff_id: id, scope_version: (await api(`/api/admin/business/organization?expected_staff_id=${id}`, id)).scope_version }; }
  const businessContext = await scope('biz-fixture'), adminContext = await scope('admin');
  const base = '/api/admin/business/work-orders/order-fixture';
  await api(`${base}/quote`, 'biz-fixture', 'PUT', { ...businessContext, revision: 0, labor_fee: 900, parts_fee: 0, parts_detail: '', travel_fee: 0, other_fee: 0, expected_service_days: 1, payment_plan_mode: 'single', payment_schedule: [], costs: { parts_cost: 0, engineer_cost: 300, travel_cost: 0, other_cost: 0 } });
  await api(`${base}/quote/submit`, 'biz-fixture', 'POST', { ...businessContext, revision: 1 });
  await api('/api/admin/workorders/order-fixture/pricing/approve', 'admin', 'PATCH', { ...adminContext, quote_version: 1 });
  await api('/api/workorders/order-fixture/pricing/confirm', 'customer-fixture', 'POST', { quote_version: 1 });
  const moduleId = '\0payments-real-fixture';
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error', define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'local-payments-real-fixture', resolveId: id => id === '/payments-real-fixture.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BusinessPaymentPanel} from '/src/components/BusinessPaymentPanel.jsx'; import {BusinessExecutionPanel} from '/src/components/BusinessExecutionPanel.jsx'; import {WorkOrdersPage} from '/src/pages/WorkOrdersPage.jsx'; import '/src/index.css';
        createRoot(document.getElementById('root')).render(location.pathname==='/fixture-admin' ? React.createElement(WorkOrdersPage) : React.createElement(React.Fragment,null,React.createElement(BusinessPaymentPanel,{workOrderId:'order-fixture',expectedStaffId:'biz-fixture',scopeVersion:${JSON.stringify(businessContext.scope_version)},isCurrent:()=>true}),React.createElement(BusinessExecutionPanel,{workOrderId:'order-fixture',readOnly:true,expectedStaffId:'biz-fixture',scopeVersion:${JSON.stringify(businessContext.scope_version)},isCurrent:()=>true})));` : null }] });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  const decisions = [], errors = [];
  async function open(id, path) {
    const page = await browser.newPage(); page.setDefaultTimeout(6000); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(id => localStorage.setItem('admin_user', JSON.stringify({ staffRole: id === 'admin' ? 'admin' : 'business_director', staffId: id === 'admin' ? null : id })), id);
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()); if (url.hostname !== 'admin.sagemro.com') return route.abort();
      if (url.pathname.startsWith('/fixture-')) return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/payments-real-fixture.jsx"></script>' });
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname.endsWith('/decision')) decisions.push(request.postDataJSON());
        const response = await worker.fetch(new Request(`https://api.sagemro.com${url.pathname}${url.search}`, { method: request.method(), headers: { ...request.headers(), Origin: 'https://admin.sagemro.com', Authorization: `Bearer ${await token(id)}` }, ...(['GET','HEAD'].includes(request.method()) ? {} : { body: request.postDataBuffer() }) }), env, {});
        return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      }
      return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
    });
    await page.goto(`https://admin.sagemro.com${path}`); return page;
  }
  const business = await open('biz-fixture', '/fixture-business');
  await business.getByRole('button', { name: 'Start installment collection', exact: true }).waitFor();
  assert.equal(await business.getByText(/^(scheduled|due|exception)$/).count(), 0);
  await business.getByRole('button', { name: 'Start installment collection', exact: true }).click();
  await business.getByLabel('Receipt amount to verify', { exact: true }).fill('900');
  await business.getByLabel('Internal receipt note', { exact: true }).fill('Fictional bank receipt');
  await business.getByRole('button', { name: 'Submit receipt for review', exact: true }).click();
  await business.getByText('Awaiting Admin verification', { exact: true }).waitFor();
  const claim = sqlite.prepare('SELECT * FROM work_order_receipt_claims').get();
  assert.equal(claim.engineer_id, null); assert.equal(claim.submitted_by_staff_id, 'biz-fixture'); assert.equal(claim.status, 'pending');
  assert.equal(sqlite.prepare('SELECT received_amount FROM work_order_installments').get().received_amount, 0);
  const admin = await open('admin', '/fixture-admin');
  await admin.getByRole('button', { name: 'ORDER-FIXTURE', exact: true }).filter({ visible: true }).click();
  const confirm = admin.getByRole('button', { name: 'Confirm full receipt', exact: true });
  await confirm.waitFor(); await confirm.click();
  await admin.getByRole('button', { name: 'Confirm', exact: true }).click();
  await admin.waitForFunction(() => ![...document.querySelectorAll('button')].some(b => b.textContent === 'Confirm full receipt'));
  assert.equal(decisions.length, 1);
  assert.deepEqual({ expected_staff_id: decisions[0].expected_staff_id, scope_version: decisions[0].scope_version, quote_version: decisions[0].quote_version }, { ...adminContext, quote_version: 1 });
  assert.equal(sqlite.prepare('SELECT status FROM work_order_receipt_claims').get().status, 'confirmed');
  assert.equal(sqlite.prepare('SELECT engineer_id FROM work_orders').get().engineer_id, null);
  await business.getByRole('button', { name: 'Refresh payments', exact: true }).click();
  await business.getByText('Pre-start payment requirements met', { exact: true }).waitFor();
  const execution = admin.getByRole('region', { name: 'Service execution assignment', exact: true });
  await execution.getByRole('button', { name: 'Refresh assignment', exact: true }).click();
  await execution.getByLabel('Service executor', { exact: true }).selectOption('biz-fixture');
  await execution.getByLabel('Assignment reason (e.g. no local partner engineer)', { exact: true }).fill('Fictional local coverage gap');
  await execution.getByRole('button', { name: 'Assign business executor', exact: true }).click();
  await execution.getByText('Business executor assigned', { exact: true }).waitFor();
  const assigned = sqlite.prepare('SELECT * FROM business_execution_assignments').get();
  assert.equal(assigned.staff_id, 'biz-fixture'); assert.equal(assigned.assigned_by, 'admin'); assert.equal(assigned.revision, 1);
  const order = sqlite.prepare('SELECT engineer_id,status,started_at FROM work_orders').get();
  assert.equal(order.engineer_id, null); assert.equal(order.status, 'pending_payment'); assert.equal(order.started_at, null);
  assert.equal(sqlite.prepare("SELECT owner_staff_id FROM business_record_assignments WHERE kind='work_order'").get().owner_staff_id, 'biz-fixture');
  await business.getByRole('button', { name: 'Refresh assignment', exact: true }).click();
  await business.getByText('Business executor assigned', { exact: true }).waitFor();
  assert.equal(await business.getByRole('button', { name: /Assign business executor|Start service|Complete service/ }).count(), 0);
  await admin.reload();
  await admin.getByRole('button', { name: 'ORDER-FIXTURE', exact: true }).filter({ visible: true }).click();
  await admin.getByText('Business executor assigned', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
});

for (const market of ['com', 'cn']) test(`business payment form scopes uploads, retries safely and clears on identity change: ${market}`, { timeout: 60_000 }, async t => {
  const zh = market === 'cn';
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: zh ? 390 : 1366, height: 900 }, serviceWorkers: 'block' });
  t.after(() => context.close());
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const errors = [], receipts = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = { id: 'staff-fixture', staffId: 'staff-fixture', staffRole: 'business_specialist', name: 'Fictional Specialist' };
  const scope = 'scope-fixture';
  const order = { id: 'order-fixture', order_no: 'FICTIONAL-01', short_title: 'Fictional service', status: 'pending_payment', assignment_revision: 1 };
  const row = { id: 'installment-fixture', sequence: 1, amount: 900, received_amount: 0, quote_version: 1, currency: zh ? 'CNY' : 'USD',
    status: 'not_due', trigger_type: 'before_start', required_before_start: true, can_start_collection: true, can_submit_receipt: false };
  const state = { scope_version: scope, currency: row.currency, quote_version: 1, available: true, work_order_status: 'pending_payment',
    quote_execution: { installments: [row], receipt_claims: [], received_amount: 0, outstanding_amount: 1500, start_ready: false, payment_state: 'unpaid' } };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== `admin.sagemro.${market}`) return route.abort();
    if (url.pathname === '/fixture-switch') return route.fulfill({ contentType: 'text/html', body: '<title>Identity fixture</title>' });
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, userType: 'admin', user, csrfToken: 'fictional-csrf' } });
    assert.ok(url.pathname.startsWith('/api/admin/business/'));
    if (url.pathname.endsWith('/organization')) return route.fulfill({ json: { actor_staff_id: user.staffId, market, role: user.staffRole, grade: 1, staff: [], territories: [], can_assign: false, scope_version: scope } });
    if (url.pathname.endsWith('/records')) return route.fulfill({ json: { records: url.searchParams.get('kind') === 'work_order' ? [order] : [], total: 1, scope_version: scope } });
    if (url.pathname.includes('/records/')) return route.fulfill({ json: { record: order, scope_version: scope } });
    if (url.pathname.endsWith('/quote')) return route.fulfill({ json: { scope_version: scope, revision: 1, currency: row.currency, service_mode: 'onsite', draft: null, latest_quote: { quote_version: 1, source: 'business', status: 'confirmed' }, can_edit: false } });
    if (url.pathname.endsWith('/execution')) return route.fulfill({ json: { scope_version: scope, quote_version: 1, revision: 0, execution: null, candidates: [], can_assign: false, blocked_reason: 'payment_required' } });
    if (url.pathname.endsWith('/payments')) {
      assert.equal(url.searchParams.get('expected_staff_id'), user.staffId);
      assert.equal(url.searchParams.get('scope_version'), scope);
      return route.fulfill({ json: state });
    }
    assert.equal(request.headers()['x-csrf-token'], 'fictional-csrf');
    if (url.pathname.endsWith('/collection/start')) {
      assert.deepEqual(request.postDataJSON(), { expected_staff_id: user.staffId, scope_version: scope, quote_version: 1 });
      Object.assign(row, { status: 'collecting', can_start_collection: false, can_submit_receipt: true });
      return route.fulfill({ json: { installment: row } });
    }
    assert.match(url.pathname, /\/receipt-claims$/);
    assert.match(request.headers()['content-type'], /^multipart\/form-data; boundary=/);
    const body = await new Request('http://localhost/fixture', { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData();
    receipts.push({ key: body.get('idempotency_key'), amount: body.get('claimed_amount'), staff: body.get('expected_staff_id'), scope: body.get('scope_version'), version: body.get('quote_version'), file: body.get('evidence')?.name });
    if (receipts.length === 1) return route.fulfill({ status: 503, json: { error: 'Fictional uncertain response' } });
    Object.assign(row, { status: 'pending_confirmation', can_submit_receipt: false });
    state.quote_execution.receipt_claims = [{ id: 'claim-fixture', installment_id: row.id, status: 'pending', claimed_amount: 900, submitter_type: 'admin', submitter_id: user.staffId, submitter_note: 'Fictional transfer' }];
    return route.fulfill({ json: { claim: state.quote_execution.receipt_claims[0] } });
  });
  await page.goto(`https://admin.sagemro.${market}/`);
  await page.getByRole('button', { name: zh ? '服务工单' : 'Service Orders', exact: true }).click();
  await page.getByRole('button', { name: zh ? '查看详情' : 'View details', exact: true }).click();
  const panel = page.getByRole('region', { name: zh ? '商务收款' : 'Business payments', exact: true });
  await panel.waitFor();
  await panel.getByRole('button', { name: zh ? '发起本期收款' : 'Start installment collection', exact: true }).click();
  const amount = panel.getByLabel(zh ? '本次申请确认金额' : 'Receipt amount to verify', { exact: true });
  await amount.fill('901');
  const submit = panel.getByRole('button', { name: zh ? '提交到账审核' : 'Submit receipt for review', exact: true });
  assert.equal(await submit.isDisabled(), true);
  await amount.fill('9e2'); assert.equal(await submit.isDisabled(), true);
  await amount.fill('900');
  await panel.getByLabel(zh ? '内部收款备注' : 'Internal receipt note', { exact: true }).fill('Fictional transfer');
  await panel.getByLabel(zh ? '到账凭证（可选）' : 'Receipt evidence (optional)', { exact: true }).setInputFiles({ name: 'fictional.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfictional') });
  await submit.click(); await panel.getByRole('alert').filter({ hasText: 'Fictional uncertain response' }).waitFor();
  await submit.click();
  await panel.getByText(zh ? '待 Admin 确认' : 'Awaiting Admin verification', { exact: true }).waitFor();
  assert.equal(receipts.length, 2); assert.equal(receipts[0].key, receipts[1].key); assert.ok(receipts[0].key);
  assert.deepEqual({ ...receipts[1], key: null }, { key: null, amount: '900', staff: user.staffId, scope, version: '1', file: 'fictional.pdf' });
  assert.equal(await panel.getByRole('button', { name: zh ? '确认到账' : 'Confirm receipt', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  assert.doesNotMatch(storage, /Fictional transfer|fictional\.pdf|900/);
  const other = await context.newPage(); await other.goto(`https://admin.sagemro.${market}/fixture-switch`);
  await other.evaluate(() => localStorage.setItem('admin_user', JSON.stringify({ staffId: 'other-fixture', staffRole: 'business_specialist' })));
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
});
