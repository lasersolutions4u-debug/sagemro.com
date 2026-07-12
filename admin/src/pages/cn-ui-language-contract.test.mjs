import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('CN admin service orders avoid hard-coded English detail labels', () => {
  const source = read('admin/src/pages/WorkOrdersPage.jsx');

  assert.match(source, /'zh-CN': \{/);
  assert.match(source, /serviceRecordLabel: '服务记录'/);
  assert.match(source, /engineerPayoutTitle: '工程师服务费结算'/);
  assert.match(source, /payoutFields: \{/);
  assert.doesNotMatch(source, />Service Record</);
  assert.doesNotMatch(source, />Engineer service payment</);
  assert.doesNotMatch(source, />Amount: \{/);
  assert.doesNotMatch(source, />Mark payout processing</);
});

test('CN admin engineers page translates profile workflow and table labels', () => {
  const source = read('admin/src/pages/EngineersPage.jsx');

  assert.match(source, /title: '工程师'/);
  assert.match(source, /roleSettings: '区域负责人设置'/);
  assert.match(source, /eventTypes: \{/);
  assert.match(source, /workOrderHeaders: \{/);
  assert.doesNotMatch(source, />No\.<\/th>/);
  assert.doesNotMatch(source, />Status<\/th>/);
  assert.doesNotMatch(source, />Created<\/th>/);
});

test('CN admin materials import preview uses localized empty-state copy', () => {
  const source = read('admin/src/pages/MaterialsPage.jsx');

  assert.match(source, /noBlockingIssues: '未发现阻塞问题。'/);
  assert.doesNotMatch(source, />No blocking issues found\.<\/div>/);
});

test('CN admin shell HTML starts with Chinese language metadata on china branch', () => {
  const source = read('admin/index.html');

  assert.match(source, /<html lang="zh-CN">/);
  assert.match(source, /<title>SAGEMRO 运营中枢<\/title>/);
});
