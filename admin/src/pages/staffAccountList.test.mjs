import assert from 'node:assert/strict';
import test from 'node:test';
import { filterStaffAccounts, matchesQuery, sortStaffAccounts } from './staffAccountList.js';

// 后台已裁剪为知识中枢：员工账号只用于分发知识库维护权限，
// 商务组织（辖区 / 上级 / 档位）已随商务模块下线。
const accounts = [
  { id: 'a1', display_name: '运营甲', normalized_login: 'ops@example.invalid', normalized_phone: '13800000001', role: 'operations', is_active: 1 },
  { id: 'a2', display_name: '仓储乙', normalized_login: 'wh@example.invalid', normalized_phone: null, role: 'warehouse', is_active: 0 },
  { id: 'a3', display_name: '管理员丙', normalized_login: 'admin@example.invalid', normalized_phone: '13800000003', role: 'admin', is_active: 1 },
];

test('search matches display name, login, and phone, and ignores case', () => {
  assert.equal(matchesQuery(accounts[0], ''), true);
  assert.equal(matchesQuery(accounts[0], '运营'), true);
  assert.equal(matchesQuery(accounts[0], 'OPS@EXAMPLE'), true);
  assert.equal(matchesQuery(accounts[0], '1380000'), true);
  assert.equal(matchesQuery(accounts[0], 'nothing'), false);
  assert.equal(matchesQuery({ id: 'x' }, 'nothing'), false);
});

test('filters combine search, role, and active status', () => {
  assert.equal(filterStaffAccounts(accounts).length, 3);
  assert.deepEqual(filterStaffAccounts(accounts, { role: 'admin' }).map((a) => a.id), ['a3']);
  assert.deepEqual(filterStaffAccounts(accounts, { status: 'inactive' }).map((a) => a.id), ['a2']);
  assert.deepEqual(filterStaffAccounts(accounts, { query: '  ops@  ' }).map((a) => a.id), ['a1']);
  assert.deepEqual(filterStaffAccounts(accounts, { role: 'operations', status: 'inactive' }), []);
  assert.deepEqual(filterStaffAccounts(null, { role: 'operations' }), []);
});

test('list order puts active accounts first and sorts by display name inside each group', () => {
  assert.deepEqual(sortStaffAccounts(accounts).map((a) => a.display_name), ['管理员丙', '运营甲', '仓储乙']);
  assert.deepEqual(sortStaffAccounts(undefined), []);
  assert.equal(accounts[0].id, 'a1', 'sorting does not mutate the input array');
  assert.equal(accounts[0].display_name, '运营甲');
});
