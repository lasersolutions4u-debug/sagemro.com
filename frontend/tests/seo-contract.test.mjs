import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..', '..');

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

function createDocument() {
  const elements = [];
  const matches = (element, selector) => {
    const match = selector.match(/^(\w+)(?:\[([^=\]]+)(?:="([^"]+)")?\])?$/);
    if (!match || element.tagName !== match[1]) return false;
    const [, , attribute, value] = match;
    return !attribute || (value == null ? element.getAttribute(attribute) != null : element.getAttribute(attribute) === value);
  };
  const document = {
    title: '',
    documentElement: {},
    head: {
      appendChild(element) {
        element.parentNode = this;
        elements.push(element);
        return element;
      },
    },
    createElement(tagName) {
      const attributes = new Map();
      return {
        tagName,
        parentNode: null,
        textContent: '',
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        remove() {
          const index = elements.indexOf(this);
          if (index >= 0) elements.splice(index, 1);
        },
        get id() { return attributes.get('id') || ''; },
        set id(value) { attributes.set('id', String(value)); },
        get type() { return attributes.get('type') || ''; },
        set type(value) { attributes.set('type', String(value)); },
      };
    },
    getElementById(id) { return elements.find((element) => element.id === id) || null; },
    querySelector(selector) { return elements.find((element) => matches(element, selector)) || null; },
    querySelectorAll(selector) { return elements.filter((element) => matches(element, selector)); },
  };
  return document;
}

async function loadSeo(document) {
  globalThis.document = document;
  const moduleUrl = pathToFileURL(path.join(projectRoot, 'frontend/src/utils/seo.js')).href;
  return import(`${moduleUrl}?test=${Date.now()}-${Math.random()}`);
}

test('China public frontend exposes crawlable sitemap and robots policy', async () => {
  const robots = await read('frontend/public/robots.txt');
  const sitemap = await read('frontend/public/sitemap.xml');

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \/\s/);
  assert.match(robots, /Sitemap: https:\/\/sagemro\.cn\/sitemap\.xml/);
  assert.match(sitemap, /<urlset[^>]+xmlns:xhtml=/);
  assert.match(sitemap, /https:\/\/sagemro\.cn\//);
  assert.match(sitemap, /https:\/\/engineer\.sagemro\.cn\//);
  assert.match(sitemap, /<xhtml:link[^>]+hreflang="en"/);
  assert.match(sitemap, /<xhtml:link[^>]+hreflang="zh-CN"/);
});

test('China public pages define localized SEO metadata and structured data', async () => {
  const app = await read('frontend/src/App.jsx');
  const seo = await read('frontend/src/utils/seo.js');
  const recruiting = await read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');
  const tools = await read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const insights = await read('frontend/src/components/Insights/InsightsPage.jsx');

  assert.match(seo, /application\/ld\+json/);
  assert.match(app, /setSeoMetadata\(/);
  assert.match(app, /noindex,nofollow,noarchive/);
  assert.match(recruiting, /SAGEMRO 工程师服务协作网络/);
  assert.match(recruiting, /setSeoMetadata\(/);
  assert.match(tools, /https:\/\/sagemro\.cn/);
  assert.match(tools, /setSeoMetadata\(/);
  assert.match(insights, /setSeoMetadata\(/);
  assert.match(tools, /getIndustryToolsSeoMetadata/);
  assert.match(tools, /robots: seoMetadata\.robots/);
  assert.match(insights, /robots: isMissing \? 'noindex,nofollow,noarchive'/);
});

test('client navigation keeps route metadata in parity with prerendered pages', async () => {
  const seo = await read('frontend/src/utils/seo.js');
  const main = await read('frontend/src/main.jsx');

  assert.match(seo, /function setMetaProperty\(property, content\)/);
  assert.match(seo, /function setAlternates\(alternates, canonical\)/);
  assert.match(seo, /link\[hreflang\]/);
  assert.match(seo, /setMetaProperty\('og:title', title\)/);
  assert.match(seo, /containsArticle\(structuredData\) \? 'article' : 'website'/);
  assert.match(seo, /setMetaProperty\('og:description', description\)/);
  assert.match(seo, /setMetaProperty\('og:url', canonical\)/);
  assert.match(seo, /setMetaProperty\('og:image', resolvedImage\)/);
  assert.match(seo, /setMeta\('twitter:title', title\)/);
  assert.match(seo, /setMeta\('twitter:card', 'summary'\)/);
  assert.match(seo, /setMeta\('twitter:description', description\)/);
  assert.match(seo, /setMeta\('twitter:image', resolvedImage\)/);
  assert.match(seo, /JSON\.stringify\(structuredData\)/);
  assert.match(seo, /tag\?\.remove\(\)/);
  assert.match(main, /const rootElement = document\.getElementById\('root'\);/);
  assert.match(main, /rootElement\.dataset\.prerendered === 'true'/);
  assert.match(main, /rootElement\.replaceChildren\(\);/);
  assert.match(main, /delete rootElement\.dataset\.prerendered;/);
  assert.match(main, /createRoot\(rootElement\)\.render\(/);
});

test('client metadata reconciles prerendered tags and clears stale route metadata', async () => {
  const document = createDocument();
  const staticSchema = document.createElement('script');
  staticSchema.type = 'application/ld+json';
  document.head.appendChild(staticSchema);
  const duplicateSchema = document.createElement('script');
  duplicateSchema.type = 'application/ld+json';
  document.head.appendChild(duplicateSchema);
  const { setSeoMetadata } = await loadSeo(document);

  const schema = { '@graph': [{ '@type': 'Article', headline: 'Insight' }] };
  setSeoMetadata({
    title: 'Insight | SAGEMRO',
    description: 'A practical note.',
    canonical: 'https://sagemro.com/insights/test',
    lang: 'en',
    structuredData: schema,
  });

  const schemaTags = document.querySelectorAll('script[type="application/ld+json"]');
  assert.equal(schemaTags.length, 1);
  assert.equal(schemaTags[0].id, 'sagemro-seo-jsonld');
  assert.equal(schemaTags[0].textContent, JSON.stringify(schema));
  assert.equal(document.querySelector('meta[property="og:type"]').getAttribute('content'), 'article');
  assert.equal(document.querySelector('meta[property="og:image"]').getAttribute('content'), 'https://sagemro.com/sagemro-logo.png');
  assert.deepEqual(
    Object.fromEntries(document.querySelectorAll('link[hreflang]').map((tag) => [tag.getAttribute('hreflang'), tag.getAttribute('href')])),
    {
      en: 'https://sagemro.com/insights/test',
      'zh-CN': 'https://sagemro.cn/insights/test',
      'x-default': 'https://sagemro.com/insights/test',
    },
  );

  setSeoMetadata({ title: 'Private', canonical: null, lang: 'en', structuredData: null });

  assert.equal(document.querySelectorAll('script[type="application/ld+json"]').length, 0);
  assert.equal(document.querySelectorAll('link[hreflang]').length, 0);
  assert.equal(document.querySelector('meta[property="og:url"]'), null);
  assert.equal(document.querySelector('meta[property="og:image"]'), null);
});

test('China admin portal is excluded from search indexing', async () => {
  const html = await read('admin/index.html');
  const robots = await read('admin/public/robots.txt');

  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(robots, /Disallow: \/\s/);
});
