import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBendSimulation,
  estimateAirBendTonnage,
  normalizeBendSimulationInput,
} from '../src/utils/bendSimulationEngine.js';

const metricInput = {
  unitSystem: 'metric',
  material: 'carbon_steel',
  thicknessMm: 3,
  sheetWidthMm: 1000,
  machine: { id: 'shop-100', capacityTons: 100, bedLengthMm: 3000 },
  segments: [
    { lengthMm: 100, angleDeg: 90, insideRadiusMm: 3, order: 2 },
    { lengthMm: 80, angleDeg: 90, insideRadiusMm: 3, order: 1 },
  ],
  upperTool: 'standard-punch',
  lowerTool: 'v-die-24',
};

test('normalizes imperial dimensions, clamps angles, and orders segments', () => {
  const normalized = normalizeBendSimulationInput({
    ...metricInput,
    unitSystem: 'imperial',
    thicknessMm: 0.125,
    sheetWidthMm: 40,
    segments: [
      { lengthMm: 4, angleDeg: 200, insideRadiusMm: 0.125, order: 2 },
      { lengthMm: 3, angleDeg: -20, insideRadiusMm: 0.125, order: 1 },
    ],
  });

  assert.deepEqual(Object.keys(normalized), [
    'unitSystem', 'material', 'thicknessMm', 'sheetWidthMm', 'machine', 'segments', 'upperTool', 'lowerTool',
  ]);
  assert.equal(normalized.thicknessMm, 3.175);
  assert.equal(normalized.sheetWidthMm, 1016);
  assert.deepEqual(normalized.segments.map(({ order, angleDeg }) => ({ order, angleDeg })), [
    { order: 1, angleDeg: 0 },
    { order: 2, angleDeg: 180 },
  ]);
  assert.ok(Math.abs(normalized.segments[0].lengthMm - 76.2) < 0.0001);
  assert.ok(Math.abs(normalized.segments[1].insideRadiusMm - 3.175) < 0.0001);
});

test('preserves supplied segment IDs and generates stable unique IDs for missing ones', () => {
  const normalized = normalizeBendSimulationInput({
    ...metricInput,
    segments: [
      { ...metricInput.segments[0], id: 'customer-bend-a' },
      { ...metricInput.segments[1] },
    ],
  });

  assert.equal(normalized.segments.find((segment) => segment.order === 2).id, 'customer-bend-a');
  assert.match(normalized.segments.find((segment) => segment.order === 1).id, /^segment-/);
  assert.equal(new Set(normalized.segments.map((segment) => segment.id)).size, 2);
});

test('rejects non-positive sheet dimensions and segment lengths', () => {
  assert.throws(() => normalizeBendSimulationInput({ ...metricInput, thicknessMm: 0 }), /thickness/i);
  assert.throws(() => normalizeBendSimulationInput({ ...metricInput, sheetWidthMm: -1 }), /sheet width/i);
  assert.throws(() => normalizeBendSimulationInput({ ...metricInput, segments: [{ ...metricInput.segments[0], lengthMm: 0 }] }), /segment length/i);
});

test('uses the converted thickness as the default imperial inside radius', () => {
  const normalized = normalizeBendSimulationInput({
    ...metricInput,
    unitSystem: 'imperial',
    thicknessMm: 0.125,
    sheetWidthMm: 40,
    segments: [{ lengthMm: 4, angleDeg: 90, order: 1 }],
  });

  assert.ok(Math.abs(normalized.segments[0].insideRadiusMm - normalized.thicknessMm) < 0.0001);
});

