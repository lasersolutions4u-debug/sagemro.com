import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('Chinese engineer workspace exposes eight personal and team metrics', async () => {
  const { buildEngineerMetrics } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const metrics = buildEngineerMetrics([
    { id: 'assigned', status: 'assigned', scheduled_at: '2026-07-26T09:00:00Z' },
    { id: 'pricing', status: 'pricing', material_requisition_count: 1 },
    { id: 'service', status: 'in_service', report_due_at: '2026-07-26T18:00:00Z' },
  ], [], new Date('2026-07-26T00:00:00Z'));

  assert.deepEqual(Object.keys(metrics), [
    'needsAction',
    'todayTasks',
    'pendingConfirmation',
    'inService',
    'quotePending',
    'scheduledDates',
    'reportsDue',
    'partsNeeds',
  ]);

  const overview = read('frontend/src/components/Engineer/EngineerMetricOverview.jsx');
  for (const label of ['我的指标', '团队指标', '待处理', '今日任务', '待确认', '服务中', '待报价', '已排期日期', '待交报告', '物料需求']) {
    assert.match(overview, new RegExp(label));
  }
});

test('Chinese regional lead workspace groups work orders by engineer name', async () => {
  const { groupRegionalTeamWorkOrders } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const groups = groupRegionalTeamWorkOrders([
    { id: 'queue', ownership_relation: 'regional_queue' },
    { id: 'lead', engineer_id: 'lead-1', ownership_relation: 'personal' },
    { id: 'member', engineer_id: 'eng-1', ownership_relation: 'current_team_member' },
  ], [{ id: 'eng-1', name: '张工程师', status: 'available' }], { id: 'lead-1', name: '区域负责人' });

  assert.deepEqual(groups.map((group) => group.key), ['regional_queue', 'lead-1', 'eng-1']);
  const list = read('frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx');
  assert.match(list, /按负责执行的工程师姓名分组显示/);
  assert.match(list, /group\.engineer\.name/);
});

test('Chinese engineer host supports refreshable independent work-order details', () => {
  const app = read('frontend/src/App.jsx');
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');

  assert.match(app, /currentPath\.match\(\/\^\\\/work-orders\\\/\(\[\^\/\]\+\)\$\//);
  assert.match(app, /workOrderId=\{engineerWorkOrderId\}/);
  assert.match(workspace, /history\.pushState\(\{\}, '', `\/work-orders\/\$\{encodeURIComponent\(ticket\.id\)\}`\)/);
  assert.doesNotMatch(workspace, /selectedTicket/);
  for (const label of ['概览', '消息', '报价', '物料申请', '现场服务', '服务报告', '当前任务上下文', '服务准备', '服务标准检查清单']) {
    assert.match(detail, new RegExp(label));
  }
  assert.match(detail, /support@sagemro\.com/);
});

test('Chinese engineer calendar supports personal edits while protecting work-order schedules', () => {
  const calendar = read('frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(api, /export async function updateEngineerCalendarEvent/);
  assert.match(calendar, /updateEngineerCalendarEvent/);
  assert.match(calendar, /editingId/);
  assert.match(calendar, /item\.work_order_id/);
  assert.match(calendar, /工单排期/);
});
