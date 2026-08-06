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

function eagerFiles(manifest, entry) {
  const files = new Set();
  const pending = [...(entry.imports || [])];

  while (pending.length > 0) {
    const key = pending.pop();
    if (files.has(key)) continue;
    files.add(key);
    pending.push(...(manifest[key]?.imports || []));
  }

  return [...files].map((key) => manifest[key]?.file || key);
}

test('public bootstrap keeps Markdown and bend simulator code out of eager entry chunks', async () => {
  const manifest = await readManifest();
  const publicEntries = Object.values(manifest).filter((entry) => entry.isEntry);

  assert.ok(publicEntries.length > 0, 'expected at least one Vite entry');
  for (const entry of publicEntries) {
    const files = [entry.file, ...eagerFiles(manifest, entry)].join('\n');
    assert.doesNotMatch(files, /vendor-markdown|react-markdown/i);
    assert.doesNotMatch(files, /bend-?simulator/i);
  }
});

test('rendered branding uses the compact SVG mark', async () => {
  const [html, svg] = await Promise.all([
    readFile(resolve(distRoot, 'index.html'), 'utf8'),
    stat(resolve(distRoot, 'sagemro-brand-mark.svg')),
  ]);

  assert.match(html, /href="\/sagemro-brand-mark\.svg"/);
  assert.ok(svg.size < 80 * 1024, `SVG mark must stay below 80 KB (received ${svg.size} bytes)`);
});
