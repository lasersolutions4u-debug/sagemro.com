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
  test(`${site} permits the automatic Cloudflare beacon without broadening script or connection access`, () => {
    const policy = read(`${site}/public/_headers`).match(/Content-Security-Policy: ([^\r\n]+)/)[1];
    const directives = Object.fromEntries(policy.split(';').map(part => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values]));
    assert.deepEqual(directives['script-src'], site === 'frontend'
      ? ["'self'", 'https://cdn.onesignal.com', 'https://static.cloudflareinsights.com']
      : ["'self'", 'https://static.cloudflareinsights.com']);
    assert.deepEqual(directives['connect-src'], [
      "'self'", 'https://api.sagemro.com', 'https://api.sagemro.cn',
      'https://*.sentry.io', 'https://*.ingest.sentry.io',
      ...(site === 'frontend' ? ['https://onesignal.com', 'https://*.onesignal.com', 'wss://*.onesignal.com'] : []),
    ]);
    assert.deepEqual(directives['default-src'], ["'self'"]);
    assert.deepEqual(directives['object-src'], ["'none'"]);
    assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
  });

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

test('frontend private route families return a complete noindex header', () => {
  const headers = read('frontend/public/_headers');
  for (const route of ['/work-orders/*', '/activate', '/activate/*', '/engineer/*']) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      headers,
      new RegExp(`^${escapedRoute}\\r?\\n  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex\\r?$`, 'm'),
    );
  }
});
