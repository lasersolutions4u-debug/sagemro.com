import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('global document styles do not lock page scrolling', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const globalRule = css.match(/html,\s*body,\s*#root\s*\{[^}]+\}/s);

  assert.ok(globalRule, 'expected html/body/#root global sizing rule');
  assert.doesNotMatch(globalRule[0], /overflow\s*:\s*hidden/, 'global page scroll must not be locked');
  assert.match(globalRule[0], /min-height\s*:\s*100%/, 'root should keep full-height baseline without forcing fixed viewport overflow');
});
