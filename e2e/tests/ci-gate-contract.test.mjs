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

test('Cloudflare deploy jobs remain push-only with the existing branch guards', () => {
  const workflow = read('.github/workflows/deploy.yml');

  assert.match(workflow, /deploy-frontend:[\s\S]*?if: github\.event_name == 'push' && \(github\.ref == 'refs\/heads\/main' \|\| github\.ref == 'refs\/heads\/china-edition'\)/);
  assert.match(workflow, /deploy-worker:[\s\S]*?if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /deploy-admin:[\s\S]*?if: github\.event_name == 'push' && \(github\.ref == 'refs\/heads\/main' \|\| github\.ref == 'refs\/heads\/china-edition'\)/);
  assert.equal((workflow.match(/if: github\.event_name == 'push'/g) || []).length, 3);
});

test('Worker deployment blocks on migrations for both production D1 databases', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const workerJob = workflow.slice(workflow.indexOf('  deploy-worker:'), workflow.indexOf('  deploy-admin:'));

  assert.match(workerJob, /wrangler d1 execute sagemro-db --env production --remote/);
  assert.match(workerJob, /wrangler d1 execute sagemro-db-cn --env production --remote/);
  assert.match(workerJob, /038_material_requisitions_and_staff/);
  assert.match(workerJob, /039_field_workdays/);
  assert.match(workerJob, /040_field_evidence_cleanup_queue/);
  assert.match(workerJob, /CN_MISSING/);
});
