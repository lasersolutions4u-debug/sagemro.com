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

const guidance = {
  version: 2,
  step_key: 'risk_control',
  headline: 'Confirm the controller alarm before changing machine settings.',
  risk_level: 'high',
  observations: [{
    priority: 'high',
    detail: 'The current alarm code has not been recorded.',
    source: 'work_order',
  }],
  next_actions: [{
    priority: 'high',
    action: 'Verify the alarm and machine identity with the customer.',
    rationale: 'This avoids unsafe or irrelevant parameter changes.',
    related_item_key: 'risk.hazards_reviewed',
  }],
  customer_questions: [
    { priority: 'high', draft: 'Please send the current alarm code and a photo of the controller screen.' },
    { priority: 'medium', draft: 'Which software version is installed on the controller?' },
  ],
  evidence_needed: ['alarm_code', 'controller_screen'],
};

test('engineer follows service standards and AI guidance without automatic customer actions', async ({ browser }) => {
  test.setTimeout(600_000);
  const { engineer, context: engineerContext, page: engineerPage } = await onboardEngineer({ browser, runtime });

  try {
    const [engineerRow] = localD1Rows(
      `SELECT id FROM engineers WHERE lower(email) = lower(${sqlText(engineer.email)}) LIMIT 1`,
    );
    const customerId = `e2e-readiness-customer-${engineer.runId}`;
    const conversationId = `e2e-readiness-conv-${engineer.runId}`;
    const workOrderId = `e2e-readiness-wo-${engineer.runId}`;
    const noCacheWorkOrderId = `e2e-no-guidance-wo-${engineer.runId}`;
    const failedWorkOrderId = `e2e-failed-guidance-wo-${engineer.runId}`;
    const orderNo = `WO-AI-${engineer.runId}`.slice(0, 42);
    const generatedAt = '2026-07-29 08:00:00';

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
      INSERT INTO work_orders (
        id, order_no, customer_id, engineer_id, type, description, status,
        category_l1, category_l2, service_mode, created_at
      ) VALUES (
        ${sqlText(noCacheWorkOrderId)}, ${sqlText(`WO-NO-AI-${engineer.runId}`.slice(0, 42))},
        ${sqlText(customerId)}, ${sqlText(engineerRow.id)}, 'fault',
        'Service is under way without cached AI guidance.', 'in_service',
        'laser_cutting', 'fault', 'remote', datetime('now')
      );
      INSERT INTO work_orders (
        id, order_no, customer_id, engineer_id, type, description, status,
        category_l1, category_l2, service_mode, created_at
      ) VALUES (
        ${sqlText(failedWorkOrderId)}, ${sqlText(`WO-AI-FAIL-${engineer.runId}`.slice(0, 42))},
        ${sqlText(customerId)}, ${sqlText(engineerRow.id)}, 'fault',
        'Service continues under the fixed standard after AI failure.', 'in_service',
        'laser_cutting', 'fault', 'remote', datetime('now')
      );
      INSERT INTO work_order_service_readiness (
        work_order_id, source_conversation_id, input_fingerprint, guidance_version,
        current_step_key, trigger_reason, guidance_json, generation_state,
        generated_at, updated_at
      ) VALUES (
        ${sqlText(workOrderId)}, ${sqlText(conversationId)}, 'e2e-seeded-fingerprint',
        2, 'risk_control', 'seed', ${sqlText(JSON.stringify(guidance))},
        'ready', ${sqlText(generatedAt)}, datetime('now')
      );
      INSERT INTO work_order_service_readiness (
        work_order_id, input_fingerprint, guidance_version, current_step_key,
        trigger_reason, generation_state, last_error, updated_at
      ) VALUES (
        ${sqlText(failedWorkOrderId)}, 'e2e-failed-fingerprint', 2, 'task_alignment',
        'seed', 'failed', 'provider_unconfigured', datetime('now')
      );
      INSERT INTO work_order_service_standard_progress (
        work_order_id, standard_version, step_key, item_key, state,
        is_required, owner_type, confirmed_by_type, confirmed_by_id, confirmed_at
      ) VALUES
        (${sqlText(workOrderId)}, 1, 'task_alignment', 'task.device_identity',
          'confirmed', 1, 'engineer', 'engineer', ${sqlText(engineerRow.id)}, datetime('now')),
        (${sqlText(workOrderId)}, 1, 'task_alignment', 'task.problem_and_goal',
          'confirmed', 1, 'engineer', 'engineer', ${sqlText(engineerRow.id)}, datetime('now')),
        (${sqlText(workOrderId)}, 1, 'task_alignment', 'task.contact_and_window',
          'confirmed', 1, 'engineer', 'engineer', ${sqlText(engineerRow.id)}, datetime('now')),
        (${sqlText(workOrderId)}, 1, 'risk_control', 'risk.isolation_permission',
          'confirmed', 1, 'engineer', 'engineer', ${sqlText(engineerRow.id)}, datetime('now')),
        (${sqlText(workOrderId)}, 1, 'risk_control', 'risk.ppe_and_access',
          'confirmed', 0, 'engineer', 'engineer', ${sqlText(engineerRow.id)}, datetime('now')),
        (${sqlText(workOrderId)}, 1, 'one_visit_readiness', 'ready.tools_and_documents',
          'confirmed', 1, 'engineer', 'engineer', ${sqlText(engineerRow.id)}, datetime('now')),
        (${sqlText(workOrderId)}, 1, 'one_visit_readiness', 'ready.start_conditions',
          'confirmed', 1, 'admin', 'admin', 'e2e-admin', datetime('now'));
    `);

    await engineerPage.route(
      new RegExp(`/api/workorders/${noCacheWorkOrderId}/service-guidance/refresh$`),
      (route) => route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          state: 'generating',
          guidance: null,
          generated_at: null,
          guidance_version: null,
        }),
      }),
    );
    await engineerPage.goto(
      `${runtime.engineerBase}/work-orders/${noCacheWorkOrderId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(engineerPage.getByRole('heading', { name: 'Most important next step' })).toBeVisible();
    await expect(engineerPage.getByText(
      'Building the next-step guidance from current work-order evidence…',
      { exact: true },
    )).toBeVisible();

    let guidanceDisplayState = 'ready';
    let guidanceRefreshRequests = 0;
    await engineerPage.route(
      new RegExp(`/api/workorders/${workOrderId}/service-guidance$`),
      (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          state: guidanceDisplayState,
          guidance,
          generated_at: generatedAt,
          guidance_version: 2,
        }),
      }),
    );
    await engineerPage.route(
      new RegExp(`/api/workorders/${workOrderId}/service-guidance/refresh$`),
      (route) => {
        guidanceRefreshRequests += 1;
        guidanceDisplayState = 'stale';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            state: 'stale',
            guidance,
            generated_at: generatedAt,
            guidance_version: 2,
          }),
        });
      },
    );

    await engineerPage.goto(
      `${runtime.engineerBase}/work-orders/${workOrderId}`,
      { waitUntil: 'domcontentloaded' },
    );
    const guidanceHeading = engineerPage.getByRole('heading', { name: 'Most important next step' });
    const guidanceCard = guidanceHeading.locator('xpath=ancestor::section[1]');
    const progressHeading = engineerPage.getByRole('heading', { name: 'Six-step precision service track' });
    const stageHeading = engineerPage.getByRole('heading', { name: 'Risk control', exact: true });
    const stageSection = stageHeading.locator('xpath=ancestor::section[1]');
    await expect(guidanceHeading).toBeVisible();
    await expect(guidanceCard.getByText(guidance.headline, { exact: true })).toBeVisible();
    await expect(progressHeading).toBeVisible();
    await expect(stageHeading).toBeVisible();
    const currentStep = engineerPage.locator('[aria-current="step"]');
    await expect(currentStep.getByText('02', { exact: true })).toBeVisible();
    await expect(currentStep.getByText('Risk control', { exact: true })).toBeVisible();
    await expect(engineerPage.getByText(
      '1 required item blocks service start',
      { exact: true },
    )).toBeVisible();

    await captureBothViewports(engineerPage, 'engineer-standard-progress', {
      scope: progressHeading,
      fullPage: false,
    });
    await captureBothViewports(engineerPage, 'engineer-current-stage-checklist', {
      scope: stageHeading,
      fullPage: false,
    });
    await captureBothViewports(engineerPage, 'engineer-ai-guidance-ready', {
      scope: guidanceHeading,
      fullPage: false,
    });

    const navigationCount = await engineerPage.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    const riskItem = stageSection
      .getByRole('heading', { name: 'Review site and machine hazards', exact: true })
      .locator('xpath=ancestor::li[1]');
    await riskItem.getByRole('button', { name: 'Confirm complete', exact: true }).click();
    await expect(currentStep.getByText('Evidence-led work', { exact: true })).toBeVisible();
    expect(await engineerPage.evaluate(
      () => performance.getEntriesByType('navigation').length,
    )).toBe(navigationCount);

    await guidanceCard.getByRole('button', { name: 'Insert as message draft', exact: true }).first().click();
    await expect(engineerPage.getByRole('tab', { name: 'Messages', exact: true })).toHaveAttribute('aria-selected', 'true');
    const composer = engineerPage.getByPlaceholder('Type a message...');
    await expect(composer).toHaveValue(guidance.customer_questions[0].draft);

    const beforeAction = localD1Rows(`
      SELECT
        (SELECT COUNT(*) FROM work_order_messages
          WHERE work_order_id = ${sqlText(workOrderId)}) AS message_count,
        (SELECT group_concat(item_key || ':' || state, '|') FROM (
          SELECT item_key, state FROM work_order_service_standard_progress
          WHERE work_order_id = ${sqlText(workOrderId)}
          ORDER BY item_key
        )) AS standard_signature
    `)[0];
    expect(beforeAction.message_count).toBe(0);

    await guidanceCard.getByRole('button', { name: 'Correct', exact: true }).click();
    const correctionNote = `Use verified alarm evidence ${engineer.runId}.`;
    await guidanceCard.getByLabel('Correction note').fill(correctionNote);
    await guidanceCard.getByRole('button', { name: 'Submit correction', exact: true }).click();
    await expect(guidanceCard.getByText(
      'New work-order evidence is available. AI is preparing an update.',
      { exact: true },
    )).toBeVisible();
    expect(guidanceRefreshRequests).toBe(1);

    await engineerPage.waitForTimeout(500);
    const afterAction = localD1Rows(`
      SELECT
        (SELECT COUNT(*) FROM work_order_messages
          WHERE work_order_id = ${sqlText(workOrderId)}) AS message_count,
        (SELECT COUNT(*) FROM work_order_service_guidance_feedback
          WHERE work_order_id = ${sqlText(workOrderId)}
            AND feedback_type = 'corrected'
            AND correction_note = ${sqlText(correctionNote)}) AS feedback_count,
        (SELECT COUNT(*) FROM audit_logs
          WHERE target_id = ${sqlText(workOrderId)}
            AND action = 'service_guidance_feedback_recorded') AS audit_count,
        (SELECT group_concat(item_key || ':' || state, '|') FROM (
          SELECT item_key, state FROM work_order_service_standard_progress
          WHERE work_order_id = ${sqlText(workOrderId)}
          ORDER BY item_key
        )) AS standard_signature,
        (SELECT trigger_reason FROM work_order_service_readiness
          WHERE work_order_id = ${sqlText(workOrderId)}) AS trigger_reason,
        (SELECT generation_started_at FROM work_order_service_readiness
          WHERE work_order_id = ${sqlText(workOrderId)}) AS generation_started_at
    `)[0];
    expect(afterAction).toMatchObject({
      message_count: 0,
      feedback_count: 1,
      audit_count: 1,
      standard_signature: beforeAction.standard_signature,
      trigger_reason: 'engineer_feedback',
    });
    expect(afterAction.generation_started_at).toBeTruthy();

    await composer.press('Enter');
    await expect(engineerPage.getByText(guidance.customer_questions[0].draft, { exact: true })).toBeVisible();
    expect(localD1Rows(`
      SELECT COUNT(*) AS count FROM work_order_messages
      WHERE work_order_id = ${sqlText(workOrderId)}
    `)[0].count).toBe(1);

    await engineerPage.route(
      new RegExp(`/api/workorders/${failedWorkOrderId}/service-guidance/refresh$`),
      (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          state: 'failed',
          guidance: null,
          generated_at: null,
          guidance_version: null,
        }),
      }),
    );
    await engineerPage.goto(
      `${runtime.engineerBase}/work-orders/${failedWorkOrderId}`,
      { waitUntil: 'domcontentloaded' },
    );
    const failedCopy = engineerPage.getByText(
      'AI guidance is temporarily unavailable. Continue with the service standard and retry later.',
      { exact: true },
    );
    const failedProgressHeading = engineerPage.getByRole('heading', { name: 'Six-step precision service track' });
    const failedStageHeading = engineerPage.getByRole('heading', { name: 'Task alignment', exact: true });
    await expect(failedCopy).toBeVisible();
    await expect(failedProgressHeading).toBeVisible();
    await expect(failedStageHeading).toBeVisible();
    await captureBothViewports(engineerPage, 'engineer-ai-guidance-failed', {
      scope: failedCopy,
      fullPage: false,
    });
  } finally {
    await engineerContext.close();
  }
});
