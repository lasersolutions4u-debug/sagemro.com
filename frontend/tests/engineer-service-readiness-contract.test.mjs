import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('readiness API preserves authenticated status and explicit refresh semantics', () => {
  const api = read('frontend/src/services/api.js');
  assert.match(api, /export async function getWorkOrderServiceReadiness/);
  assert.match(api, /\/service-readiness`/);
  assert.match(api, /export async function refreshWorkOrderServiceReadiness/);
  assert.match(api, /body: JSON\.stringify\(\{ force \}\)/);
});

test('engineer detail renders the readiness card above Admin support in a 320px rail', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  assert.match(detail, /lg:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.match(detail, /isExecutingEngineer && canViewServiceReadiness/);
  assert.match(detail, /<EngineerServiceReadinessCard/);
  assert.match(detail, /<EngineerServiceReadinessCard[\s\S]*copy\.support/);
  assert.match(detail, /setInterval\(loadServiceReadiness, 2000\)/);
  assert.match(detail, /pollAttempts.*>= 10/);
  assert.doesNotMatch(detail, /await refreshWorkOrderServiceReadiness[\s\S]*loadDetail/);
});

test('draft handoff uses the existing message composer and never sends automatically', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const messages = read('frontend/src/components/WorkOrder/MessagePanel.jsx');
  const card = read('frontend/src/components/Engineer/EngineerServiceReadinessCard.jsx');
  assert.match(detail, /setMessageDraftRequest\(\{ id: .*text: question\.draft \}\)/);
  assert.match(detail, /setActiveTab\('messages'\)/);
  assert.match(modal, /messageDraftRequest/);
  assert.match(messages, /confirmDialog\(copy\.replaceDraft/);
  assert.match(messages, /onDraftRequestApplied/);
  assert.match(messages, /composerInputRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(card, /postWorkOrderMessage/);
});
