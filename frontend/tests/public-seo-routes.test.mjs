import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocalizedTool, publicIndustryTools } from '../src/data/industryTools.js';
import { getPublicSeoRoute, getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
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
  for (const locale of ['en', 'zh-CN']) {
    const routes = getPublicSeoRoutes(locale);
    assert.equal(routes.some((route) => route.path === '/tools/bend-simulator'), false);
    assert.equal(routes.some((route) => route.path === '/tools/laser-cutting-speed-reference'), false);
    assert.equal(routes.some((route) => route.path === '/tools/laser-chiller-dust-collector-sizing-checklist'), false);
    assert.equal(routes.some((route) => route.path === '/engineer'), false);
    assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
    assert.equal(routes.every((route) => route.robots === 'index,follow'), true);
    assert.equal(routes.every((route) => /^https:\/\/sagemro\.(com|cn)/.test(route.canonical)), true);
    assert.equal(routes.every((route) => route.alternates.en && route.alternates['zh-CN']), true);
  }
});

test('indexable tool routes include calculator-derived evidence in the static SEO body', () => {
  const route = getPublicSeoRoute('/tools/metal-weight-calculator', 'en');

  assert.match(route.body.sections[0].body, /Metal weight = cross-section area × length × density × quantity/);
  assert.match(route.body.sections[1].body, /kg/);
  assert.match(route.body.sections[2].body, /selected material density/i);
  assert.match(route.body.sections[3].body, /not fully/i);
  assert.match(route.body.sections[4].body, /production|purchasing/i);
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
