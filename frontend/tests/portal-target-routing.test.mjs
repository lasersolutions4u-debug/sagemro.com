import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildCustomerPortalUrl,
  parseServiceRequestEntry,
  resolvePortalTarget,
} from '../src/utils/portalTarget.js';

test('build target and exact host select the intended public or customer surface', () => {
  assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'sagemro.com' }), 'public');
  assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'ai.sagemro.com' }), 'customer');
  assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'ai.sagemro.cn' }), 'customer');
  assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'engineer.sagemro.cn' }), 'engineer');
  assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'engineer.sagemro.com' }), 'engineer');
});

test('lookalike and target-mismatched hosts never gain customer access', () => {
  for (const hostname of ['ai.sagemro.com.attacker.example', 'ai.attacker.example', 'sagemro.com.attacker.example']) {
    assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname }), 'blocked');
  }
  assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'ai.sagemro.com' }), 'blocked');
  assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'preview.example.com' }), 'blocked');
});

test('public conversion URLs always enter the market-specific customer portal', () => {
  assert.equal(
    buildCustomerPortalUrl({
      hostname: 'sagemro.cn',
      presets: { mode: 'assist', brand: 'trumpf', description: 'discard' },
    }),
    'https://ai.sagemro.cn/service-request?mode=assist&brand=trumpf',
  );
  assert.equal(
    buildCustomerPortalUrl({ hostname: 'sagemro.com', presets: { mode: 'manual' } }),
    'https://ai.sagemro.com/service-request?mode=manual',
  );
});

test('customer portal consumes only safe service request entry presets', () => {
  assert.deepEqual(parseServiceRequestEntry('?mode=assist&service=repair&brand=trumpf&description=discard', {
    resolveBrand: (slug) => slug === 'trumpf' ? 'TRUMPF' : '',
  }), {
    mode: 'ai',
    presets: { service_kind: 'repair', device_brands: ['TRUMPF'] },
  });
  assert.deepEqual(parseServiceRequestEntry('?mode=unknown&service=invalid&brand=../../bad'), {
    mode: 'manual',
    presets: {},
  });
});

test('portal artifact blocks unknown production hosts while keeping local preview usable', () => {
  assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'sagemro-ai.pages.dev' }), 'blocked');
  assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'preview.example.com' }), 'blocked');
  assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'localhost' }), 'customer');
  assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: '127.0.0.1' }), 'customer');
  assert.equal(resolvePortalTarget({ buildTarget: 'portal', hostname: 'customer.127.0.0.1.nip.io' }), 'customer');
  assert.equal(resolvePortalTarget({ buildTarget: 'public', hostname: 'engineer.127.0.0.1.nip.io' }), 'engineer');
});

test('App uses the resolved target and keeps the service request on the customer portal', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /resolvePortalTarget/);
  assert.match(app, /portalTarget === 'customer'/);
  assert.match(app, /portalTarget === 'public'/);
  assert.match(app, /portalTarget === 'blocked'/);
  assert.match(app, /isServiceRequestPath[\s\S]{0,180}portalTarget === 'customer'|portalTarget === 'customer'[\s\S]{0,180}isServiceRequestPath/);
});
