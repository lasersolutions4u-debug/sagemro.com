const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://sagemro.com';
const API = 'https://sagemro-api.lasersolutions4u.workers.dev';
const OUT = path.join(__dirname, 'docs', '截图附件');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// API helpers
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

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });

  try {
    // ===== STEP 1: Create new WO via API (chat simulation) =====
    console.log('\n=== Step 1: Login & create new WO ===');
    const custLogin = await api('/api/auth/login', 'POST', {
      phone: '13900008888', password: '123456',
    });
    const custToken = custLogin.token;
    console.log(`  Customer logged in, id: ${custLogin.user?.id}`);

    const engLogin = await api('/api/auth/login', 'POST', {
      phone: '13900018888', password: '123456',
    });
    const engToken = engLogin.token;
    console.log(`  Engineer logged in, id: ${engLogin.user?.id}`);

    // Create WO directly via API
    const woResult = await api('/api/workorders', 'POST', {
      customer_id: custLogin.user.id,
      type: 'fault',
      description: '百超Bystronic折弯机Xpert 150/3100液压系统压力不稳定，折弯角度偏差大，设备已停机，需要工程师上门检修。山东济南。紧急。',
      urgency: 'urgent',
    }, custToken);

    let orderNo;
    if (woResult.success && woResult.work_order) {
      orderNo = woResult.work_order.order_no;
      console.log(`  Created WO: ${orderNo}`);
    } else {
      console.log('  WO creation result:', JSON.stringify(woResult).slice(0, 200));
      // Try to find from ticket list
      const tickets = await api('/api/workorders', 'GET', null, custToken);
      const wos = tickets.work_orders || [];
      if (wos.length > 0) {
        orderNo = wos[0].order_no;
        console.log(`  Found latest WO: ${orderNo}`);
      }
    }

    if (!orderNo) {
      console.error('  Cannot find/create WO, aborting');
      await browser.close();
      return;
    }

    // Get wo.id
    const tickets = await api('/api/engineers/tickets', 'GET', null, engToken);
    const wo = tickets.work_orders?.find(w => w.order_no === orderNo);
    if (!wo) {
      console.error(`  Engineer cannot find ${orderNo}`);
      console.log('  Available:', tickets.work_orders?.map(w => w.order_no + ':' + w.status).join(', '));
      await browser.close();
      return;
    }
    const woId = wo.id;
    console.log(`  WO id: ${woId}, status: ${wo.status}`);

    // ===== STEP 2: #5 AI推荐工程师 - capture chat conversation =====
    console.log('\n=== Screenshot #5: AI推荐工程师 ===');
    const p5 = await context.newPage();
    await p5.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p5, '13900008888', '123456');
    // Try to find the WO in chat - click on conversation
    const chatItems = await p5.locator('[class*="conversation"], [class*="chat-item"], [class*="ChatHistory"] a, [class*="ChatHistory"] button').all();
    console.log(`  Chat items: ${chatItems.length}`);
    if (chatItems.length > 0) {
      await chatItems[0].click();
      await sleep(2000);
    }
    await screenshot(p5, '05-AI推荐工程师.png');
    await p5.close();

    // ===== STEP 3: Accept + Price via API =====
    console.log('\n=== Step 3: Accept & Price ===');

    // Accept WO
    if (wo.status === 'pending') {
      const acceptResult = await api('/api/engineers/tickets/accept', 'POST', {
        work_order_id: woId,
      }, engToken);
      console.log(`  Accept: ${acceptResult.success ? 'OK' : JSON.stringify(acceptResult)}`);
    }

    // Submit pricing
    const pricingResult = await api(`/api/workorders/${woId}/pricing`, 'POST', {
      labor_fee: 1500,
      parts_fee: 800,
      travel_fee: 300,
      other_fee: 0,
      parts_detail: '激光器镜片 × 1，单价800元',
    }, engToken);
    console.log(`  Pricing: ${pricingResult.success ? 'OK, subtotal=' + pricingResult.subtotal : JSON.stringify(pricingResult)}`);

    // ===== Screenshot #6: 工程师报价 =====
    console.log('\n=== Screenshot #6: 工程师报价 ===');
    const p6 = await context.newPage();
    await p6.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p6, '13900018888', '123456');
    // Open engineer dashboard
    const avatarBtn = p6.locator('[data-testid="user-avatar-button"]');
    if (await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn.click();
      await sleep(2000);
    }
    // Find and click the WO
    try {
      await p6.locator(`text=${orderNo}`).first().click({ timeout: 5000 });
      await sleep(1500);
    } catch {
      console.log('  Could not click WO in engineer view, taking dashboard screenshot');
    }
    // Click pricing tab
    const pricingTab = p6.locator('button:has-text("核价")');
    if (await pricingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pricingTab.click();
      await sleep(1000);
    }
    await screenshot(p6, '06-工程师报价.png');
    await p6.close();

    // ===== STEP 4: Customer confirm + pay via API =====
    console.log('\n=== Step 4: Confirm & Pay ===');

    const confirmResult = await api(`/api/workorders/${woId}/pricing/confirm`, 'POST', {}, custToken);
    console.log(`  Confirm: ${confirmResult.success ? 'OK' : JSON.stringify(confirmResult)}`);

    const payResult = await api(`/api/workorders/${woId}/pay`, 'POST', {}, custToken);
    console.log(`  Pay: ${payResult.success ? 'OK' : JSON.stringify(payResult)}`);

    // ===== Screenshot #7: 确认报价 =====
    console.log('\n=== Screenshot #7: 确认报价 ===');
    const p7 = await context.newPage();
    await p7.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(p7, '13900008888', '123456');
    // My Work Orders
    const moBtn = p7.locator('[data-testid="tool-my-work-orders"]');
    if (await moBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moBtn.click();
    } else {
      await p7.locator('button:has-text("我的工单")').first().click();
    }
    await sleep(1500);
    try {
      await p7.locator(`text=${orderNo}`).first().click({ timeout: 5000 });
      await sleep(1500);
    } catch {
      console.log(`  Cannot find ${orderNo} in customer tickets`);
    }
    const cTab = p7.locator('button:has-text("报价确认")');
    if (await cTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cTab.click();
      await sleep(1000);
    }
    await screenshot(p7, '07-确认报价.png');
    await p7.close();

    // ===== For #8 and #9: We need a WO in "pricing" state to show payment flow =====
    // Create another WO for payment screenshots
    console.log('\n=== Step 5: Create 2nd WO for payment screenshots ===');
    const wo2Result = await api('/api/workorders', 'POST', {
      customer_id: custLogin.user.id,
      type: 'fault',
      description: '通快TRUMPF激光切割机3000W，切割6mm碳钢时出现严重挂渣和毛刺，切割断面有波纹。设备在山东济南，需要工程师上门检修。',
      urgency: 'urgent',
    }, custToken);

    let orderNo2;
    if (wo2Result.success && wo2Result.work_order) {
      orderNo2 = wo2Result.work_order.order_no;
    } else {
      const tickets2 = await api('/api/workorders', 'GET', null, custToken);
      const latest = tickets2.work_orders?.filter(w => w.order_no !== orderNo)?.[0];
      orderNo2 = latest?.order_no;
    }
    console.log(`  2nd WO: ${orderNo2}`);

    if (orderNo2) {
      // Find wo2
      const engTickets2 = await api('/api/engineers/tickets', 'GET', null, engToken);
      const wo2 = engTickets2.work_orders?.find(w => w.order_no === orderNo2);
      if (wo2) {
        // Accept
        if (wo2.status === 'pending') {
          await api('/api/engineers/tickets/accept', 'POST', { work_order_id: wo2.id }, engToken);
          console.log('  Accepted WO2');
        }
        // Submit pricing
        await api(`/api/workorders/${wo2.id}/pricing`, 'POST', {
          labor_fee: 2000, parts_fee: 1200, travel_fee: 300, other_fee: 0, parts_detail: '切割头喷嘴 × 2，单价600元',
        }, engToken);
        console.log('  Pricing submitted for WO2');

        // ===== Screenshot #8: 付款弹窗 (WO2 is in pricing state, ready to pay) =====
        console.log('\n=== Screenshot #8-9: Payment flow ===');
        const p8 = await context.newPage();
        await p8.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);
        await loginAs(p8, '13900008888', '123456');

        const moBtn2 = p8.locator('[data-testid="tool-my-work-orders"]');
        if (await moBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
          await moBtn2.click();
        } else {
          await p8.locator('button:has-text("我的工单")').first().click();
        }
        await sleep(1500);
        try {
          await p8.locator(`text=${orderNo2}`).first().click({ timeout: 5000 });
          await sleep(1500);
        } catch {
          await p8.evaluate(() => window.scrollTo(0, 500));
          await sleep(500);
          await p8.locator(`text=${orderNo2}`).first().click({ timeout: 5000 });
          await sleep(1500);
        }

        // Pricing tab
        const cTab2 = p8.locator('button:has-text("报价确认")');
        if (await cTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cTab2.click();
          await sleep(1000);
        }

        // #8: Payment popup
        const payBtn = p8.locator('button:has-text("去付款")');
        if (await payBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await payBtn.click();
          await sleep(1500);
        }
        await screenshot(p8, '08-付款弹窗.png');

        // #9: Confirm payment
        const confirmPayBtn = p8.locator('button:has-text("确认付款"), button:has-text("确认支付")');
        if (await confirmPayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmPayBtn.click();
          await sleep(3000);
        }
        await screenshot(p8, '09-付款成功.png');
        await p8.close();
      }
    }

    console.log('\n=== All done! ===');
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
