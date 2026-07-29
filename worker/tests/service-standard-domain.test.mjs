import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SERVICE_STANDARD_VERSION,
  SERVICE_STANDARD_STEPS,
  buildPublicServiceMilestones,
  buildServiceStandardDefinition,
  deriveServiceStandardSnapshot,
  getBlockingItems,
} from '../src/lib/serviceStandard.js';

test('version 1 exposes the approved six steps in order', () => {
  assert.equal(SERVICE_STANDARD_VERSION, 1);
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
    overrides: [{
      gate_key: 'start',
      reason: 'Customer-approved exception',
      overridden_by: 'admin-1',
      revoked_at: null,
    }],
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

test('not-applicable items require and preserve a reason up to 500 trimmed characters', () => {
  const definition = buildServiceStandardDefinition();
  const progressRows = definition.items.map((item) => ({
    item_key: item.key,
    state: item.stepIndex <= 2 ? 'confirmed' : 'pending',
  }));
  const target = progressRows.find((row) => row.item_key === 'risk.ppe_and_access');
  target.state = 'not_applicable';
  target.not_applicable_reason = ` ${'a'.repeat(500)} `;

  const snapshot = deriveServiceStandardSnapshot({ definition, progressRows, overrides: [] });

  assert.equal(
    snapshot.items.find((item) => item.key === 'risk.ppe_and_access').notApplicableReason,
    target.not_applicable_reason,
  );
  assert.deepEqual(getBlockingItems(snapshot, 'start'), []);
  assert.equal(buildPublicServiceMilestones(snapshot)[1].state, 'completed');
});

test('not-applicable items with missing, blank, or over-limit reasons remain blocking', () => {
  const definition = buildServiceStandardDefinition();
  for (const notApplicableReason of [undefined, '   ', 'a'.repeat(501)]) {
    const progressRows = definition.items.map((item) => ({
      item_key: item.key,
      state: item.stepIndex <= 2 ? 'confirmed' : 'pending',
    }));
    const target = progressRows.find((row) => row.item_key === 'risk.ppe_and_access');
    target.state = 'not_applicable';
    target.not_applicable_reason = notApplicableReason;
    const snapshot = deriveServiceStandardSnapshot({ definition, progressRows, overrides: [] });

    assert.deepEqual(getBlockingItems(snapshot, 'start').map((item) => item.key), ['risk.ppe_and_access']);
    assert.notEqual(buildPublicServiceMilestones(snapshot)[1].state, 'completed');
  }
});

test('only complete and attributable active overrides clear a gate', () => {
  const definition = buildServiceStandardDefinition();
  const invalidOverrides = [
    { gate_key: 'start', overridden_by: 'admin-1', revoked_at: null },
    { gate_key: 'start', reason: '   ', overridden_by: 'admin-1', revoked_at: null },
    { gate_key: 'start', reason: 'a'.repeat(501), overridden_by: 'admin-1', revoked_at: null },
    { gate_key: 'start', reason: 'Approved', revoked_at: null },
    { gate_key: 'start', reason: 'Approved', overridden_by: '   ', revoked_at: null },
    { gate_key: 'start', reason: 'Approved', overridden_by: 'admin-1', revoked_at: '2026-01-01T00:00:00Z' },
  ];

  for (const override of invalidOverrides) {
    const snapshot = deriveServiceStandardSnapshot({ definition, progressRows: [], overrides: [override] });
    assert.notEqual(getBlockingItems(snapshot, 'start').length, 0);
  }
});

test('version-1 service-standard definitions are immutable at every record level', () => {
  const definition = buildServiceStandardDefinition({ serviceMode: 'remote' });

  assert.equal(Object.isFrozen(SERVICE_STANDARD_STEPS), true);
  assert.equal(SERVICE_STANDARD_STEPS.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(definition), true);
  assert.equal(Object.isFrozen(definition.items), true);
  assert.equal(definition.items.every(Object.isFrozen), true);
  assert.throws(() => { SERVICE_STANDARD_STEPS[0].key = 'changed'; }, TypeError);
  assert.throws(() => { definition.items[0].required = false; }, TypeError);
  assert.throws(() => { definition.items.push({}); }, TypeError);
});
