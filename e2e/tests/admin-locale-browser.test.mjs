import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../admin/node_modules/vite/dist/node/index.js';

const { chromium } = createRequire(import.meta.url)('playwright');

test('language changes preserve gate reasons and edits to existing service reports', { timeout: 60_000 }, async t => {
  const moduleId = '\0locale-draft-fixture';
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{ name: 'locale-draft-fixture', resolveId: id => id === '/locale-draft.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {LanguageSwitch} from '/src/components/LanguageSwitch.jsx';
        import {ServiceStandardAdminPanel} from '/src/components/ServiceStandardAdminPanel.jsx';
        import {RepairRecordPanel} from '/@fs/${fileURLToPath(new URL('../../frontend/src/components/WorkOrder/RepairRecordPanel.jsx', import.meta.url)).replaceAll('\\', '/')}';
        import {useAdminLocale} from '/src/config/locale.js';
        const record = {symptom:'Fictional saved symptom',diagnosis:'Fictional saved diagnosis',parts_used:'[]'};
        const serviceApi = {};
        function Fixture(){ const locale = useAdminLocale(); return React.createElement(React.Fragment,null,React.createElement(LanguageSwitch),React.createElement(ServiceStandardAdminPanel,{workOrderId:'locale-fixture',workOrderStatus:'payment_review'}),React.createElement(RepairRecordPanel,{workOrderId:'locale-fixture',userType:'admin',canEdit:true,serviceApi,repairRecord:record,locale})); }
        createRoot(document.getElementById('root')).render(React.createElement(Fixture));` : null }] });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true }); t.after(() => browser.close());
  for (const draft of ['gate reason', 'existing report']) await t.test(draft, async () => {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    const errors = [], writes = []; let reads = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.pathname.startsWith('/api/')) {
        if (req.method() !== 'GET') writes.push(url.pathname);
        if (url.pathname.endsWith('/service-standard')) { reads++; return route.fulfill({ json: { steps: [], gates: { start: { blocking_items: ['task.device_identity'] } }, overrides: [] } }); }
        return route.fulfill({ json: { items: [] } });
      }
      if (url.hostname !== 'admin.sagemro.com') return route.abort();
      if (url.pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/locale-draft.jsx"></script>' });
      return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
    });
    await page.goto('https://admin.sagemro.com/fixture');
    await page.getByLabel('Override reason', { exact: true }).waitFor();
    if (draft === 'gate reason') await page.getByLabel('Override reason', { exact: true }).fill('Fictional unsaved exception reason');
    else {
      await page.getByRole('button', { name: 'Edit service report', exact: true }).click();
      await page.locator('#service-report-locale-fixture-symptom').fill('Fictional unsaved report edit');
    }
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await page.getByRole('button', { name: 'English', exact: true }).waitFor();
    if (draft === 'gate reason') assert.equal(await page.getByPlaceholder('1–500 个字符', { exact: true }).inputValue(), 'Fictional unsaved exception reason');
    else assert.equal(await page.locator('#service-report-locale-fixture-symptom').inputValue(), 'Fictional unsaved report edit');
    assert.equal(reads, 1);
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    await page.close();
  });
});

test('international admin switches language without changing API, permissions or unsaved forms', { timeout: 90_000 }, async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../admin', import.meta.url)), logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [], apiHosts = [], writes = [], knowledgeMarkets = [];
  let authenticated = false;
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      apiHosts.push(url.hostname);
      if (url.pathname === '/api/admin/knowledge') knowledgeMarkets.push(url.searchParams.get('market'));
      if (request.method() !== 'GET') writes.push(url.pathname);
      if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated, userType: 'admin', user: { id: 'admin', name: 'Example Administrator', staffRole: 'admin' }, csrfToken: 'local-fixture-csrf' } });
      if (url.pathname === '/api/admin/users') return route.fulfill({ json: { list: [], total: 0 } });
      if (url.pathname === '/api/admin/staff') return route.fulfill({ json: { staff: [] } });
      if (url.pathname === '/api/admin/business/organization') return route.fulfill({ json: { staff: [], territories: [], can_configure: true, scope_version: 'fixture' } });
      return route.fulfill({ json: { stats: {}, items: [], list: [], records: [], data: [], total: 0 } });
    }
    if (url.hostname !== 'admin.sagemro.com') return route.abort();
    return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
  });
  await page.goto('https://admin.sagemro.com/');
  await page.getByPlaceholder('Phone number or login name').fill('example-login');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  assert.equal(await page.getByPlaceholder('手机号或登录名').inputValue(), 'example-login');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.reload();
  await page.getByRole('button', { name: 'English', exact: true }).waitFor();
  authenticated = true;
  await page.reload();
  await page.getByRole('button', { name: '客户', exact: true }).click();
  await page.getByRole('button', { name: '添加客户', exact: true }).click();
  await page.getByPlaceholder('姓名', { exact: true }).fill('Example unsaved customer');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  assert.equal(await page.getByPlaceholder('Name', { exact: true }).inputValue(), 'Example unsaved customer');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Internal Staff', exact: true }).click();
  await page.getByRole('button', { name: '中文', exact: true }).click();
  assert.match(await page.locator('#staff-market').inputValue(), /国际|COM/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => { const box = document.querySelector('aside').getBoundingClientRect(); return box.right <= 1; });
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (process.env.SAGEMRO_LOCALE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SAGEMRO_LOCALE_SCREENSHOT_DIR}/admin-zh-mobile.png`, fullPage: false });
  await page.getByRole('button', { name: 'English', exact: true }).filter({ visible: true }).click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForFunction(() => Math.abs(document.querySelector('aside').getBoundingClientRect().left) < 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.SAGEMRO_LOCALE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SAGEMRO_LOCALE_SCREENSHOT_DIR}/admin-en-desktop.png`, fullPage: false });
  await page.getByRole('button', { name: 'Knowledge Base', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Example unsaved knowledge draft');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  assert.equal(await page.getByLabel('标题', { exact: true }).inputValue(), 'Example unsaved knowledge draft');
  assert.ok(knowledgeMarkets.length > 0);
  assert.deepEqual([...new Set(knowledgeMarkets)], ['com']);
  const other = await context.newPage();
  await other.goto('https://admin.sagemro.com/');
  await other.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: '中文', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Example unsaved knowledge draft');
  authenticated = false;
  const restricted = await context.newPage();
  await restricted.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Browser storage disabled', 'SecurityError'); }; });
  await restricted.goto('https://admin.sagemro.com/');
  await restricted.getByRole('button', { name: '中文', exact: true }).click();
  await restricted.getByRole('button', { name: 'English', exact: true }).waitFor();
  assert.equal(await restricted.locator('html').getAttribute('lang'), 'zh-CN');
  assert.deepEqual([...new Set(apiHosts)], ['api.sagemro.com']);
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
});
