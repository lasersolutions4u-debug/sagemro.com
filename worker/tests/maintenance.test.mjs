import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const entry = new URL('../src/maintenance.js', import.meta.url);
const forbidden = new Proxy({}, { get() { throw new Error('Maintenance must not access bindings or background tasks'); } });

test('maintenance blocks every API method and both markets without accessing resources', async () => {
  assert.ok(existsSync(entry), 'standalone maintenance entry must exist');
  const { default: worker } = await import(entry);
  for (const host of ['api.sagemro.com', 'api.sagemro.cn', 'fictional.workers.dev']) {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      for (const route of ['/health', '/api/chat', '/api/workorders', '/api/admin/workorders/fixture/pricing/admin-approve']) {
        const response = await worker.fetch(new Request(`https://${host}${route}`, { method }), forbidden, forbidden);
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('Retry-After'), '300');
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
        if (method === 'HEAD') assert.equal(await response.text(), '');
        else assert.equal((await response.json()).code, 'MAINTENANCE');
      }
    }
  }
});

test('maintenance supplies CORS only to exact production origins and never sets a session cookie', async () => {
  assert.ok(existsSync(entry), 'standalone maintenance entry must exist');
  const { default: worker } = await import(entry);
  for (const market of ['com', 'cn']) {
    for (const prefix of ['', 'www.', 'ai.', 'admin.', 'engineer.']) {
      const origin = `https://${prefix}sagemro.${market}`;
      const response = await worker.fetch(new Request(`https://api.sagemro.${market}/api/workorders`, { headers: { Origin: origin } }), forbidden, forbidden);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
      assert.equal(response.headers.get('Vary'), 'Origin');
      assert.equal(response.headers.get('Set-Cookie'), null);
      assert.match((await response.json()).error, market === 'cn' ? /维护/ : /maintenance/);
    }
  }
  for (const origin of ['null', 'https://sagemro.com.evil.invalid', 'http://admin.sagemro.com', 'https://untrusted.sagemro.com']) {
    const response = await worker.fetch(new Request('https://api.sagemro.com/api/workorders', { headers: { Origin: origin } }), forbidden, forbidden);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.status, 503);
  }
});

test('maintenance preflight permits clients to read the maintenance response without performing business work', async () => {
  assert.ok(existsSync(entry), 'standalone maintenance entry must exist');
  const { default: worker } = await import(entry);
  const response = await worker.fetch(new Request('https://api.sagemro.cn/api/workorders', { method: 'OPTIONS', headers: { Origin: 'https://ai.sagemro.cn' } }), forbidden, forbidden);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

test('maintenance scheduled events cannot access either database, storage, notifications or waitUntil', async () => {
  assert.ok(existsSync(entry), 'standalone maintenance entry must exist');
  const { default: worker } = await import(entry);
  assert.equal(await worker.scheduled(forbidden, forbidden, forbidden), undefined);
});
