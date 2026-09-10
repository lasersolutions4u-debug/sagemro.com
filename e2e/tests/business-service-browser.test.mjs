import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../worker/src/index.js';
import { fixtureAdminEnv, signEnvSession } from '../../worker/tests/helpers/session-jwt.mjs';
import { createServer } from '../../admin/node_modules/vite/dist/node/index.js';
import { createServer as createFrontendServer } from '../../frontend/node_modules/vite/dist/node/index.js';

const { chromium } = createRequire(import.meta.url)('playwright');

for (const market of ['com', 'cn']) test(`real business onsite service ${market === 'com' ? 'from customer request' : 'from existing order'} through payment, reports and acceptance: ${market}`, { timeout: 90_000 }, async t => {
  const zh = market === 'cn', sqlite = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true }); t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../../worker/schema.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } }; },
    async batch(statements) { sqlite.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } } };
  sqlite.exec(`INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES ('biz-fixture','biz@example.invalid','fictional','fictional','operations','Fictional Director','${market}',0,1);
    INSERT INTO business_staff_profiles(staff_id,role,grade) VALUES ('biz-fixture','business_director',1);
    INSERT INTO business_territories(id,name,market) VALUES ('territory-fixture','Fictional territory','${market}');
    INSERT INTO business_director_territories(staff_id,territory_id) VALUES ('biz-fixture','territory-fixture');
    INSERT INTO customers(id,user_no,name,password_hash) VALUES ('customer-fixture','CUSTOMER-FIXTURE','Fictional Customer','fictional');`);
  if (zh) sqlite.exec(`
    INSERT INTO work_orders(id,order_no,customer_id,type,description,status,service_mode,site_timezone,planned_daily_end_time) VALUES ('order-fixture','ORDER-FIXTURE','customer-fixture','fault','Fictional request','pending','onsite','UTC','23:59');
    INSERT INTO business_record_assignments(kind,record_id,territory_id,owner_staff_id) VALUES ('work_order','order-fixture','territory-fixture','biz-fixture');`);
  const objects = new Map();
  const env = { ...fixtureAdminEnv, DB, JWT_SECRET: 'fictional-local-service-browser-secret', ENVIRONMENT: 'development', KV: { async get() { return null; }, async put() {}, async delete() {} },
    FIELD_EVIDENCE: { async put(key, bytes) { objects.set(key, bytes); }, async get(key) { const bytes = objects.get(key); return bytes ? { body: bytes } : null; }, async delete(key) { objects.delete(key); } } };
  const token = id => signEnvSession({ userId: id, userType: id === 'customer-fixture' ? 'customer' : 'admin', ...(id === 'biz-fixture' ? { staffId: id } : {}), market, exp: Math.floor(Date.now() / 1000) + 3600 }, env);
  let workOrderId = 'order-fixture';
  async function api(path, id = 'biz-fixture', method = 'GET', body) {
    path = path.replace('order-fixture', workOrderId);
    const multipart = body instanceof FormData;
    const pending = [];
    const response = await worker.fetch(new Request(`https://api.sagemro.${market}${path}`, { method, headers: { Origin: `https://admin.sagemro.${market}`, Authorization: `Bearer ${await token(id)}`, ...(multipart ? {} : { 'Content-Type': 'application/json' }) }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) }), env, { waitUntil(task) { pending.push(task); } });
    await Promise.all(pending);
    const data = await response.json(); assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`); return data;
  }
  async function scope(id) { return { expected_staff_id: id, scope_version: (await api(`/api/admin/business/organization?expected_staff_id=${id}`, id)).scope_version }; }
  if (!zh) {
    const created = await api('/api/workorders', 'customer-fixture', 'POST', {
      idempotency_key: 'fictional-overseas-service-request', type: 'fault', description: 'Fictional laser equipment stops during operation.', urgency: 'normal', service_mode: 'onsite',
      service_address: 'Fictional test site, Chicago', service_latitude: 41.88, service_longitude: -87.63,
      service_coordinate_system: 'wgs84', service_location_source: 'manual',
      intake: { service_request_kind: 'repair', device_types: ['fiber_laser_cutting_machine'], device_brands: ['Fictional Brand'], device_model: 'Fictional Model',
        region: ['United States', 'Illinois', 'Chicago'], alarm_code: 'FICTIONAL-01', production_impact: 'Fictional line stopped.',
        contact: { name: 'Fictional Customer', email: 'customer@example.invalid', phone: '', whatsapp: '', preference: 'email' } },
    });
    workOrderId = created.work_order.id;
    const storedOrder = sqlite.prepare('SELECT customer_id,engineer_id FROM work_orders WHERE id=?').get(workOrderId);
    assert.equal(storedOrder.customer_id, 'customer-fixture');
    assert.equal(storedOrder.engineer_id, null);
    await api(`/api/admin/business/records/work_order/${workOrderId}/assignment`, 'admin', 'PUT', {
      ...await scope('admin'), revision: 0, territory_id: 'territory-fixture', owner_staff_id: 'biz-fixture',
    });
    sqlite.prepare("UPDATE work_orders SET site_timezone='UTC',planned_daily_end_time='23:59' WHERE id=?").run(workOrderId);
  }
  const businessContext = await scope('biz-fixture'), adminContext = await scope('admin'), base = '/api/admin/business/work-orders/order-fixture';
  await api(`${base}/quote`, 'biz-fixture', 'PUT', { ...businessContext, revision: 0, labor_fee: 900, parts_fee: 0, parts_detail: '', travel_fee: 0, other_fee: 0, expected_service_days: 1,
    payment_plan_mode: 'installments', payment_schedule: [{ sequence: 1, amount: 600, currency: zh ? 'CNY' : 'USD', trigger_type: 'before_start', required_before_start: true }, { sequence: 2, amount: 300, currency: zh ? 'CNY' : 'USD', trigger_type: 'on_acceptance', required_before_start: false }], costs: { parts_cost: 0, engineer_cost: 300, travel_cost: 0, other_cost: 0 } });
  await api(`${base}/quote/submit`, 'biz-fixture', 'POST', { ...businessContext, revision: 1 });
  await api('/api/admin/workorders/order-fixture/pricing/approve', 'admin', 'PATCH', { ...adminContext, quote_version: 1 });
  await api('/api/workorders/order-fixture/pricing/confirm', 'customer-fixture', 'POST', { quote_version: 1 });
  const installment = sqlite.prepare('SELECT * FROM work_order_installments WHERE required_before_start=1').get();
  await api(`${base}/installments/${installment.id}/collection/start`, 'biz-fixture', 'POST', { ...businessContext, quote_version: 1 });
  const receipt = new FormData(); for (const [key, value] of Object.entries({ ...businessContext, quote_version: 1, claimed_amount: 600, idempotency_key: 'fictional-receipt', note: 'Fictional receipt' })) receipt.set(key, value);
  await api(`${base}/installments/${installment.id}/receipt-claims`, 'biz-fixture', 'POST', receipt);
  const claim = sqlite.prepare('SELECT * FROM work_order_receipt_claims').get();
  await api(`/api/admin/workorders/order-fixture/installments/${installment.id}/receipt-claims/${claim.id}/decision`, 'admin', 'POST', { ...adminContext, quote_version: 1, confirmed_amount: 600, decision: 'confirmed', idempotency_key: 'fictional-decision' });
  await api(`${base}/execution/assign`, 'admin', 'POST', { ...adminContext, quote_version: 1, revision: 0, executor_staff_id: 'biz-fixture', reason: 'Fictional coverage gap', idempotency_key: 'fictional-assignment' });
  const moduleId = '\0real-service-browser';
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error', define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'real-service-browser', resolveId: id => id === '/real-service.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BusinessServicePanel} from '/src/components/BusinessServicePanel.jsx'; import '/src/index.css'; createRoot(document.getElementById('root')).render(React.createElement(BusinessServicePanel,{workOrderId:${JSON.stringify(workOrderId)}}));` : null }] });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); t.after(() => browser.close());
  const errors = [], responses = [];
  async function open(id) {
    const page = await browser.newPage({ viewport: { width: zh ? 390 : 1366, height: 900 } }); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(id => localStorage.setItem('admin_user', JSON.stringify({ staffRole: id === 'admin' ? 'admin' : 'business_director', staffId: id === 'admin' ? null : id })), id);
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url()); if (url.hostname !== `admin.sagemro.${market}`) return route.abort();
      if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/real-service.jsx"></script>' });
      if (!url.pathname.startsWith('/api/')) return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
      const response = await worker.fetch(new Request(`https://api.sagemro.${market}${url.pathname}${url.search}`, { method: req.method(), headers: { ...req.headers(), Origin: `https://admin.sagemro.${market}`, Authorization: `Bearer ${await token(id)}` }, ...(['GET', 'HEAD'].includes(req.method()) ? {} : { body: req.postDataBuffer() }) }), env, {});
      const body = Buffer.from(await response.arrayBuffer()); if (!response.ok) responses.push([url.pathname, response.status, body.toString()]);
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body });
    });
    await page.goto(`https://admin.sagemro.${market}/fixture`); return page;
  }
  const business = await open('biz-fixture'), admin = await open('admin');
  t.after(() => { if (responses.length || errors.length) t.diagnostic(JSON.stringify({ responses, errors })); });
  const confirmLabel = zh ? '确认' : 'Confirm';
  await business.getByRole('button', { name: confirmLabel, exact: true }).first().waitFor();
  while (await business.getByRole('button', { name: confirmLabel, exact: true }).count()) {
    await business.getByRole('button', { name: confirmLabel, exact: true }).first().click();
    await business.waitForFunction(() => !document.querySelector('fieldset')?.disabled);
  }
  await admin.getByRole('button', { name: zh ? '刷新服务状态' : 'Refresh service', exact: true }).click();
  await admin.getByRole('button', { name: confirmLabel, exact: true }).click();
  await admin.waitForFunction(() => !document.querySelector('fieldset')?.disabled);
  await business.getByRole('button', { name: zh ? '刷新服务状态' : 'Refresh service', exact: true }).click();
  await business.getByRole('button', { name: zh ? '申请开工' : 'Request start', exact: true }).click();
  await business.getByText(zh ? '等待开工审批' : 'Awaiting start approval', { exact: true }).waitFor();
  await admin.getByRole('button', { name: zh ? '刷新服务状态' : 'Refresh service', exact: true }).click();
  await admin.getByRole('button', { name: zh ? '批准开工' : 'Approve start', exact: true }).click();
  await admin.getByText(zh ? '服务进行中' : 'Service in progress', { exact: true }).waitFor();
  await business.getByRole('button', { name: zh ? '刷新服务状态' : 'Refresh service', exact: true }).click();
  await business.getByRole('button', { name: zh ? '开始今日拍照签到' : "Start today's photo check-in", exact: true }).click();
  await business.getByRole('button', { name: zh ? '拍摄签到照片' : 'Capture check-in photo', exact: true }).click();
  await business.getByRole('button', { name: zh ? '确认今日签到' : 'Check in for today', exact: true }).click();
  const daily = business.locator('section[data-field-work-report]'); await daily.waitFor();
  const fields = daily.locator('textarea');
  for (let index = 0; index < 4; index++) await fields.nth(index).fill('Fictional daily service evidence');
  await daily.locator('input[type=number]').first().fill('2');
  await daily.locator('input[type=file]').first().setInputFiles({ name: 'fictional.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfL0AAAAASUVORK5CYII=', 'base64') });
  await daily.getByRole('button', { name: zh ? '提交现场日报' : 'Submit daily report', exact: true }).click(); await daily.waitFor({ state: 'detached' });
  for (const field of ['symptom', 'inspection_process', 'diagnosis', 'solution', 'verification_result']) await business.locator(`#service-report-${workOrderId}-${field}`).fill(`Fictional ${field} evidence sufficiently detailed for quality review.`);
  await business.getByRole('button', { name: zh ? '提交最终报告给客户' : 'Submit Final Report to Customer', exact: true }).click();
  await business.getByText(zh ? '等待客户验收' : 'Awaiting customer acceptance', { exact: true }).waitFor();
  const record = sqlite.prepare('SELECT * FROM work_order_repair_records').get(); assert.ok(record.submitted_at);
  const day = sqlite.prepare('SELECT * FROM work_order_field_days').get(); assert.equal(day.staff_id, 'biz-fixture'); assert.equal(day.engineer_id, null); assert.equal(day.status, 'report_submitted');
  assert.equal(sqlite.prepare('SELECT engineer_id FROM work_orders').get().engineer_id, null);
  assert.doesNotMatch(await business.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })), /Fictional daily|quality review/);
  await api('/api/workorders/rating', 'customer-fixture', 'POST', { work_order_id: workOrderId });
  assert.ok(sqlite.prepare('SELECT customer_confirmed_at FROM work_order_repair_records').get().customer_confirmed_at);
  assert.equal(sqlite.prepare('SELECT status FROM work_orders').get().status, 'resolved'); assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM ratings').get().n, 0);
  assert.equal(await business.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []); assert.deepEqual(responses, []);
});

