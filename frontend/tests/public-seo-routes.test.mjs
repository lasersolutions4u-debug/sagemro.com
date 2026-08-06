import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocalizedTool, publicIndustryTools } from '../src/data/industryTools.js';
import { getPublicSeoRoute, getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
import { welcomePageCopy } from '../src/data/welcomePageCopy.js';

test('manifest lists only indexable customer routes in both locales', () => {
  for (const locale of ['en', 'zh-CN']) {
    const routes = getPublicSeoRoutes(locale);
    assert.equal(routes.some((route) => route.path === '/tools/bend-simulator'), false);
    assert.equal(routes.some((route) => route.path === '/engineer'), false);
    assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
    assert.equal(routes.every((route) => route.robots === 'index,follow'), true);
    assert.equal(routes.every((route) => /^https:\/\/sagemro\.(com|cn)/.test(route.canonical)), true);
    assert.equal(routes.every((route) => route.alternates.en && route.alternates['zh-CN']), true);
  }
});

test('manifest body mirrors visible homepage and tool headings', () => {
  const home = getPublicSeoRoute('/', 'en');
  const homeCn = getPublicSeoRoute('/', 'zh-CN');

  assert.equal(home.body.h1, welcomePageCopy.en.headline);
  assert.deepEqual(home.body.paragraphs, [welcomePageCopy.en.intro]);
  assert.equal(homeCn.body.h1, welcomePageCopy.zh.headline);
  assert.deepEqual(homeCn.body.paragraphs, [welcomePageCopy.zh.intro]);

  for (const locale of ['en', 'zh-CN']) {
    for (const tool of publicIndustryTools) {
      const route = getPublicSeoRoute(`/tools/${tool.slug}`, locale);
      assert.equal(route.body.h1, getLocalizedTool(tool, locale).seoTitle);
    }
  }
});
