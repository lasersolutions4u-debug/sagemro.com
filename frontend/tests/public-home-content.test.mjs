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

  assert.deepEqual(zh.hero, {
    eyebrow: '激光与金属成形设备服务',
    title: '设备出现故障？从问题判断到服务执行，帮你明确下一步。',
    description: '面向激光切割机、折弯机及相关工业设备，提供故障诊断、维修、系统改造、移位安装、维护保养、旧设备评估与备件支持。',
  });
  assert.deepEqual(zh.services.items.map((item) => item.title), zhServiceTitles);

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
    assert.ok(content.brands.groups.length >= 3);

    assertUniqueBy(content.problemLinks.items, 'key', 'problem links');
    assertUniqueBy(content.services.items, 'key', 'services');
    assertUniqueBy(content.reasons.items, 'key', 'reasons');
    assertUniqueBy(content.process.steps, 'key', 'process steps');
    assertUniqueBy(content.faqs.items, 'key', 'FAQs');
  }
});

test('public home content routes both request choices to the correct market portal', async () => {
  const { getPublicHomeContent } = await import('../src/data/publicHomeContent.js');

  assert.deepEqual(getPublicHomeContent(true).requestCtas, {
    assist: {
      label: '协助填写服务请求',
      href: 'https://ai.sagemro.cn/service-request?mode=assist',
    },
    manual: {
      label: '手动填写服务请求',
      href: 'https://ai.sagemro.cn/service-request?mode=manual',
    },
  });
  assert.deepEqual(getPublicHomeContent(false).requestCtas, {
    assist: {
      label: 'Get help preparing a service request',
      href: 'https://ai.sagemro.com/service-request?mode=assist',
    },
    manual: {
      label: 'Complete the service request manually',
      href: 'https://ai.sagemro.com/service-request?mode=manual',
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
  first.brands.groups[0].items.push('changed');

  const fresh = getPublicHomeContent(true);
  assert.equal(fresh.hero.title, '设备出现故障？从问题判断到服务执行，帮你明确下一步。');
  assert.equal(fresh.services.items[0].title, '设备维修与故障诊断');
  assert.doesNotMatch(JSON.stringify(fresh), /changed/);
});
