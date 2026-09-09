import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../admin/node_modules/vite/dist/node/index.js';

const { chromium } = createRequire(import.meta.url)('playwright');

test('international shared record menus keep business roles scoped and administrator tools available', { timeout: 120_000 }, async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  for (const role of ['business_director', 'business_manager', 'business_specialist', 'admin']) await t.test(role, async () => {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1366, height: 900 } });
    try {
      const page = await context.newPage(); page.setDefaultTimeout(6000);
      const root = role === 'admin', staffId = root ? null : 'staff-fixture';
      const user = { id: root ? 'admin' : staffId, staffId, staffRole: role, name: 'Example operator' };
      const calls = [], writes = [], errors = [];
      let rejectRecords = false;
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.startsWith('/api/')) {
          calls.push(url.pathname);
          if (req.method() !== 'GET') writes.push(url.pathname);
          if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, userType: 'admin', user, csrfToken: 'fixture-csrf' } });
          if (url.pathname === '/api/admin/business/organization') return route.fulfill({ json: { actor_staff_id: staffId || 'admin', role, grade: 1, staff: [], territories: [], can_configure: root, can_assign: role !== 'business_specialist', scope_version: 'fixture' } });
          if (url.pathname === '/api/admin/business/records') {
            assert.equal(url.searchParams.get('expected_staff_id'), staffId || 'admin');
            assert.equal(url.searchParams.get('scope_version'), 'fixture');
            if (rejectRecords) return route.fulfill({ status: 403, json: { error: 'Fixture access revoked' } });
            const kind = url.searchParams.get('kind');
            return route.fulfill({ json: { records: [{ id: `fixture-${kind}`, name: `Example ${kind}`, short_title: `Example ${kind}`, owner_staff_id: staffId, territory_id: null }], total: 1, next_cursor: null, scope_version: 'fixture' } });
          }
          if (url.pathname.startsWith('/api/admin/business/records/')) return route.fulfill({ json: { record: { id: 'fixture-customer', name: 'Example customer', owner_staff_id: staffId }, scope_version: 'fixture' } });
          return route.fulfill({ json: { list: [], work_orders: [], records: [], leads: [], stats: {}, total: 0 } });
        }
        if (url.hostname !== 'admin.sagemro.com') return route.abort();
        return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
      });
      await page.goto('https://admin.sagemro.com/');
      await page.locator('nav').waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('nav').getByRole('button', { name: 'Business workspace', exact: true }).count(), 0);
      if (!root) assert.deepEqual((await page.locator('nav button').allTextContents()).sort(), ['Customers', 'Leads', 'Service Orders'].sort());
      for (const [label, kind] of [['Customers', 'customer'], ['Leads', 'lead'], ['Service Orders', 'work_order']]) {
        await page.locator('nav').getByRole('button', { name: label, exact: true }).click();
        if (root) {
          await page.getByRole('button', { name: 'Business follow-up', exact: true }).click();
        } else assert.equal(await page.getByRole('button', { name: 'Record management', exact: true }).count(), 0);
        await page.getByText(`Example ${kind}`, { exact: true }).waitFor();
        assert.equal(await page.getByRole('group', { name: 'Business workspace', exact: true }).count(), 0);
        if (kind === 'customer') {
          await page.getByRole('button', { name: 'View details', exact: true }).click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          assert.equal(await dialog.getByRole('button', { name: 'Save ownership', exact: true }).count(), role === 'business_specialist' ? 0 : 1);
          await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        }
      }
      await page.getByRole('button', { name: '中文', exact: true }).click();
      await page.locator('nav').getByRole('button', { name: '服务工单', exact: true }).waitFor();
      await page.getByText('Example work_order', { exact: true }).waitFor();
      assert.equal(await page.getByText('商务工作台', { exact: true }).count(), 0);
      if (role === 'business_specialist') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByTitle('菜单', { exact: true }).click();
        await page.locator('nav').getByRole('button', { name: '服务工单', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      if (process.env.SAGEMRO_BUSINESS_SCREENSHOTS && (root || role === 'business_specialist')) await page.screenshot({ path: `${process.env.SAGEMRO_BUSINESS_SCREENSHOTS}/unified-${role}.png`, fullPage: false });
      await page.getByRole('button', { name: 'English', exact: true }).click();
      if (root) {
        await page.locator('nav').getByRole('button', { name: 'Customers', exact: true }).click();
        await page.getByRole('button', { name: 'Add customer', exact: true }).click();
        await page.getByPlaceholder('Name', { exact: true }).fill('Example unsaved customer');
        await page.getByRole('button', { name: '中文', exact: true }).click();
        assert.equal(await page.getByPlaceholder('姓名', { exact: true }).inputValue(), 'Example unsaved customer');
        await page.getByRole('button', { name: '取消', exact: true }).click();
      } else {
        assert.ok(calls.every(path => path === '/api/auth/session' || path.startsWith('/api/admin/business/')), JSON.stringify(calls));
        rejectRecords = true;
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.getByRole('alert').waitFor();
        assert.equal(await page.getByText('Example work_order', { exact: true }).count(), 0);
      }
      assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
