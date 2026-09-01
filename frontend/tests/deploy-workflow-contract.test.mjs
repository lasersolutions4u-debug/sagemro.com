import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../../.github/workflows/deploy.yml', import.meta.url);
const aliyunWorkflowUrl = new URL('../../.github/workflows/aliyun-cn-deploy.yml', import.meta.url);

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

  assert.match(deployment, /needs: test/);
  assert.match(deployment, /if: github\.event_name == 'push' && \(github\.ref == 'refs\/heads\/main' \|\| github\.ref == 'refs\/heads\/china-edition'\)/);
  assert.match(deployment, /run: npm run build:public/);
  assert.match(deployment, /wrangler pages deploy frontend\/dist --project-name=\$\{\{ github\.ref == 'refs\/heads\/main' && 'sagemro-com' \|\| 'sagemro-cn' \}\}/);
  assert.doesNotMatch(deployment, /dist-portal|sagemro-ai/);
});

test('AI frontend deployment stays in the production-gated Aliyun China workflow', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const aliyunWorkflow = await readFile(aliyunWorkflowUrl, 'utf8');

  assert.doesNotMatch(workflow, /^  deploy-ai-frontend:/m);
  assert.match(aliyunWorkflow, /environment: production/);
  assert.match(aliyunWorkflow, /npm run build:portal/);
  assert.match(aliyunWorkflow, /cp -a frontend\/dist-portal\/\. release\/ai\//);
  assert.match(aliyunWorkflow, /ln -sfnT "\$release\/ai" "\$current\/ai"/);
});

test('all deploy jobs remain push-only and Worker keeps its main-only boundary', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  for (const name of ['deploy-frontend', 'deploy-worker', 'deploy-admin']) {
    assert.match(jobBlock(workflow, name), /if: github\.event_name == 'push'/, `${name} must not run for pull requests`);
  }

  const worker = jobBlock(workflow, 'deploy-worker');
  assert.match(worker, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(worker, /china-edition/);
});

test('Worker gate requires shared service-request migrations in CN without relaxing CN phone storage', async () => {
  const workflow = await readFile(aliyunWorkflowUrl, 'utf8');
  const cnRequired = workflow.match(/CN_REQUIRED="([^"]+)"/)?.[1] || '';

  assert.match(cnRequired, /047_structured_service_request_intake/);
  assert.match(cnRequired, /048_service_request_assist_quota/);
  assert.doesNotMatch(cnRequired, /049_nullable_international_customer_phone/);
});
