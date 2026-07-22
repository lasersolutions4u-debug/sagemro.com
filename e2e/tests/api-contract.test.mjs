import assert from 'node:assert/strict';
import test from 'node:test';

import { activationTokenFromMessage } from '../support/api.mjs';

test('activation mailbox helper extracts the fragment token without exposing unrelated text', () => {
  assert.equal(
    activationTokenFromMessage({
      text: 'Activate at https://engineer.sagemro.com/activate#token=test-token-123.',
    }),
    'test-token-123',
  );
  assert.throws(() => activationTokenFromMessage({ text: 'No activation link here.' }), /token/i);
});
