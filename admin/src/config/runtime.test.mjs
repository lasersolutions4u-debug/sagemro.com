import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveRuntimeConfig } from './runtime.js';
import { resolveAdminLocale, getAdminLocale, setAdminLocale } from './locale.js';

const adminRoot = path.resolve(import.meta.dirname, '../..');

test('language preference never changes market, API or CN defaults', () => {
  const config = resolveRuntimeConfig('admin.sagemro.com');
  assert.equal(resolveAdminLocale('zh-CN', config.market), 'zh-CN');
  assert.equal(resolveAdminLocale('invalid', config.market), 'en');
  assert.equal(resolveAdminLocale('en', 'cn'), 'zh-CN');
  setAdminLocale('zh-CN');
  assert.equal(getAdminLocale(), 'zh-CN');
  setAdminLocale('invalid');
  assert.equal(getAdminLocale(), 'zh-CN');
  assert.equal(config.market, 'com');
  assert.equal(config.apiBase, 'https://api.sagemro.com');
  setAdminLocale('en');
});

test('knowledge market and service currency are independent of display language', () => {
  const knowledge = read('src/pages/KnowledgePage.jsx');
  const service = read('src/components/BusinessServicePanel.jsx');
  assert.match(knowledge, /const defaultMarket = runtimeConfig\.market;/);
  assert.match(knowledge, /const defaultLocale = runtimeConfig\.market === 'cn'/);
  assert.match(service, /currency: runtimeConfig\.market === 'cn' \? 'CNY' : 'USD'/);
  assert.doesNotMatch(service, /currency: zh \?/);
});

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
