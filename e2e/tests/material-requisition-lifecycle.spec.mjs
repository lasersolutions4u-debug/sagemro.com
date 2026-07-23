import { expect, test } from '@playwright/test';

import {
  adminApi,
  createCustomerWorkOrder,
  dispatchWorkOrder,
  loginAdmin,
  onboardEngineer,
} from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';

const runtime = e2eRuntime();
const STOCK_MATERIAL = {
  id: 'e2e-stock-material',
  code: 'E2E-STOCK-001',
  name: 'E2E Stock Nozzle',
};
const MANUAL_MATERIAL = 'E2E Manual Seal Kit';

function materialLine(page, name) {
  return page.locator('div.py-3').filter({ hasText: name });
}

function engineerMaterialLine(page, name) {
  return page.locator('div.border-b.py-4').filter({ hasText: name });
}

async function expectLineProgress(line, label, value) {
  await expect(line.locator('.mt-2.grid').getByText(label, { exact: true }).locator('..')).toContainText(String(value));
}

async function expectLineStatus(line, status) {
  await expect(line.locator('span.self-start')).toHaveText(status);
}

async function clickRequisitionAction(page, button, pathSuffix) {
  await expect(page.getByText('Saving action...', { exact: true })).toBeHidden();
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/api/material-requisitions/') && response.url().endsWith(pathSuffix)
  ), { timeout: 15_000 });
  await button.click();
  const response = await responsePromise;
  expect(response.ok(), `${pathSuffix} failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  await expect(page.getByText('Saving action...', { exact: true })).toBeHidden();
}

test('engineer and Admin complete the material requisition lifecycle', async ({ browser }) => {
  test.setTimeout(240_000);
  const { engineer, context: engineerContext, page: engineerPage } = await onboardEngineer({ browser, runtime });
  const { context: customerContext, orderNo } = await createCustomerWorkOrder({
    browser,
    runtime,
    description: 'E2E material requisition lifecycle: stocked nozzle and manual seal kit required.',
  });

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAdmin(adminPage, runtime);
  await dispatchWorkOrder({ page: adminPage, orderNo, engineer });

  const workOrders = await adminApi(adminPage, runtime, '/api/admin/workorders?pageSize=50');
  const workOrder = workOrders.list.find((item) => item.order_no === orderNo);
  expect(workOrder, `work order ${orderNo} should be available to Admin`).toBeTruthy();
  await adminApi(adminPage, runtime, `/api/workorders/${workOrder.id}/material-items`, {
    method: 'POST',
    body: JSON.stringify({
      material_id: STOCK_MATERIAL.id,
      purpose: 'preparation',
      quantity: 2,
      note: 'E2E preparation stock line',
    }),
  });

  await engineerPage.reload();
  const task = engineerPage.locator('article').filter({ hasText: orderNo });
  await expect(task).toBeVisible();
  await task.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
  await task.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await engineerPage.getByRole('tab', { name: 'Material Requisition', exact: true }).click();
  await engineerPage.getByRole('button', { name: 'Copy preparation lines', exact: true }).click();
  await expect(engineerPage.getByLabel('Material name').first()).toHaveValue(STOCK_MATERIAL.name);
  await engineerPage.getByRole('button', { name: 'Add line', exact: true }).click();
  await engineerPage.getByLabel('Material name').nth(1).fill(MANUAL_MATERIAL);
  await engineerPage.getByLabel('Specification').nth(1).fill('E2E-SPEC-MANUAL');
  await engineerPage.getByLabel('Quantity').nth(1).fill('1');
  await engineerPage.getByLabel('Notes').nth(1).fill('Procure for E2E lifecycle');
  await engineerPage.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(engineerPage.getByText('Draft created. Review it before submitting.', { exact: true })).toBeVisible();

  const engineerDetail = engineerPage.locator('section[aria-live="polite"]');
  await expect(engineerDetail.getByText('Status: Draft', { exact: true })).toBeVisible();
  const requisitionNo = (await engineerDetail.locator('.font-semibold').first().textContent()).trim();
  await expect(engineerDetail).toContainText(STOCK_MATERIAL.code);
  await expect(engineerDetail).toContainText(MANUAL_MATERIAL);
  await engineerDetail.getByRole('button', { name: 'Submit draft', exact: true }).click();
  await engineerPage.getByRole('button', { name: 'Submit draft', exact: true }).last().click();
  await expect(engineerPage.getByText('Material requisition submitted.', { exact: true })).toBeVisible();
  await expect(engineerDetail.getByText('Status: Submitted', { exact: true })).toBeVisible();

  await adminPage.getByRole('button', { name: 'Material Requisitions', exact: true }).click();
  const requisitionRow = adminPage.locator('tr').filter({ hasText: requisitionNo });
  await expect(requisitionRow).toContainText('Submitted');
  await requisitionRow.getByRole('button', { name: requisitionNo, exact: true }).click();
  const drawer = adminPage.getByRole('dialog');
  await expect(drawer.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await drawer.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(drawer.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(drawer.getByText('Saving action...', { exact: true })).toBeHidden();

  const stockLine = materialLine(drawer, STOCK_MATERIAL.name);
  await stockLine.getByLabel('Qty').fill('2');
  await clickRequisitionAction(adminPage, stockLine.getByRole('button', { name: 'Allocate', exact: true }), '/stock-allocation');
  await expectLineProgress(stockLine, 'Allocated', 2);
  await expectLineStatus(stockLine, 'Ready');

  const manualLine = materialLine(drawer, MANUAL_MATERIAL);
  await manualLine.getByLabel('Qty').fill('1');
  await manualLine.getByPlaceholder('Supplier / PO reference').fill('E2E-PO-001');
  await clickRequisitionAction(adminPage, manualLine.getByRole('button', { name: 'Order', exact: true }), '/procurement');
  await expectLineProgress(manualLine, 'Ordered', 1);
  await expectLineStatus(manualLine, 'Purchasing');
  await clickRequisitionAction(adminPage, manualLine.getByRole('button', { name: 'Receive purchase', exact: true }), '/procurement-receipt');
  await expectLineProgress(manualLine, 'Purchased', 1);
  await expectLineStatus(manualLine, 'Ready');
  await expect(drawer.getByText('Ready', { exact: true }).first()).toBeVisible();

  await stockLine.getByLabel('Qty').fill('2');
  await clickRequisitionAction(adminPage, stockLine.getByRole('button', { name: 'Issue', exact: true }), '/issue');
  await expectLineProgress(stockLine, 'Issued', 2);
  await expectLineStatus(stockLine, 'Issued');
  await manualLine.getByLabel('Qty').fill('1');
  await clickRequisitionAction(adminPage, manualLine.getByRole('button', { name: 'Issue', exact: true }), '/issue');
  await expectLineProgress(manualLine, 'Issued', 1);
  await expect(drawer.getByText('Issued', { exact: true }).first()).toBeVisible();

  await engineerPage.reload();
  const issuedTask = engineerPage.locator('article').filter({ hasText: orderNo });
  await issuedTask.getByRole('button', { name: 'View / Handle Task', exact: true }).click();
  await engineerPage.getByRole('tab', { name: 'Material Requisition', exact: true }).click();
  await engineerPage.getByRole('button', { name: `Open requisition ${requisitionNo}`, exact: true }).click();
  const receiptDetail = engineerPage.locator('section[aria-live="polite"]');
  await expect(receiptDetail.getByText('Status: Issued', { exact: true })).toBeVisible();
  const engineerStockLine = engineerMaterialLine(receiptDetail, STOCK_MATERIAL.name);
  const engineerManualLine = engineerMaterialLine(receiptDetail, MANUAL_MATERIAL);
  await engineerStockLine.getByRole('button', { name: 'Confirm receipt', exact: true }).click();
  await expect(engineerStockLine).toContainText('Received');
  await engineerManualLine.getByRole('button', { name: 'Confirm receipt', exact: true }).click();
  await expect(receiptDetail.getByText('Status: Received', { exact: true })).toBeVisible();
  await expect(receiptDetail).toContainText('2 pcs');
  await expect(receiptDetail).toContainText('1 pcs');

  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Material Requisitions', exact: true }).click();
  const receivedRow = adminPage.locator('tr').filter({ hasText: requisitionNo });
  await expect(receivedRow).toContainText('Received');
  await receivedRow.getByRole('button', { name: requisitionNo, exact: true }).click();
  const receivedDrawer = adminPage.getByRole('dialog');
  await expect(receivedDrawer.getByText('Received', { exact: true }).first()).toBeVisible();
  await receivedDrawer.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(receivedDrawer.getByText('Closed', { exact: true }).first()).toBeVisible();

  await adminContext.close();
  await customerContext.close();
  await engineerContext.close();
});
