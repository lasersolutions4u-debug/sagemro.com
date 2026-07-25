import { expect, test } from '@playwright/test';

import { onboardEngineer } from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';
import { localD1, localD1Rows, sqlText } from '../support/visual.mjs';

const runtime = e2eRuntime();

test('regional lead switches team scope, reviews subordinate work, and reassigns within the team', async ({ browser }) => {
  test.setTimeout(300_000);
  const leadJourney = await onboardEngineer({ browser, runtime });
  const firstMemberJourney = await onboardEngineer({ browser, runtime });
  const secondMemberJourney = await onboardEngineer({ browser, runtime });

  const [lead] = localD1Rows(`SELECT id, name FROM engineers WHERE lower(email) = lower(${sqlText(leadJourney.engineer.email)}) LIMIT 1`);
  const [firstMember] = localD1Rows(`SELECT id, name FROM engineers WHERE lower(email) = lower(${sqlText(firstMemberJourney.engineer.email)}) LIMIT 1`);
  const [secondMember] = localD1Rows(`SELECT id, name FROM engineers WHERE lower(email) = lower(${sqlText(secondMemberJourney.engineer.email)}) LIMIT 1`);
  const customerId = `e2e-regional-customer-${leadJourney.engineer.runId}`;
  const workOrderId = `e2e-regional-${leadJourney.engineer.runId}`;
  const orderNo = `WO-RL-${leadJourney.engineer.runId}`.slice(0, 42);

  localD1(`
    UPDATE engineers SET engineer_role = 'regional_lead' WHERE id = ${sqlText(lead.id)};
    UPDATE engineers SET regional_lead_id = ${sqlText(lead.id)} WHERE id IN (${sqlText(firstMember.id)}, ${sqlText(secondMember.id)});
    INSERT INTO customers (id, user_no, name, phone, email, password_hash)
    VALUES (
      ${sqlText(customerId)}, ${sqlText(`U-RL-${leadJourney.engineer.runId}`)}, 'Regional E2E Customer',
      ${sqlText(`+1777${leadJourney.engineer.runId.replace(/\D/g, '').slice(-7).padStart(7, '0')}`)},
      ${sqlText(`regional-customer-${leadJourney.engineer.runId}@example.test`)}, 'local-e2e-hash'
    );
    INSERT INTO work_orders (
      id, order_no, customer_id, engineer_id, type, description, status,
      category_l1, category_l2, created_at
    ) VALUES (
      ${sqlText(workOrderId)}, ${sqlText(orderNo)}, ${sqlText(customerId)}, ${sqlText(firstMember.id)},
      'maintenance', 'Laser cutting machine preventive maintenance.', 'assigned',
      'laser_cutting', 'maintenance', datetime('now')
    );
  `);

  await leadJourney.page.reload();
  await expect(leadJourney.page.getByText('Regional Lead Workspace', { exact: true })).toBeVisible();
  await expect(leadJourney.page.getByRole('button', { name: 'My metrics', exact: true })).toBeVisible();
  await leadJourney.page.getByRole('button', { name: lead.name, exact: true }).click();
  await expect(leadJourney.page.getByRole('heading', { name: 'SAGEMRO Engineer Profile', exact: true })).toBeVisible();
  await leadJourney.page.getByRole('button', { name: 'Close', exact: true }).click();

  await leadJourney.page.getByRole('button', { name: 'Open calendar →', exact: true }).click();
  await expect(leadJourney.page.getByLabel('Title', { exact: true })).toBeVisible();
  await leadJourney.page.getByRole('button', { name: 'Close', exact: true }).click();

  await leadJourney.page.getByRole('button', { name: 'Team metrics', exact: true }).click();
  await expect(leadJourney.page.getByRole('heading', { name: 'Regional team work orders', exact: true })).toBeVisible();
  await expect(leadJourney.page.getByRole('button', { name: new RegExp(firstMember.name) })).toBeVisible();

  await leadJourney.page.getByRole('button').filter({ hasText: orderNo }).click();
  await expect(leadJourney.page).toHaveURL(new RegExp(`/work-orders/${workOrderId}$`));
  await expect(leadJourney.page.getByRole('button', { name: 'Assign / Reassign', exact: true })).toBeVisible();
  await leadJourney.page.getByRole('tab', { name: 'Messages', exact: true }).click();
  await expect(leadJourney.page.getByText('Team progress view · Only the executing engineer can reply.', { exact: true })).toBeVisible();
  await expect(leadJourney.page.getByPlaceholder('Type a message...')).toHaveCount(0);
  await leadJourney.page.getByRole('tab', { name: 'Field service', exact: true }).click();
  await expect(leadJourney.page.getByText('Field-service evidence remains private to the executing engineer and Admin.', { exact: true })).toBeVisible();

  await leadJourney.page.locator('select').selectOption(secondMember.id);
  await leadJourney.page.getByRole('button', { name: 'Assign / Reassign', exact: true }).click();
  await expect(leadJourney.page.getByText(secondMember.name, { exact: true })).toBeVisible();
  expect(localD1Rows(`SELECT engineer_id, assigned_regional_lead_id FROM work_orders WHERE id = ${sqlText(workOrderId)}`)[0]).toMatchObject({
    engineer_id: secondMember.id,
    assigned_regional_lead_id: lead.id,
  });

  await leadJourney.context.close();
  await firstMemberJourney.context.close();
  await secondMemberJourney.context.close();
});
