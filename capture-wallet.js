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

// Scroll the dashboard modal to show a specific heading text
async function scrollToHeading(page, headingText) {
  await page.evaluate((text) => {
    const modals = document.querySelectorAll('[class*="overflow-auto"]');
    for (const m of modals) {
      const headings = m.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const h of headings) {
        if (h.textContent.includes(text)) {
          // Scroll so the heading is at the top of the modal
          m.scrollTo(0, h.offsetTop - 20);
          return;
        }
      }
    }
  }, headingText);
  await sleep(500);
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });

  try {
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    await loginAs(page, '13900018888', '123456');

    // Open engineer dashboard
    const avatarBtn = page.locator('[data-testid="user-avatar-button"]');
    if (await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn.click({ force: true });
      await sleep(3000);
    }

    // #4: Wallet balance — scroll to top of modal to show wallet overview
    await page.evaluate(() => {
      const modals = document.querySelectorAll('[class*="overflow-auto"]');
      for (const m of modals) {
        m.scrollTo(0, 0);
        break;
      }
    });
    await sleep(500);
    await screenshot(page, '04-钱包余额.png');

    // #10: Wallet history — scroll to "钱包流水" heading in the modal
    await scrollToHeading(page, '钱包流水');
    await screenshot(page, '10-钱包流水.png');

    // Close dashboard modal by clicking overlay
    const overlay = page.locator('.fixed.inset-0.bg-black\\/50').first();
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.click({ force: true, position: { x: 10, y: 10 } });
      await sleep(1500);
    } else {
      await page.keyboard.press('Escape');
      await sleep(1500);
    }

    // Reopen engineer dashboard for #11
    const avatarBtn2 = page.locator('[data-testid="user-avatar-button"]');
    if (await avatarBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn2.click({ force: true });
      await sleep(3000);
    }

    // Click withdraw
    const wdBtn = page.locator('button:has-text("申请提现")');
    if (await wdBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wdBtn.click({ force: true });
      await sleep(1500);
    }
    await screenshot(page, '11-提现页面.png');

    console.log('\n=== Done! ===');
  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
