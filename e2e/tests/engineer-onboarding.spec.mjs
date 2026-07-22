import { expect, test } from '@playwright/test';

import { activationTokenFromMessage, getActivationEmail } from '../support/api.mjs';
import { e2eRuntime } from '../support/runtime.mjs';

const runtime = e2eRuntime();

test('engineer application is reviewed, activated, and signed in', async ({ browser }) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const applicant = {
    name: `E2E Engineer ${runId}`,
    phone: `+1555${runId.replace(/\D/g, '').slice(-7).padStart(7, '0')}`,
    email: `e2e-engineer-${runId}@example.test`,
    password: 'LocalEngineerPassword123!',
  };

  const engineerContext = await browser.newContext();
  const engineerPage = await engineerContext.newPage();
  await engineerPage.goto(runtime.engineerBase);
  await engineerPage.getByRole('button', { name: 'Apply to Join', exact: true }).first().click();
  await engineerPage.getByLabel('Name').fill(applicant.name);
  await engineerPage.getByLabel('Phone').fill(applicant.phone);
  await engineerPage.getByLabel('Email').fill(applicant.email);
  await engineerPage.getByLabel('Country').fill('United States');
  await engineerPage.getByLabel('Base city').fill('Chicago');
  await engineerPage.getByRole('button', { name: 'North America', exact: true }).click();
  await engineerPage.getByRole('button', { name: 'Laser cutting machine', exact: true }).click();
  await engineerPage.getByRole('button', { name: 'Maintenance', exact: true }).click();
  await engineerPage.getByLabel('Individual / team capability').fill('E2E field service and maintenance experience.');
  await engineerPage.getByRole('button', { name: 'Submit Application', exact: true }).click();
  await expect(engineerPage.getByText('Application received.', { exact: false })).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(runtime.adminBase);
  await adminPage.getByPlaceholder('Admin phone number').fill('19900000001');
  await adminPage.getByPlaceholder('Password').fill('LocalAdminPassword123!');
  await adminPage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await adminPage.getByRole('button', { name: 'Engineer Applications', exact: true }).click();

  const applicationRow = adminPage.getByTestId('application-row').filter({ hasText: applicant.email });
  await expect(applicationRow).toBeVisible();
  await applicationRow.click();
  const applicationDialog = adminPage.getByRole('dialog', { name: applicant.name });
  await applicationDialog.locator('select').first().selectOption('qualified');
  await applicationDialog.getByRole('button', { name: 'Save review', exact: true }).click();
  await expect(applicationDialog.getByText('Approved', { exact: true }).first()).toBeVisible();
  await applicationDialog.getByRole('button', { name: 'Open engineer account', exact: true }).click();
  await applicationDialog.getByRole('button', { name: 'Confirm and send activation email', exact: true }).click();
  await expect(applicationDialog.getByText('Awaiting activation', { exact: true }).first()).toBeVisible();

  const activationEmail = await getActivationEmail(applicant.email);
  const activationToken = activationTokenFromMessage(activationEmail);
  await engineerPage.goto(`${runtime.engineerBase}/activate#token=${activationToken}`);
  await engineerPage.getByLabel('Set password').fill(applicant.password);
  await engineerPage.getByLabel('Confirm password').fill(applicant.password);
  await engineerPage.getByRole('button', { name: 'Activate account', exact: true }).click();
  await expect(engineerPage.getByText('Account activated', { exact: true })).toBeVisible();
  await engineerPage.getByRole('button', { name: 'Sign in to Engineer Workspace', exact: true }).click();
  await engineerPage.getByPlaceholder('Email or phone number').fill(applicant.email);
  await engineerPage.getByPlaceholder('Enter your password').fill(applicant.password);
  await engineerPage.getByTestId('login-submit-button').click();
  await expect(engineerPage.getByText('Engineer Workspace', { exact: true }).first()).toBeVisible();

  await adminContext.close();
  await engineerContext.close();
});
