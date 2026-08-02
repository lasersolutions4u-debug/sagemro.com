import { bendSimulatorCatalog } from '../data/bendSimulatorCatalog.js';

const DEFAULT_SEGMENT = { lengthMm: 100, angleDeg: 90, insideRadiusMm: 3 };

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function validNumber(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function machineId(machine) {
  return typeof machine === 'object' ? machine?.id : machine;
}

function materialId(material, catalog) {
  if (typeof material === 'string') return material;
  return Object.entries(catalog.materials).find(([, item]) => item === material || item.label === material?.label)?.[0];
}

function toolId(tool) {
  return typeof tool === 'object' ? tool?.id : tool;
}

function catalogItem(items, id, fallback) {
  return items.find((item) => item.id === id) || fallback;
}

function reindex(segments) {
  return segments.map((segment, index) => ({ ...segment, order: index + 1 }));
}

export function createBendProfileDraft(value = {}) {
  return {
    ...value,
    unitSystem: value.unitSystem === 'imperial' ? 'imperial' : 'metric',
    segments: reindex(value.segments?.length ? value.segments : [DEFAULT_SEGMENT]),
  };
}

export function validateBendProfileDraft(value = {}) {
  const errors = {};
  if (!validNumber(value.thicknessMm) || Number(value.thicknessMm) <= 0) errors.thicknessMm = 'positive';
  if (!validNumber(value.sheetWidthMm) || Number(value.sheetWidthMm) <= 0) errors.sheetWidthMm = 'positive';
  (value.segments || []).forEach((segment, index) => {
    if (!validNumber(segment.lengthMm) || Number(segment.lengthMm) <= 0) errors[`segments.${index}.lengthMm`] = 'positive';
    if (!validNumber(segment.insideRadiusMm) || Number(segment.insideRadiusMm) <= 0) errors[`segments.${index}.insideRadiusMm`] = 'positive';
    if (!validNumber(segment.angleDeg) || Number(segment.angleDeg) < 0 || Number(segment.angleDeg) > 180) errors[`segments.${index}.angleDeg`] = 'angle';
  });
  return errors;
}

export function normalizeBendProfileValue(value = {}, catalog = bendSimulatorCatalog) {
  const fallbackMachine = catalog.machines[1] || catalog.machines[0];
  const fallbackUpperTool = catalog.upperTools[1] || catalog.upperTools[0];
  const fallbackLowerTool = catalog.lowerTools[4] || catalog.lowerTools[0];
  const fallbackMaterial = Object.keys(catalog.materials)[0];
  const draft = createBendProfileDraft(value);

  return {
    unitSystem: draft.unitSystem,
    material: catalog.materials[materialId(draft.material, catalog)] ? materialId(draft.material, catalog) : fallbackMaterial,
    thicknessMm: positiveNumber(draft.thicknessMm, 3),
    sheetWidthMm: positiveNumber(draft.sheetWidthMm, 1000),
    machine: catalogItem(catalog.machines, machineId(draft.machine), fallbackMachine),
    segments: draft.segments.map((segment, index) => ({
      lengthMm: positiveNumber(segment.lengthMm, DEFAULT_SEGMENT.lengthMm),
      angleDeg: Number(segment.angleDeg),
      insideRadiusMm: positiveNumber(segment.insideRadiusMm, positiveNumber(draft.thicknessMm, 3)),
      order: index + 1,
    })),
    upperTool: catalogItem(catalog.upperTools, toolId(draft.upperTool), fallbackUpperTool).id,
    lowerTool: catalogItem(catalog.lowerTools, toolId(draft.lowerTool), fallbackLowerTool).id,
  };
}

export function commitBendProfileDraft(draft, catalog = bendSimulatorCatalog) {
  const errors = validateBendProfileDraft(draft);
  return { errors, value: Object.keys(errors).length === 0 ? normalizeBendProfileValue(draft, catalog) : null };
}

export function updateBendProfileDraft(draft, { index, field, value }) {
  if (Number.isInteger(index)) {
    return {
      ...draft,
      segments: draft.segments.map((segment, segmentIndex) => (
        segmentIndex === index ? { ...segment, [field]: value } : segment
      )),
    };
  }
  return { ...draft, [field]: value };
}

export function addBendSegment(draft) {
  return {
    ...draft,
    segments: reindex([...draft.segments, { ...DEFAULT_SEGMENT, insideRadiusMm: positiveNumber(draft.thicknessMm, 3) }]),
  };
}

export function removeBendSegment(draft, index) {
  if (draft.segments.length === 1) return draft;
  return { ...draft, segments: reindex(draft.segments.filter((_, segmentIndex) => segmentIndex !== index)) };
}

export function moveBendSegment(draft, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= draft.segments.length) return draft;
  const segments = [...draft.segments];
  [segments[index], segments[target]] = [segments[target], segments[index]];
  return { ...draft, segments: reindex(segments) };
}

export function convertBendProfileUnits(draft, unitSystem) {
  if (unitSystem === draft.unitSystem) return draft;
  const convert = (value) => (
    validNumber(value) ? (draft.unitSystem === 'metric' ? Number(value) / 25.4 : Number(value) * 25.4) : value
  );
  return {
    ...draft,
    unitSystem,
    thicknessMm: convert(draft.thicknessMm),
    sheetWidthMm: convert(draft.sheetWidthMm),
    segments: draft.segments.map((segment) => ({
      ...segment,
      lengthMm: convert(segment.lengthMm),
      insideRadiusMm: convert(segment.insideRadiusMm),
    })),
  };
}

export function getBendProfileUnitLabel(locale, unitSystem) {
  const isCn = locale === 'zh-CN' || locale === 'zh';
  if (unitSystem === 'imperial') return isCn ? '英寸 (in)' : 'in';
  return isCn ? '毫米 (mm)' : 'mm';
}
