import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { calculateBendSimulation } from '../src/utils/bendSimulationEngine.js';
import {
  buildFlatPath,
  buildFormedPath,
  buildPseudo3DProjection,
  buildToolGeometry,
} from '../src/utils/bendSimulationRenderer.js';

const root = path.resolve(import.meta.dirname, '..');
const result = calculateBendSimulation({
  unitSystem: 'metric',
  material: 'carbon_steel',
  thicknessMm: 3,
  sheetWidthMm: 1000,
  machine: 'shop-100',
  upperTool: 'standard-punch',
  lowerTool: 'v-die-24',
  segments: [
    { lengthMm: 100, angleDeg: 90, insideRadiusMm: 3, order: 1 },
    { lengthMm: 80, angleDeg: 120, insideRadiusMm: 3, order: 2 },
  ],
});

test('bend simulation viewport derives changing 2D geometry from the active frame', () => {
  const flat = buildFlatPath(result);
  const firstBend = buildFormedPath(result, 1);
  const secondBend = buildFormedPath(result, 2);

  assert.equal(flat.points, '0,0 106.503,0 190.838,0');
  assert.equal(firstBend.activeBendOrder, 1);
  assert.equal(secondBend.activeBendOrder, 2);
  assert.notEqual(firstBend.points, secondBend.points);
  assert.equal(firstBend.points, '0,0 100,0');
  assert.equal(secondBend.points, '0,0 100,0 100,80');
});

test('bend simulation viewport projects the same active-frame geometry into pseudo 3D', () => {
  const formed = buildFormedPath(result, 2);
  const projection = buildPseudo3DProjection(result, 2);

  assert.equal(projection.activeBendOrder, formed.activeBendOrder);
  assert.deepEqual(projection.frontPoints, formed.pointList);
  assert.equal(projection.front, formed.points);
  assert.notEqual(projection.back, projection.front);
  assert.equal(projection.sideFaces.length, formed.pointList.length - 1);
});

test('bend simulation viewport keeps machine and tool labels synchronized with its engine result', () => {
  const tools = buildToolGeometry(result, 2);

  assert.equal(tools.activeBendOrder, 2);
  assert.equal(tools.machineLabel, result.machine.label);
  assert.equal(tools.upperToolLabel, result.tooling.selectedUpperTool.label);
  assert.equal(tools.lowerToolLabel, result.tooling.selectedLowerTool.label);
  assert.equal(tools.materialLabel, result.input.material.label);
});

test('bend simulation viewport exposes controls and an explanatory empty state', () => {
  const viewport = readFileSync(path.join(root, 'src/components/Tools/BendSimulationViewport.jsx'), 'utf8');

  assert.match(viewport, /viewMode === '3d'/);
  assert.match(viewport, /onViewModeChange\?\.\('2d'\)/);
  assert.match(viewport, /onViewModeChange\?\.\('3d'\)/);
  assert.match(viewport, /aria-label="Fit viewport"/);
  assert.match(viewport, /No bend simulation is available yet/);
  assert.match(viewport, /aria-live="polite"/);
  assert.match(viewport, /ActiveBendDescription description=\{activeDescription\}/);
});
