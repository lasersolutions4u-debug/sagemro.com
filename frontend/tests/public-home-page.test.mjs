import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

async function renderHome(isCn) {
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: {
      hostname: isCn ? 'sagemro.cn' : 'sagemro.com',
      pathname: '/',
      search: '',
    },
  };

  let vite;
  try {
    vite = await createServer({
      root: frontendRoot,
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
    });
    const { PublicHomePage } = await vite.ssrLoadModule('/src/components/Public/PublicHomePage.jsx');
    return renderToStaticMarkup(React.createElement(PublicHomePage, { isCn }));
  } finally {
    await vite?.close();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('public home renders the approved service-first section order and real navigation', async () => {
  const html = await renderHome(true);
  const sections = [...html.matchAll(/data-home-section="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(sections, [
    'hero',
    'maker',
    'user-entry',
    'problems',
    'services',
    'reasons',
    'process',
    'tools',
    'insights',
    'faqs',
    'final-cta',
  ]);
  // h1 内部用 span 控制断行（避免「制。」孤字一行），断言先剥标签再比对全文。
  const heroHeading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(heroHeading, '首屏应包含 h1');
  assert.equal(heroHeading[1].replace(/<[^>]+>/g, ''), '承接整机厂售后交付，不占你的编制。');
  // 设备用户口径下沉为次入口，文案保持不变。
  assert.match(html, /设备出现故障？从问题判断到服务执行，帮你明确下一步。/);
  // 整机厂 4 条 + 设备用户 10 条，两类 FAQ 分开成组。
  assert.equal((html.match(/<details\b/g) || []).length, 14);
  // 渠道商招商只在国际站露出。
  assert.doesNotMatch(html, /href="\/partners\/"/);
  for (const href of ['/services/', '/tools/', '/insights/']) {
    assert.match(html, new RegExp(`href="${href}"`));
  }
  assert.match(html, /href="https:\/\/ai\.sagemro\.cn\/\?mode=assist"/);
  // 工单体系已下线：落地页的转化入口是咨询表单按钮，不再是服务请求链接。
  assert.doesNotMatch(html, /service-request/);
  assert.match(html, /<button[^>]*>提交咨询需求<\/button>/);
  assert.match(html, /href="mailto:support@sagemro\.com"/);
  // CN 首页不嵌入 AI 对话框：面向整机厂受众的页面上不放终端用户诊断组件。
  // 设备用户仍通过次入口 CTA 进入 AI 门户（上行已断言该链接存在）。
  assert.doesNotMatch(html, /data-home-chat=/);
  assert.doesNotMatch(html, /home-chat-input/);
  // CN 首屏实拍图：资源来自 public-cn/ 叠加目录，必须带 alt 与说明条。
  assert.match(html, /<img[^>]*src="\/hero-field-service\.jpg"/);
  assert.match(html, /<img[^>]*alt="[^"]+"/);
  assert.match(html, /现场交付 · 装机调试 · 保内上门/);
  for (const [title, href] of [
    ['激光切割速度参考', '/tools/laser-cutting-speed-reference/'],
    ['冷水机和除尘器选型参考', '/tools/laser-chiller-dust-collector-sizing-checklist/'],
    ['材料重量计算器', '/tools/metal-weight-calculator/'],
  ]) {
    assert.match(html, new RegExp(`<a[^>]+href="${href}"[^>]*>[\\s\\S]*?<h3[^>]*>${title}</h3>`));
  }
});

test('public home exposes six service links, ten direct FAQs, and no competing intake UI', async () => {
  const html = await renderHome(false);

  assert.equal((html.match(/data-service-card=/g) || []).length, 6);
  assert.equal((html.match(/<details\b/g) || []).length, 10);
  assert.doesNotMatch(html, /<form\b|role="dialog"|WorkOrderModal|type="tel"|wa\.me|WhatsApp/i);
  assert.match(html, /AI only helps organize submitted information/);
  assert.match(html, /href="https:\/\/ai\.sagemro\.com\/\?mode=assist"/);
  // 国际站首页出现渠道商入口，指向 /partners/。
  assert.match(html, /data-home-section="partner-entry"/);
  assert.match(html, /href="\/partners\/"/);
  // 国际站首屏保留 AI 对话框：输入框 + 发送按钮 + 问题建议。
  assert.match(html, /data-home-chat="panel"/);
  assert.match(html, /id="home-chat-input"/);
  assert.match(html, /data-home-chat="send"/);
  assert.match(html, /Ask SAGEMRO AI/);
  // 中国版专属实拍图不得出现在国际站首屏。
  assert.doesNotMatch(html, /hero-field-service/);
});

test('App routes only the resolved public build target to the public home', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(app, /resolvePortalTarget\(\{ buildTarget: BUILD_TARGET, hostname \}\)/);
  assert.match(app, /currentPath === '\/'\s*&&\s*portalTarget === 'public'[\s\S]{0,300}<PublicHomePage/);
  assert.match(app, /const isPublicPath\s*=\s*portalTarget === 'public'/);
  assert.doesNotMatch(app, /portalTarget === 'customer'[\s\S]{0,200}<PublicHomePage/);
});
