import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

async function importServiceStandardCoordinator() {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  const startMarker = '// TESTABLE_SERVICE_STANDARD_COORDINATOR_START';
  const endMarker = '// TESTABLE_SERVICE_STANDARD_COORDINATOR_END';
  const start = detail.indexOf(startMarker);
  const end = detail.indexOf(endMarker);
  assert.notEqual(start, -1, 'service-standard coordinator start marker is missing');
  assert.notEqual(end, -1, 'service-standard coordinator end marker is missing');
  const source = detail
    .slice(start + startMarker.length, end)
    .replaceAll('export function', 'function')
    .concat('\nexport { createServiceStandardRequestCoordinator, matchesServiceStandardDetail };');
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

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

  assert.match(detail, /const \[serviceStandardState, setServiceStandardState\] = useState/);
  assert.match(detail, /workOrderId: null,\s*snapshot: null/);
  assert.match(
    detail,
    /status: 'loading',\s*workOrderId: serviceStandardWorkOrderId,\s*snapshot: null/,
  );
  assert.match(
    detail,
    /serviceStandardMatchesDetail && \([\s\S]*<EngineerServiceStandardProgress/,
  );
  assert.match(
    detail,
    /serviceStandardStatus === 'loading'[\s\S]*role="status"[\s\S]*copy\.standardLoading/,
  );
  assert.match(
    detail,
    /serviceStandardStatus === 'failed'[\s\S]*serviceStandardSnapshotWorkOrderId === detail\.id/,
  );
  assert.match(
    detail,
    /serviceStandardLoadFailed && serviceStandardError[\s\S]*role="alert"/,
  );
  assert.doesNotMatch(detail, /steps=\{serviceStandard\?\.steps \|\| \[\]\}/);
  assert.doesNotMatch(detail, /currentStepIndex=\{serviceStandard\?\.current_step_index \?\? 0\}/);
});

test('service-standard identity prevents A snapshots and late responses from rendering for B', async () => {
  const {
    createServiceStandardRequestCoordinator,
    matchesServiceStandardDetail,
  } = await importServiceStandardCoordinator();
  const snapshotA = { current_step_index: 4, steps: [{ key: 'a' }] };
  const loadedA = {
    status: 'loaded',
    workOrderId: 'work-order-a',
    snapshot: snapshotA,
    error: '',
  };

  assert.equal(matchesServiceStandardDetail(loadedA, 'work-order-a'), true);
  assert.equal(
    matchesServiceStandardDetail(loadedA, 'work-order-b'),
    false,
    'the render before B effect runs must not expose A progress or checklist',
  );

  const coordinator = createServiceStandardRequestCoordinator();
  const requestA = coordinator.begin('work-order-a');
  const requestB = coordinator.begin('work-order-b');
  assert.equal(coordinator.isLatest(requestA, 'work-order-b'), false);
  assert.equal(coordinator.isLatest(requestB, 'work-order-b'), true);

  const loadedB = {
    status: 'loaded',
    workOrderId: 'work-order-b',
    snapshot: { current_step_index: 1, steps: [{ key: 'b' }] },
    error: '',
  };
  assert.equal(matchesServiceStandardDetail(loadedB, 'work-order-b'), true);
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
