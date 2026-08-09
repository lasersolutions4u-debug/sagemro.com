import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '');

test('Admin service-standard panel exposes progress, blockers, and reasoned gate overrides', async () => {
  const page = await readSource('../pages/WorkOrdersPage.jsx');
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');

  assert.match(page, /<ServiceStandardAdminPanel/);
  assert.match(panel, /blocking_items/);
  assert.match(panel, /overrideAdminWorkOrderServiceStandardGate/);
  assert.match(panel, /reason/);
  assert.match(panel, /readOnly/);
  assert.doesNotMatch(panel, /confirmWorkOrderServiceStandardItem/);
});

test('service-standard override ignores stale work-order operations and resets prior snapshots', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');

  assert.match(panel, /import \{ useEffect, useLayoutEffect, useMemo, useRef, useState \} from 'react'/);
  assert.match(panel, /const operationEpoch = useRef\(0\)/);
  assert.match(panel, /useLayoutEffect\(\(\) => \{[\s\S]*const epoch = \+\+operationEpoch\.current/);
  assert.match(panel, /setSnapshot\(null\)/);
  assert.match(panel, /const isCurrent = \(\) => operationEpoch\.current === operationEpochAtStart/);
  assert.match(panel, /await overrideAdminWorkOrderServiceStandardGate[\s\S]*if \(!isCurrent\(\)\) return;/);
  assert.match(panel, /await Promise\.allSettled[\s\S]*if \(!isCurrent\(\)\) return;[\s\S]*setSnapshot/);
  assert.match(panel, /return \(\) => \{[\s\S]*operationEpoch\.current \+= 1/);
});

test('work-order changes invalidate an in-flight override before the next effect runs', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');

  assert.match(panel, /useLayoutEffect\(\(\) => \{[\s\S]*operationEpoch\.current \+= 1[\s\S]*\}, \[workOrderId\]\)/);
});

test('service-standard refresh passes its current-operation guard to each parent state publication', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  const page = await readSource('../pages/WorkOrdersPage.jsx');

  assert.match(panel, /onRefresh\?\.\(workOrderId, isCurrent\)/);
  assert.match(page, /async function refreshOpenDetail\(expectedWorkOrderId, isCurrent = \(\) => true\)/);
  assert.match(page, /await Promise\.all\([\s\S]*if \(!isCurrent\(\)\) return;[\s\S]*setDetail[\s\S]*if \(!isCurrent\(\)\) return;[\s\S]*setData/);
});

test('Admin service controls warn only for the gate relevant to the work-order status', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  assert.match(panel, /currentServiceGateForStatus\(workOrderStatus\)/);
  assert.match(panel, /currentGate \? currentSnapshot\?\.gates\?\.\[currentGate\]\?\.blocking_items/);
  assert.doesNotMatch(panel, /GATE_KEYS\.flatMap/);
  assert.match(panel, /onBlockerStateChange/);
});

test('gate overrides are limited to the writable blocked current gate', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  assert.match(panel, /!readOnly && currentGate && blockers\.length > 0/);
  assert.match(panel, /overrideAdminWorkOrderServiceStandardGate\(workOrderId, currentGate, trimmedReason\)/);
  assert.doesNotMatch(panel, /<select value=\{gate\}/);
});

test('historical states and future stages use neutral audit presentation', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  assert.match(panel, /legacy_not_recorded/);
  assert.match(panel, /historicalHint/);
  assert.match(panel, /<details/);
});

test('service-standard stage presentation uses the API current_step_index response field', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  const response = {
    current_step_index: 2,
    steps: [{ key: 'one_visit_readiness', index: 2, items: [] }],
  };

  assert.equal(response.current_step_index, 2);
  assert.match(panel, /const currentStepIndex = currentSnapshot\?\.current_step_index/);
  assert.match(panel, /open=\{step\.index === currentStepIndex\}/);
  assert.match(panel, /const isHistoricalStep = step\.index < currentStepIndex/);
});

test('incomplete non-current progress segments remain neutral audit indicators', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');

  assert.match(panel, /const currentBlockingItemKeys = useMemo\(\(\) => new Set\(blockers\), \[blockers\]\)/);
  assert.match(panel, /serviceStandardStageTone\(items, currentBlockingItemKeys\)/);
  assert.match(panel, /serviceStandardItemTone\(item, currentBlockingItemKeys\)/);
  assert.doesNotMatch(panel, /isCurrentStep \? stateTone\(item\.state\)/);
});

test('service-standard control labels are complete in English and Simplified Chinese', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');
  const itemKeys = [
    'task.device_identity',
    'task.problem_and_goal',
    'task.contact_and_window',
    'risk.hazards_reviewed',
    'risk.isolation_permission',
    'risk.ppe_and_access',
    'ready.tools_and_documents',
    'ready.parts_and_consumables',
    'ready.start_conditions',
    'execute.baseline_evidence',
    'execute.actions_recorded',
    'execute.scope_authorized',
    'verify.functional_test',
    'verify.safety_restored',
    'verify.residual_risk',
    'handover.service_report',
    'handover.customer_confirmation',
    'handover.follow_up',
  ];

  for (const itemKey of itemKeys) {
    assert.equal(panel.split(`'${itemKey}'`).length - 1, 2, itemKey);
  }
  assert.match(panel, /itemLabels\[item\.key\] \|\| itemLabel\(item\.key\)/);
  assert.match(panel, /itemLabels\[item\] \|\| itemLabel\(item\)/);
});
