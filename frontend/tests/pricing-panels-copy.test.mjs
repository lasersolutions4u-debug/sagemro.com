import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('pricing panels use USD and do not expose offline settlement split', async () => {
  const source = await readFile(new URL('../src/components/WorkOrder/PricingPanels.jsx', import.meta.url), 'utf8');

  assert.equal(source.includes('Internal Settlement'), false);
  assert.equal(source.includes('internalSettlement'), false);
  assert.equal(source.includes('Service Management Fee'), false);
  assert.equal(source.includes('platform_fee > 0'), false);
  assert.equal(source.includes(' CNY'), false);
  assert.match(source, /USD/);
});

test('payment modal uses USD for quote payment amounts', async () => {
  const source = await readFile(new URL('../src/components/Payment/PaymentModal.jsx', import.meta.url), 'utf8');

  assert.equal(source.includes(' CNY'), false);
  assert.match(source, /USD/);
});

test('reasonable AI price copy references SAGEMRO AI market research', async () => {
  const source = await readFile(new URL('../src/components/WorkOrder/PricingPanels.jsx', import.meta.url), 'utf8');

  assert.match(source, /SAGEMRO AI market research/);
  assert.equal(source.includes('Price is reasonable'), false);
});
