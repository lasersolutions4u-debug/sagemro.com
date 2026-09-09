import assert from 'node:assert/strict';
import './admin-locale-browser.test.mjs';
import './admin-business-navigation-browser.test.mjs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../admin/node_modules/vite/dist/node/index.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

test('late engineer application responses cannot overwrite a review draft', { timeout: 60_000 }, async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const application = { id: 'review-fixture', name: 'Example Engineer', email: 'engineer@example.invalid', status: 'submitted' };
  let initialRequests = 0;
  let staleRoute;
  let savedReview;
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'admin.sagemro.com') return route.abort();
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, userType: 'admin', user: { id: 'admin', name: 'Example Administrator', staffRole: 'admin' }, csrfToken: 'local-fixture-csrf' } });
    if (url.pathname === '/api/admin/engineer-applications') {
      if (++initialRequests === 1) { staleRoute = route; return; }
      return route.fulfill({ json: { total: 1, list: [application] } });
    }
    if (url.pathname === '/api/admin/engineer-applications/review-fixture') {
      savedReview = request.postDataJSON();
      Object.assign(application, savedReview);
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { stats: {}, items: [], data: [], total: 0 } });
    return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
  });
  await page.goto('https://admin.sagemro.com/');
  await page.getByRole('button', { name: 'Engineer Applications', exact: true }).click();
  await page.getByTestId('application-row').filter({ hasText: application.email }).click();
  const dialog = page.getByRole('dialog', { name: application.name });
  await dialog.locator('select').first().selectOption('qualified');
  assert.ok(staleRoute);
  const staleFinished = page.waitForEvent('requestfinished', request => request === staleRoute.request());
  await staleRoute.fulfill({ json: { total: 1, list: [{ ...application, status: 'submitted' }] } });
  await staleFinished;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await dialog.locator('select').first().inputValue(), 'qualified');
  await dialog.getByRole('button', { name: 'Save review', exact: true }).click();
  await dialog.locator('span').filter({ hasText: /^Approved$/ }).waitFor();
  assert.equal(savedReview.status, 'qualified');
});

