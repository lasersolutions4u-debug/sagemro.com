import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('wrangler.toml does not ship a fixed development verification code', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

  assert.equal(
    /^\s*DEV_BYPASS_CODE\s*=/m.test(config),
    false,
    'Use local .dev.vars for DEV_BYPASS_CODE so deploy config does not expose a fixed verification code.',
  );
});

test('verification bypass code is only read behind a development environment guard', () => {
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const directBypassReads = source.match(/const\s+\w+\s*=\s*env\.DEV_BYPASS_CODE/g) || [];

  assert.deepEqual(
    directBypassReads,
    [],
    'Read DEV_BYPASS_CODE only through a helper that returns a value in development, never directly in route handlers.',
  );
});
