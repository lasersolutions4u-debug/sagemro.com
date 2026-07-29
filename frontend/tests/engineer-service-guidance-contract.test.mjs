import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

async function importGuidanceCoordinator() {
  const hook = read('frontend/src/hooks/useServiceGuidance.js');
  const startMarker = '// TESTABLE_GUIDANCE_COORDINATOR_START';
  const endMarker = '// TESTABLE_GUIDANCE_COORDINATOR_END';
  const start = hook.indexOf(startMarker);
  const end = hook.indexOf(endMarker);
  assert.notEqual(start, -1, 'guidance coordinator start marker is missing');
  assert.notEqual(end, -1, 'guidance coordinator end marker is missing');
  const source = hook
    .slice(start + startMarker.length, end)
    .replace('export function', 'function')
    .concat('\nexport { createGuidanceRequestCoordinator };');
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('service-standard and guidance clients preserve authenticated API errors', () => {
  const api = read('frontend/src/services/api.js');

  for (const name of [
    'getWorkOrderServiceStandard',
    'confirmWorkOrderServiceStandardItem',
    'getWorkOrderServiceGuidance',
    'refreshWorkOrderServiceGuidance',
    'submitWorkOrderServiceGuidanceFeedback',
  ]) {
    assert.match(api, new RegExp(`export async function ${name}`));
  }
  assert.match(api, /encodeURIComponent\(workOrderId\)/);
  assert.match(api, /encodeURIComponent\(itemKey\)/);
  assert.match(api, /Object\.assign\(\s*new Error\([\s\S]*?\{ status: response\.status, data \}/);
});

test('guidance hook separates read-only checks from bounded generation polling', () => {
  const hook = read('frontend/src/hooks/useServiceGuidance.js');

  assert.match(hook, /getWorkOrderServiceGuidance/);
  assert.match(hook, /refreshWorkOrderServiceGuidance/);
  assert.match(hook, /setInterval\(checkGuidance, 15000\)/);
  assert.match(hook, /setInterval\(pollGuidance, 2000\)/);
  assert.match(hook, /requestCoordinatorRef\.current\.beginPoll\(\)/);
  assert.match(hook, /poll\.attempt >= 10/);
  assert.match(hook, /acceptGuidance\(token, data\?\.state\)/);
  assert.match(hook, /data\?\.state === 'stale' && canGenerate/);
  assert.match(hook, /\.\.\.current,\s*state: 'failed'/);
  assert.match(hook, /guidance: guidanceState\?\.guidance \|\| null/);
});

test('guidance request coordinator rejects out-of-order results and prior work-order epochs', async () => {
  const { createGuidanceRequestCoordinator } = await importGuidanceCoordinator();
  const coordinator = createGuidanceRequestCoordinator();
  const applied = [];
  const slow = deferred();
  const fast = deferred();
  const slowToken = coordinator.beginRequest();
  const slowOperation = slow.promise.then((value) => {
    if (coordinator.isLatest(slowToken)) applied.push(value);
  });
  const fastToken = coordinator.beginRequest();
  const fastOperation = fast.promise.then((value) => {
    if (coordinator.isLatest(fastToken)) applied.push(value);
  });

  fast.resolve('ready:new');
  await fastOperation;
  slow.resolve('generating:old');
  await slowOperation;
  assert.deepEqual(applied, ['ready:new']);
  assert.deepEqual(
    coordinator.acceptGuidance(slowToken, 'generating'),
    { accepted: false, startedGeneration: false },
  );

  const previousWorkOrderToken = coordinator.beginRequest();
  coordinator.reset();
  const oldFailure = deferred();
  const markFailed = oldFailure.promise.catch(() => {
    if (coordinator.isLatest(previousWorkOrderToken)) applied.push('failed:old-work-order');
  });
  oldFailure.reject(new Error('late failure'));
  await markFailed;
  assert.deepEqual(applied, ['ready:new']);
});

test('accepted generation transitions own the ten-request poll budget', async () => {
  const { createGuidanceRequestCoordinator } = await importGuidanceCoordinator();

  for (const settledState of ['ready', 'failed']) {
    for (const attemptsUsed of [3, 10]) {
      const coordinator = createGuidanceRequestCoordinator();
      const firstGeneration = coordinator.beginRequest();
      assert.equal(coordinator.acceptGuidance(firstGeneration, 'generating').accepted, true);
      for (let index = 0; index < attemptsUsed; index += 1) {
        assert.notEqual(coordinator.beginPoll(), null);
      }

      const settled = coordinator.beginRequest();
      assert.equal(coordinator.acceptGuidance(settled, settledState).accepted, true);
      const nextGeneration = coordinator.beginRequest();
      assert.equal(coordinator.acceptGuidance(nextGeneration, 'generating').accepted, true);

      const nextRound = Array.from({ length: 10 }, () => coordinator.beginPoll());
      assert.deepEqual(nextRound.map((poll) => poll.attempt), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.equal(coordinator.beginPoll(), null);
    }
  }
});

test('another generating response in the same round does not reset consumed poll attempts', async () => {
  const { createGuidanceRequestCoordinator } = await importGuidanceCoordinator();
  const coordinator = createGuidanceRequestCoordinator();
  const firstGeneration = coordinator.beginRequest();
  coordinator.acceptGuidance(firstGeneration, 'generating');
  const firstThree = Array.from({ length: 3 }, () => coordinator.beginPoll());
  assert.deepEqual(firstThree.map((poll) => poll.attempt), [1, 2, 3]);

  const sameGeneration = coordinator.beginRequest();
  coordinator.acceptGuidance(sameGeneration, 'generating');
  const remaining = Array.from({ length: 7 }, () => coordinator.beginPoll());
  assert.deepEqual(remaining.map((poll) => poll.attempt), [4, 5, 6, 7, 8, 9, 10]);
  assert.equal(coordinator.beginPoll(), null);
});

test('a refresh request cannot be superseded by a cached read from the same generation round', async () => {
  const { createGuidanceRequestCoordinator } = await importGuidanceCoordinator();
  const coordinator = createGuidanceRequestCoordinator();
  const refreshToken = coordinator.beginRefresh();

  assert.equal(coordinator.beginRequest(), null);
  assert.equal(coordinator.isLatest(refreshToken), true);
  coordinator.finish(refreshToken);
  assert.notEqual(coordinator.beginRequest(), null);
});

test('six-step progress is a meaningful bilingual process rail', () => {
  const progress = read('frontend/src/components/Engineer/EngineerServiceStandardProgress.jsx');
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.match(progress, /Task alignment/);
  assert.match(progress, /任务对齐/);
  assert.match(progress, /currentStepIndex/);
  assert.match(progress, /startBlockingCount/);
  assert.match(progress, /1 required item blocks service start/);
  assert.match(progress, /1 个必需项未完成，暂不能开始服务/);
  assert.match(progress, /aria-current=\{isCurrent \? 'step' : undefined\}/);
  assert.match(progress, /focus-visible:ring-2/);
  assert.match(
    detail,
    /startBlockingCount=\{serviceStandard\.gates\?\.start\?\.blocking_items\?\.length \|\| 0\}/,
  );
});

test('current-stage checklist supports explicit confirmation and not-applicable reasons', () => {
  const stageChecklist = read('frontend/src/components/Engineer/EngineerServiceStageChecklist.jsx');

  assert.match(stageChecklist, /not_applicable/);
  assert.match(stageChecklist, /onConfirm\(item\)/);
  assert.match(stageChecklist, /onMarkNotApplicable\(item, reason\.trim\(\)\)/);
  assert.match(stageChecklist, /reason\.trim\(\)\.length/);
  assert.match(stageChecklist, /不适用原因/);
  assert.match(stageChecklist, /focus-visible:ring-2/);
});

test('AI guidance is advisory, bilingual, and hands customer questions to an unsent draft flow', () => {
  const guidanceCard = read('frontend/src/components/Engineer/EngineerServiceGuidanceCard.jsx');

  assert.match(guidanceCard, /Use/);
  assert.match(guidanceCard, /Ignore/);
  assert.match(guidanceCard, /Correct/);
  assert.match(guidanceCard, /采用/);
  assert.match(guidanceCard, /忽略/);
  assert.match(guidanceCard, /修正/);
  assert.match(guidanceCard, /onInsertQuestion\(question\)/);
  assert.match(guidanceCard, /submitFeedback\(index, 'corrected', note\.trim\(\)\)/);
  assert.match(guidanceCard, /note\.trim\(\)\.length/);
  assert.match(guidanceCard, /none: '无'/);
  assert.match(guidanceCard, /none: 'None'/);
  assert.match(guidanceCard, /PRIORITY_STYLES\[guidance\.risk_level\] \|\| PRIORITY_STYLES\.low/);
  assert.match(guidanceCard, /copy\.priorities\[guidance\.risk_level\] \|\| copy\.priorities\.low/);
  assert.match(guidanceCard, /catch \{/);
  assert.match(guidanceCard, /setFeedbackError\(copy\.feedbackFailed\)/);
  assert.match(guidanceCard, /role="alert"/);
  assert.match(guidanceCard, /motion-reduce:animate-none/);
  assert.doesNotMatch(guidanceCard, /postWorkOrderMessage/);
  assert.doesNotMatch(guidanceCard, /confirmWorkOrderServiceStandardItem/);
});
