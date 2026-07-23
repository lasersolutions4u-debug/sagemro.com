import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fieldDayBlocksFinalReport,
  fieldDayLocalDate,
  mediaRetentionEligible,
  validateDailyReport,
  validateFieldPlan,
} from '../src/lib/field-work.js';

test('uses the approved site time zone for the legal field-work day', () => {
  assert.equal(fieldDayLocalDate('2026-07-23T16:30:00Z', 'Asia/Shanghai'), '2026-07-24');
  assert.equal(fieldDayLocalDate('2026-07-23T16:30:00Z', 'America/Los_Angeles'), '2026-07-23');
});

test('validates a bounded Admin field-work plan', () => {
  assert.deepEqual(validateFieldPlan({
    site_timezone: 'Asia/Shanghai',
    expected_service_days: 3,
    expected_completion_date: '2026-07-26',
    planned_daily_start_time: '08:30',
    planned_daily_end_time: '17:30',
  }), {
    value: {
      site_timezone: 'Asia/Shanghai',
      expected_service_days: 3,
      expected_completion_date: '2026-07-26',
      planned_daily_start_time: '08:30',
      planned_daily_end_time: '17:30',
    },
  });
  assert.equal(validateFieldPlan({ site_timezone: 'not-a-zone', expected_service_days: 0 }).error, 'field_plan_invalid');
});

test('accepts IANA time zones and UTC but rejects fixed offsets', () => {
  const plan = {
    expected_service_days: 3,
    expected_completion_date: '2026-07-26',
  };

  assert.equal(validateFieldPlan({ ...plan, site_timezone: 'Asia/Shanghai' }).error, undefined);
  assert.equal(validateFieldPlan({ ...plan, site_timezone: 'UTC' }).error, undefined);
  assert.equal(validateFieldPlan({ ...plan, site_timezone: '+08:00' }).error, 'field_plan_invalid');
});

test('time zone validation fallback still rejects fixed offsets', async () => {
  const supportedValuesOf = Intl.supportedValuesOf;
  Intl.supportedValuesOf = undefined;

  try {
    const fallbackModule = await import(`../src/lib/field-work.js?fallback=${Date.now()}`);
    const plan = {
      expected_service_days: 3,
      expected_completion_date: '2026-07-26',
    };

    assert.equal(fallbackModule.validateFieldPlan({ ...plan, site_timezone: 'Asia/Shanghai' }).error, undefined);
    assert.equal(fallbackModule.validateFieldPlan({ ...plan, site_timezone: 'UTC' }).error, undefined);
    assert.equal(fallbackModule.validateFieldPlan({ ...plan, site_timezone: '+08:00' }).error, 'field_plan_invalid');
  } finally {
    Intl.supportedValuesOf = supportedValuesOf;
  }
});

test('daily reports require progress evidence and late reasons only when overdue', () => {
  assert.equal(validateDailyReport({ labor_hours: 8, progress_media_count: 0 }, { overdue: false }).error, 'progress_photo_required');
  const completeReport = {
    labor_hours: 8,
    progress_media_count: 1,
    completed_work: 'Replaced the damaged protective lens.',
    issues_risks: 'No additional issue found.',
    next_plan: 'Verify output stability tomorrow.',
    customer_support_needed: 'Keep the machine powered down overnight.',
  };
  assert.equal(validateDailyReport(completeReport, { overdue: true }).error, 'late_reason_required');
  assert.deepEqual(validateDailyReport(completeReport, { overdue: false }).error, undefined);
});

test('open and overdue field days block final service report submission', () => {
  assert.equal(fieldDayBlocksFinalReport('checked_in'), true);
  assert.equal(fieldDayBlocksFinalReport('report_overdue'), true);
  assert.equal(fieldDayBlocksFinalReport('admin_override_open'), true);
  assert.equal(fieldDayBlocksFinalReport('report_submitted'), false);
  assert.equal(fieldDayBlocksFinalReport('late_report_submitted'), false);
  assert.equal(fieldDayBlocksFinalReport('admin_closed'), false);
});

test('retention requires 12 months after completion and no evidence hold', () => {
  assert.equal(mediaRetentionEligible({
    completedAt: '2025-07-01T00:00:00Z',
    now: '2026-07-02T00:00:00Z',
    hasOpenHold: false,
  }), true);
  assert.equal(mediaRetentionEligible({
    completedAt: '2025-07-01T00:00:00Z',
    now: '2026-06-30T23:59:59Z',
    hasOpenHold: false,
  }), false);
  assert.equal(mediaRetentionEligible({
    completedAt: '2025-07-01T00:00:00Z',
    now: '2026-07-02T00:00:00Z',
    hasOpenHold: true,
  }), false);
});
