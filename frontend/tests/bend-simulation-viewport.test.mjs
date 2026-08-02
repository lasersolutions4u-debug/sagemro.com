import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

import { calculateBendSimulation } from '../src/utils/bendSimulationEngine.js';
import {
  buildFlatPath,
  buildFormedPath,
  buildPseudo3DProjection,
  buildBendSimulationViewportModel,
  buildToolGeometry,
  selectBendSimulationViewportViewBox,
} from '../src/utils/bendSimulationRenderer.js';

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

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const reactModule = pathToFileURL(require.resolve('react')).href;
const lucideModule = pathToFileURL(require.resolve('lucide-react')).href;
const rendererModule = pathToFileURL(path.join(root, 'src/utils/bendSimulationRenderer.js')).href;
const presentationModule = pathToFileURL(path.join(root, 'src/utils/bendSimulationPresentation.js')).href;

async function renderViewport(props) {
  const source = `import { createElement } from '${reactModule}';\n${readFileSync(path.join(root, 'src/components/Tools/BendSimulationViewport.jsx'), 'utf8')}`
    .replace("from 'lucide-react'", `from '${lucideModule}'`)
    .replace("from 'react'", `from '${reactModule}'`)
    .replace("from '../../utils/bendSimulationRenderer'", `from '${rendererModule}'`)
    .replace("from '../../utils/bendSimulationPresentation'", `from '${presentationModule}'`);
  const transformed = await transformWithOxc(source, 'BendSimulationViewport.jsx', {
    lang: 'jsx',
    format: 'esm',
    jsx: { runtime: 'classic', pragma: 'createElement' },
  });
  const { BendSimulationViewport } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`);
  return renderToStaticMarkup(createElement(BendSimulationViewport, props));
}

test('bend simulation viewport derives changing 2D geometry from the active frame', () => {
  const flat = buildFlatPath(result);
  const start = buildFormedPath(result, 0);
  const firstBend = buildFormedPath(result, 1);
  const secondBend = buildFormedPath(result, 2);

  assert.equal(flat.points, '0,0 106.503,0 190.838,0');
  assert.equal(firstBend.activeBendOrder, 1);
  assert.equal(secondBend.activeBendOrder, 2);
  assert.notEqual(start.points, firstBend.points);
  assert.equal(start.pointList.length, result.segments.length + 1);
  assert.equal(firstBend.pointList.length, result.segments.length + 1);
  assert.equal(secondBend.pointList.length, result.segments.length + 1);
  assert.equal(firstBend.points, '0,0 100,0 100,80');
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

function assertViewBoxContains(viewBox, points) {
  const [x, y, width, height] = viewBox.split(' ').map(Number);
  points.forEach((point) => {
    assert.ok(point.xMm >= x && point.xMm <= x + width, `x ${point.xMm} is inside ${viewBox}`);
    assert.ok(point.yMm >= y && point.yMm <= y + height, `y ${point.yMm} is inside ${viewBox}`);
  });
}

test('bend simulation viewport 2D bounds include both the flat sheet and active formed path', () => {
  const model = buildBendSimulationViewportModel(result, 1, '2d');

  assert.equal(model.valid, true);
  assertViewBoxContains(model.fitViewBox, [...model.flat.pointList, ...model.formed.pointList]);
  assertViewBoxContains(model.resetViewBox, [...model.flat.pointList, ...model.formed.pointList]);
});

test('bend simulation viewport exposes distinct fit and reset viewBox states', () => {
  const model = buildBendSimulationViewportModel(result, 1, '2d');

  assert.notEqual(model.fitViewBox, model.resetViewBox);
  assert.equal(selectBendSimulationViewportViewBox(model, 'fit'), model.fitViewBox);
  assert.equal(selectBendSimulationViewportViewBox(model, 'reset'), model.resetViewBox);
});

test('bend simulation viewport rejects missing and non-numeric active geometry', () => {
  assert.equal(buildBendSimulationViewportModel(null, 0, '2d').valid, false);
  assert.equal(buildBendSimulationViewportModel({ ...result, flatPoints: [] }, 1, '2d').valid, false);
  const malformedFrame = {
    ...result,
    frames: result.frames.map((frame, index) => (index === 1 ? { ...frame, formedPoints: [{ xMm: Number.NaN, yMm: 0 }] } : frame)),
  };

  assert.equal(buildBendSimulationViewportModel(malformedFrame, 1, '2d').valid, false);
});

test('bend simulation viewport renders its model bounds and empty state', async () => {
  const model = buildBendSimulationViewportModel(result, 1, '2d');
  const rendered = await renderViewport({ result, activeFrame: 1, viewMode: '2d' });
  const empty = await renderViewport({ result: null });

  assert.match(rendered, new RegExp(`viewBox="${model.resetViewBox}"`));
  assert.doesNotMatch(rendered, /No bend simulation is available yet/);
  assert.match(empty, /No bend simulation is available yet/);
});

test('bend simulation viewport localizes dynamic catalog labels for Chinese', async () => {
  const rendered = await renderViewport({ result, activeFrame: 1, viewMode: '2d', locale: 'zh-CN' });

  assert.match(rendered, /100 吨通用折弯机/);
  assert.match(rendered, /标准上模/);
  assert.match(rendered, /V 槽 24 毫米/);
  assert.match(rendered, /碳钢/);
  assert.doesNotMatch(rendered, /100 ton press brake|Standard punch|V die 24 mm|Carbon steel/);
});
