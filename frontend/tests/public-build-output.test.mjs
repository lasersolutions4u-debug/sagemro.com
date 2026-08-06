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
  assert.match(await read('tools/press-brake-tonnage-calculator/index.html'), /<h1>Press Brake Tonnage Calculator<\/h1>/);
  assert.match(await read('insights/press-brake-tonnage-risk-check/index.html'), /Article/);
  assert.match(await read('sitemap.xml'), /<lastmod>2026-08-06<\/lastmod>/);
  assert.doesNotMatch(await read('sitemap.xml'), /bend-simulator/);
  assert.match(await read('_redirects'), /\/work-orders\/\* \/index\.html 200/);
  assert.doesNotMatch(await read('_redirects'), /\/tools\/\*/);
  const hubs = (await read('llms.txt')).match(/^\- https:\/\/[^\n]+$/gm);
  assert.equal(new Set(hubs).size, 4);
});

test('build generator can be imported without a script entry point', async () => {
  await execFile(process.execPath, ['--input-type=module', '--eval', "import './scripts/buildPublicPages.mjs'"], { cwd: new URL('..', import.meta.url) });
});
