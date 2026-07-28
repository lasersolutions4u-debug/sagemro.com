import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SERVICE_STANDARD_STEPS,
  buildPublicServiceMilestones,
  buildServiceStandardDefinition,
  deriveServiceStandardSnapshot,
  getBlockingItems,
} from '../src/lib/serviceStandard.js';

test('version 1 exposes the approved six steps in order', () => {
  assert.deepEqual(SERVICE_STANDARD_STEPS.map((step) => step.key), [
    'task_alignment',
    'risk_control',
    'one_visit_readiness',
    'evidence_execution',
    'recovery_verification',
    'transparent_handover',
  ]);
});

test('start gate remains blocked until every required item in steps 1-3 is confirmed', () => {
  const definition = buildServiceStandardDefinition({
    serviceMode: 'onsite',
    requiresPaymentBeforeStart: true,
    arrivalVerificationRequired: true,
  });
  const progressRows = definition.items.map((item) => ({
    item_key: item.key,
    state: item.stepIndex < 3 ? 'confirmed' : 'pending',
  }));
  progressRows.find((row) => row.item_key === 'risk.isolation_permission').state = 'pending';

  const snapshot = deriveServiceStandardSnapshot({ definition, progressRows, overrides: [] });
  assert.deepEqual(
    getBlockingItems(snapshot, 'start').map((item) => item.key),
    ['risk.isolation_permission'],
  );
});

test('remote service makes PPE and access optional', () => {
  const remoteDefinition = buildServiceStandardDefinition({ serviceMode: 'remote' });

  assert.equal(remoteDefinition.items.find((item) => item.key === 'risk.ppe_and_access').required, false);
});

test('legacy state and active override clear start-gate blockers', () => {
  const definition = buildServiceStandardDefinition();
  const legacySnapshot = deriveServiceStandardSnapshot({
    definition,
    progressRows: definition.items.map((item) => ({
      item_key: item.key,
      state: item.stepIndex <= 2 ? 'legacy_not_recorded' : 'pending',
    })),
    overrides: [],
  });
  const legacyMilestones = buildPublicServiceMilestones(legacySnapshot);
  const overriddenSnapshot = deriveServiceStandardSnapshot({
    definition,
    progressRows: [],
    overrides: [{ gate_key: 'start', revoked_at: null }],
  });

  assert.equal(legacyMilestones[0].state, 'legacy_not_recorded');
  assert.deepEqual(getBlockingItems(legacySnapshot, 'start'), []);
  assert.deepEqual(getBlockingItems(overriddenSnapshot, 'start'), []);
});

test('satisfied item keys remove blockers and public milestones omit items', () => {
  const definition = buildServiceStandardDefinition();
  const startSnapshot = deriveServiceStandardSnapshot({ definition, progressRows: [], overrides: [] });
  const publicMilestones = buildPublicServiceMilestones(startSnapshot);

  assert.equal(
    getBlockingItems(startSnapshot, 'start', ['ready.start_conditions'])
      .some((item) => item.key === 'ready.start_conditions'),
    false,
  );
  assert.equal(publicMilestones.some((milestone) => 'items' in milestone), false);
});
