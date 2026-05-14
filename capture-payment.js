const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://sagemro.com';
const API = 'https://sagemro-api.lasersolutions4u.workers.dev';
const OUT = path.join(__dirname, 'docs', '截图附件');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function screenshot(page, name) {
  const fp = path.join(OUT, name);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`  ✓ ${name}`);
}

async function loginAs(page, phone, password) {
  const logoutBtn = page.locator('[data-testid="logout-button"]');
  if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutBtn.click();
    await sleep(1000);
  }
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

(async () => {
  console.log('=== Capture Payment Flow ===\n');

  // Step 1: Create WO, accept, price via API
  console.log('Step 1: API setup...');
  const custLogin = await api('/api/auth/login', 'POST', { phone: '13900008888', password: '123456' });
  const custToken = custLogin.token;
  const engLogin = await api('/api/auth/login', 'POST', { phone: '13900018888', password: '123456' });
  const engToken = engLogin.token;

  const woResult = await api('/api/workorders', 'POST', {
    customer_id: custLogin.user.id,
    type: 'fault',
    description: '通快TRUMPF激光切割机3000W切割6mm碳钢严重挂渣毛刺，切割断面波纹，需要工程师上门检修。山东济南。',
    urgency: 'urgent',
  }, custToken);

  const orderNo = woResult.work_order?.order_no;
  if (!orderNo) { console.error('Failed:', woResult); return; }
  console.log(`  WO: ${orderNo}`);

  const engTickets = await api('/api/engineers/tickets', 'GET', null, engToken);
  const wo = engTickets.work_orders?.find(w => w.order_no === orderNo);
  if (!wo) { console.error('Eng cannot find WO'); return; }

  await api('/api/engineers/tickets/accept', 'POST', { work_order_id: wo.id }, engToken);
  await api(`/api/workorders/${wo.id}/pricing`, 'POST', {
    labor_fee: 2000, parts_fee: 1200, travel_fee: 300, other_fee: 0, parts_detail: '切割头喷嘴 × 2，单价600元',
  }, engToken);
  console.log('  Setup done');

  // Step 2: Browser flow
  console.log('\nStep 2: Browser screenshots...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });

  try {
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(page, '13900008888', '123456');

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
    await sleep(3000);

    // Switch to "报价确认" tab (in detail modal)
    const tabBtn = page.locator('button:has-text("报价确认")').last();
    if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabBtn.click({ force: true });
      await sleep(2000);
    } else {
      console.log('  Pricing tab not found!');
    }

    // Click "确认报价" (green button in pricing panel, NOT the tab)
    // Use the green bg class to distinguish from the tab button
    const confirmBtn1 = page.locator('button.bg-green-500:has-text("确认报价")');
    if (await confirmBtn1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn1.click({ force: true });
      console.log('  Clicked 确认报价 (open confirm panel)');
      await sleep(1500);
    } else {
      console.log('  First confirm button not found, trying generic...');
      // Fallback: click any non-tab "确认报价"
      const allConfirm = page.locator('button:has-text("确认报价")');
      const count = await allConfirm.count();
      if (count >= 2) {
        await allConfirm.nth(1).click({ force: true }); // second one should be the panel button
        await sleep(1500);
      }
    }

    // Click actual confirm button using data-testid
    const confirmBtn2 = page.locator('[data-testid="confirm-pricing-button"]');
    if (await confirmBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmBtn2.click({ force: true });
      console.log('  Clicked confirm-pricing-button');
      await sleep(2500);
    } else {
      console.log('  confirm-pricing-button not found, checking page state...');
      // Try API confirm as fallback
      const result = await api(`/api/workorders/${wo.id}/pricing/confirm`, 'POST', {}, custToken);
      console.log('  API confirm result:', result.success ? 'OK' : JSON.stringify(result));
      await sleep(2000);
    }

    // Now "去付款" should be visible
    const payBtn = page.locator('button:has-text("去付款")');
    if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await payBtn.click({ force: true });
      console.log('  Clicked 去付款');
      await sleep(2000);
    } else {
      console.log('  去付款 still not found!');
    }

    // #8: Payment modal
    await screenshot(page, '08-付款弹窗.png');

    // Click confirm payment
    const confirmPay = page.locator('button:has-text("确认付款"), button:has-text("确认支付")');
    if (await confirmPay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmPay.click({ force: true });
      console.log('  Clicked 确认付款');
      await sleep(3000);
    }

    // #9: Payment success
    await screenshot(page, '09-付款成功.png');

    console.log('\n=== Done! ===');
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
  } finally {
    await browser.close();
  }
})();