test('business workspace and staff organization browser journeys use only local synthetic fixtures', { timeout: 120_000 }, async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' }, server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true });
  t.after(() => browser.close());
  const port = server.httpServer.address().port;
  for (const market of ['com', 'cn']) {
    for (const bootstrap of [false, true]) {
      await t.test(`${market} ${bootstrap ? 'administrator' : 'business director'}`, async () => {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: market === 'cn' ? { width: 390, height: 844 } : { width: 1366, height: 900 } });
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(10000);
          const errors = [];
          const writes = [];
          const calls = [];
          page.on('pageerror', error => errors.push(error.message));
          const user = { id: bootstrap ? 'admin' : 'director-fixture', name: bootstrap ? 'Example Administrator' : 'Example Director', staffId: bootstrap ? null : 'director-fixture', staffRole: bootstrap ? 'admin' : 'business_director', businessGrade: bootstrap ? null : 2, mustChangePassword: false };
          let version = 1;
          const staff = [
            { id: 'director-fixture', display_name: 'Example Director', normalized_login: 'director@example.invalid', role: 'business_director', grade: 2, is_active: 1, market_scope: market, supervisor_staff_id: null, territory_ids: ['territory-fixture'], effective_territory_ids: ['territory-fixture'], revision: 1 },
            { id: 'manager-fixture', display_name: 'Example Manager', normalized_login: 'manager@example.invalid', role: 'business_manager', grade: 1, is_active: 1, market_scope: market, supervisor_staff_id: 'director-fixture', territory_ids: [], effective_territory_ids: ['territory-fixture'], revision: 1 },
          ];
          const territories = [{ id: 'territory-fixture', name: 'Example territory', market }];
          if (bootstrap) {
            const otherMarket = market === 'cn' ? 'com' : 'cn';
            territories.push({ id: 'other-market-territory', name: 'Other market territory', market: otherMarket });
            staff.push(...['business_director', 'business_manager'].map(role => ({
              id: `other-market-${role}`, display_name: `Other market ${role}`, role, grade: 1,
              is_active: 1, market_scope: otherMarket, effective_territory_ids: ['other-market-territory'],
            })));
          }
          const customer = { id: 'customer-fixture', name: 'Example Customer', company: 'Example Industrial Co.', email: 'sample@example.invalid', phone: '+15550000000', territory_id: 'territory-fixture', owner_staff_id: 'director-fixture', assignment_revision: 1 };
          const leads = [
            { id: 'lead-a', name: '=1+1', source: 'service_request', message: 'Example maintenance request', email: 'sample@example.invalid' },
            { id: 'lead-b', name: 'Example lead', source: 'other_source', message: 'Example spare part request', email: 'second@example.invalid' },
          ];
          await context.route('**/*', async route => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.hostname !== `admin.sagemro.${market}`) return route.abort();
            if (url.pathname === '/fixture-switch') return route.fulfill({ contentType: 'text/html', body: '<title>Local identity fixture</title>' });
            if (url.pathname.startsWith('/api/')) {
              calls.push(url.pathname);
              if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, userType: 'admin', user, csrfToken: 'local-fixture-csrf' } });
              if (url.pathname === '/api/admin/staff' && request.method() === 'GET') return route.fulfill({ json: { staff } });
              if (url.pathname === '/api/admin/staff' && request.method() === 'POST') {
                const body = request.postDataJSON(); writes.push({ path: url.pathname, body });
                if (body.role.startsWith('business_')) assert.equal(body.expected_staff_id, 'admin');
                return route.fulfill({ json: { staff: { ...body, id: 'created-fixture', is_active: 1 }, temporary_password: 'Local-test-only-123!' } });
              }
              if (url.pathname.startsWith('/api/admin/business/')) {
                if (request.method() === 'GET') assert.equal(url.searchParams.get('expected_staff_id'), user.staffId || 'admin');
                else {
                  const body = request.postDataJSON(); writes.push({ path: url.pathname, body });
                  assert.equal(body.expected_staff_id, user.staffId || 'admin');
                  assert.equal(request.headers()['x-csrf-token'], 'local-fixture-csrf');
                  version += 1;
                  if (url.pathname.endsWith('/assignment')) Object.assign(customer, body, { assignment_revision: customer.assignment_revision + 1 });
                  if (url.pathname.endsWith('/territories')) territories.push({ id: 'new-territory-fixture', name: body.name, market });
                  return route.fulfill({ json: { success: true } });
                }
                if (url.pathname.endsWith('/organization')) return route.fulfill({ json: { actor_staff_id: user.staffId || 'admin', market, role: user.staffRole, grade: user.businessGrade, staff, territories, can_configure: bootstrap, can_assign: true, scope_version: String(version) } });
                if (url.pathname.endsWith('/records')) {
                  const isLead = url.searchParams.get('kind') === 'lead';
                  return route.fulfill({ json: { records: isLead ? [leads[url.searchParams.has('cursor') ? 1 : 0]] : [customer], total: isLead ? 2 : 1, next_cursor: isLead && !url.searchParams.has('cursor') ? 'fixture-next' : null, scope_version: String(version) } });
                }
                return route.fulfill({ json: { record: customer, scope_version: String(version) } });
              }
              return route.fulfill({ json: { stats: {}, items: [], data: [], total: 0 } });
            }
            const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
            return route.fulfill({ response });
          });
          await page.goto(`https://admin.sagemro.${market}/`);
          if (!bootstrap) {
            if (market === 'com') await page.locator('nav').getByRole('button', { name: 'Customers', exact: true }).click();
            await page.getByRole('heading', { name: market === 'cn' ? '商务工作台' : 'Customers', exact: true }).waitFor();
            await page.getByText('Example Customer', { exact: true }).waitFor();
            assert.equal(await page.locator('nav button').count(), market === 'cn' ? 1 : 3);
            assert.ok(calls.every(path => path === '/api/auth/session' || path.startsWith('/api/admin/business/')));
            await page.getByRole('button', { name: market === 'cn' ? '查看详情' : 'View details', exact: true }).click();
            const dialog = page.getByRole('dialog');
            await dialog.waitFor();
            await dialog.getByRole('button', { name: market === 'cn' ? '关闭' : 'Close', exact: true }).focus();
            await page.keyboard.press('Shift+Tab');
            assert.equal(await dialog.getByRole('button', { name: market === 'cn' ? '保存归属' : 'Save ownership', exact: true }).evaluate(node => node === document.activeElement), true);
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'hidden' });
            assert.equal(await page.getByRole('button', { name: market === 'cn' ? '查看详情' : 'View details', exact: true }).evaluate(node => node === document.activeElement), true);
            await page.getByRole('button', { name: market === 'cn' ? '查看详情' : 'View details', exact: true }).click();
            await dialog.waitFor();
            await dialog.getByLabel(market === 'cn' ? '商务负责人' : 'Business owner', { exact: true }).selectOption('manager-fixture');
            await dialog.getByRole('button', { name: market === 'cn' ? '保存归属' : 'Save ownership', exact: true }).click();
            await dialog.waitFor({ state: 'hidden' });
            assert.equal(writes[0].body.owner_staff_id, 'manager-fixture');
            assert.equal(writes[0].body.revision, 1);
            await page.getByRole('button', { name: market === 'cn' ? '全部线索' : 'Leads', exact: true }).click();
            await page.getByText('=1+1', { exact: true }).waitFor();
            const downloadEvent = page.waitForEvent('download');
            await page.getByRole('button', { name: market === 'cn' ? '导出范围内全部资料' : 'Export all in scope', exact: true }).click();
            const download = await downloadEvent;
            const stream = await download.createReadStream();
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const csv = Buffer.concat(chunks).toString('utf8');
            assert.ok(csv.includes("'=1+1"));
            assert.ok(csv.includes('service_request') && csv.includes('other_source'));
            assert.ok(csv.includes('lead-a') && csv.includes('lead-b'));
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            if (process.env.SAGEMRO_BUSINESS_SCREENSHOTS) await page.screenshot({ path: `${process.env.SAGEMRO_BUSINESS_SCREENSHOTS}/${market}-business.png`, fullPage: true });
            const other = await context.newPage();
            await other.goto(`https://admin.sagemro.${market}/fixture-switch`);
            await other.evaluate(() => localStorage.setItem('admin_user', JSON.stringify({ id: 'another-fixture', staffId: 'another-fixture', staffRole: 'business_specialist' })));
            await page.getByRole('heading', { name: market === 'cn' ? '商务工作台' : 'All leads', exact: true }).waitFor({ state: 'hidden' });
          } else {
            if (market === 'cn') await page.getByTitle('菜单', { exact: true }).click();
            await page.getByRole('button', { name: market === 'cn' ? '内部员工账号' : 'Internal Staff', exact: true }).click();
            await page.getByLabel(market === 'cn' ? '新增辖区名称' : 'New territory name', { exact: true }).fill('Second example territory');
            await page.getByRole('button', { name: market === 'cn' ? '创建辖区' : 'Create territory', exact: true }).click();
            await page.getByLabel(market === 'cn' ? '新增辖区名称' : 'New territory name', { exact: true }).waitFor();
            await page.locator('#staff-display-name').fill('Example new manager');
            await page.locator('#staff-login').fill('new-manager@example.invalid');
            await page.locator('#staff-role').selectOption('business_manager');
            assert.equal(await page.locator('select#staff-market').count(), 0);
            assert.equal(await page.locator('#staff-market').getAttribute('readonly'), '');
            assert.equal(await page.locator('#staff-market').inputValue(), market === 'cn' ? '中国版' : 'International');
            assert.equal(await page.getByLabel(market === 'cn' ? '直属上级' : 'Direct supervisor', { exact: true }).locator('option[value="other-market-business_director"]').count(), 0);
            await page.getByLabel(market === 'cn' ? '直属上级' : 'Direct supervisor', { exact: true }).selectOption('director-fixture');
            await page.getByLabel(market === 'cn' ? '档位' : 'Grade', { exact: true }).selectOption('3');
            await page.getByRole('button', { name: market === 'cn' ? '创建员工账号' : 'Create staff account', exact: true }).click();
            await page.getByRole('dialog').waitFor();
            const body = writes.find(write => write.path === '/api/admin/staff').body;
            assert.equal(body.market_scope, market);
            assert.equal(body.role, 'business_manager'); assert.equal(body.grade, 3); assert.equal(body.supervisor_staff_id, 'director-fixture'); assert.deepEqual(body.territory_ids, []);
            await page.getByRole('dialog').getByRole('button', { name: market === 'cn' ? '关闭' : 'Close', exact: true }).click();
            for (const role of ['operations', 'warehouse', 'procurement', 'admin', 'business_director', 'business_specialist']) {
              await page.locator('#staff-display-name').fill(`Example ${role}`);
              await page.locator('#staff-login').fill(`${role}@example.invalid`);
              await page.locator('#staff-role').selectOption(role);
              if (role === 'business_director') {
                assert.equal(await page.getByRole('checkbox').count(), 2);
                assert.equal(await page.getByRole('checkbox', { name: /Other market territory/ }).count(), 0);
                await page.getByRole('checkbox').first().check();
              }
              if (role === 'business_specialist') {
                assert.equal(await page.getByLabel(market === 'cn' ? '直属上级' : 'Direct supervisor', { exact: true }).locator('option[value="other-market-business_manager"]').count(), 0);
                await page.getByLabel(market === 'cn' ? '直属上级' : 'Direct supervisor', { exact: true }).selectOption('manager-fixture');
              }
              await page.getByRole('button', { name: market === 'cn' ? '创建员工账号' : 'Create staff account', exact: true }).click();
              await page.getByRole('dialog').waitFor();
              const created = writes.filter(write => write.path === '/api/admin/staff').at(-1).body;
              assert.equal(created.role, role);
              assert.equal(created.market_scope, market);
              if (role === 'business_director') assert.deepEqual(created.territory_ids, ['territory-fixture']);
              if (role === 'business_specialist') assert.equal(created.supervisor_staff_id, 'manager-fixture');
              await page.getByRole('dialog').getByRole('button', { name: market === 'cn' ? '关闭' : 'Close', exact: true }).click();
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            if (process.env.SAGEMRO_BUSINESS_SCREENSHOTS) await page.screenshot({ path: `${process.env.SAGEMRO_BUSINESS_SCREENSHOTS}/${market}-organization.png`, fullPage: true });
          }
          assert.deepEqual(errors, []);
        } finally { await context.close(); }
      });
    }
  }
});
