import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeServiceMode,
  requiresArrivalVerification,
} from '../src/lib/service-mode.js';

test('supports remote, onsite, and hybrid service modes', () => {
  assert.equal(normalizeServiceMode('remote'), 'remote');
  assert.equal(normalizeServiceMode('onsite'), 'onsite');
  assert.equal(normalizeServiceMode('hybrid'), 'hybrid');
  assert.equal(normalizeServiceMode('unknown'), 'remote');
});

test('only onsite service requires arrival verification', () => {
  assert.equal(requiresArrivalVerification('remote'), false);
  assert.equal(requiresArrivalVerification('hybrid'), false);
  assert.equal(requiresArrivalVerification('onsite'), true);
});
