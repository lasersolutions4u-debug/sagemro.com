import { expect, test } from '@playwright/test';

import {
  adminApi,
  loginAdmin,
  onboardEngineer,
  submitCustomerServiceRequest,
  uniqueIdentity,
} from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';
import { captureBothViewports, localD1Rows, sqlText } from '../support/visual.mjs';

const runtime = e2eRuntime();
test.use({ actionTimeout: 15_000, launchOptions: { args: [
  '--no-proxy-server', '--host-resolver-rules=MAP *.127.0.0.1.nip.io 127.0.0.1',
  `--unsafely-treat-insecure-origin-as-secure=${[runtime.apiBase, runtime.customerBase, runtime.engineerBase, runtime.adminBase].join(',')}`,
] } });

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

async function reloadAdminPage(page) {
  const pendingSessions = new Set();
  const trackSession = (request) => {
    if (new URL(request.url()).pathname === '/api/auth/session') pendingSessions.add(request);
  };
  const finishSession = (request) => pendingSessions.delete(request);
  page.on('request', trackSession);
  page.on('requestfinished', finishSession);
  page.on('requestfailed', finishSession);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'SAGEMRO Operations Console', exact: true })).toBeVisible();
    // The local React StrictMode mount restores the session twice before navigation is stable.
    await expect.poll(() => pendingSessions.size).toBe(0);
  } finally {
    page.off('request', trackSession);
    page.off('requestfinished', finishSession);
    page.off('requestfailed', finishSession);
  }
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


