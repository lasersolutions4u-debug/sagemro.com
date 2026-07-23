import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldPreserveReceiptRetryKey } from '../src/components/WorkOrder/materialRequisitionRetry.js';

test('ambiguous receipt failures preserve the retry key', () => {
  const abortError = new Error('aborted');
  abortError.name = 'AbortError';

  assert.equal(shouldPreserveReceiptRetryKey(new Error('unknown failure')), true);
  assert.equal(shouldPreserveReceiptRetryKey(new SyntaxError('invalid JSON')), true);
  assert.equal(shouldPreserveReceiptRetryKey(abortError), true);
  assert.equal(shouldPreserveReceiptRetryKey(new TypeError('network failure')), true);
});

test('only explicit non-retryable client errors clear the retry key', () => {
  assert.equal(shouldPreserveReceiptRetryKey(Object.assign(new Error('bad request'), { status: 400 })), false);
  assert.equal(shouldPreserveReceiptRetryKey(Object.assign(new Error('conflict'), { status: 409 })), false);
  assert.equal(shouldPreserveReceiptRetryKey(Object.assign(new Error('timeout'), { status: 408 })), true);
  assert.equal(shouldPreserveReceiptRetryKey(Object.assign(new Error('rate limited'), { status: 429 })), true);
  assert.equal(shouldPreserveReceiptRetryKey(Object.assign(new Error('server error'), { status: 500 })), true);
});
