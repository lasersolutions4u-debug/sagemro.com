import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('package scripts make public the default and expose a separate portal build', async () => {
  const pkg = JSON.parse(await readProjectFile('package.json'));

  assert.equal(pkg.scripts.build, 'npm run build:public');
  assert.equal(pkg.scripts['build:public'], 'node scripts/runBuild.mjs public');
  assert.equal(pkg.scripts['build:portal'], 'node scripts/runBuild.mjs portal');
});

test('Vite selects deterministic artifact directories without losing existing build controls', async () => {
  const config = await readProjectFile('vite.config.js');

  assert.match(config, /process\.env\.SAGEMRO_BUILD_TARGET === ['"]portal['"] \? ['"]portal['"] : ['"]public['"]/);
  assert.match(config, /outDir:\s*buildTarget === ['"]portal['"] \? ['"]dist-portal['"] : ['"]dist['"]/);
  assert.match(config, /__SAGEMRO_BUILD_TARGET__:\s*JSON\.stringify\(buildTarget\)/);
  assert.match(config, /target:\s*['"]es2020['"]/);
  assert.match(config, /manifest:\s*true/);
  assert.match(config, /chunkSizeWarningLimit:\s*500/);
});

test('portal post-build helper removes public crawl artifacts and writes noindex SPA controls', async (t) => {
  const { buildPortalPages } = await import('../scripts/buildPortalPages.mjs');
  const distDir = await mkdtemp(join(tmpdir(), 'sagemro-portal-build-'));
  t.after(() => rm(distDir, { force: true, recursive: true }));

  await Promise.all([
    writeFile(join(distDir, 'index.html'), '<!doctype html><html><head><meta name="robots" content="index, follow"><link rel="canonical" href="https://sagemro.com/"><title>Portal</title></head><body></body></html>'),
    writeFile(join(distDir, 'sitemap.xml'), '<urlset></urlset>'),
    writeFile(join(distDir, 'llms.txt'), '# public only'),
  ]);

  await buildPortalPages({ distDir });

  const portalIndex = await readFile(join(distDir, 'index.html'), 'utf8');
  const portalRobots = await readFile(join(distDir, 'robots.txt'), 'utf8');
  const redirects = await readFile(join(distDir, '_redirects'), 'utf8');

  assert.match(portalIndex, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.doesNotMatch(portalIndex, /rel="canonical" href="https:\/\/sagemro\.(?:com|cn)\//);
  assert.equal(portalRobots, 'User-agent: *\nDisallow: /\n');
  assert.doesNotMatch(redirects, /^\/service-request(?:\s|$)/m);
  assert.match(redirects, /^\/work-orders\/\* \/index\.html 200$/m);
  assert.match(redirects, /^\/activate \/index\.html 200$/m);
  assert.match(redirects, /^\/engineer \/index\.html 200$/m);
  await assert.rejects(readFile(join(distDir, 'sitemap.xml')), /ENOENT/);
  await assert.rejects(readFile(join(distDir, 'llms.txt')), /ENOENT/);
});

test('build runner sets the target in Node and dispatches exactly one post-build helper', async () => {
  const runner = await readProjectFile('scripts/runBuild.mjs');

  assert.match(runner, /SAGEMRO_BUILD_TARGET:\s*target/);
  assert.match(runner, /buildPublicPages/);
  assert.match(runner, /buildPortalPages/);
  assert.match(runner, /target === ['"]portal['"]/);
  assert.doesNotMatch(runner, /cross-env|set SAGEMRO_BUILD_TARGET|SAGEMRO_BUILD_TARGET=/);
});

test('the market resolver defaults to com and rejects anything else', async () => {
  const { DEFAULT_MARKET, MARKETS, resolveMarket } = await import('../scripts/markets.mjs');

  assert.equal(DEFAULT_MARKET, 'com');
  assert.deepEqual(Object.keys(MARKETS), ['com', 'cn']);
  assert.equal(MARKETS.com.locale, 'en');
  assert.equal(MARKETS.cn.locale, 'zh-CN');

  assert.equal(resolveMarket(undefined), 'com');
  assert.equal(resolveMarket(''), 'com');
  assert.equal(resolveMarket('cn'), 'cn');
  assert.throws(() => resolveMarket('uk'), /Unsupported SAGEMRO_BUILD_MARKET/);
});

test('the selected market decides crawl policy, host and document language', async (t) => {
  const { buildPublicPages } = await import('../scripts/buildPublicPages.mjs');
  // Deliberately the international template: the market, not the checkout, must
  // decide. This is what used to require a separate branch.
  const template = '<!doctype html><html lang="en"><head><meta name="robots" content="index, follow">'
    + '<meta name="description" content="placeholder" /><title>placeholder</title></head><body></body></html>';

  const build = async (locale) => {
    const distDir = await mkdtemp(join(tmpdir(), 'sagemro-market-'));
    t.after(() => rm(distDir, { force: true, recursive: true }));
    await writeFile(join(distDir, 'index.html'), template);
    await buildPublicPages({ distDir, locale });
    return {
      index: await readFile(join(distDir, 'index.html'), 'utf8'),
      robots: await readFile(join(distDir, 'robots.txt'), 'utf8'),
      llms: await readFile(join(distDir, 'llms.txt'), 'utf8'),
    };
  };

  const cn = await build('zh-CN');
  assert.match(cn.index, /<html lang="zh-CN">/);
  assert.match(cn.robots, /User-agent: Baiduspider\nAllow: \//);
  assert.match(cn.robots, /Sitemap: https:\/\/sagemro\.cn\/sitemap\.xml/);
  assert.match(cn.llms, /- https:\/\/sagemro\.cn\//);
  assert.doesNotMatch(cn.llms, /- https:\/\/sagemro\.com\//);

  const com = await build('en');
  assert.match(com.index, /<html lang="en">/);
  assert.match(com.robots, /User-agent: Baiduspider\nDisallow: \//);
  assert.match(com.robots, /Sitemap: https:\/\/sagemro\.com\/sitemap\.xml/);
  assert.match(com.llms, /- https:\/\/sagemro\.com\//);
});

test('market assets overlay only their own market', async (t) => {
  const { copyMarketAssets } = await import('../scripts/markets.mjs');
  const frontendDir = await mkdtemp(join(tmpdir(), 'sagemro-market-assets-'));
  const distDir = await mkdtemp(join(tmpdir(), 'sagemro-market-dist-'));
  t.after(() => rm(frontendDir, { force: true, recursive: true }));
  t.after(() => rm(distDir, { force: true, recursive: true }));

  await Promise.all([
    mkdir(join(frontendDir, 'public-cn'), { recursive: true }),
    writeFile(join(distDir, 'shared.txt'), 'shared'),
  ]);
  await writeFile(join(frontendDir, 'public-cn', 'cn-only.txt'), 'cn');

  // The international artifact must not receive a China-only file, even though
  // both markets build from the same checkout.
  assert.equal(await copyMarketAssets({ frontendDir, distDir, market: 'com' }), false);
  await assert.rejects(readFile(join(distDir, 'cn-only.txt')), /ENOENT/);
  assert.equal(await readFile(join(distDir, 'shared.txt'), 'utf8'), 'shared');

  assert.equal(await copyMarketAssets({ frontendDir, distDir, market: 'cn' }), true);
  assert.equal(await readFile(join(distDir, 'cn-only.txt'), 'utf8'), 'cn');
  assert.equal(await readFile(join(distDir, 'shared.txt'), 'utf8'), 'shared');
});

test('the build runner forwards the market to both post-build helpers', async () => {
  const runner = await readProjectFile('scripts/runBuild.mjs');
  const pkg = JSON.parse(await readProjectFile('package.json'));

  assert.match(runner, /SAGEMRO_BUILD_MARKET:\s*selected/);
  assert.match(runner, /copyMarketAssets\(\{\s*frontendDir,\s*distDir,\s*market:\s*selected\s*\}\)/);
  assert.match(runner, /buildPortalPages\(\{\s*distDir,\s*locale,\s*lang\s*\}\)/);
  assert.match(runner, /buildPublicPages\(\{\s*distDir,\s*locale\s*\}\)/);
  assert.match(runner, /resolveMarket\(market\)/);

  assert.equal(pkg.scripts['build:public:cn'], 'node scripts/runBuild.mjs public cn');
  assert.equal(pkg.scripts['build:portal:cn'], 'node scripts/runBuild.mjs portal cn');
});
