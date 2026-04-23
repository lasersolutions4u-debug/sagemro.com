// Phase 1.2 / 1.3 — SummaryProtocol v1 单元测试
//
// 覆盖范围：
//   - shouldTriggerSummary 阈值逻辑（策略 B：total >= 6 && delta >= 3）
//   - __internals.tryParseJson（JSON / 带 markdown 代码块 / 非法）
//   - __internals.sanitizeSummary（必填 / 枚举兜底 / pending_items 前缀过滤 / 长度截断）
//   - __internals.buildFallbackSummary（错误包裹）

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldTriggerSummary,
  SUMMARY_PROTOCOL_VERSION,
  __internals,
} from '../src/lib/summary.js';

const { tryParseJson, sanitizeSummary, buildFallbackSummary, CONVERSATION_TYPES, PENDING_ITEM_PREFIXES } =
  __internals;

// ============ shouldTriggerSummary ============

test('shouldTriggerSummary: 不足 6 条消息不触发', () => {
  assert.equal(shouldTriggerSummary({ total: 5, summaryMessageCount: 0 }), false);
  assert.equal(shouldTriggerSummary({ total: 0, summaryMessageCount: 0 }), false);
});

test('shouldTriggerSummary: 6 条首次摘要触发', () => {
  assert.equal(shouldTriggerSummary({ total: 6, summaryMessageCount: 0 }), true);
});

test('shouldTriggerSummary: 距上次 < 3 不触发', () => {
  // 已摘要 10 条，当前 12 条 → delta=2
  assert.equal(shouldTriggerSummary({ total: 12, summaryMessageCount: 10 }), false);
});

test('shouldTriggerSummary: 距上次 == 3 触发', () => {
  assert.equal(shouldTriggerSummary({ total: 13, summaryMessageCount: 10 }), true);
});

test('shouldTriggerSummary: 距上次 > 3 触发', () => {
  assert.equal(shouldTriggerSummary({ total: 20, summaryMessageCount: 10 }), true);
});

test('shouldTriggerSummary: 非数字 total 不触发', () => {
  assert.equal(shouldTriggerSummary({ total: null, summaryMessageCount: 0 }), false);
  assert.equal(shouldTriggerSummary({ total: undefined, summaryMessageCount: 0 }), false);
  assert.equal(shouldTriggerSummary({ total: 'abc', summaryMessageCount: 0 }), false);
});

test('shouldTriggerSummary: summaryMessageCount 缺省按 0', () => {
  assert.equal(shouldTriggerSummary({ total: 6 }), true);
  assert.equal(shouldTriggerSummary({ total: 6, summaryMessageCount: null }), true);
});

// ============ tryParseJson ============

test('tryParseJson: 普通 JSON', () => {
  assert.deepEqual(tryParseJson('{"a":1}'), { a: 1 });
});

test('tryParseJson: 带 ```json 代码块围栏', () => {
  const text = '```json\n{"x": 42}\n```';
  assert.deepEqual(tryParseJson(text), { x: 42 });
});

test('tryParseJson: 带 ``` 无 json 标记的围栏', () => {
  const text = '```\n{"y": true}\n```';
  assert.deepEqual(tryParseJson(text), { y: true });
});

test('tryParseJson: 空串 / 非字符串返回 null', () => {
  assert.equal(tryParseJson(''), null);
  assert.equal(tryParseJson('   '), null);
  assert.equal(tryParseJson(null), null);
  assert.equal(tryParseJson(undefined), null);
  assert.equal(tryParseJson(123), null);
});

test('tryParseJson: 非法 JSON 不抛错返回 null', () => {
  assert.equal(tryParseJson('{not json}'), null);
  assert.equal(tryParseJson('garbage'), null);
});

// ============ sanitizeSummary ============

test('sanitizeSummary: 缺 summary_text 判无效', () => {
  const { valid } = sanitizeSummary({ conversation_type: 'general' });
  assert.equal(valid, false);
});

test('sanitizeSummary: summary_text 空串判无效', () => {
  const { valid } = sanitizeSummary({ summary_text: '   ' });
  assert.equal(valid, false);
});

test('sanitizeSummary: null / 数组 / 非对象无效', () => {
  assert.equal(sanitizeSummary(null).valid, false);
  assert.equal(sanitizeSummary([]).valid, false);
  assert.equal(sanitizeSummary('string').valid, false);
});

test('sanitizeSummary: 正常 case 通过并注入 version', () => {
  const { valid, sanitized } = sanitizeSummary({
    conversation_type: 'device_consult',
    summary_text: '客户问 3000W 光纤切 6mm 碳钢毛刺',
    intent: '咨询',
  });
  assert.equal(valid, true);
  assert.equal(sanitized.protocol_version, SUMMARY_PROTOCOL_VERSION);
  assert.equal(sanitized.conversation_type, 'device_consult');
});

test('sanitizeSummary: 非法 conversation_type 兜底为 general', () => {
  const { valid, sanitized } = sanitizeSummary({
    conversation_type: 'totally_bogus_type',
    summary_text: 'something',
  });
  assert.equal(valid, true);
  assert.equal(sanitized.conversation_type, 'general');
});

