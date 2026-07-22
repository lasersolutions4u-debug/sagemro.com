import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..', '..');

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
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
});

test('China admin portal is excluded from search indexing', async () => {
  const html = await read('admin/index.html');
  const robots = await read('admin/public/robots.txt');

  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(robots, /Disallow: \/\s/);
});
