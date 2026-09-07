import assert from 'node:assert/strict';
import test from 'node:test';

import * as implementation from './businessWorkspaceExport.js';

test('business export collects every page with pinned identity and scope, then revalidates', async () => {
  assert.equal(typeof implementation.collectBusinessRecords, 'function');
  const requests = [];
  const rows = await implementation.collectBusinessRecords({
    expectedStaffId: 'fixture-specialist',
    isCurrent: () => true,
    fetchPage: async params => {
      requests.push(params);
      if (params.limit === 1) return { records: [{ id: 'a' }], total: 3, next_cursor: 'a', scope_version: 'scope-1' };
      return params.cursor
        ? { records: [{ id: 'c' }], total: 3, next_cursor: null, scope_version: 'scope-1' }
        : { records: [{ id: 'a' }, { id: 'b' }], total: 3, next_cursor: 'b', scope_version: 'scope-1' };
    },
  });
  assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c']);
  assert.equal(requests.length, 3);
  assert.ok(requests.every(params => params.expected_staff_id === 'fixture-specialist' && params.export === 1));
  assert.equal(requests[1].scope_version, 'scope-1');
  assert.equal(requests[2].scope_version, 'scope-1');
  assert.equal(requests[2].limit, 1);
});

test('business export rejects changed permissions, malformed or incomplete pages instead of downloading partial data', async () => {
  assert.equal(typeof implementation.collectBusinessRecords, 'function');
  for (const pages of [
    [{ records: [], total: 1, next_cursor: null, scope_version: 'one' }],
    [{ records: [{ id: 'a' }], total: 1, next_cursor: null }],
    [{ records: [{ id: 'a' }], total: 2, next_cursor: 'a', scope_version: 'one' }, { records: [{ id: 'b' }], total: 2, next_cursor: null, scope_version: 'two' }],
    [{ records: [{ id: 'a' }], total: 2, next_cursor: 'a', scope_version: 'one' }, { records: [{ id: 'a' }], total: 2, next_cursor: 'a', scope_version: 'one' }],
    [{ records: [{ id: 'a' }], total: 1, next_cursor: null, scope_version: 'one' }, { records: [], total: 0, next_cursor: null, scope_version: 'two' }],
  ]) {
    let calls = 0;
    await assert.rejects(() => implementation.collectBusinessRecords({ expectedStaffId: 'fixture', isCurrent: () => true, fetchPage: async () => pages[calls++] }), error => error.code === 'business_export_changed');
    assert.ok(calls <= 2);
  }
});

test('business export checks session identity before and after each asynchronous page', async () => {
  assert.equal(typeof implementation.collectBusinessRecords, 'function');
  let current = true;
  await assert.rejects(() => implementation.collectBusinessRecords({
    expectedStaffId: 'fixture', isCurrent: () => current,
    fetchPage: async () => { current = false; return { records: [{ id: 'secret-fixture' }], total: 1, next_cursor: null, scope_version: 'one' }; },
  }), error => error.code === 'business_identity_changed');
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(() => implementation.collectBusinessRecords({ expectedStaffId: 'fixture', isCurrent: () => true, signal: controller.signal, fetchPage: async () => { called = true; } }), error => error.name === 'AbortError');
  assert.equal(called, false);
});

test('business CSV only exports declared columns and neutralizes spreadsheet formulas', () => {
  assert.equal(typeof implementation.businessRecordsCsv, 'function');
  const csv = implementation.businessRecordsCsv([
    { name: '=1+1', email: 'sample@example.invalid', password_hash: 'never-export' },
    { name: ' \t@SUM(1,2)', email: 'line1\nline2' },
    { name: '+15550000000', email: 'a"b' },
    { name: '-10', email: null },
  ], [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }]);
  assert.ok(csv.startsWith('\uFEFF"Name","Email"\r\n'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\' \t@SUM(1,2)"'));
  assert.ok(csv.includes('"\'+15550000000"'));
  assert.ok(csv.includes('"\'-10"'));
  assert.ok(csv.includes('"a""b"'));
  assert.equal(csv.includes('never-export'), false);
});

test('business export starts from the visible workspace scope, not silently adopting newer permissions', async () => {
  const requests = [];
  await assert.rejects(() => implementation.collectBusinessRecords({
    expectedStaffId: 'fixture', initialScopeVersion: 'visible-scope', isCurrent: () => true,
    fetchPage: async params => {
      requests.push(params);
      throw Object.assign(new Error('scope changed'), { status: 409 });
    },
  }), { status: 409 });
  assert.equal(requests[0].scope_version, 'visible-scope');
});