test('sanitizeSummary: summary_text 过长被截断到 240 字符', () => {
  const { sanitized } = sanitizeSummary({
    summary_text: 'a'.repeat(1000),
  });
  assert.equal(sanitized.summary_text.length, 240);
});

test('sanitizeSummary: pending_items 过滤非法前缀', () => {
  const { sanitized } = sanitizeSummary({
    summary_text: 'x',
    pending_items: [
      '[missing_info] ok',
      '[awaiting_confirmation] ok2',
      '没前缀的条目',
      '[bogus_prefix] 不合法',
      '',
      123, // 非字符串
    ],
  });
  assert.deepEqual(sanitized.pending_items, [
    '[missing_info] ok',
    '[awaiting_confirmation] ok2',
  ]);
});

test('sanitizeSummary: pending_items 非数组删除字段', () => {
  const { sanitized } = sanitizeSummary({
    summary_text: 'x',
    pending_items: 'not-an-array',
  });
  assert.equal('pending_items' in sanitized, false);
});

test('sanitizeSummary: pending_items 截断到 10 条', () => {
  const items = Array.from({ length: 20 }, (_, i) => `[missing_info] item${i}`);
  const { sanitized } = sanitizeSummary({
    summary_text: 'x',
    pending_items: items,
  });
  assert.equal(sanitized.pending_items.length, 10);
});

test('sanitizeSummary: device 子对象清洗空字段', () => {
  const { sanitized } = sanitizeSummary({
    summary_text: 'x',
    device: {
      type: '激光切割机',
      brand: '  大族  ', // 应被 trim
      model: '',       // 空被过滤
      power: null,      // 非字符串过滤
      bogus: 'x',       // 非白名单字段过滤
    },
  });
  assert.deepEqual(sanitized.device, { type: '激光切割机', brand: '大族' });
});

test('sanitizeSummary: device 全空删除字段', () => {
  const { sanitized } = sanitizeSummary({
    summary_text: 'x',
    device: { type: '', brand: '' },
  });
  assert.equal('device' in sanitized, false);
});

test('sanitizeSummary: referenced_ids 过滤非数组字段', () => {
  const { sanitized } = sanitizeSummary({
    summary_text: 'x',
    referenced_ids: {
      work_order_ids: ['WO-1', 'WO-2', 123, ''], // 数字 + 空串被过滤
      engineer_ids: 'not-array',                  // 非数组被整条丢
      device_ids: [],
    },
  });
  assert.deepEqual(sanitized.referenced_ids.work_order_ids, ['WO-1', 'WO-2']);
  assert.equal('engineer_ids' in sanitized.referenced_ids, false);
  assert.deepEqual(sanitized.referenced_ids.device_ids, []);
});

test('sanitizeSummary: fault_keywords 过滤非字符串 + 截 10 条', () => {
  const { sanitized } = sanitizeSummary({
    summary_text: 'x',
    fault_keywords: ['挂渣', 123, '', '毛刺', null].concat(
      Array.from({ length: 20 }, (_, i) => `kw${i}`)
    ),
  });
  assert.equal(Array.isArray(sanitized.fault_keywords), true);
  assert.equal(sanitized.fault_keywords.length, 10);
  assert.equal(sanitized.fault_keywords.includes(123), false);
  assert.equal(sanitized.fault_keywords.includes(''), false);
});

// ============ buildFallbackSummary ============

test('buildFallbackSummary: 携带 errorCode 与 previewText', () => {
  const fb = buildFallbackSummary({
    previewText: 'A'.repeat(1000),
    errorCode: 'timeout',
    sourceMessageCount: 8,
  });
  assert.equal(fb.protocol_version, SUMMARY_PROTOCOL_VERSION);
  assert.equal(fb.conversation_type, 'general');
  assert.equal(fb.generation_error, 'timeout');
  assert.equal(fb.source_message_count, 8);
  assert.equal(fb.raw_text_preview.length, 500); // 截到 500
  assert.ok(fb.generated_at); // ISO 时间戳存在
});

test('buildFallbackSummary: 缺省字段有合理默认', () => {
  const fb = buildFallbackSummary({ sourceMessageCount: 0 });
  assert.equal(fb.generation_error, 'unknown');
  assert.equal(fb.raw_text_preview, '');
});

// ============ 元数据导出一致性 ============

test('internals: CONVERSATION_TYPES 包含协议锁定的 8 个值', () => {
  const expected = [
    'device_consult',
    'repair_request',
    'pricing',
    'rating_complaint',
    'wallet_query',
    'post_sale_followup',
    'onboarding',
    'general',
  ];
  assert.deepEqual(CONVERSATION_TYPES, expected);
});

test('internals: PENDING_ITEM_PREFIXES 包含协议锁定的 5 个前缀', () => {
  const expected = [
    '[missing_info]',
    '[awaiting_confirmation]',
    '[followup_due]',
    '[payment_pending]',
    '[rating_pending]',
  ];
  assert.deepEqual(PENDING_ITEM_PREFIXES, expected);
});
