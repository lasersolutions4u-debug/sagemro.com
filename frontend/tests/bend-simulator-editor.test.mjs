import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { bendSimulatorCatalog } from '../src/data/bendSimulatorCatalog.js';
import {
  addBendSegment,
  commitBendProfileDraft,
  createBendProfileDraft,
  getBendProfileUnitLabel,
  moveBendSegment,
  removeBendSegment,
  updateBendProfileDraft,
} from '../src/utils/bendProfileEditorState.js';
import {
  clampTimelineFrame,
  shouldPauseTimeline,
  stepTimelineFrame,
} from '../src/utils/bendSimulationTimeline.js';

const root = path.resolve(import.meta.dirname, '..');

const profile = {
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
};

test('bend simulator editor adds, removes, reorders, and normalizes segments', () => {
  const initial = createBendProfileDraft(profile);
  const initialIds = initial.segments.map((segment) => segment.id);
  assert.equal(new Set(initialIds).size, initialIds.length);

  const added = addBendSegment(initial);
  assert.equal(added.segments.length, 3);
  assert.equal(added.segments.at(-1).insideRadiusMm, 3);
  assert.ok(added.segments.at(-1).id);
  assert.equal(new Set(added.segments.map((segment) => segment.id)).size, 3);

  const moved = moveBendSegment(added, 2, -1);
  assert.equal(moved.segments[1].lengthMm, 100);
  assert.equal(moved.segments[1].id, added.segments[2].id);
  assert.deepEqual(moved.segments.map((segment) => segment.order), [1, 2, 3]);

  const removed = removeBendSegment(moved, 1);
  assert.equal(removed.segments.length, 2);
  assert.deepEqual(removed.segments.map((segment) => segment.order), [1, 2]);

  const updated = updateBendProfileDraft(removed, { index: 0, field: 'lengthMm', value: '125.5' });
  const committed = commitBendProfileDraft(updated, bendSimulatorCatalog);
  assert.deepEqual(committed.errors, {});
  assert.equal(committed.value.segments[0].lengthMm, 125.5);
  assert.equal(typeof committed.value.segments[0].lengthMm, 'number');
  assert.equal(typeof committed.value.thicknessMm, 'number');
  assert.equal(committed.value.machine.id, 'shop-100');
  assert.deepEqual(committed.value.segments.map((segment) => segment.id), updated.segments.map((segment) => segment.id));
});

test('bend simulator editor retains invalid drafts and only emits valid numeric input', () => {
  const zeroLength = updateBendProfileDraft(profile, { index: 0, field: 'lengthMm', value: '0' });
  const invalid = commitBendProfileDraft(zeroLength, bendSimulatorCatalog);
  assert.equal(zeroLength.segments[0].lengthMm, '0');
  assert.equal(invalid.value, null);
  assert.equal(invalid.errors['segments.0.lengthMm'], 'positive');

  const blankThickness = updateBendProfileDraft(profile, { field: 'thicknessMm', value: '' });
  const blank = commitBendProfileDraft(blankThickness, bendSimulatorCatalog);
  assert.equal(blank.value, null);
  assert.equal(blank.errors.thicknessMm, 'positive');

  const invalidAngle = updateBendProfileDraft(profile, { index: 1, field: 'angleDeg', value: '-1' });
  assert.equal(commitBendProfileDraft(invalidAngle, bendSimulatorCatalog).errors['segments.1.angleDeg'], 'angle');
});

test('bend simulator editor uses localized unit labels', () => {
  assert.equal(getBendProfileUnitLabel('en', 'metric'), 'mm');
  assert.equal(getBendProfileUnitLabel('en', 'imperial'), 'in');
  assert.equal(getBendProfileUnitLabel('zh-CN', 'metric'), '毫米 (mm)');
  assert.equal(getBendProfileUnitLabel('zh-CN', 'imperial'), '英寸 (in)');
});

test('bend simulation timeline clamps, steps, and pauses on a changed simulation', () => {
  const frames = [{ step: 0 }, { step: 1 }, { step: 2 }];
  assert.equal(clampTimelineFrame(-4, frames), 0);
  assert.equal(clampTimelineFrame(8, frames), 2);
  assert.equal(stepTimelineFrame(1, -1, frames), 0);
  assert.equal(stepTimelineFrame(2, 1, frames), 2);
  assert.equal(shouldPauseTimeline({ previousFrames: frames, frames, previousSimulationId: 'a', simulationId: 'a', playing: true }), false);
  assert.equal(shouldPauseTimeline({ previousFrames: frames, frames: [...frames], previousSimulationId: 'a', simulationId: 'a', playing: true }), false);
  assert.equal(shouldPauseTimeline({ previousFrames: frames, frames: [...frames], previousSimulationId: 'a', simulationId: 'b', playing: true }), true);
  assert.equal(shouldPauseTimeline({ previousFrames: frames, frames: [...frames], previousSimulationId: 'a', simulationId: 'b', playing: false }), false);
});

test('bend simulation timeline effect wiring keeps playback until frames or identity change', () => {
  const frames = [{ step: 0 }, { step: 1 }];
  const previous = { previousFrames: frames, previousSimulationId: 'first' };
  assert.equal(shouldPauseTimeline({ ...previous, frames, simulationId: 'first', playing: true }), false);
  assert.equal(shouldPauseTimeline({ ...previous, frames: [...frames], simulationId: 'first', playing: true }), false);
  assert.equal(shouldPauseTimeline({ ...previous, frames, simulationId: 'second', playing: true }), true);

  const timeline = readFileSync(path.join(root, 'src/components/Tools/BendSimulationTimeline.jsx'), 'utf8');
  assert.match(timeline, /previousFrames: previousSimulation\.current\.frames/);
  assert.match(timeline, /previousSimulationId: previousSimulation\.current\.simulationId/);
});

test('bend playback advances across multiple frames before stopping at the end', async () => {
  const { advanceBendPlayback } = await import('../src/utils/bendSimulationTimeline.js');
  assert.equal(typeof advanceBendPlayback, 'function');
  const first = advanceBendPlayback({ activeFrame: 0, frameCount: 4, playing: true });
  const second = advanceBendPlayback({ ...first, frameCount: 4 });
  const third = advanceBendPlayback({ ...second, frameCount: 4 });

  assert.deepEqual(first, { activeFrame: 1, playing: true });
  assert.deepEqual(second, { activeFrame: 2, playing: true });
  assert.deepEqual(third, { activeFrame: 3, playing: false });
});

test('editor uses stable segment IDs for list identity and receives result warnings', () => {
  const editor = readFileSync(path.join(root, 'src/components/Tools/BendProfileEditor.jsx'), 'utf8');

  assert.match(editor, /key=\{segment\.id\}/);
  assert.match(editor, /warnings\s*=\s*\[\]/);
  assert.doesNotMatch(editor, /key=\{`\$\{segment\.order\}-\$\{index\}`\}/);
});
