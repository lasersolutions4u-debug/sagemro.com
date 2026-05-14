const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://sagemro.com';
const OUT = path.join(__dirname, 'docs', '截图附件');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(page, name) {
  const fp = path.join(OUT, name);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`  ✓ ${name}`);
}

async function ensureLoggedOut(page) {
  const logoutBtn = page.locator('[data-testid="logout-button"]');
  if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutBtn.click();
    await sleep(1000);
  }
}

async function loginAs(page, phone, password) {
  await ensureLoggedOut(page);
  const loginBtn = page.locator('[data-testid="sidebar-login-button"]');
  try {
    await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    const userBtn = page.locator('[data-testid="user-avatar-button"]');
    if (await userBtn.isVisible({ timeout: 2000 }).catch(() => false)) return;
    throw new Error('Cannot find login button');
  }
  await loginBtn.click();
  await sleep(800);
  await page.locator('input[type="tel"]').first().fill(phone);
  await sleep(200);
  await page.locator('input[type="password"]').first().fill(password);
  await sleep(200);
  await page.locator('[data-testid="login-submit-button"]').click();
  await sleep(2000);
}

async function openWorkOrder(page, orderNo) {
  // Open My Work Orders
  const moBtn = page.locator('[data-testid="tool-my-work-orders"]');
  if (await moBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await moBtn.click();
  } else {
    await page.locator('button:has-text("我的工单")').first().click();
  }
  await sleep(2000);

  // Click on WO
  try {
    await page.locator(`text=${orderNo}`).first().click({ timeout: 5000 });
  } catch {
    await page.evaluate(() => window.scrollTo(0, 500));
    await sleep(500);
    await page.locator(`text=${orderNo}`).first().click({ timeout: 5000 });
  }
  // Wait for detail modal to load
  await sleep(3000);
}

// Click a tab inside the detail modal using force:true to bypass overlay interception
async function clickTab(page, tabLabel) {
  // Find tab buttons inside the detail modal
  // Tabs are rendered as buttons with border-b-2 styling
  const tab = page.locator(`button:has-text("${tabLabel}")`).last(); // last one is inside detail modal
  try {
    await tab.waitFor({ state: 'visible', timeout: 5000 });
    await tab.click({ force: true });
    await sleep(1500);
    return true;
  } catch {
    console.log(`  Tab "${tabLabel}" not found`);
    return false;
  }
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });

  try {
    // ===== 01-02: WO-20260514-986 (in_service, has pricing) =====
    console.log('\n=== 01-02: WO-20260514-986 ===');
    const p1 = await context.newPage();
    await p1.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p1, '13900008888', '123456');
    await openWorkOrder(p1, 'WO-20260514-986');

    // #1: Info tab (default)
    await screenshot(p1, '01-工单详情.png');

    // #2: Switch to pricing tab
    await clickTab(p1, '报价确认');
    await screenshot(p1, '02-报价明细.png');
    await p1.close();

    // ===== 03: WO-20260511-866 (completed, has rating) =====
    console.log('\n=== 03: WO-20260511-866 ===');
    const p2 = await context.newPage();
    await p2.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p2, '13900008888', '123456');
    await openWorkOrder(p2, 'WO-20260511-866');

    // #3: Switch to rating tab
    await clickTab(p2, '评价');
    await screenshot(p2, '03-客户评价.png');
    await p2.close();

    // ===== 04 & 10: Engineer Wallet =====
    console.log('\n=== 04 & 10: Engineer Wallet ===');
    const p3 = await context.newPage();
    await p3.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p3, '13900018888', '123456');

    const avatarBtn = p3.locator('[data-testid="user-avatar-button"]');
    if (await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn.click();
      await sleep(2500);
    }
    await screenshot(p3, '04-钱包余额.png');

    // Scroll down for wallet history
    await p3.evaluate(() => window.scrollTo(0, 800));
    await sleep(1000);
    await screenshot(p3, '10-钱包流水.png');
    await p3.close();

    // ===== 11: Withdraw =====
    console.log('\n=== 11: Withdraw ===');
    const p4 = await context.newPage();
    await p4.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p4, '13900018888', '123456');

    const avatarBtn2 = p4.locator('[data-testid="user-avatar-button"]');
    if (await avatarBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn2.click();
      await sleep(2500);
    }

    const wdBtn = p4.locator('button:has-text("申请提现"), button:has-text("提现")');
    if (await wdBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wdBtn.click();
      await sleep(1500);
    }
    await screenshot(p4, '11-提现页面.png');
    await p4.close();

    console.log('\n=== Done! ===');
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
