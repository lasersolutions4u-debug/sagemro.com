import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const expectedStepKeys = [
  'task_alignment',
  'risk_control',
  'one_visit_readiness',
  'evidence_execution',
  'recovery_verification',
  'transparent_handover',
];

test('service promise exposes one approved bilingual six-step framework', async () => {
  const { getServicePromiseCopy } = await import('../src/data/servicePromise.js');
  const zh = getServicePromiseCopy(true);
  const en = getServicePromiseCopy(false);

  assert.equal(zh.promise, '每一次服务，都有准备、有依据、有验证、有交付。');
  assert.equal(en.promise, 'Every service is prepared, evidence-based, verified, and clearly delivered.');

  assert.deepEqual(zh.values, [
    { key: 'risk', title: '更早发现风险', detail: 'AI 整理事实，专业人员确认边界。' },
    { key: 'ready', title: '更充分地准备', detail: '减少信息缺失和不必要的重复上门。' },
    { key: 'evidence', title: '每一步有证据', detail: '诊断、处理和验证过程可追溯。' },
    { key: 'asset', title: '让服务形成资产', detail: '报告进入持续关联的设备服务档案。' },
  ]);
  assert.deepEqual(en.values, [
    { key: 'risk', title: 'See risk earlier', detail: 'AI organizes facts; qualified people confirm the boundary.' },
    { key: 'ready', title: 'Prepare more completely', detail: 'Reduce missing information and avoidable repeat visits.' },
    { key: 'evidence', title: 'Keep evidence at every step', detail: 'Diagnosis, actions, and verification remain traceable.' },
    { key: 'asset', title: 'Turn service into an asset', detail: 'Reports stay connected to the equipment service record.' },
  ]);

  assert.deepEqual(zh.steps, [
    { key: 'task_alignment', number: 1, title: '任务对齐', detail: '到场前，把问题说清楚' },
    { key: 'risk_control', number: 2, title: '风险锁定', detail: '动手前，把风险控住' },
    { key: 'one_visit_readiness', number: 3, title: '一次备齐', detail: '出发前，把资源准备充分' },
    { key: 'evidence_execution', number: 4, title: '循证执行', detail: '服务中，每一步都有依据' },
    { key: 'recovery_verification', number: 5, title: '恢复验证', detail: '交付前，用结果证明恢复' },
    { key: 'transparent_handover', number: 6, title: '透明交付', detail: '完工后，让服务形成闭环' },
  ]);
  assert.deepEqual(en.steps, [
    { key: 'task_alignment', number: 1, title: 'Task Alignment', detail: 'Clarify the issue before arrival' },
    { key: 'risk_control', number: 2, title: 'Risk Control', detail: 'Control risk before action' },
    { key: 'one_visit_readiness', number: 3, title: 'One-Visit Readiness', detail: 'Prepare resources before departure' },
    { key: 'evidence_execution', number: 4, title: 'Evidence-Based Execution', detail: 'Keep evidence for every action' },
    { key: 'recovery_verification', number: 5, title: 'Recovery Verification', detail: 'Prove the result before handover' },
    { key: 'transparent_handover', number: 6, title: 'Transparent Handover', detail: 'Close the loop with a clear record' },
  ]);

  assert.deepEqual(zh.steps.map((step) => step.key), expectedStepKeys);
  assert.deepEqual(en.steps.map((step) => step.key), expectedStepKeys);
  assert.deepEqual(zh.values.map((value) => value.key), en.values.map((value) => value.key));
});

test('service promise calls return isolated values and steps', async () => {
  const { getServicePromiseCopy } = await import('../src/data/servicePromise.js');
  const first = getServicePromiseCopy(true);

  first.values[0].title = 'mutated value';
  first.steps[0].title = 'mutated step';

  const fresh = getServicePromiseCopy(true);
  assert.equal(fresh.values[0].title, '更早发现风险');
  assert.equal(fresh.steps[0].title, '任务对齐');
});

test('shared service promise keeps the approved public loop without internal workflow fields', () => {
  const servicePromise = readFileSync(
    new URL('../src/data/servicePromise.js', import.meta.url),
    'utf8',
  );

  assert.match(servicePromise, /export function getServicePromiseCopy/);
  assert.match(servicePromise, /Every service is prepared, evidence-based, verified, and clearly delivered\./);
  assert.match(servicePromise, /每一次服务，都有准备、有依据、有验证、有交付。/);
  assert.doesNotMatch(servicePromise, /engineer_role|blocking_items|override_reason/);
});

