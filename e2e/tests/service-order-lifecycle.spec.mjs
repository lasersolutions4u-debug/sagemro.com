import { expect, test } from '@playwright/test';

import { adminApi, loginAdmin, onboardEngineer, uniqueIdentity } from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';
import { captureBothViewports, localD1Rows, sqlText } from '../support/visual.mjs';

const runtime = e2eRuntime();

const START_GATE_BLOCKING_ITEMS = [
  'risk.hazards_reviewed',
  'risk.isolation_permission',
  'ready.tools_and_documents',
];

const ENGINEER_STANDARD_ITEMS = {
  'Task alignment': [
    'Confirm machine identity and configuration',
    'Align on the problem and service goal',
    'Confirm site contact and service window',
  ],
  'Risk control': [
    'Review site and machine hazards',
    'Confirm isolation and work permission',
  ],
  'One-visit readiness': [
    'Prepare tools and technical documents',
  ],
  'Evidence-led work': [
    'Record baseline evidence',
    'Record service actions as work proceeds',
    'Keep work within the authorized scope',
  ],
  'Recovery check': [
    'Complete the functional test',
    'Verify safety protections are restored',
    'Record residual risks and next steps',
  ],
};

const CUSTOMER_MILESTONE_STEPS = [
  { key: 'task_alignment', title: 'Task Alignment' },
  { key: 'risk_control', title: 'Risk Control' },
  { key: 'one_visit_readiness', title: 'One-Visit Readiness' },
  { key: 'evidence_execution', title: 'Evidence-Based Execution' },
  { key: 'recovery_verification', title: 'Recovery Verification' },
  { key: 'transparent_handover', title: 'Transparent Handover' },
];

const CUSTOMER_FORBIDDEN_DETAIL_FIELDS = [
  'blocking_items',
  'confirmed_by_id',
  'not_applicable_reason',
  'trigger_reason',
  'guidance_json',
  'review_json',
];

function persistedCustomerMilestones(workOrderId) {
  const rows = localD1Rows(`
    SELECT step_key, item_key, state, is_required, not_applicable_reason
    FROM work_order_service_standard_progress
    WHERE work_order_id = ${sqlText(workOrderId)} AND standard_version = 1
    ORDER BY step_key, item_key
  `);
  expect(rows).toHaveLength(18);
  const rowsByStep = new Map(CUSTOMER_MILESTONE_STEPS.map(({ key }) => [key, []]));
  for (const row of rows) rowsByStep.get(row.step_key)?.push(row);
  const stepComplete = CUSTOMER_MILESTONE_STEPS.map(({ key }) => {
    const stepRows = rowsByStep.get(key);
    const requiredRows = stepRows.filter((row) => Number(row.is_required) === 1);
    return requiredRows.every((row) => (
      row.state === 'confirmed'
      || (row.state === 'not_applicable' && String(row.not_applicable_reason || '').trim())
    ));
  });
  const firstIncomplete = stepComplete.findIndex((complete) => !complete);
  const currentIndex = firstIncomplete === -1 ? CUSTOMER_MILESTONE_STEPS.length - 1 : firstIncomplete;
  return CUSTOMER_MILESTONE_STEPS.map((step, index) => ({
    key: step.key,
    state: rowsByStep.get(step.key).some((row) => row.state === 'legacy_not_recorded')
      ? 'legacy_not_recorded'
      : stepComplete[index]
        ? 'completed'
        : index === currentIndex ? 'current' : 'upcoming',
  }));
}

function assertCustomerDetailSerialization(detail, expectedMilestones) {
  const serialized = JSON.stringify(detail);
  for (const field of CUSTOMER_FORBIDDEN_DETAIL_FIELDS) {
    expect(serialized).not.toContain(`"${field}"`);
  }
  expect(detail.public_service_milestones).toEqual(expectedMilestones);
  for (const milestone of detail.public_service_milestones) {
    expect(Object.keys(milestone).sort()).toEqual(['key', 'state']);
  }
}

async function openCustomerMilestonesFromD1(page, orderNo, workOrderId, { screenshot } = {}) {
  await page.reload();
  await page.getByRole('button', { name: 'My Services', exact: true }).click();
  const detailResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === `/api/workorders/${workOrderId}`
  ));
  await page.getByText(orderNo, { exact: true }).click();
  const detailResponse = await detailResponsePromise;
  expect(detailResponse.status()).toBe(200);

  const expectedMilestones = persistedCustomerMilestones(workOrderId);
  const detail = await detailResponse.json();
  assertCustomerDetailSerialization(detail, expectedMilestones);

  const milestoneSection = page.getByRole('heading', { name: 'Your service progress', exact: true })
    .locator('xpath=ancestor::section[1]');
  await expect(milestoneSection).toBeVisible();
  const stateLabels = {
    completed: 'Verified',
    current: 'Current stage',
    upcoming: 'Upcoming',
    legacy_not_recorded: 'Earlier service records were not itemized',
  };
  for (const step of CUSTOMER_MILESTONE_STEPS) {
    const persisted = expectedMilestones.find((milestone) => milestone.key === step.key);
    const item = milestoneSection.getByText(step.title, { exact: true }).locator('xpath=ancestor::li[1]');
    await expect(item).toContainText(stateLabels[persisted.state]);
    if (persisted.state === 'current') {
      await expect(item).toHaveAttribute('aria-current', 'step');
    } else {
      await expect(item).not.toHaveAttribute('aria-current', 'step');
    }
  }
  if (screenshot) {
    await captureBothViewports(page, screenshot, { scope: milestoneSection });
  }
  return { detail, expectedMilestones, milestoneSection };
}

