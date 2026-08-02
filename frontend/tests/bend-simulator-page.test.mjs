import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('bend simulator page assembles the editor, synchronized viewport, timeline, and result panel', () => {
  const page = read('src/components/Tools/BendSimulatorPage.jsx');

  assert.match(page, /import \{ BendProfileEditor \}/);
  assert.match(page, /import \{ BendSimulationViewport \}/);
  assert.match(page, /import \{ BendSimulationTimeline \}/);
  assert.match(page, /import \{ BendResultPanel \}/);
  assert.match(page, /lg:grid-cols-\[/);
  assert.match(page, /order-1/);
  assert.match(page, /order-2/);
  assert.match(page, /order-3/);
  assert.match(page, /calculateBendSimulation/);
  assert.match(page, /normalizeBendSimulationInput/);
  assert.match(page, /activeFrame/);
  assert.match(page, /viewMode/);
  assert.match(page, /onViewModeChange/);
  assert.match(page, /planning estimate|规划估算/);
});

test('bend simulator result panel presents planning fields and an engineer review CTA', () => {
  const resultPanelPath = path.join(root, 'src/components/Tools/BendResultPanel.jsx');

  assert.equal(existsSync(resultPanelPath), true);
  const panel = read('src/components/Tools/BendResultPanel.jsx');
  assert.match(panel, /Recommended upper tool|推荐上模/);
  assert.match(panel, /V die|V 槽/);
  assert.match(panel, /Tonnage|吨位/);
  assert.match(panel, /Margin|余量/);
  assert.match(panel, /Bend allowance|折弯系数/);
  assert.match(panel, /Flat length|展开长度/);
  assert.match(panel, /Planning estimate|规划估算/);
  assert.match(panel, /onRequestReview/);
  assert.match(panel, /--color-success/);
  assert.match(panel, /--color-warning/);
  assert.match(panel, /--color-error/);
});

test('bend simulator page tracks only allowlisted non-PII lifecycle fields and API exposes review helper', () => {
  const page = read('src/components/Tools/BendSimulatorPage.jsx');
  const api = read('src/services/api.js');

  assert.match(page, /bend_simulator_started/);
  assert.match(page, /bend_simulator_segment_adjusted/);
  assert.match(page, /JSON\.stringify\(normalized\.segments\) !== JSON\.stringify\(input\.segments\)/);
  assert.match(page, /bend_simulator_completed/);
  assert.match(page, /trackFunnelEvent/);
  assert.doesNotMatch(page, /trackFunnelEvent\([^\n]+(?:email|phone|contact|drawing|file)/i);
  assert.match(api, /'bend_simulator_started'/);
  assert.match(api, /'bend_simulator_segment_adjusted'/);
  assert.match(api, /'bend_simulator_completed'/);
  assert.match(api, /export async function submitBendSimulationReview/);
  assert.match(api, /\/api\/leads\/bend-simulation/);
  assert.match(api, /authHeaders\(\)/);
});
