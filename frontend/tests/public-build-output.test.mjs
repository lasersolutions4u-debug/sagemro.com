import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { buildPublicPages } from '../scripts/buildPublicPages.mjs';

const execFile = promisify(execFileCallback);
const normalizeLineEndings = (value) => value.replace(/\r\n/g, '\n');

test('buildPublicPages writes crawlable public pages and crawl artifacts', async (t) => {
  const distDir = await mkdtemp(join(tmpdir(), 'sagemro-public-build-'));
  t.after(() => rm(distDir, { force: true, recursive: true }));
  await cp(new URL('../index.html', import.meta.url), join(distDir, 'index.html'));

  await buildPublicPages({ distDir });

  const read = (path) => readFile(join(distDir, path), 'utf8');
  const checkedIn = (path) => readFile(new URL(`../public/${path}`, import.meta.url), 'utf8');
  assert.match(await read('tools/press-brake-tonnage-calculator/index.html'), /<h1>Press Brake Tonnage Calculator<\/h1>/);
  assert.match(await read('insights/press-brake-tonnage-risk-check/index.html'), /Article/);
  assert.match(await read('sitemap.xml'), /<lastmod>2026-09-29<\/lastmod>/);
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
  assert.match(await read('404.html'), /<h1>404 — This page doesn&#39;t exist<\/h1>/);
  assert.doesNotMatch(await read('404.html'), /application\/ld\+json/);
  // llms.txt 现在按语言分别写业务自述并列出主要页面，不再是"四行 hub 列表 + 一句旧口径"。
  // 校验它确实覆盖了业务、服务页与渠道商页——这三样是 AI 判断"这家到底做什么"的依据。
  const llms = await read('llms.txt');
  const hubs = llms.match(/^\- https:\/\/[^\n]+$/gm);
  assert.equal(hubs.length, 16);
  for (const path of ['/', '/partners/', '/services/', '/tools/', '/insights/', '/about/technical-review/']) {
    assert.ok(hubs.some((line) => line.startsWith(`- https://sagemro.com${path} `)), `llms.txt 缺少 ${path}`);
  }
  for (const slug of ['laser-cutting-machine-repair', 'press-brake-repair', 'remote-diagnostics',
    'preventive-maintenance', 'machine-relocation-installation', 'spare-parts-consumables',
    'oem-service-partner', 'after-sales-outsourcing', 'overseas-delivery', 'third-party-service']) {
    assert.ok(hubs.some((line) => line.startsWith(`- https://sagemro.com/services/${slug}/ `)), `llms.txt 缺少服务页 ${slug}`);
  }
  assert.match(llms, /takes over the after-sales delivery that laser and metal-forming equipment builders/);
  // "我们不是设备商"是定位的核心区分，必须在自述里写清楚。
  assert.match(llms, /not a machine manufacturer or a machine seller/);
  assert.doesNotMatch(llms, /planning references for industrial equipment users/);
  assert.equal(normalizeLineEndings(await read('sitemap.xml')), normalizeLineEndings(await checkedIn('sitemap.xml')));
  assert.equal(normalizeLineEndings(await read('llms.txt')), normalizeLineEndings(await checkedIn('llms.txt')));
  const sitemap = await read('sitemap.xml');
  // 服务页以前完全没有 lastmod，而缺 lastmod 会让抓取优先级失真——现在每一页都必须带。
  // （这条断言原本是反过来的：它把"服务页没有 lastmod"当成了规格。）
  const serviceEntries = [...sitemap.matchAll(/<url>\s*<loc>https:\/\/sagemro\.com\/services\/[^<]+<\/loc>[\s\S]*?<\/url>/g)];
  assert.equal(serviceEntries.length, 12, '应匹配到 12 个服务详情页');
  // 交换件小节带锚点，必须落到构建产物的 HTML 里（页面内 #exchange-unit 才能解析），
  // 且只应出现在备件页，不要在其它服务页复制。
  assert.match(await read('services/spare-parts-consumables/index.html'), /<h2 id="exchange-unit">/);
  assert.doesNotMatch(await read('services/laser-cutting-machine-repair/index.html'), /id="exchange-unit"/);
  for (const serviceEntry of serviceEntries) {
    assert.match(serviceEntry[0], /<lastmod>2026-09-29<\/lastmod>/, `服务页缺 lastmod: ${serviceEntry[0].slice(0, 90)}`);
  }
  const robots = await read('robots.txt');
  assert.equal(normalizeLineEndings(robots).trimEnd(), normalizeLineEndings(await checkedIn('robots.txt')).trimEnd());
  assert.match(robots, /User-agent: Baiduspider\nDisallow: \/(?:\n|$)/);
  assert.match(robots, /User-agent: Googlebot\nAllow: \//);
  // Google-Extended 控制的是 Gemini Apps / Vertex AI 的 grounding（能不能被 AI 答案引用），
  // 不只是训练。把它当"仅训练"一起封掉等于顺手放弃 Google 的 AI 答案面，所以它必须保持可抓取。
  assert.doesNotMatch(robots, /User-agent: Google-Extended\nDisallow: \//);
  // 只用于喂训练的抓取器仍然明确拒绝。
  for (const agent of ['GPTBot', 'ClaudeBot', 'CCBot']) {
    assert.match(robots, new RegExp(`User-agent: ${agent}\\nDisallow: /`), `${agent} 应保持拒绝`);
  }
  // ChatGPT 搜索用的是 OAI-SearchBot（检索/引用用途），必须放行。
  assert.match(robots, /User-agent: OAI-SearchBot\nAllow: \//);
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
    assert.match(html, new RegExp(`rel="canonical" href="https://sagemro\\.com/tools/${slug}/"`));
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
