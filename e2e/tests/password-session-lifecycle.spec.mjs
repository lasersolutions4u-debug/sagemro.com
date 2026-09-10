import { expect, test } from '@playwright/test';
import {
  adminApi, createBusinessOrderSession, createCustomerWorkOrder, loginAdmin, onboardEngineer,
} from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';

const runtime = e2eRuntime();
test.setTimeout(180_000);

async function session(page) {
  return page.evaluate(async apiBase => {
    const response = await fetch(`${apiBase}/api/auth/session`, { credentials: 'include' });
    const data = await response.json();
    return { status: response.status, authenticated: data.authenticated, user: data.user };
  }, runtime.apiBase);
}

async function assertRevoked(page) {
  expect((await session(page)).authenticated).toBe(false);
  const status = await page.evaluate(async apiBase => (
    await fetch(`${apiBase}/api/conversations`, { credentials: 'include' })
  ).status, runtime.apiBase);
  expect(status).toBe(401);
}

async function portalLogin(page, base, identity, password) {
  await page.goto(base);
  await page.getByRole('button', {
    name: base === runtime.engineerBase ? 'I already have an engineer account' : 'Sign In', exact: true,
  }).click();
  await page.getByPlaceholder('Email or phone number').fill(identity.email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByTestId('login-submit-button').click();
  await expect.poll(async () => (await session(page)).authenticated).toBe(true);
  await expect(page.getByTestId('login-submit-button')).toHaveCount(0);
}

async function staffLogin(page, login, password) {
  await page.goto(runtime.adminBase);
  await page.getByPlaceholder('Phone number or login name').fill(login);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect.poll(async () => (await session(page)).authenticated).toBe(true);
}

async function recovery(page, base, identity, newPassword) {
  await page.goto(base);
  await page.getByRole('button', {
    name: base === runtime.engineerBase ? 'I already have an engineer account' : 'Sign In', exact: true,
  }).click();
  await page.getByRole('button', { name: 'Forgot password', exact: true }).click();
  await page.getByPlaceholder('Enter your registered email address').fill(identity.email);
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await page.getByPlaceholder('Enter verification code').fill('246810');
  await page.getByPlaceholder('Set new password (min. 10 characters)').fill(newPassword);
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click();
  await expect(page.getByText('Password reset successfully. Please sign in with your new password.', { exact: true })).toBeVisible();
  expect((await session(page)).authenticated).toBe(false);
}

async function changeViaBrowserModule(page, oldPassword, newPassword) {
  const success = await page.evaluate(async credentials => {
    const api = await import('/src/services/api.js');
    const result = await api.changePassword(credentials);
    return result.success;
  }, { oldPassword, newPassword });
  expect(success).toBe(true);
}

test('customer security form renews current cookies, revokes another browser, and recovery requires login', async ({ browser }) => {
  const { customer, context, page, orderNo } = await createCustomerWorkOrder({ browser, runtime });
  const oldContext = await browser.newContext();
  const recoveryContext = await browser.newContext();
  try {
    const oldPage = await oldContext.newPage();
    await portalLogin(oldPage, runtime.customerBase, customer, customer.password);
    const changedPassword = `${customer.password}-changed`;
    await page.getByTestId('user-avatar-button').filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Security', exact: true }).click();
    await page.getByPlaceholder('Enter your current password').fill(customer.password);
    await page.getByPlaceholder('At least 10 characters', { exact: true }).fill(changedPassword);
    await page.getByPlaceholder('Re-enter your new password').fill(changedPassword);
    await page.getByRole('button', { name: 'Change Password', exact: true }).click();
    await expect(page.getByText('Password changed successfully', { exact: true })).toBeVisible();
    expect((await session(page)).authenticated).toBe(true);
    await assertRevoked(oldPage);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'My Services', exact: true }).click();
    await expect(page.getByText(orderNo, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sagemro_token'))).toBeNull();
    const cookies = await context.cookies(runtime.apiBase);
    expect(cookies.some(cookie => cookie.httpOnly && cookie.name.includes('customer'))).toBe(true);
    const recoveryPage = await recoveryContext.newPage();
    const recoveredPassword = `${customer.password}-recovered`;
    await recovery(recoveryPage, runtime.customerBase, customer, recoveredPassword);
    await assertRevoked(page);
    await assertRevoked(oldPage);
    await portalLogin(recoveryPage, runtime.customerBase, customer, recoveredPassword);
    await recoveryPage.getByRole('button', { name: 'My Services', exact: true }).click();
    await expect(recoveryPage.getByText(orderNo, { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await oldContext.close();
    await recoveryContext.close();
  }
});

test('engineer real-browser module change and recovery revoke other sessions', async ({ browser }) => {
  const { engineer, context, page } = await onboardEngineer({ browser, runtime });
  const oldContext = await browser.newContext();
  const recoveryContext = await browser.newContext();
  try {
    const oldPage = await oldContext.newPage();
    await portalLogin(oldPage, runtime.engineerBase, engineer, engineer.password);
    const changedPassword = `${engineer.password}-changed`;
    await changeViaBrowserModule(page, engineer.password, changedPassword);
    expect((await session(page)).authenticated).toBe(true);
    await assertRevoked(oldPage);
    await changeViaBrowserModule(page, changedPassword, `${changedPassword}-again`);
    await page.reload();
    await expect(page.getByText('Engineer Workspace', { exact: true }).first()).toBeVisible();
    const recoveryPage = await recoveryContext.newPage();
    const recoveredPassword = `${engineer.password}-recovered`;
    await recovery(recoveryPage, runtime.engineerBase, engineer, recoveredPassword);
    await assertRevoked(page);
    await assertRevoked(oldPage);
    await portalLogin(recoveryPage, runtime.engineerBase, engineer, recoveredPassword);
    await expect(recoveryPage.getByText('Engineer Workspace', { exact: true }).first()).toBeVisible();
  } finally {
    await context.close();
    await oldContext.close();
    await recoveryContext.close();
  }
});

test('staff mandatory change, Admin reset, and renewed session preserve authorized order access', async ({ browser }) => {
  const customer = await createCustomerWorkOrder({ browser, runtime });
  const rootContext = await browser.newContext();
  const oldContext = await browser.newContext();
  const resetContext = await browser.newContext();
  let business;
  try {
    const rootPage = await rootContext.newPage();
    await loginAdmin(rootPage, runtime);
    business = await createBusinessOrderSession({ browser, adminPage: rootPage, orderNo: customer.orderNo, runtime });
    const identity = (await session(business.page)).user;
    const accounts = await adminApi(rootPage, runtime, '/api/admin/staff');
    const staff = accounts.staff.find(item => item.id === identity.staffId);
    expect(staff).toBeTruthy();
    const oldPage = await oldContext.newPage();
    await staffLogin(oldPage, staff.normalized_login, runtime.customerPassword);
    await expect(oldPage.getByRole('heading', { name: 'All leads', exact: true })).toBeVisible();
    const reset = await adminApi(rootPage, runtime, `/api/admin/staff/${identity.staffId}/reset-password`, { method: 'POST' });
    await assertRevoked(business.page);
    await assertRevoked(oldPage);
    await staffLogin(oldPage, staff.normalized_login, reset.temporary_password);
    await expect(oldPage.getByLabel('Current temporary password')).toBeVisible();
    const resetPage = await resetContext.newPage();
    await staffLogin(resetPage, staff.normalized_login, reset.temporary_password);
    await expect(resetPage.getByLabel('Current temporary password')).toBeVisible();
    await resetPage.getByLabel('Current temporary password').fill(reset.temporary_password);
    await resetPage.getByLabel('New password (10+ characters)', { exact: true }).fill(`${runtime.customerPassword}-reset`);
    await resetPage.getByLabel('Confirm new password', { exact: true }).fill(`${runtime.customerPassword}-reset`);
    await resetPage.getByRole('button', { name: 'Change password and continue', exact: true }).click();
    await expect(resetPage.getByRole('heading', { name: 'All leads', exact: true })).toBeVisible();
    expect((await session(resetPage)).user.mustChangePassword).toBe(false);
    await resetPage.reload();
    await resetPage.getByRole('navigation').getByRole('button', { name: 'Service Orders', exact: true }).click();
    await resetPage.getByRole('button', { name: 'View details', exact: true }).click();
    await expect(resetPage.getByRole('dialog')).toContainText(customer.orderNo);
    await assertRevoked(oldPage);
  } finally {
    await business?.context.close();
    await customer.context.close();
    await rootContext.close();
    await oldContext.close();
    await resetContext.close();
  }
});
