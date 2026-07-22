import assert from 'node:assert/strict';
import test from 'node:test';

import { assertLoopbackUrl, e2eRuntime } from '../support/runtime.mjs';

test('E2E runtime accepts only loopback service URLs', () => {
  for (const url of [
    'http://127.0.0.1:8878',
    'http://localhost:4273',
    'http://engineer.localhost:4273',
  ]) {
    assert.equal(assertLoopbackUrl(url).href, `${url}/`);
  }

  for (const url of [
    'https://api.sagemro.com',
    'https://api.sagemro.cn',
    'http://192.168.1.20:8788',
  ]) {
    assert.throws(() => assertLoopbackUrl(url), /loopback/i);
  }
});

test('E2E runtime requires a nontrivial mailbox secret', () => {
  assert.throws(() => e2eRuntime({ E2E_TEST_SECRET: '' }), /secret/i);
  assert.throws(() => e2eRuntime({ E2E_TEST_SECRET: 'short' }), /secret/i);

  const runtime = e2eRuntime({
    E2E_TEST_SECRET: 'local-e2e-secret-32-characters',
  });
  assert.equal(runtime.apiBase, 'http://127.0.0.1:8878');
  assert.equal(runtime.testSecret, 'local-e2e-secret-32-characters');
});
