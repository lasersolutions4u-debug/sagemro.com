import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TimeoutError, isTimeoutError, withTimeout } from './asyncTimeout.js';

test('withTimeout rejects with TimeoutError when the operation takes too long', async () => {
  const operation = new Promise((resolve) => {
    setTimeout(() => resolve('late result'), 50);
  });

  await assert.rejects(
    withTimeout(operation, 1, 'Delete timed out'),
    (err) => err instanceof TimeoutError
      && isTimeoutError(err)
      && err.message === 'Delete timed out',
  );
});

test('withTimeout returns the operation result when it finishes in time', async () => {
  await assert.doesNotReject(async () => {
    const result = await withTimeout(Promise.resolve('ok'), 50);
    assert.equal(result, 'ok');
  });
});
