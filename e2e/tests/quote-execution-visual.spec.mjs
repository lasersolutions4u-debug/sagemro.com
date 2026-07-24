import { expect, test } from '@playwright/test';

import {
  adminApi,
  createCustomerWorkOrder,
  dispatchWorkOrder,
  loginAdmin,
  onboardEngineer,
} from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';
import {
  captureBothViewports,
  localD1,
  localD1Rows,
  sqlText,
} from '../support/visual.mjs';

const runtime = e2eRuntime();

async function workOrderIdFor(page, orderNo) {
  return page.evaluate(async ({ apiBase, targetOrderNo }) => {
    const token = localStorage.getItem('sagemro_token');
    const response = await fetch(`${apiBase}/api/workorders`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json();
    return data.work_orders.find((workOrder) => workOrder.order_no === targetOrderNo)?.id || '';
  }, { apiBase: runtime.apiBase, targetOrderNo: orderNo });
}

async function openEngineerOrder(page, orderNo) {
  await page.reload();
  const task = page.locator('article').filter({ hasText: orderNo });
  await expect(task).toBeVisible();
  await task.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await expect(page.getByText('Work Order Details', { exact: true })).toBeVisible();
}

async function openCustomerOrder(page, orderNo) {
  await page.getByRole('button', { name: 'My Services', exact: true }).click();
  await page.getByText(orderNo, { exact: true }).click();
  await expect(page.getByText('Work Order Details', { exact: true })).toBeVisible();
}

async function openAdminOrder(page, orderNo) {
  await page.reload();
  await page.getByRole('button', { name: 'Service Orders', exact: true }).click();
  const cardOrRow = page.locator('tr, article, div').filter({ hasText: orderNo });
  const orderLink = page.getByRole('button', { name: orderNo, exact: true });
  if (await orderLink.isVisible().catch(() => false)) await orderLink.click();
  else await cardOrRow.getByRole('button', { name: 'View', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Service Control View' })).toBeVisible();
}

async function closeAdminOrder(page) {
  const dialog = page.getByRole('dialog', { name: 'Service Control View' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}

function workOrderModal(page) {
  return page.getByText('Work Order Details', { exact: true }).locator('..').locator('..');
}

function panelByHeading(root, name) {
  return root.getByRole('heading', { name, exact: true }).locator('xpath=ancestor::section[1]');
}

test('quote execution lifecycle renders and operates correctly on desktop and mobile', async ({ browser }) => {
  test.setTimeout(300_000);
  let engineerContext;
  let customerContext;
  let adminContext;

  try {
    const onboarding = await test.step('onboard engineer', () => onboardEngineer({ browser, runtime }));
    const { engineer, page: engineerPage } = onboarding;
    engineerContext = onboarding.context;
    engineerPage.setDefaultTimeout(7_000);

    const customerOrder = await test.step('create customer and work order', () => createCustomerWorkOrder({
      browser,
      runtime,
      description: 'E2E onsite six-installment quote execution visual acceptance.',
    }));
    const { page: customerPage, orderNo } = customerOrder;
    customerContext = customerOrder.context;
    customerPage.setDefaultTimeout(7_000);

    adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    adminPage.setDefaultTimeout(7_000);
    await test.step('dispatch work order', async () => {
      await loginAdmin(adminPage, runtime);
      await dispatchWorkOrder({ page: adminPage, orderNo, engineer });
    });

    await test.step('accept assignment and prepare onsite state', async () => {
      await engineerPage.reload();
      const assignedTask = engineerPage.locator('article').filter({ hasText: orderNo });
      await expect(assignedTask).toBeVisible();
      await assignedTask.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
    });

    const workOrderId = await workOrderIdFor(customerPage, orderNo);
    expect(workOrderId).not.toBe('');
    localD1(`
      UPDATE work_orders
      SET service_mode = 'onsite', site_timezone = 'Asia/Shanghai',
          expected_completion_date = date('now', '+3 days'),
          planned_daily_start_time = '08:00', planned_daily_end_time = '17:00'
      WHERE id = ${sqlText(workOrderId)};
    `);

    await test.step('engineer edits six installments', async () => {
      await openEngineerOrder(engineerPage, orderNo);
      await engineerPage.getByRole('tab', { name: 'Submit Quote', exact: true }).click();
      await engineerPage.getByLabel('Labor Fee').fill('6000');
      await engineerPage.getByLabel('Travel Fee').fill('0');
      await engineerPage.getByLabel('Parts Fee').fill('0');
      await engineerPage.getByLabel('Other Fees').fill('0');
      await engineerPage.getByLabel('Expected onsite workdays').fill('3');
      await engineerPage.getByRole('button', { name: 'Installments', exact: true }).click();
      for (let installment = 3; installment <= 6; installment += 1) {
        await engineerPage.getByRole('button', { name: 'Add installment', exact: true }).click();
      }
      for (let installment = 1; installment <= 6; installment += 1) {
        await engineerPage.getByLabel(`Installment ${installment} Amount`, { exact: true }).fill('1000');
      }
      await expect(engineerPage.getByLabel('Installment 6 Amount', { exact: true })).toBeVisible();
      await captureBothViewports(engineerPage, '01-engineer-six-installments', { scope: workOrderModal(engineerPage) });
      await engineerPage.getByTestId('submit-pricing-button').click();
      await expect(engineerPage.getByText('Quote submitted for operations review.', { exact: false })).toBeVisible();
    });

    await test.step('Admin reviews complete quote', async () => {
      await openAdminOrder(adminPage, orderNo);
      const adminDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
      await expect(adminDialog.getByRole('heading', { name: 'Quote execution review', exact: true })).toBeVisible();
      await expect(adminDialog.getByText('Installment 6', { exact: false })).toBeVisible();
      await captureBothViewports(adminPage, '02-admin-complete-quote-review', { scope: '[role="dialog"][aria-label="Service Control View"]' });
      const approveQuote = adminDialog.getByRole('button', { name: 'Approve quote version', exact: true });
      await expect(approveQuote).toBeVisible();
      const approval = await adminApi(adminPage, runtime, `/api/admin/workorders/${workOrderId}/pricing/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ quote_version: 1, note: 'E2E complete quote approved' }),
      });
      expect(approval.success).toBe(true);
      const approvedRows = localD1Rows(`
        SELECT history.status
        FROM work_order_pricing_history history
        JOIN work_order_pricing pricing ON pricing.id = history.pricing_id
        WHERE pricing.work_order_id = ${sqlText(workOrderId)} AND history.version = 1;
      `);
      expect(approvedRows[0]?.status).toBe('approved');
      await closeAdminOrder(adminPage);
    });

    await openCustomerOrder(customerPage, orderNo);
    await customerPage.getByRole('tab', { name: 'Confirm Quote', exact: true }).click();
    await expect(customerPage.getByText('Installment 6', { exact: false })).toBeVisible();
    await customerPage.getByTestId('open-confirm-pricing-button').click();
    await expect(customerPage.getByTestId('confirm-pricing-button')).toBeVisible();
    await captureBothViewports(customerPage, '03-customer-complete-quote-confirmation', { scope: workOrderModal(customerPage) });
    await customerPage.getByTestId('confirm-pricing-button').click();
    await expect(customerPage.getByRole('heading', { name: 'Collection workspace', exact: true })).toBeVisible();
    await expect(customerPage.getByRole('heading', { name: 'Installment 6', exact: true })).toBeVisible();

    localD1(`
      UPDATE work_order_installments
      SET status = 'due', updated_at = datetime('now')
      WHERE work_order_id = ${sqlText(workOrderId)} AND sequence = 2;
    `);

    await engineerPage.getByRole('button', { name: 'Close', exact: true }).click();
    await openEngineerOrder(engineerPage, orderNo);
    await engineerPage.getByRole('tab', { name: 'Payments & receipts', exact: true }).click();
    const secondInstallment = engineerPage.locator('article').filter({ has: engineerPage.getByRole('heading', { name: 'Installment 2', exact: true }) });
    await secondInstallment.getByRole('button', { name: 'Start this installment collection', exact: true }).click();
    await expect(secondInstallment.getByRole('heading', { name: 'Request receipt confirmation', exact: true })).toBeVisible();
    await secondInstallment.getByLabel('Claimed amount').fill('600');
    await secondInstallment.getByLabel('Transaction reference (optional)').fill(`E2E-PARTIAL-${workOrderId}`);
    await secondInstallment.getByLabel('Collection note (optional)').fill('Partial receipt for visual acceptance');
    await captureBothViewports(engineerPage, '04-engineer-partial-receipt-claim', { scope: workOrderModal(engineerPage) });
    await secondInstallment.getByRole('button', { name: 'Request receipt confirmation', exact: true }).click();
    await expect(engineerPage.getByText('Waiting for Admin confirmation', { exact: true })).toBeVisible();

    await openAdminOrder(adminPage, orderNo);
    const receiptDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
    await expect(receiptDialog.getByRole('heading', { name: 'Pending receipt review', exact: true })).toBeVisible();
    const receiptPanel = panelByHeading(receiptDialog, 'Quote execution review');
    await expect(receiptPanel.getByText(/Claimed:\s*600 USD/)).toBeVisible();
    await captureBothViewports(adminPage, '05-admin-receipt-review', { scope: receiptPanel });
    await expect(receiptDialog.getByRole('button', { name: 'Confirm partial amount', exact: true })).toBeVisible();
    const [pendingClaim] = localD1Rows(`
      SELECT id AS claim_id, installment_id
      FROM work_order_receipt_claims
      WHERE work_order_id = ${sqlText(workOrderId)} AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1;
    `);
    expect(pendingClaim).toBeTruthy();
    const receiptDecision = await adminApi(
      adminPage,
      runtime,
      `/api/admin/workorders/${workOrderId}/installments/${pendingClaim.installment_id}/receipt-claims/${pendingClaim.claim_id}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({
          decision: 'confirmed',
          confirmed_amount: 500,
          reason: 'Bank fee held back 100 USD',
          idempotency_key: `e2e-receipt-decision-${pendingClaim.claim_id}`,
        }),
      },
    );
    expect(receiptDecision.claim?.status).toBe('confirmed');
    const [confirmedReceipt] = localD1Rows(`
      SELECT claim.status, claim.confirmed_amount, installment.received_amount, installment.status AS installment_status
      FROM work_order_receipt_claims claim
      JOIN work_order_installments installment ON installment.id = claim.installment_id
      WHERE claim.id = ${sqlText(pendingClaim.claim_id)};
    `);
    expect(confirmedReceipt).toMatchObject({
      status: 'confirmed',
      confirmed_amount: 500,
      received_amount: 500,
      installment_status: 'partially_received',
    });

    localD1(`
      UPDATE work_orders
      SET status = 'in_service', service_mode = 'onsite', site_timezone = 'Asia/Shanghai',
          expected_service_days = 3, approved_extension_days = 1,
          expected_completion_date = date('now', '+3 days'),
          planned_daily_start_time = '08:00', planned_daily_end_time = '17:00'
      WHERE id = ${sqlText(workOrderId)};
    `);
    await closeAdminOrder(adminPage);
    await openAdminOrder(adminPage, orderNo);
    const fieldDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
    await expect(fieldDialog.getByRole('heading', { name: 'Field operations', exact: true })).toBeVisible();
    const fieldPanel = panelByHeading(fieldDialog, 'Field operations');
    await expect(fieldPanel.getByText('4 permitted', { exact: true })).toBeVisible();
    await expect(fieldPanel.getByText('Asia/Shanghai', { exact: true })).toHaveCount(0);
    await captureBothViewports(adminPage, '06-field-work-allowance-summary', { scope: fieldPanel });

    const rows = localD1Rows(`
      SELECT
        (SELECT COUNT(*) FROM work_order_payment_schedule WHERE work_order_id = ${sqlText(workOrderId)}) AS schedule_count,
        (SELECT COUNT(*) FROM work_order_installments WHERE work_order_id = ${sqlText(workOrderId)}) AS installment_count,
        (SELECT COUNT(*) FROM work_order_receipt_claims WHERE work_order_id = ${sqlText(workOrderId)} AND status = 'confirmed') AS confirmed_claim_count;
    `);
    expect(rows[0]).toMatchObject({ schedule_count: 6, installment_count: 6, confirmed_claim_count: 1 });
  } finally {
    await Promise.allSettled([
      adminContext?.close(),
      customerContext?.close(),
      engineerContext?.close(),
    ]);
  }
});
