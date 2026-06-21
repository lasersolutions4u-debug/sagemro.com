import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveRuntimeConfig } from './runtime.js';

const adminRoot = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(adminRoot, relativePath), 'utf8');
}

test('resolves CN admin portal to CN market and API', () => {
  const config = resolveRuntimeConfig('admin.sagemro.cn');

  assert.equal(config.market, 'cn');
  assert.equal(config.portal, 'admin');
  assert.equal(config.locale, 'zh-CN');
  assert.equal(config.apiBase, 'https://api.sagemro.cn');
  assert.equal(config.documentTitle, 'SAGEMRO 运营中枢');
});

test('resolves COM admin portal to international market and API', () => {
  const config = resolveRuntimeConfig('admin.sagemro.com');

  assert.equal(config.market, 'com');
  assert.equal(config.portal, 'admin');
  assert.equal(config.locale, 'en');
  assert.equal(config.apiBase, 'https://api.sagemro.com');
  assert.equal(config.documentTitle, 'SAGEMRO Operations Console');
});

test('CN admin copy uses operations console naming instead of old admin wording', () => {
  const app = read('src/App.jsx');
  const dashboard = read('src/pages/DashboardPage.jsx');

  assert.match(app, /mobileTitle: 'SAGEMRO 运营中枢'/);
  assert.match(dashboard, /title: 'SAGEMRO 运营中枢'/);
  assert.doesNotMatch(app, /SAGEMRO 运营管理后台/);
  assert.doesNotMatch(dashboard, /'zh-CN': \{[\s\S]*?title: 'SAGEMRO Operations Console'/);
});
