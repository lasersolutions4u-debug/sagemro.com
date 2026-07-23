import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');
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

test('operational dashboard uses scoped metrics and omits unrelated admin analytics', () => {
  assert.match(api, /getMaterialRequisitionMetrics/);
  assert.match(api, /\/api\/material-requisitions\/metrics/);
  assert.match(app, /<DashboardPage staffRole=\{user\.staffRole\} staffId=\{user\.staffId\}/);
  assert.match(dashboard, /isOperationalStaff/);
  assert.match(dashboard, /isOperationalStaff \? getMaterialRequisitionMetrics\(\) : getAdminStats\(\)/);
  assert.match(dashboard, /const workOrders = stats\.workOrders \|\| \{\}/);
  assert.match(dashboard, /isOperationalStaff \? t\.operationalTitle : t\.title/);
  assert.match(dashboard, /isOperationalStaff \? t\.operationalSubtitle : t\.subtitle/);
  assert.match(dashboard, /\{!isOperationalStaff && \(/);
});

test('old engineer request panel is explicitly named material master-data requests', () => {
  assert.match(materials, /Material master-data requests/);
  assert.match(materials, /物料主数据申请/);
  assert.doesNotMatch(materials, /requestsTitle: 'Engineer requests'/);
  assert.doesNotMatch(materials, /requestsTitle: '工程师物料申请'/);
});
