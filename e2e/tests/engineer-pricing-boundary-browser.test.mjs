import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const pricing = {
  status: 'draft', quote_version: 1, labor_fee: 100, parts_fee: 0, travel_fee: 0, other_fee: 0,
  parts_detail: '', expected_service_days: 2, payment_plan_mode: 'single', payment_schedule: [], material_items: [],
};
const savedDraft = JSON.stringify({ form: { labor_fee: '250', expected_service_days: '3' }, materialItems: [] });
const cases = [
  { id: 'empty', pricing: null },
  { id: 'legacy', pricing },
  { id: 'engineer', pricing: { ...pricing, quote_source: 'engineer' } },
  { id: 'business', pricing: { ...pricing, quote_source: 'business' } },
  { id: 'other-source', pricing: { ...pricing, quote_source: 'admin' } },
  ...['pending_review', 'submitted', 'confirmed'].map(status => ({
    id: status, pricing: { ...pricing, quote_source: 'engineer', status },
  })),
  { id: 'saved-draft', pricing: null, savedDraft },
];

test('engineer quote ownership follows the market without hidden COM draft writes', { timeout: 60_000 }, async t => {
  const moduleId = '\0engineer-pricing-fixture';
  const server = await createServer({
    root: fileURLToPath(new URL('../../frontend', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': 'window.location.origin' },
    server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{
      name: 'local-engineer-pricing-test',
      resolveId: id => id === '/fixture-pricing.jsx' ? moduleId : null,
      load: id => id === moduleId ? `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {EngineerPricingPanel} from '/src/components/WorkOrder/PricingPanels.jsx';
        createRoot(document.getElementById('root')).render(React.createElement(React.Fragment, null,
          ...window.pricingCases.map(item => React.createElement('section', {key:item.id, id:item.id},
            React.createElement(EngineerPricingPanel, {workOrderId:item.id, engineerId:'fixture-engineer', pricing:item.pricing, serviceMode:'onsite'})))));` : null,
    }],
  });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : 'chromium', headless: true });
  t.after(() => browser.close());
  for (const market of ['com', 'cn']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [], apiRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(fixtures => {
      window.pricingCases = fixtures;
      for (const item of fixtures) if (item.savedDraft) sessionStorage.setItem(`sagemro_quote_draft:${item.id}`, item.savedDraft);
      const originals = {};
      window.quoteDraftAccesses = [];
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        originals[method] = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          if (String(args[0]).startsWith('sagemro_quote_draft:')) window.quoteDraftAccesses.push({ method, key: String(args[0]) });
          return originals[method].apply(this, args);
        };
      }
      window.readQuoteDraft = id => originals.getItem.call(sessionStorage, `sagemro_quote_draft:${id}`);
    }, cases);
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== `engineer.sagemro.${market}`) return route.abort();
      if (url.pathname === '/fixture-pricing') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture-pricing.jsx"></script>' });
      if (url.pathname.startsWith('/api/')) { apiRequests.push(url.pathname); return route.abort(); }
      return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:${server.httpServer.address().port}${url.pathname}${url.search}` }) });
    });
    try {
      await page.goto(`https://engineer.sagemro.${market}/fixture-pricing`);
      await page.locator('#saved-draft').waitFor();
      await page.waitForLoadState('networkidle');
      await t.test(`${market}: quotation editor visibility`, async () => {
        for (const item of cases) {
          const panel = page.locator(`#${item.id}`);
          const editable = market === 'cn' && item.pricing?.quote_source !== 'business';
          assert.equal(await panel.locator('[data-testid="submit-pricing-button"]').count(), editable ? 1 : 0, item.id);
          if (editable) {
            assert.equal(await panel.getByLabel('人工费', { exact: true }).inputValue(), item.savedDraft ? '250' : item.pricing ? '100' : '', item.id);
          } else {
            assert.equal(await panel.locator('input,textarea,select,button').count(), 0, item.id);
            assert.match(await panel.textContent(), market === 'cn' ? /报价由商务团队负责/ : /Quotation is handled by the business team/, item.id);
          }
        }
      });
      await t.test(`${market}: quote draft storage`, async () => {
        for (const item of cases) {
          const stored = await page.evaluate(id => window.readQuoteDraft(id), item.id);
          if (market === 'com' || item.pricing?.quote_source === 'business') assert.equal(stored, item.savedDraft || null, item.id);
          else assert.ok(stored, item.id);
        }
      });
      await t.test(`${market}: quote draft storage access`, async () => {
        const accesses = await page.evaluate(() => window.quoteDraftAccesses);
        if (market === 'com') {
          assert.deepEqual(accesses, []);
        } else {
          for (const item of cases) {
            const methods = accesses.filter(access => access.key === `sagemro_quote_draft:${item.id}`).map(access => access.method);
            if (item.pricing?.quote_source === 'business') assert.deepEqual(methods, [], item.id);
            else {
              assert.ok(methods.includes('getItem'), `${item.id}: reads the draft`);
              assert.ok(methods.includes('setItem'), `${item.id}: saves the draft`);
              assert.equal(methods.includes('removeItem'), false, item.id);
            }
          }
        }
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(apiRequests, []);
    } finally {
      await context.close();
    }
  }
});
