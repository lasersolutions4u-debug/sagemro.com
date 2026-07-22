import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const REQUIRED_HEADERS = [
  /Content-Security-Policy:/,
  /Strict-Transport-Security: max-age=31536000; includeSubDomains/,
  /X-Content-Type-Options: nosniff/,
  /X-Frame-Options: DENY/,
  /Referrer-Policy: strict-origin-when-cross-origin/,
  /Permissions-Policy: camera=\(\), microphone=\(self\), geolocation=\(self\)/,
];

for (const site of ['frontend', 'admin']) {
  test(`${site} static responses declare baseline security headers`, () => {
    const headers = read(`${site}/public/_headers`);

    assert.match(headers, /^\/\*$/m);
    for (const expected of REQUIRED_HEADERS) assert.match(headers, expected);
    assert.match(headers, /frame-ancestors 'none'/);
    assert.match(headers, /object-src 'none'/);
  });
}

test('China ECS Nginx release applies the same headers only to SAGEMRO hosts', () => {
  const workflow = read('.github/workflows/aliyun-cn-deploy.yml');

  assert.match(workflow, /map \$host \$sagemro_content_security_policy/);
  assert.match(workflow, /~\^\(\(www\\\.\)\?sagemro\\\.cn\|admin\\\.sagemro\\\.cn\|engineer\\\.sagemro\\\.cn\)\$/);
  for (const header of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ]) {
    assert.match(workflow, new RegExp(`add_header ${header}`));
  }
  assert.match(workflow, /camera=\(\), microphone=\(self\), geolocation=\(self\)/);
});
