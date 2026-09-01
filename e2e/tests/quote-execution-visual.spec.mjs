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
  captureVisual,
  localD1,
  localD1Rows,
  sqlText,
} from '../support/visual.mjs';

const runtime = e2eRuntime();

const HOME_COPY = {
  en: {
    url: runtime.customerBase,
    heading: 'Equipment trouble? Chat now. Get answers instantly.',
    input: 'Describe the problem — or just start talking',
    tools: ['Laser Cutting Speed', 'Material Weight', 'Laser Cutting Cost', 'Steel Price Budget'],
    about: 'About SAGEMRO',
  },
  zh: {
    url: 'http://sagemro.cn:4273',
    heading: '机器的问题，难不倒有心的人',
    input: '描述设备问题，或直接开始说...',
    tools: ['激光切割速度参考', '材料重量计算器', '激光切割成本估算', '钢材价格预算'],
    about: '关于 SAGEMRO',
  },
};

async function installChineseHostProxy(page) {
  await page.route('http://sagemro.cn:4273/**', async (route) => {
    const localUrl = new URL(route.request().url());
    const localOrigin = new URL(runtime.customerBase);
    localUrl.protocol = localOrigin.protocol;
    localUrl.hostname = localOrigin.hostname;
    localUrl.port = localOrigin.port;
    const response = await route.fetch({ url: localUrl.toString() });
    await route.fulfill({ response });
  });
}

async function expectFullyInViewport(page, locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

async function captureHomeEvidence(page, { homeHeading, input, resources }) {
  const original = page.viewportSize();
  for (const viewport of [
    { suffix: 'desktop', width: 1440, height: 900 },
    { suffix: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await homeHeading.scrollIntoViewIfNeeded();
    await expectFullyInViewport(page, homeHeading);
    await expectFullyInViewport(page, input);
    await captureVisual(page, `customer-ai-first-home-primary-${viewport.suffix}`, {
      scope: homeHeading,
      fullPage: false,
    });

    await resources.scrollIntoViewIfNeeded();
    const resourceLinks = resources.getByRole('link');
    await expect(resourceLinks).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      await expectFullyInViewport(page, resourceLinks.nth(index));
    }
    await captureVisual(page, `customer-home-shop-floor-tools-${viewport.suffix}`, {
      scope: resources,
      fullPage: false,
    });
  }
  if (original) await page.setViewportSize(original);
}

async function assertAiFirstHomeWithoutAbout(page, locale) {
  const copy = HOME_COPY[locale];
  if (locale === 'zh') await installChineseHostProxy(page);
  await page.goto(copy.url, { waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => window.location.hostname)).toBe(new URL(copy.url).hostname);

  const homeHeading = page.getByRole('heading', { name: copy.heading, exact: true });
  await expect(homeHeading).toBeVisible();
  const welcome = homeHeading.locator('xpath=ancestor::div[contains(@class, "max-w-4xl")][1]');
  const input = page.getByPlaceholder(copy.input, { exact: true });
  const toolResources = copy.tools.map((label) => welcome.getByRole('link', { name: new RegExp(`^${label}`) }));
  await expect(input).toBeVisible();
  for (const toolResource of toolResources) await expect(toolResource).toBeVisible();
  const resources = toolResources[0].locator('xpath=ancestor::div[contains(@class, "rounded-3xl")][1]');
  await expect(resources.getByRole('link')).toHaveCount(4);
  await expect(welcome.getByRole('link', { name: /Insights|行业观察/ })).toHaveCount(0);
  await expect(page.locator('[data-testid="tool-industry-tools"]:visible')).toBeVisible();
  await expect(page.getByText('Why choose SAGEMRO', { exact: false })).toHaveCount(0);
  await expect(page.getByText('为什么选择 SAGEMRO', { exact: false })).toHaveCount(0);
  await expect(page.locator('[data-testid="ServicePromiseSection"], ServicePromiseSection')).toHaveCount(0);

  if (locale === 'en') {
    await captureHomeEvidence(page, { homeHeading, input, resources });
  }
  await expect(page.getByRole('button', { name: copy.about, exact: true })).toHaveCount(0);
}

test('English and Chinese AI homes stay AI-first without the retired About entry', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const locale of ['en', 'zh']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await assertAiFirstHomeWithoutAbout(page, locale);
    } finally {
      await context.close();
    }
  }
});

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

