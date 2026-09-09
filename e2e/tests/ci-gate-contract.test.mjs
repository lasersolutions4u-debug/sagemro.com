import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('material requisition lifecycle E2E covers the browser workflow and seeded stock', () => {
  const specPath = path.join(root, 'e2e/tests/material-requisition-lifecycle.spec.mjs');
  assert.equal(existsSync(specPath), true, 'material requisition lifecycle spec should exist');

  const spec = read('e2e/tests/material-requisition-lifecycle.spec.mjs');
  const prepare = read('e2e/scripts/prepare-local-env.mjs');

  for (const milestone of [
    'Material Requisition',
    'Create draft',
    'Submit draft',
    'Material Requisitions',
    'Approve',
    'Allocate',
    'Order',
    'Receive purchase',
    'Issue',
    'Confirm receipt',
    'Close',
  ]) {
    assert.match(spec, new RegExp(milestone), `lifecycle should cover ${milestone}`);
  }
  assert.match(spec, /Submitted/);
  assert.match(spec, /Approved/);
  assert.match(spec, /Ready/);
  assert.match(spec, /Issued/);
  assert.match(spec, /Received/);
  assert.match(spec, /Closed/);
  assert.match(prepare, /E2E-STOCK-001/);
  assert.match(prepare, /stock_quantity/);
});

test('Cloudflare test job runs Admin and full E2E gates before deploy jobs', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const testJob = workflow.slice(workflow.indexOf('  test:'), workflow.indexOf('  deploy-frontend:'));

  assert.match(testJob, /name: Admin tests\s+working-directory: admin\s+run: npm test/);
  assert.ok(
    testJob.indexOf('name: Admin tests') < testJob.indexOf('name: Admin build'),
    'Admin tests should run before Admin build',
  );
  assert.match(testJob, /name: E2E install\s+working-directory: e2e\s+run: npm install --no-audit --no-fund/);
  assert.match(testJob, /name: Install Playwright Chromium\s+working-directory: e2e\s+run: npx playwright install --with-deps chromium/);
  assert.match(testJob, /name: Full E2E tests\s+working-directory: e2e\s+run: npm test/);
  assert.ok(
    testJob.indexOf('name: Full E2E tests') > testJob.indexOf('name: Admin build'),
    'full E2E should run after Worker, frontend, and Admin verification',
  );
});

test('engineer onboarding journey follows the current recruitment CTA', () => {
  const recruitingPage = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');
  const journeys = read('e2e/support/journeys.mjs');

  assert.match(recruitingPage, /applyNow: 'Submit Service Interest'/);
  assert.match(journeys, /name: 'Submit Service Interest'/);
  assert.doesNotMatch(journeys, /name: 'Apply to Join'/);
  assert.match(
    journeys,
    /getByLabel\('Equipment specialties'\)\.locator\('xpath=\.\.\/\.\.\/\.\.'\)\.getByRole\('button', \{ name: 'Laser cutting machine', exact: true \}\)/,
  );
  assert.match(
    journeys,
    /getByLabel\('Service items'\)\.locator\('xpath=\.\.\/\.\.\/\.\.'\)\.getByRole\('button', \{ name: 'Maintenance', exact: true \}\)/,
  );
  assert.match(journeys, /getByLabel\('Field service experience'\)/);
  assert.doesNotMatch(journeys, /getByLabel\('Individual \/ team capability'\)/);
});

test('engineer approval waits for the saved status badge instead of a select option', () => {
  const journeys = read('e2e/support/journeys.mjs');

  assert.ok(journeys.includes("await expect(dialog.locator('span').filter({ hasText: /^Approved$/ })).toBeVisible();"));
  assert.doesNotMatch(journeys, /getByText\('Approved', \{ exact: true \}\)\.first\(\)/);
});

