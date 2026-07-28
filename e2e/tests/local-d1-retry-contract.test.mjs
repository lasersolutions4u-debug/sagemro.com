import assert from 'node:assert/strict';
import test from 'node:test';

import * as visual from '../support/visual.mjs';

test('local D1 retries a transient SQLite busy error', () => {
  assert.equal(typeof visual.runWithSqliteBusyRetry, 'function');

  let attempts = 0;
  const waits = [];
  const result = visual.runWithSqliteBusyRetry(() => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error('database is locked: SQLITE_BUSY');
      error.stderr = 'workerd failed: SQLITE_BUSY';
      throw error;
    }
    return 'ok';
  }, {
    delays: [10],
    wait: (delayMs) => waits.push(delayMs),
  });

  assert.equal(result, 'ok');
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [10]);
});

test('local D1 does not retry a non-lock failure', () => {
  assert.equal(typeof visual.runWithSqliteBusyRetry, 'function');

  let attempts = 0;
  assert.throws(() => visual.runWithSqliteBusyRetry(() => {
    attempts += 1;
    throw new Error('no such table: missing_table');
  }, {
    delays: [10, 20],
    wait: () => assert.fail('non-lock failures must not wait'),
  }), /no such table/);
  assert.equal(attempts, 1);
});
