import assert from 'node:assert/strict';
import { linkSync, lstatSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'ops/configure_public_routes.py');
const deployWorkflow = readFileSync(path.join(root, '.github/workflows/aliyun-cn-deploy.yml'), 'utf8');
const python = ['python3', 'python'].find((command) => spawnSync(command, ['--version']).status === 0);

const privateRouteContract = String.raw`error_page 404 /404.html;
  location = /404.html { internal; }
  location = /activate { try_files /index.html =404; }
  location = /engineer { try_files /index.html =404; }
  location ~ ^/work-orders/[^/]+$ { try_files /index.html =404; }
  location / { try_files $uri $uri/ =404; }`;

test('configures real public 404s while preserving customer and engineer SPA deep links', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'sites.conf');
  const initial = `
server {
  listen 443 ssl http2;
  server_name sagemro.cn www.sagemro.cn;
  root /var/www/sagemro-cn/current/frontend;
  location / { try_files $uri /index.html; }
}

server {
  listen 443 ssl http2;
  server_name engineer.sagemro.cn;
  root /var/www/sagemro-cn/current/engineer;
  location / {
    try_files $uri $uri/ /index.html;
  }
}

server {
  listen 443 ssl http2;
  server_name admin.sagemro.cn;
  root /var/www/sagemro-cn/current/admin;
  location / { try_files $uri /index.html; }
}

server {
  listen 443 ssl http2;
  server_name api.sagemro.cn;
  location / { proxy_pass https://api.sagemro.com; }
}
`;
  writeFileSync(config, initial);

  const firstRun = spawnSync(python, [script, '--require-api-proxy', config], { encoding: 'utf8' });
  assert.equal(firstRun.status, 0, firstRun.stderr);

  const updated = readFileSync(config, 'utf8');
  const [customer, engineer, admin, api] = updated.match(/server\s*\{[\s\S]*?\n\}/g);

  assert.match(customer, /listen 443 ssl http2 default_server;/);
  assert.match(customer, /if \(\$host !~ \^\(\?:sagemro\\\.cn\|www\\\.sagemro\\\.cn\)\$\) \{ return 444; \}/);
  assert.match(customer, /if \(\$host = www\.sagemro\.cn\) \{ return 301 https:\/\/sagemro\.cn\$request_uri; \}/);
  assert.match(customer, new RegExp(privateRouteContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(engineer, /if \(\$host !~ \^\(\?:engineer\\\.sagemro\\\.cn\)\$\) \{ return 444; \}/);
  assert.match(engineer, new RegExp(privateRouteContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(updated, /location\s+~\s+\^\(\.\+\)\/\$/);
  assert.doesNotMatch(updated, /try_files[^;]*\/404\.html/);
  assert.doesNotMatch(engineer, /www\.sagemro\.cn|https:\/\/sagemro\.cn\$request_uri/);
  assert.match(admin, /location \/ \{ try_files \$uri \/index\.html; \}/);
  assert.match(admin, /if \(\$host !~ \^\(\?:admin\\\.sagemro\\\.cn\)\$\) \{ return 444; \}/);
  assert.doesNotMatch(admin, /\/404\.html|work-orders/);
  assert.match(api, /if \(\$host !~ \^\(\?:api\\\.sagemro\\\.cn\)\$\) \{ return 444; \}/);
  assert.match(api, /proxy_pass https:\/\/sagemro_api_worker/);
  assert.match(api, /proxy_http_version 1\.1;/);
  assert.match(api, /proxy_set_header Connection "";/);
  assert.match(api, /proxy_set_header Host api\.sagemro\.com;/);
  assert.match(api, /proxy_ssl_server_name on;/);
  assert.match(api, /proxy_ssl_name api\.sagemro\.com;/);
  assert.match(deployWorkflow, /upstream sagemro_api_worker \{[\s\S]*server api\.sagemro\.com:443;[\s\S]*keepalive 32;[\s\S]*\}/);

  const secondRun = spawnSync(python, [script, '--require-api-proxy', config], { encoding: 'utf8' });
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.equal(readFileSync(config, 'utf8'), updated);
});

test('refuses an unknown API proxy shape without modifying any input file', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'sites.conf');
  const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn;
  location / { try_files $uri /index.html; }
}
server {
  listen 443 ssl;
  server_name api.sagemro.cn;
  location / { proxy_pass https://unknown.example.com; }
}\n`;
  writeFileSync(config, initial);

  const result = spawnSync(python, [script, '--require-api-proxy', config], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /recognized API proxy_pass/i);
  assert.equal(readFileSync(config, 'utf8'), initial);
});

test('required API optimization fails closed when no API server is present', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'customer.conf');
  const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(config, initial);

  const result = spawnSync(python, [script, '--require-api-proxy', config], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one api\.sagemro\.cn TLS server block/i);
  assert.equal(readFileSync(config, 'utf8'), initial);
});

test('removes the previously generated reverse trailing-slash redirect without disturbing public routes', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'sites.conf');
  const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn www.sagemro.cn;
  if ($host = www.sagemro.cn) { return 301 https://sagemro.cn$request_uri; }
  error_page 404 /404.html;
  location = /404.html { internal; }
  location = /activate { try_files /index.html =404; }
  location = /engineer { try_files /index.html =404; }
  location ~ ^/work-orders/[^/]+$ { try_files /index.html =404; }
  location ~ ^(.+)/$ { return 301 https://$host$1; }
  location / { try_files $uri $uri/ =404; }
}
`;
  writeFileSync(config, initial);

  const firstRun = spawnSync(python, [script, config], { encoding: 'utf8' });
  assert.equal(firstRun.status, 0, firstRun.stderr);

  const updated = readFileSync(config, 'utf8');
  assert.doesNotMatch(updated, /location\s+~\s+\^\(\.\+\)\/\$/);
  assert.match(updated, /location = \/activate \{ try_files \/index\.html =404; \}/);
  assert.match(updated, /location \/ \{ try_files \$uri \$uri\/ =404; \}/);

  const secondRun = spawnSync(python, [script, config], { encoding: 'utf8' });
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.equal(readFileSync(config, 'utf8'), updated);
});

