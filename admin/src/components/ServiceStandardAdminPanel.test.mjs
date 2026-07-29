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
