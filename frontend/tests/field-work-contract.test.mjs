import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex === -1 ? source.length : endIndex);
}

function loadFunction(source, start, end, name) {
  const functionSource = section(source, start, end).trim();
  return Function(`return (${functionSource});`)();
}

test('field-work API uses authenticated multipart requests and stable idempotency keys', () => {
  const api = read('frontend/src/services/api.js');
  const checkInApi = section(api, 'export async function checkInFieldDay', 'export async function getFieldDays');
  const reportApi = section(api, 'export async function submitFieldDayReport', 'export async function requestFieldExtension');

  assert.match(checkInApi, /new FormData\(\)/);
  assert.match(checkInApi, /formData\.append\('photo',\s*photo\)/);
  assert.match(checkInApi, /\/field-days\/check-in/);
  assert.match(checkInApi, /'Idempotency-Key':\s*idempotencyKey/);
  assert.doesNotMatch(checkInApi, /['"]Content-Type['"]/);

  assert.match(api, /export async function getFieldDays\(workOrderId\)/);
  assert.match(api, /\/api\/workorders\/\$\{workOrderId\}\/field-days/);
  assert.match(reportApi, /new FormData\(\)/);
  assert.match(reportApi, /progress_photos/);
  assert.match(reportApi, /internal_photos/);
  for (const field of [
    'extension_reason',
    'extension_customer_explanation',
    'requested_additional_days',
    'proposed_completion_date',
    'extension_internal_note',
  ]) {
    assert.match(reportApi, new RegExp(field));
  }
  assert.match(reportApi, /'Idempotency-Key':\s*idempotencyKey/);
  assert.doesNotMatch(reportApi, /['"]Content-Type['"]/);

  assert.match(api, /export async function requestFieldExtension\(workOrderId, data\)/);
  assert.match(api, /\/extension-requests/);
  assert.match(api, /export function fieldMediaUrl\(workOrderId, mediaId\)/);
  assert.match(api, /\/field-media\/\$\{mediaId\}/);
});

test('engineer check-in uses a live front camera and releases the stream', () => {
  const componentPath = 'frontend/src/components/WorkOrder/FieldWorkPanel.jsx';
  assert.equal(existsSync(path.join(root, componentPath)), true, 'FieldWorkPanel should exist');
  const panel = read(componentPath);
  const checkInBlock = section(panel, 'data-field-work-check-in', 'data-field-work-report');

  assert.match(panel, /navigator\.mediaDevices\.getUserMedia\(\{\s*video:\s*\{\s*facingMode:\s*'user'\s*\}/);
  assert.match(panel, /<video[^>]*playsInline[^>]*muted/);
  assert.match(panel, /document\.createElement\('canvas'\)/);
  assert.match(panel, /canvas\.toBlob/);
  assert.match(panel, /getTracks\(\)\.forEach\(\(track\)\s*=>\s*track\.stop\(\)\)/);
  assert.match(panel, /return \(\) => stopCamera\(\)/);
  assert.match(panel, /cameraRequestRef\.current \+= 1/);
  assert.match(panel, /if \(!mountedRef\.current \|\| requestId !== cameraRequestRef\.current\)[\s\S]*stream\.getTracks\(\)\.forEach/);
  assert.match(panel, /captureRequestRef\.current \+= 1/);
  assert.match(panel, /canvas\.toBlob\(\(blob\) => \{[\s\S]*if \(!mountedRef\.current \|\| requestId !== captureRequestRef\.current\)[\s\S]*URL\.revokeObjectURL\(latePreview\)/);
  assert.doesNotMatch(checkInBlock, /<input[^>]*type=["']file["']/);
  assert.match(panel, /getBrowserLocation\(\)[\s\S]*catch\(\(\)\s*=>\s*null\)/);
  assert.match(panel, /location_status[^\n]*unavailable/);
});

test('engineer daily reports validate evidence, retain drafts, and complete overdue days', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');

  for (const field of ['completed_work', 'issues_risks', 'next_plan', 'customer_support_needed', 'labor_hours']) {
    assert.match(panel, new RegExp(field));
  }
  assert.match(panel, /progressPhotos\.length\s*===\s*0/);
  assert.match(panel, /sagemro_field_report_\$\{fieldDayId\}/);
  assert.match(panel, /localStorage\.setItem\(draftKey/);
  assert.match(panel, /localStorage\.removeItem\(draftKey\)/);
  assert.match(panel, /fieldDay\.status === 'report_overdue'/);
  assert.match(panel, /late_reason/);
  assert.match(panel, /submitFieldDayReport\(/);
  assert.match(panel, /requestFieldExtension\(/);
  assert.match(panel, /request_extension/);
  assert.match(panel, /extension_reason/);
  assert.match(panel, /extension_customer_explanation/);
  assert.match(panel, /requested_additional_days/);
  assert.match(panel, /proposed_completion_date/);
  assert.match(panel, /extension_internal_note/);
  assert.match(panel, /report\.request_extension && !extensionPending/);
  assert.match(panel, /request_extension[\s\S]*submitFieldDayReport\(/);
  assert.match(panel, /Complete overdue report|补交逾期日报/);
});

test('today report stays primary while overdue reports remain separate actions', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');

  assert.match(panel, /const todayReportDay = todayFieldDay[\s\S]*status === 'checked_in'/);
  assert.match(panel, /const overdueDays = openDays\.filter/);
  assert.match(panel, /todayReportDay && \([\s\S]*<ReportForm/);
  assert.match(panel, /data-field-work-overdue/);
  assert.match(panel, /selectedOverdueDay && <ReportForm/);
  assert.doesNotMatch(panel, /openDays\.find\(\(day\) => day\.status === 'report_overdue'\)[\s\S]*\|\| todayFieldDay/);
});

test('customer timeline is allowlisted and never renders private field evidence', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');
  const customerView = section(panel, 'function customerTimelineDay', 'function fieldDayStatusLabel');

  for (const field of ['site_local_date', 'status', 'completed_work', 'issues_risks', 'next_plan', 'customer_support_needed', 'labor_hours', 'media']) {
    assert.match(customerView, new RegExp(field));
  }
  for (const field of ['internal_note', 'latitude', 'longitude', 'accuracy_m', 'distance_m', 'radius_m', 'within_geofence', 'admin_override_reason']) {
    assert.doesNotMatch(customerView, new RegExp(field));
  }
  assert.match(panel, /customerTimelineDay/);
  assert.match(panel, /fieldMediaUrl\(/);
  assert.match(panel, /expected_completion_date/);
  assert.match(panel, /report_overdue/);
  assert.match(panel, /extension\.status === 'approved'[\s\S]*approvedCompletion/);
  assert.match(panel, /extension\.status === 'rejected'[\s\S]*decision_reason/);
  assert.match(panel, /\(isCustomer \|\| isAssignedEngineer\)[\s\S]*field_extension_requests/);
  assert.doesNotMatch(panel, /revisedCompletion\}: \{extension\.proposed_completion_date\}/);
});

test('quote-driven field work uses the confirmed quote allowance without a legacy completion plan', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');
  const planSection = section(panel, '<section className="border-b border-[var(--color-border)] pb-4">', '{isAssignedEngineer &&');

  assert.match(panel, /const quoteExecution = detail\?\.quote_execution \|\| \{\}/);
  assert.match(panel, /const quoteDriven = Number\(detail\?\.active_quote_version \|\| 0\) >= 1/);
  assert.match(panel, /expected_service_days/);
  assert.match(panel, /consumed_workdays/);
  assert.match(panel, /permitted_workdays/);
  assert.match(panel, /remaining_workdays/);
  assert.match(panel, /allowance_exhausted/);
  assert.match(panel, /const hasExecutionBaseline = quoteDriven[\s\S]*fieldPlan\.site_timezone/);
  assert.doesNotMatch(panel, /const hasExecutionBaseline =[^;]*expected_completion_date/);

  for (const copy of [
    'Approved quote duration',
    'expected onsite workdays',
    'used',
    'remaining',
    '报价审核工期',
    '预计现场作业',
    '已使用',
    '剩余',
  ]) assert.match(panel, new RegExp(copy));

  assert.match(planSection, /quoteDriven \?/);
  assert.match(planSection, /expectedWorkdaysLabel\(expectedWorkdays/);
  assert.match(planSection, /workdayCountLabel\(consumedWorkdays/);
  assert.match(planSection, /workdayCountLabel\(remainingWorkdays/);
  assert.match(panel, /time allowance only/);
  assert.match(panel, /不会自动增加人工费用/);
  assert.match(panel, /allowanceExhausted/);
  assert.match(panel, /<ExtensionForm/);
  assert.match(panel, /!quoteDriven[\s\S]*handleLegacyArrivalCheck/);
});

test('quote execution exceptions fail closed without usable counters or engineer actions', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');
  const planSection = section(panel, '<section className="border-b border-[var(--color-border)] pb-4">', '{isAssignedEngineer &&');

  assert.match(panel, /function hasValidQuoteAllowance\(execution\)/);
  assert.match(panel, /execution\.payment_state === 'exception'/);
  assert.match(panel, /const quoteExecutionAvailable = quoteDriven && hasValidQuoteAllowance\(quoteExecution\)/);
  assert.match(panel, /Execution data unavailable/);
  assert.match(panel, /执行数据暂不可用/);
  assert.match(planSection, /quoteDriven \?[\s\S]*quoteExecutionAvailable \?/);
  assert.match(panel, /hasExecutionBaseline && !allowanceExhausted[\s\S]*data-field-work-check-in/);
  assert.match(panel, /hasExecutionBaseline && \([\s\S]*<ExtensionForm/);
  assert.match(planSection, /\{t\.executionUnavailable\}<\/p> : hasLegacyPlan \? \(/);
});

test('quote allowance counters reject blank, fractional, negative, and unsafe canonical values', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');
  const validators = Function(`${section(panel, 'function safeWorkdayCount', 'function siteTimezoneLabel')}; return { safeWorkdayCount, hasValidQuoteAllowance };`)();
  const validAllowance = {
    payment_state: 'settled',
    expected_service_days: 3,
    consumed_workdays: 1,
    permitted_workdays: 3,
    remaining_workdays: 2,
    allowance_exhausted: false,
  };

  assert.equal(validators.hasValidQuoteAllowance(validAllowance), true);
  for (const invalidValue of [null, undefined, '', '   ', 1.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validators.safeWorkdayCount(invalidValue), null);
    for (const field of ['expected_service_days', 'consumed_workdays', 'permitted_workdays', 'remaining_workdays']) {
      assert.equal(validators.hasValidQuoteAllowance({ ...validAllowance, [field]: invalidValue }), false);
    }
  }
});

test('China field-work plan and timeline use the display timezone label', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');
  const planSection = section(panel, '<section className="border-b border-[var(--color-border)] pb-4">', '{isAssignedEngineer &&');
  const siteTimezoneLabel = loadFunction(panel, 'function siteTimezoneLabel', 'function normalizeFieldDays', 'siteTimezoneLabel');

  assert.match(panel, /现场时区/);
  assert.match(panel, /site_timezone_display/);
  assert.match(planSection, /siteTimezoneLabel\(fieldPlan, isCn\)/);
  assert.doesNotMatch(planSection, />\{fieldPlan\.site_timezone\}<\/span>/);
  assert.match(panel, /Intl\.DateTimeFormat\('zh-CN',[\s\S]*timeZoneName: 'long'/);
  assert.match(panel, /现场当地时间/);
  const newYorkLabel = siteTimezoneLabel({ site_timezone: 'America/New_York' }, true);
  assert.notEqual(newYorkLabel, 'America/New_York');
  assert.doesNotMatch(newYorkLabel, /\//);
});

test('work-order details integrate field work and keep legacy arrival secondary', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');

  assert.match(modal, /import \{ FieldWorkPanel \} from '\.\/FieldWorkPanel';/);
  assert.match(modal, /detail\?\.service_mode === 'onsite'/);
  assert.match(modal, /detail\?\.field_days\?\.length/);
  assert.match(modal, /key: 'fieldWork'/);
  assert.match(modal, /isCnLocale\(\) \? '现场作业' : 'Field work'/);
  assert.match(modal, /tab === 'fieldWork'/);
  assert.match(modal, /<FieldWorkPanel[\s\S]*workOrderId=\{workOrder\.id\}[\s\S]*onBusyChange=/);
  assert.match(modal, /Legacy arrival record|历史到场记录/);
  assert.doesNotMatch(modal, /onClick=\{handleArrivalCheck\}/);
  assert.match(panel, /checkInWorkOrder/);
  assert.match(panel, /!quoteDriven && !hasLegacyPlan[\s\S]*arrival_verification_required[\s\S]*handleLegacyArrivalCheck/);
  assert.match(panel, /Legacy location check-in|旧工单定位签到/);
  assert.match(modal, /Complete every field-day report before submitting the final service report|提交最终服务报告前，请先完成所有现场日报/);
});

test('field-work mutations lock modal close and tab switches with localized guidance', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(modal, /const fieldWorkBusyMessage = isCnLocale\(\)[\s\S]*请等待现场作业操作完成后再离开[\s\S]*Wait for the field-work operation to finish/);
  assert.match(modal, /const modalBusy = materialRequisitionBusy \|\| fieldWorkBusy/);
  assert.match(modal, /const modalBusyMessage = fieldWorkBusy \? fieldWorkBusyMessage : materialRequisitionBusyMessage/);
  assert.match(modal, /closeDisabled=\{modalBusy\}/);
  assert.match(modal, /closeDisabledTitle=\{modalBusyMessage\}/);
  assert.match(modal, /disabled=\{modalBusy && tab !== t\.key\}/);
  assert.match(modal, /title=\{modalBusy && tab !== t\.key \? modalBusyMessage : undefined\}/);
});

test('successful field-work mutations do not become retry failures when refresh fails', () => {
  const panel = read('frontend/src/components/WorkOrder/FieldWorkPanel.jsx');
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const reportForm = section(panel, 'function ReportForm', 'function ExtensionForm');
  const extensionForm = section(panel, 'function ExtensionForm', 'export function FieldWorkPanel');
  const checkIn = section(panel, 'const submitCheckIn = async () => {', 'const handleLegacyArrivalCheck');

  assert.match(panel, /savedRefreshFailed: 'Saved, but the latest data could not be refreshed\. Reload this work order\.'/);
  assert.match(panel, /savedRefreshFailed: '已保存，但最新数据刷新失败，请重新加载此工单。'/);
  assert.match(panel, /async function bestEffortRefresh\(refresh, warning\)[\s\S]*try \{[\s\S]*await refresh\?\.\(\)[\s\S]*catch[\s\S]*toastWarning\(warning\)/);

  assert.match(reportForm, /try \{\s*await submitFieldDayReport[\s\S]*catch \(error\)[\s\S]*toastError[\s\S]*return;[\s\S]*localStorage\.removeItem\(draftKey\)[\s\S]*retryRef\.current = null[\s\S]*toastSuccess\(t\.reportSuccess\)[\s\S]*bestEffortRefresh\(onSaved, t\.savedRefreshFailed\)/);
  assert.match(checkIn, /try \{[\s\S]*await checkInFieldDay[\s\S]*catch \(submitError\)[\s\S]*toastError[\s\S]*return;[\s\S]*checkInRetryRef\.current = null[\s\S]*toastSuccess\(t\.checkInSuccess\)[\s\S]*bestEffortRefresh\(refresh, t\.savedRefreshFailed\)/);
  assert.match(extensionForm, /try \{\s*await requestFieldExtension[\s\S]*catch \(error\)[\s\S]*toastError[\s\S]*return;[\s\S]*setOpen\(false\)[\s\S]*toastSuccess\(t\.extensionSuccess\)[\s\S]*bestEffortRefresh\(onSaved, t\.savedRefreshFailed\)/);

  assert.match(panel, /const loadFieldDays = useCallback\(async \(\{ throwOnError = false \} = \{\}\)/);
  assert.match(panel, /if \(throwOnError\) throw loadError/);
  assert.match(panel, /await loadFieldDays\(\{ throwOnError: true \}\)/);
  assert.match(modal, /const loadDetail = useCallback\(async \(\{ throwOnError = false \} = \{\}\)/);
  assert.match(modal, /if \(throwOnError\) throw e/);
  assert.match(modal, /const handleFieldWorkChanged = useCallback\(\(\) => loadDetail\(\{ throwOnError: true \}\)/);
  assert.match(modal, /onChanged=\{handleFieldWorkChanged\}/);
});

test('privacy disclosures explain protected field evidence in English and Chinese', () => {
  const legalModal = read('frontend/src/components/common/LegalModal.jsx');
  const privacyPolicy = read('docs/legal/privacy-policy.md');

  for (const phrase of [
    'live field check-in photos',
    'service delivery',
    'authorized engineers, customers, and SAGEMRO operational staff',
    'does not perform facial recognition or biometric processing',
    '12 months after final completion',
    'complaint, warranty case, safety review, legal hold, or dispute',
  ]) {
    assert.match(legalModal, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  for (const phrase of [
    '现场签到照片',
    '服务交付',
    '经授权的工程师、客户和 SAGEMRO 运营人员',
    '不进行人脸识别或生物特征处理',
    '最终完成后 12 个月',
    '投诉、质保、安全审查、法律保全或争议',
  ]) {
    assert.match(legalModal, new RegExp(phrase));
  }

  assert.match(privacyPolicy, /现场签到照片/);
  assert.match(privacyPolicy, /不进行人脸识别或生物特征处理/);
  assert.match(privacyPolicy, /最终完成后 12 个月/);
  assert.match(privacyPolicy, /投诉、质保、安全审查、法律保全或争议/);
});
