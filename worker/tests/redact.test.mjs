// redact.js 单元测试
//
// 运行方式：
//   cd worker
//   node --test tests/redact.test.mjs
//
// 重点覆盖：
//   - 常见 PII 模式命中（正样本）
//   - 技术内容不被误伤（负样本，这组比正样本更重要——误伤才是 RAG 杀手）
//   - 同文本含多类 PII 时全部命中
//   - 边界：空串 / null / 非字符串 不抛错

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redactPII, countPII, redactFields } from '../src/lib/redact.js';

// ============ 正样本：必须命中 ============

test('手机号被替换为 [手机号]', () => {
  assert.equal(
    redactPII('我的电话是13812345678，请尽快联系'),
    '我的电话是[手机号]，请尽快联系',
  );
});

test('多个手机号都被替换', () => {
  assert.equal(
    redactPII('联系人 13800138000 或 15912345678'),
    '联系人 [手机号] 或 [手机号]',
  );
});

test('17x 号段（17开头）手机号命中', () => {
  assert.equal(redactPII('17012345678'), '[手机号]');
});

test('19x 号段（19开头）手机号命中', () => {
  assert.equal(redactPII('19912345678'), '[手机号]');
});

test('身份证 18 位（末位 X）被替换', () => {
  assert.equal(
    redactPII('身份证 11010519900307234X'),
    '身份证 [身份证]',
  );
});

test('身份证 18 位（末位 x 小写）被替换', () => {
  assert.equal(redactPII('11010519900307234x'), '[身份证]');
});

test('邮箱被替换', () => {
  assert.equal(
    redactPII('邮箱 ops@sagemro.com，有问题找我'),
    '邮箱 [邮箱]，有问题找我',
  );
});

test('带标签的银行卡号（卡号）被替换', () => {
  assert.equal(
    redactPII('卡号：6228480123456789012'),
    '卡号：[银行卡]',
  );
});

test('带标签的银行卡号（尾号）被替换', () => {
  // 注意：当前正则 alternation 是贪婪"最先命中"，"工行尾号 X" 里 工行 先被匹配
  // 但 "工行" 后跟 "尾号" 不是数字，匹配失败；引擎回溯到 "尾号 X" 命中
  // 所以结果是 "工行" 保留在前，"尾号 X" 变成 "尾号 [银行卡]"
  assert.equal(
    redactPII('工行尾号 1234567890123'),
    '工行尾号 [银行卡]',
  );
});

test('带标签的银行卡号（单标签尾号）被替换', () => {
  assert.equal(
    redactPII('尾号 1234567890123 是我的'),
    '尾号 [银行卡] 是我的',
  );
});

test('车牌被替换（普通 5 位尾段）', () => {
  assert.equal(redactPII('车牌苏E12345'), '车牌[车牌]');
});

test('车牌被替换（新能源 6 位尾段）', () => {
  assert.equal(redactPII('沪AD12345'), '[车牌]');
});

test('带凭据的 URL 被替换', () => {
  assert.equal(
    redactPII('配置地址 https://admin:secret123@db.example.com/api'),
    '配置地址 [URL]',
  );
});

// ============ 负样本：不能误伤（这组最关键，技术内容必须保留）============

test('设备型号不被误伤（G3015H）', () => {
  const t = '我的设备是大族 G3015H 激光切割机';
  assert.equal(redactPII(t), t);
});

test('设备型号不被误伤（TruBend 8170）', () => {
  const t = '通快 TruBend 8170 液压同步折弯机';
  assert.equal(redactPII(t), t);
});

test('功率参数不被误伤', () => {
  const t = '3000W 光纤激光器切 6mm 碳钢';
  assert.equal(redactPII(t), t);
});

test('工单号不被误伤', () => {
  const t = '工单 WO-20260422-001 已分配给张师傅';
  assert.equal(redactPII(t), t);
});

test('纯 13 位数字（长订单号 / 条码）不被误伤为银行卡', () => {
  // 没有"卡号/账号/尾号"等关键词前缀，不应命中
  const t = '条码 1234567890123 扫描后入库';
  assert.equal(redactPII(t), t);
});

