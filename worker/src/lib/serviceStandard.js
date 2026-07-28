export const SERVICE_STANDARD_VERSION = 1;

export const SERVICE_STANDARD_STEPS = Object.freeze([
  { key: 'task_alignment', index: 0, gate: 'alignment' },
  { key: 'risk_control', index: 1, gate: 'risk' },
  { key: 'one_visit_readiness', index: 2, gate: 'start' },
  { key: 'evidence_execution', index: 3, gate: 'execution' },
  { key: 'recovery_verification', index: 4, gate: 'resolve' },
  { key: 'transparent_handover', index: 5, gate: 'handover' },
]);

const BASE_ITEMS = Object.freeze([
  ['task.device_identity', 0, 'engineer', true],
  ['task.problem_and_goal', 0, 'engineer', true],
  ['task.contact_and_window', 0, 'engineer', true],
  ['risk.hazards_reviewed', 1, 'engineer', true],
  ['risk.isolation_permission', 1, 'engineer', true],
  ['risk.ppe_and_access', 1, 'engineer', true],
  ['ready.tools_and_documents', 2, 'engineer', true],
  ['ready.parts_and_consumables', 2, 'engineer', false],
  ['ready.start_conditions', 2, 'admin', true],
  ['execute.baseline_evidence', 3, 'engineer', true],
  ['execute.actions_recorded', 3, 'engineer', true],
  ['execute.scope_authorized', 3, 'engineer', true],
  ['verify.functional_test', 4, 'engineer', true],
  ['verify.safety_restored', 4, 'engineer', true],
  ['verify.residual_risk', 4, 'engineer', true],
  ['handover.service_report', 5, 'system', true],
  ['handover.customer_confirmation', 5, 'customer', true],
  ['handover.follow_up', 5, 'engineer', false],
]);

export function buildServiceStandardDefinition(context = {}) {
  const items = BASE_ITEMS.map(([key, stepIndex, owner, required]) => ({
    key,
    stepKey: SERVICE_STANDARD_STEPS[stepIndex].key,
    stepIndex,
    owner,
    required,
    applicable: true,
  }));
  if (context.serviceMode === 'remote') {
    const ppe = items.find((item) => item.key === 'risk.ppe_and_access');
    ppe.required = false;
  }
  return { version: SERVICE_STANDARD_VERSION, items };
}

export function deriveServiceStandardSnapshot({ definition, progressRows = [], overrides = [] }) {
  const nonBlockingStates = new Set(['confirmed', 'not_applicable', 'legacy_not_recorded']);
  const progress = new Map(progressRows.map((row) => [row.item_key, row]));
  const items = definition.items.map((item) => ({
    ...item,
    state: progress.get(item.key)?.state || 'pending',
    confirmedAt: progress.get(item.key)?.confirmed_at || null,
  }));
  const completedThrough = SERVICE_STANDARD_STEPS.findIndex((step) =>
    items.some((item) => item.stepIndex === step.index && item.required
      && !nonBlockingStates.has(item.state)));
  const snapshot = {
    standardVersion: definition.version,
    currentStepIndex: completedThrough === -1 ? 5 : completedThrough,
    steps: SERVICE_STANDARD_STEPS.map((step) => ({
      ...step,
      items: items.filter((item) => item.stepIndex === step.index),
    })),
    items,
    overrides,
  };
  snapshot.gates = Object.fromEntries(
    ['start', 'resolve', 'handover'].map((gateKey) => [
      gateKey,
      { blocking_items: getBlockingItems(snapshot, gateKey).map((item) => item.key) },
    ]),
  );
  return snapshot;
}

const GATE_MAX_STEP = Object.freeze({ start: 2, resolve: 4, handover: 5 });

export function getBlockingItems(snapshot, gateKey, satisfiedItemKeys = []) {
  const maxStep = GATE_MAX_STEP[gateKey];
  if (!Number.isInteger(maxStep)) throw new TypeError(`Unknown service-standard gate: ${gateKey}`);
  if (snapshot.overrides.some((override) => override.gate_key === gateKey && !override.revoked_at)) return [];
  const satisfied = new Set(satisfiedItemKeys);
  return snapshot.items.filter((item) =>
    item.required && item.stepIndex <= maxStep
      && !satisfied.has(item.key)
      && !['confirmed', 'not_applicable', 'legacy_not_recorded'].includes(item.state));
}

export function buildPublicServiceMilestones(snapshot) {
  return snapshot.steps.map((step) => ({
    key: step.key,
    state: step.items.some((item) => item.state === 'legacy_not_recorded')
      ? 'legacy_not_recorded'
      : step.items.filter((item) => item.required)
        .every((item) => ['confirmed', 'not_applicable'].includes(item.state))
        ? 'completed'
        : step.index === snapshot.currentStepIndex ? 'current' : 'upcoming',
  }));
}
