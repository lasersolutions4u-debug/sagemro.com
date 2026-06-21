import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker, { resolveAdminCredentials, shouldUseCnDatabase } from '../src/index.js';

test('uses CN database for api.sagemro.cn requests', () => {
  const request = new Request('https://api.sagemro.cn/health');

  assert.equal(shouldUseCnDatabase(request), true);
});

test('uses CN database for admin.sagemro.cn origin through shared API host', () => {
  const request = new Request('https://api.sagemro.com/api/admin/stats', {
    headers: { Origin: 'https://admin.sagemro.cn' },
  });

  assert.equal(shouldUseCnDatabase(request), true);
});

test('keeps COM database for sagemro.com requests', () => {
  const request = new Request('https://api.sagemro.com/health', {
    headers: { Origin: 'https://sagemro.com' },
  });

  assert.equal(shouldUseCnDatabase(request), false);
});

test('does not leak CN database routing into later COM requests', async () => {
  const createDb = () => ({
    calls: [],
    prepare(sql) {
      this.calls.push(sql);
      return {
        bind() {
          return this;
        },
        async first() {
          return null;
        },
      };
    },
  });
  const comDb = createDb();
  const cnDb = createDb();
  const kv = {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  };
  const env = {
    DB: comDb,
    DB_CN: cnDb,
    KV: kv,
    JWT_SECRET: 'test-secret-at-least-16-chars',
  };
  const body = JSON.stringify({ phone: '13900000000', password: 'wrong-password' });

  await worker.fetch(new Request('https://api.sagemro.cn/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://sagemro.cn' },
    body,
  }), env, { waitUntil() {} });

  assert.equal(cnDb.calls.length, 2, 'CN request should query CN DB');
  assert.equal(comDb.calls.length, 0, 'CN request should not query COM DB');

  await worker.fetch(new Request('https://api.sagemro.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://sagemro.com' },
    body,
  }), env, { waitUntil() {} });

  assert.equal(comDb.calls.length, 2, 'COM request after CN request should query COM DB');
  assert.equal(cnDb.calls.length, 2, 'COM request must not continue using CN DB');
  assert.equal(env.DB, comDb, 'source env.DB should remain the COM binding');
});

test('resolves market-specific admin credentials for CN admin requests', () => {
  const request = new Request('https://api.sagemro.cn/api/admin/login');
  const credentials = resolveAdminCredentials(request, {
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'global-pass',
    ADMIN_PHONE_CN: '13900000000',
    ADMIN_PASSWORD_CN: 'cn-pass',
  });

  assert.deepEqual(credentials, {
    market: 'cn',
    phone: '13900000000',
    password: 'cn-pass',
  });
});

test('falls back to international admin credentials until CN secrets are configured', () => {
  const request = new Request('https://api.sagemro.cn/api/admin/login');
  const credentials = resolveAdminCredentials(request, {
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'global-pass',
  });

  assert.deepEqual(credentials, {
    market: 'cn',
    phone: '13800000000',
    password: 'global-pass',
  });
});