test('calculates a one-segment bend plan with flat and formed points', () => {
  const result = calculateBendSimulation({ ...metricInput, segments: [metricInput.segments[0]] });

  assert.deepEqual(Object.keys(result), [
    'input', 'segments', 'totalBendAllowanceMm', 'flatLengthMm', 'flatPoints', 'formedPoints', 'tooling', 'tonnage', 'machine', 'warnings', 'resultStatus', 'frames',
  ]);
  assert.equal(result.segments.length, 1);
  assert.ok(result.totalBendAllowanceMm > 6 && result.totalBendAllowanceMm < 7);
  assert.equal(result.flatPoints.length, 2);
  assert.equal(result.formedPoints.length, 2);
  assert.ok(Math.abs(result.flatPoints.at(-1).xMm - result.flatLengthMm) < 0.0001);
  assert.equal(result.tooling.recommendedLowerTool.id, 'v-die-24');
});

test('calculates multi-segment allowance in bend order and flags planning risks', () => {
  const result = calculateBendSimulation({
    ...metricInput,
    machine: { capacityTons: 1, bedLengthMm: 3000 },
    lowerTool: 'v-die-6',
    segments: [
      { lengthMm: 8, angleDeg: 90, insideRadiusMm: 0.5, order: 2 },
      { lengthMm: 80, angleDeg: 90, insideRadiusMm: 3, order: 1 },
    ],
  });

  assert.deepEqual(result.segments.map((segment) => segment.order), [1, 2]);
  assert.ok(result.flatLengthMm > 95 && result.flatLengthMm < 100);
  assert.deepEqual(
    result.warnings.map((warning) => warning.code).sort(),
    ['machine_overload', 'review_required', 'short_edge', 'tight_radius', 'tool_mismatch', 'upper_tool_mismatch'],
  );
  assert.ok(result.machine.marginTons < 0);
});

test('requires review when bend length exceeds the machine bed length', () => {
  const result = calculateBendSimulation({
    ...metricInput,
    sheetWidthMm: 3200,
    machine: 'shop-100',
  });

  assert.equal(result.machine.bedLengthMm, 3000);
  assert.equal(result.machine.workLengthExceeded, true);
  assert.equal(result.resultStatus, 'review_required');
  assert.ok(result.warnings.some((warning) => warning.code === 'work_length_exceeded'));
  assert.ok(result.warnings.some((warning) => warning.code === 'review_required'));
});

test('reports upper-tool radius and machine-interface incompatibility', () => {
  const radiusMismatch = calculateBendSimulation({
    ...metricInput,
    upperTool: 'standard-punch',
    segments: [{ lengthMm: 100, angleDeg: 60, insideRadiusMm: 0.5, order: 1 }],
  });
  const interfaceMismatch = calculateBendSimulation({
    ...metricInput,
    machine: { id: 'custom-machine', capacityTons: 100, bedLengthMm: 3000, toolInterface: 'american' },
    upperTool: 'standard-punch',
  });

  assert.ok(radiusMismatch.warnings.some((warning) => warning.code === 'upper_tool_mismatch'));
  assert.ok(radiusMismatch.tooling.upperCompatibility.reasons.includes('radius'));
  assert.ok(radiusMismatch.tooling.upperCompatibility.reasons.includes('angle'));
  assert.ok(interfaceMismatch.tooling.upperCompatibility.reasons.includes('interface'));
  assert.ok(interfaceMismatch.tooling.lowerCompatibility.reasons.includes('interface'));
  assert.ok(interfaceMismatch.warnings.some((warning) => warning.code === 'tool_mismatch'));
});

test('catalog exposes stable compatibility fields for machines and both tool families', async () => {
  const { bendSimulatorCatalog } = await import('../src/data/bendSimulatorCatalog.js');

  assert.ok(bendSimulatorCatalog.machines.every((machine) => machine.labelKey && machine.toolInterface));
  assert.ok(bendSimulatorCatalog.upperTools.every((tool) => tool.labelKey && tool.tipRadiusMm > 0 && tool.interfaceTypes.length > 0));
  assert.ok(bendSimulatorCatalog.lowerTools.every((tool) => tool.labelKey && tool.minThicknessMm > 0 && tool.interfaceTypes.length > 0));
});

