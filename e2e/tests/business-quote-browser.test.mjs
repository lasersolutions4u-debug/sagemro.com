import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from '../../admin/node_modules/vite/dist/node/index.js';
import { calculateBusinessQuoteEstimate } from '../../worker/src/lib/businessQuoteEstimate.js';
import worker from '../../worker/src/index.js';
import { signJwt } from '../../worker/src/lib/auth.js';

const { chromium } = createRequire(import.meta.url)('playwright');

test('real browser form saves and submits through the actual scoped Worker and SQLite', { timeout: 60_000 }, async t => {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../../worker/schema.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { let args = []; return {
    bind(...values) { args = values; return this; }, async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
  }; }, async batch(statements) { sqlite.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } } };
  sqlite.exec(`INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES ('biz-fixture','biz@example.invalid','fictional','fictional','operations','Example Business Director','cn',0,1);
    INSERT INTO business_staff_profiles(staff_id,role,grade) VALUES ('biz-fixture','business_director',1);
    INSERT INTO business_territories(id,name,market) VALUES ('territory-fixture','Example territory','cn');
    INSERT INTO business_director_territories(staff_id,territory_id) VALUES ('biz-fixture','territory-fixture');
    INSERT INTO customers(id,user_no,name,password_hash) VALUES ('customer-fixture','CUSTOMER-FIXTURE','Example Customer','fictional');
    INSERT INTO work_orders(id,order_no,customer_id,type,description,status,service_mode) VALUES ('order-fixture','ORDER-FIXTURE','customer-fixture','fault','Example request','pending','onsite');
    INSERT INTO business_record_assignments(kind,record_id,territory_id,owner_staff_id) VALUES ('work_order','order-fixture','territory-fixture','biz-fixture');`);
  const env = { DB, JWT_SECRET: 'fictional-local-browser-test-secret', ENVIRONMENT: 'development', KV: { async get() { return null; }, async put() {} } };
  const user = { id: 'biz-fixture', staffId: 'biz-fixture', staffRole: 'business_director', name: 'Example Business Director' };
  const token = await signJwt({ userId: user.id, staffId: user.staffId, userType: 'admin', market: 'cn', exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET);
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(5000);
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== 'admin.sagemro.cn') return route.abort();
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, userType: 'admin', user, csrfToken: 'local-fixture-csrf' } });
    if (url.pathname.startsWith('/api/')) {
      assert.ok(url.pathname.startsWith('/api/admin/business/'));
      const response = await worker.fetch(new Request(`https://api.sagemro.cn${url.pathname}${url.search}`, {
        method: request.method(), headers: { Origin: 'https://admin.sagemro.cn', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(['GET', 'HEAD'].includes(request.method()) ? {} : { body: request.postData() }),
      }), env, {});
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    }
    return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
  });
  await page.goto('https://admin.sagemro.cn/');
  await page.getByRole('button', { name: '服务工单', exact: true }).click();
  await page.getByRole('button', { name: '查看详情', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of [['客户人工费','1000'],['客户备件费','500'],['客户差旅费','100'],['客户其他费用','0'],['预计现场天数','2'],['备件采购成本','300'],['工程师人工成本','400'],['差旅成本','100'],['其他直接成本','0']]) await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole('button', { name: '保存报价草稿', exact: true }).click();
  await dialog.getByText('草稿已保存', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: '提交 Admin 审核', exact: true }).click();
  await dialog.getByText('等待 Admin 审核', { exact: true }).waitFor();
  const stored = sqlite.prepare('SELECT * FROM business_quote_cost_snapshots').get();
  assert.equal(stored.currency, 'CNY'); assert.equal(stored.quoted_amount, 1600); assert.equal(stored.parts_cost, 300); assert.equal(stored.engineer_cost, 400);
  assert.equal(stored.quote_version, 1); assert.equal(sqlite.prepare('SELECT engineer_id FROM work_orders').get().engineer_id, null);
  assert.equal(sqlite.prepare('SELECT status FROM work_order_pricing').get().status, 'pending_review');
});