test('customer work-order journeys use the unified four-step service request flow', () => {
  const serviceRequestFlow = read('frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx');
  const journeys = read('e2e/support/journeys.mjs');
  const lifecycle = read('e2e/tests/service-order-lifecycle.spec.mjs');

  assert.match(serviceRequestFlow, /serviceTitle: 'What do you need help with\?'/);
  assert.match(serviceRequestFlow, /submit: 'Send service request'/);
  assert.match(journeys, /export async function submitCustomerServiceRequest/);
  for (const currentControl of [
    "getByText('Repair & diagnostics', { exact: true }).click()",
    "getByPlaceholder('Select or enter the equipment type…')",
    "getByLabel('Problem or service request · Required')",
    "getByPlaceholder('Enter country, state / province or city, then press Enter…')",
    "getByLabel('Contact name · Required')",
    "name: 'Send service request'",
    "name: 'Done'",
  ]) {
    assert.match(journeys, new RegExp(currentControl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(journeys, /getByRole\('radio',[\s\S]*Repair & diagnostics[\s\S]*\)\.check\(\)/);
  for (const retiredControl of [
    'Request Type',
    'Equipment Model / Part No.',
    'Request Details',
    'Contact Method',
    'submit-work-order-button',
    'Got it',
  ]) {
    assert.doesNotMatch(journeys, new RegExp(retiredControl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(lifecycle, new RegExp(retiredControl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(lifecycle, /submitCustomerServiceRequest/);
});

test('AI-home E2E starts the portal target and avoids phone-like message fixtures', () => {
  const playwrightConfig = read('e2e/playwright.config.mjs');
  const visual = read('e2e/tests/quote-execution-visual.spec.mjs');
  const lifecycle = read('e2e/tests/service-order-lifecycle.spec.mjs');

  const runner = read('e2e/scripts/run-local-e2e.mjs');
  assert.match(runner, /SAGEMRO_BUILD_TARGET = 'portal'/);
  assert.match(runner, /VITE_API_BASE = runtime.apiBase/);
  assert.match(playwrightConfig, /run-local-e2e\.mjs server frontend/);
  assert.match(visual, /url: 'http:\/\/ai\.sagemro\.cn:4273'/);
  assert.match(lifecycle, /customer\.runId\.slice\(-6\)/);
  assert.doesNotMatch(lifecycle, /manualMessage = `E2E manual update \$\{customer\.runId\}`/);
});

test('Cloudflare test workflow covers pull requests to both protected branches', () => {
  const workflow = read('.github/workflows/deploy.yml');

  assert.match(workflow, /pull_request:\s+branches: \[main, china-edition\]/);
});

test('Cloudflare deploy jobs remain push-only with the existing branch guards', () => {
  const workflow = read('.github/workflows/deploy.yml');

  assert.match(workflow, /deploy-frontend:[\s\S]*?needs: \[test, deploy-ai-frontend\]/);
  assert.match(workflow, /deploy-frontend:[\s\S]*?if: github\.event_name == 'push' && !cancelled\(\) && needs\.test\.result == 'success'/);
  assert.match(workflow, /deploy-ai-frontend:[\s\S]*?if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /deploy-worker:[\s\S]*?if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /deploy-admin:[\s\S]*?if: github\.event_name == 'push'/);
  assert.equal((workflow.match(/if: github\.event_name == 'push'/g) || []).length, 4);
  assert.match(workflow, /deploy-ai-frontend:\s+[\s\S]*?needs: deploy-worker/);
});

test('standalone Admin deployment installs shared frontend dependencies before building', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const adminJob = workflow.split(/^  deploy-admin:\s*$/m)[1]?.split(/^  [\w-]+:\s*$/m)[0];
  assert.ok(adminJob, 'Admin deployment job must exist');
  const install = adminJob.match(/- name: Install shared frontend dependencies\s+working-directory: frontend\s+run: npm ci --no-audit --no-fund/);
  assert.ok(install, 'Admin needs the locked dependencies of its imported frontend components');
  const build = adminJob.indexOf('- name: Build');
  assert.ok(build > install.index, 'shared dependencies must be installed before the Admin build');
});

test('Admin deployment waits for Worker and retains the production approval gate', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const adminJob = workflow.split(/^  deploy-admin:\s*$/m)[1]?.split(/^  [\w-]+:\s*$/m)[0];
  assert.ok(adminJob, 'Admin deployment job must exist');
  assert.match(adminJob, /^    needs: \[test, deploy-worker\]$/m);
  assert.match(adminJob, /^    environment: production$/m);
});

test('Admin deployment requires Worker success on main or a skipped Worker on CN, never a cancelled run', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const adminJob = workflow.split(/^  deploy-admin:\s*$/m)[1]?.split(/^  [\w-]+:\s*$/m)[0];
  assert.ok(adminJob, 'Admin deployment job must exist');
  const expected = "github.event_name == 'push' && !cancelled() && needs.test.result == 'success' && ((github.ref == 'refs/heads/main' && needs['deploy-worker'].result == 'success') || (github.ref == 'refs/heads/china-edition' && needs['deploy-worker'].result == 'skipped'))";
  assert.equal(adminJob.match(/^    if: (.+)$/m)?.[1], expected);
});

test('maintenance is manual, main-only, SHA-confirmed and production-approved after full tests', () => {
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /workflow_dispatch:\s+inputs:\s+confirmation:/);
  const job = workflow.split(/^  deploy-maintenance:\s*$/m)[1];
  assert.ok(job, 'maintenance deployment job must exist');
  assert.match(job, /^    needs: test$/m);
  assert.match(job, /^    environment: production$/m);
  assert.equal(job.match(/^    if: (.+)$/m)?.[1], "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.confirmation == 'PAUSE_COM_CN' && inputs.expected_sha == github.sha");
  assert.match(job, /run: npm ci --no-audit --no-fund/);
  assert.match(job, /npx --no-install wrangler deploy src\/maintenance\.js --env production --keep-vars/);
  assert.ok(job.indexOf('wrangler deployments list') < job.indexOf('wrangler deploy src/maintenance.js'));
  assert.doesNotMatch(job, /wrangler (?:d1|rollback)|pages deploy|--force/);
  assert.match(job, /api\.sagemro\.com/);
  assert.match(job, /api\.sagemro\.cn/);
  assert.match(job, /response\.status, 503/);
  assert.match(job, /body\.code, 'MAINTENANCE'/);
  const testJob = workflow.slice(workflow.indexOf('  test:'), workflow.indexOf('  deploy-frontend:'));
  assert.match(testJob, /name: Maintenance entry tests\s+working-directory: worker\s+run: node --test tests\/maintenance\.test\.mjs/);
});

test('maintenance and normal Worker deployment share a non-cancelling concurrency gate', () => {
  const workflow = read('.github/workflows/deploy.yml');
  for (const name of ['deploy-worker', 'deploy-maintenance']) {
    const job = workflow.split(new RegExp(`^  ${name}:\\s*$`, 'm'))[1]?.split(/^  [\w-]+:\s*$/m)[0];
    assert.ok(job);
    assert.match(job, /concurrency:\s+group: sagemro-shared-worker-production\s+cancel-in-progress: false/);
  }
});

test('Worker deployment blocks on migrations for both production D1 databases', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const workerJob = workflow.slice(workflow.indexOf('  deploy-worker:'), workflow.indexOf('  deploy-admin:'));

  assert.match(workerJob, /wrangler d1 execute sagemro-db --env production --remote/);
  assert.match(workerJob, /wrangler d1 execute sagemro-db-cn --env production --remote/);
  for (const version of [
    '038_material_requisitions_and_staff',
    '039_field_workdays',
    '040_field_evidence_cleanup_queue',
    '041_quote_execution_baseline',
    '043_engineer_service_readiness',
    '044_service_standard_progress',
    '045_service_guidance_cache',
  ]) {
    assert.match(workerJob, new RegExp(version));
  }
  assert.match(workerJob, /CN_MISSING/);
});

for (const workflowPath of ['.github/workflows/deploy.yml', '.github/workflows/aliyun-cn-deploy.yml']) {
  test(`${workflowPath} requires the business migrations before CN deployment`, () => {
    const workflow = read(workflowPath);
    const declaration = workflow.match(/^\s*CN_REQUIRED="([^"]+)"/m);
    assert.ok(declaration, 'CN migration requirements must be explicit');
    const required = declaration[1].trim().split(/\s+/);
    for (const version of [
      '047_structured_service_request_intake',
      '048_service_request_assist_quota',
      '050_engineer_service_profiles',
      '051_business_scope',
      '052_business_quote_costs',
      '053_business_receipt_actors',
      '054_business_execution_assignments',
      '055_business_service_execution',
    ]) {
      assert.ok(required.includes(version), `${workflowPath} must require ${version}`);
      assert.ok(existsSync(path.join(root, 'worker/migrations', `${version}.sql`)));
    }
    const guard = workflow.slice(declaration.index);
    assert.match(guard, /for ver in \$CN_REQUIRED; do/);
    assert.match(guard, /if ! echo "\$APPLIED_CN" \| grep -q "\^\$\{ver\}\$"; then/);
    const failure = guard.indexOf('exit 1');
    const deploy = guard.search(/wrangler deploy --env production|name: Build frontend/);
    assert.ok(failure >= 0 && deploy > failure, 'missing migrations must stop before deployment');
  });
}

test('the regular E2E command runs all business and engineer profile browser suites serially', () => {
  const { scripts } = JSON.parse(read('e2e/package.json'));
  assert.match(scripts.test, /npm run test:contracts && npm run test:business-browser &&/);
  const args = scripts['test:business-browser'].split(/\s+/);
  assert.deepEqual(args.slice(0, 3), ['node', '--test', '--test-concurrency=1']);
  const expected = [
    'tests/business-execution-browser.test.mjs',
    'tests/business-payments-browser.test.mjs',
    'tests/business-quote-browser.test.mjs',
    'tests/business-service-browser.test.mjs',
    'tests/business-workspace-browser.test.mjs',
    'tests/engineer-pricing-boundary-browser.test.mjs',
    'tests/engineer-service-profile-browser.test.mjs',
  ];
  assert.deepEqual(args.slice(3).sort(), expected.sort());
  for (const file of expected) assert.ok(existsSync(path.join(root, 'e2e', file)));
});

for (const suite of ['business-workspace', 'engineer-service-profile']) {
  test(`${suite} browser suite uses the browser installed on each test platform`, () => {
    const source = read(`e2e/tests/${suite}-browser.test.mjs`);
    assert.match(source, /channel: process\.platform === 'win32' \? 'chrome' : 'chromium'/);
    assert.match(source, /headless: true/);
  });
}
