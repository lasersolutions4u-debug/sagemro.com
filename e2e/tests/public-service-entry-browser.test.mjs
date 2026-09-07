import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../../frontend', import.meta.url));

test('public service entry, chat handoff, draft isolation and back navigation', { timeout: 120_000 }, async (t) => {
  const servers = {};
  for (const target of ['public', 'portal']) {
    const server = await createServer({
      root, logLevel: 'error',
      define: { __SAGEMRO_BUILD_TARGET__: JSON.stringify(target), 'import.meta.env.VITE_API_BASE': 'window.location.origin' },
      server: { host: '127.0.0.1', port: 0, hmr: false },
    });
    await server.listen();
    servers[target] = server;
    t.after(() => server.close());
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());

  for (const market of ['com', 'cn']) {
    await t.test(market, async () => {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      let failAssist = false;
      page.on('pageerror', (error) => errors.push(error.message));
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (!['sagemro.com', 'sagemro.cn', 'ai.sagemro.com', 'ai.sagemro.cn'].includes(url.hostname)) return route.abort();
        if (url.pathname.startsWith('/api/')) {
          const body = request.postDataJSON();
          requests.push({ path: url.pathname, body });
          if (url.pathname === '/api/chat') {
            return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ content: market === 'cn' ? '请说明设备型号和所在地。' : 'Please share the equipment model and location.', conversation_id: body.conversation_id })}\n\ndata: [DONE]\n\n` });
          }
          if (url.pathname === '/api/service-request-assist') {
            return route.fulfill({ status: failAssist ? 503 : 200, json: failAssist ? { error: 'fixture failure' } : { patch: { service_kind: 'retrofit', device_types: ['Laser cutter'], device_model: 'EXAMPLE-3000' }, missing_fields: ['region'] } });
          }
          if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: false } });
          return route.fulfill({ json: { success: true, conversations: [] } });
        }
        const target = url.hostname.startsWith('ai.') ? 'portal' : 'public';
        const port = servers[target].httpServer.address().port;
        const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
        return route.fulfill({ response });
      });
      const origin = `https://sagemro.${market}`;
      const servicePath = '/services/equipment-system-retrofit/';
      const manualLabel = market === 'cn' ? '填写服务需求' : 'Request service';
      const assistLabel = market === 'cn' ? 'AI 协助填写' : 'Get help filling the form';
      await page.goto(origin + servicePath);
      const manual = page.getByRole('link', { name: manualLabel, exact: true });
      await manual.waitFor();
      assert.equal(await page.getByText('2026-08-06', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Reviewed by SAGEMRO Technical Service Team', { exact: true }).count(), 0);
      assert.equal(new URL(await manual.getAttribute('href')).searchParams.get('service'), 'retrofit');
      await manual.click();
      await page.getByRole('heading', { name: market === 'cn' ? '提交设备服务请求' : 'Request equipment service', exact: true }).waitFor();
      assert.equal(new URL(page.url()).hostname, `ai.sagemro.${market}`);
      const type = page.locator('input[name="service_kind"][value="retrofit"]');
      assert.equal(await type.isChecked(), true);
      await page.goBack();
      await page.getByRole('link', { name: assistLabel, exact: true }).waitFor();
      assert.equal(page.url(), origin + servicePath);
      await page.getByRole('link', { name: assistLabel, exact: true }).click();
      const prepare = page.getByRole('button', { name: market === 'cn' ? '整理并填写服务单' : 'Prepare service form', exact: true });
      await prepare.waitFor();
      assert.equal(new URL(page.url()).pathname, '/');
      assert.equal(await prepare.isDisabled(), true);
      const message = 'Example cutter EXAMPLE-3000 needs a control system upgrade.';
      const input = page.locator('textarea');
      await input.fill(message);
      await input.press('Enter');
      await page.getByText(market === 'cn' ? '请说明设备型号和所在地。' : 'Please share the equipment model and location.', { exact: true }).waitFor();
      failAssist = true;
      await prepare.click();
      await page.getByRole('alert').filter({ hasText: market === 'cn' ? '暂时无法整理' : 'Unable to organize' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/');
      failAssist = false;
      await prepare.click();
      await page.getByRole('button', { name: market === 'cn' ? '新建本次请求' : 'Start this new request', exact: true }).waitFor();
      const saved = await page.evaluate((market) => JSON.parse(localStorage.getItem(`sagemro_service_request_draft:${market}:v2`)), market);
      assert.equal(saved.description, '');
      await page.getByRole('button', { name: market === 'cn' ? '新建本次请求' : 'Start this new request', exact: true }).click();
      await page.getByRole('button', { name: market === 'cn' ? '下一步' : 'Continue', exact: true }).click();
      await page.locator('[data-step="2"]').waitFor();
      assert.equal(await page.locator('[data-step="2"] textarea').first().inputValue(), message);
      const draft = await page.evaluate((market) => JSON.parse(localStorage.getItem(`sagemro_service_request_draft:${market}:v2`)), market);
      assert.equal(draft.description, message);
      assert.equal(draft.device_model, 'EXAMPLE-3000');
      assert.equal(draft.service_kind, 'retrofit');
      assert.equal(requests.filter((r) => r.path === '/api/service-request-assist').length, 2);
      assert.equal(requests.filter((r) => r.path === '/api/workorders').length, 0);
      assert.match(requests.find((r) => r.path === '/api/chat').body.message, market === 'cn' ? /升级与改造/ : /upgrade and retrofit/);
      assert.equal(requests.find((r) => r.path === '/api/chat').body.service_request_only, true);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
});
