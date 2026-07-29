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

test('engineer detail places one guidance card above Admin support in a sticky 320px rail', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  assert.match(detail, /lg:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.match(detail, /<aside className="space-y-3 self-start lg:sticky lg:top-4"/);
  assert.match(detail, /<EngineerServiceGuidanceCard[\s\S]*copy\.support/);
  assert.equal(detail.match(/<EngineerServiceGuidanceCard/g)?.length, 1);
  assert.doesNotMatch(detail, /<EngineerServiceReadinessCard/);
});

test('mobile source order is summary, progress, AI rail, then tabbed content', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  assert.match(
    detail,
    /copy\.nextStep[\s\S]*<EngineerServiceStandardProgress[\s\S]*<aside className="space-y-3 self-start lg:sticky lg:top-4"[\s\S]*<EngineerServiceGuidanceCard[\s\S]*role="tablist"/,
  );
  assert.match(detail, /\[grid-area:rail\]/);
  assert.match(detail, /\[grid-area:main\]/);
  assert.match(detail, /lg:\[grid-template-areas:'main_rail'\]/);
});

test('service-standard state is server-backed and reloads after confirmation', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.match(detail, /getWorkOrderServiceStandard/);
  assert.match(detail, /currentStepIndex=\{serviceStandard\.current_step_index\}/);
  assert.match(detail, /serviceStandard\.steps\?\.\[serviceStandard\.current_step_index\]/);
  assert.match(detail, /await confirmWorkOrderServiceStandardItem\(detail\.id, item\.key, payload\)/);
  assert.match(detail, /await loadServiceStandard\(\)/);
  assert.match(detail, /requestError\.data\?\.error \|\| requestError\.message/);
  assert.doesNotMatch(detail, /checkedChecklistItems|toggleChecklistItem/);
});

test('service-standard loading and failures never invent a current first stage', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.match(detail, /const \[serviceStandardStatus, setServiceStandardStatus\] = useState\('idle'\)/);
  assert.match(
    detail,
    /setServiceStandard\(null\)[\s\S]*setServiceStandardStatus\('loading'\)[\s\S]*getWorkOrderServiceStandard/,
  );
  assert.match(
    detail,
    /serviceStandardStatus === 'loaded' && serviceStandard && \([\s\S]*<EngineerServiceStandardProgress/,
  );
  assert.match(
    detail,
    /serviceStandardStatus === 'loading'[\s\S]*role="status"[\s\S]*copy\.standardLoading/,
  );
  assert.match(
    detail,
    /serviceStandardStatus === 'failed' && serviceStandardError[\s\S]*role="alert"/,
  );
  assert.doesNotMatch(detail, /steps=\{serviceStandard\?\.steps \|\| \[\]\}/);
  assert.doesNotMatch(detail, /currentStepIndex=\{serviceStandard\?\.current_step_index \?\? 0\}/);
});

test('guidance feedback refreshes AI without confirming fixed standard items', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.match(detail, /submitWorkOrderServiceGuidanceFeedback/);
  assert.match(detail, /guidance_generated_at: generatedAt/);
  assert.match(detail, /action_index: actionIndex/);
  assert.match(detail, /feedback_type: feedbackType/);
  assert.match(detail, /await refreshGuidance\(\)/);
  const feedbackHandler = detail.match(/const handleGuidanceFeedback[\s\S]*?\n  };/)?.[0] || '';
  assert.doesNotMatch(feedbackHandler, /confirmWorkOrderServiceStandardItem/);
});

test('draft handoff uses the existing message composer and never sends automatically', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const messages = read('frontend/src/components/WorkOrder/MessagePanel.jsx');
  const card = read('frontend/src/components/Engineer/EngineerServiceGuidanceCard.jsx');
  assert.match(detail, /setMessageDraftRequest\(\{ id: .*text: question\.draft \}\)/);
  assert.match(detail, /setActiveTab\('messages'\)/);
  assert.match(modal, /messageDraftRequest/);
  assert.match(messages, /confirmDialog\(copy\.replaceDraft/);
  assert.match(messages, /onDraftRequestApplied/);
  assert.match(messages, /composerInputRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(card, /postWorkOrderMessage/);
});
