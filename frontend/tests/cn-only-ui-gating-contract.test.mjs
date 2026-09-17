import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(jsx|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

// The China administrative division input is a China-only capability. On this
// checkout it is gated at the call site (not inside the component), so the gate
// has to be asserted where the component is rendered.
test('the China administrative division input stays behind the CN locale', async () => {
  const usages = [];
  for (const file of await walk(sourceRoot)) {
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/<RegionInput/g)) {
      usages.push({
        file: file.slice(sourceRoot.length + 1).replace(/\\/g, '/'),
        preceding: content.slice(Math.max(0, match.index - 240), match.index),
      });
    }
  }

  assert.ok(usages.length > 0, 'the China division input should still be reachable somewhere');

  for (const { file, preceding } of usages) {
    assert.match(
      preceding,
      /isCn/,
      `${file}: <RegionInput> must stay behind the CN locale, or China-only region suggestions reach the international site`,
    );
  }
});

test('the China administrative division dataset is only imported by the gated input', async () => {
  const importers = [];
  for (const file of await walk(sourceRoot)) {
    const content = await readFile(file, 'utf8');
    if (!/from '.*administrativeDivisions/.test(content)) continue;
    importers.push(file.slice(sourceRoot.length + 1).replace(/\\/g, '/'));
  }

  assert.deepEqual(
    importers.sort(),
    ['components/common/RegionInput.jsx'],
    'a new importer of the China division dataset would expose China-only suggestions outside the gated input',
  );
});
