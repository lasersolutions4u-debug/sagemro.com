import assert from 'node:assert/strict';
import test from 'node:test';

const zhServiceTitles = [
  '设备维修与故障诊断',
  '系统升级与设备改造',
  '拆机、移位与重新安装',
  '设备检测与预防性维护',
  '旧设备评估与处置支持',
  '耗材、备件与更换调试',
];

const expectedLengths = {
  problemLinks: 6,
  services: 6,
  reasons: 4,
  process: 4,
};

const assertUniqueBy = (items, field, label) => {
  const values = items.map((item) => item[field]);
  assert.equal(new Set(values).size, values.length, `${label} ${field} values must be unique`);
};

test('public home content exposes the approved bilingual service-first structure', async () => {
  const { getPublicHomeContent } = await import('../src/data/publicHomeContent.js');
  const zh = getPublicHomeContent(true);
  const en = getPublicHomeContent(false);

  // CN 首页主入口改为整机厂口径；设备用户口径下沉为次入口。
  assert.deepEqual(zh.hero, {
    eyebrow: '面向激光与金属成形设备整机厂',
    title: '承接整机厂售后交付，不占你的编制。',
    titleLines: ['承接整机厂售后交付，', '不占你的编制。'],
    description: '保内上门、出口装机、返修件流转，按项目或按次承接。工程师与备件由我们组织，检测数据与服务结论留档回传。',
    image: {
      src: '/hero-field-service.jpg',
      alt: '激光切割设备切割金属板材的现场，切割点火花四溅',
      caption: '现场交付 · 装机调试 · 保内上门',
    },
  });
  // titleLines 只负责断行，拼起来必须逐字等于 title，否则标题会被静默改坏。
  assert.equal(zh.hero.titleLines.join(''), zh.hero.title);
  // 实拍图只服务中国版：图放在 public-cn/ 叠加目录，国际版首屏不得带上它。
  assert.equal(en.hero.image, undefined);
  assert.equal(en.hero.titleLines, undefined);
  assert.deepEqual(zh.services.items.map((item) => item.title), zhServiceTitles);

  assert.deepEqual(zh.audiences, {
    maker: {
      cta: '提交协作需求',
      secondaryCta: '查看协作边界',
    },
    user: {
      eyebrow: '设备用户',
      title: '设备出现故障？从问题判断到服务执行，帮你明确下一步。',
      description: '面向激光切割机、折弯机及相关工业设备，提供故障诊断、维修、系统改造、移位安装、维护保养、旧设备评估与备件支持。',
      cta: '提交服务需求',
    },
  });
  assert.equal(zh.makerEngagements.items.length, 3);
  assert.equal(zh.makerWorkflow.steps.length, 4);
  assert.equal(zh.makerBoundary.items.length, 4);
  assert.equal(zh.makerFaqs.items.length, 4);
  assertUniqueBy(zh.makerEngagements.items, 'key', 'maker engagements');
  assertUniqueBy(zh.makerWorkflow.steps, 'key', 'maker workflow steps');
  assertUniqueBy(zh.makerBoundary.items, 'key', 'maker boundary');
  assertUniqueBy(zh.makerFaqs.items, 'key', 'maker FAQs');

  // 渠道商招商只对国际站露出；CN 不出现，避免与整机厂自有渠道体系冲突。
  assert.equal(zh.partnerEntry, undefined);
  assert.ok(en.partnerEntry?.title);
  assert.match(en.partnerEntry.href, /^\/partners\/$/);

  for (const content of [zh, en]) {
    assert.equal(content.problemLinks.items.length, expectedLengths.problemLinks);
    assert.equal(content.services.items.length, expectedLengths.services);
    assert.equal(content.reasons.items.length, expectedLengths.reasons);
    assert.equal(content.process.steps.length, expectedLengths.process);
    assert.equal(content.faqs.items.length, 10);
    for (const key of ['equipment', 'timing', 'pricing', 'warranty', 'quote']) {
      const faq = content.faqs.items.find((item) => item.key === key);
      assert.ok(faq?.question);
      assert.ok(faq?.answer);
    }
    assert.ok(content.tools.items.length >= 3);
    assert.ok(content.insights.items.length >= 3);

    assertUniqueBy(content.problemLinks.items, 'key', 'problem links');
    assertUniqueBy(content.services.items, 'key', 'services');
    assertUniqueBy(content.reasons.items, 'key', 'reasons');
    assertUniqueBy(content.process.steps, 'key', 'process steps');
    assertUniqueBy(content.faqs.items, 'key', 'FAQs');
  }
});

test('public home content routes the AI request choice to the correct market portal', async () => {
  const { getPublicHomeContent } = await import('../src/data/publicHomeContent.js');

  // 服务请求页已下线：只保留 AI 门户入口，站内转化走咨询表单。
  assert.deepEqual(getPublicHomeContent(true).requestCtas, {
    assist: {
      label: 'AI 协助填写',
      href: 'https://ai.sagemro.cn/?mode=assist',
    },
  });
  assert.deepEqual(getPublicHomeContent(false).requestCtas, {
    assist: {
      label: 'Get help preparing a service request',
      href: 'https://ai.sagemro.com/?mode=assist',
    },
  });
});

test('public home claims stay within approved commercial and delivery boundaries', async () => {
  const { getPublicHomeContent } = await import('../src/data/publicHomeContent.js');
  const copies = [getPublicHomeContent(true), getPublicHomeContent(false)];

  for (const content of copies) {
    const serialized = JSON.stringify(content);
    const outsideProcessBoundary = JSON.stringify({
      ...content,
      process: { ...content.process, boundary: '' },
      requestCtas: undefined,
    });

    assert.doesNotMatch(serialized, /30\s*分钟|24\s*小时|数万|官方授权|fixed arrival|fixed warranty|authorized service/i);
    assert.doesNotMatch(serialized, /whatsapp|wa\.me|tel:/i);
    assert.doesNotMatch(outsideProcessBoundary, /\bAI\b|人工智能/i);
    assert.equal(content.contact.email, 'support@sagemro.com');
    assert.match(content.process.boundary, /AI/);
  }

  assert.match(copies[0].reasons.items[1].detail, /地区.*设备.*项目.*单独报价.*服务范围.*费用.*确认后/);
  assert.match(copies[0].reasons.items[2].detail, /国内全国协调.*国际先远程/);
  assert.match(copies[0].reasons.items[3].detail, /质保.*后续跟进.*方案或报价/);
  assert.match(copies[1].reasons.items[1].detail, /Pricing.*region.*equipment.*project.*itemized.*confirmation/i);
  assert.match(copies[1].reasons.items[3].detail, /Warranty.*follow-up.*proposal or quotation/i);
  assert.match(copies[0].process.boundary, /实际诊断、报价、派工和安全要求由技术人员确认/);
});

test('public home getter returns a deep copy on every call', async () => {
  const { getPublicHomeContent } = await import('../src/data/publicHomeContent.js');
  const first = getPublicHomeContent(true);

  first.hero.title = 'changed';
  first.services.items[0].title = 'changed';

  const fresh = getPublicHomeContent(true);
  assert.equal(fresh.hero.title, '承接整机厂售后交付，不占你的编制。');
  assert.equal(fresh.services.items[0].title, '设备维修与故障诊断');
  assert.equal(fresh.audiences.user.title, '设备出现故障？从问题判断到服务执行，帮你明确下一步。');
  assert.doesNotMatch(JSON.stringify(fresh), /changed/);
});
