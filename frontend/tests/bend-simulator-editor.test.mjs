import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('bend simulator editor controls the normalized planning input', () => {
  const editor = read('src/components/Tools/BendProfileEditor.jsx');

  assert.match(editor, /function normalizeProfileValue/);
  assert.match(editor, /const unitSystem = value\.unitSystem === 'imperial' \? 'imperial' : 'metric'/);
  assert.match(editor, /thicknessMm: toPositiveNumber\(value\.thicknessMm/);
  assert.match(editor, /sheetWidthMm: toPositiveNumber\(value\.sheetWidthMm/);
  assert.match(editor, /lengthMm: toPositiveNumber\(segment\.lengthMm/);
  assert.match(editor, /angleDeg: clampAngle\(segment\.angleDeg\)/);
  assert.match(editor, /insideRadiusMm: toPositiveNumber\(segment\.insideRadiusMm/);
  assert.match(editor, /order: index \+ 1/);
  assert.match(editor, /onChange\?\.\(normalizeProfileValue\(next, catalog\)\)/);
});

test('bend simulator editor has accessible segment and planning controls', () => {
  const editor = read('src/components/Tools/BendProfileEditor.jsx');

  assert.match(editor, /type="button"/);
  assert.match(editor, /aria-label=/);
  assert.match(editor, /onClick=\{\(\) => addSegment\(\)\}/);
  assert.match(editor, /onClick=\{\(\) => removeSegment\(index\)\}/);
  assert.match(editor, /onClick=\{\(\) => moveSegment\(index, -1\)\}/);
  assert.match(editor, /onClick=\{\(\) => moveSegment\(index, 1\)\}/);
  assert.match(editor, /onRequestReview\?\.\(currentValue\)/);
  assert.match(editor, /warnings\.map/);
  assert.match(editor, /grid gap-3 sm:grid-cols-2/);
});

test('bend simulator editor localizes units and invalid value messages', () => {
  const editor = read('src/components/Tools/BendProfileEditor.jsx');

  assert.match(editor, /'毫米 \(mm\)'/);
  assert.match(editor, /'英寸 \(in\)'/);
  assert.match(editor, /'请输入大于 0 的数值。'/);
  assert.match(editor, /'Enter a value greater than 0\.'/);
  assert.match(editor, /min = '0\.001'/);
  assert.match(editor, /min="0" max="180"/);
});

test('bend simulation timeline offers deterministic animation controls', () => {
  const timeline = read('src/components/Tools/BendSimulationTimeline.jsx');

  assert.match(timeline, /value=\{safeActiveFrame\}/);
  assert.match(timeline, /onChange=\{\(event\) => onFrameChange\?\.\(Number\(event\.target\.value\)\)\}/);
  assert.match(timeline, /onTogglePlay\?\.\(\)/);
  assert.match(timeline, /onStep\?\.\(-1\)/);
  assert.match(timeline, /onStep\?\.\(1\)/);
  assert.match(timeline, />规划动画</);
  assert.match(timeline, />Plan animation</);
  assert.match(timeline, /type="range"/);
  assert.match(timeline, /frame\.activeBendOrder/);
});
