import assert from 'node:assert/strict';
import test from 'node:test';

import { findMatchingDevice } from '../src/components/Device/deviceProfile.js';

test('finds an existing device using normalized type, brand, and model', () => {
  const devices = [
    { id: 'dev-1', type: 'Laser Cutting Machine', brand: 'TRUMPF', model: 'TruLaser 3030' },
  ];

  const match = findMatchingDevice(devices, {
    type: ' laser cutting machine ',
    brand: 'trumpf',
    model: 'trulaser 3030',
  });

  assert.equal(match?.id, 'dev-1');
});

test('does not match a different device model', () => {
  const devices = [
    { id: 'dev-1', type: 'Laser Cutting Machine', brand: 'TRUMPF', model: 'TruLaser 3030' },
  ];

  const match = findMatchingDevice(devices, {
    type: 'Laser Cutting Machine',
    brand: 'TRUMPF',
    model: 'TruLaser 5030',
  });

  assert.equal(match, null);
});
