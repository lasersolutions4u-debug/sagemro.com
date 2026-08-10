import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const workflow = readFileSync(path.join(root, '.github/workflows/aliyun-cn-deploy.yml'), 'utf8');

test('China release packages and validates the public route configurator', () => {
  assert.match(workflow, /cp ops\/configure_public_routes\.py release\/ops\//);
  assert.match(workflow, /test -f release\/ops\/configure_public_routes\.py/);
});

test('China activation configures public routes after backup and before HTTP\/2 validation', () => {
  const backup = workflow.indexOf('$SUDO tar -czf "$nginx_backup" "${nginx_config_files[@]}"');
  const publicRoutes = workflow.indexOf(
    '$SUDO python3 "$release/ops/configure_public_routes.py" --require-api-proxy "${nginx_config_files[@]}"',
  );
  const http2 = workflow.indexOf(
    '$SUDO python3 "$release/ops/enable_nginx_http2.py" "${nginx_config_files[@]}"',
  );
  const nginxValidation = workflow.indexOf('$SUDO nginx -t', http2);

  assert.notEqual(backup, -1);
  assert.notEqual(publicRoutes, -1);
  assert.notEqual(http2, -1);
  assert.notEqual(nginxValidation, -1);
  assert.ok(backup < publicRoutes);
  assert.ok(publicRoutes < http2);
  assert.ok(http2 < nginxValidation);
  assert.match(workflow, /mapfile -t nginx_config_files/);
  assert.doesNotMatch(workflow, /python3 "\$release\/ops\/(?:configure_public_routes|enable_nginx_http2)\.py" \$nginx_config_files/);
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