async function portalApi(page, requestPath, method = 'GET', body) {
  return page.evaluate(async ({ apiBase, requestPath, method, body }) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('sagemro_token');
    if (token) headers.Authorization = `Bearer ${token}`;
    const csrf = localStorage.getItem('admin_csrf_token');
    if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(`${apiBase}${requestPath}`, {
      method, credentials: 'include', headers, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }, { apiBase: runtime.apiBase, requestPath, method, body });
}

test('local database helper refuses missing isolation and reads this run database', () => {
  const runDir = process.env.E2E_RUN_DIR;
  try {
    delete process.env.E2E_RUN_DIR;
    expect(() => localD1Rows('SELECT 1')).toThrow(/E2E_RUN_DIR/);
  } finally { process.env.E2E_RUN_DIR = runDir; }
  expect(localD1Rows("SELECT material_code FROM materials WHERE id = 'e2e-stock-material'"))
    .toEqual([{ material_code: 'E2E-STOCK-001' }]);
});

test('business quote, verified payment, dispatch and engineer service complete a COM order', async ({ browser }) => {
  test.setTimeout(300_000);
  const { engineer, context: engineerContext, page: engineerPage } = await onboardEngineer({ browser, runtime });

  const customer = {
    ...uniqueIdentity('Customer'),
    password: runtime.customerPassword,
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
  const orderNo = await submitCustomerServiceRequest({
    page: customerPage,
    customer,
    description: `E2E lifecycle ${customer.runId}: laser power drops during production.`,
  });
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


  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAdmin(adminPage, runtime);
  const scope = async (page, staffId = 'admin') => ({
    expected_staff_id: staffId,
    scope_version: (await adminApi(page, runtime, `/api/admin/business/organization?expected_staff_id=${staffId}`)).scope_version,
  });
  const engineerId = localD1Rows(`SELECT id FROM engineers WHERE email = ${sqlText(engineer.email)}`)[0].id;
  const assertEngineerBlocked = async () => {
    await engineerPage.reload();
    await expect(engineerPage.getByRole('button').filter({ hasText: orderNo })).toHaveCount(0);
    for (const [requestPath, method] of [
      [`/api/workorders/${workOrderId}`, 'GET'],
      [`/api/workorders/${workOrderId}/messages`, 'GET'],
      [`/api/workorders/${workOrderId}/messages`, 'POST'],
    ]) {
      const response = await portalApi(engineerPage, requestPath, method, method === 'POST' ? { content: 'Fictional premature contact attempt' } : undefined);
      expect([403, 404]).toContain(response.status);
      expect(JSON.stringify(response.data)).not.toContain(customer.email);
    }
    expect(localD1Rows(`SELECT engineer_id FROM work_orders WHERE id = ${sqlText(workOrderId)}`)[0].engineer_id).toBeNull();
    expect(localD1Rows(`SELECT COUNT(*) AS count FROM work_order_messages WHERE work_order_id = ${sqlText(workOrderId)} AND sender_type = 'engineer'`)[0].count).toBe(0);
  };
  const assertDispatchBlocked = async () => {
    const response = await portalApi(adminPage, `/api/admin/workorders/${workOrderId}/assign`, 'PATCH', { engineer_id: engineerId });
    expect(response.status).toBe(409);
    expect(response.data.code).toBe('business_dispatch_not_ready');
    await assertEngineerBlocked();
  };
  await assertDispatchBlocked();

  const business = uniqueIdentity('Business');
  console.info('Lifecycle: unpaid dispatch and engineer access denied.');
  const territoryName = `E2E territory ${business.runId}`;
  await adminApi(adminPage, runtime, '/api/admin/business/territories', {
    method: 'POST', body: JSON.stringify({ ...await scope(adminPage), name: territoryName, market: 'com' }),
  });
  const org = await adminApi(adminPage, runtime, '/api/admin/business/organization?expected_staff_id=admin');
  const territory = org.territories.find(item => item.name === territoryName);
  expect(territory).toBeTruthy();
  const account = await adminApi(adminPage, runtime, '/api/admin/staff', {
    method: 'POST', body: JSON.stringify({ expected_staff_id: 'admin', scope_version: org.scope_version,
      login: business.email, display_name: business.name, role: 'business_director', market_scope: 'com',
      grade: 1, territory_ids: [territory.id] }),
  });
  await adminApi(adminPage, runtime, `/api/admin/business/records/work_order/${workOrderId}/assignment`, {
    method: 'PUT', body: JSON.stringify({ ...await scope(adminPage), revision: 0, territory_id: territory.id, owner_staff_id: account.staff.id }),
  });

  const businessContext = await browser.newContext();
  const businessPage = await businessContext.newPage();
  await businessPage.goto(runtime.adminBase);
  expect(await businessPage.evaluate(() => window.isSecureContext && typeof crypto.randomUUID === 'function')).toBe(true);
  await businessPage.getByPlaceholder('Phone number or login name').fill(business.email);
  await businessPage.getByPlaceholder('Password').fill(account.temporary_password);
  await businessPage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await businessPage.getByLabel('Current temporary password').fill(account.temporary_password);
  await businessPage.getByLabel('New password (10+ characters)', { exact: true }).fill(runtime.customerPassword);
  await businessPage.getByLabel('Confirm new password', { exact: true }).fill(runtime.customerPassword);
  await businessPage.getByRole('button', { name: 'Change password and continue', exact: true }).click();
  await expect(businessPage.getByRole('heading', { name: 'All leads', exact: true })).toBeVisible();
  await expect(businessPage.getByRole('navigation').getByRole('button', { name: 'Business workspace', exact: true })).toHaveCount(0);
  const businessTitle = localD1Rows(`SELECT short_title FROM work_orders WHERE id = ${sqlText(workOrderId)}`)[0].short_title || orderNo;
  const openBusinessOrder = async () => {
    await businessPage.reload();
    await businessPage.getByRole('navigation').getByRole('button', { name: 'Service Orders', exact: true }).click();
    await businessPage.locator('tr').filter({ hasText: businessTitle }).getByRole('button', { name: 'View details', exact: true }).click();
    const dialog = businessPage.getByRole('dialog');
    await expect(dialog).toContainText(orderNo);
    return dialog;
  };
  let businessDialog = await openBusinessOrder();
  console.info('Lifecycle: business account signed in and assigned order opened.');
  for (const [label, value] of [
    ['Customer labor fee', '800'], ['Customer parts fee', '0'], ['Customer travel fee', '100'], ['Customer other fee', '0'],
    ['Parts procurement cost', '0'], ['Engineer labor cost', '400'], ['Travel cost', '100'], ['Other direct cost', '0'],
  ]) await businessDialog.getByLabel(label, { exact: true }).fill(value);
  const onsiteDays = businessDialog.getByLabel('Expected onsite days', { exact: true });
  if (await onsiteDays.count()) await onsiteDays.fill('1');
  await expect(businessDialog.getByTestId('business-gross-profit')).toContainText('400 USD');
  await businessDialog.getByRole('button', { name: 'Save quote draft', exact: true }).click();
  await expect(businessDialog.getByText('Draft saved', { exact: true })).toBeVisible();
  await businessDialog.getByRole('button', { name: 'Submit for Admin review', exact: true }).click();
  await expect(businessDialog.getByText('Awaiting Admin review', { exact: true })).toBeVisible();
  expect(localD1Rows(`SELECT quote_source, status, total_amount FROM work_order_pricing WHERE work_order_id = ${sqlText(workOrderId)}`)[0])
    .toMatchObject({ quote_source: 'business', status: 'pending_review', total_amount: 900 });
  await assertDispatchBlocked();
  const approval = await adminApi(adminPage, runtime, `/api/admin/workorders/${workOrderId}/pricing/approve`, {
    method: 'PATCH', body: JSON.stringify({ ...await scope(adminPage), quote_version: 1, note: 'Fictional lifecycle quote approval' }),
  });
  expect(approval.success).toBe(true);
  console.info('Lifecycle: business quote submitted and approved by Admin.');
  await assertDispatchBlocked();

  await customerPage.reload();
  await customerPage.getByRole('button', { name: 'My Services', exact: true }).click();
  await customerPage.getByText(orderNo, { exact: true }).click();
  await customerPage.getByRole('tab', { name: 'Confirm Quote', exact: true }).click();
  await customerPage.getByTestId('open-confirm-pricing-button').click();
  await customerPage.getByTestId('confirm-pricing-button').click();
  await expect(customerPage.getByRole('heading', { name: 'Collection workspace', exact: true })).toBeVisible();
  const customerDetail = await portalApi(customerPage, `/api/workorders/${workOrderId}`);
  expect(customerDetail.status).toBe(200);
  for (const key of ['engineer_cost', 'parts_cost', 'estimated_gross_profit', 'cost_snapshot', 'costs_json']) {
    expect(JSON.stringify(customerDetail.data)).not.toContain(`"${key}"`);
  }
  await assertDispatchBlocked();

  businessDialog = await openBusinessOrder();
  await businessDialog.getByRole('button', { name: 'Start installment collection', exact: true }).click();
  await expect(businessDialog.getByText('Collection opened', { exact: true })).toBeVisible();
  await customerPage.reload();
  await customerPage.getByRole('button', { name: 'My Services', exact: true }).click();
  await customerPage.getByText(orderNo, { exact: true }).click();
  await customerPage.getByRole('tab', { name: 'Payments & receipts', exact: true }).click();
  const customerInstallment = customerPage.locator('article').filter({
    has: customerPage.getByRole('heading', { name: 'Installment 1', exact: true }),
  });
  await customerInstallment.getByRole('button', { name: 'Choose payment method', exact: true }).click();
  await customerPage.getByRole('button', { name: 'Request Installment TT Instructions', exact: true }).click();
  await expect(customerPage.getByRole('heading', { name: 'Payment method received', exact: true })).toBeVisible();

  await businessDialog.getByLabel('Receipt amount to verify', { exact: true }).fill('900');
  await businessDialog.getByLabel('Transaction reference', { exact: true }).fill(`E2E-${customer.runId}`);
  await businessDialog.getByLabel('Internal receipt note', { exact: true }).fill('Fictional bank receipt for local testing');
  await businessDialog.getByRole('button', { name: 'Submit receipt for review', exact: true }).click();
  await expect(businessDialog.getByText('Receipt submitted; the amount is not counted as received until Admin verifies it.', { exact: true })).toBeVisible();
  await assertDispatchBlocked();

  await reloadAdminPage(adminPage);
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  await adminPage.locator('tr').filter({ hasText: orderNo }).getByRole('button', { name: 'View', exact: true }).click();
  const receiptDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
  await receiptDialog.getByRole('button', { name: 'Confirm full receipt', exact: true }).click();
  const fullReceiptDialog = adminPage.getByRole('dialog', { name: 'Confirm full receipt' });
  await fullReceiptDialog.getByLabel('Decision note (optional)').fill('Fictional receipt verified');
  await fullReceiptDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(receiptDialog.getByText('No receipt claims are waiting for review.', { exact: true })).toBeVisible();
  console.info('Lifecycle: customer accepted quote and Admin verified receipt.');
  await assertEngineerBlocked();
  const dispatchToggle = receiptDialog.locator('button[aria-controls="work-order-section-dispatch-content"]');
  if (await dispatchToggle.getAttribute('aria-expanded') !== 'true') await dispatchToggle.click();
  await receiptDialog.getByLabel('Select engineer').selectOption(engineerId);
  await receiptDialog.getByRole('button', { name: 'Direct dispatch', exact: true }).click();
  await expect(adminPage.getByText(`Dispatched: ${orderNo}`, { exact: true })).toBeVisible();
  await receiptDialog.getByRole('button', { name: 'Close', exact: true }).click();
  console.info('Lifecycle: paid order dispatched to engineer.');

  await engineerPage.reload();
  await engineerPage.getByRole('button').filter({ hasText: orderNo }).click();
  await expect(engineerPage).toHaveURL(new RegExp(`/work-orders/${workOrderId}$`));
  expect(localD1Rows(`SELECT engineer_id FROM work_orders WHERE id = ${sqlText(workOrderId)}`)[0].engineer_id).toBe(engineerId);
  await expect(engineerPage.getByRole('button', { name: 'Request Start Approval', exact: true })).toBeVisible();
  await confirmEngineerStandardItems(engineerPage, 'Task alignment');
  let customerMilestones = await openCustomerMilestonesFromD1(customerPage, orderNo, workOrderId);
  expect(customerMilestones.expectedMilestones.map(({ state }) => state)).toEqual([
    'completed', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
  ]);
  await closeCustomerWorkOrder(customerPage);
  await engineerPage.getByRole('tab', { name: 'Messages', exact: true }).click();
  const manualMessage = `Fictional service update ${customer.runId.slice(-6)}`;
  await engineerPage.getByPlaceholder('Type a message...').fill(manualMessage);
  await engineerPage.getByPlaceholder('Type a message...').press('Enter');
  await expect(engineerPage.getByText(manualMessage, { exact: true })).toBeVisible();
  expect(localD1Rows(`SELECT COUNT(*) AS count FROM work_order_messages WHERE work_order_id = ${sqlText(workOrderId)} AND content = ${sqlText(manualMessage)}`)[0].count).toBe(1);
  await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
  await expect(engineerPage.getByText('Quotation is handled by the business team.', { exact: false })).toBeVisible();
  await expect(engineerPage.getByTestId('submit-pricing-button')).toHaveCount(0);
  const forbiddenQuote = await portalApi(engineerPage, `/api/workorders/${workOrderId}/pricing`, 'POST', { labor_fee: 1 });
  expect(forbiddenQuote.status).toBe(403);

  await engineerPage.reload();
  const requestStartApproval = engineerPage.getByRole('button', { name: 'Request Start Approval', exact: true });
  await engineerPage.getByRole('tab', { name: 'Messages', exact: true }).click();
  await expect(requestStartApproval).toHaveCount(0);
  await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
  await expect(requestStartApproval).toHaveCount(0);
  await engineerPage.getByRole('tab', { name: 'Overview', exact: true }).click();
  await requestStartApproval.click();
  await confirmFeedback(engineerPage);

  await reloadAdminPage(adminPage);
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  await expect(adminPage.getByRole('heading', { name: 'Service Orders', exact: true })).toBeVisible();
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
  await engineerPage.getByLabel('Inspection Process').fill('Inspected the protective lens, optical alignment, and output stability.');
  await engineerPage.getByLabel('Root Cause / Diagnosis').fill('Protective lens contamination reduced delivered power.');
  await engineerPage.getByLabel('Service Actions / Next Advice').fill('Cleaned optical path and replaced the protective lens.');
  await engineerPage.getByLabel('Verification Result').fill('Completed repeated test cuts with stable output and acceptable edge quality.');
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

  await reloadAdminPage(adminPage);
  await adminPage.getByRole('button', { name: 'Service Orders', exact: true }).click();
  const archiveRow = adminPage.locator('tr').filter({ hasText: orderNo });
  await archiveRow.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(adminPage.getByText(`Archived: ${orderNo}`, { exact: true })).toBeVisible();
  await reloadAdminPage(adminPage);
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

  await businessContext.close();
  await adminContext.close();
  await customerContext.close();
  await engineerContext.close();
});
