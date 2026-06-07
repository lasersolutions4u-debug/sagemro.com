import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldUseCnDatabase } from '../src/index.js';

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
