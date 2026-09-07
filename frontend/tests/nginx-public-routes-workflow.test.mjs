import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const workflow = readFileSync(path.join(root, '.github/workflows/aliyun-cn-deploy.yml'), 'utf8');

test('China pages-only release does not package infrastructure mutators', () => {
  assert.doesNotMatch(workflow, /release\/ops|configure_public_routes\.py|enable_nginx_http2\.py/);
});

test('China activation records recoverable links and validates unchanged configuration before switching', () => {
  const backup = workflow.indexOf('tee "$release_state"');
  const nginxValidation = workflow.indexOf('$SUDO nginx -t', backup);
  const frontendActivation = workflow.indexOf('$SUDO ln -sfnT "$release/frontend" "$current/frontend"');
  assert.notEqual(backup, -1);
  assert.notEqual(nginxValidation, -1);
  assert.notEqual(frontendActivation, -1);
  assert.ok(backup < nginxValidation);
  assert.ok(nginxValidation < frontendActivation);
  assert.match(workflow, /Nginx configuration changed during the pages-only release/);
  assert.doesNotMatch(workflow, /tar -xzf "\$nginx_backup"|rm -f "\$link_path"/);
});

test('China deployment attempts rollback for failed or cancelled activation and health checks', () => {
  assert.match(
    workflow,
    /steps\.activate\.outcome == 'cancelled'/,
  );
  assert.match(
    workflow,
    /steps\.health\.outcome == 'cancelled'/,
  );
});

test('China health checks cover private SPA routes and real public 404s', () => {
  assert.match(workflow, /https:\/\/sagemro\.cn\/activate/);
  assert.match(workflow, /https:\/\/engineer\.sagemro\.cn\/work-orders\/deploy-smoke/);
  assert.match(workflow, /https:\/\/admin\.sagemro\.cn\/deploy-admin-smoke/);
  assert.match(workflow, /expected HTTP 200/);
  assert.match(workflow, /https:\/\/sagemro\.cn\/deploy-404-smoke/);
  assert.match(workflow, /https:\/\/engineer\.sagemro\.cn\/deploy-404-smoke/);
  assert.match(workflow, /expected HTTP 404/);
});

test('China health checks reject an unknown HTTPS host on the production address', () => {
  assert.match(workflow, /unexpected\.invalid/);
  assert.match(workflow, /--resolve/);
  assert.match(workflow, /unknown host expected to be rejected/i);
});
