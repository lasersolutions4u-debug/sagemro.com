import { expect, test } from '@playwright/test';

import { e2eRuntime } from '../support/runtime.mjs';

// 主站（营销落地页）最小浏览器回归：首屏 AI 对话框 + 咨询线索表单。
// 两个接口都用 route 拦截：/api/chat 用固定 SSE 片段（不依赖 OpenAI 额度），
// /api/contact 只校验请求体，避免写生产/本地库带来的状态耦合。
const runtime = e2eRuntime();

test('public home embeds the AI chat and keeps the consultation form', async ({ page }) => {
  const chatRequests = [];
  await page.route('**/api/chat', async (route) => {
    chatRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: 'data: {"content":"Alarm 4020 on a fiber laser usually points to a gas or pressure deviation."}\n\ndata: [DONE]\n\n',
    });
  });

  let consultation = null;
  await page.route('**/api/contact', async (route) => {
    consultation = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, lead_id: 'lead-e2e-fixture' }),
    });
  });

  await page.goto(`${runtime.publicBase}/`, { waitUntil: 'domcontentloaded' });

  // 首屏直接嵌入了 AI 对话框
  const panel = page.locator('[data-home-chat="panel"]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Ask SAGEMRO AI');

  // 发一条消息：断言确实打到 /api/chat，并且流式回复渲染出来
  await page.locator('#home-chat-input').fill('Fiber laser, alarm 4020, cut quality dropped');
  await page.locator('[data-home-chat="send"]').click();
  await expect(page.locator('[data-home-chat="assistant"]')).toContainText('Alarm 4020');
  expect(chatRequests).toHaveLength(1);
  expect(chatRequests[0].message).toContain('4020');
  expect(chatRequests[0].user_type).toBe('guest');

  // 咨询线索表单仍然是主站转化入口：打开 → 填必填项 → 提交 → 断言请求体
  await page.getByRole('button', { name: 'Request a consultation' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Request a consultation' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name').fill('E2E Contact');
  await dialog.getByLabel('Email').fill('e2e-contact@example.test');
  await dialog.getByLabel('Equipment, fault, or requirement').fill('Alarm 4020 on a fiber laser.');
  await dialog.getByRole('button', { name: 'Send request' }).click();

  await expect(dialog).toBeHidden();
  expect(consultation).not.toBeNull();
  expect(consultation.name).toBe('E2E Contact');
  expect(consultation.email).toBe('e2e-contact@example.test');
  expect(consultation.source).toBe('website_contact');
});
