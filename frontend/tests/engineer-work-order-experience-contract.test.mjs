import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('engineer metric helpers return the approved eight metrics', async () => {
  const { buildEngineerMetrics } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const now = new Date('2026-07-25T12:00:00Z');
  const metrics = buildEngineerMetrics([
    { id: 'assigned', status: 'assigned', scheduled_at: '2026-07-25T15:00:00Z' },
    { id: 'pricing', status: 'pricing', material_requisition_count: 1 },
    { id: 'service', status: 'in_service', report_due_at: '2026-07-25T18:00:00Z' },
  ], [
    { start_at: '2026-07-26T09:00:00Z' },
    { start_at: '2026-07-26T12:00:00Z' },
  ], now);

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
  assert.equal(metrics.needsAction, 2);
  assert.equal(metrics.todayTasks, 1);
  assert.equal(metrics.pendingConfirmation, 1);
  assert.equal(metrics.inService, 1);
  assert.equal(metrics.quotePending, 1);
  assert.equal(metrics.scheduledDates, 2);
  assert.equal(metrics.reportsDue, 1);
  assert.equal(metrics.partsNeeds, 1);
});

test('team scheduled dates come from team work orders instead of the lead personal calendar', async () => {
  const { buildEngineerMetrics } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const metrics = buildEngineerMetrics([
    { id: 'amy', status: 'in_service', scheduled_at: '2026-07-26T09:00:00Z' },
    { id: 'ben', status: 'assigned', scheduled_at: '2026-07-27T09:00:00Z' },
  ], [], new Date('2026-07-25T12:00:00Z'));

  assert.equal(metrics.scheduledDates, 2);
});

test('team metrics count the unassigned queue and ignore past scheduled dates', async () => {
  const { buildEngineerMetrics } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const metrics = buildEngineerMetrics([
    { id: 'queue', status: 'pending_dispatch', ownership_relation: 'regional_queue' },
    { id: 'past', status: 'in_service', scheduled_at: '2026-07-24T09:00:00Z' },
    { id: 'future', status: 'in_service', scheduled_at: '2026-07-26T09:00:00Z' },
  ], [], new Date('2026-07-25T12:00:00Z'), 'team');

  assert.equal(metrics.pendingConfirmation, 1);
  assert.equal(metrics.scheduledDates, 1);
});

test('ticket metrics and labels do not infer schedules from assignment or SLA fields', async () => {
  const { buildEngineerMetrics } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const { getEngineerScheduleLabel } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');
  const inferredOnly = {
    status: 'assigned',
    assigned_at: '2026-07-25T09:00:00Z',
    expected_completion_date: '2026-07-26T09:00:00Z',
    sla_deadline: '2026-07-27T09:00:00Z',
  };

  const metrics = buildEngineerMetrics([inferredOnly], [], new Date('2026-07-25T12:00:00Z'));
  assert.equal(metrics.todayTasks, 0);
  assert.equal(metrics.scheduledDates, 0);
  assert.equal(getEngineerScheduleLabel(inferredOnly), '');
});

test('regional team groups are ordered by queue, lead, then engineer name', async () => {
  const { groupRegionalTeamWorkOrders } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const groups = groupRegionalTeamWorkOrders([
    { id: 'queue', ownership_relation: 'regional_queue' },
    { id: 'lead', engineer_id: 'lead-1', ownership_relation: 'personal' },
    { id: 'ben', engineer_id: 'eng-ben', ownership_relation: 'current_team_member' },
  ], [
    { id: 'eng-ben', name: 'Ben', status: 'available' },
    { id: 'eng-amy', name: 'Amy', status: 'paused' },
  ], { id: 'lead-1', name: 'Joe', status: 'available' });

  assert.deepEqual(groups.map((group) => group.key), ['regional_queue', 'lead-1', 'eng-amy', 'eng-ben']);
  assert.deepEqual(groups.map((group) => group.tickets.length), [1, 1, 0, 1]);
});

