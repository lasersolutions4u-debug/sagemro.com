const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://sagemro.com';
const OUT = path.join(__dirname, 'docs', '截图附件');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });

  try {
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(page, '13900008888', '123456');

    // Start new chat
    const newChatBtn = page.locator('[data-testid="new-chat-button"]');
    if (await newChatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatBtn.click();
      await sleep(1000);
    }

    // Send problem
    console.log('Sending problem...');
    const chatInput = page.locator('textarea').first();
    await chatInput.waitFor({ state: 'visible', timeout: 10000 });
    await chatInput.fill('我是山东济南的客户，百超Bystronic折弯机Xpert 150/3100出了故障，液压系统压力忽高忽低不稳定，导致折弯角度偏差很大，产品不合格。设备已经停机，生产线受到影响，需要尽快安排工程师上门检修。');
    await sleep(300);
    await chatInput.press('Enter');

    // Wait for AI response
    console.log('Waiting for AI...');
    await sleep(20000);

    // Get AI response text
    const bodyText = await page.locator('body').textContent();

    // Look for AI message content - find the last assistant message
    const assistantMsgs = await page.locator('[class*="assistant"], [class*="message"]').all();
    console.log(`Found ${assistantMsgs.length} message elements`);

    // Save page content snippet for debugging
    const snippet = bodyText.slice(bodyText.length - 2000);
    console.log('=== Last 2000 chars of page ===');
    console.log(snippet);
    console.log('=== END ===');

    // Take debug screenshot
    await page.screenshot({ path: path.join(OUT, 'debug-ai-response.png'), fullPage: false });

    // Check for keyword matches
    const keywords = ['汇总', '确认无误', '工单信息', '帮您确认', '提交工单', '确认一下', '报修'];
    for (const kw of keywords) {
      console.log(`  "${kw}" in page: ${bodyText.includes(kw)}`);
    }

    // Now try sending confirmation
    console.log('\nSending confirmation...');
    const input2 = page.locator('textarea').first();
    await input2.fill('确认，马上提交！');
    await sleep(300);
    await input2.press('Enter');
    await sleep(15000);

    // Check for WO number
    const finalText = await page.locator('body').textContent();
    const woMatch = finalText.match(/WO-\d{8}-\d{3,4}/g);
    console.log(`Work orders found: ${woMatch ? woMatch.join(', ') : 'none'}`);

    await page.screenshot({ path: path.join(OUT, 'debug-after-confirm.png'), fullPage: false });

    await page.close();
  } finally {
    await browser.close();
  }
})();
