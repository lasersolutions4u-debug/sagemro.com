import { expect } from '@playwright/test';

import { activationTokenFromMessage, getActivationEmail } from './api.mjs';
import { e2eRuntime } from './runtime.mjs';
import { localD1Rows, sqlText } from './visual.mjs';

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
  await page.getByPlaceholder('Password').fill(runtime.adminPassword);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Engineer Applications', exact: true })).toBeVisible();
}

export async function onboardEngineer({ browser, runtime = e2eRuntime() }) {
  const engineer = {
    ...uniqueIdentity('Engineer'),
    password: runtime.engineerPassword,
  };
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(runtime.engineerBase);
  await page.getByRole('button', { name: 'Submit Service Interest', exact: true }).first().click();
  await page.getByLabel('Name').fill(engineer.name);
  await page.getByLabel('Phone').fill(engineer.phone);
  await page.getByLabel('Email').fill(engineer.email);
  await page.getByLabel('Country').fill('United States');
  await page.getByLabel('Base city').fill('Chicago');
  await page.getByRole('button', { name: 'North America', exact: true }).click();
  await page.getByLabel('Equipment specialties').locator('xpath=../../..').getByRole('button', { name: 'Laser cutting machine', exact: true }).click();
  await page.getByLabel('Service items').locator('xpath=../../..').getByRole('button', { name: 'Maintenance', exact: true }).click();
  await page.getByLabel('Field service experience').fill('E2E field service and maintenance experience.');
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
  await expect(dialog.locator('span').filter({ hasText: /^Approved$/ })).toBeVisible();
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

export async function submitCustomerServiceRequest({ page, customer, description }) {
  const requestServiceButton = page.getByRole('button', { name: 'Request Service', exact: true });
  await expect(requestServiceButton).toBeVisible();
  await requestServiceButton.click();

  await page.getByText('Repair & diagnostics', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  const equipmentType = page.getByPlaceholder('Select or enter the equipment type…');
  await equipmentType.fill('Laser cutting machine');
  await equipmentType.press('Enter');
  await page.getByPlaceholder('e.g. C3015 3000W, TruLaser 3030, BM111').fill('E2E-LASER-3015');
  await page.getByLabel('Problem or service request · Required').fill(
    description || `E2E lifecycle ${customer.runId}: replacement parts required.`,
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  const region = page.getByPlaceholder('Enter country, state / province or city, then press Enter…');
  await region.fill('United States');
  await region.press('Enter');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByLabel('Contact name · Required').fill(customer.name);
  await page.getByLabel('Email · Optional').fill(customer.email);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Send service request', exact: true }).click();

  const serviceNo = page.getByText(/^Service No\.:/);
  await expect(serviceNo).toBeVisible();
  const orderNo = (await serviceNo.textContent()).replace('Service No.:', '').trim();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  return orderNo;
}

export async function createCustomerWorkOrder({ browser, runtime = e2eRuntime(), description }) {
  const customer = {
    ...uniqueIdentity('Customer'),
    password: runtime.customerPassword,
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

  const orderNo = await submitCustomerServiceRequest({ page, customer, description });
  return { customer, context, page, orderNo };
}

export async function dispatchWorkOrder({ page, orderNo, engineer }) {
  await page.getByRole('button', { name: 'Service Orders', exact: true }).click();
  const row = page.locator('tr').filter({ hasText: orderNo });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'View', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Service Control View' });
  const toggle = dialog.locator('button[aria-controls="work-order-section-dispatch-content"]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const engineerOption = dialog.getByLabel('Select engineer').locator('option').filter({ hasText: engineer.name });
  await dialog.getByLabel('Select engineer').selectOption(await engineerOption.getAttribute('value'));
  await dialog.getByRole('button', { name: 'Direct dispatch', exact: true }).click();
  await expect(page.getByText(`Dispatched: ${orderNo}`, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}

export async function businessScope(page, staffId = 'admin', runtime = e2eRuntime()) {
  const org = await adminApi(page, runtime, `/api/admin/business/organization?expected_staff_id=${encodeURIComponent(staffId)}`);
  return { expected_staff_id: staffId, scope_version: org.scope_version };
}

export async function createBusinessOrderSession({ browser, adminPage, orderNo, runtime = e2eRuntime() }) {
  const [order] = localD1Rows(`SELECT id, short_title FROM work_orders WHERE order_no = ${sqlText(orderNo)}`);
  expect(order).toBeTruthy();
  const identity = uniqueIdentity('Business');
  const territoryName = `E2E territory ${identity.runId}`;
  await adminApi(adminPage, runtime, '/api/admin/business/territories', {
    method: 'POST', body: JSON.stringify({ ...await businessScope(adminPage), name: territoryName, market: 'com' }),
  });
  const org = await adminApi(adminPage, runtime, '/api/admin/business/organization?expected_staff_id=admin');
  const territory = org.territories.find(item => item.name === territoryName);
  expect(territory).toBeTruthy();
  const account = await adminApi(adminPage, runtime, '/api/admin/staff', {
    method: 'POST', body: JSON.stringify({ expected_staff_id: 'admin', scope_version: org.scope_version,
      login: identity.email, display_name: identity.name, role: 'business_director', market_scope: 'com',
      grade: 1, territory_ids: [territory.id] }),
  });
  await adminApi(adminPage, runtime, `/api/admin/business/records/work_order/${order.id}/assignment`, {
    method: 'PUT', body: JSON.stringify({ ...await businessScope(adminPage), revision: 0, territory_id: territory.id, owner_staff_id: account.staff.id }),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(runtime.adminBase);
  await page.getByPlaceholder('Phone number or login name').fill(identity.email);
  await page.getByPlaceholder('Password').fill(account.temporary_password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByLabel('Current temporary password').fill(account.temporary_password);
  await page.getByLabel('New password (10+ characters)', { exact: true }).fill(runtime.customerPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(runtime.customerPassword);
  await page.getByRole('button', { name: 'Change password and continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All leads', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Business workspace', exact: true })).toHaveCount(0);
  const open = async () => {
    await page.reload();
    await page.getByRole('navigation').getByRole('button', { name: 'Service Orders', exact: true }).click();
    await page.locator('tr').filter({ hasText: order.short_title || orderNo }).getByRole('button', { name: 'View details', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(orderNo);
    return dialog;
  };
  return { context, page, open, workOrderId: order.id };
}

export async function acceptBusinessQuote(customerPage, orderNo) {
  await customerPage.reload();
  await customerPage.getByRole('button', { name: 'My Services', exact: true }).click();
  await customerPage.getByText(orderNo, { exact: true }).click();
  await customerPage.getByRole('tab', { name: 'Confirm Quote', exact: true }).click();
  await customerPage.getByTestId('open-confirm-pricing-button').click();
  await customerPage.getByTestId('confirm-pricing-button').click();
  await expect(customerPage.getByRole('heading', { name: 'Collection workspace', exact: true })).toBeVisible();
}

export async function verifyFirstBusinessReceipt({ business, adminPage, orderNo, amount = 900 }) {
  const dialog = await business.open();
  const installment = dialog.getByRole('region', { name: 'Business payments', exact: true }).locator('article').filter({
    has: business.page.getByRole('heading', { name: /^Installment 1 ·/ }),
  });
  await installment.getByRole('button', { name: 'Start installment collection', exact: true }).click();
  await expect(dialog.getByText('Collection opened', { exact: true })).toBeVisible();
  await installment.getByLabel('Receipt amount to verify', { exact: true }).fill(String(amount));
  await installment.getByLabel('Transaction reference', { exact: true }).fill(`E2E-${orderNo}`);
  await installment.getByLabel('Internal receipt note', { exact: true }).fill('Fictional local receipt');
  await installment.getByRole('button', { name: 'Submit receipt for review', exact: true }).click();
  await expect(dialog.getByText('Receipt submitted; the amount is not counted as received until Admin verifies it.', { exact: true })).toBeVisible();
  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  await adminPage.locator('tr').filter({ hasText: orderNo }).getByRole('button', { name: 'View', exact: true }).click();
  const review = adminPage.getByRole('dialog', { name: 'Service Control View' });
  await review.getByRole('button', { name: 'Confirm full receipt', exact: true }).click();
  const confirmation = adminPage.getByRole('dialog', { name: 'Confirm full receipt' });
  await confirmation.getByLabel('Decision note (optional)').fill('Fictional receipt verified');
  await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(review.getByText('No receipt claims are waiting for review.', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Close', exact: true }).click();
}

export async function preparePaidBusinessOrder({ browser, adminPage, customerPage, orderNo, runtime = e2eRuntime() }) {
  const business = await createBusinessOrderSession({ browser, adminPage, orderNo, runtime });
  try {
    const dialog = await business.open();
    for (const [label, value] of [
      ['Customer labor fee', '900'], ['Customer parts fee', '0'], ['Customer travel fee', '0'], ['Customer other fee', '0'],
      ['Parts procurement cost', '0'], ['Engineer labor cost', '400'], ['Travel cost', '0'], ['Other direct cost', '0'],
    ]) await dialog.getByLabel(label, { exact: true }).fill(value);
    const days = dialog.getByLabel('Expected onsite days', { exact: true });
    if (await days.count()) await days.fill('2');
    await dialog.getByRole('button', { name: 'Save quote draft', exact: true }).click();
    await expect(dialog.getByText('Draft saved', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Submit for Admin review', exact: true }).click();
    await expect(dialog.getByText('Awaiting Admin review', { exact: true })).toBeVisible();
    await adminApi(adminPage, runtime, `/api/admin/workorders/${business.workOrderId}/pricing/approve`, {
      method: 'PATCH', body: JSON.stringify({ ...await businessScope(adminPage), quote_version: 1, note: 'Fictional local quote approval' }),
    });
    await acceptBusinessQuote(customerPage, orderNo);
    await verifyFirstBusinessReceipt({ business, adminPage, orderNo });
    return business.workOrderId;
  } finally {
    await business.context.close();
  }
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
