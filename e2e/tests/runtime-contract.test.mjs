import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { assertLoopbackUrl, e2eRuntime } from '../support/runtime.mjs';
import * as runtimeSupport from '../support/runtime.mjs';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dns from 'node:dns';

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
    'ftp://localhost/file',
    'http://user:password@localhost:8878',
  ]) {
    assert.throws(() => assertLoopbackUrl(url), /loopback/i);
  }
});

test('local test environment excludes inherited credentials and generates fresh run-only secrets', () => {
  assert.equal(typeof runtimeSupport.createLocalEnvironment, 'function');
  const runDir = mkdtempSync(path.join(tmpdir(), 'sagemro-e2e-contract-'));
  const inherited = { PATH: process.env.PATH, CLOUDFLARE_API_TOKEN: 'fixture-must-not-pass', RESEND_API_KEY: 'fixture-must-not-pass', ADMIN_PASSWORD: 'fixture-must-not-pass', HTTPS_PROXY: 'http://proxy.invalid', NODE_OPTIONS: '--require unwanted.cjs', VITE_API_BASE: 'https://api.sagemro.com' };
  const first = runtimeSupport.createLocalEnvironment(inherited, runDir);
  const second = runtimeSupport.createLocalEnvironment(inherited, runDir);
  for (const key of ['CLOUDFLARE_API_TOKEN', 'RESEND_API_KEY', 'HTTPS_PROXY', 'NODE_OPTIONS', 'VITE_API_BASE']) assert.equal(first[key], undefined, key);
  for (const key of ['E2E_TEST_SECRET', 'JWT_SECRET', 'ADMIN_PASSWORD', 'E2E_ENGINEER_PASSWORD', 'E2E_CUSTOMER_PASSWORD']) {
    assert.ok(first[key].length >= 20, `${key} must be generated`);
    assert.notEqual(first[key], second[key], `${key} must vary between runs`);
  }
  assert.equal(first.ENVIRONMENT, 'development');
  assert.equal(first.E2E_TEST_MODE, 'true');
  assert.equal(first.E2E_RUN_DIR, runDir);
  assert.equal(first.CLOUDFLARE_INCLUDE_PROCESS_ENV, 'true');
  assert.equal(existsSync(path.join(runDir, 'worker.env')), false);
  assert.throws(() => runtimeSupport.createLocalEnvironment({ E2E_API_BASE: 'https://api.sagemro.com' }, runDir), /loopback/i);
  assert.throws(() => runtimeSupport.createLocalEnvironment({}, tmpdir()), /isolated/i);
});

test('local services require an existing isolated run directory and use the same state path', () => {
  assert.equal(typeof runtimeSupport.localRunPaths, 'function');
  assert.throws(() => runtimeSupport.localRunPaths({}), /E2E_RUN_DIR/);
  const runDir = mkdtempSync(path.join(tmpdir(), 'sagemro-e2e-contract-'));
  const paths = runtimeSupport.localRunPaths({ E2E_RUN_DIR: runDir });
  assert.equal(paths.stateDir, path.join(runDir, 'state'));
  assert.equal(paths.configPath, path.join(runDir, 'wrangler.json'));
  assert.throws(() => runtimeSupport.localRunPaths({ E2E_RUN_DIR: path.join(runDir, '..') }), /isolated/i);
});

test('local preparation never deletes prior state or writes credential values', () => {
  const source = readFileSync(new URL('../scripts/prepare-local-env.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /rmSync|worker\.env|LocalAdminPassword|local-e2e-jwt-secret/);
  assert.match(source, /process\.execPath/);
  assert.match(source, /--local/);
  assert.match(source, /flag: 'wx'/);
  assert.doesNotMatch(source, /--remote/);
});

test('test-only DNS mapping pins nip.io service hosts to loopback without changing system DNS', async () => {
  assert.equal(typeof runtimeSupport.installLocalDnsMapping, 'function');
  const original = dns.lookup;
  const originalAsync = dns.promises.lookup;
  const restore = runtimeSupport.installLocalDnsMapping();
  try {
    const records = await new Promise((resolve, reject) => dns.lookup('api.127.0.0.1.nip.io', { all: true }, (error, value) => error ? reject(error) : resolve(value)));
    assert.deepEqual(records, [{ address: '127.0.0.1', family: 4 }]);
    const record = await new Promise((resolve, reject) => dns.lookup('admin.127.0.0.1.nip.io', (error, address, family) => error ? reject(error) : resolve({ address, family })));
    assert.deepEqual(record, { address: '127.0.0.1', family: 4 });
    assert.deepEqual(await dns.promises.lookup('api.127.0.0.1.nip.io', { all: true, family: 4 }), [{ address: '127.0.0.1', family: 4 }]);
    assert.deepEqual(await dns.promises.lookup('api.127.0.0.1.nip.io', { all: true, family: 6 }), []);
  } finally { restore(); }
  assert.equal(dns.lookup, original);
  assert.equal(dns.promises.lookup, originalAsync);
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

test('regional lead E2E covers the approved team workspace boundaries', () => {
  const source = readFileSync(new URL('./regional-lead-workspace.spec.mjs', import.meta.url), 'utf8');
  assert.match(source, /Team metrics/);
  assert.match(source, /Regional team work orders/);
  assert.match(source, /firstMemberGroup\.click\(\)/);
  assert.match(source, /Assign \/ Reassign/);
  assert.match(source, /Team progress view/);
  assert.match(source, /Open calendar/);
  assert.match(source, /SAGEMRO Engineer Profile/);
});