async function openEngineerOrder(page, orderNo, workOrderId) {
  await page.reload();
  if (!new URL(page.url()).pathname.endsWith(`/work-orders/${workOrderId}`)) {
    const task = page.getByRole('button').filter({ hasText: orderNo });
    await expect(task).toBeVisible();
    await task.click();
  }
  await expect(page).toHaveURL(new RegExp(`/work-orders/${workOrderId}$`));
  await page.reload();
  await expect(page.getByText(`Work order · ${orderNo}`, { exact: true })).toBeVisible();
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
      const workOrderId = await workOrderIdFor(customerPage, orderNo);
      await openEngineerOrder(engineerPage, orderNo, workOrderId);
      await engineerPage.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
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
      await openEngineerOrder(engineerPage, orderNo, workOrderId);
      await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
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
      await engineerPage.getByLabel('Installment 2 Payment trigger', { exact: true }).selectOption('milestone');
      await engineerPage.getByLabel('Installment 2 Customer-visible description', { exact: true }).fill('Commissioning milestone');
      await expect(engineerPage.getByLabel('Installment 6 Amount', { exact: true })).toBeVisible();
      await captureBothViewports(engineerPage, '01-engineer-six-installments');
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
    const activeMilestones = panelByHeading(workOrderModal(customerPage), 'Your service progress');
    const activeTaskAlignment = activeMilestones.getByText('Task Alignment', { exact: true })
      .locator('xpath=ancestor::li[1]');
    await expect(activeTaskAlignment).toHaveAttribute('aria-current', 'step');
    await expect(activeTaskAlignment).toContainText('Current stage');
    await captureBothViewports(customerPage, '07-customer-active-service-milestones', {
      scope: activeMilestones,
    });

    await openEngineerOrder(engineerPage, orderNo, workOrderId);
    await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
    await engineerPage.getByRole('button', { name: 'Payments & receipts', exact: true }).click();
    const secondInstallment = engineerPage.locator('article').filter({ has: engineerPage.getByRole('heading', { name: 'Installment 2', exact: true }) });
    await secondInstallment.getByLabel('Confirm the agreed milestone', { exact: true }).fill('Customer confirmed commissioning milestone.');
    await secondInstallment.getByRole('button', { name: 'Start this installment collection', exact: true }).click();
    await expect(secondInstallment.getByRole('heading', { name: 'Request receipt confirmation', exact: true })).toBeVisible();
    await secondInstallment.getByLabel('Claimed amount').fill('600');
    await secondInstallment.getByLabel('Transaction reference (optional)').fill(`E2E-PARTIAL-${workOrderId}`);
    await secondInstallment.getByLabel('Collection note (optional)').fill('Partial receipt for visual acceptance');
    await captureBothViewports(engineerPage, '04-engineer-partial-receipt-claim');
    await secondInstallment.getByRole('button', { name: 'Request receipt confirmation', exact: true }).click();
    await expect(engineerPage.getByText('Waiting for Admin confirmation', { exact: true })).toBeVisible();

    await openAdminOrder(adminPage, orderNo);
    const receiptDialog = adminPage.getByRole('dialog', { name: 'Service Control View' });
    await expect(receiptDialog.getByRole('heading', { name: 'Pending receipt review', exact: true })).toBeVisible();
    const receiptPanel = panelByHeading(receiptDialog, 'Quote execution review');
    await expect(receiptPanel.getByText(/Claimed:\s*600 USD/)).toBeVisible();
    await captureBothViewports(adminPage, '05-admin-receipt-review', { scope: receiptPanel });
    await receiptDialog.getByRole('button', { name: 'Confirm partial amount', exact: true }).click();
    const partialReceiptDialog = adminPage.getByRole('dialog', { name: 'Confirm partial receipt' });
    await partialReceiptDialog.getByLabel('Confirmed amount').fill('500');
    await partialReceiptDialog.getByLabel('Adjustment reason (required)').fill('Bank fee held back 100 USD');
    await partialReceiptDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(receiptDialog.getByText('No receipt claims are waiting for review.', { exact: true })).toBeVisible();
    await expect(receiptPanel.getByText('500 USD', { exact: true })).toBeVisible();

    await openEngineerOrder(engineerPage, orderNo, workOrderId);
    await engineerPage.getByRole('tab', { name: 'Quote', exact: true }).click();
    await engineerPage.getByRole('button', { name: 'Payments & receipts', exact: true }).click();
    const partialInstallment = engineerPage.locator('article').filter({ has: engineerPage.getByRole('heading', { name: 'Installment 2', exact: true }) });
    await partialInstallment.getByLabel('Confirm the agreed milestone', { exact: true }).fill('Partial receipt confirmed; continue collecting the milestone balance.');
    await partialInstallment.getByRole('button', { name: 'Start this installment collection', exact: true }).click();
    await expect(partialInstallment.getByRole('heading', { name: 'Request receipt confirmation', exact: true })).toBeVisible();

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

    localD1(`
      UPDATE work_order_service_standard_progress
      SET state = 'legacy_not_recorded', updated_at = datetime('now')
      WHERE work_order_id = ${sqlText(workOrderId)}
        AND standard_version = 1
        AND step_key = 'task_alignment';
    `);
    expect(localD1Rows(`
      SELECT COUNT(*) AS count
      FROM work_order_service_standard_progress
      WHERE work_order_id = ${sqlText(workOrderId)}
        AND step_key = 'task_alignment'
        AND state = 'legacy_not_recorded'
    `)[0].count).toBe(3);
    await customerPage.reload();
    await openCustomerOrder(customerPage, orderNo);
    const legacyMilestones = panelByHeading(workOrderModal(customerPage), 'Your service progress');
    const legacyTaskAlignment = legacyMilestones.getByText('Task Alignment', { exact: true })
      .locator('xpath=ancestor::li[1]');
    await expect(legacyTaskAlignment).toContainText('Earlier service records were not itemized');
    await expect(legacyTaskAlignment).not.toHaveAttribute('aria-current', 'step');
    await captureBothViewports(customerPage, '08-customer-legacy-service-record-explanation', {
      scope: legacyMilestones,
    });

    await engineerPage.goBack();
    await expect(engineerPage).toHaveURL(new RegExp(`${new URL(runtime.engineerBase).pathname || '/'}$`));
    await expect(engineerPage.getByText('My work orders', { exact: true })).toBeVisible();
  } finally {
    await Promise.allSettled([
      adminContext?.close(),
      customerContext?.close(),
      engineerContext?.close(),
    ]);
  }
});
