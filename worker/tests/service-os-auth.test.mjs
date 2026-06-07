import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

test('public engineer registration is closed for Service OS positioning', async () => {
  const request = new Request('https://api.sagemro.com/api/auth/register/engineer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
    },
    body: JSON.stringify({
      name: 'Test Engineer',
      phone: '13800000000',
      password: 'secret123',
      code: '888888',
      company: 'Test Co',
    }),
  });

  const response = await worker.fetch(request, {}, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 410);
  assert.match(body.error, /Public engineer registration is closed/);
});
