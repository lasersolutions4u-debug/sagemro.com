import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../admin/node_modules/vite/dist/node/index.js';

const { chromium } = createRequire(import.meta.url)('playwright');

for (const market of ['com', 'cn']) test(`execution assignment form validates reason, retries once and stays read-only for business: ${market}`, { timeout: 60_000 }, async t => {
  const zh = market === 'cn', moduleId = '\0execution-browser-fixture';
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'execution-browser-fixture', resolveId: id => id === '/execution-fixture.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BusinessExecutionPanel} from '/src/components/BusinessExecutionPanel.jsx'; import '/src/index.css';
        createRoot(document.getElementById('root')).render(React.createElement(BusinessExecutionPanel,{workOrderId:'order-fixture'}));` : null }] });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: zh ? 390 : 1366, height: 900 }, serviceWorkers: 'block' }); t.after(() => context.close());
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  const staff = { id: 'staff-fixture', display_name: 'Fictional Business Director', role: 'business_director' };
  const state = { scope_version: 'scope-fixture', quote_version: 1, revision: 0, can_assign: false, blocked_reason: 'payment_required', execution: null, candidates: [staff] };
  let role = 'admin', failOnce = true, holdRead = false, readFailure = false, releaseRead, readStarted;
  const started = new Promise(resolve => { readStarted = resolve; });
  const held = new Promise(resolve => { releaseRead = resolve; }); t.after(() => releaseRead());
  await page.addInitScript(() => { localStorage.setItem('admin_user', JSON.stringify({ staffRole: 'admin', staffId: null })); localStorage.setItem('admin_csrf_token', 'fictional-csrf'); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== `admin.sagemro.${market}`) return route.abort();
    if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/execution-fixture.jsx"></script>' });
    if (url.pathname === '/fixture-switch') return route.fulfill({ contentType: 'text/html', body: '<title>Identity fixture</title>' });
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
    if (url.pathname.endsWith('/organization')) return route.fulfill({ json: { scope_version: state.scope_version, actor_staff_id: role === 'admin' ? 'admin' : staff.id } });
    if (request.method() === 'GET') {
      assert.equal(url.searchParams.get('expected_staff_id'), role === 'admin' ? 'admin' : staff.id);
      assert.equal(url.searchParams.get('scope_version'), state.scope_version);
      if (readFailure) return route.fulfill({ status: 409, json: { error: 'Fictional scope changed', code: 'business_scope_changed' } });
      if (holdRead) { holdRead = false; readStarted(); await held; }
      return route.fulfill({ json: { ...state, candidates: role === 'admin' ? state.candidates : [], can_assign: role === 'admin' && state.can_assign } });
    }
    assert.match(url.pathname, /\/execution\/assign$/); assert.equal(request.headers()['x-csrf-token'], 'fictional-csrf');
    const body = request.postDataJSON(); writes.push(body);
    if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { error: 'Fictional uncertain outcome' } }); }
    state.execution = { type: 'business', staff_id: staff.id, staff_name: staff.display_name, status: 'assigned', reason: body.reason, assigned_by: 'admin', assigned_at: '2026-09-07 10:00:00' };
    state.revision = 1; state.can_assign = false; state.blocked_reason = 'already_assigned';
    return route.fulfill({ status: 201, json: state });
  });
  await page.goto(`https://admin.sagemro.${market}/fixture`);
  const panel = page.getByRole('region', { name: zh ? '服务执行指派' : 'Service execution assignment', exact: true });
  await panel.waitFor();
  await panel.getByText(zh ? '开工前应付款尚未全部确认到账。' : 'Required pre-start payments have not all been verified.', { exact: true }).waitFor();
  assert.equal(await panel.getByRole('button', { name: zh ? '指定商务承接' : 'Assign business executor', exact: true }).count(), 0);
  state.can_assign = true; state.blocked_reason = null;
  await panel.getByRole('button', { name: zh ? '刷新执行状态' : 'Refresh assignment', exact: true }).click();
  const assign = panel.getByRole('button', { name: zh ? '指定商务承接' : 'Assign business executor', exact: true });
  await panel.getByLabel(zh ? '实际服务执行人' : 'Service executor', { exact: true }).selectOption(staff.id);
  assert.equal(await assign.isDisabled(), true);
  await panel.getByLabel(zh ? '承接原因（当地无合作工程师等）' : 'Assignment reason (e.g. no local partner engineer)', { exact: true }).fill('Fictional local coverage gap');
  await assign.click(); await panel.getByRole('alert').filter({ hasText: 'Fictional uncertain outcome' }).waitFor();
  await assign.click();
  await panel.getByText(zh ? '已指定商务承接' : 'Business executor assigned', { exact: true }).waitFor();
  assert.equal(writes.length, 2); assert.deepEqual(writes[0], writes[1]);
  assert.deepEqual({ ...writes[0], idempotency_key: null }, { expected_staff_id: 'admin', scope_version: 'scope-fixture', revision: 0, quote_version: 1, executor_staff_id: staff.id, reason: 'Fictional local coverage gap', idempotency_key: null });
  assert.equal(await panel.getByRole('button', { name: /Start service|Complete service|开始服务|完成服务/ }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.doesNotMatch(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })), /coverage gap/);
  holdRead = true;
  await panel.getByRole('button', { name: zh ? '刷新执行状态' : 'Refresh assignment', exact: true }).click(); await started;
  const other = await context.newPage(); await other.goto(`https://admin.sagemro.${market}/fixture-switch`);
  await other.evaluate(() => localStorage.setItem('admin_user', JSON.stringify({ staffRole: 'business_director', staffId: 'staff-fixture' })));
  await panel.getByRole('alert').filter({ hasText: zh ? '账号或权限' : 'account or access' }).waitFor();
  releaseRead();
  assert.equal(await panel.getByText('Fictional local coverage gap', { exact: true }).count(), 0);
  role = 'business_director';
  const business = await context.newPage(); await business.goto(`https://admin.sagemro.${market}/fixture`);
  await business.getByText(zh ? '已指定商务承接' : 'Business executor assigned', { exact: true }).waitFor();
  assert.equal(await business.getByRole('combobox').count(), 0);
  assert.equal(await business.getByRole('button', { name: zh ? '指定商务承接' : 'Assign business executor', exact: true }).count(), 0);
  readFailure = true;
  await business.getByRole('button', { name: zh ? '刷新执行状态' : 'Refresh assignment', exact: true }).click();
  await business.getByRole('alert').filter({ hasText: zh ? '账号或权限' : 'account or access' }).waitFor();
  assert.equal(await business.getByText('Fictional local coverage gap', { exact: true }).count(), 0);
  assert.equal(await panel.getByText('Fictional local coverage gap', { exact: true }).count(), 0);
  assert.equal(writes.length, 2);
  assert.deepEqual(errors, []);
});
