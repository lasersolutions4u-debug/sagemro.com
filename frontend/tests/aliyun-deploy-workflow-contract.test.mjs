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

test('Aliyun deployment provisions the AI DNS, certificate, and Nginx host safely', () => {
  assert.match(workflow, /aliyun alidns DescribeDomainRecords/);
  assert.match(workflow, /aliyun alidns AddDomainRecord/);
  assert.match(workflow, /aliyun alidns UpdateDomainRecord/);
  assert.match(workflow, /Refusing to change ambiguous ai\.sagemro\.cn DNS records/);
  assert.match(workflow, /certbot show_account --non-interactive/);
  assert.match(workflow, /certbot certonly[\s\S]*--webroot[\s\S]*--cert-name ai\.sagemro\.cn/);
  assert.match(workflow, /\/etc\/nginx\/conf\.d\/sagemro-cn-ai\.conf/);
  assert.match(workflow, /root \/var\/www\/sagemro-cn\/current\/ai;/);
  assert.match(workflow, /server_name ai\.sagemro\.cn;/);
  assert.match(workflow, /trap rollback_ai_edge ERR/);
  assert.match(workflow, /nginx -t[\s\S]*systemctl reload nginx/);
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
