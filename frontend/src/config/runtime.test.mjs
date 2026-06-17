import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getEngineerPortalUrl,
  resolveRuntimeConfig,
} from './runtime.js';

test('resolves CN engineer portal to CN market and API', () => {
  const config = resolveRuntimeConfig('engineer.sagemro.cn');

  assert.equal(config.market, 'cn');
  assert.equal(config.portal, 'engineer');
  assert.equal(config.locale, 'zh-CN');
  assert.equal(config.apiBase, 'https://api.sagemro.cn');
});

test('resolves COM customer portal to international market and API', () => {
  const config = resolveRuntimeConfig('sagemro.com');

  assert.equal(config.market, 'com');
  assert.equal(config.portal, 'customer');
  assert.equal(config.locale, 'en');
  assert.equal(config.apiBase, 'https://api.sagemro.com');
});

test('selects same-market engineer portal URL', () => {
  assert.equal(getEngineerPortalUrl('sagemro.cn'), 'https://engineer.sagemro.cn');
  assert.equal(getEngineerPortalUrl('www.sagemro.com'), 'https://engineer.sagemro.com');
});
