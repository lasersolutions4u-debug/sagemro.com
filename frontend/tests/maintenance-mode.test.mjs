import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  MODE_FILE,
  WORKER_FILE,
  applyMaintenanceArtifact,
  readMaintenanceMode,
  renderMaintenancePage,
  renderMaintenanceWorkerSource,
} from '../../ops/maintenance/render.mjs';

const repoFile = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

/** Resolve numeric HTML entities the way a browser would before following a link. */
const decodeEntities = (value) => value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

/**
 * Load the generated Pages Worker as a real module so the deployed behaviour is
 * exercised, not just its source text.
 */
async function loadMaintenanceWorker() {
  const source = renderMaintenanceWorkerSource();
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
  const mod = await import(dataUrl);
  return mod.default;
}

test('the maintenance toggle is a committed, strictly-validated boolean switch', async (t) => {
  const mode = readMaintenanceMode();
  assert.equal(typeof mode.enabled, 'boolean');

  const dir = await mkdtemp(join(tmpdir(), 'sagemro-maintenance-mode-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeFile(join(dir, 'broken.json'), '{ "enabled": tru', 'utf8');
  assert.throws(() => readMaintenanceMode(join(dir, 'broken.json')), /not valid JSON/);

  await writeFile(join(dir, 'no-flag.json'), '{ "note": "missing" }', 'utf8');
  assert.throws(() => readMaintenanceMode(join(dir, 'no-flag.json')), /boolean "enabled"/);

  assert.throws(() => readMaintenanceMode(join(dir, 'absent.json')), /Cannot read the maintenance toggle/);
  assert.equal(existsSync(MODE_FILE), true);
});

test('the generated Worker is a single self-contained ES module for pages direct upload', () => {
  const source = renderMaintenanceWorkerSource();

  // Pages does not bundle `_worker.js` on direct upload, so any import breaks the deploy.
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\brequire\s*\(/);
  assert.match(source, /export default \{/);
  assert.match(source, /async fetch\(request\)/);
});

test('every request to a closed site answers 503 with the localized maintenance page', async () => {
  const worker = await loadMaintenanceWorker();
  const call = (url, method = 'GET') => worker.fetch(new Request(url, { method }));

  const english = [
    'https://sagemro.com/',
    'https://sagemro.com/services/preventive-maintenance/',
    'https://www.sagemro.com/insights/',
    'https://ai.sagemro.com/',
    'https://admin.sagemro.com/',
    'https://engineer.sagemro.com/',
  ];
  for (const url of english) {
    const response = await call(url);
    assert.equal(response.status, 503, url);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8', url);
    assert.match(response.headers.get('cache-control'), /no-store/, `${url} must not be cached`);
    assert.equal(response.headers.get('retry-after'), '3600', url);
    assert.match(response.headers.get('x-robots-tag'), /noindex/, url);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', url);
    const html = await response.text();
    assert.match(html, /<html lang="en">/, url);
    assert.match(html, /The site is temporarily paused/, url);
    assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/, url);
  }

  for (const url of ['https://sagemro.cn/', 'https://www.sagemro.cn/', 'https://ai.sagemro.cn/', 'https://admin.sagemro.cn/', 'https://engineer.sagemro.cn/']) {
    const response = await call(url);
    assert.equal(response.status, 503, url);
    const html = await response.text();
    assert.match(html, /<html lang="zh-CN">/, url);
    assert.match(html, /站点正在临时维护/, url);
  }

  // A lookalike host must not leak the China edition page.
  const lookalike = await call('https://notsagemro.cn/');
  assert.match(await lookalike.text(), /<html lang="en">/);
});

test('the maintenance response keeps HEAD, preflight and write methods answerable', async () => {
  const worker = await loadMaintenanceWorker();

  const head = await worker.fetch(new Request('https://sagemro.com/', { method: 'HEAD' }));
  assert.equal(head.status, 503);
  assert.equal(await head.text(), '');

  const preflight = await worker.fetch(new Request('https://sagemro.com/', { method: 'OPTIONS' }));
  assert.equal(preflight.status, 204);

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await worker.fetch(new Request('https://api.sagemro.com/api/contact', { method }));
    assert.equal(response.status, 503, method);
  }
});

test('the maintenance page is dependency-free, accessible and gives a way to reach a human', async () => {
  for (const lang of ['en', 'zh-CN']) {
    const html = renderMaintenancePage(lang);
    // No network dependency: the page must render from the single 503 response.
    assert.doesNotMatch(html, /https?:\/\//);
    assert.doesNotMatch(html, /<script|<img|<link\b|<iframe/);
    assert.match(html, /<h1>/);
    assert.match(decodeEntities(html), /href="mailto:support@sagemro\.com"/);
    assert.match(html, /href="tel:\+8618615584520"/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    // Text has to be real copy, not a placeholder shipped to customers.
    assert.doesNotMatch(html, /TODO|Lorem ipsum|placeholder/i);
  }
});

test('the contact link survives Cloudflare email obfuscation', async () => {
  // The zone rewrites every literal mailto:/address@domain into
  // /cdn-cgi/l/email-protection#… and prints "[email protected]" instead. The Worker
  // 503s that path, so a literal address would leave the maintenance page with a dead
  // contact link — the one thing the page exists to provide.
  const worker = await loadMaintenanceWorker();
  for (const url of ['https://sagemro.com/', 'https://sagemro.cn/']) {
    const html = await (await worker.fetch(new Request(url))).text();
    assert.doesNotMatch(html, /mailto:/, `${url} must not ship a literal mailto: scheme`);
    assert.doesNotMatch(html, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, `${url} must not ship a literal address`);
    const decoded = decodeEntities(html);
    assert.match(decoded, /<a href="mailto:support@sagemro\.com">/, url);
    assert.match(decoded, />support@sagemro\.com<\/a>/, url);
  }
});

test('applying the artifact writes the Worker when closed and clears it when open', async (t) => {
  const distDir = await mkdtemp(join(tmpdir(), 'sagemro-maintenance-dist-'));
  t.after(() => rm(distDir, { recursive: true, force: true }));

  const closed = await applyMaintenanceArtifact(distDir, { mode: { enabled: true } });
  assert.equal(closed.enabled, true);
  assert.equal(existsSync(join(distDir, WORKER_FILE)), true);
  assert.match(await readFile(join(distDir, WORKER_FILE), 'utf8'), /export default \{/);

  const reopened = await applyMaintenanceArtifact(distDir, { mode: { enabled: false } });
  assert.equal(reopened.enabled, false);
  assert.equal(existsSync(join(distDir, WORKER_FILE)), false, 'a stale pause must never survive a later build');
  assert.equal(existsSync(distDir), true);

  await assert.rejects(
    () => applyMaintenanceArtifact(join(distDir, 'missing'), { mode: { enabled: true } }),
    /does not exist/,
  );
});

test('both builds apply the toggle without touching the deployment workflows', async () => {
  const runner = await repoFile('frontend/scripts/runBuild.mjs');
  assert.match(runner, /applyMaintenanceArtifact\(distDir\)/);

  const adminPkg = JSON.parse(await repoFile('admin/package.json'));
  assert.match(adminPkg.scripts.build, /vite build && node \.\.\/ops\/maintenance\/apply\.mjs dist/);

  const deployWorkflow = await repoFile('.github/workflows/deploy.yml');
  assert.doesNotMatch(deployWorkflow, /maintenance\/mode\.json/, 'the pause must not require editing the deploy pipeline');
});
