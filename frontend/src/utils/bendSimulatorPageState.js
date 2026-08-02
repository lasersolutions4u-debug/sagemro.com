import { bendSimulatorCatalog } from '../data/bendSimulatorCatalog.js';
import { calculateBendSimulation } from './bendSimulationEngine.js';
import { clampTimelineFrame } from './bendSimulationTimeline.js';
import { ensureBendSegmentIds } from './bendSegmentIdentity.js';

function catalogMaterialId(material) {
  if (typeof material === 'string') return material;
  return Object.entries(bendSimulatorCatalog.materials).find(([, item]) => item === material || item.label === material?.label)?.[0];
}

function catalogItemId(value) {
  return typeof value === 'object' ? value?.id : value;
}

export function toBendSimulatorEditorInput(value = {}) {
  return {
    ...value,
    unitSystem: value.unitSystem === 'imperial' ? 'imperial' : 'metric',
    material: catalogMaterialId(value.material) || 'carbon_steel',
    machine: catalogItemId(value.machine) || 'shop-100',
    upperTool: catalogItemId(value.upperTool) || 'standard-punch',
    lowerTool: catalogItemId(value.lowerTool) || 'v-die-24',
    segments: ensureBendSegmentIds(value.segments || []).map((segment, index) => ({ ...segment, order: Number(segment.order) || index + 1 })),
  };
}

export function buildBendSimulatorWorkspaceState({ input, result: suppliedResult, simulationId: suppliedSimulationId, activeFrame = 0, playing = false, viewMode = '2d' }) {
  const editorInput = suppliedResult ? input : toBendSimulatorEditorInput(input);
  const result = suppliedResult || calculateBendSimulation(editorInput);
  const normalizedInput = result.input;
  const safeActiveFrame = clampTimelineFrame(activeFrame, result.frames);
  const simulationId = suppliedSimulationId || JSON.stringify(editorInput);

  return {
    input: editorInput,
    normalizedInput,
    result,
    activeFrame: safeActiveFrame,
    playing,
    viewMode,
    simulationId,
    viewport: { result, activeFrame: safeActiveFrame, viewMode },
    timeline: { frames: result.frames, activeFrame: safeActiveFrame, playing, simulationId },
    resultPanel: { result },
  };
}

export function applyBendSimulatorEditorChange(currentState, nextValue) {
  const input = toBendSimulatorEditorInput(nextValue);
  const segmentAdjusted = JSON.stringify(input.segments) !== JSON.stringify(currentState.input.segments);
  const workspace = buildBendSimulatorWorkspaceState({ input, activeFrame: 0, playing: false, viewMode: currentState.viewMode });

  return { ...workspace, segmentAdjusted };
}
