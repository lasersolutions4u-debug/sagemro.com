import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

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
  assert.match(hook, /pollAttemptsRef\.current >= 10/);
  assert.match(hook, /data\?\.state === 'stale' && canGenerate/);
  assert.match(hook, /\.\.\.current,\s*state: 'failed'/);
  assert.match(hook, /guidance: guidanceState\?\.guidance \|\| null/);
});

test('six-step progress is a meaningful bilingual process rail', () => {
  const progress = read('frontend/src/components/Engineer/EngineerServiceStandardProgress.jsx');

  assert.match(progress, /Task alignment/);
  assert.match(progress, /任务对齐/);
  assert.match(progress, /currentStepIndex/);
  assert.match(progress, /aria-current=\{isCurrent \? 'step' : undefined\}/);
  assert.match(progress, /focus-visible:ring-2/);
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
  assert.doesNotMatch(guidanceCard, /postWorkOrderMessage/);
  assert.doesNotMatch(guidanceCard, /confirmWorkOrderServiceStandardItem/);
});