test('refuses an unrecognized customer fallback without modifying any input file', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const validConfig = path.join(directory, 'customer.conf');
  const invalidConfig = path.join(directory, 'engineer.conf');
  const validInitial = `server {
  listen 443 ssl;
  server_name sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  const invalidInitial = `server {
  listen 443 ssl;
  server_name engineer.sagemro.cn;
  location / { proxy_pass http://legacy_engineer; }
}\n`;
  writeFileSync(validConfig, validInitial);
  writeFileSync(invalidConfig, invalidInitial);

  const result = spawnSync(python, [script, validConfig, invalidConfig], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /recognized location \/ fallback/i);
  assert.equal(readFileSync(validConfig, 'utf8'), validInitial);
  assert.equal(readFileSync(invalidConfig, 'utf8'), invalidInitial);
});

test('refuses a configuration set with no customer or engineer server', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'admin.conf');
  const initial = `server {
  listen 443 ssl;
  server_name admin.sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(config, initial);

  const result = spawnSync(python, [script, config], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No sagemro\.cn customer or engineer server block was found/);
  assert.equal(readFileSync(config, 'utf8'), initial);
});

test('refuses an engineer-only configuration without creating a TLS default server', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'engineer.conf');
  const initial = `server {
  listen 443 ssl;
  server_name engineer.sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(config, initial);

  const result = spawnSync(python, [script, config], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one customer TLS server block/i);
  assert.equal(readFileSync(config, 'utf8'), initial);
});

test('refuses to alter an admin host that shares a public server block', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  for (const publicHost of ['sagemro.cn', 'engineer.sagemro.cn']) {
    const config = path.join(directory, `${publicHost}.conf`);
    const initial = `server {
  listen 443 ssl;
  server_name ${publicHost} admin.sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
    writeFileSync(config, initial);

    const result = spawnSync(python, [script, config], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /admin\.sagemro\.cn cannot share a server block/i);
    assert.equal(readFileSync(config, 'utf8'), initial);
  }
});

