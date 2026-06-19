import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('./ToolBar.jsx', import.meta.url), 'utf8');

test('signed-out sidebar toolbar does not render an extra divider', () => {
  assert.match(source, /const toolbarShellClass = currentUser\s*\?/);
  assert.doesNotMatch(
    source,
    /<div className="border-t border-\[var\(--color-border\)\] pt-3 mt-auto">/,
  );
});
