import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('API client posts the same v2 draft to the bounded assist endpoint', () => {
  const api = read('frontend/src/services/api.js');
  assert.match(api, /export async function assistServiceRequestDraft\(\{ message, draft/);
  assert.match(api, /\/api\/service-request-assist/);
  assert.match(api, /headers: authHeaders\(\)/);
  assert.match(api, /body: JSON\.stringify\(\{ market, message, draft \}\)/);
});

test('AI-assisted mode only patches the canonical draft and keeps the same submit path', () => {
  const flow = read('frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx');
  assert.match(flow, /assistServiceRequestDraft/);
  assert.match(flow, /manual.*ai|ai.*manual/s);
  assert.match(flow, /contact: \{ \.\.\.current\.contact, \.\.\.patch\.contact \}/);
  assert.match(flow, /normalizeServiceRequestDraft/);
  assert.match(flow, /await onSubmit\(payload, files\)/);
  assert.equal((flow.match(/await onSubmit\(payload, files\)/g) || []).length, 1);
  assert.doesNotMatch(flow, /assistServiceRequestDraft[\s\S]{0,500}onSubmit\(/);
});

test('AI assist is disclosure-first, editable, bounded, and stale-safe', () => {
  const flow = read('frontend/src/components/ServiceRequest/ServiceRequestFlow.jsx');
  assert.match(flow, /只帮整理信息，不替代工程师诊断或报价/);
  assert.match(flow, /organizes your information only; it does not replace an engineer's diagnosis or quotation/i);
  assert.match(flow, /assistLockRef\.current/);
  assert.match(flow, /draftRevisionRef\.current/);
  assert.match(flow, /requestId !== assistRequestRef\.current|assistRequestRef\.current !== requestId/);
  assert.match(flow, /inferredFields/);
  assert.match(flow, /missing_fields/);
  assert.doesNotMatch(flow, /response\.next_question|result\.next_question|response\.safety_notice|result\.safety_notice/);
  assert.doesNotMatch(flow, /diagnosis confirmed|engineer arrives|safe to restart|warranty is guaranteed/i);
});
