import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');
const materials = await readFile(new URL('./MaterialsPage.jsx', import.meta.url), 'utf8');

test('dashboard adds a compact requisition operations band without removing existing metrics', () => {
  assert.match(dashboard, /requisitionOperations/);
  assert.match(dashboard, /pendingApproval/);
  assert.match(dashboard, /shortages/);
  assert.match(dashboard, /overdue/);
  assert.match(dashboard, /medianApprovalHours/);
  assert.match(dashboard, /medianFulfillmentHours/);
  assert.match(dashboard, /closureRatePercent/);
  assert.match(dashboard, /cards\.map/);
});

test('old engineer request panel is explicitly named material master-data requests', () => {
  assert.match(materials, /Material master-data requests/);
  assert.match(materials, /物料主数据申请/);
  assert.doesNotMatch(materials, /requestsTitle: 'Engineer requests'/);
  assert.doesNotMatch(materials, /requestsTitle: '工程师物料申请'/);
});
