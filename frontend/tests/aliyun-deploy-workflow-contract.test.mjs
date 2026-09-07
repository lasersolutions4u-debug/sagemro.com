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
  const required = workflow.match(/CN_REQUIRED="([^"]+)"/)?.[1] || '';
  for (const version of ['050_engineer_service_profiles', '051_business_scope', '052_business_quote_costs', '053_business_receipt_actors', '054_business_execution_assignments', '055_business_service_execution']) {
    assert.ok(required.split(' ').includes(version), `CN must require ${version}`);
  }
  assert.match(workflow, /POST https:\/\/api\.sagemro\.cn\/api\/service-request-assist/);
  assert.match(workflow, /assist_status.*400/s);
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

test('Aliyun pages-only release never provisions DNS, certificates or Nginx configuration', () => {
  assert.doesNotMatch(workflow, /aliyun alidns|certbot|configure_public_routes\.py|enable_nginx_http2\.py/);
  assert.doesNotMatch(workflow, /nginx_backup|performance_conf|api_upstream_staged|install -m 0644|add_header /);
  assert.match(workflow, /name: Inspect current release and unchanged Nginx/);
  assert.match(workflow, /nginx -T/);
  assert.match(workflow, /sha256sum/);
});

test('Aliyun preflight is SHA-pinned and cannot activate or upload a release', () => {
  assert.match(workflow, /expected_sha:[\s\S]*required: true/);
  assert.match(workflow, /preflight_only:[\s\S]*type: boolean[\s\S]*default: true/);
  assert.match(workflow, /EXPECTED_SHA: \$\{\{ inputs.expected_sha \}\}/);
  assert.match(workflow, /"\$EXPECTED_SHA" != "\$GITHUB_SHA"/);
  for (const name of ['Check CN API and D1 readiness', 'Build frontend', 'Build admin', 'Package release', 'Upload release', 'Activate release']) {
    const block = workflow.split(`      - name: ${name}\n`)[1]?.split('      - name: ')[0];
    assert.ok(block, name);
    assert.match(block, /if: \$\{\{ !inputs.preflight_only \}\}/, name);
  }
  assert.match(workflow, /previous_frontend=.*capture_previous_target/);
  assert.match(workflow, /Previous frontend:/);
  assert.match(workflow, /Refusing to replace an existing release/);
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
  assert.match(workflow, /ai\.sagemro\.cn\/service-request\?mode=manual/);
  assert.match(workflow, /noindex,nofollow,noarchive/);
  assert.match(workflow, /- AI: https:\/\/ai\.sagemro\.cn\//);
});
