import { expect, test } from '@playwright/test';

import { onboardEngineer } from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';
import {
  captureBothViewports,
  localD1,
  localD1Rows,
  sqlText,
} from '../support/visual.mjs';

const runtime = e2eRuntime();

const review = {
  version: 1,
  service_mode: 'remote',
  readiness: 'needs_confirmation',
  confirmed_facts: [{ label: 'Machine', detail: 'E2E-LASER-3015', source: 'work_order' }],
  gaps: [{ priority: 'high', category: 'alarm_code', detail: 'Alarm code is not confirmed.', why_it_matters: 'It narrows the diagnostic path.' }],
  customer_questions: [
    { priority: 'high', draft: 'Please send the current alarm code and a photo of the controller screen.' },
    { priority: 'medium', draft: 'Which software version is installed on the controller?' },
  ],
  service_mode_readiness: [{ item: 'Remote access', state: 'missing', detail: 'Confirm access method and customer test window.' }],
  media_review_required: false,
};

function workOrderMessageCount(workOrderId) {
  return localD1Rows(
    `SELECT COUNT(*) AS count FROM work_order_messages WHERE work_order_id = ${sqlText(workOrderId)}`,
  )[0].count;
}

test('engineer opens a cached AI readiness review and inserts questions as unsent drafts', async ({ browser }) => {
  test.setTimeout(300_000);
  const { engineer, context: engineerContext, page: engineerPage } = await onboardEngineer({ browser, runtime });

  try {
    const [engineerRow] = localD1Rows(
      `SELECT id FROM engineers WHERE lower(email) = lower(${sqlText(engineer.email)}) LIMIT 1`,
    );
    const customerId = `e2e-readiness-customer-${engineer.runId}`;
    const conversationId = `e2e-readiness-conv-${engineer.runId}`;
    const workOrderId = `e2e-readiness-wo-${engineer.runId}`;
    const orderNo = `WO-AI-${engineer.runId}`.slice(0, 42);

    // user_no 必须保持 U+数字：generateUserNo 取 MAX(user_no) + 1，非数字后缀会把后续 UI 注册
    // 污染成 'U000NaN' / 唯一键冲突。用高号段数字避免与顺序编号冲突。
    const customerUserNo = `U9${engineer.runId.replace(/\D/g, '').slice(-5)}`;

    // Local baseline schema.sql does not create conversation_summaries (production has it via
    // migration 014); the readiness route reads it once a source conversation is linked.
    localD1(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        protocol_version INTEGER NOT NULL DEFAULT 1,
        summary_json TEXT NOT NULL,
        source_message_count INTEGER NOT NULL,
        generated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      INSERT INTO customers (id, user_no, name, phone, email, password_hash)
      VALUES (
        ${sqlText(customerId)}, ${sqlText(customerUserNo)}, 'Readiness E2E Customer',
        ${sqlText(`+1888${engineer.runId.replace(/\D/g, '').slice(-7).padStart(7, '0')}`)},
        ${sqlText(`readiness-customer-${engineer.runId}@example.test`)}, 'local-e2e-hash'
      );
      INSERT INTO conversations (id, title, customer_id, created_at, updated_at)
      VALUES (
        ${sqlText(conversationId)}, 'E2E readiness source conversation',
        ${sqlText(customerId)}, datetime('now'), datetime('now')
      );
      INSERT INTO work_orders (
        id, order_no, customer_id, engineer_id, type, description, status,
        category_l1, category_l2, service_mode, created_at
      ) VALUES (
        ${sqlText(workOrderId)}, ${sqlText(orderNo)}, ${sqlText(customerId)}, ${sqlText(engineerRow.id)},
        'fault', 'Laser power drops during production.', 'in_progress',
        'laser_cutting', 'fault', 'remote', datetime('now')
      );
      INSERT INTO work_order_service_readiness (
        work_order_id, source_conversation_id, input_fingerprint, review_json,
        generation_state, generated_at, updated_at
      ) VALUES (
        ${sqlText(workOrderId)}, ${sqlText(conversationId)}, 'e2e-seeded-fingerprint',
        ${sqlText(JSON.stringify(review))}, 'ready', datetime('now'), datetime('now')
      );
    `);

    await engineerPage.goto(`${runtime.engineerBase}/work-orders/${workOrderId}`);
    const readinessHeading = engineerPage.getByRole('heading', { name: 'AI Service Readiness Review' });
    await expect(readinessHeading).toBeVisible();
    await expect(engineerPage.getByRole('heading', { name: 'Admin support' })).toBeVisible();

    // The readiness card must precede Admin support in the right rail.
    const headingOrder = await engineerPage.evaluate(() => {
      const texts = [...document.querySelectorAll('h2')].map((heading) => (heading.textContent || '').trim());
      return {
        readiness: texts.indexOf('AI Service Readiness Review'),
        support: texts.indexOf('Admin support'),
      };
    });
    expect(headingOrder.readiness).toBeGreaterThanOrEqual(0);
    expect(headingOrder.support).toBeGreaterThan(headingOrder.readiness);

    const card = readinessHeading.locator('xpath=ancestor::section[1]');
    await card.getByRole('button', { name: 'Open review', exact: true }).click();
    await expect(card.getByText(review.customer_questions[1].draft, { exact: true })).toBeVisible();
    await captureBothViewports(engineerPage, 'engineer-service-readiness');

    // First insert lands in the existing composer but is never sent automatically.
    await card.getByRole('button', { name: 'Insert into message', exact: true }).first().click();
    await expect(engineerPage.getByRole('tab', { name: 'Messages', exact: true })).toHaveAttribute('aria-selected', 'true');
    const composer = engineerPage.getByPlaceholder('Type a message...');
    await expect(composer).toHaveValue(review.customer_questions[0].draft);
    expect(workOrderMessageCount(workOrderId)).toBe(0);

    // A cancelled replacement keeps the engineer's manual draft untouched.
    const manualDraft = `Manual E2E draft ${engineer.runId}`;
    await composer.fill(manualDraft);
    await card.getByRole('button', { name: 'Insert into message', exact: true }).nth(1).click();
    await engineerPage.getByRole('button', { name: 'Keep my draft', exact: true }).click();
    await expect(composer).toHaveValue(manualDraft);
    expect(workOrderMessageCount(workOrderId)).toBe(0);
  } finally {
    await engineerContext.close();
  }
});