async function closeCustomerWorkOrder(page) {
  const title = page.getByRole('heading', { name: 'Work Order Details', exact: true });
  const modal = title.locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
}

async function confirmFeedback(page) {
  const confirm = page.getByRole('button', { name: /^(Confirm|OK)$/ });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

async function confirmEngineerStandardItems(page, stageName) {
  const stage = page.getByRole('heading', { name: stageName, exact: true })
    .locator('xpath=ancestor::section[1]');
  await expect(stage).toBeVisible();
  for (const itemName of ENGINEER_STANDARD_ITEMS[stageName] || []) {
    const item = stage.getByRole('heading', { name: itemName, exact: true })
      .locator('xpath=ancestor::li[1]');
    await expect(item).toBeVisible();
    const confirm = item.getByRole('button', { name: 'Confirm complete', exact: true });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(confirm).toHaveCount(0);
  }
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
  const engineerTask = engineerPage.getByRole('button').filter({ hasText: orderNo });
  await expect(engineerTask).toBeVisible();
  await engineerTask.click();
  await expect(engineerPage).toHaveURL(new RegExp(`/work-orders/${workOrderId}$`));
  await engineerPage.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
  await engineerPage.reload();
  await expect(engineerPage.getByText(`Work order · ${orderNo}`, { exact: true })).toBeVisible();
  await confirmEngineerStandardItems(engineerPage, 'Task alignment');
  let customerMilestones = await openCustomerMilestonesFromD1(
    customerPage,
    orderNo,
    workOrderId,
  );
  expect(customerMilestones.expectedMilestones.map(({ state }) => state)).toEqual([
    'completed',
    'current',
    'upcoming',
    'upcoming',
    'upcoming',
    'upcoming',
  ]);
  await closeCustomerWorkOrder(customerPage);

  await engineerPage.getByRole('tab', { name: 'Messages', exact: true }).click();
  const manualMessage = `E2E manual update ${customer.runId}`;
  const messageCountBefore = localD1Rows(`SELECT COUNT(*) AS count FROM work_order_messages WHERE work_order_id = ${sqlText(workOrderId)}`)[0].count;
  await engineerPage.getByPlaceholder('Type a message...').fill(manualMessage);
  await engineerPage.getByPlaceholder('Type a message...').press('Enter');
  await expect(engineerPage.getByText(manualMessage, { exact: true })).toBeVisible();
  expect(localD1Rows(`SELECT COUNT(*) AS count FROM work_order_messages WHERE work_order_id = ${sqlText(workOrderId)}`)[0].count).toBe(messageCountBefore + 1);
  await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
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

  await expect(customerPage.getByText(orderNo, { exact: true })).toBeVisible();
  await customerPage.getByText(orderNo, { exact: true }).click();
  await customerPage.getByRole('tab', { name: 'Confirm Quote', exact: true }).click();
  await expect(customerPage.getByTestId('open-confirm-pricing-button')).toBeVisible();
  await customerPage.getByTestId('open-confirm-pricing-button').click();
  await expect(customerPage.getByTestId('confirm-pricing-button')).toBeVisible();
  await customerPage.getByTestId('confirm-pricing-button').click();
  await expect(customerPage.getByRole('heading', { name: 'Collection workspace', exact: true })).toBeVisible();

  await engineerPage.reload();
  await expect(engineerPage).toHaveURL(new RegExp(`/work-orders/${workOrderId}$`));
  await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
  await engineerPage.getByRole('button', { name: 'Payments & receipts', exact: true }).click();
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
  await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
  await engineerPage.getByRole('button', { name: 'Payments & receipts', exact: true }).click();
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
  const requestStartApproval = engineerPage.getByRole('button', { name: 'Request Start Approval', exact: true });
  await engineerPage.getByRole('tab', { name: 'Messages', exact: true }).click();
  await expect(requestStartApproval).toHaveCount(0);
  await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
  await expect(requestStartApproval).toHaveCount(0);
  await engineerPage.getByRole('tab', { name: 'Overview', exact: true }).click();
  await requestStartApproval.click();
  await confirmFeedback(engineerPage);

  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  await adminPage.locator('tr').filter({ hasText: orderNo }).getByRole('button', { name: 'View', exact: true }).click();
  const paymentDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
  await paymentDialog.getByRole('button', { name: 'Confirm payment & start', exact: true }).click();
  const paymentConfirmationDialog = adminPage.getByRole('dialog', { name: 'Confirm payment and start service' });
  await paymentConfirmationDialog.getByLabel('Payment confirmation note (optional)').fill('E2E advance payment confirmed');
  const approveStartPath = `/api/admin/workorders/${workOrderId}/payment/approve-start`;
  const blockedApprovalResponsePromise = adminPage.waitForResponse((response) => (
    new URL(response.url()).pathname === approveStartPath
    && response.request().method() === 'POST'
  ));
  await paymentConfirmationDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  const blockedApprovalResponse = await blockedApprovalResponsePromise;
  expect(blockedApprovalResponse.status()).toBe(409);
  expect(await blockedApprovalResponse.json()).toMatchObject({
    code: 'service_standard_gate_blocked',
    gate: 'start',
    blocking_items: START_GATE_BLOCKING_ITEMS,
  });
  await expect(adminPage.getByText(
    'Complete the required service-standard items first',
    { exact: true },
  )).toBeVisible();

  await engineerPage.reload();
  const navigationCountBeforeStandards = await engineerPage.evaluate(
    () => performance.getEntriesByType('navigation').length,
  );
  await confirmEngineerStandardItems(engineerPage, 'Risk control');
  await confirmEngineerStandardItems(engineerPage, 'One-visit readiness');
  expect(await engineerPage.evaluate(
    () => performance.getEntriesByType('navigation').length,
  )).toBe(navigationCountBeforeStandards);

  const approvedStartResponsePromise = adminPage.waitForResponse((response) => (
    new URL(response.url()).pathname === approveStartPath
    && response.request().method() === 'POST'
  ));
  await paymentConfirmationDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  const approvedStartResponse = await approvedStartResponsePromise;
  expect(approvedStartResponse.status()).toBe(200);
  expect(await approvedStartResponse.json()).toMatchObject({
    success: true,
    status: 'in_service',
  });
  expect(localD1Rows(`
    SELECT status FROM work_orders WHERE id = ${sqlText(workOrderId)}
  `)[0].status).toBe('in_service');
  await paymentDialog.getByRole('button', { name: 'Close', exact: true }).click();

  customerMilestones = await openCustomerMilestonesFromD1(
    customerPage,
    orderNo,
    workOrderId,
    { screenshot: 'customer-active-service-milestones' },
  );
  expect(customerMilestones.expectedMilestones.map(({ state }) => state)).toEqual([
    'completed',
    'completed',
    'completed',
    'current',
    'upcoming',
    'upcoming',
  ]);
  await closeCustomerWorkOrder(customerPage);

  await engineerPage.reload();
  await confirmEngineerStandardItems(engineerPage, 'Evidence-led work');
  await confirmEngineerStandardItems(engineerPage, 'Recovery check');
  customerMilestones = await openCustomerMilestonesFromD1(
    customerPage,
    orderNo,
    workOrderId,
  );
  expect(customerMilestones.expectedMilestones.map(({ state }) => state)).toEqual([
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'current',
  ]);
  await closeCustomerWorkOrder(customerPage);

  await engineerPage.getByRole('tab', { name: 'Service report', exact: true }).click();
  await engineerPage.getByLabel('Customer Symptom').fill('Laser power dropped during continuous cutting.');
  await engineerPage.getByLabel('Root Cause / Diagnosis').fill('Protective lens contamination reduced delivered power.');
  await engineerPage.getByLabel('Service Actions / Next Advice').fill('Cleaned optical path and replaced the protective lens.');
  await engineerPage.getByRole('button', { name: 'Save Service Report', exact: true }).click();
  await expect(engineerPage.getByRole('button', { name: 'Edit service report', exact: true })).toBeVisible();
  await engineerPage.getByRole('button', { name: 'Submit Final Report to Customer', exact: true }).click();
  await confirmFeedback(engineerPage);

  customerMilestones = await openCustomerMilestonesFromD1(
    customerPage,
    orderNo,
    workOrderId,
  );
  expect(customerMilestones.expectedMilestones.map(({ state }) => state)).toEqual([
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'current',
  ]);
  await expect(customerPage.getByRole('heading', { name: 'Service Review', exact: true })).toBeVisible();
  await customerPage.getByPlaceholder('Share your service experience (optional)...').fill('E2E service completed successfully.');
  await customerPage.getByTestId('submit-rating-button').click();
  await expect(customerPage.getByRole('heading', { name: 'Your Review', exact: true })).toBeVisible();
  customerMilestones = await openCustomerMilestonesFromD1(
    customerPage,
    orderNo,
    workOrderId,
  );
  expect(customerMilestones.expectedMilestones.map(({ state }) => state)).toEqual([
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
    'completed',
  ]);

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

  await engineerPage.goBack();
  await expect(engineerPage.getByText('My work orders', { exact: true })).toBeVisible();

  await adminContext.close();
  await customerContext.close();
  await engineerContext.close();
});
