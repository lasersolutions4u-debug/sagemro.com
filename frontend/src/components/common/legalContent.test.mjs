import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getLegalContent } from './legalContent.js';

test('uses Chinese legal content for China market', () => {
  const legal = getLegalContent('zh-CN');

  assert.equal(legal.tabs[0].label, '服务条款');
  assert.equal(legal.titles.agreement, 'SAGEMRO 服务条款');
  assert.equal(legal.meta, '生效日期：2026 年 6 月 7 日。平台运营方：济南欧驰机械有限公司。');
  assert.match(legal.content.agreement, /AI 生成的估算仅供参考/);
  assert.match(legal.content.privacy, /我们不会出售你的个人信息/);
  assert.match(legal.content.ai, /AI 输出仅为前期服务指引/);

  const joined = [
    legal.meta,
    ...legal.tabs.map((tab) => tab.label),
    ...Object.values(legal.titles),
    ...Object.values(legal.content),
  ].join('\n');

  assert.doesNotMatch(joined, /Terms of Service|Privacy Policy|AI Service Notice|Effective date|Service Scope/);
});

test('keeps English legal content for international market', () => {
  const legal = getLegalContent('en');

  assert.equal(legal.tabs[0].label, 'Terms of Service');
  assert.equal(legal.titles.ai, 'SAGEMRO AI Service Notice');
  assert.match(legal.content.agreement, /Service Scope/);
});
