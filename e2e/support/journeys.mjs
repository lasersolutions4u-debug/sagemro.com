import { expect } from '@playwright/test';

import { activationTokenFromMessage, getActivationEmail } from './api.mjs';
import { e2eRuntime } from './runtime.mjs';

export function uniqueIdentity(prefix) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    runId,
    name: `E2E ${prefix} ${runId}`,
    phone: `+1555${runId.replace(/\D/g, '').slice(-7).padStart(7, '0')}`,
    email: `e2e-${prefix.toLowerCase()}-${runId}@example.test`,
  };
}

export async function loginAdmin(page, runtime = e2eRuntime()) {
  await page.goto(runtime.adminBase);
  await page.getByPlaceholder('Phone number or login name').fill('19900000001');
  await page.getByPlaceholder('Password').fill('LocalAdminPassword123!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Engineer Applications', exact: true })).toBeVisible();
}

export async function onboardEngineer({ browser, runtime = e2eRuntime() }) {
  const engineer = {
    ...uniqueIdentity('Engineer'),
    password: 'LocalEngineerPassword123!',
  };
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(runtime.engineerBase);
  await page.getByRole('button', { name: 'Apply to Join', exact: true }).first().click();
  await page.getByLabel('Name').fill(engineer.name);
  await page.getByLabel('Phone').fill(engineer.phone);
  await page.getByLabel('Email').fill(engineer.email);
  await page.getByLabel('Country').fill('United States');
  await page.getByLabel('Base city').fill('Chicago');
  await page.getByRole('button', { name: 'North America', exact: true }).click();
  await page.getByRole('button', { name: 'Laser cutting machine', exact: true }).click();
  await page.getByRole('button', { name: 'Maintenance', exact: true }).click();
  await page.getByLabel('Individual / team capability').fill('E2E field service and maintenance experience.');
  await page.getByRole('button', { name: 'Submit Application', exact: true }).click();
  await expect(page.getByText('Application received.', { exact: false })).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAdmin(adminPage, runtime);
  await adminPage.getByRole('button', { name: 'Engineer Applications', exact: true }).click();
  const row = adminPage.getByTestId('application-row').filter({ hasText: engineer.email });
  await expect(row).toBeVisible();
  await row.click();
  const dialog = adminPage.getByRole('dialog', { name: engineer.name });
  await dialog.locator('select').first().selectOption('qualified');
  await dialog.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect(dialog.getByText('Approved', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Open engineer account', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm and send activation email', exact: true }).click();
  await expect(dialog.getByText('Awaiting activation', { exact: true }).first()).toBeVisible();

  const activationToken = activationTokenFromMessage(await getActivationEmail(engineer.email));
  await page.goto(`${runtime.engineerBase}/activate#token=${activationToken}`);
  await page.getByLabel('Set password').fill(engineer.password);
  await page.getByLabel('Confirm password').fill(engineer.password);
  await page.getByRole('button', { name: 'Activate account', exact: true }).click();
  await expect(page.getByText('Account activated', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in to Engineer Workspace', exact: true }).click();
  await page.getByPlaceholder('Email or phone number').fill(engineer.email);
  await page.getByPlaceholder('Enter your password').fill(engineer.password);
  await page.getByTestId('login-submit-button').click();
  await expect(page.getByText('Engineer Workspace', { exact: true }).first()).toBeVisible();

  await adminContext.close();
  return { engineer, context, page };
}

export async function createCustomerWorkOrder({ browser, runtime = e2eRuntime(), description }) {
  const customer = {
    ...uniqueIdentity('Customer'),
    password: 'LocalCustomerPassword123!',
  };
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(runtime.customerBase);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByPlaceholder('e.g., ABC Metal Products Co., Ltd.').fill(`E2E Metal ${customer.runId}`);
  await page.getByPlaceholder('Enter your name').fill(customer.name);
  await page.getByPlaceholder('Set a password (min. 10 characters)').fill(customer.password);
  await page.getByPlaceholder('Re-enter your password').fill(customer.password);
  await page.getByPlaceholder('Enter your phone number').fill(customer.phone);
  await page.getByPlaceholder('Enter your email address').fill(customer.email);
  await page.getByPlaceholder('Enter verification code').fill('246810');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  const requestServiceButton = page.getByRole('button', { name: 'Request Service', exact: true });
  await expect(requestServiceButton).toBeVisible();
  await requestServiceButton.click();
  await page.getByLabel('Request Type').selectOption('fault');
  await page.getByLabel('Equipment Model / Part No.').fill('E2E-LASER-3015');
  await page.getByLabel('Request Details').fill(description || `E2E lifecycle ${customer.runId}: replacement parts required.`);
  await page.getByLabel('Contact Method').fill(customer.email);
  await page.getByTestId('submit-work-order-button').click();

  const serviceNo = page.getByText(/^Service No\.:/);
  await expect(serviceNo).toBeVisible();
  const orderNo = (await serviceNo.textContent()).replace('Service No.:', '').trim();
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  return { customer, context, page, orderNo };
}

export async function dispatchWorkOrder({ page, orderNo, engineer }) {
  await page.getByRole('button', { name: 'Service Orders', exact: true }).click();
  const row = page.locator('tr').filter({ hasText: orderNo });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'View', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Service Control View' });
  const engineerOption = dialog.locator('select').last().locator('option').filter({ hasText: engineer.name });
  await dialog.getByLabel('Select engineer').selectOption(await engineerOption.getAttribute('value'));
  await dialog.getByRole('button', { name: 'Direct dispatch', exact: true }).click();
  await expect(page.getByText(`Dispatched: ${orderNo}`, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}

export async function adminApi(page, runtime, path, options = {}) {
  return page.evaluate(async ({ apiBase, requestPath, requestOptions }) => {
    const headers = new Headers(requestOptions.headers || {});
    headers.set('Content-Type', 'application/json');
    const csrfToken = localStorage.getItem('admin_csrf_token');
    if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes((requestOptions.method || 'GET').toUpperCase())) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    const response = await fetch(`${apiBase}${requestPath}`, {
      ...requestOptions,
      credentials: 'include',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }, { apiBase: runtime.apiBase, requestPath: path, requestOptions: options });
}
