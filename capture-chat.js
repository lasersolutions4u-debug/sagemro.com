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

(async () => {
  console.log('=== Chat Screenshot with WO Creation ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });

  try {
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(page, '13900008888', '123456');
    console.log('  Logged in');

    // Start new chat
    const newChatBtn = page.locator('[data-testid="sidebar-new-chat"], button:has-text("新建对话")');
    if (await newChatBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newChatBtn.click();
      await sleep(1500);
    }

    // Round 1: Send fault description
    const inputArea = page.locator('textarea').first();
    await inputArea.waitFor({ state: 'visible', timeout: 5000 });
    await inputArea.click();
    await sleep(300);

    const msg1 = '百超Bystronic折弯机Xpert 150/3100液压系统压力不稳定，折弯角度偏差大，设备已停机，需要工程师上门检修。山东济南。';
    await inputArea.fill(msg1);
    console.log('  Round 1: sent fault description');
    await sleep(300);

    const sendBtn = page.locator('[data-testid="chat-send-button"], button[aria-label="发送"]').first();
    if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sendBtn.click();
    } else {
      await inputArea.press('Enter');
    }

    // Wait for AI first response
    await sleep(20000);
    console.log('  Round 1: AI responded');

    // Round 2: Confirm
    const input2 = page.locator('textarea').first();
    await input2.waitFor({ state: 'visible', timeout: 5000 });
    await input2.fill('确认，请马上提交工单');
    await sleep(300);

    const sendBtn2 = page.locator('[data-testid="chat-send-button"], button[aria-label="发送"]').first();
    if (await sendBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sendBtn2.click();
    } else {
      await input2.press('Enter');
    }
    console.log('  Round 2: sent confirmation');

    // Wait for WO creation
    await sleep(20000);
    console.log('  Round 2: AI responded');

    // Check if WO was created
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasWO = pageText.includes('WO-');
    console.log('  Contains WO-:', hasWO);

    // Scroll chat to top to show the full conversation
    await page.evaluate(() => {
      const chatArea = document.querySelector('[class*="overflow"]');
      if (chatArea) chatArea.scrollTop = 0;
    });
    await sleep(500);

    await screenshot(page, '05-AI推荐工程师.png');
    console.log('\n=== Done! ===');
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
