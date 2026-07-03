import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import {
  buildChatSmokePayload,
  buildSmokeTargets,
  classifyMarket,
  isCliEntry,
  parseSmokeArgs,
  summarizeResult,
} from '../scripts/production-smoke.mjs';

test('buildSmokeTargets covers six public entries and two API health checks', () => {
  const targets = buildSmokeTargets();
  const keys = targets.map((target) => target.key);

  assert.deepEqual(keys, [
    'com-home',
    'cn-home',
    'admin-com',
    'admin-cn',
    'engineer-com',
    'engineer-cn',
    'api-com-health',
    'api-cn-health',
  ]);
});

test('classifyMarket separates .cn and .com URLs', () => {
  assert.equal(classifyMarket('https://sagemro.com/'), 'com');
  assert.equal(classifyMarket('https://api.sagemro.com/health'), 'com');
  assert.equal(classifyMarket('https://sagemro.cn/'), 'cn');
  assert.equal(classifyMarket('https://admin.sagemro.cn/'), 'cn');
});

test('parseSmokeArgs requires explicit allow-write for chat smoke', () => {
  assert.throws(
    () => parseSmokeArgs(['--chat']),
    /requires --allow-write/,
  );

  assert.deepEqual(parseSmokeArgs(['--chat', '--allow-write']), {
    chat: true,
    allowWrite: true,
    json: false,
  });
});

test('buildChatSmokePayload exposes exact conversation ids for cleanup', () => {
  const payload = buildChatSmokePayload('cn', '20260621000000');

  assert.equal(payload.conversationId, 'smoke-cn-20260621000000');
  assert.match(payload.message, /SAGEMRO_SMOKE_20260621000000/);
});

test('summarizeResult marks slow targets as warnings, not failures', () => {
  const result = summarizeResult({
    key: 'api-cn-health',
    url: 'https://api.sagemro.cn/health',
    status: 200,
    elapsedMs: 4200,
    ok: true,
    thresholdMs: 3000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.warning, 'slow: 4200ms > 3000ms');
});

test('isCliEntry handles spaces and unicode in script paths', () => {
  const scriptPath = '/tmp/SAGEMRO AI/中文 smoke/production-smoke.mjs';
  const moduleUrl = pathToFileURL(scriptPath).href;

  assert.equal(isCliEntry(moduleUrl, scriptPath), true);
  assert.equal(isCliEntry(moduleUrl, '/tmp/other-script.mjs'), false);
});

test('isCliEntry supports Windows argv paths', () => {
  assert.equal(
    isCliEntry(
      'file:///C:/repo/worker/scripts/production-smoke.mjs',
      'C:\\repo\\worker\\scripts\\production-smoke.mjs',
    ),
    true,
  );
});