test('customer work-order detail renders only the public milestone projection before its tabs', () => {
  const detailModal = readFileSync(
    new URL('../src/components/WorkOrder/WorkOrderDetailModal.jsx', import.meta.url),
    'utf8',
  );

  assert.match(detailModal, /import \{ CustomerServiceMilestones \}/);
  assert.match(detailModal, /const renderWorkOrderSummary = \(\) =>/);
  assert.match(
    detailModal,
    /userType === 'customer'[\s\S]*renderWorkOrderSummary\(\)[\s\S]*<CustomerServiceMilestones[\s\S]*milestones=\{detail\.public_service_milestones \|\| \[\]\}[\s\S]*role="tablist"/,
  );
  assert.match(detailModal, /!isCustomer && renderWorkOrderSummary\(\)/);
  assert.match(detailModal, /detail\?\.id === workOrder\.id/);
  assert.ok(
    detailModal.indexOf('<CustomerServiceMilestones') < detailModal.indexOf('role="tablist"'),
    'customer milestones should appear before the detail tabs',
  );
});

test('customer milestones render the six approved states without internal fields or status inference', () => {
  const milestones = readFileSync(
    new URL('../src/components/WorkOrder/CustomerServiceMilestones.jsx', import.meta.url),
    'utf8',
  );
  const milestoneView = readFileSync(
    new URL('../src/utils/customerServiceMilestoneView.js', import.meta.url),
    'utf8',
  );
  const publicMilestoneSource = `${milestones}\n${milestoneView}`;

  assert.match(milestones, /buildCustomerServiceMilestoneView/);
  assert.match(milestones, /view\.steps\.map/);
  assert.match(milestones, /<ol/);
  assert.match(milestones, /<li/);
  assert.match(milestones, /aria-current=\{step\.state === 'current' \? 'step' : undefined\}/);
  assert.match(publicMilestoneSource, /Earlier service records were not itemized/);
  assert.match(publicMilestoneSource, /早期服务记录未按步骤逐项记录/);
  assert.match(publicMilestoneSource, /Check Messages for any information SAGEMRO needs from you/);
  assert.match(publicMilestoneSource, /请在“消息”中查看 SAGEMRO 是否需要您补充信息/);
  assert.doesNotMatch(publicMilestoneSource, /blocking_items|owner_type|guidance/);
  assert.doesNotMatch(publicMilestoneSource, /workOrder|effectiveStatus|statusConfig/);
});

test('customer milestone view model normalizes four public states in approved step order', async () => {
  const { buildCustomerServiceMilestoneView } = await import(
    '../src/utils/customerServiceMilestoneView.js'
  );
  const model = buildCustomerServiceMilestoneView(false, [
    { key: 'transparent_handover', state: 'legacy_not_recorded' },
    { key: 'risk_control', state: 'current' },
    { key: 'task_alignment', state: 'completed' },
    { key: 'one_visit_readiness', state: 'upcoming' },
  ]);

  assert.deepEqual(model.steps.map((step) => step.key), expectedStepKeys);
  assert.deepEqual(model.steps.slice(0, 3).map((step) => step.state), [
    'completed',
    'current',
    'upcoming',
  ]);
  assert.equal(model.steps.at(-1).state, 'legacy_not_recorded');
  assert.equal(model.steps[0].stateLabel, 'Verified');
  assert.equal(model.currentStep.key, 'risk_control');
  assert.equal(model.steps.at(-1).stateLabel, 'Earlier service records were not itemized');
});

test('customer milestone view model treats missing and invalid projections as neutral upcoming steps', async () => {
  const { buildCustomerServiceMilestoneView } = await import(
    '../src/utils/customerServiceMilestoneView.js'
  );
  const model = buildCustomerServiceMilestoneView(true, [
    { key: 'unknown_internal_stage', state: 'completed' },
    { key: 'task_alignment', state: 'invented_state' },
  ]);

  assert.equal(model.steps.length, 6);
  assert.equal(model.steps.every((step) => step.state === 'upcoming'), true);
  assert.equal(model.currentStep, null);
  assert.equal(model.steps[0].stateLabel, '待进行');
});
