import { bendSimulatorCatalog } from '../data/bendSimulatorCatalog.js';
import { ensureBendSegmentIds } from './bendSegmentIdentity.js';

const MM_PER_INCH = 25.4;

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${label} must be positive`);
  return number;
}

function asMillimeters(value, unitSystem, label) {
  const number = positiveNumber(value, label);
  return unitSystem === 'imperial' ? number * MM_PER_INCH : number;
}

function resolveRecord(records, value, fallback) {
  if (typeof value === 'object' && value) return { ...fallback, ...value };
  return records.find((record) => record.id === value) || fallback;
}

function normalizeAngle(angleDeg) {
  const angle = Number(angleDeg);
  if (!Number.isFinite(angle)) return 90;
  return Math.min(180, Math.max(0, angle));
}

function recommendedLowerTool(vOpeningMm) {
  return bendSimulatorCatalog.lowerTools.reduce((closest, tool) => (
    Math.abs(tool.vOpeningMm - vOpeningMm) < Math.abs(closest.vOpeningMm - vOpeningMm) ? tool : closest
  ));
}

function recommendedUpperTool(segments, thicknessMm) {
  const tightRadius = segments.some((segment) => segment.insideRadiusMm < thicknessMm);
  return bendSimulatorCatalog.upperTools.find((tool) => tool.id === (tightRadius ? 'acute-punch' : 'standard-punch'));
}

function toolCompatibility({ tool, machine, thicknessMm, segments, recommendedTool, includeRadius = false }) {
  const reasons = [];
  if (tool.id !== recommendedTool.id) reasons.push('recommendation');
  if (thicknessMm < tool.minThicknessMm || thicknessMm > tool.maxThicknessMm) reasons.push('thickness');
  if (segments.some((segment) => segment.angleDeg < tool.minIncludedAngleDeg || segment.angleDeg > tool.maxIncludedAngleDeg)) reasons.push('angle');
  if (includeRadius && segments.some((segment) => segment.insideRadiusMm < tool.tipRadiusMm)) reasons.push('radius');
  if (!tool.interfaceTypes.includes(machine.toolInterface)) reasons.push('interface');
  return { compatible: reasons.length === 0, reasons };
}

export function normalizeBendSimulationInput(input = {}) {
  const unitSystem = input.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const material = bendSimulatorCatalog.materials[input.material] || bendSimulatorCatalog.materials.carbon_steel;
  const thicknessMm = asMillimeters(input.thicknessMm, unitSystem, 'Thickness');
  const sheetWidthMm = asMillimeters(input.sheetWidthMm, unitSystem, 'Sheet width');
  const machine = resolveRecord(bendSimulatorCatalog.machines, input.machine, bendSimulatorCatalog.machines[1]);
  const upperTool = resolveRecord(bendSimulatorCatalog.upperTools, input.upperTool, bendSimulatorCatalog.upperTools[1]);
  const lowerTool = resolveRecord(bendSimulatorCatalog.lowerTools, input.lowerTool, bendSimulatorCatalog.lowerTools[4]);
  const segments = ensureBendSegmentIds(input.segments || []).map((segment, index) => ({
    id: segment.id,
    lengthMm: asMillimeters(segment.lengthMm, unitSystem, 'Segment length'),
    angleDeg: normalizeAngle(segment.angleDeg),
    insideRadiusMm: segment.insideRadiusMm == null
      ? thicknessMm
      : asMillimeters(segment.insideRadiusMm, unitSystem, 'Inside radius'),
    order: Number.isFinite(Number(segment.order)) ? Number(segment.order) : index + 1,
    _index: index,
  })).sort((left, right) => left.order - right.order || left._index - right._index)
    .map(({ _index, ...segment }) => segment);

  if (segments.length === 0) throw new RangeError('At least one segment is required');

  return { unitSystem, material, thicknessMm, sheetWidthMm, machine, segments, upperTool, lowerTool };
}

export function estimateAirBendTonnage({
  thicknessMm,
  bendLengthMm,
  vDieMm,
  materialFactor = 1,
  safetyFactor = 1.2,
}) {
  const thicknessIn = positiveNumber(thicknessMm, 'Thickness') / MM_PER_INCH;
  const lengthFt = positiveNumber(bendLengthMm, 'Bend length') / 304.8;
  const vDieIn = positiveNumber(vDieMm, 'V die') / MM_PER_INCH;
  const requiredTons = ((575 * thicknessIn ** 2 * lengthFt) / vDieIn) * positiveNumber(materialFactor, 'Material factor');
  return { requiredTons, withSafetyTons: requiredTons * positiveNumber(safetyFactor, 'Safety factor') };
}

function makeFlatPoints(segments) {
  let x = 0;
  return [{ xMm: 0, yMm: 0 }, ...segments.map((segment) => {
    x += segment.lengthMm + segment.bendAllowanceMm;
    return { xMm: x, yMm: 0 };
  })];
}

function makeFormedPoints(segments) {
  let x = 0;
  let y = 0;
  let directionDeg = 0;
  return [{ xMm: 0, yMm: 0 }, ...segments.map((segment) => {
    x += segment.lengthMm * Math.cos((directionDeg * Math.PI) / 180);
    y += segment.lengthMm * Math.sin((directionDeg * Math.PI) / 180);
    directionDeg += segment.bendAngleDeg;
    return { xMm: x, yMm: y };
  })];
}

function makeCompleteFramePoints(segments, completedBends) {
  let x = 0;
  let y = 0;
  let directionDeg = 0;
  const points = [{ xMm: 0, yMm: 0 }];
  segments.forEach((segment, index) => {
    x += segment.lengthMm * Math.cos((directionDeg * Math.PI) / 180);
    y += segment.lengthMm * Math.sin((directionDeg * Math.PI) / 180);
    points.push({ xMm: x, yMm: y });
    if (index < completedBends) directionDeg += segment.bendAngleDeg;
  });
  return points;
}

export function calculateBendSimulation(input) {
  const normalized = normalizeBendSimulationInput(input);
  const { material, thicknessMm, sheetWidthMm, machine, segments, upperTool, lowerTool } = normalized;
  const targetVOpeningMm = thicknessMm * material.recommendedVMultiplier;
  const recommendedLower = recommendedLowerTool(targetVOpeningMm);
  const recommendedUpper = recommendedUpperTool(segments, thicknessMm);
  const calculatedSegments = segments.map((segment) => ({
    ...segment,
    bendAngleDeg: 180 - segment.angleDeg,
    bendAllowanceMm: (Math.PI / 180) * (180 - segment.angleDeg) * (segment.insideRadiusMm + material.kFactor * thicknessMm),
  }));
  const totalBendAllowanceMm = calculatedSegments.reduce((total, segment) => total + segment.bendAllowanceMm, 0);
  const flatLengthMm = calculatedSegments.reduce((total, segment) => total + segment.lengthMm, 0) + totalBendAllowanceMm;
  const flatPoints = makeFlatPoints(calculatedSegments);
  const formedPoints = makeFormedPoints(calculatedSegments);
  const upperCompatibility = toolCompatibility({
    tool: upperTool,
    machine,
    thicknessMm,
    segments: calculatedSegments,
    recommendedTool: recommendedUpper,
    includeRadius: true,
  });
  const lowerCompatibility = toolCompatibility({
    tool: lowerTool,
    machine,
    thicknessMm,
    segments: calculatedSegments,
    recommendedTool: recommendedLower,
  });
  const tonnage = estimateAirBendTonnage({
    thicknessMm,
    bendLengthMm: sheetWidthMm,
    vDieMm: lowerTool.vOpeningMm,
    materialFactor: material.materialFactor,
    safetyFactor: 1.2,
  });
  const capacityTons = positiveNumber(machine.capacityTons, 'Machine capacity');
  const marginTons = capacityTons - tonnage.withSafetyTons;
  const bedLengthMm = positiveNumber(machine.bedLengthMm, 'Machine bed length');
  const workLengthExceeded = sheetWidthMm > bedLengthMm;
  const warnings = [];
  const addWarning = (code, message) => warnings.push({ code, message });
  if (calculatedSegments.some((segment) => segment.lengthMm < lowerTool.vOpeningMm * 1.5)) addWarning('short_edge', 'A bend edge is short for the selected V die.');
  if (!lowerCompatibility.compatible) addWarning('tool_mismatch', 'The selected lower die is not compatible with this plan.');
  if (!upperCompatibility.compatible) addWarning('upper_tool_mismatch', 'The selected upper tool is not compatible with this plan.');
  if (marginTons < 0) addWarning('machine_overload', 'Required tonnage exceeds machine capacity.');
  if (workLengthExceeded) addWarning('work_length_exceeded', 'Bend length exceeds the machine working length.');
  if (calculatedSegments.some((segment) => segment.insideRadiusMm < thicknessMm * 0.5)) addWarning('tight_radius', 'Inside radius is tight for the selected material thickness.');
  if (warnings.length > 0 || marginTons / capacityTons < 0.1) addWarning('review_required', 'Confirm tooling and bend plan with an engineer before production.');
  const resultStatus = warnings.some((warning) => warning.code === 'review_required') ? 'review_required' : 'ready';
  const frames = [
    { step: 0, progress: 0, activeBendOrder: null, activeSegmentId: null, formedPoints: makeCompleteFramePoints(calculatedSegments, 0) },
    ...calculatedSegments.map((segment, index) => ({
      step: index + 1,
      progress: (index + 1) / (calculatedSegments.length + 1),
      activeBendOrder: segment.order,
      activeSegmentId: segment.id,
      formedPoints: makeCompleteFramePoints(calculatedSegments, index + 1),
    })),
    { step: calculatedSegments.length + 1, progress: 1, activeBendOrder: null, activeSegmentId: null, formedPoints },
  ];

  return {
    input: normalized,
    segments: calculatedSegments,
    totalBendAllowanceMm,
    flatLengthMm,
    flatPoints,
    formedPoints,
    tooling: {
      recommendedUpperTool: recommendedUpper,
      recommendedLowerTool: recommendedLower,
      selectedUpperTool: normalized.upperTool,
      selectedLowerTool: lowerTool,
      targetVOpeningMm,
      isVMatch: lowerTool.id === recommendedLower.id,
      isUpperMatch: upperCompatibility.compatible,
      isLowerMatch: lowerCompatibility.compatible,
      upperCompatibility,
      lowerCompatibility,
    },
    tonnage,
    machine: { ...machine, capacityTons, bedLengthMm, workLengthExceeded, marginTons, marginPercent: (marginTons / capacityTons) * 100 },
    warnings,
    resultStatus,
    frames,
  };
}
