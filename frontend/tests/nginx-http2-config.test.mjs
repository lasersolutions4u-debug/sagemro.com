import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'ops/enable_nginx_http2.py');
const python = ['python3', 'python'].find((command) => spawnSync(command, ['--version']).status === 0);

test('Nginx HTTP/2 configurator only changes China HTTPS server blocks', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-nginx-'));
  const config = path.join(directory, 'sites.conf');
  const initial = `
server {
  listen 443 ssl;
  listen [::]:443 default_server ssl; # IPv6
  server_name sagemro.cn admin.sagemro.cn;
  location / { try_files $uri /index.html; }
}

server {
  listen 443 ssl;
  server_name unrelated.example.com;
}

server {
  listen 443 ssl;
  server_name staging.sagemro.cn;
}

server {
  listen 80;
  server_name engineer.sagemro.cn;
}
`;
  writeFileSync(config, initial);

  const firstRun = spawnSync(python, [script, config], { encoding: 'utf8' });
  assert.equal(firstRun.status, 0, firstRun.stderr);

  const updated = readFileSync(config, 'utf8');
  assert.match(updated, /listen 443 ssl http2;/);
  assert.match(updated, /listen \[::\]:443 default_server ssl http2; # IPv6/);
  assert.match(updated, /server_name sagemro\.cn admin\.sagemro\.cn;/);
  assert.match(updated, /listen 443 ssl;\n  server_name unrelated\.example\.com;/);
  assert.match(updated, /listen 443 ssl;\n  server_name staging\.sagemro\.cn;/);
  assert.match(updated, /listen 80;\n  server_name engineer\.sagemro\.cn;/);

  const secondRun = spawnSync(python, [script, config], { encoding: 'utf8' });
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.equal(readFileSync(config, 'utf8'), updated);
});

test('Nginx HTTP/2 configurator fails when no China HTTPS block exists', { skip: !python }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sagemro-nginx-'));
  const config = path.join(directory, 'sites.conf');
  writeFileSync(config, 'server { listen 443 ssl; server_name unrelated.example.com; }\n');

  const result = spawnSync(python, [script, config], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No sagemro\.cn HTTPS server block was found/);
});
