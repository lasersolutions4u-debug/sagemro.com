import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { assertLoopbackUrl, e2eRuntime } from '../support/runtime.mjs';

const playwrightConfig = await readFile(new URL('../playwright.config.mjs', import.meta.url), 'utf8');

test('E2E runtime accepts only loopback service URLs', () => {
  for (const url of [
    'http://api.127.0.0.1.nip.io:8878',
    'http://customer.127.0.0.1.nip.io:4273',
    'http://engineer.127.0.0.1.nip.io:4273',
    'http://admin.127.0.0.1.nip.io:4274',
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
  assert.equal(runtime.apiBase, 'http://api.127.0.0.1.nip.io:8878');
  assert.equal(runtime.customerBase, 'http://customer.127.0.0.1.nip.io:4273');
  assert.equal(runtime.engineerBase, 'http://engineer.127.0.0.1.nip.io:4273');
  assert.equal(runtime.adminBase, 'http://admin.127.0.0.1.nip.io:4274');
  assert.equal(runtime.testSecret, 'local-e2e-secret-32-characters');
});

test('E2E Chromium bypasses system proxies for the loopback nip.io topology', () => {
  assert.match(playwrightConfig, /--no-proxy-server/);
});
