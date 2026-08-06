import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocalizedTool, publicIndustryTools } from '../src/data/industryTools.js';
import { getDirectAccessNoindexToolRoutes, getPublicSeoRoute, getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
import { welcomePageCopy } from '../src/data/welcomePageCopy.js';
import {
  escapeHtml,
  renderPublicDocument,
  renderRedirects,
  renderRobots,
  renderSitemap,
} from '../scripts/publicPageRenderer.mjs';

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta name="description" content="Default description" />
    <meta name="robots" content="index, follow" />
    <title>Default title</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

test('manifest lists only indexable customer routes in both locales', () => {
  const publicSlugs = [
    'metal-weight-calculator',
    'laser-cutting-cost-calculator',
    'press-brake-tonnage-calculator',
    'press-brake-v-die-bend-allowance-helper',
  ];

  assert.deepEqual(publicIndustryTools.map((tool) => tool.slug), publicSlugs);

  for (const locale of ['en', 'zh-CN']) {
    const routes = getPublicSeoRoutes(locale);
    assert.equal(routes.some((route) => route.path === '/tools/bend-simulator'), false);
    assert.equal(routes.some((route) => route.path === '/tools/laser-cutting-speed-reference'), false);
    assert.equal(routes.some((route) => route.path === '/tools/laser-chiller-dust-collector-sizing-checklist'), false);
    assert.equal(routes.some((route) => route.path === '/tools/steel-price-watch'), false);
    assert.equal(routes.some((route) => route.path === '/tools/laser-assist-gas-consumption-calculator'), false);
    assert.equal(routes.some((route) => route.path === '/tools/laser-cutting-machine-roi-calculator'), false);
    assert.equal(routes.some((route) => route.path === '/engineer'), false);
    assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
    assert.equal(routes.every((route) => route.robots === 'index,follow'), true);
    assert.equal(routes.every((route) => /^https:\/\/sagemro\.(com|cn)/.test(route.canonical)), true);
    assert.equal(routes.every((route) => route.alternates.en && route.alternates['zh-CN']), true);
  }
});

test('direct-access noindex tool routes are separate from the public manifest', () => {
  const noindexSlugs = [
    'steel-price-watch',
    'laser-assist-gas-consumption-calculator',
    'laser-cutting-speed-reference',
    'laser-cutting-machine-roi-calculator',
    'laser-chiller-dust-collector-sizing-checklist',
  ];

  for (const locale of ['en', 'zh-CN']) {
    const routes = getDirectAccessNoindexToolRoutes(locale);

    assert.deepEqual(routes.map((route) => route.path), noindexSlugs.map((slug) => `/tools/${slug}`));
    assert.ok(routes.every((route) => route.robots === 'noindex,nofollow,noarchive'));
    assert.equal(routes.some((route) => route.path === '/tools/bend-simulator'), false);
    assert.ok(routes.every((route) => getPublicSeoRoute(route.path, locale) === null));
  }
});

test('all four public tools include calculator-derived evidence in both static locales', () => {
  for (const locale of ['en', 'zh-CN']) {
    for (const tool of publicIndustryTools) {
      const route = getPublicSeoRoute(`/tools/${tool.slug}`, locale);

      assert.equal(route.body.sections.length, 6);
      assert.ok(route.body.sections.every((section) => section.body.length > 0));
      assert.match(route.body.sections[1].body, /kg|USD|tons|mm/);
    }
  }
});

test('manifest body mirrors visible homepage and tool headings', () => {
  const home = getPublicSeoRoute('/', 'en');
  const homeCn = getPublicSeoRoute('/', 'zh-CN');

  assert.equal(home.body.h1, welcomePageCopy.en.headline);
  assert.deepEqual(home.body.paragraphs, [welcomePageCopy.en.intro]);
  assert.deepEqual(home.body.resources, welcomePageCopy.en.resources);
  assert.equal(homeCn.body.h1, welcomePageCopy.zh.headline);
  assert.deepEqual(homeCn.body.paragraphs, [welcomePageCopy.zh.intro]);
  assert.deepEqual(homeCn.body.resources, welcomePageCopy.zh.resources);

  for (const locale of ['en', 'zh-CN']) {
    for (const tool of publicIndustryTools) {
      const route = getPublicSeoRoute(`/tools/${tool.slug}`, locale);
      assert.equal(route.body.h1, getLocalizedTool(tool, locale).seoTitle);
    }
  }
});

test('rendered tool HTML contains crawlable content and safe JSON-LD', () => {
  const route = getPublicSeoRoute('/tools/press-brake-tonnage-calculator', 'en');
  const html = renderPublicDocument(TEMPLATE, route, 'en');

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Press Brake Tonnage Calculator \| SAGEMRO<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/sagemro\.com\/tools\/press-brake-tonnage-calculator"/);
  assert.match(html, /hreflang="zh-CN"/);
  assert.match(html, /<h1>Press Brake Tonnage Calculator<\/h1>/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /<script[^>]*>.*<\/script><\/script>/s);
});

test('renderer escapes page content and protects JSON-LD script boundaries', () => {
  const route = {
    ...getPublicSeoRoute('/tools/press-brake-tonnage-calculator', 'en'),
    title: 'Title <& "quote"',
    description: 'Description <& "quote"',
    body: { h1: '</script><script>alert(1)</script>', paragraphs: ['Intro <& "quote"'], sections: ['Body <& "quote"'] },
    structuredData: { '@type': 'WebApplication', name: '</script><script>alert(1)</script>' },
  };
  const html = renderPublicDocument(TEMPLATE, route, 'en');

  assert.match(html, /Title &lt;&amp; &quot;quote&quot;/);
  assert.match(html, /&lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /\\u003c\/script>\\u003cscript>alert\(1\)\\u003c\/script>/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('renderer serializes manifest routes as sitemap, redirects, and robots', () => {
  const routes = getPublicSeoRoutes('en');
  const sitemap = renderSitemap(routes);
  const redirects = renderRedirects(routes);
  const robots = renderRobots('en');

  assert.match(sitemap, /<urlset[^>]+xmlns:xhtml=/);
  assert.match(sitemap, /<loc>https:\/\/sagemro\.com\/tools<\/loc>/);
  assert.match(sitemap, /hreflang="zh-CN" href="https:\/\/sagemro\.cn\/tools"/);
  assert.match(redirects, /^\/tools\/  \/tools  301$/m);
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/sagemro\.com\/sitemap\.xml/);
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('renderer includes manifest FAQ and insight section copy in the static shell', () => {
  const tool = renderPublicDocument(TEMPLATE, getPublicSeoRoute('/tools/press-brake-tonnage-calculator', 'en'), 'en');
  const insight = renderPublicDocument(TEMPLATE, getPublicSeoRoute('/insights/laser-cutting-cost-drivers', 'en'), 'en');

  assert.match(tool, /What V die opening should I use\?/);
  assert.match(tool, /A common starting point is about 8 times material thickness/);
  assert.match(insight, /<h2>Start with machine time<\/h2>/);
  assert.match(insight, /Cut length and cutting speed create the base cutting time/);
});

test('hub JSON-LD lists the locale manifest child canonical URLs', () => {
  for (const locale of ['en', 'zh-CN']) {
    const routes = getPublicSeoRoutes(locale);
    for (const [hubPath, childPath] of [['/tools', '/tools/'], ['/insights', '/insights/']]) {
      const hub = routes.find((route) => route.path === hubPath);
      const expectedUrls = routes
        .filter((route) => route.path.startsWith(childPath))
        .map((route) => route.canonical);
      const json = renderPublicDocument(TEMPLATE, hub, locale)
        .match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
      const schema = JSON.parse(json);
      const actualUrls = schema['@graph'][0].mainEntity.itemListElement.map((item) => item.url);

      assert.deepEqual(hub.children?.map((child) => child.canonical), expectedUrls);
      assert.deepEqual(actualUrls, expectedUrls);
    }
  }
});
