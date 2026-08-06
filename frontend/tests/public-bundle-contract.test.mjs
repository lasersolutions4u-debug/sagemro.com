import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const frontendRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(frontendRoot, 'dist');
const manifestPath = resolve(distRoot, '.vite/manifest.json');

async function readManifest() {
  await access(manifestPath);
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

function staticImportClosure(manifest, entryKey) {
  const entries = new Set([entryKey]);
  const pending = [...(manifest[entryKey]?.imports || [])];

  while (pending.length > 0) {
    const key = pending.pop();
    if (entries.has(key)) continue;
    entries.add(key);
    pending.push(...(manifest[key]?.imports || []));
  }

  return entries;
}

test('public bootstrap keeps lazy public routes and paused bend simulator sources out of its static closure', async () => {
  const manifest = await readManifest();
  const entryKey = 'index.html';
  const staticEntries = staticImportClosure(manifest, entryKey);
  const lazyPublicEntries = [
    'src/components/Chat/ChatArea.jsx',
    'src/components/Tools/IndustryToolsPage.jsx',
    'src/components/Insights/InsightsPage.jsx',
  ];
  const pausedBendSimulatorEntries = Object.keys(manifest)
    .filter((key) => /bend-?simulator/i.test(key));

  assert.equal(manifest[entryKey]?.isEntry, true, 'expected the public index.html entry');
  for (const key of lazyPublicEntries) {
    assert.ok(manifest[key], `expected ${key} as a manifest source entry`);
    assert.ok(manifest[entryKey].dynamicImports?.includes(key), `expected ${key} to stay dynamic`);
    assert.equal(staticEntries.has(key), false, `${key} must not be statically imported by index.html`);
  }
  for (const key of pausedBendSimulatorEntries) assert.equal(staticEntries.has(key), false, `${key} must not be statically imported by index.html`);
});

test('Markdown stays behind a lazy vendor boundary reachable only from ChatArea', async () => {
  const manifest = await readManifest();
  const entryKey = 'index.html';
  const markdownKey = Object.keys(manifest).find((key) => key.includes('vendor-markdown'));

  assert.ok(markdownKey, 'expected a stable vendor-markdown manifest boundary');
  assert.equal(staticImportClosure(manifest, entryKey).has(markdownKey), false, 'index.html must not eagerly import Markdown');
  assert.equal(staticImportClosure(manifest, 'src/components/Chat/ChatArea.jsx').has(markdownKey), true, 'ChatArea must load Markdown when it is requested');
  const markdownConsumers = Object.entries(manifest)
    .filter(([, entry]) => entry.src && entry.imports?.includes(markdownKey))
    .map(([key]) => key);
  assert.deepEqual(markdownConsumers, ['src/components/Chat/ChatArea.jsx']);
});

test('rendered branding uses the compact SVG mark', async () => {
  const [html, svg] = await Promise.all([
    readFile(resolve(distRoot, 'index.html'), 'utf8'),
    stat(resolve(distRoot, 'sagemro-brand-mark.svg')),
  ]);

  assert.match(html, /href="\/sagemro-brand-mark\.svg"/);
  assert.ok(svg.size < 80 * 1024, `SVG mark must stay below 80 KB (received ${svg.size} bytes)`);
});
