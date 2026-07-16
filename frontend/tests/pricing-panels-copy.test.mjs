import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('pricing panels use locale-aware currency and do not expose offline settlement split', async () => {
  const source = await readFile(new URL('../src/components/WorkOrder/PricingPanels.jsx', import.meta.url), 'utf8');

  assert.equal(source.includes('Internal Settlement'), false);
  assert.equal(source.includes('internalSettlement'), false);
  assert.equal(source.includes('Service Management Fee'), false);
  assert.equal(source.includes('platform_fee > 0'), false);
  assert.match(source, /\? 'CNY' : 'USD'/);
});

test('payment modal uses locale-aware currency for quote payment amounts', async () => {
  const source = await readFile(new URL('../src/components/Payment/PaymentModal.jsx', import.meta.url), 'utf8');

  assert.match(source, /\? 'CNY' : 'USD'/);
});

test('reasonable price copy uses neutral market reference language', async () => {
  const source = await readFile(new URL('../src/components/WorkOrder/PricingPanels.jsx', import.meta.url), 'utf8');

  assert.match(source, /current market reference data/);
  assert.match(source, /当前市场参考数据/);
  assert.equal(source.includes('SAGEMRO AI market research'), false);
  assert.equal(source.includes('Price is reasonable'), false);
});
