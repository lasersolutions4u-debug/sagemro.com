import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('API 401 handling confirms the session before clearing signed-in state', async () => {
  const api = await read('src/services/api.js');

  assert.match(api, /const AUTH_FAILURE_EXEMPT_PATHS/);
  assert.match(api, /['"]\/api\/auth\/login['"]/);
  assert.match(api, /['"]\/api\/auth\/session['"]/);
  assert.match(api, /async function confirmAuthFailure/);
  assert.match(api, /async function confirmAuthFailure\(nativeFetch\)[\s\S]*legacyToken[\s\S]*Authorization[\s\S]*nativeFetch\(`\$\{API_BASE\}\/api\/auth\/session`/);
  assert.match(api, /nativeFetch\(`\$\{API_BASE\}\/api\/auth\/session`/);
  assert.match(api, /if \(session\.authenticated\) return/);
  assert.match(api, /confirmAuthFailure\(nativeFetch\)/);
  assert.doesNotMatch(api, /response\.status === 401[\s\S]{0,160}triggerAuthFailure\(\)/);
});

test('public auth endpoint failures are exempt from global logout', async () => {
  const api = await read('src/services/api.js');

  assert.match(api, /function shouldConfirmAuthFailure/);
  assert.match(api, /AUTH_FAILURE_EXEMPT_PATHS\.has\(url\.pathname\)/);
  assert.match(api, /response\.status === 401[\s\S]*shouldConfirmAuthFailure\(url\)/);
});
