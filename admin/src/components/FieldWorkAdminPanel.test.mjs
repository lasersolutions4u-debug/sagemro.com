import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseApiDate } from '../utils/dateTime.js';
import { safeAuditEntries } from '../utils/fieldWorkAudit.js';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('field-work Admin APIs use the protected Worker routes and authenticated media fetch', async () => {
  const api = await readSource('../services/api.js');

  assert.match(api, /export async function updateFieldPlan[\s\S]*\/api\/admin\/workorders\/\$\{workOrderId\}\/field-plan[\s\S]*method: 'PATCH'/);
  assert.match(api, /export async function decideFieldExtension[\s\S]*extension-requests\/\$\{requestId\}\/decision[\s\S]*method: 'POST'/);
  assert.match(api, /export async function overrideFieldDay[\s\S]*field-days\/override[\s\S]*method: 'POST'/);
  assert.match(api, /export async function correctFieldDayReport[\s\S]*field-days\/\$\{fieldDayId\}\/report[\s\S]*method: 'PATCH'/);
  assert.match(api, /export async function openFieldEvidenceHold[\s\S]*evidence-holds[\s\S]*method: 'POST'/);
  assert.match(api, /export async function resolveFieldEvidenceHold[\s\S]*evidence-holds\/\$\{holdId\}\/resolve[\s\S]*method: 'POST'/);
  assert.match(api, /export async function getAuthenticatedFieldMediaUrl[\s\S]*field-media\/\$\{mediaId\}[\s\S]*credentials: 'include'[\s\S]*URL\.createObjectURL/);
});

test('field-work panel provides dense plan, timeline, media, extension, exception, and hold controls', async () => {
  const panel = await readSource('./FieldWorkAdminPanel.jsx');

  assert.match(panel, /export function FieldWorkAdminPanel\(\{ workOrder, readOnly = false, onRefresh \}\)/);
  assert.match(panel, /site_timezone/);
  assert.match(panel, /expected_service_days/);
  assert.match(panel, /expected_completion_date/);
  assert.match(panel, /planned_daily_start_time/);
  assert.match(panel, /planned_daily_end_time/);
  assert.match(panel, /Intl\.DateTimeFormat[\s\S]*timeZone/);
  assert.match(panel, /field_work_summary/);
  assert.match(panel, /field_days/);
  assert.match(panel, /field_evidence_holds/);
  assert.match(panel, /field_day_revisions/);
  assert.match(panel, /field_work_audit_logs/);
  assert.match(panel, /previous_report/);
  assert.match(panel, /field_day_id/);
  assert.match(panel, /report_overdue/);
  assert.match(panel, /location_status/);
  assert.match(panel, /location_unavailable/);
  assert.match(panel, /within_geofence/);
  assert.match(panel, /locationAllowed/);
  assert.match(panel, /getAuthenticatedFieldMediaUrl/);
  assert.match(panel, /pending_extension_requests/);
  assert.match(panel, /decision_reason/);
  assert.match(panel, /decideExtension\(extension\.id, 'approved'\)/);
  assert.match(panel, /decideExtension\(extension\.id, 'rejected'\)/);
  assert.match(panel, /setOverrideMode\('create_day'\)/);
  assert.match(panel, /setOverrideMode\('close_day'\)/);
  assert.match(panel, /action: overrideMode/);
  assert.match(panel, /correctionReason/);
  assert.match(panel, /overrideReason/);
  assert.match(panel, /reason_category/);
  for (const category of ['complaint', 'warranty', 'safety_review', 'legal_hold', 'dispute']) {
    assert.match(panel, new RegExp(`value="${category}"`));
  }
  assert.match(panel, /resolution_reason/);
  assert.match(panel, /if \(readOnly\) return/);
  assert.match(panel, /await onRefresh\?\.\(workOrder\.id\)/);
  assert.match(panel, /<section className="[^"]*break-words/);
});

