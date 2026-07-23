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
  });
}
