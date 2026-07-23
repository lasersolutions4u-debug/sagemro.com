import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import worker from '../src/index.js';

const entry = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('production rejects diagnostic routes before loading development tooling', async () => {
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/init-test-data'), {
    ENVIRONMENT: 'production',
    DB: {
      prepare() {
        throw new Error('production diagnostic route touched the database');
      },
    },
  }, { waitUntil() {} });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'Not found');
});

test('development diagnostics stay behind admin auth and a dynamic module boundary', async () => {
  const envGate = entry.indexOf("if (env.ENVIRONMENT !== 'development')");
  const authGate = entry.indexOf('const admin = await authenticateAdmin(request, env)', envGate);
  const dynamicImport = entry.indexOf("await import('./dev/diagnostics.js')", authGate);

  assert.ok(envGate >= 0 && authGate > envGate && dynamicImport > authGate);
  assert.doesNotMatch(entry, /async function handleInitTestData|async function handleTestFullPricingFlow/);
  assert.doesNotMatch(entry, /test1234|mnyj09v0pa0kfz0lenf|mnyj0ab5bzrrfkvrppo/);
});
