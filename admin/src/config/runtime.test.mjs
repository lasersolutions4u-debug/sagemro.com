import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRuntimeConfig } from './runtime.js';

test('resolves CN admin portal to CN market and API', () => {
  const config = resolveRuntimeConfig('admin.sagemro.cn');

  assert.equal(config.market, 'cn');
  assert.equal(config.portal, 'admin');
  assert.equal(config.locale, 'zh-CN');
  assert.equal(config.apiBase, 'https://api.sagemro.cn');
});

test('resolves COM admin portal to international market and API', () => {
  const config = resolveRuntimeConfig('admin.sagemro.com');

  assert.equal(config.market, 'com');
  assert.equal(config.portal, 'admin');
  assert.equal(config.locale, 'en');
  assert.equal(config.apiBase, 'https://api.sagemro.com');
});
