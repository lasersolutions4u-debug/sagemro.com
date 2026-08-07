import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'ops/configure_public_routes.py');
const python = ['python3', 'python'].find((command) => spawnSync(command, ['--version']).status === 0);

const privateRouteContract = String.raw`location = /activate { try_files /index.html =404; }
  location = /engineer { try_files /index.html =404; }
  location ~ ^/work-orders/[^/]+$ { try_files /index.html =404; }
  location ~ ^(.+)/$ { return 301 https://$host$1; }
  location / { try_files $uri $uri/ /404.html =404; }`;

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
    try_files $uri /index.html;
  }
}

server {
  listen 443 ssl http2;
  server_name admin.sagemro.cn;
  root /var/www/sagemro-cn/current/admin;
  location / { try_files $uri /index.html; }
}
`;
  writeFileSync(config, initial);

  const firstRun = spawnSync(python, [script, config], { encoding: 'utf8' });
  assert.equal(firstRun.status, 0, firstRun.stderr);

  const updated = readFileSync(config, 'utf8');
  const [customer, engineer, admin] = updated.match(/server\s*\{[\s\S]*?\n\}/g);

  assert.match(customer, /if \(\$host = www\.sagemro\.cn\) \{ return 301 https:\/\/sagemro\.cn\$request_uri; \}/);
  assert.match(customer, new RegExp(privateRouteContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(engineer, new RegExp(privateRouteContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(engineer, /www\.sagemro\.cn|https:\/\/sagemro\.cn\$request_uri/);
  assert.match(admin, /location \/ \{ try_files \$uri \/index\.html; \}/);
  assert.doesNotMatch(admin, /\/404\.html|work-orders/);

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
