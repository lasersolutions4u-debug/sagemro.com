import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../../frontend', import.meta.url));

test('engineer service survey works in the existing portal with isolated local fixtures', { timeout: 120_000 }, async (t) => {
  const server = await createServer({
    root, logLevel: 'error',
    define: { __SAGEMRO_BUILD_TARGET__: JSON.stringify('portal'), 'import.meta.env.VITE_API_BASE': 'window.location.origin' },
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const port = server.httpServer.address().port;

  for (const market of ['com', 'cn']) {
    await t.test(market, async () => {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: market === 'cn' ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
      try {
        const page = await context.newPage();
        const errors = [];
        const submissions = [];
        let stored = { profile: null, revision: 0, updated_at: null, verification_status: 'self_reported' };
        let conflict = false;
        const user = { id: 'fixture-engineer', name: 'Example Engineer', status: 'available', engineer_role: 'engineer', specialties: [], brands: {}, services: [], created_at: '2026-01-01T00:00:00Z' };
        page.on('pageerror', error => errors.push(error.message));
        await context.route('**/*', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.hostname !== `engineer.sagemro.${market}`) return route.abort();
          if (url.pathname === '/fixture-switch') return route.fulfill({ contentType: 'text/html', body: '<title>Local session fixture</title>' });
          if (url.pathname.startsWith('/api/')) {
            if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: true, user, userType: 'engineer', csrfToken: 'local-fixture-csrf' } });
            if (url.pathname === '/api/engineers/profile') return route.fulfill({ json: { engineer: user } });
            if (url.pathname === '/api/engineers/service-profile') {
              if (request.method() === 'GET') {
                assert.equal(url.searchParams.get('expected_engineer_id'), user.id);
                return route.fulfill({ json: stored });
              }
              const body = request.postDataJSON();
              assert.equal(body.expected_engineer_id, user.id);
              submissions.push(body);
              if (conflict) return route.fulfill({ status: 409, json: { code: 'service_profile_conflict', error: market === 'cn' ? '资料已在其他窗口更新' : 'Profile changed in another window' } });
              assert.equal(body.revision, stored.revision);
              stored = { ...stored, profile: body.profile, revision: stored.revision + 1, updated_at: '2026-09-07T00:00:00Z' };
              return route.fulfill({ json: stored });
            }
            return route.fulfill({ json: { success: true, work_orders: [], events: [], notifications: [], conversations: [], unread_count: 0, count: 0 } });
          }
          const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
          return route.fulfill({ response });
        });
        await page.goto(`https://engineer.sagemro.${market}/`);
        await page.getByRole('button', { name: 'Example Engineer', exact: true }).click();
        await page.waitForLoadState('networkidle');
        const form = page.locator('form').filter({ has: page.locator('[name="hourly_rate"]') });
        await form.waitFor();
        const fields = await form.locator('input,select,textarea').evaluateAll(nodes => nodes.map(node => ({ name: node.name, label: node.labels?.[0]?.textContent?.trim() })));
        assert.ok(fields.some(field => field.name === 'hourly_rate' && field.label));
        for (const details of await form.locator('details').all()) {
          if (!await details.getAttribute('open').then(value => value !== null)) await details.locator('summary').click();
        }
        const hourly = form.locator('[name="hourly_rate"]');
        const currency = form.locator('[name="currency"]');
        assert.equal(await hourly.inputValue(), '');
        assert.equal(await currency.inputValue(), '');
        await currency.fill(market === 'cn' ? 'CNY' : 'USD');
        await hourly.fill('125.50');
        await form.locator('[name="tools"]').fill('Owned: example diagnostic meter; inspected before use.');
        const save = form.locator('button[type="submit"]');
        await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === '/api/engineers/service-profile' && response.request().method() === 'GET'),
          save.click(),
        ]);
        assert.equal(stored.profile.hourly_rate, '125.50');
        assert.equal(stored.profile.day_rate, null);
        assert.equal(stored.revision, 1);
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await page.getByRole('button', { name: 'Example Engineer', exact: true }).click();
        await page.waitForLoadState('networkidle');
        if (process.env.SAGEMRO_PROFILE_SCREENSHOTS) {
          await page.waitForFunction(() => {
            const modal = document.querySelector('form')?.closest('div.fixed');
            return modal && getComputedStyle(modal).opacity === '1';
          });
          await page.screenshot({ path: `${process.env.SAGEMRO_PROFILE_SCREENSHOTS}/${market}-form.png`, fullPage: true });
        }
        for (const details of await form.locator('details').all()) {
          if (!await details.getAttribute('open').then(value => value !== null)) await details.locator('summary').click();
        }
        assert.equal(await hourly.inputValue(), '125.50');
        conflict = true;
        await hourly.fill('150');
        await save.click();
        await form.getByRole('alert').waitFor();
        assert.equal(await hourly.inputValue(), '150');
        assert.equal(await save.isDisabled(), true);
        assert.equal(submissions.length, 2);
        assert.equal(stored.profile.hourly_rate, '125.50');
        stored = { ...stored, revision: 2, profile: { ...stored.profile, hourly_rate: '175' } };
        await form.getByRole('button', { name: market === 'cn' ? '读取最新版本进行比较' : 'Load latest for comparison', exact: true }).click();
        const keepDraft = form.getByRole('button', { name: market === 'cn' ? '已核对，保留我的草稿并准备重新保存' : 'Keep my draft after review; prepare to save again', exact: true });
        await keepDraft.waitFor();
        assert.equal(await hourly.inputValue(), '150');
        assert.equal(submissions.length, 2);
        await keepDraft.click();
        assert.equal(submissions.length, 2);
        conflict = false;
        await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === '/api/engineers/service-profile' && response.request().method() === 'GET'),
          save.click(),
        ]);
        assert.equal(stored.revision, 3);
        assert.equal(stored.profile.hourly_rate, '150');
        assert.equal(submissions[2].revision, 2);
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        if (process.env.SAGEMRO_PROFILE_SCREENSHOTS) await page.screenshot({ path: `${process.env.SAGEMRO_PROFILE_SCREENSHOTS}/${market}.png`, fullPage: true });
        await hourly.fill('999');
        const otherTab = await context.newPage();
        await otherTab.goto(`https://engineer.sagemro.${market}/fixture-switch`);
        await otherTab.evaluate(() => {
          localStorage.setItem('sagemro_user', JSON.stringify({ id: 'other-fixture-engineer' }));
          localStorage.setItem('sagemro_user_type', 'engineer');
        });
        await page.waitForFunction(() => !document.querySelector('form [name="hourly_rate"]'));
        assert.equal(await form.count(), 0);
        assert.equal(submissions.length, 3);
        assert.equal(stored.profile.hourly_rate, '150');
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    });
  }
});