test('uses included profile angles consistently for allowance and formed geometry', () => {
  const profile = (angleDeg) => calculateBendSimulation({
    ...metricInput,
    segments: [
      { lengthMm: 50, angleDeg, insideRadiusMm: 3, order: 1 },
      { lengthMm: 50, angleDeg: 180, insideRadiusMm: 3, order: 2 },
    ],
  });
  const obtuse = profile(120);
  const straight = profile(180);
  const foldedBack = profile(0);

  assert.equal(obtuse.segments[0].bendAngleDeg, 60);
  assert.ok(Math.abs(obtuse.segments[0].bendAllowanceMm - 4.335) < 0.001);
  assert.ok(Math.abs(obtuse.formedPoints.at(-1).xMm - 75) < 0.001);
  assert.ok(Math.abs(obtuse.formedPoints.at(-1).yMm - 43.301) < 0.001);
  assert.equal(straight.segments[0].bendAngleDeg, 0);
  assert.equal(straight.totalBendAllowanceMm, 0);
  assert.deepEqual(straight.formedPoints.at(-1), { xMm: 100, yMm: 0 });
  assert.equal(foldedBack.segments[0].bendAngleDeg, 180);
  assert.ok(foldedBack.totalBendAllowanceMm > obtuse.totalBendAllowanceMm);
  assert.ok(Math.abs(foldedBack.formedPoints.at(-1).xMm) < 0.001);
  assert.ok(Math.abs(foldedBack.formedPoints.at(-1).yMm) < 0.001);
});

test('changes allowance and flat length for thickness and inside-radius changes', () => {
  const base = calculateBendSimulation({ ...metricInput, segments: [metricInput.segments[0]] });
  const thicker = calculateBendSimulation({
    ...metricInput,
    thicknessMm: 6,
    segments: [{ ...metricInput.segments[0], insideRadiusMm: 3 }],
  });
  const widerRadius = calculateBendSimulation({
    ...metricInput,
    segments: [{ ...metricInput.segments[0], insideRadiusMm: 6 }],
  });

  assert.ok(thicker.totalBendAllowanceMm > base.totalBendAllowanceMm);
  assert.ok(thicker.flatLengthMm > base.flatLengthMm);
  assert.ok(widerRadius.totalBendAllowanceMm > base.totalBendAllowanceMm);
  assert.ok(widerRadius.flatLengthMm > base.flatLengthMm);
});

test('estimates air-bend tonnage with material and safety factors', () => {
  const mildSteel = estimateAirBendTonnage({
    thicknessMm: 6,
    bendLengthMm: 3000,
    vDieMm: 48,
    materialFactor: 1,
    safetyFactor: 1.2,
  });
  const stainless = estimateAirBendTonnage({
    thicknessMm: 6,
    bendLengthMm: 3000,
    vDieMm: 48,
    materialFactor: 1.5,
    safetyFactor: 1.2,
  });

  assert.deepEqual(Object.keys(mildSteel), ['requiredTons', 'withSafetyTons']);
  assert.ok(Math.abs(mildSteel.requiredTons - 167.2) < 0.2);
  assert.ok(Math.abs(mildSteel.withSafetyTons - 200.6) < 0.2);
  assert.ok(stainless.requiredTons > mildSteel.requiredTons);
});

test('creates monotonic animation frames with start, one frame per bend, and end', () => {
  const result = calculateBendSimulation(metricInput);
  const progress = result.frames.map((frame) => frame.progress);

  assert.equal(result.frames.length, metricInput.segments.length + 2);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]));
  assert.deepEqual(result.frames.map((frame) => frame.activeBendOrder), [null, 1, 2, null]);
  assert.deepEqual(result.frames.map((frame) => frame.activeSegmentId), [null, result.segments[0].id, result.segments[1].id, null]);
  assert.ok(result.frames.every((frame) => frame.formedPoints.length === result.segments.length + 1));
  assert.deepEqual(result.frames.at(-1).formedPoints, result.formedPoints);
  assert.notDeepEqual(result.frames[0].formedPoints, result.frames[1].formedPoints);
});