test('field-work panel localizes operational labels for English and Chinese consoles', async () => {
  const panel = await readSource('./FieldWorkAdminPanel.jsx');

  assert.match(panel, /Field operations/);
  assert.match(panel, /现场作业运营/);
  assert.match(panel, /Evidence hold/);
  assert.match(panel, /证据保全/);
  assert.match(panel, /Read-only/);
  assert.match(panel, /只读/);
  assert.match(panel, /Complaint/);
  assert.match(panel, /客户投诉/);
  assert.match(panel, /Warranty review/);
  assert.match(panel, /质保审核/);
  assert.match(panel, /Safety review/);
  assert.match(panel, /安全审核/);
  assert.match(panel, /Legal hold/);
  assert.match(panel, /法律保全/);
  assert.match(panel, /Dispute/);
  assert.match(panel, /争议/);
  assert.match(panel, /Field audit trail/);
  assert.match(panel, /现场审计记录/);
  assert.match(panel, /Opened by/);
  assert.match(panel, /开启人/);
  assert.match(panel, /Resolved by/);
  assert.match(panel, /解除人/);
  assert.match(panel, /Saved; refresh failed/);
  assert.match(panel, /已保存，但刷新失败/);
  assert.match(panel, /locationStatusLabels/);
  assert.match(panel, /admin_override: t\.locationAdminOverride/);
  assert.match(panel, /Admin override/);
  assert.match(panel, /Admin 例外确认/);
  assert.doesNotMatch(panel, /locationLabel: day\.location_status/);
});

test('field-work mutations preserve success semantics when the detail refresh fails', async () => {
  const panel = await readSource('./FieldWorkAdminPanel.jsx');

  assert.match(panel, /await action\(\);[\s\S]*catch \(error\) \{[\s\S]*setMessage\(error\.message \|\| t\.actionFailed\);[\s\S]*return;[\s\S]*try \{[\s\S]*await onRefresh\?\.\(workOrder\.id\);[\s\S]*catch \{[\s\S]*setMessage\(t\.savedRefreshFailed\)/);
});

test('field-work audit text containers prevent long unbroken content from overflowing', async () => {
  const panel = await readSource('./FieldWorkAdminPanel.jsx');

  assert.match(panel, /className="min-w-0 py-4[^\"]*\[overflow-wrap:anywhere\]"/);
  assert.match(panel, /className="min-w-0 py-3[^\"]*\[overflow-wrap:anywhere\]"/);
  assert.match(panel, /className="min-w-0 border-l-2[^\"]*\[overflow-wrap:anywhere\]"/);
  assert.match(panel, /className="min-w-0 py-3[^\"]*\[overflow-wrap:anywhere\]"/);
  assert.match(panel, /<dd className="min-w-0[^\"]*\[overflow-wrap:anywhere\][^\"]*"/);
});

test('D1 timestamps without an offset are parsed as UTC', () => {
  assert.equal(parseApiDate('2026-07-24 10:00:00').toISOString(), '2026-07-24T10:00:00.000Z');
  assert.equal(parseApiDate('2026-07-24T10:00:00Z').toISOString(), '2026-07-24T10:00:00.000Z');
});

test('field-work audit summaries only expose approved operational fields', () => {
  const entries = safeAuditEntries(JSON.stringify({
    status: 'approved',
    expected_service_days: 4,
    expected_completion_date: '2026-07-28',
    completed_work: 'customer narrative must stay hidden',
    internal_note: 'private note must stay hidden',
    ip: '192.0.2.1',
  }));

  assert.deepEqual(entries, [
    ['status', 'approved'],
    ['expected_service_days', '4'],
    ['expected_completion_date', '2026-07-28'],
  ]);
  assert.deepEqual(safeAuditEntries('{broken'), []);
});

test('field-work audit renders immutable actions, actors, timestamps, and safe state summaries', async () => {
  const panel = await readSource('./FieldWorkAdminPanel.jsx');

  assert.match(panel, /const auditLogs = workOrder\?\.field_work_audit_logs \|\| \[\]/);
  assert.match(panel, /audit\.action/);
  assert.match(panel, /audit\.actor_type/);
  assert.match(panel, /audit\.actor_id/);
  assert.match(panel, /formatDateTime\(audit\.created_at/);
  assert.match(panel, /safeAuditEntries\(audit\.before_state\)/);
  assert.match(panel, /safeAuditEntries\(audit\.after_state\)/);
  assert.match(panel, /hold\.opened_by/);
  assert.match(panel, /hold\.opened_at/);
  assert.match(panel, /hold\.resolved_by/);
  assert.match(panel, /hold\.resolved_at/);
  assert.match(panel, /hold\.resolution_reason/);
});
