import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../../.github/workflows/aliyun-cn-deploy.yml', import.meta.url),
  'utf8',
);

test('Aliyun China workflow builds and packages separate public and portal artifacts', () => {
  assert.match(workflow, /npm run build:public/);
  assert.match(workflow, /npm run build:portal/);
  assert.ok(workflow.indexOf('npm run build:public') < workflow.indexOf('npm run build:portal'));

  assert.match(workflow, /mkdir -p release\/frontend release\/ai release\/admin/);
  assert.match(workflow, /cp -a frontend\/dist\/\. release\/frontend\//);
  assert.match(workflow, /cp -a frontend\/dist-portal\/\. release\/ai\//);
  assert.match(workflow, /cp -a admin\/dist\/\. release\/admin\//);
  for (const artifact of ['frontend', 'ai', 'admin']) {
    assert.match(workflow, new RegExp(`test -f release/${artifact}/index\\.html`));
    assert.match(workflow, new RegExp(`test -f "\\$release/${artifact}/index\\.html"`));
  }
});

test('Aliyun China portal waits for the shared API and D1 contract', () => {
  assert.match(workflow, /Check CN API and D1 readiness/);
  assert.match(workflow, /wrangler d1 execute sagemro-db-cn --env production --remote/);
  assert.match(workflow, /047_structured_service_request_intake/);
  assert.match(workflow, /048_service_request_assist_quota/);
  // 就绪探测必须指向【保留】的接口：服务请求/工单/物料已随 2026-09-24 裁剪下架，
  // 探测它们会稳定拿到 404 并卡死发布（china-edition 上曾因此失败）。
  // 现改用 /api/contact 作为「新 Worker 已上线」的保留契约：空 body 期望 400，而非 401/404。
  assert.match(workflow, /-X POST https:\/\/api\.sagemro\.cn\/api\/contact/);
  assert.match(workflow, /contact_status.*400/s);
  assert.doesNotMatch(workflow, /api\/service-request-assist/);
});

test('Aliyun activation atomically maps each host to the approved artifact', () => {
  assert.match(workflow, /ln -sfnT "\$release\/frontend" "\$current\/frontend"/);
  assert.match(workflow, /ln -sfnT "\$release\/frontend" "\$current\/engineer"/);
  assert.match(workflow, /ln -sfnT "\$release\/ai" "\$current\/ai"/);
  assert.match(workflow, /ln -sfnT "\$release\/admin" "\$current\/admin"/);
});

test('Aliyun deployment keeps its production safety controls', () => {
  assert.match(workflow, /aliyun ecs AuthorizeSecurityGroup/);
  assert.ok((workflow.match(/aliyun ecs RevokeSecurityGroup/g) || []).length >= 2);
  assert.match(workflow, /ALIYUN_ECS_HOST_KEY/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.match(workflow, /\$SUDO nginx -t/);
  assert.match(workflow, /\$SUDO systemctl reload nginx/);
  assert.match(workflow, /- name: Revoke GitHub runner SSH\s+if: always\(\)/);
});

test('Aliyun health checks and summary include the AI portal without dropping existing hosts', () => {
  const urls = [
    'https://sagemro.cn/',
    'https://ai.sagemro.cn/',
    'https://admin.sagemro.cn/',
    'https://engineer.sagemro.cn/',
    'https://api.sagemro.cn/health',
  ];

  for (const url of urls) {
    assert.match(workflow, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  // 取代已下线的 service-request 探测：改用 X-Robots-Tag 与三类冒烟探针。
  assert.match(workflow, /X-Robots-Tag/);
  assert.match(workflow, /deploy-admin-smoke/);
  assert.match(workflow, /expected HTTP 404/);
  assert.match(workflow, /unexpected\.invalid/);
  assert.match(workflow, /- AI: https:\/\/ai\.sagemro\.cn\//);
  assert.doesNotMatch(workflow, /service-request\?mode=manual/);
});

test('the China publish entry never builds with the default com market', () => {
  // Exactly one of two safe configurations must hold, or a half-switch silently
  // ships the international artifact to China:
  //   a) build explicitly for the cn market, or
  //   b) keep the china-edition ref guard, whose checkout has no market dimension
  //      and whose index.html is lang="zh-CN" (the template fallback path).
  const buildsForCnMarket = /SAGEMRO_BUILD_MARKET:\s*cn/.test(workflow) || /build:(public|portal):cn/.test(workflow);
  const pinnedToCnTemplate = /GITHUB_REF_NAME.*!=.*china-edition/.test(workflow);

  assert.ok(
    buildsForCnMarket || pinnedToCnTemplate,
    'either build explicitly for the cn market, or keep the china-edition ref guard whose checkout template is lang="zh-CN"',
  );

  // 2026-09-29 切换：发布入口改由 main 构建，因此必须【同时】满足两条——
  // 显式选 cn 市场，且 ref 守卫已是 main。缺任一条都会把英文产物静默发到 CN。
  assert.match(workflow, /GITHUB_REF_NAME.*!=.*"main"/);
  assert.doesNotMatch(workflow, /GITHUB_REF_NAME.*!=.*china-edition/);
});
