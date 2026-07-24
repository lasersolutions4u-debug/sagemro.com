const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const FIXED_OFFSET_PATTERN = /^[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?$/;
const FINAL_REPORT_BLOCKING_STATUSES = new Set(['checked_in', 'report_overdue', 'admin_override_open']);
const SUPPORTED_TIME_ZONES = typeof Intl.supportedValuesOf === 'function'
  ? new Set(Intl.supportedValuesOf('timeZone'))
  : null;

function isValidTimeZone(value) {
  if (value === 'UTC') return true;
  if (FIXED_OFFSET_PATTERN.test(value)) return false;
  if (SUPPORTED_TIME_ZONES) return SUPPORTED_TIME_ZONES.has(value);
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanRequiredText(value) {
  return String(value || '').trim();
}

export function fieldDayLocalDate(now, timeZone) {
  if (!isValidTimeZone(timeZone)) throw new RangeError('Invalid site time zone');
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localDateTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function siteLocalDateTimeToUtc(value, timeZone) {
  if (!isValidTimeZone(timeZone)) throw new RangeError('Invalid site time zone');
  const input = String(value || '').trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(input)) {
    const absolute = new Date(input);
    if (!Number.isFinite(absolute.getTime())) throw new RangeError('Invalid date');
    return absolute;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  if (!match) throw new RangeError('Invalid site local datetime');
  const desired = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6] || 0),
  );
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localDateTimeParts(new Date(candidate), timeZone);
    const represented = Date.UTC(
      Number(actual.year), Number(actual.month) - 1, Number(actual.day),
      Number(actual.hour), Number(actual.minute), Number(actual.second),
    );
    const adjustment = desired - represented;
    if (adjustment === 0) return new Date(candidate);
    candidate += adjustment;
  }
  throw new RangeError('Invalid site local datetime');
}

export function validateFieldPlan(input = {}) {
  const siteTimezone = String(input.site_timezone || '').trim();
  const expectedServiceDays = Number(input.expected_service_days);
  const expectedCompletionDate = String(input.expected_completion_date || '').trim();
  const plannedStart = String(input.planned_daily_start_time || '').trim();
  const plannedEnd = String(input.planned_daily_end_time || '').trim();

  if (
    !isValidTimeZone(siteTimezone)
    || !Number.isInteger(expectedServiceDays)
    || expectedServiceDays < 1
    || expectedServiceDays > 365
    || !isValidDate(expectedCompletionDate)
    || (plannedStart && !TIME_PATTERN.test(plannedStart))
    || (plannedEnd && !TIME_PATTERN.test(plannedEnd))
  ) {
    return { error: 'field_plan_invalid' };
  }

  return {
    value: {
      site_timezone: siteTimezone,
      expected_service_days: expectedServiceDays,
      expected_completion_date: expectedCompletionDate,
      planned_daily_start_time: plannedStart || null,
      planned_daily_end_time: plannedEnd || null,
    },
  };
}

export function validateDailyReport(input = {}, { overdue = false } = {}) {
  const laborHours = Number(input.labor_hours);
  const progressMediaCount = Number(input.progress_media_count || 0);
  const completedWork = cleanRequiredText(input.completed_work);
  const issuesRisks = cleanRequiredText(input.issues_risks);
  const nextPlan = cleanRequiredText(input.next_plan);
  const customerSupportNeeded = cleanRequiredText(input.customer_support_needed);
  const lateReason = cleanRequiredText(input.late_reason);

  if (!Number.isFinite(laborHours) || laborHours <= 0 || laborHours > 24) {
    return { error: 'labor_hours_invalid' };
  }
  if (!Number.isInteger(progressMediaCount) || progressMediaCount < 1) {
    return { error: 'progress_photo_required' };
  }
  if (!completedWork || !issuesRisks || !nextPlan || !customerSupportNeeded) {
    return { error: 'daily_report_incomplete' };
  }
  if (overdue && !lateReason) return { error: 'late_reason_required' };

  return {
    value: {
      labor_hours: laborHours,
      completed_work: completedWork,
      issues_risks: issuesRisks,
      next_plan: nextPlan,
      customer_support_needed: customerSupportNeeded,
      internal_note: String(input.internal_note || '').trim() || null,
      late_reason: overdue ? lateReason : null,
    },
  };
}

export function fieldDayBlocksFinalReport(status) {
  return FINAL_REPORT_BLOCKING_STATUSES.has(String(status || '').trim());
}

export function countConsumedFieldDays(fieldDays = []) {
  const consumedDates = new Set();
  for (const fieldDay of Array.isArray(fieldDays) ? fieldDays : []) {
    if (!['report_submitted', 'late_report_submitted'].includes(fieldDay?.status)) continue;
    if (!isValidDate(String(fieldDay.site_local_date || '').trim())) continue;
    const checkInAt = new Date(fieldDay.check_in_at);
    if (!fieldDay.check_in_at || !Number.isFinite(checkInAt.getTime())) continue;
    consumedDates.add(fieldDay.site_local_date);
  }
  return consumedDates.size;
}

export function mediaRetentionEligible({ completedAt, now = new Date(), hasOpenHold = false } = {}) {
  if (hasOpenHold || !completedAt) return false;
  const completed = new Date(completedAt);
  const current = new Date(now);
  if (!Number.isFinite(completed.getTime()) || !Number.isFinite(current.getTime())) return false;
  const retentionEnd = new Date(completed);
  retentionEnd.setUTCMonth(retentionEnd.getUTCMonth() + 12);
  return current.getTime() >= retentionEnd.getTime();
}
