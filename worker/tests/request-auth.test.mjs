import test from 'node:test';
import assert from 'node:assert/strict';
import { signJwt } from '../src/lib/auth.js';
import {
  authenticateRequest,
  hasValidCsrf,
  requestPortalRole,
} from '../src/lib/requestAuth.js';

const JWT_SECRET = 'request-auth-test-secret-32-characters';

test('request portal role uses exact Origin and Referer hosts', () => {
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://engineer.sagemro.com' },
  })), 'engineer');
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Referer: 'https://admin.sagemro.com/' },
  })), 'admin');
  assert.equal(requestPortalRole(new Request('https://api.sagemro.com/api/auth/session', {
    headers: { Origin: 'https://admin.attacker.example' },
  })), null);
});

test('Bearer authentication takes precedence over portal cookies', async () => {
  const token = await signJwt({
    userId: 'engineer-1',
    userType: 'engineer',
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);
  const auth = await authenticateRequest(new Request('https://api.sagemro.com/api/workorders', {
    headers: {
      Origin: 'https://sagemro.com',
      Authorization: `Bearer ${token}`,
      Cookie: '__Host-sagemro_customer_session=invalid',
    },
  }), { JWT_SECRET });

  assert.equal(auth.userId, 'engineer-1');
  assert.equal(auth.authMethod, 'bearer');
});

test('cookie authentication enforces the portal role and CSRF token', async () => {
  const csrf = 'request-auth-csrf';
  const token = await signJwt({
    userId: 'customer-1',
    userType: 'customer',
    csrf,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);
  const auth = await authenticateRequest(new Request('https://api.sagemro.com/api/workorders', {
    method: 'POST',
    headers: {
      Origin: 'https://sagemro.com',
      Cookie: `__Host-sagemro_customer_session=${token}`,
      'X-CSRF-Token': csrf,
    },
  }), { JWT_SECRET });

  assert.equal(auth.userId, 'customer-1');
  assert.equal(auth.authMethod, 'cookie');
  assert.equal(hasValidCsrf(new Request('https://api.sagemro.com/api/workorders', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrf },
  }), auth), true);
});
