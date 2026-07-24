import { expect, test } from '@playwright/test';

import { adminApi, loginAdmin, onboardEngineer, uniqueIdentity } from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';

const runtime = e2eRuntime();

async function confirmFeedback(page) {
  const confirm = page.getByRole('button', { name: /^(Confirm|OK)$/ });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

test('customer, Admin, and engineer complete a service order lifecycle', async ({ browser }) => {
  test.setTimeout(300_000);
  const { engineer, context: engineerContext, page: engineerPage } = await onboardEngineer({ browser, runtime });

  const customer = {
    ...uniqueIdentity('Customer'),
    password: 'LocalCustomerPassword123!',
  };
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto(runtime.customerBase);
  await customerPage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await customerPage.getByRole('button', { name: 'Register', exact: true }).click();
  await customerPage.getByPlaceholder('e.g., ABC Metal Products Co., Ltd.').fill(`E2E Metal ${customer.runId}`);
  await customerPage.getByPlaceholder('Enter your name').fill(customer.name);
  await customerPage.getByPlaceholder('Set a password (min. 10 characters)').fill(customer.password);
  await customerPage.getByPlaceholder('Re-enter your password').fill(customer.password);
  await customerPage.getByPlaceholder('Enter your phone number').fill(customer.phone);
  await customerPage.getByPlaceholder('Enter your email address').fill(customer.email);
  await customerPage.getByPlaceholder('Enter verification code').fill('246810');
  await customerPage.getByRole('checkbox').check();
  await customerPage.getByRole('button', { name: 'Create account', exact: true }).click();
  const requestServiceButton = customerPage.getByRole('button', { name: 'Request Service', exact: true });
  await expect(requestServiceButton).toBeVisible();

  await requestServiceButton.click();
  await customerPage.getByLabel('Request Type').selectOption('fault');
  await customerPage.getByLabel('Equipment Model / Part No.').fill('E2E-LASER-3015');
  await customerPage.getByLabel('Request Details').fill(`E2E lifecycle ${customer.runId}: laser power drops during production.`);
  await customerPage.getByLabel('Contact Method').fill(customer.email);
  await customerPage.getByTestId('submit-work-order-button').click();
  const serviceNo = customerPage.getByText(/^Service No\.:/);
  await expect(serviceNo).toBeVisible();
  const orderNo = (await serviceNo.textContent()).replace('Service No.:', '').trim();
  const workOrderId = await customerPage.evaluate(async ({ apiBase, targetOrderNo }) => {
    const token = localStorage.getItem('sagemro_token');
    const response = await fetch(`${apiBase}/api/workorders`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json();
    return data.work_orders.find((workOrder) => workOrder.order_no === targetOrderNo)?.id || '';
  }, { apiBase: runtime.apiBase, targetOrderNo: orderNo });
  expect(workOrderId).not.toBe('');
  await customerPage.getByRole('button', { name: 'Got it', exact: true }).click();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAdmin(adminPage, runtime);
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  const adminRow = adminPage.locator('tr').filter({ hasText: orderNo });
  await expect(adminRow).toBeVisible();
  await adminRow.getByRole('button', { name: 'View', exact: true }).click();
  const dispatchDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
  const engineerOption = dispatchDialog.locator('select').last().locator('option').filter({ hasText: engineer.name });
  await dispatchDialog.getByLabel('Select engineer').selectOption(await engineerOption.getAttribute('value'));
  await dispatchDialog.getByRole('button', { name: 'Direct dispatch', exact: true }).click();
  await expect(adminPage.getByText(`Dispatched: ${orderNo}`, { exact: true })).toBeVisible();
  await dispatchDialog.getByRole('button', { name: 'Close', exact: true }).click();

  await engineerPage.reload();
  const engineerTask = engineerPage.locator('article').filter({ hasText: orderNo });
  await expect(engineerTask).toBeVisible();
  await engineerTask.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
  await engineerTask.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await engineerPage.getByRole('tab', { name: 'Submit Quote', exact: true }).click();
  await engineerPage.getByLabel('Labor Fee').fill('800');
  await engineerPage.getByLabel('Travel Fee').fill('100');
  await engineerPage.getByTestId('submit-pricing-button').click();

  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  const quoteRow = adminPage.locator('tr').filter({ hasText: orderNo });
  await quoteRow.getByRole('button', { name: 'View', exact: true }).click();
  const approval = await adminApi(adminPage, runtime, `/api/admin/workorders/${workOrderId}/pricing/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ quote_version: 1, note: 'E2E lifecycle quote approved' }),
  });
  expect(approval.success).toBe(true);
  await adminPage.getByRole('button', { name: 'Close', exact: true }).click();

  await customerPage.getByRole('button', { name: 'My Services', exact: true }).click();
  await customerPage.getByText(orderNo, { exact: true }).click();
  await customerPage.getByRole('tab', { name: 'Confirm Quote', exact: true }).click();
  await expect(customerPage.getByTestId('open-confirm-pricing-button')).toBeVisible();
  await customerPage.getByTestId('open-confirm-pricing-button').click();
  await expect(customerPage.getByTestId('confirm-pricing-button')).toBeVisible();
  await customerPage.getByTestId('confirm-pricing-button').click();
  await expect(customerPage.getByRole('heading', { name: 'Collection workspace', exact: true })).toBeVisible();

  await engineerPage.reload();
  const collectionTask = engineerPage.locator('article').filter({ hasText: orderNo });
  await collectionTask.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await engineerPage.getByRole('tab', { name: 'Payments & receipts', exact: true }).click();
  const engineerInstallment = engineerPage.locator('article').filter({
    has: engineerPage.getByRole('heading', { name: 'Installment 1', exact: true }),
  });
  await engineerInstallment.getByRole('button', { name: 'Start this installment collection', exact: true }).click();
  await expect(engineerInstallment.getByRole('heading', { name: 'Request receipt confirmation', exact: true })).toBeVisible();

  await customerPage.reload();
  await customerPage.getByRole('button', { name: 'My Services', exact: true }).click();
  await customerPage.getByText(orderNo, { exact: true }).click();
  await customerPage.getByRole('tab', { name: 'Payments & receipts', exact: true }).click();
  const customerInstallment = customerPage.locator('article').filter({
    has: customerPage.getByRole('heading', { name: 'Installment 1', exact: true }),
  });
  await customerInstallment.getByRole('button', { name: 'Choose payment method', exact: true }).click();
  await expect(customerPage.getByRole('heading', { name: 'Confirm Installment Payment Method', exact: true })).toBeVisible();
  await customerPage.getByRole('button', { name: 'Request Installment TT Instructions', exact: true }).click();
  await expect(customerPage.getByRole('heading', { name: 'Payment method received', exact: true })).toBeVisible();
  await customerPage.getByRole('button', { name: 'Go to Messages', exact: true }).click();

  await engineerPage.reload();
  const receiptTask = engineerPage.locator('article').filter({ hasText: orderNo });
  await receiptTask.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await engineerPage.getByRole('tab', { name: 'Payments & receipts', exact: true }).click();
  const receiptInstallment = engineerPage.locator('article').filter({
    has: engineerPage.getByRole('heading', { name: 'Installment 1', exact: true }),
  });
  await receiptInstallment.getByLabel('Claimed amount').fill('900');
  await receiptInstallment.getByLabel('Transaction reference (optional)').fill(`E2E-ADV-${customer.runId}`);
  await receiptInstallment.getByRole('button', { name: 'Request receipt confirmation', exact: true }).click();
  await expect(receiptInstallment.getByText('Waiting for Admin confirmation', { exact: true })).toBeVisible();

  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  await adminPage.locator('tr').filter({ hasText: orderNo }).getByRole('button', { name: 'View', exact: true }).click();
  const receiptDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
  await expect(receiptDialog.getByRole('heading', { name: 'Pending receipt review', exact: true })).toBeVisible();
  await receiptDialog.getByRole('button', { name: 'Confirm full receipt', exact: true }).click();
  const fullReceiptDialog = adminPage.getByRole('dialog', { name: 'Confirm full receipt' });
  await fullReceiptDialog.getByLabel('Decision note (optional)').fill('E2E advance receipt confirmed');
  await fullReceiptDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(receiptDialog.getByText('No receipt claims are waiting for review.', { exact: true })).toBeVisible();
  await receiptDialog.getByRole('button', { name: 'Close', exact: true }).click();

  await engineerPage.reload();
  const paymentTask = engineerPage.locator('article').filter({ hasText: orderNo });
  await paymentTask.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await engineerPage.getByRole('button', { name: 'Request Admin Approval to Start', exact: true }).click();
  await confirmFeedback(engineerPage);

  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  await adminPage.locator('tr').filter({ hasText: orderNo }).getByRole('button', { name: 'View', exact: true }).click();
  const paymentDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
  await paymentDialog.getByRole('button', { name: 'Confirm payment & start', exact: true }).click();
  const paymentConfirmationDialog = adminPage.getByRole('dialog', { name: 'Confirm payment and start service' });
  await paymentConfirmationDialog.getByLabel('Payment confirmation note (optional)').fill('E2E advance payment confirmed');
  await paymentConfirmationDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await paymentDialog.getByRole('button', { name: 'Close', exact: true }).click();

  await engineerPage.reload();
  const serviceTask = engineerPage.locator('article').filter({ hasText: orderNo });
  await serviceTask.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await engineerPage.getByRole('tab', { name: 'Service Report', exact: true }).click();
  await engineerPage.getByLabel('Customer Symptom').fill('Laser power dropped during continuous cutting.');
  await engineerPage.getByLabel('Root Cause / Diagnosis').fill('Protective lens contamination reduced delivered power.');
  await engineerPage.getByLabel('Service Actions / Next Advice').fill('Cleaned optical path and replaced the protective lens.');
  await engineerPage.getByRole('button', { name: 'Save Service Report', exact: true }).click();
  await expect(engineerPage.getByRole('button', { name: 'Edit service report', exact: true })).toBeVisible();
  await engineerPage.getByRole('button', { name: 'Submit Final Report to Customer', exact: true }).click();
  await confirmFeedback(engineerPage);

  await customerPage.reload();
  await customerPage.getByRole('button', { name: 'My Services', exact: true }).click();
  await customerPage.getByText(orderNo, { exact: true }).click();
  await expect(customerPage.getByRole('heading', { name: 'Service Review', exact: true })).toBeVisible();
  await customerPage.getByPlaceholder('Share your service experience (optional)...').fill('E2E service completed successfully.');
  await customerPage.getByTestId('submit-rating-button').click();
  await expect(customerPage.getByRole('heading', { name: 'Your Review', exact: true })).toBeVisible();

  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  const archiveRow = adminPage.locator('tr').filter({ hasText: orderNo });
  await archiveRow.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(adminPage.getByText(`Archived: ${orderNo}`, { exact: true })).toBeVisible();
  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  await adminPage.locator('tr').filter({ hasText: orderNo }).getByRole('button', { name: 'View', exact: true }).click();
  await adminPage.getByRole('button', { name: 'Mark payout completed', exact: true }).click();
  const payoutDialog = adminPage.getByRole('dialog', { name: 'Update engineer service payment' });
  await payoutDialog.getByLabel('Payment amount in USD (optional)').fill('720');
  await payoutDialog.getByLabel('Payment reference / transaction ID (optional)').fill(`E2E-${customer.runId}`);
  await payoutDialog.getByLabel('Internal payout note (optional)').fill('Lifecycle payout verification');
  await payoutDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(adminPage.getByText('Engineer service payment updated: Completed', { exact: true })).toBeVisible();
  await expect(adminPage.getByText('Status: Completed', { exact: true })).toBeVisible();

  await adminContext.close();
  await customerContext.close();
  await engineerContext.close();
});