test('不是 1[3-9] 开头的 11 位数字不被误伤为手机号', () => {
  const t = '订单长度 22345678901 字段';
  assert.equal(redactPII(t), t);
});

test('12 位数字不被误伤为手机号', () => {
  // 11 位被 (?!\d) 保护，12 位会整串不命中
  const t = '设备序列号 138123456789';
  assert.equal(redactPII(t), t);
});

test('10 位数字不被误伤为手机号', () => {
  const t = '代码 1381234567';
  assert.equal(redactPII(t), t);
});

test('手机号嵌在长数字串中间不误伤（前后都有数字）', () => {
  const t = '001380013800090'; // 13800138000 在中间，前后都是数字 → 负向断言挡住
  assert.equal(redactPII(t), t);
});

test('错误码不被误伤', () => {
  const t = 'Fanuc 报 SV0401 伺服报警，ALM-920 液压超压';
  assert.equal(redactPII(t), t);
});

test('品牌名不被误伤', () => {
  const t = '大族 / 通快 / 百超 / 奔腾都有售后';
  assert.equal(redactPII(t), t);
});

// ============ 混合场景 ============

test('一段文本里多类 PII 全部命中', () => {
  const input =
    '客户张工（电话 13812345678，邮箱 zhang@example.com）反馈 3000W 激光机切割挂渣，工单 WO-20260422-001';
  const output = redactPII(input);
  assert.ok(output.includes('[手机号]'));
  assert.ok(output.includes('[邮箱]'));
  assert.ok(output.includes('3000W'), '技术参数保留');
  assert.ok(output.includes('WO-20260422-001'), '工单号保留');
  assert.ok(!output.includes('13812345678'));
  assert.ok(!output.includes('zhang@example.com'));
});

test('categories 参数只脱指定类别', () => {
  const input = '电话 13812345678，邮箱 a@b.com';
  const phoneOnly = redactPII(input, { categories: ['phone_cn'] });
  assert.ok(phoneOnly.includes('[手机号]'));
  assert.ok(phoneOnly.includes('a@b.com'), '未指定 email 类别 → 邮箱保留');
});

// ============ countPII ============

test('countPII 统计命中数不改原文', () => {
  const input = '13812345678 和 13900139000 两个手机号，邮箱 x@y.com';
  const counts = countPII(input);
  assert.equal(counts.phone_cn, 2);
  assert.equal(counts.email, 1);
  assert.equal(counts.id_card_cn, 0);
});

// ============ redactFields ============

test('redactFields 只对指定字段脱敏，其他字段原样', () => {
  const body = {
    description: '客户电话 13812345678',
    type: 'fault',
    urgency: 'urgent',
  };
  const out = redactFields(body, ['description']);
  assert.equal(out.description, '客户电话 [手机号]');
  assert.equal(out.type, 'fault', '非目标字段不变');
  assert.equal(body.description, '客户电话 13812345678', '原对象不被 mutate');
});

test('redactFields 对不存在 / 非字符串字段安全跳过', () => {
  const body = { description: '13812345678', count: 123, tags: null };
  const out = redactFields(body, ['description', 'count', 'tags', 'missing']);
  assert.equal(out.description, '[手机号]');
  assert.equal(out.count, 123, '数字字段不变');
  assert.equal(out.tags, null, 'null 字段不变');
});

// ============ 边界 ============

test('空字符串原样返回', () => {
  assert.equal(redactPII(''), '');
});

test('null / undefined / 非字符串原样返回，不抛错', () => {
  assert.equal(redactPII(null), null);
  assert.equal(redactPII(undefined), undefined);
  assert.equal(redactPII(12345), 12345);
});

test('没有 PII 的纯技术描述原样返回', () => {
  const t = '3000W 光纤激光切割机 G3015H 挂渣严重，建议检查保护镜片';
  assert.equal(redactPII(t), t);
});
