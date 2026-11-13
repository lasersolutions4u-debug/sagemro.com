import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getPublicSeoRoute } from '../src/data/publicSeoRoutes.js';
import { SERVICE_BILLING } from '../src/data/serviceBilling.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * 退款/取消政策是收款方审核的必查项：支付机构要一个可访问的 URL，银行要看到
 * 「钱怎么进来、什么情况下退出去」。所以这一页不是营销文案，断言按条款逐条钉。
 */
const pageCopy = (route) => [
  route.title,
  route.description,
  route.body.h1,
  ...(route.body.paragraphs ?? []),
  ...route.body.sections.flatMap((section) => [section.heading, section.body, ...(section.items ?? [])]),
  ...(route.body.links ?? []).map((link) => `${link.label} ${link.href}`),
].join(' ');

test('the refund policy page publishes the payment, cancellation, and warranty boundary clauses', () => {
  const en = getPublicSeoRoute('/refund-policy', 'en');
  const cn = getPublicSeoRoute('/refund-policy', 'zh-CN');

  for (const [locale, route] of [['en', en], ['zh-CN', cn]]) {
    assert.ok(route, `${locale} 缺少 /refund-policy`);
    assert.equal(route.type, 'refund-policy');
    assert.equal(route.robots, 'index,follow');
    assert.equal(route.canonical, `https://sagemro.${locale === 'zh-CN' ? 'cn' : 'com'}/refund-policy/`);
    assert.deepEqual(route.alternates, {
      en: 'https://sagemro.com/refund-policy/',
      'zh-CN': 'https://sagemro.cn/refund-policy/',
      'x-default': 'https://sagemro.com/refund-policy/',
    });
    assert.ok(route.body.sections.length >= 6, `${locale} 政策章节过少`);
    // 每个章节都要有标题和正文，不能只挂标题。
    for (const section of route.body.sections) {
      assert.ok(section.heading.length > 0);
      assert.ok(section.body.length > 0);
      for (const item of section.items ?? []) assert.ok(item.length > 0);
    }
  }

  const enCopy = pageCopy(en);
  // 两个付款触发点：预付款与尾款，比例必须写死在同一处口径上。
  assert.match(enCopy, /30%/);
  assert.match(enCopy, /70%/);
  assert.match(enCopy, /deposit/i);
  assert.match(enCopy, /balance/i);
  assert.match(enCopy, /cancellation/i);
  assert.match(enCopy, /refund/i);
  assert.match(enCopy, /14 business days/i);
  // 报价先于开工：与站内既有的「itemized quotation before work starts」口径一致。
  assert.match(enCopy, /written quotation|quotation/i);
  // 不替代原厂保修，且说明索赔仍在厂家或其经销商。
  assert.match(enCopy, /does not (?:extend, )?replace|extends, replaces, transfers, or assumes/i);
  assert.match(enCopy, /maker|manufacturer/i);
  assert.match(enCopy, /dealer/i);

  const cnCopy = pageCopy(cn);
  assert.match(cnCopy, /30%/);
  assert.match(cnCopy, /70%/);
  assert.match(cnCopy, /预付款/);
  assert.match(cnCopy, /尾款/);
  assert.match(cnCopy, /取消/);
  assert.match(cnCopy, /退款/);
  assert.match(cnCopy, /原厂保修/);
  assert.match(cnCopy, /经销商/);

  // 中国站不得出现美元/LLC 口径，国际站不得出现人民币口径。
  assert.doesNotMatch(cnCopy, /SAGEMRO LLC|US dollars/);
  assert.match(enCopy, /SAGEMRO LLC/);
});

test('the terms and the refund page share one set of clauses instead of two copies', async () => {
  const legal = await read('src/components/common/LegalModal.jsx');
  const billing = await read('src/data/serviceBilling.js');

  // 条款按条引用单一数据源；页面渲染同一份数据。
  for (const key of ['deposit', 'balance', 'cancellationSummary', 'refundSummary', 'warrantyBoundaryTerms']) {
    assert.ok(SERVICE_BILLING.en[key], `serviceBilling.en 缺 ${key}`);
    assert.ok(SERVICE_BILLING['zh-CN'][key], `serviceBilling['zh-CN'] 缺 ${key}`);
    assert.match(legal, new RegExp(`BILLING\\.en\\.${key}`), `条款没有引用 en.${key}`);
    assert.match(legal, new RegExp(`BILLING\\['zh-CN'\\]\\.${key}`), `条款没有引用 zh-CN.${key}`);
  }

  // 数字只在这个数据源里出现一次：30/70、7 天、48 小时、14 个工作日。
  assert.match(billing, /30%/);
  assert.match(billing, /70%/);
  assert.match(legal, /## 10\. Warranty and OEM Support Boundary/);
  assert.match(legal, /## 10\. 原厂保修边界与工艺保修/);
  // 「沙盒支付」的旧口径必须消失：站内没有收单界面，写沙盒只会让审核方以为收款是假的。
  assert.doesNotMatch(legal, /sandbox or demonstration/);
  assert.doesNotMatch(legal, /沙盒或演示界面/);
  // 收款路径：银行转账 + Stripe 托管刷卡（2026-11-13 决定）。
  assert.match(legal, /processed by Stripe/i);
  assert.match(legal, /由 Stripe 处理/);
  assert.match(pageCopy(getPublicSeoRoute('/refund-policy', 'en')), /Stripe/);
  assert.match(pageCopy(getPublicSeoRoute('/refund-policy', 'zh-CN')), /Stripe/);
});

test('refund policy is reachable from the footer, the contact page, and the app router', async () => {
  const footer = await read('src/components/common/Footer.jsx');
  assert.match(footer, /href="\/refund-policy\/"/);
  assert.match(footer, /refundLabel/);

  const contactEn = getPublicSeoRoute('/contact', 'en');
  assert.ok(
    contactEn.body.links.some((link) => link.href === '/refund-policy/'),
    '联系页应链到退款政策',
  );
  const aboutEn = getPublicSeoRoute('/about', 'en');
  assert.ok(
    aboutEn.body.links.some((link) => link.href === '/refund-policy/'),
    '/about 应链到退款政策',
  );
  const homeEn = getPublicSeoRoute('/', 'en');
  assert.ok(
    homeEn.body.links.some((link) => link.href === '/refund-policy/'),
    '首页静态壳应链到退款政策',
  );

  const app = await read('src/App.jsx');
  assert.match(app, /const RefundPolicyPage = lazy/);
  assert.match(app, /const isRefundPolicyPath = portalTarget === 'public'/);
  assert.match(app, /isContactPath\s*\|\|\s*isRefundPolicyPath/);
});
