import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const workflowUrl = new URL('../../.github/workflows/deploy.yml', import.meta.url);

function jobBlock(workflow, jobName) {
  const marker = `  ${jobName}:`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `${jobName} job should exist`);
  const nextJob = workflow.slice(start + marker.length).search(/^  [a-z][a-z0-9-]*:/m);
  return nextJob === -1
    ? workflow.slice(start)
    : workflow.slice(start, start + marker.length + nextJob);
}

test('test gate verifies both deterministic frontend artifacts', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const gate = jobBlock(workflow, 'test');

  assert.match(gate, /working-directory: frontend[\s\S]*run: npm run build:public/);
  assert.match(gate, /working-directory: frontend[\s\S]*run: npm run build:portal/);
});

test('public frontend deployment keeps existing branch targets and deploys only the public artifact', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const deployment = jobBlock(workflow, 'deploy-frontend');

  assert.match(deployment, /needs: \[test, deploy-ai-frontend\]/);
  assert.match(deployment, /if: github\.event_name == 'push'/);
  assert.match(deployment, /run: npm run build:public/);
  assert.match(deployment, /wrangler pages deploy frontend\/dist --project-name=\$\{\{ github\.ref == 'refs\/heads\/main' && 'sagemro-com' \|\| 'sagemro-cn' \}\}/);
  assert.doesNotMatch(deployment, /dist-portal|sagemro-ai/);
});

test('public deployment waits for the international portal while preserving CN and failure gates', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const deployment = jobBlock(workflow, 'deploy-frontend');
  const condition = deployment.match(/^\s+if: (.+)$/m)?.[1];
  assert.ok(condition, 'deployment condition must exist');
  assert.match(condition, /!cancelled\(\)/, 'explicit status check must allow the intentionally skipped CN dependency');
  assert.match(jobBlock(workflow, 'deploy-worker'), /needs: test/);
  assert.match(jobBlock(workflow, 'deploy-ai-frontend'), /needs: deploy-worker/);
  assert.match(deployment, /environment: production/);

  for (const event of ['push', 'pull_request']) {
    for (const branch of ['main', 'china-edition', 'codex/test']) {
      for (const testResult of ['success', 'failure', 'cancelled', 'skipped']) {
        for (const portalResult of ['success', 'failure', 'cancelled', 'skipped']) {
          for (const isCancelled of [false, true]) {
            const actual = runInNewContext(condition, {
              github: { event_name: event, ref: `refs/heads/${branch}` },
              needs: { test: { result: testResult }, 'deploy-ai-frontend': { result: portalResult } },
              cancelled: () => isCancelled,
            }, { timeout: 100 });
            const expected = event === 'push' && !isCancelled && testResult === 'success'
              && ((branch === 'main' && portalResult === 'success')
                || (branch === 'china-edition' && portalResult === 'skipped'));
            assert.equal(actual, expected, JSON.stringify({ event, branch, testResult, portalResult, isCancelled }));
          }
        }
      }
    }
  }
});

test('AI frontend deployment is a production-gated main push job for sagemro-ai', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const deployment = jobBlock(workflow, 'deploy-ai-frontend');

  assert.match(deployment, /needs: deploy-worker/);
  assert.match(deployment, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(deployment, /environment: production/);
  assert.match(deployment, /working-directory: frontend[\s\S]*run: npm run build:portal/);
  assert.match(deployment, /wrangler pages deploy frontend\/dist-portal --project-name=sagemro-ai/);
  assert.match(deployment, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(deployment, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.doesNotMatch(deployment, /china-edition/);
});

test('all deploy jobs remain push-only and Worker keeps its main-only boundary', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  for (const name of ['deploy-frontend', 'deploy-ai-frontend', 'deploy-worker', 'deploy-admin']) {
    assert.match(jobBlock(workflow, name), /if: github\.event_name == 'push'/, `${name} must not run for pull requests`);
  }

  const worker = jobBlock(workflow, 'deploy-worker');
  assert.match(worker, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(worker, /china-edition/);
});

test('Worker gate requires shared service-request migrations in CN without relaxing CN phone storage', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const worker = jobBlock(workflow, 'deploy-worker');
  const cnRequired = worker.match(/CN_REQUIRED="([^"]+)"/)?.[1] || '';

  assert.match(cnRequired, /047_structured_service_request_intake/);
  assert.match(cnRequired, /048_service_request_assist_quota/);
  assert.doesNotMatch(cnRequired, /049_nullable_international_customer_phone/);
});
