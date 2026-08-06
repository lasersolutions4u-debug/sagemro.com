import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocalizedTool, publicIndustryTools } from '../src/data/industryTools.js';
import { getDiagnosticGuides } from '../src/data/diagnosticGuides.js';
import { getDirectAccessNoindexToolRoutes, getPublicSeoRoute, getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
import { getServicePages } from '../src/data/servicePages.js';
import { getTechnicalAuthor } from '../src/data/technicalAuthors.js';
import { getTechnicalReviewPolicy } from '../src/data/technicalReviewPolicy.js';
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

function schemaFromHtml(html) {
  const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
  return JSON.parse(json);
}

function countSchemaType(value, type) {
  if (Array.isArray(value)) return value.reduce((count, item) => count + countSchemaType(item, type), 0);
  if (!value || typeof value !== 'object') return 0;
  return (value['@type'] === type ? 1 : 0)
    + Object.values(value).reduce((count, item) => count + countSchemaType(item, type), 0);
}

test('manifest publishes services, evidence-approved guides, and technical review in both locales', () => {
  for (const locale of ['en', 'zh-CN']) {
    const host = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';
    const routes = getPublicSeoRoutes(locale);
    const servicePaths = getServicePages(locale).map((page) => `/services/${page.slug}`);
    const guidePaths = getDiagnosticGuides(locale).map((guide) => `/insights/${guide.slug}`);
    const draftPaths = getDiagnosticGuides(locale, { publishedOnly: false })
      .filter((guide) => guide.status === 'draft')
      .map((guide) => `/insights/${guide.slug}`);

    for (const path of ['/services', ...servicePaths, ...guidePaths, '/about/technical-review']) {
      const route = routes.find((candidate) => candidate.path === path);
      assert.ok(route, `${locale} manifest should include ${path}`);
      assert.equal(route.canonical, `${host}${path}`);
      assert.equal(route.alternates.en, `https://sagemro.com${path}`);
      assert.equal(route.alternates['zh-CN'], `https://sagemro.cn${path}`);
      assert.ok(route.body.h1.length > 0);
    }

    draftPaths.forEach((path) => assert.equal(routes.some((route) => route.path === path), false));
  }
});

test('manifest internal links never expose draft or irrelevant diagnostic guides', () => {
  const expectedRelations = {
    'laser-cutting-machine-repair': ['laser-protective-lens-burning', 'laser-cutting-machine-maintenance-checklist'],
    'press-brake-repair': [],
    'remote-diagnostics': [],
    'preventive-maintenance': ['laser-protective-lens-burning', 'laser-cutting-machine-maintenance-checklist'],
  };

  for (const locale of ['en', 'zh-CN']) {
    for (const service of getServicePages(locale)) {
      const route = getPublicSeoRoute(`/services/${service.slug}`, locale);
      assert.deepEqual(route.body.links.map((link) => link.href), expectedRelations[service.slug].map((slug) => `/insights/${slug}`));
      if (expectedRelations[service.slug].length === 0) assert.ok(route.body.emptyState.length > 0);
    }

    for (const guide of getDiagnosticGuides(locale)) {
      const route = getPublicSeoRoute(`/insights/${guide.slug}`, locale);
      assert.deepEqual(route.body.links.filter((link) => link.kind === 'service').map((link) => link.href), [`/services/${guide.relatedServiceSlug}`]);
      assert.deepEqual(route.body.links.filter((link) => ['author', 'reviewer'].includes(link.kind)).map((link) => link.href), [
        '/about/technical-review',
        '/about/technical-review',
      ]);
    }
  }
});

test('technical review policy covers the trust framework without unsupported claims', () => {
  const prohibited = /independent from manufacturers|OEM[- ]authorized|authorized by (?:an )?OEM|guaranteed accuracy|complete (?:equipment )?coverage/i;

  for (const locale of ['en', 'zh-CN']) {
    const policy = getTechnicalReviewPolicy(locale);
    const copy = [policy.title, policy.description, policy.intro, ...policy.sections.map((section) => `${section.heading} ${section.body}`), policy.errorReporting].join(' ');

    assert.match(copy, locale === 'zh-CN' ? /技术服务团队/ : /Technical Service Team/);
    assert.match(copy, locale === 'zh-CN' ? /证据/ : /evidence/i);
    assert.match(copy, locale === 'zh-CN' ? /日期|更正/ : /date|correction/i);
    assert.match(copy, locale === 'zh-CN' ? /OEM|合格人员/ : /OEM|qualified person/i);
    assert.match(copy, /support@sagemro\.com/);
    assert.doesNotMatch(copy, prohibited);
  }
});

test('rendered public schema uses resolved records, breadcrumbs, and one Organization node', () => {
  for (const locale of ['en', 'zh-CN']) {
    const author = getTechnicalAuthor('sagemro-technical-service-team', locale);
    const routes = getPublicSeoRoutes(locale);

    for (const route of routes) {
      const schema = schemaFromHtml(renderPublicDocument(TEMPLATE, route, locale));
      assert.equal(countSchemaType(schema, 'Organization'), 1, `${locale} ${route.path} should emit Organization once`);
      if (route.path !== '/') assert.equal(countSchemaType(schema, 'BreadcrumbList'), 1, `${locale} ${route.path} should have breadcrumbs`);
    }

    for (const service of getServicePages(locale)) {
      const schema = schemaFromHtml(renderPublicDocument(TEMPLATE, getPublicSeoRoute(`/services/${service.slug}`, locale), locale));
      const primary = schema['@graph'].find((item) => item['@type'] === 'Service');
      assert.equal(primary.name, service.title);
      assert.equal(primary.url, getPublicSeoRoute(`/services/${service.slug}`, locale).canonical);
    }

    for (const guide of getDiagnosticGuides(locale)) {
      const schema = schemaFromHtml(renderPublicDocument(TEMPLATE, getPublicSeoRoute(`/insights/${guide.slug}`, locale), locale));
      const article = schema['@graph'].find((item) => item['@type'] === 'Article');
      const organization = schema['@graph'].find((item) => item['@type'] === 'Organization');
      assert.equal(article.datePublished, guide.publishedAt);
      assert.equal(article.dateModified, guide.reviewedAt);
      assert.deepEqual(article.author, { '@id': organization['@id'] });
      assert.deepEqual(article.reviewedBy, { '@id': organization['@id'] });
      assert.equal(organization.name, author.name);
      assert.equal(organization.url, author.url);
    }

    for (const tool of publicIndustryTools) {
      const schema = schemaFromHtml(renderPublicDocument(TEMPLATE, getPublicSeoRoute(`/tools/${tool.slug}`, locale), locale));
      assert.ok(schema['@graph'].some((item) => item['@type'] === 'WebApplication'));
    }
  }
});

test('static documents render localized policy and safe internal anchors', () => {
  const reviewEn = renderPublicDocument(TEMPLATE, getPublicSeoRoute('/about/technical-review', 'en'), 'en');
  const reviewCn = renderPublicDocument(TEMPLATE, getPublicSeoRoute('/about/technical-review', 'zh-CN'), 'zh-CN');
  const service = renderPublicDocument(TEMPLATE, getPublicSeoRoute('/services/laser-cutting-machine-repair', 'en'), 'en');
  const guide = renderPublicDocument(TEMPLATE, getPublicSeoRoute('/insights/laser-protective-lens-burning', 'en'), 'en');

  assert.match(reviewEn, /How SAGEMRO technical content is prepared and reviewed/);
  assert.match(reviewCn, /SAGEMRO 技术内容如何编写与审核/);
  assert.match(service, /href="\/insights\/laser-protective-lens-burning"/);
  assert.match(service, /href="\/insights\/laser-cutting-machine-maintenance-checklist"/);
  assert.match(guide, /href="\/services\/laser-cutting-machine-repair"/);
});
