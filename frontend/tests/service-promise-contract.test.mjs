import assert from 'node:assert/strict';
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