test('preserves quoted server_name arguments when detecting mixed admin hosts', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'quoted-admin.conf');
  const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn "admin.sagemro.cn";
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(config, initial);

  const result = spawnSync(python, [script, config], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /admin\.sagemro\.cn cannot share a server block/i);
  assert.equal(readFileSync(config, 'utf8'), initial);
});

test('refuses any server block that mixes API with another official host kind', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  for (const otherHost of ['sagemro.cn', 'engineer.sagemro.cn', 'admin.sagemro.cn']) {
    const config = path.join(directory, `${otherHost}.conf`);
    const initial = `server {
  listen 443 ssl;
  server_name ${otherHost} api.sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
    writeFileSync(config, initial);

    const result = spawnSync(python, [script, config], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /official host kinds cannot share a server block/i);
    assert.equal(readFileSync(config, 'utf8'), initial);
  }
});

test('refuses multiple customer TLS blocks instead of creating duplicate defaults', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const configs = ['first.conf', 'second.conf'].map((name) => path.join(directory, name));
  const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn www.sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  for (const config of configs) writeFileSync(config, initial);

  const result = spawnSync(python, [script, ...configs], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one customer TLS server block/i);
  for (const config of configs) assert.equal(readFileSync(config, 'utf8'), initial);
});

test('ignores target hostnames and canonical directives inside comments', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const unrelatedConfig = path.join(directory, 'unrelated.conf');
  const unrelatedInitial = `server {
  listen 443 ssl;
  server_name unrelated.example.com; # server_name sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(unrelatedConfig, unrelatedInitial);

  const unrelatedResult = spawnSync(python, [script, unrelatedConfig], { encoding: 'utf8' });
  assert.notEqual(unrelatedResult.status, 0);
  assert.equal(readFileSync(unrelatedConfig, 'utf8'), unrelatedInitial);

  const customerConfig = path.join(directory, 'customer.conf');
  writeFileSync(customerConfig, `server {
  listen 443 ssl;
  server_name sagemro.cn www.sagemro.cn;
  # ${'if ($host = www.sagemro.cn) { return 301 https://sagemro.cn$request_uri; }'}
  location / { try_files $uri /index.html; }
}\n`);

  const customerResult = spawnSync(python, [script, customerConfig], { encoding: 'utf8' });
  assert.equal(customerResult.status, 0, customerResult.stderr);
  const activeCanonicalLines = readFileSync(customerConfig, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#') && line.includes('https://sagemro.cn$request_uri'));
  assert.equal(activeCanonicalLines.length, 1);
});

test('ignores hostnames and canonical text inside quoted values of other directives', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'quoted-decoys.conf');
  writeFileSync(config, `server {
  listen 443 ssl;
  server_name sagemro.cn www.sagemro.cn;
  set $host_note "server_name admin.sagemro.cn;";
  set $canonical_note "if ($host = www.sagemro.cn) { return 301 https://sagemro.cn$request_uri; }";
  location / { try_files $uri /index.html; }
}\n`);

  const result = spawnSync(python, [script, config], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const activeCanonicalLines = readFileSync(config, 'utf8')
    .split('\n')
    .filter((line) => line.trimStart().startsWith('if ($host = www.sagemro.cn)'));
  assert.equal(activeCanonicalLines.length, 1);
});

test('tracks quoted strings across lines when matching server block braces', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'multiline-quote.conf');
  const unrelatedBlock = `server {
  listen 443 ssl;
  server_name unrelated.example.com;
  set $multi_line_note "{
    server_name sagemro.cn;
  }";
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(config, `${unrelatedBlock}
server {
  listen 443 ssl;
  server_name sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`);

  const result = spawnSync(python, [script, config], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const updated = readFileSync(config, 'utf8');
  assert.match(updated, new RegExp(unrelatedBlock.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(updated, /server_name sagemro\.cn;[\s\S]*error_page 404 \/404\.html;/);
});

test('refuses route directives that would conflict with generated public routing', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const conflicts = [
    'error_page 404 /legacy-404.html;',
    'error_page 403 404 /legacy-404.html;',
    'location = /404.html { internal; }',
    'location = /activate { try_files /index.html =404; }',
    'location = "/activate" { try_files /index.html =404; }',
    'location = /engineer { try_files /index.html =404; }',
    'location ~ ^/work-orders/.+$ { try_files /index.html =404; }',
    'location ~ ^(.+)/$ { return 308 https://$host$1; }',
  ];

  for (const [index, conflict] of conflicts.entries()) {
    const config = path.join(directory, `conflict-${index}.conf`);
    const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn;
  ${conflict}
  location / { try_files $uri /index.html; }
}\n`;
    writeFileSync(config, initial);

    const result = spawnSync(python, [script, config], { encoding: 'utf8' });

    assert.notEqual(result.status, 0, conflict);
    assert.match(result.stderr, /conflicts with generated public route directives/i);
    assert.equal(readFileSync(config, 'utf8'), initial);
  }
});

