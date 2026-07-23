const SAFE_AUDIT_FIELDS = new Set([
  'status',
  'site_timezone',
  'expected_service_days',
  'expected_completion_date',
  'planned_daily_start_time',
  'planned_daily_end_time',
  'requested_additional_days',
  'proposed_completion_date',
  'labor_hours',
  'site_local_date',
  'location_status',
  'capture_source',
  'reason_category',
]);

export function safeAuditEntries(value) {
  if (!value) return [];
  let state = value;
  if (typeof value === 'string') {
    try {
      state = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
  return Object.entries(state)
    .filter(([key, item]) => SAFE_AUDIT_FIELDS.has(key) && (item == null || ['string', 'number', 'boolean'].includes(typeof item)))
    .map(([key, item]) => [key, item == null ? '-' : String(item)]);
}
