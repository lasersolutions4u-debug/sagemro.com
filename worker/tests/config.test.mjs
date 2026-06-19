import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('production wrangler vars explicitly disable DEV_BYPASS_CODE', () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf-8');
  const lines = toml.split('\n');
  const start = lines.findIndex((line) => line.trim() === '[env.production.vars]');
  const end = lines.findIndex((line, index) => index > start && line.startsWith('['));
  const productionVars = lines.slice(start + 1, end === -1 ? lines.length : end).join('\n');

  assert.notEqual(start, -1, 'missing [env.production.vars] block');
  assert.match(`\n${productionVars}\n`, /\nDEV_BYPASS_CODE\s*=\s*""\s*(?:\n|$)/);
});
