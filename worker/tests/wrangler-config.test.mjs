import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const wranglerTomlPath = resolve(import.meta.dirname, '../wrangler.toml');

test('committed wrangler config does not include development bypass verification codes', async () => {
  const config = await readFile(wranglerTomlPath, 'utf8');

  assert.doesNotMatch(config, /^\s*DEV_BYPASS_CODE\s*=/m);
});
