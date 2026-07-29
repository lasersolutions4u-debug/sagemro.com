import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorkOrderRequestIdentity,
  runCurrentWorkOrderRequest,
} from '../src/utils/workOrderRequestIdentity.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('a stale A success cannot write after B becomes current', async () => {
  let current = createWorkOrderRequestIdentity(1, 'work-order-a');
  const requestA = current;
  const pendingA = deferred();
  const writes = [];
  const runA = runCurrentWorkOrderRequest({
    identity: requestA,
    getCurrentIdentity: () => current,
    load: () => pendingA.promise,
    onSuccess: (value) => writes.push(value),
  });

  current = createWorkOrderRequestIdentity(2, 'work-order-b');
  pendingA.resolve({ id: 'work-order-a' });

  assert.equal(await runA, false);
  assert.deepEqual(writes, []);
});

test('a stale A failure is ignored and never rethrown into B', async () => {
  let current = createWorkOrderRequestIdentity(1, 'work-order-a');
  const requestA = current;
  const pendingA = deferred();
  const handledErrors = [];
  const runA = runCurrentWorkOrderRequest({
    identity: requestA,
    getCurrentIdentity: () => current,
    load: () => pendingA.promise,
    onSuccess: () => assert.fail('stale request must not write'),
    onError: (error) => handledErrors.push(error),
    throwOnError: true,
  });

  current = createWorkOrderRequestIdentity(2, 'work-order-b');
  pendingA.reject(new Error('late A failure'));

  assert.equal(await runA, false);
  assert.deepEqual(handledErrors, []);
});

test('the current request commits success and preserves opted-in failure propagation', async () => {
  const current = createWorkOrderRequestIdentity(3, 'work-order-b');
  const writes = [];

  assert.equal(await runCurrentWorkOrderRequest({
    identity: current,
    getCurrentIdentity: () => current,
    load: async () => ({ id: 'work-order-b' }),
    onSuccess: (value) => writes.push(value.id),
  }), true);
  assert.deepEqual(writes, ['work-order-b']);

  await assert.rejects(
    runCurrentWorkOrderRequest({
      identity: current,
      getCurrentIdentity: () => current,
      load: async () => {
        throw new Error('current failure');
      },
      onSuccess: () => {},
      throwOnError: true,
    }),
    /current failure/,
  );
});
