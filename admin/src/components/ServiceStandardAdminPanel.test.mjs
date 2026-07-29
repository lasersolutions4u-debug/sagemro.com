import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '');

test('Admin service-standard panel exposes progress, blockers, and reasoned gate overrides', async () => {
  const page = await readSource('../pages/WorkOrdersPage.jsx');
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');

  assert.match(page, /<ServiceStandardAdminPanel/);
  assert.match(panel, /blocking_items/);
  assert.match(panel, /overrideAdminWorkOrderServiceStandardGate/);
  assert.match(panel, /reason/);
  assert.match(panel, /readOnly/);
  assert.doesNotMatch(panel, /confirmWorkOrderServiceStandardItem/);
});

test('service-standard override ignores stale work-order operations and resets prior snapshots', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');

  assert.match(panel, /import \{ useEffect, useLayoutEffect, useMemo, useRef, useState \} from 'react'/);
  assert.match(panel, /const operationEpoch = useRef\(0\)/);
  assert.match(panel, /useLayoutEffect\(\(\) => \{[\s\S]*const epoch = \+\+operationEpoch\.current/);
  assert.match(panel, /setSnapshot\(null\)/);
  assert.match(panel, /const isCurrent = \(\) => operationEpoch\.current === operationEpochAtStart/);
  assert.match(panel, /await overrideAdminWorkOrderServiceStandardGate[\s\S]*if \(!isCurrent\(\)\) return;/);
  assert.match(panel, /await Promise\.allSettled[\s\S]*if \(!isCurrent\(\)\) return;[\s\S]*setSnapshot/);
  assert.match(panel, /return \(\) => \{[\s\S]*operationEpoch\.current \+= 1/);
});

test('work-order changes invalidate an in-flight override before the next effect runs', async () => {
  const panel = await readSource('./ServiceStandardAdminPanel.jsx');

  assert.match(panel, /useLayoutEffect\(\(\) => \{[\s\S]*operationEpoch\.current \+= 1[\s\S]*\}, \[workOrderId\]\)/);
});
