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

import { redactPII, countPII, redactFields, CHAT_PII_CATEGORIES } from '../src/lib/redact.js';

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

// ============ 国际号码（COM / 海外市场）============
// 背景：SAGEMRO 国际版客户全在海外，而原有规则全是中国本土标识
// （phone_cn / id_card_cn / license_plate_cn / bank_card 中文关键词），
// 对海外号码一律不命中。
//
// **国际号码不在默认集里**：技术语境下 `+1 234 5678`（校准偏移，+ 是正号）、
// `+44 7700 900123`（零件号）、`+1.2345678 V`（电压值）、`Part 415-555-0123`
// （零件号）与电话完全同形，而这几个字符串已被 knowledge-candidate-workflow
// 的用例锁定为"不得被改"。没有任何正则能区分它们——只有语境能。
// 因此只在"客户直接写给我们的话"（chat / 服务单整理）里用 CHAT_PII_CATEGORIES 显式开启。

const CHAT = { categories: CHAT_PII_CATEGORIES };

// ---- 正样本：显式开启后必须命中 ----

test('+1 带空格分组的美加号码被替换', () => {
  assert.equal(redactPII('Call me at +1 415 555 0132 tomorrow', CHAT), 'Call me at [电话] tomorrow');
});

test('+1 无分隔的连续号码被替换', () => {
  assert.equal(redactPII('+14155550132', CHAT), '[电话]');
});

test('(区号) 555-xxxx 北美格式被替换', () => {
  assert.equal(redactPII('Phone: (415) 555-0132', CHAT), 'Phone: [电话]');
});

test('415-555-0132 短横线格式被替换', () => {
  assert.equal(redactPII('415-555-0132', CHAT), '[电话]');
});

test('415.555.0132 点分格式被替换', () => {
  assert.equal(redactPII('415.555.0132', CHAT), '[电话]');
});

test('+49 德国号码（含 8 位尾号）被替换', () => {
  assert.equal(redactPII('+49 30 12345678', CHAT), '[电话]');
});

test('00 国际前缀带分隔符的号码被替换', () => {
  assert.equal(redactPII('Dial 0044 20 7946 0958', CHAT), 'Dial [电话]');
});

test('+86 中国号码带国家码时按国际号处理', () => {
  assert.equal(redactPII('+86 138 0013 8000', CHAT), '[电话]');
});

test('海外客户消息里的号码被脱敏而技术内容保留', () => {
  const input = 'Customer at +1 415 555 0132 reported 6000W cutting 16mm carbon steel with E053 alarm';
  const output = redactPII(input, CHAT);
  assert.ok(output.includes('[电话]'), '号码被脱敏');
  assert.ok(output.includes('6000W'), '功率保留');
  assert.ok(output.includes('16mm'), '厚度保留');
  assert.ok(output.includes('E053'), '报警码保留');
  assert.ok(!output.includes('415 555 0132'));
});

// ---- 负样本：即使开启国际类别也不能误伤 ----

test('开启后仍不脱中国长编号串（00 前缀必须带分隔符）', () => {
  // 原有负样本，锁住 RE_PHONE_INTL_00 必须要求分隔符
  const t = '001380013800090';
  assert.equal(redactPII(t, CHAT), t);
});

test('开启后仍不脱日期', () => {
  const t = '工单创建于 2026-09-18';
  assert.equal(redactPII(t, CHAT), t);
});

test('开启后仍不脱三段版本号形状（区号首位不能是 1）', () => {
  const t = '控制器固件 100.200.3000';
  assert.equal(redactPII(t, CHAT), t);
});

test('开启后仍不脱尺寸三元组', () => {
  const t = '厚度组合 16-20-30 均可切';
  assert.equal(redactPII(t, CHAT), t);
});

test('开启后仍不脱 + 开头的短表达式（数字总数不足 7）', () => {
  const t = '公差 +1 2 3';
  assert.equal(redactPII(t, CHAT), t);
});

test('开启后仍不脱超过 15 位的 + 开头编号串', () => {
  const t = '+12345678901234567890';
  assert.equal(redactPII(t, CHAT), t);
});

test('设备型号 / 报警码 / 工单号在海外文本里也不被误伤', () => {
  const t = 'F3015 SV0401 WO-20260422-001 ALM-920';
  assert.equal(redactPII(t, CHAT), t);
});

// ---- 关键设计约束：默认集一个国际号码都不脱 ----

test('默认不脱 + 开头号码（技术语境里 + 是正号）', () => {
  const t = 'Power correction +1.2345678 V stayed stable.';
  assert.equal(redactPII(t), t);
});

test('默认不脱零件号形状 +44 7700 900123', () => {
  const t = 'Part code +44 7700 900123 remains on the replacement label.';
  assert.equal(redactPII(t), t);
});

test('默认不脱裸的 3-3-4 分组（可能是零件号）', () => {
  const t = 'Part 415-555-0123 triggered alarm E001.';
  assert.equal(redactPII(t), t);
});

// ---- countPII / categories ----

test('countPII 只统计默认集，不把 opt-in 的国际号码算进去', () => {
  // countPII 的输出被当作"默认集是否命中"的检测向量使用，
  // 加入 opt-in 类别会让 `+1 234 5678` 这类技术值被判成敏感内容。
  const counts = countPII('+1 415 555 0132 和 (415) 555-0133');
  assert.equal(counts.phone_intl, undefined);
  assert.equal(counts.phone_cn, 0);
  assert.equal(Object.values(counts).some((n) => n > 0), false, '不得触发敏感检测');
});

test('categories 只含 phone_cn 时不脱国际号码（可单独关闭）', () => {
  const input = '电话 13812345678，海外 +1 415 555 0132';
  const cnOnly = redactPII(input, { categories: ['phone_cn'] });
  assert.ok(cnOnly.includes('[手机号]'));
  assert.ok(cnOnly.includes('+1 415 555 0132'), '未指定 phone_intl → 国际号码保留');
});

test('categories 只含 phone_intl 时不脱中国手机号', () => {
  const input = '电话 13812345678，海外 +1 415 555 0132';
  const intlOnly = redactPII(input, { categories: ['phone_intl'] });
  assert.ok(intlOnly.includes('13812345678'), '未指定 phone_cn → 中国号码保留');
  assert.ok(intlOnly.includes('[电话]'));
});