test('resolves configs and refuses duplicate input inodes without replacing symlinks', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'customer.conf');
  const symlink = path.join(directory, 'active-customer.conf');
  const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(config, initial);
  symlinkSync(config, symlink);

  const result = spawnSync(python, [script, symlink, config], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate Nginx config inode/i);
  assert.equal(lstatSync(symlink).isSymbolicLink(), true);
  assert.equal(readFileSync(config, 'utf8'), initial);
  assert.equal(readFileSync(symlink, 'utf8'), initial);
});

test('refuses hard-linked configs without changing either directory entry', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  const config = path.join(directory, 'customer.conf');
  const hardlink = path.join(directory, 'customer-hardlink.conf');
  const initial = `server {
  listen 443 ssl;
  server_name sagemro.cn;
  location / { try_files $uri /index.html; }
}\n`;
  writeFileSync(config, initial);
  linkSync(config, hardlink);

  const result = spawnSync(python, [script, config, hardlink], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /hard-linked Nginx config/i);
  assert.equal(readFileSync(config, 'utf8'), initial);
  assert.equal(readFileSync(hardlink, 'utf8'), initial);
});

test('attempts every rollback and reports both write and restore failures', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-public-routes-'));
  for (const [index, name] of ['first.conf', 'second.conf', 'third.conf'].entries()) {
    const host = index === 0 ? 'sagemro.cn' : 'engineer.sagemro.cn';
    writeFileSync(path.join(directory, name), `server {
  listen 443 ssl;
  server_name ${host};
  location / { try_files $uri /index.html; }
}\n`);
  }

  const harness = String.raw`
import importlib.util
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('configure_public_routes', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
directory = Path(sys.argv[2])
paths = [directory / name for name in ('first.conf', 'second.conf', 'third.conf')]
originals = {path: path.read_bytes() for path in paths}
real_write_atomic = module.write_atomic

def failing_write(path, content, stat):
    is_updated = b'try_files $uri $uri/ =404;' in content
    if path == paths[2] and is_updated:
        raise OSError('primary write failure')
    if path == paths[1] and not is_updated:
        raise OSError('rollback second failure')
    real_write_atomic(path, content, stat)

module.write_atomic = failing_write
try:
    module.update_configs(paths)
except OSError as error:
    if paths[0].read_bytes() != originals[paths[0]]:
        raise SystemExit('first file was not restored after a later rollback failed')
    message = str(error)
    if 'primary write failure' not in message or 'rollback second failure' not in message:
        raise SystemExit(f'incomplete combined error: {message}')
else:
    raise SystemExit('expected an injected write failure')
`;

  const result = spawnSync(python, ['-c', harness, script, directory], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
