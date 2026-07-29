import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('engineer portal keeps the approved visual system around the current routed workspace', () => {
  const workspace = read('src/components/Engineer/EngineerWorkspace.jsx');
  const metrics = read('src/components/Engineer/EngineerMetricOverview.jsx');
  const styles = read('src/index.css');

  assert.match(workspace, /<div className="engineer-workspace">/);
  assert.match(workspace, /bg-gradient-to-r from-orange-50/);
  assert.match(workspace, /scheduledKeys\.has\(day\.key\).*bg-orange-500/s);
  assert.match(metrics, /lg:col-span-2/);
  assert.match(styles, /\.engineer-workspace \{\s*font-size: 16px;/);
  assert.match(styles, /--status-assigned-text: #854d0e/);
  assert.match(styles, /--status-in_service-text: #0e7490/);
});

test('engineer work orders use readable status accents and skeleton loading', () => {
  const list = read('src/components/Engineer/EngineerWorkOrderList.jsx');
  const detail = read('src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.match(list, /animate-pulse/);
  assert.match(list, /var\(--status-\$\{ticket\.status\}-text\)/);
  assert.match(list, /absolute inset-y-0 left-0 w-\[3px\]/);
  assert.match(detail, /var\(--status-\$\{detail\.status\}-text\)/);
});

test('engineer checklist reloads server state while routed detail tabs keep semantic roles', () => {
  const detail = read('src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.match(detail, /getWorkOrderServiceStandard/);
  assert.match(detail, /confirmWorkOrderServiceStandardItem/);
  assert.match(detail, /await loadServiceStandard\(\)/);
  assert.doesNotMatch(detail, /checkedChecklistItems/);
  assert.match(detail, /role="tablist"/);
  assert.match(detail, /role="tab"/);
  assert.match(detail, /role="tabpanel"/);
});
