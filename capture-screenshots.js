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
  // Check if logout button is visible
  const logoutBtn = page.locator('[data-testid="logout-button"]');
  if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutBtn.click();
    await sleep(1000);
    console.log('  Logged out');
  }
}

async function loginAs(page, phone, password) {
  await ensureLoggedOut(page);

  // Click login button in sidebar
  const loginBtn = page.locator('[data-testid="sidebar-login-button"]');
  try {
    await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    console.log('  Login button not found, checking if already logged in...');
    const userBtn = page.locator('[data-testid="user-avatar-button"]');
    if (await userBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Already logged in, proceeding');
      return;
    }
    throw new Error('Cannot find login button');
  }
  await loginBtn.click();
  await sleep(800);

  // Fill phone
  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.waitFor({ state: 'visible', timeout: 5000 });
  await phoneInput.fill(phone);
  await sleep(200);

  // Fill password
  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill(password);
  await sleep(200);

  // Submit
  const submitBtn = page.locator('[data-testid="login-submit-button"]');
  await submitBtn.click();
  await sleep(2000);
  console.log(`  Logged in as ${phone}`);
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });

  try {
    // ===== PHASE 1: Customer - Completed Order WO-20260511-866 =====
    console.log('\n=== Phase 1: Customer viewing completed order ===');
    const p1 = await context.newPage();
    await p1.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    await loginAs(p1, '13900008888', '123456');

    // Open My Work Orders
    console.log('Opening My Work Orders...');
    const myOrdersBtn = p1.locator('[data-testid="tool-my-work-orders"]');
    if (await myOrdersBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await myOrdersBtn.click();
    } else {
      // Try by text
      await p1.locator('button:has-text("我的工单")').first().click();
    }
    await sleep(1500);

    // Click on WO-20260511-866
    console.log('Opening WO-20260511-866...');
    try {
      await p1.locator('text=WO-20260511-866').first().click({ timeout: 5000 });
    } catch {
      // Scroll to find it
      console.log('  Scrolling to find WO-20260511-866...');
      await p1.evaluate(() => window.scrollTo(0, 500));
      await sleep(500);
      await p1.locator('text=WO-20260511-866').first().click({ timeout: 5000 });
    }
    await sleep(1500);

    // #1: Work order detail (info tab)
    await screenshot(p1, '01-工单详情.png');

    // #2: Pricing details tab
    const pricingTab = p1.locator('button:has-text("报价确认")');
    if (await pricingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pricingTab.click();
      await sleep(1000);
    }
    await screenshot(p1, '02-报价明细.png');

    // #3: Rating tab
    const ratingTab = p1.locator('button:has-text("评价")');
    if (await ratingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ratingTab.click();
      await sleep(1000);
    }
    await screenshot(p1, '03-客户评价.png');

    await p1.close();

    // ===== PHASE 2: Engineer Dashboard =====
    console.log('\n=== Phase 2: Engineer Dashboard ===');
    const p2 = await context.newPage();
    await p2.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    await loginAs(p2, '13900018888', '123456');

    // Open engineer dashboard via avatar button
    console.log('Opening engineer dashboard...');
    const avatarBtn = p2.locator('[data-testid="user-avatar-button"]');
    if (await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn.click();
      await sleep(2000);
    } else {
      console.log('  Avatar button not found, checking for dashboard link...');
      await p2.locator('button:has-text("工作台")').first().click({ timeout: 3000 });
      await sleep(1500);
    }

    // #4: Wallet balance
    await screenshot(p2, '04-钱包余额.png');

    // #10: Wallet history (scroll to find it)
    const historyText = p2.locator('text=钱包流水');
    if (await historyText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyText.scrollIntoViewIfNeeded();
      await sleep(500);
    }
    await screenshot(p2, '10-钱包流水.png');

    // #11: Withdraw
    const withdrawBtn = p2.locator('button:has-text("申请提现")');
    if (await withdrawBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await withdrawBtn.click();
      await sleep(1000);
    }
    await screenshot(p2, '11-提现页面.png');

    await p2.close();

    // ===== PHASE 3: New Work Order + Full Flow =====
    console.log('\n=== Phase 3: New Work Order Workflow ===');
    const p3 = await context.newPage();

    // Check for any existing pending work orders first - delete old ones if needed
    // Start fresh

    await p3.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p3, '13900008888', '123456');

    // Start a new chat
    console.log('Starting new chat...');
    const newChatBtn = p3.locator('[data-testid="new-chat-button"]');
    if (await newChatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatBtn.click();
      await sleep(1000);
    }

    // Find chat input and send problem
    console.log('Sending problem to AI...');
    const chatInput = p3.locator('textarea').first();
    await chatInput.waitFor({ state: 'visible', timeout: 10000 });
    const problemMsg = '我的通快TRUMPF激光切割机3000W，切割6mm碳钢时出现严重挂渣和毛刺，切割断面有波纹，需要工程师上门检修。我在山东济南。这是紧急问题，已经影响生产。';
    await chatInput.fill(problemMsg);
    await sleep(300);

    // Press Enter to send (InputArea handles Enter key)
    await chatInput.press('Enter');
    console.log('  Waiting for AI to respond...');
    await sleep(15000); // Wait for AI streaming response

    // Check what AI said
    const pageText = await p3.locator('body').textContent();
    console.log(`  Page contains "汇总": ${pageText.includes('汇总')}`);
    console.log(`  Page contains "确认": ${pageText.includes('确认')}`);

    // Send confirmation to trigger work order creation
    console.log('Sending confirmation...');
    const chatInput2 = p3.locator('textarea').first();
    if (await chatInput2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput2.fill('确认，马上提交！');
      await sleep(300);
      await chatInput2.press('Enter');
      console.log('  Waiting for work order creation...');
      await sleep(15000);
    }

    // #5: AI recommended engineers / work order created
    await screenshot(p3, '05-AI推荐工程师.png');

    // Extract work order number
    const fullText = await p3.locator('body').textContent();
    const woMatch = fullText.match(/WO-\d{8}-\d{3,4}/g);
    const newOrderNo = woMatch ? woMatch[woMatch.length - 1] : null;
    console.log(`  New work order: ${newOrderNo || 'NOT FOUND'}`);
    console.log(`  All WOs found: ${woMatch ? woMatch.join(', ') : 'none'}`);

    // Check for WO in the visible page
    const woElements = await p3.locator('[class*="order"], [class*="ticket"], [class*="card"]').count();
    console.log(`  Order elements on page: ${woElements}`);

    await p3.close();

    if (newOrderNo) {
      // ===== PHASE 4: Engineer accepts & quotes =====
      console.log(`\n=== Phase 4: Engineer processes ${newOrderNo} ===`);
      const p4 = await context.newPage();
      await p4.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);
      await loginAs(p4, '13900018888', '123456');

      // Open engineer dashboard
      const avatarBtn2 = p4.locator('[data-testid="user-avatar-button"]');
      if (await avatarBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await avatarBtn2.click();
        await sleep(2000);
      }

      // Look for pending tickets section and accept the new one
      console.log(`Looking for ${newOrderNo} to accept...`);
      const pendingSection = p4.locator('text=推荐工单, text=待接单').first();
      if (await pendingSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pendingSection.scrollIntoViewIfNeeded();
        await sleep(500);
      }

      // Find and click the work order to view details
      try {
        await p4.locator(`text=${newOrderNo}`).first().click({ timeout: 5000 });
        await sleep(1000);
      } catch {
        console.log(`  Cannot find ${newOrderNo} in engineer view`);
      }

      // Accept button
      const acceptBtn = p4.locator('[data-testid="accept-ticket-button"]');
      if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn.click();
        await sleep(2000);
        console.log('  Work order accepted');
      } else {
        console.log('  Accept button not found');
      }

      // Navigate to pricing tab
      const engPricingTab = p4.locator('button:has-text("核价")');
      if (await engPricingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await engPricingTab.click();
        await sleep(1000);
      }

      await screenshot(p4, '06-工程师报价.png');

      // Try to fill in pricing and submit
      // Look for pricing form inputs
      const laborInput = p4.locator('input').first();
      // Check if pricing form is visible
      const hasPricingForm = await p4.locator('[class*="pricing"], [class*="Pricing"]').first().isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`  Pricing form visible: ${hasPricingForm}`);

      await p4.close();

      // ===== PHASE 5: Customer confirms & pays =====
      console.log(`\n=== Phase 5: Customer confirms ${newOrderNo} ===`);
      const p5 = await context.newPage();
      await p5.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);
      await loginAs(p5, '13900008888', '123456');

      // Open My Work Orders
      const myOrdersBtn2 = p5.locator('[data-testid="tool-my-work-orders"]');
      if (await myOrdersBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await myOrdersBtn2.click();
        await sleep(1500);
      }

      // Click on the new work order
      try {
        await p5.locator(`text=${newOrderNo}`).first().click({ timeout: 5000 });
        await sleep(1500);
      } catch {
        console.log(`  Cannot find ${newOrderNo} in customer tickets`);
      }

      // #7: Confirm quote tab
      const confirmTab = p5.locator('button:has-text("报价确认")');
      if (await confirmTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmTab.click();
        await sleep(1000);
      }
      await screenshot(p5, '07-确认报价.png');

      // #8: Payment popup
      const payBtn = p5.locator('button:has-text("去付款")');
      if (await payBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await payBtn.click();
        await sleep(1500);
      }
      await screenshot(p5, '08-付款弹窗.png');

      // #9: Payment success
      const confirmPayBtn = p5.locator('button:has-text("确认付款"), button:has-text("确认支付")');
      if (await confirmPayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmPayBtn.click();
        await sleep(3000);
      }
      await screenshot(p5, '09-付款成功.png');

      await p5.close();
    } else {
      console.log('\n  No new work order created, skipping phases 4-5');
      console.log('  Capturing whatever is available on screens 5-9...');
    }

    console.log('\n=== Done! ===');

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
