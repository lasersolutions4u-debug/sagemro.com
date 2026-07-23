import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const wranglerTomlPath = resolve(import.meta.dirname, '../wrangler.toml');

test('committed wrangler config does not include development bypass verification codes', async () => {
  const config = await readFile(wranglerTomlPath, 'utf8');

  assert.doesNotMatch(config, /^\s*DEV_BYPASS_CODE\s*=/m);
});

test('field evidence uses a private R2 binding in every deployed environment', async () => {
  const config = await readFile(wranglerTomlPath, 'utf8');

  assert.match(config, /\[\[r2_buckets\]\]\s*binding\s*=\s*"FIELD_EVIDENCE"\s*bucket_name\s*=\s*"sagemro-field-evidence"/m);
  assert.match(config, /\[\[env\.production\.r2_buckets\]\]\s*binding\s*=\s*"FIELD_EVIDENCE"\s*bucket_name\s*=\s*"sagemro-field-evidence"/m);
  assert.doesNotMatch(config, /FIELD_EVIDENCE[\s\S]{0,250}R2_PUBLIC_HOST|R2_PUBLIC_HOST[\s\S]{0,250}FIELD_EVIDENCE/m);
});
