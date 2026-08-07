import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { buildPublicPages } from '../scripts/buildPublicPages.mjs';

const execFile = promisify(execFileCallback);

test('buildPublicPages writes crawlable public pages and crawl artifacts', async (t) => {
  const distDir = await mkdtemp(join(tmpdir(), 'sagemro-public-build-'));
  t.after(() => rm(distDir, { force: true, recursive: true }));
  await cp(new URL('../index.html', import.meta.url), join(distDir, 'index.html'));

  await buildPublicPages({ distDir });

  const read = (path) => readFile(join(distDir, path), 'utf8');
  const checkedIn = (path) => readFile(new URL(`../public/${path}`, import.meta.url), 'utf8');
  assert.match(await read('tools/press-brake-tonnage-calculator/index.html'), /<h1>折弯机吨位计算器<\/h1>/);
  assert.match(await read('insights/press-brake-tonnage-risk-check/index.html'), /Article/);
  assert.match(await read('sitemap.xml'), /<lastmod>2026-08-06<\/lastmod>/);
  assert.doesNotMatch(await read('sitemap.xml'), /bend-simulator/);
  const redirects = await read('_redirects');
  assert.match(redirects, /\/activate \/ 200/);
  assert.match(redirects, /\/engineer \/ 200/);
  assert.match(redirects, /\/work-orders\/\* \/ 200/);
  assert.doesNotMatch(redirects, /^https?:\/\//m);
  assert.doesNotMatch(redirects, /\/404\.html 404/);
  assert.doesNotMatch(redirects, /\/tools\/\*/);
  assert.doesNotMatch(redirects, /\s30[18]$/m);
  assert.match(await read('404.html'), /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(await read('404.html'), /<h1>404 — 页面不存在<\/h1>/);
  assert.doesNotMatch(await read('404.html'), /application\/ld\+json/);
  const hubs = (await read('llms.txt')).match(/^\- https:\/\/[^\n]+$/gm);
  assert.deepEqual(hubs, [
    '- https://sagemro.cn/',
    '- https://sagemro.cn/services/',
    '- https://sagemro.cn/tools/',
    '- https://sagemro.cn/insights/',
  ]);
  assert.equal(await read('sitemap.xml'), await checkedIn('sitemap.xml'));
  assert.equal(await read('llms.txt'), await checkedIn('llms.txt'));
});

test('buildPublicPages writes direct noindex tool pages outside every public crawl artifact', async (t) => {
  const distDir = await mkdtemp(join(tmpdir(), 'sagemro-noindex-tool-build-'));
  const noindexSlugs = [
    'steel-price-watch',
    'press-brake-tonnage-calculator',
    'laser-assist-gas-consumption-calculator',
    'laser-cutting-speed-reference',
    'laser-cutting-machine-roi-calculator',
    'laser-chiller-dust-collector-sizing-checklist',
  ];

  t.after(() => rm(distDir, { force: true, recursive: true }));
  await cp(new URL('../index.html', import.meta.url), join(distDir, 'index.html'));
  await buildPublicPages({ distDir });

  const read = (path) => readFile(join(distDir, path), 'utf8');
  const sitemap = await read('sitemap.xml');
  const llms = await read('llms.txt');

  for (const slug of noindexSlugs) {
    const html = await read(`tools/${slug}/index.html`);
    assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
    assert.match(html, new RegExp(`rel="canonical" href="https://sagemro\\.cn/tools/${slug}/"`));
    assert.match(html, /data-prerendered="true"/);
    assert.doesNotMatch(sitemap, new RegExp(`/tools/${slug}`));
    assert.doesNotMatch(llms, new RegExp(`/tools/${slug}`));
  }

  await assert.rejects(read('tools/bend-simulator/index.html'), /ENOENT/);
  assert.doesNotMatch(await read('_redirects'), /\/tools\/\*/);
});

test('build generator can be imported without a script entry point', async () => {
  await execFile(process.execPath, ['--input-type=module', '--eval', "import './scripts/buildPublicPages.mjs'"], { cwd: new URL('..', import.meta.url) });
});