test('Admin approval waits for the matching private cost snapshot and rejects stale version data', { timeout: 60_000 }, async t => {
  const moduleId = '\0quote-review-fixture';
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'local-quote-review-test', resolveId: id => id === '/fixture-review.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QuoteExecutionAdminPanel} from '/src/components/QuoteExecutionAdminPanel.jsx';
        import '/src/index.css'; const root=createRoot(document.getElementById('root'));
        window.renderQuote=detail=>root.render(React.createElement(QuoteExecutionAdminPanel,{detail,onOpenDialog:(type,detail,values)=>window.reviewAction={type,values}}));
        window.renderQuote(window.quoteFixture);` : null }] });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(5000);
  let release; const gate = new Promise(resolve => { release = resolve; }); t.after(release);
  const fixture = { id: 'review-fixture', pricing: { quote_source: 'business', quote_version: 1, status: 'pending_review',
    expected_service_days: 2, labor_fee: 1000, parts_fee: 500, travel_fee: 100, other_fee: 0, total_amount: 1600,
    payment_schedule: [{ id: 'schedule-fixture', quote_version: 1, sequence: 1, amount: 1600, currency: 'USD', trigger_type: 'before_start', required_before_start: true }] } };
  await page.addInitScript(value => { localStorage.setItem('admin_user', JSON.stringify({ staffRole: 'admin', staffId: null })); window.quoteFixture = value; }, fixture);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'admin.sagemro.com') return route.abort();
    if (url.pathname === '/fixture-review') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture-review.jsx"></script>' });
    if (url.pathname.endsWith('/organization')) return route.fulfill({ json: { scope_version: 'scope-review-fixture', actor_staff_id: 'admin' } });
    if (url.pathname.endsWith('/costs')) {
      await gate;
      return route.fulfill({ json: { quote_version: 1, source: 'business', scope_version: 'scope-review-fixture', author_staff_id: 'specialist-fixture',
        estimate: calculateBusinessQuoteEstimate({ currency: 'USD', quoted_amount: 1600, costs: { parts_cost: 300, engineer_cost: 400, travel_cost: 100, other_cost: 0 } }).value } });
    }
    return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
  });
  await page.goto('https://admin.sagemro.com/fixture-review');
  const approve = page.getByRole('button', { name: 'Approve quote version', exact: true });
  await approve.waitFor();
  assert.equal(await approve.isDisabled(), true);
  release();
  await page.getByRole('heading', { name: 'Internal cost snapshot · V1', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Approve quote version' && !button.disabled));
  await approve.click();
  assert.deepEqual(await page.evaluate(() => window.reviewAction), { type: 'quote-approve', values: { quoteVersion: 1, businessContext: { expected_staff_id: 'admin', scope_version: 'scope-review-fixture' } } });
  await page.evaluate(value => window.renderQuote({ ...value, pricing: { ...value.pricing, quote_version: 2 } }), fixture);
  await page.getByRole('alert').filter({ hasText: 'Cost snapshot is unavailable or does not match this quote.' }).waitFor();
  assert.equal(await approve.isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Return for revision', exact: true }).isDisabled(), false);
});

test('business quote browser journey keeps costs private and submits the saved revision', { timeout: 120_000 }, async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true });
  t.after(() => browser.close());
  for (const market of ['com', 'cn']) await t.test(market, async () => {
    const zh = market === 'cn';
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: zh ? 390 : 1366, height: 900 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [], writes = [];
      page.on('pageerror', error => errors.push(error.message));
      const user = { id: 'specialist-fixture', staffId: 'specialist-fixture', staffRole: 'business_specialist', name: 'Example Specialist' };
      const order = { id: 'wo-fixture', order_no: 'EXAMPLE-01', short_title: 'Example repair', status: 'pending', assignment_revision: 1 };
      const state = { scope_version: 'scope-fixture', revision: 0, currency: zh ? 'CNY' : 'USD', service_mode: 'onsite', draft: null, estimate: null, latest_quote: null };
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.hostname !== `admin.sagemro.${market}`) return route.abort();
        if (url.pathname === '/fixture-switch') return route.fulfill({ contentType: 'text/html', body: '<title>Local identity fixture</title>' });
        if (url.pathname.startsWith('/api/')) {
          if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, userType: 'admin', user, csrfToken: 'local-fixture-csrf' } });
          assert.ok(url.pathname.startsWith('/api/admin/business/'));
          if (url.pathname.endsWith('/organization')) return route.fulfill({ json: { actor_staff_id: user.staffId, market, role: user.staffRole, grade: 1, staff: [], territories: [], can_assign: false, scope_version: state.scope_version } });
          if (url.pathname.endsWith('/records')) return route.fulfill({ json: { records: url.searchParams.get('kind') === 'work_order' ? [order] : [], total: 1, scope_version: state.scope_version } });
          if (url.pathname.includes('/records/')) return route.fulfill({ json: { record: order, scope_version: state.scope_version } });
          if (url.pathname.endsWith('/payments')) return route.fulfill({ json: { available: false, quote_execution: null, scope_version: state.scope_version } });
          if (url.pathname.endsWith('/execution')) return route.fulfill({ json: { scope_version: state.scope_version, quote_version: 0, revision: 0, execution: null, candidates: [], can_assign: false, blocked_reason: 'customer_confirmation_required' } });
          assert.match(url.pathname, /\/work-orders\/wo-fixture\/quote(?:\/submit)?$/);
          if (request.method() === 'GET') {
            assert.equal(url.searchParams.get('expected_staff_id'), user.staffId);
            assert.equal(url.searchParams.get('scope_version'), state.scope_version);
            return route.fulfill({ json: state });
          }
          const body = request.postDataJSON(); writes.push(body);
          assert.equal(body.expected_staff_id, user.staffId);
          assert.equal(body.scope_version, state.scope_version);
          assert.equal(body.revision, state.revision);
          assert.equal(request.headers()['x-csrf-token'], 'local-fixture-csrf');
          if (request.method() === 'PUT') {
            const { expected_staff_id, scope_version, revision, ...draft } = body;
            state.draft = draft;
            state.revision++;
            state.estimate = calculateBusinessQuoteEstimate({ currency: state.currency,
              quoted_amount: draft.labor_fee + draft.parts_fee + draft.travel_fee + draft.other_fee, costs: draft.costs }).value;
          } else {
            assert.equal(request.method(), 'POST');
            assert.deepEqual(Object.keys(body).sort(), ['expected_staff_id', 'revision', 'scope_version']);
            state.latest_quote = { quote_version: 1, status: 'pending_review', source: 'business' };
            state.revision++;
          }
          return route.fulfill({ json: state });
        }
        return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
      });
      await page.goto(`https://admin.sagemro.${market}/`);
      await page.getByRole('button', { name: zh ? '服务工单' : 'Service Orders', exact: true }).click();
      await page.getByRole('button', { name: zh ? '查看详情' : 'View details', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('heading', { name: zh ? '商务报价' : 'Business quotation', exact: true }).waitFor();
      const field = name => dialog.getByLabel(name, { exact: true });
      await field(zh ? '客户人工费' : 'Customer labor fee').fill('1000');
      await field(zh ? '客户备件费' : 'Customer parts fee').fill('500');
      await field(zh ? '客户差旅费' : 'Customer travel fee').fill('100');
      await field(zh ? '客户其他费用' : 'Customer other fee').fill('0');
      await field(zh ? '预计现场天数' : 'Expected onsite days').fill('2');
      if (!zh) {
        await page.getByRole('button', { name: '中文', exact: true }).click();
        await dialog.getByRole('heading', { name: '商务报价', exact: true }).waitFor();
        assert.equal(await field('客户人工费').inputValue(), '1000');
        assert.equal(await field('客户备件费').inputValue(), '500');
        assert.equal(await field('预计现场天数').inputValue(), '2');
        assert.equal(await page.getByRole('button', { name: '内部员工账号', exact: true }).count(), 0);
        assert.deepEqual(writes, []);
        await page.getByRole('button', { name: 'English', exact: true }).click();
        assert.equal(await field('Customer labor fee').inputValue(), '1000');
      }
      const submit = dialog.getByRole('button', { name: zh ? '提交 Admin 审核' : 'Submit for Admin review', exact: true });
      const save = dialog.getByRole('button', { name: zh ? '保存报价草稿' : 'Save quote draft', exact: true });
      assert.equal(await submit.isDisabled(), true);
      await save.click();
      await dialog.getByText(zh ? '草稿已保存' : 'Draft saved', { exact: true }).waitFor();
      assert.equal(state.draft.costs.parts_cost, null);
      assert.equal(await submit.isDisabled(), true);
      await field(zh ? '备件采购成本' : 'Parts procurement cost').fill('300');
      await field(zh ? '工程师人工成本' : 'Engineer labor cost').fill('400');
      await field(zh ? '差旅成本' : 'Travel cost').fill('100');
      await field(zh ? '其他直接成本' : 'Other direct cost').fill('0');
      await dialog.getByTestId('business-gross-profit').locator('div').filter({ has: page.locator('dt', { hasText: zh ? '预计毛利润' : 'Estimated gross profit' }) }).getByText(`800 ${state.currency}`, { exact: true }).waitFor();
      await field(zh ? '付款计划' : 'Payment plan').selectOption('installments');
      await dialog.getByTestId('business-gross-profit').locator('div').filter({ has: page.locator('dt', { hasText: zh ? '预计毛利润' : 'Estimated gross profit' }) }).getByText(`800 ${state.currency}`, { exact: true }).waitFor();
      assert.equal(await save.isDisabled(), true);
      await field(zh ? '付款计划' : 'Payment plan').selectOption('single');
      assert.equal(await submit.isDisabled(), true);
      await save.click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => /Submit for Admin review|提交 Admin 审核/.test(button.textContent) && !button.disabled));
      assert.equal(state.estimate.estimated_gross_profit, 800);
      await field(zh ? '其他直接成本' : 'Other direct cost').fill('1e2');
      assert.equal(await save.isDisabled(), true);
      assert.equal(await submit.isDisabled(), true);
      await field(zh ? '其他直接成本' : 'Other direct cost').fill('0');
      await save.click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => /Submit for Admin review|提交 Admin 审核/.test(button.textContent) && !button.disabled));
      await submit.click();
      await dialog.getByText(zh ? '等待 Admin 审核' : 'Awaiting Admin review', { exact: true }).waitFor();
      assert.equal(await submit.isDisabled(), true);
      assert.equal(writes.at(-1).revision, 3);
      state.latest_quote = { quote_version: 1, status: 'draft', source: 'business', feedback: { quote_version: 1, source: 'admin', message: 'Example correction: confirm the service scope.' } };
      await dialog.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true }).click();
      await page.getByRole('button', { name: zh ? '查看详情' : 'View details', exact: true }).click();
      await dialog.getByRole('heading', { name: zh ? 'Admin 退回说明 · V1' : 'Admin requested changes · V1', exact: true }).waitFor();
      await dialog.getByText('Example correction: confirm the service scope.', { exact: true }).waitFor();
      assert.equal(await field(zh ? '客户人工费' : 'Customer labor fee').isEnabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const other = await context.newPage();
      await other.goto(`https://admin.sagemro.${market}/fixture-switch`);
      await other.evaluate(() => localStorage.setItem('admin_user', JSON.stringify({ staffId: 'other-fixture', staffRole: 'business_specialist' })));
      await dialog.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
