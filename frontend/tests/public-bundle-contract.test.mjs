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
  const bendSimulatorEntry = 'src/components/Tools/BendSimulatorPage.jsx';

  assert.equal(manifest[entryKey]?.isEntry, true, 'expected the public index.html entry');
  for (const key of lazyPublicEntries) {
    assert.ok(manifest[key], `expected ${key} as a manifest source entry`);
    assert.ok(manifest[entryKey].dynamicImports?.includes(key), `expected ${key} to stay dynamic`);
    assert.equal(staticEntries.has(key), false, `${key} must not be statically imported by index.html`);
  }
  assert.equal(manifest[bendSimulatorEntry]?.isDynamicEntry, true, 'expected the paused bend simulator as a dynamic source entry');
  assert.ok(manifest['src/components/Tools/IndustryToolsPage.jsx'].dynamicImports?.includes(bendSimulatorEntry), 'expected IndustryToolsPage to lazy-load the paused bend simulator');
  assert.equal(staticEntries.has(bendSimulatorEntry), false, 'BendSimulatorPage must not be statically imported by index.html');
});

test('Markdown stays behind a lazy vendor boundary reachable only from ChatArea', async () => {
  const manifest = await readManifest();
  const entryKey = 'index.html';
  const markdownKeys = Object.keys(manifest).filter((key) => key.includes('vendor-markdown'));

  assert.ok(markdownKeys.length > 0, 'expected stable vendor-markdown manifest boundaries');
  for (const key of markdownKeys) assert.equal(staticImportClosure(manifest, entryKey).has(key), false, 'index.html must not eagerly import Markdown');
  assert.equal(markdownKeys.length, 1, 'expected one current Markdown boundary');
  assert.match(markdownKeys[0], /^_vendor-markdown~ChatArea-/);
  assert.equal(staticImportClosure(manifest, 'src/components/Chat/ChatArea.jsx').has(markdownKeys[0]), true, 'ChatArea must load Markdown when it is requested');
  const markdownConsumers = Object.entries(manifest)
    .filter(([, entry]) => entry.src && entry.imports?.includes(markdownKeys[0]))
    .map(([key]) => key);
  assert.deepEqual(markdownConsumers, ['src/components/Chat/ChatArea.jsx']);
});

test('rendered branding uses the approved full robot PNG logo', async () => {
  const [html, logo] = await Promise.all([
    readFile(resolve(distRoot, 'index.html'), 'utf8'),
    stat(resolve(distRoot, 'sagemro-logo.png')),
  ]);

  assert.match(html, /type="image\/png" href="\/sagemro-logo\.png"/);
  assert.ok(logo.size < 160 * 1024, `PNG logo must stay below 160 KB (received ${logo.size} bytes)`);
});
