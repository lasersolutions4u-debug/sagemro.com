import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('./StaffAccountsPage.jsx', import.meta.url), 'utf8');
const list = await readFile(new URL('./staffAccountList.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

test('staff creation offers only the system roles that still carry console access', () => {
  assert.match(page, /const STAFF_ROLES = \['admin', 'operations', 'warehouse', 'procurement'\]/);
  assert.match(page, /createAdminStaffAccount/);
  assert.doesNotMatch(page, /expected_staff_id/);
  assert.doesNotMatch(page, /scope_version/);
  assert.doesNotMatch(page, /territory_ids/);
});

test('the retired business organization surface is gone from the page, the list, and the api client', () => {
  for (const source of [page, list, api]) {
    assert.doesNotMatch(source, /BusinessOrganizationPanel/);
    assert.doesNotMatch(source, /BusinessStaffFields/);
    assert.doesNotMatch(source, /getBusinessOrganization/);
    assert.doesNotMatch(source, /orgSummary/);
    assert.doesNotMatch(source, /deactivationImpact/);
    assert.doesNotMatch(source, /effective_territory_ids/);
  }
});

test('internal staff navigation and page are bootstrap-admin only', () => {
  assert.match(app, /StaffAccountsPage/);
  assert.match(app, /user\.staffRole === 'admin'/);
  assert.match(app, /user\.staffId == null/);
  assert.match(page, /deactivateAdminStaffAccount/);
  assert.match(page, /resetAdminStaffPassword/);
  assert.match(page, /reactivateAdminStaffAccount/);
});

test('temporary passwords are displayed once in a clear modal', () => {
  assert.match(page, /temporaryPassword/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /setTemporaryPassword\(''\)/);
  assert.match(page, /Temporary password/);
  assert.match(page, /临时密码/);
});

test('session role fields are persisted and forced password change blocks the console', () => {
  assert.match(app, /staffRole/);
  assert.match(app, /staffId/);
  assert.match(app, /mustChangePassword/);
  assert.match(app, /localStorage\.setItem\('admin_user'/);
  assert.match(app, /if \(user\.mustChangePassword\)/);
  assert.match(app, /changeAdminPassword/);
  assert.match(api, /\/api\/auth\/change-password/);
});

test('password and staff account fields have visible associated labels', () => {
  for (const id of ['current-password', 'new-password', 'confirm-password']) {
    assert.match(app, new RegExp(`<label[^>]*htmlFor="${id}"`));
    assert.match(app, new RegExp(`<input[^>]*id="${id}"`));
  }
  for (const id of ['staff-display-name', 'staff-login', 'staff-phone', 'staff-role']) {
    assert.match(page, new RegExp(`<label[^>]*htmlFor="${id}"`));
    assert.match(page, new RegExp(`<(?:input|select)[^>]*id="${id}"`));
  }
});

test('new staff inherit the current portal market without a selectable market field', () => {
  assert.match(page, /market_scope: runtimeConfig\.market/);
  assert.doesNotMatch(page, /<select[^>]*id="staff-market"/);
  assert.match(page, /id="staff-market"[^>]*readOnly/);
  assert.match(page, /htmlFor="staff-market"/);
  assert.match(page, /Automatically assigned to this portal/);
  assert.match(page, /自动归属当前后台/);
});

test('the account list is searchable and filterable without an organization projection', () => {
  assert.match(page, /from '\.\/staffAccountList'/);
  assert.match(page, /filterStaffAccounts/);
  assert.match(page, /sortStaffAccounts/);
  assert.match(page, /id="staff-search"/);
  assert.match(page, /id="staff-filter-role"/);
  assert.match(page, /id="staff-filter-status"/);
  assert.match(page, /clearFilters/);
  assert.match(page, /t\.noResults/);
});

test('destructive row actions confirm through an in-page dialog that names the action', () => {
  assert.match(page, /setConfirmAction\(\{ kind: 'deactivate', account \}\)/);
  assert.match(page, /setConfirmAction\(\{ kind: 'reset', account \}\)/);
  assert.match(page, /role="dialog" aria-modal="true" aria-label=\{t\.confirmTitle\}/);
  assert.match(page, /t\.confirmDeactivateTitle/);
  assert.match(page, /const busy = pending\.endsWith\(`:\$\{account\.id\}`\)/);
  assert.match(page, /pending \? t\.pendingOperation : t\.confirmSubmit/);
  assert.doesNotMatch(page, /window\.confirm/, 'the staff page states the action instead of a generic confirm');
});

test('deactivation is reversible and the dialog says the account can be restored', () => {
  assert.match(page, /setConfirmAction\(\{ kind: 'reactivate', account \}\)/);
  assert.match(page, /confirmReactivateTitle/);
  assert.match(api, /\/api\/admin\/staff\/\$\{staffId\}\/reactivate/);
});

test('account creation lives in a labelled drawer whose submit action is distinct from the trigger', () => {
  assert.match(page, /const \[drawerOpen, setDrawerOpen\] = useState\(false\)/);
  assert.match(page, /role="dialog" aria-modal="true" aria-label=\{t\.createTitle\}/);
  assert.match(page, /setDrawerOpen\(true\)/);
  assert.match(page, /aria-label=\{t\.close\}/);
  assert.match(page, /createSubmit/);
  assert.match(page, /setDrawerOpen\(false\)/);
  assert.match(page, /data-testid="staff-error"/);
});