test('regional team pagination serializes summary and group requests', () => {
  const api = read('frontend/src/services/api.js');
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(api, /for \(const key of \['view', 'filter', 'group_type', 'group_id', 'limit', 'cursor', 'timezone_offset_minutes'\]\)/);
  assert.match(api, /params\[key\]/);
  assert.match(workspace, /const \[teamSummary, setTeamSummary\] = useState/);
  assert.match(workspace, /view: 'summary', filter: workOrderFilter, timezone_offset_minutes:/);
  assert.match(workspace, /const metrics = useMemo\([\s\S]*scope === 'team' \? teamSummary\.metrics/);
  assert.match(workspace, /onLoadGroup=/);
  assert.match(workspace, /groups=\{teamSummary\.groups\}/);
});

test('regional team pagination keeps per-group pages and retry state', () => {
  const teamList = read('frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx');
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(teamList, /const INITIAL_GROUP_LIMIT = 5/);
  assert.match(teamList, /const MORE_GROUP_LIMIT = 10/);
  assert.match(teamList, /const \[groupPages, setGroupPages\] = useState\(\{\}\)/);
  assert.match(teamList, /const \[groupErrors, setGroupErrors\] = useState\(\{\}\)/);
  assert.match(teamList, /group\.type === 'member' \|\| group\.type === 'historical'/);
  assert.match(teamList, /loadGroup\(group, \{ limit: INITIAL_GROUP_LIMIT \}\)/);
  assert.match(teamList, /cursor: page\.nextCursor/);
  assert.match(teamList, /limit: MORE_GROUP_LIMIT/);
  assert.match(teamList, /setGroupPages\(\{\}\)/);
  assert.match(teamList, /if \(loading\) return/);
  assert.match(teamList, /\[filter, refreshVersion\]/);
  assert.match(teamList, /aria-expanded=\{!closed\}/);
  assert.match(workspace, /const \[teamRefreshVersion, setTeamRefreshVersion\] = useState\(0\)/);
  assert.match(workspace, /setTeamRefreshVersion\(\(current\) => current \+ 1\)/);
  assert.match(workspace, /refreshVersion=\{teamRefreshVersion\}/);
  assert.match(teamList, /Load 10 more/);
  assert.match(teamList, /再加载 10 条/);
  assert.match(teamList, /page\?\.rows/);
});

test('historical supervision keeps a distinct read-only group', async () => {
  const { groupRegionalTeamWorkOrders } = await import('../src/components/Engineer/engineerWorkOrderMetrics.js');
  const groups = groupRegionalTeamWorkOrders([
    { id: 'historical', engineer_id: 'former-1', engineer_name: 'Former Engineer', ownership_relation: 'historical_supervision' },
  ], [], { id: 'lead-1', name: 'Joe', status: 'available' });

  assert.deepEqual(groups.map((group) => group.type), ['queue', 'lead', 'historical']);
  assert.equal(groups[0].tickets.length, 0);
  assert.equal(groups[2].tickets[0].id, 'historical');
});

test('engineer workspace restores synchronized metrics, calendar, profile, and grouped lists', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  const metrics = read('frontend/src/components/Engineer/EngineerMetricOverview.jsx');
  const teamList = read('frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx');

  assert.match(workspace, /const \[scope, setScope\] = useState\('personal'\)/);
  assert.match(workspace, /<EngineerMetricOverview/);
  assert.match(workspace, /<EngineerTeamWorkOrderList/);
  assert.match(workspace, /<EngineerAvailabilityCalendar \/>/);
  assert.match(workspace, /scope === 'team' \? \[\] : calendarEvents/);
  assert.match(workspace, /getEngineerTeam/);
  assert.match(workspace, /onClick=\{onOpenProfile\}/);
  assert.match(workspace, /history\.pushState\(\{\}, '', `\/work-orders\/\$\{encodeURIComponent\(ticket\.id\)\}`\)/);
  assert.doesNotMatch(workspace, /selectedTicket/);
  assert.match(metrics, /My metrics/);
  assert.match(metrics, /Team metrics/);
  assert.match(metrics, /Needs action/);
  assert.match(metrics, /Today'?s tasks/);
  assert.match(metrics, /Pending confirmation/);
  assert.match(metrics, /Unassigned queue/);
  assert.match(metrics, /In service/);
  assert.match(metrics, /Quote pending/);
  assert.match(metrics, /Scheduled dates/);
  assert.match(metrics, /Reports due/);
  assert.match(metrics, /Parts needs/);
  assert.match(teamList, /Unassigned regional queue/);
  assert.match(teamList, /group\.engineer\.name/);
  assert.match(teamList, /Historical supervision/);
  assert.match(teamList, /onFilterChange/);
});

test('engineer host recognizes refreshable work-order routes', () => {
  const app = read('frontend/src/App.jsx');

  assert.match(app, /currentPath\.match\(\/\^\\\/work-orders\\\/\(\[\^\/\]\+\)\$\//);
  assert.match(app, /workOrderId=\{engineerWorkOrderId\}/);
});

test('engineer detail exposes only one of six high-level sections at a time', () => {
  const detail = read('frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx');
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  for (const label of ['Overview', 'Messages', 'Quote', 'Material request', 'Field service', 'Service report']) {
    assert.match(detail, new RegExp(label));
  }
  assert.match(detail, /const \[activeTab, setActiveTab\] = useState\('overview'\)/);
  assert.match(detail, /controlledTab=/);
  assert.match(detail, /showTabNavigation=\{false\}/);
  assert.match(detail, /Current Task Context/);
  assert.match(detail, /Job Preparation/);
  assert.match(detail, /Service Standard Checklist/);
  assert.doesNotMatch(detail, /Work-Order Tools/);
  assert.match(modal, /controlledTab/);
  assert.match(modal, /showTabNavigation/);
  assert.match(detail, /Quote details/);
  assert.match(detail, /Payments & receipts/);
  assert.match(detail, /className=\{`rounded-md px-3 py-2 whitespace-nowrap text-xs font-bold/);
  assert.match(detail, /activeTab === 'quote' \? commercialView : tabMap\[activeTab\]/);
  assert.match(detail, /refreshAfter\(onAssignEngineer\)/);
  assert.match(detail, /refreshAfter\(onConfirmAssignment\)/);
  assert.match(detail, /isExecutingEngineer && detail\.status === 'assigned'/);
  assert.match(detail, /const canReassignTeamWork = isRegionalLead && isCurrentTeamWork && \['pending', 'pending_dispatch', 'assigned'\]\.includes\(detail\.status\)/);
  assert.match(detail, /canReassignTeamWork \? \(/);
  assert.match(detail, /Unavailable for this work-order stage/);
});

test('calendar supports personal edits and protects work-order schedules', () => {
  const calendar = read('frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(api, /export async function updateEngineerCalendarEvent/);
  assert.match(calendar, /updateEngineerCalendarEvent/);
  assert.match(calendar, /editingId/);
  assert.match(calendar, /item\.work_order_id/);
  assert.match(calendar, /Scheduled from work order/);
  assert.match(calendar, /工单排期/);
  assert.match(calendar, /formatDateTime\(item\.start_at, locale\)/);
  assert.match(calendar, /aria-label=\{copy\.edit\}/);
  assert.match(calendar, /copy\.loading/);
});

test('work-order rows use a single interactive element without nested buttons', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  assert.match(list, /<button\s+key=\{ticket\.id\}/);
  assert.doesNotMatch(list, /role="button"/);
  assert.doesNotMatch(list, /onConfirmAssignment/);
  assert.match(list, /getEngineerWorkOrderTitle\(ticket/);
});

test('team failures clear stale records before rendering scoped metrics', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /catch \(error\) \{\s*setTickets\(\[\]\)/);
  assert.match(workspace, /setTeam\(\[\]\)/);
  assert.match(workspace, /catch \(error\) \{ setStatus\(previousStatus\)/);
});

test('international engineer content uses structured translation and labelled originals', async () => {
  const {
    getLocalizedCustomerContent,
    localizeWorkOrderSystemMessage,
  } = await import('../src/components/Engineer/engineerWorkOrderContent.js');
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  assert.deepEqual(
    getLocalizedCustomerContent({ content: '设备停机', content_en: 'Machine stopped' }, 'en'),
    {
      primaryText: 'Machine stopped',
      primaryLabel: 'English translation',
      originalText: '设备停机',
      originalLabel: 'Customer original',
    },
  );
  assert.equal(
    localizeWorkOrderSystemMessage({ message_type: 'ticket_accepted', content: '工程师已确认派工' }, 'en'),
    'The engineer confirmed the assignment.',
  );
  assert.doesNotMatch(workspace, /CHINESE_ENGINEER_DESCRIPTION_TERMS|replaceChineseDeviceLabels/);
  assert.doesNotMatch(list, /sr-only[^\n]*formatDescription\(ticket\.description/);
});

test('engineer work-order titles never use foreign-language customer text as interface copy', async () => {
  const { getEngineerWorkOrderTitle } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');

  assert.equal(getEngineerWorkOrderTitle({ description: '型号：E2E-LASER-3015。' }, false, 'Service task'), 'Service task');
  assert.equal(getEngineerWorkOrderTitle({ description: 'Laser output dropped.' }, true, '服务任务'), '服务任务');
});

test('saved and Worker-resolved titles precede legacy customer text', async () => {
  const { getEngineerWorkOrderTitle } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');

  assert.equal(getEngineerWorkOrderTitle({
    short_title: '济南 3015 维修',
    description: 'English customer description.',
  }, false, 'Service task'), '济南 3015 维修');
  assert.equal(getEngineerWorkOrderTitle({
    display_title: "Han's Laser 3015 on-site repair",
    description: '设备类型：激光切割机。',
  }, false, 'Service task'), "Han's Laser 3015 on-site repair");
});

test('engineer list keeps key fields readable without a next-step column', () => {
  const list = read('frontend/src/components/Engineer/EngineerWorkOrderList.jsx');

  for (const label of ['Work order', 'Task name', 'Customer', 'Equipment / issue', 'Region', 'Status', 'Updated']) {
    assert.match(list, new RegExp(label.replace('/', '\\/')));
  }
  assert.doesNotMatch(list, /Next step/);
  assert.match(list, /min-\[1280px\]:grid/);
  assert.match(list, /min-\[1280px\]:hidden/);
  assert.match(list, /whitespace-nowrap/);
  assert.match(list, /line-clamp-2/);
  assert.match(list, /grid-cols-\[132px_minmax\(240px,1\.55fr\)_minmax\(110px,\.75fr\)_minmax\(260px,1\.55fr\)_minmax\(120px,\.8fr\)_minmax\(150px,\.9fr\)_118px_36px\]/);
  assert.match(list, /line-clamp-2 text-\[15px\]/);
  assert.match(list, /whitespace-nowrap text-xs text-\[#697386\]/);
  assert.doesNotMatch(list, /getNextAction\(ticket\)/);
});

test('regional team operational labels use the approved readable scale', () => {
  const teamList = read('frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx');

  assert.match(teamList, /truncate text-\[15px\]/);
  assert.match(teamList, /mt-0\.5 block text-xs/);
  assert.match(teamList, /rounded-full[^"\n]*text-xs/);
  assert.match(teamList, /rounded-lg px-3 py-2 text-xs/);
});

test('engineer work-order machine summaries follow the host language', async () => {
  const { getEngineerMachineLine } = await import('../src/components/Engineer/engineerWorkOrderDisplay.js');
  const ticket = {
    category_l1: 'laser_cutting',
    category_l2: 'mechanical_fault',
    device_brand: 'TRUMPF',
    device_model: 'TruLaser 3030',
  };

  assert.equal(
    getEngineerMachineLine(ticket, false, 'Machine details pending'),
    'Laser Cutting / Mechanical Fault / TRUMPF / TruLaser 3030',
  );
  assert.equal(
    getEngineerMachineLine(ticket, true, '设备信息待补充'),
    '激光切割 / 机械故障 / TRUMPF / TruLaser 3030',
  );
});

test('work-order messages localize system copy and label foreign customer originals', () => {
  const messages = read('frontend/src/components/WorkOrder/MessagePanel.jsx');

  assert.match(messages, /isCnLocale/);
  assert.match(messages, /localizeWorkOrderSystemMessage/);
  assert.match(messages, /getLocalizedCustomerContent/);
  assert.match(messages, /Customer original/);
  assert.match(messages, /客户原文/);
  assert.match(messages, /No messages yet/);
  assert.match(messages, /暂无消息/);
  assert.match(messages, /toLocaleTimeString\(isCn \? 'zh-CN' : 'en-US'/);
});

test('work-order modal retains existing operational panels in controlled mode', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(modal, /CollectionPanel/);
  assert.match(modal, /FieldWorkPanel/);
  assert.match(modal, /MaterialRequisitionPanel/);
  assert.match(modal, /EngineerPricingPanel/);
  assert.match(modal, /MessagePanel/);
  assert.match(modal, /RepairRecordPanel/);
  assert.match(modal, /Request Admin Approval to Start/);
  assert.match(modal, /aria-label="Request Admin Approval to Start"/);
  assert.match(modal, /Request Start Approval/);
  assert.match(modal, /userType === 'engineer' && !managementReadOnly/);
});

test('service report copy follows the engineer host locale', () => {
  const report = read('frontend/src/components/WorkOrder/RepairRecordPanel.jsx');

  assert.match(report, /const COPY =/);
  assert.match(report, /暂无服务报告/);
  assert.match(report, /服务报告标准流程/);
  assert.match(report, /提交最终报告给客户/);
  assert.match(report, /toLocaleString\(isCn \? 'zh-CN' : 'en-US'\)/);
});

test('engineer workspace no longer uses 9px or 10px operational text', () => {
  const files = [
    'frontend/src/components/Engineer/EngineerMetricOverview.jsx',
    'frontend/src/components/Engineer/EngineerWorkspace.jsx',
    'frontend/src/components/Engineer/EngineerWorkOrderList.jsx',
    'frontend/src/components/Engineer/EngineerTeamWorkOrderList.jsx',
    'frontend/src/components/Engineer/EngineerWorkOrderDetail.jsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /text-\[(?:9|10)px\]/, `${file} still uses undersized operational text`);
  }

  const metrics = read(files[0]);
  const list = read(files[2]);
  assert.match(metrics, /text-\[30px\]/);
  assert.match(list, /text-\[(?:15|16)px\]/);
});

test('engineer workspace constrains mobile header and metric controls to the viewport', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  const metrics = read('frontend/src/components/Engineer/EngineerMetricOverview.jsx');

  assert.match(workspace, /flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4/);
  assert.match(workspace, /flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto/);
  assert.match(workspace, /onClick=\{onOpenProfile\} title=\{currentUser\?\.name \|\| copy\.profileFallback\}/);
  assert.match(workspace, /className="min-w-0 max-w-\[calc\(100%_-_5\.5rem\)\] truncate[^"\n]*text-xs[^"\n]*md:max-w-none"/);
  assert.match(workspace, /mb-4 grid min-w-0 gap-4 xl:grid-cols/);
  assert.match(metrics, /section className="min-w-0 rounded-2xl/);
  assert.match(metrics, /grid w-full min-w-0 grid-cols-2[^"\n]*sm:inline-flex sm:w-fit/);
});
