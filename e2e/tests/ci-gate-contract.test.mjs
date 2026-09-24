import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

// 系统已裁剪为主站（营销页）/ AI 门户 / 知识中枢 / 工程师招募页。
// 工单、物料领用、商务报价/回款、工程师工作台等浏览器 E2E 旅程已随业务下线，
// 对应 spec 也已删除，这里只保留部署流水线契约。
test('Cloudflare test job runs Admin and E2E gates before deploy jobs', () => {
  const workflow = read('.github/workflows/deploy.yml');
  const testJob = workflow.slice(workflow.indexOf('  test:'), workflow.indexOf('  deploy-frontend:'));

  assert.match(testJob, /name: Admin tests\s+working-directory: admin\s+run: npm test/);
  assert.ok(
    testJob.indexOf('name: Admin tests') < testJob.indexOf('name: Admin build'),
    'Admin tests should run before Admin build',
  );
  assert.match(testJob, /name: E2E install\s+working-directory: e2e\s+run: npm install --no-audit --no-fund/);
  assert.match(testJob, /name: E2E contract tests\s+working-directory: e2e\s+run: npm test/);
  assert.doesNotMatch(testJob, /playwright install/, '没有浏览器旅程后不应再下载 Chromium');
  assert.ok(
    testJob.indexOf('name: E2E contract tests') > testJob.indexOf('name: Admin build'),
    'E2E contracts should run after Worker, frontend, and Admin verification',
  );
});

test('the E2E command runs the deployment contracts', () => {
  const { scripts } = JSON.parse(read('e2e/package.json'));
  assert.equal(scripts.test, 'npm run test:contracts');
  const args = scripts['test:contracts'].split(/\s+/);
  assert.deepEqual(args.slice(0, 3), ['node', '--test', 'tests/*-contract.test.mjs']);
  assert.equal(scripts['test:business-browser'], undefined, 'business browser suite is retired');
});

test('retired browser journeys stay deleted', () => {
  for (const spec of [
    'business-execution-browser.test.mjs',
    'business-payments-browser.test.mjs',
    'business-quote-browser.test.mjs',
    'business-service-browser.test.mjs',
    'business-workspace-browser.test.mjs',
    'engineer-onboarding.spec.mjs',
    'engineer-service-readiness.spec.mjs',
    'material-requisition-lifecycle.spec.mjs',
    'onsite-multiday-lifecycle.spec.mjs',
    'quote-execution-visual.spec.mjs',
    'regional-lead-workspace.spec.mjs',
    'service-order-lifecycle.spec.mjs',
  ]) {
    assert.equal(existsSync(path.join(root, 'e2e/tests', spec)), false, `${spec} should be deleted`);
  }
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
  // migration 只增不删：历史表照旧保留在生产 D1 上。
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
