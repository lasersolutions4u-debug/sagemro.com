import assert from 'node:assert/strict';
import test from 'node:test';

import {
  identityClaimsForAccount,
  normalizeIdentityEmail,
  normalizeIdentityPhone,
} from '../src/lib/accountIdentity.js';

test('identity normalization is stable across case and phone punctuation', () => {
  assert.equal(normalizeIdentityEmail(' Tom.Lee@Example.COM '), 'tom.lee@example.com');
  assert.equal(normalizeIdentityPhone(' +52 (5572) 080-065 '), '+525572080065');
});

test('identity claims omit empty values and preserve owner metadata', () => {
  assert.deepEqual(identityClaimsForAccount({
    ownerType: 'engineer',
    ownerId: 'eng-1',
    email: 'tom@example.com',
    phone: '+52 5572 080065',
  }), [
    { identityType: 'email', normalizedValue: 'tom@example.com', ownerType: 'engineer', ownerId: 'eng-1' },
    { identityType: 'phone', normalizedValue: '+525572080065', ownerType: 'engineer', ownerId: 'eng-1' },
  ]);
});
