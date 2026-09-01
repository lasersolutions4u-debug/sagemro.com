import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  assert.match(redirects, /^\/service-request \/index\.html 200$/m);
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
