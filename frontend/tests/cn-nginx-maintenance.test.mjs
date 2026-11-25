/**
 * Contract for the China-edition nginx maintenance editor.
 *
 * These tests live in frontend/tests because that is the only `node --test` runner the
 * pipeline executes; the code under test is ops/maintenance/cn/nginx_maintenance.py,
 * which both the manual runner and the `Pause China sites` workflow execute on the ECS.
 *
 * The editor touches live nginx configuration on a production server, so the
 * behaviours asserted here are the safety properties, not formatting details:
 * which blocks it is allowed to touch, what it must skip, and that switching back
 * restores the original bytes.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../../ops/maintenance/cn/nginx_maintenance.py', import.meta.url));
const MARK_START = '# >>> sagemro-maintenance >>>';

const FIXTURES = {
  // A redirect block already carries a server-level `return`; inserting another one
  // would fail `nginx -t`, so it must be skipped rather than patched.
  'conf.d/sagemro-80.conf': `server {
    listen 80;
    server_name sagemro.cn www.sagemro.cn;
    return 301 https://$host$request_uri;
}
`,
  'conf.d/sagemro-443.conf': `upstream sagemro_api_worker {
    server api.sagemro.com:443;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name sagemro.cn www.sagemro.cn;

    root /var/www/sagemro-cn/current/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`,
  // This block sets default_type itself; adding a second one is a duplicate directive.
  'conf.d/ai.conf': `server {
    listen 443 ssl http2;
    server_name ai.sagemro.cn;
    default_type application/octet-stream;
    root /var/www/sagemro-cn/current/ai;
    location / { try_files $uri /index.html; }
}
`,
  'conf.d/admin.conf': `server {
    listen 443 ssl http2;
    server_name admin.sagemro.cn;
    root /var/www/sagemro-cn/current/admin;
    location / { try_files $uri /index.html; }
}
`,
  // The API proxy is a separate operation and must never be paused with the pages.
  'conf.d/api.conf': `server {
    listen 443 ssl http2;
    server_name api.sagemro.cn;
    location / { proxy_pass https://api.sagemro.com; }
}
`,
  'conf.d/unrelated.conf': `server {
    listen 443 ssl;
    server_name shop.example.com;
    location / { root /var/www/shop; }
}
`,
  // Braces inside a comment and a quoted value must not confuse the block scanner.
  'sites-enabled/engineer.conf': `# note: this block mirrors server { above }
server {
    listen 443 ssl;
    server_name engineer.sagemro.cn;
    add_header X-Note "value with { braces } and a # hash";
    location / { try_files $uri /index.html; }
}
`,
};

const PATCHED = [
  'conf.d/sagemro-443.conf',
  'conf.d/ai.conf',
  'conf.d/admin.conf',
  'sites-enabled/engineer.conf',
];
const UNTOUCHED = ['conf.d/sagemro-80.conf', 'conf.d/api.conf', 'conf.d/unrelated.conf'];

function pythonBin() {
  for (const bin of ['python3', 'python']) {
    const probe = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    const version = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
    if (probe.status === 0 && /Python 3\./.test(version)) return bin;
  }
  return null;
}

const python = pythonBin();

function makeTree(t) {
  const root = mkdtempSync(join(tmpdir(), 'sagemro-nginx-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const nginxRoot = join(root, 'nginx');
  for (const [relativePath, content] of Object.entries(FIXTURES)) {
    const target = join(nginxRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  return { root, nginxRoot, manifest: join(root, 'backups', 'last-change.txt') };
}

function run(mode, tree) {
  const result = spawnSync(
    python,
    [script, mode, '--root', tree.nginxRoot, '--manifest', tree.manifest],
    { encoding: 'utf8' },
  );
  return { status: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const read = (tree, relativePath) => readFileSync(join(tree.nginxRoot, relativePath), 'utf8');
const snapshot = (tree) =>
  Object.fromEntries(Object.keys(FIXTURES).map((path) => [path, read(tree, path)]));

test('pausing CN pages patches only the blocks that declare China hostnames', (t) => {
  if (!python) return t.skip('python3 is unavailable');
  const tree = makeTree(t);
  const before = snapshot(tree);

  const result = run('on', tree);
  assert.equal(result.status, 0, result.out);

  for (const path of PATCHED) {
    const text = read(tree, path);
    assert.match(text, new RegExp(MARK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${path} must be paused`);
    assert.match(text, /return 503 '<!doctype html>/, `${path} must answer 503 with the page`);
    assert.match(text, /系统维护中/, path);
  }

  for (const path of UNTOUCHED) {
    assert.equal(read(tree, path), before[path], `${path} must not be modified`);
  }

  // No phone number and no AI-assistant claim on the China page either.
  const china = read(tree, 'conf.d/sagemro-443.conf');
  assert.doesNotMatch(china, /tel:|1558 4520/);
  assert.doesNotMatch(china, /AI 助手/);
  assert.match(china, /mailto:support@sagemro\.com/);

  // default_type is only added where the block does not already define it.
  assert.equal((read(tree, 'conf.d/ai.conf').match(/default_type/g) ?? []).length, 1);
  assert.equal((read(tree, 'conf.d/admin.conf').match(/default_type/g) ?? []).length, 1);

  // The redirect block is reported, not silently ignored.
  assert.match(result.out, /server-level return already present/);
});

test('pausing twice is a no-op and keeps the config byte-identical', (t) => {
  if (!python) return t.skip('python3 is unavailable');
  const tree = makeTree(t);

  assert.equal(run('on', tree).status, 0);
  const once = snapshot(tree);
  const second = run('on', tree);

  assert.equal(second.status, 0, second.out);
  assert.match(second.out, /changed files: 0/);
  assert.deepEqual(snapshot(tree), once);
});

test('resuming restores the exact original bytes', (t) => {
  if (!python) return t.skip('python3 is unavailable');
  const tree = makeTree(t);
  const before = snapshot(tree);

  assert.equal(run('on', tree).status, 0);
  assert.notDeepEqual(snapshot(tree), before);

  const off = run('off', tree);
  assert.equal(off.status, 0, off.out);
  assert.deepEqual(snapshot(tree), before, 'off must be a byte-exact inverse of on');
});

test('rollback undoes an applied pause after a failed nginx -t', (t) => {
  if (!python) return t.skip('python3 is unavailable');
  const tree = makeTree(t);
  const before = snapshot(tree);

  assert.equal(run('on', tree).status, 0);
  assert.ok(existsSync(tree.manifest), 'the change must be recorded for rollback');

  const rollback = run('rollback', tree);
  assert.equal(rollback.status, 0, rollback.out);
  assert.deepEqual(snapshot(tree), before);
  assert.equal(existsSync(tree.manifest), false);
  assert.equal(existsSync(`${join(tree.nginxRoot, 'conf.d', 'admin.conf')}.sagemro-bak`), false);
});

test('status reports which China blocks are paused', (t) => {
  if (!python) return t.skip('python3 is unavailable');
  const tree = makeTree(t);

  assert.match(run('status', tree).out, /live\s+\['ai\.sagemro\.cn'\]/);
  assert.equal(run('on', tree).status, 0);
  const paused = run('status', tree);
  assert.match(paused.out, /PAUSED\s+\['ai\.sagemro\.cn'\]/);
  // Five blocks declare China hostnames; the 80->443 redirect block stays live by design.
  assert.match(paused.out, /server blocks for China hosts: 5/);
  assert.match(paused.out, /live\s+\['sagemro\.cn', 'www\.sagemro\.cn'\]/);
});

test('a config tree without any China hostname fails loudly instead of reporting success', (t) => {
  if (!python) return t.skip('python3 is unavailable');
  const tree = makeTree(t);
  rmSync(join(tree.nginxRoot, 'conf.d'), { recursive: true, force: true });
  rmSync(join(tree.nginxRoot, 'sites-enabled'), { recursive: true, force: true });

  const result = run('on', tree);
  assert.equal(result.status, 2, result.out);
  assert.match(result.out, /no server block declares a China hostname/);
});
