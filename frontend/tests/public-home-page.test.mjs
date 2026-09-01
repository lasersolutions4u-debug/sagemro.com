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
    'problems',
    'services',
    'reasons',
    'process',
    'brands',
    'tools',
    'insights',
    'faqs',
    'final-cta',
  ]);
  assert.match(html, /<h1[^>]*>设备出现故障？从问题判断到服务执行，帮你明确下一步。<\/h1>/);
  for (const href of ['/services/', '/brands/', '/tools/', '/insights/']) {
    assert.match(html, new RegExp(`href="${href}"`));
  }
  assert.match(html, /href="https:\/\/ai\.sagemro\.cn\/service-request\?mode=assist"/);
  assert.match(html, /href="https:\/\/ai\.sagemro\.cn\/service-request\?mode=manual"/);
  assert.match(html, /href="mailto:support@sagemro\.com"/);
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
  assert.match(html, /href="https:\/\/ai\.sagemro\.com\/service-request\?mode=assist"/);
});

test('App routes only the resolved public build target to the public home', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(app, /resolvePortalTarget\(\{ buildTarget: BUILD_TARGET, hostname \}\)/);
  assert.match(app, /currentPath === '\/'\s*&&\s*portalTarget === 'public'[\s\S]{0,300}<PublicHomePage/);
  assert.match(app, /const isPublicPath\s*=\s*portalTarget === 'public'/);
  assert.doesNotMatch(app, /portalTarget === 'customer'[\s\S]{0,200}<PublicHomePage/);
});
