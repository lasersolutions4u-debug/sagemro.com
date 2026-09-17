import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import './businessWorkspaceExport.test.mjs';
import './BusinessWorkspacePage.test.mjs';

const page = await readFile(new URL('./StaffAccountsPage.jsx', import.meta.url), 'utf8');
const list = await readFile(new URL('./staffAccountList.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

test('staff management offers the nine business grades and explicit hierarchy configuration', () => {
  assert.match(page, /business_director/);
  assert.match(page, /business_manager/);
  assert.match(page, /business_specialist/);
  assert.match(page, /BusinessStaffFields/);
  assert.match(page, /BusinessOrganizationPanel/);
  assert.match(page, /expected_staff_id/);
});

test('internal staff navigation and page are bootstrap-admin only', () => {
  assert.match(app, /StaffAccountsPage/);
  assert.match(app, /user\.staffRole === 'admin'/);
  assert.match(app, /user\.staffId == null/);
  assert.match(page, /createAdminStaffAccount/);
  assert.match(page, /deactivateAdminStaffAccount/);
  assert.match(page, /resetAdminStaffPassword/);
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

test('the account list is searchable and exposes the organization relation per row', () => {
  assert.match(page, /from '\.\/staffAccountList'/);
  assert.match(page, /filterStaffAccounts/);
  assert.match(page, /orgSummary\(account, organization\)/);
  assert.match(page, /id="staff-search"/);
  assert.match(page, /id="staff-filter-role"/);
  assert.match(page, /id="staff-filter-status"/);
  assert.match(page, /clearFilters/);
  assert.match(page, /t\.noResults/);
  assert.match(list, /effective_territory_ids/);
});

test('destructive row actions confirm through an in-page dialog that states the impact', () => {
  assert.match(page, /setConfirmAction\(\{ kind: 'deactivate', account \}\)/);
  assert.match(page, /setConfirmAction\(\{ kind: 'reset', account \}\)/);
  assert.match(page, /deactivationImpact\(confirmAction\.account, staff\)/);
  assert.match(page, /role="dialog" aria-modal="true" aria-label=\{t\.confirmTitle\}/);
  assert.match(page, /t\.confirmDeactivateReports\(impact\.reports\)/);
  assert.match(page, /startsWith\('deactivate:'\)/);
  assert.doesNotMatch(page, /window\.confirm/, 'the staff page states the real impact instead of a generic confirm');
  assert.match(list, /export function deactivationImpact/);
});

test('deactivation is reversible and the dialog says the relations are kept', () => {
  assert.match(page, /setConfirmAction\(\{ kind: 'reactivate', account \}\)/);
  assert.match(page, /reactivateAdminStaffAccount/);
  assert.match(page, /confirmDeactivateKeeps/);
  assert.match(page, /confirmReactivateTitle/);
  assert.match(api, /\/api\/admin\/staff\/\$\{staffId\}\/reactivate/);
  assert.match(page, /pending\.startsWith\('deactivate:'\)/);
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