test('customer accepts a business service without an engineer rating and keeps final payment separate', { timeout: 60_000 }, async t => {
  const moduleId = '\0service-customer-fixture';
  const server = await createFrontendServer({ root: fileURLToPath(new URL('../../frontend', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'service-customer-fixture', resolveId: id => id === '/customer-fixture.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client'; import {WorkOrderDetailContent} from '/src/components/WorkOrder/WorkOrderDetailModal.jsx';
        createRoot(document.getElementById('root')).render(React.createElement(WorkOrderDetailContent,{workOrder:{id:'order-fixture',status:'resolved'},userType:'customer',userId:'customer-fixture'}));` : null }] });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(5000); const writes = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const detail = { id: 'order-fixture', status: 'resolved', customer_id: 'customer-fixture', engineer_id: null, service_mode: 'remote',
    service_execution: { type: 'business', status: 'resolved' }, repair_record: { id: 'report-fixture', symptom: 'Fictional issue', diagnosis: 'Fictional detailed diagnosis', solution: 'Fictional detailed service action', submitted_at: '2026-09-07 10:00:00' } };
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname !== 'ai.sagemro.com') return route.abort();
    if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/customer-fixture.jsx"></script>' });
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
    if (req.method() === 'POST') {
      assert.equal(url.pathname, '/api/workorders/rating'); writes.push(req.postDataJSON());
      detail.service_execution.status = 'accepted'; detail.repair_record.customer_confirmed_at = '2026-09-07 10:30:00';
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: url.pathname === '/api/workorders/order-fixture' ? detail : { messages: [], field_days: [], items: [] } });
  });
  await page.goto('https://ai.sagemro.com/fixture');
  try { await page.getByRole('button', { name: 'Accept service report', exact: true }).click(); }
  catch (error) { t.diagnostic(JSON.stringify({ errors, text: await page.locator('body').innerText() })); throw error; }
  await page.getByText('Service report accepted. Final payment is tracked separately.', { exact: true }).waitFor();
  assert.deepEqual(writes, [{ work_order_id: 'order-fixture', customer_id: 'customer-fixture' }]);
  assert.equal(detail.status, 'resolved'); assert.deepEqual(errors, []);
});

for (const market of ['com', 'cn']) test(`business service shares reports with staff-only actions and no persistent draft: ${market}`, { timeout: 60_000 }, async t => {
  const zh = market === 'cn', moduleId = '\0service-browser-fixture';
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'service-browser-fixture', resolveId: id => id === '/service-fixture.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BusinessServicePanel} from '/src/components/BusinessServicePanel.jsx'; import '/src/index.css';
        createRoot(document.getElementById('root')).render(React.createElement(BusinessServicePanel,{workOrderId:'order-fixture'}));` : null }] });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: zh ? 390 : 1366, height: 900 }, serviceWorkers: 'block' }); t.after(() => context.close());
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  let role = 'business_manager', failOnce = true, failRefresh = false;
  const state = { scope_version: 'fixture-scope', quote_version: 1, revision: 1, execution: { staff_id: 'staff-fixture', status: 'assigned' },
    work_order_status: 'pending_payment', work_order: { id: 'order-fixture', status: 'pending_payment', service_mode: 'remote', active_quote_version: 1 },
    field_days: { field_days: [], media: [] }, service_standard: { items: [] }, repair_record: null, messages: [],
    capabilities: { can_request_start: true, can_approve_start: false, can_edit: false, can_complete: false, can_message: true } };
  await page.addInitScript(() => { if (!localStorage.getItem('admin_user')) localStorage.setItem('admin_user', JSON.stringify({ staffRole: 'business_manager', staffId: 'staff-fixture' })); localStorage.setItem('admin_csrf_token', 'fixture-csrf'); });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname !== `admin.sagemro.${market}`) return route.abort();
    if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/service-fixture.jsx"></script>' });
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
    if (url.pathname.endsWith('/organization')) return route.fulfill({ json: { scope_version: state.scope_version } });
    assert.match(url.pathname, /\/service(?:\/|$)/);
    if (req.method() === 'GET') {
      if (failRefresh) { failRefresh = false; return route.fulfill({ status: 503, json: { error: 'Fictional refresh failure' } }); }
      return route.fulfill({ json: state });
    }
    const body = req.postDataJSON(); writes.push({ action: url.pathname.split('/').at(-1), body });
    assert.equal(body.expected_staff_id, role === 'admin' ? 'admin' : 'staff-fixture');
    assert.equal(body.scope_version, state.scope_version); assert.equal(req.headers()['x-csrf-token'], 'fixture-csrf');
    if (url.pathname.endsWith('/request-start')) {
      if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { error: 'Fictional uncertain result' } }); }
      state.work_order_status = 'payment_review'; state.work_order.status = 'payment_review'; state.capabilities.can_request_start = false;
    }
    if (url.pathname.endsWith('/report')) state.repair_record = { ...body, id: 'report-fixture' };
    if (url.pathname.endsWith('/messages')) { state.messages.push({ id: 'message-fixture', content: body.content, is_internal_note: body.is_internal_note }); failRefresh = true; }
    if (url.pathname.endsWith('/complete')) { state.work_order_status = 'resolved'; state.work_order.status = 'resolved'; state.capabilities.can_edit = false; state.capabilities.can_complete = false; }
    state.revision++;
    return route.fulfill({ json: state });
  });
  await page.goto(`https://admin.sagemro.${market}/fixture`);
  const panel = page.getByRole('region', { name: zh ? '商务服务执行' : 'Business service execution', exact: true }); await panel.waitFor();
  const start = panel.getByRole('button', { name: zh ? '申请开工' : 'Request start', exact: true }); await start.click();
  await panel.getByRole('alert').filter({ hasText: 'Fictional uncertain result' }).waitFor(); await start.click();
  await panel.getByText(zh ? '等待开工审批' : 'Awaiting start approval', { exact: true }).waitFor();
  assert.deepEqual(writes[0], writes[1]);
  role = 'admin'; state.capabilities = { can_approve_start: true };
  await page.evaluate(() => localStorage.setItem('admin_user', JSON.stringify({ staffRole: 'admin' })));
  await page.reload(); await panel.getByRole('button', { name: zh ? '批准开工' : 'Approve start', exact: true }).waitFor();
  assert.equal(await panel.getByRole('button', { name: zh ? '申请开工' : 'Request start', exact: true }).count(), 0);
  assert.equal(await panel.locator('textarea').count(), 0);
  role = 'business_manager'; state.work_order_status = 'in_service'; state.work_order.status = 'in_service'; state.capabilities = { can_edit: true, can_complete: true, can_message: true };
  await page.evaluate(() => localStorage.setItem('admin_user', JSON.stringify({ staffRole: 'business_manager', staffId: 'staff-fixture' })));
  await page.reload();
  await panel.getByRole('button', { name: zh ? '保存服务报告' : 'Save Service Report', exact: true }).waitFor();
  const fields = ['symptom', 'inspection_process', 'diagnosis', 'solution', 'verification_result'];
  for (const field of fields) await panel.locator(`#service-report-order-fixture-${field}`).fill(`Fictional ${field} evidence with sufficient detail for validation.`);
  await panel.getByRole('button', { name: zh ? '保存服务报告' : 'Save Service Report', exact: true }).click();
  await panel.getByText('Fictional diagnosis evidence with sufficient detail for validation.', { exact: true }).waitFor();
  assert.equal(writes.filter(row => row.action === 'report').length, 1);
  await panel.getByLabel(zh ? '消息内容' : 'Message', { exact: true }).fill('Fictional private update');
  await panel.getByLabel(zh ? '仅内部可见' : 'Internal only', { exact: true }).check();
  await panel.getByRole('button', { name: zh ? '发送消息' : 'Send message', exact: true }).click();
  await panel.getByText(zh ? '操作已保存，但状态刷新失败。请刷新服务状态后继续。' : 'The operation was saved, but refresh failed. Refresh service status before continuing.', { exact: true }).waitFor();
  assert.equal(await panel.locator('fieldset').evaluate(element => element.disabled), true);
  await panel.getByRole('button', { name: zh ? '刷新服务状态' : 'Refresh service', exact: true }).click();
  await panel.getByText('Fictional private update', { exact: true }).waitFor();
  assert.equal(writes.filter(row => row.action === 'messages').length, 1);
  assert.equal(writes.find(row => row.action === 'messages').body.is_internal_note, true);
  if (zh && process.env.SAGEMRO_SERVICE_SCREENSHOT) { await page.waitForLoadState('networkidle'); await page.screenshot({ path: process.env.SAGEMRO_SERVICE_SCREENSHOT, fullPage: true }); }
  assert.doesNotMatch(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })), /Fictional.*evidence/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => { localStorage.setItem('admin_user', JSON.stringify({ staffRole: 'business_manager', staffId: 'other-fixture' })); window.dispatchEvent(new Event('focus')); });
  await panel.getByRole('alert').filter({ hasText: zh ? '账号或权限' : 'account or access' }).waitFor();
  assert.equal(await panel.getByText('Fictional diagnosis evidence with sufficient detail for validation.', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
});
