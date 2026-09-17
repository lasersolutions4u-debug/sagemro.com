import assert from 'node:assert/strict';
import test from 'node:test';
import { deactivationImpact, filterStaffAccounts, matchesQuery, orgSummary, sortStaffAccounts } from './staffAccountList.js';

const organization = {
  staff: [
    { id: 'director-1', display_name: '华东总监', effective_territory_ids: ['t-east', 't-south'] },
    { id: 'manager-1', display_name: '王经理', effective_territory_ids: ['t-east'] },
    { id: 'specialist-1', display_name: '李专员', effective_territory_ids: ['t-east'] },
  ],
  territories: [
    { id: 't-east', name: '华东' },
    { id: 't-south', name: '华南' },
  ],
};

const accounts = [
  { id: 'a1', display_name: '运营甲', normalized_login: 'ops@example.invalid', normalized_phone: '13800000001', role: 'operations', is_active: 1 },
  { id: 'a2', display_name: '仓储乙', normalized_login: 'wh@example.invalid', normalized_phone: null, role: 'warehouse', is_active: 0 },
  { id: 'director-1', display_name: '华东总监', normalized_login: 'dir@example.invalid', role: 'business_director', is_active: 1, business_profile_required: 1, supervisor_staff_id: null, territory_ids: ['t-east'] },
  { id: 'manager-1', display_name: '王经理', normalized_login: 'mgr@example.invalid', role: 'business_manager', is_active: 1, business_profile_required: 1, supervisor_staff_id: 'director-1', territory_ids: [] },
  { id: 'orphan-1', display_name: '孤岛经理', normalized_login: 'orphan@example.invalid', role: 'business_manager', is_active: 1, business_profile_required: 1, supervisor_staff_id: 'gone-1', territory_ids: [] },
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
  assert.equal(filterStaffAccounts(accounts).length, 5);
  assert.deepEqual(filterStaffAccounts(accounts, { role: 'business_manager' }).map((a) => a.id), ['manager-1', 'orphan-1']);
  assert.deepEqual(filterStaffAccounts(accounts, { status: 'inactive' }).map((a) => a.id), ['a2']);
  assert.deepEqual(filterStaffAccounts(accounts, { query: '  ops@  ' }).map((a) => a.id), ['a1']);
  assert.deepEqual(filterStaffAccounts(accounts, { role: 'operations', status: 'inactive' }), []);
  assert.deepEqual(filterStaffAccounts(null, { role: 'operations' }), []);
});

test('organization summary resolves supervisor and own territories only for business roles', () => {
  assert.equal(orgSummary(accounts[0], organization), null);
  assert.equal(orgSummary(undefined, organization), null);

  const director = orgSummary(accounts[2], organization);
  assert.equal(director.supervisorName, null);
  assert.deepEqual(director.ownTerritories, ['华东']);
  assert.deepEqual(director.inheritedTerritories, ['华南']);

  const manager = orgSummary(accounts[3], organization);
  assert.equal(manager.supervisorName, '华东总监');
  assert.deepEqual(manager.ownTerritories, []);
  assert.deepEqual(manager.inheritedTerritories, ['华东']);
});

test('a business account whose supervisor is missing keeps a null name instead of a blank label', () => {
  const orphan = orgSummary(accounts[4], organization);
  assert.equal(orphan.supervisorName, null);
  assert.deepEqual(orphan.inheritedTerritories, []);
});

test('territory grants that are absent from the organization projection are dropped, not rendered as undefined', () => {
  const summary = orgSummary({ ...accounts[3], id: 'manager-1', territory_ids: ['t-unknown'] }, organization);
  assert.deepEqual(summary.ownTerritories, []);
  assert.deepEqual(summary.inheritedTerritories, ['华东']);
});

test('list order puts active accounts first and sorts by display name inside each group', () => {
  assert.deepEqual(sortStaffAccounts(accounts).map((a) => a.display_name), ['华东总监', '孤岛经理', '王经理', '运营甲', '仓储乙']);
  assert.deepEqual(sortStaffAccounts(undefined), []);
  assert.equal(accounts[0].id, 'a1', 'sorting does not mutate the input array');
  assert.equal(accounts[0].display_name, '运营甲');
});

test('deactivation impact counts active direct reports and granted territories', () => {
  const director = deactivationImpact(accounts[2], accounts);
  assert.equal(director.reports, 1, 'only the active manager reports to the director');
  assert.equal(director.territories, 1);

  const manager = deactivationImpact(accounts[3], accounts);
  assert.equal(manager.reports, 0);
  assert.equal(manager.territories, 0);

  assert.deepEqual(deactivationImpact(undefined, accounts), { reports: 0, territories: 0 });
  assert.deepEqual(deactivationImpact(accounts[0], undefined), { reports: 0, territories: 0 });
  assert.deepEqual(deactivationImpact({ id: 'x', supervisor_staff_id: null, territory_ids: [] }, [{ id: 'x', is_active: 1, supervisor_staff_id: 'x' }]), { reports: 0, territories: 0 }, 'an account never counts itself as its own report');
});
