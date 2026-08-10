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
];

for (const site of ['frontend', 'admin']) {
  test(`${site} static responses declare baseline security headers`, () => {
    const headers = read(`${site}/public/_headers`);

    assert.match(headers, /^\/\*$/m);
    for (const expected of REQUIRED_HEADERS) assert.match(headers, expected);
    assert.match(
      headers,
      site === 'frontend' ? /Permissions-Policy: camera=\(self\), microphone=\(self\), geolocation=\(self\)/ : /Permissions-Policy: camera=\(\), microphone=\(self\), geolocation=\(self\)/,
    );
    assert.match(headers, /frame-ancestors 'none'/);
    assert.match(headers, /object-src 'none'/);
    if (site === 'admin') {
      assert.match(headers, /X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex/);
    }
  });
}

test('China frontend private route families return a complete noindex header', () => {
  const headers = read('frontend/public/_headers');

  for (const route of ['/work-orders/*', '/activate', '/activate/*', '/engineer/*']) {
    assert.match(headers, new RegExp(`^${route.replaceAll('/', '\\/').replace('*', '\\*')}$`, 'm'));
  }
  assert.equal(
    [...headers.matchAll(/X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex/g)].length,
    4,
  );
});

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
  assert.match(workflow, /camera=\(self\), microphone=\(self\), geolocation=\(self\)/);
  assert.match(workflow, /map "\$host:\$uri" \$sagemro_robots_tag/);
  assert.match(workflow, /admin\\\.sagemro\\\.cn: "noindex, nofollow, noarchive, nosnippet, noimageindex"/);
  assert.match(workflow, /\(work-orders\|activate\|engineer\)\(\/\|\$\) "noindex, nofollow, noarchive, nosnippet, noimageindex"/);
  assert.match(workflow, /add_header X-Robots-Tag \$sagemro_robots_tag always;/);
  assert.match(workflow, /expect_robots_tag https:\/\/admin\.sagemro\.cn\/deploy-admin-smoke/);
  assert.match(workflow, /expect_robots_tag https:\/\/sagemro\.cn\/activate/);
  assert.match(workflow, /expect_robots_tag https:\/\/engineer\.sagemro\.cn\/work-orders\/deploy-smoke/);
  assert.match(workflow, /expect_no_robots_tag https:\/\/engineer\.sagemro\.cn\//);
});
