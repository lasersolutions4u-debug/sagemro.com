import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Script } from 'node:vm';

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

  // 2026-11-13：公开站不再排在 AI 门户之后，也不再走 production 审批（见下一个用例）。
  assert.match(deployment, /needs: \[test\]/);
  assert.doesNotMatch(deployment, /needs: \[[^\]]*deploy-ai-frontend/, '公开站不得重新耦合到门户部署');
  assert.match(deployment, /if: github\.event_name == 'push'/);
  assert.match(deployment, /run: npm run build:public/);
  assert.match(deployment, /wrangler pages deploy frontend\/dist --project-name=\$\{\{ github\.ref == 'refs\/heads\/main' && 'sagemro-com' \|\| 'sagemro-cn' \}\}/);
  assert.doesNotMatch(deployment, /dist-portal|sagemro-ai/);
});

test('public site deploys on a passing test gate while worker, portal, and admin keep the production gate', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const deployment = jobBlock(workflow, 'deploy-frontend');
  const condition = deployment.match(/^\s+if: (.+)$/m)?.[1];
  assert.ok(condition, 'deployment condition must exist');

  // 公开站刻意不带 environment：这是「测试通过即发布」的唯一实现方式。
  assert.doesNotMatch(deployment, /environment:/);
  // 审批仍在另外三个会碰 API / 账号 / 数据的部署上。
  for (const name of ['deploy-worker', 'deploy-ai-frontend', 'deploy-admin']) {
    assert.match(jobBlock(workflow, name), /environment: production/, `${name} 必须保留 production 审批`);
  }
  // 门户仍排在 worker 之后；worker 仍只由 main 触发。
  assert.match(jobBlock(workflow, 'deploy-worker'), /needs: test/);
  assert.match(jobBlock(workflow, 'deploy-ai-frontend'), /needs: deploy-worker/);

  const compiledCondition = new Script(condition);

  for (const event of ['push', 'pull_request']) {
    for (const branch of ['main', 'china-edition', 'codex/test']) {
      for (const testResult of ['success', 'failure', 'cancelled', 'skipped']) {
        for (const isCancelled of [false, true]) {
          const actual = compiledCondition.runInNewContext({
            github: { event_name: event, ref: `refs/heads/${branch}` },
            needs: { test: { result: testResult } },
            cancelled: () => isCancelled,
          }, { timeout: 1000 });
          const expected = event === 'push' && !isCancelled && testResult === 'success'
            && (branch === 'main' || branch === 'china-edition');
          assert.equal(actual, expected, JSON.stringify({ event, branch, testResult, isCancelled }));
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

test('the Cloudflare path always builds the default com market, so CN locale and assets cannot reach sagemro.com', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  // sagemro.com / ai.sagemro.com must never be produced with the explicit cn market:
  // that would ship Chinese prerender, a sagemro.cn sitemap, and Baiduspider Disallow: /.
  assert.doesNotMatch(workflow, /SAGEMRO_BUILD_MARKET/);
  assert.doesNotMatch(workflow, /build:(public|portal):cn/);
  assert.doesNotMatch(workflow, /public-cn/);
});

test('only a main push can target an international Pages project', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const international = ['sagemro-com', 'sagemro-admin', 'sagemro-ai'];

  for (const name of ['deploy-frontend', 'deploy-ai-frontend', 'deploy-admin']) {
    const job = jobBlock(workflow, name);
    const projects = [...job.matchAll(/--project-name=(\$\{\{[^}]*\}\}|[\w-]+)/g)].map((match) => match[1]);

    if (!projects.some((value) => international.some((project) => value.includes(project)))) continue;
    assert.match(
      job,
      /github\.ref == 'refs\/heads\/main'/,
      `${name} can publish an international Pages project, so it must be gated on a main push (a CN branch push must never reach sagemro.com / sagemro-ai / sagemro-admin)`,
    );
  }
});

test('no workflow builds one target for both markets into the same artifact directory', async () => {
  const workflows = [
    new URL('../../.github/workflows/deploy.yml', import.meta.url),
    new URL('../../.github/workflows/aliyun-cn-deploy.yml', import.meta.url),
  ];

  for (const file of workflows) {
    const content = await readFile(file, 'utf8');
    for (const target of ['public', 'portal']) {
      const defaultMarket = new RegExp(`build:${target}(?!:cn)`).test(content);
      const cnMarket = new RegExp(`build:${target}:cn`).test(content);
      assert.ok(
        !(defaultMarket && cnMarket),
        `${file.pathname.split('/').pop()}: ${target} must not be built for both markets in one workflow (later build overwrites the artifact directory)`,
      );
    }
  }
});
