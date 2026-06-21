import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAdminCredentials, shouldUseCnDatabase } from '../src/index.js';

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
