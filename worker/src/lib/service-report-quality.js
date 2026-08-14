const REQUIRED_TEXT_FIELDS = [
  'symptom',
  'inspection_process',
  'diagnosis',
  'solution',
  'verification_result',
];

const MIN_DETAIL_LENGTH = 20;

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidPartsArray(value) {
  if (Array.isArray(value)) return true;
  if (typeof value !== 'string') return false;

  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

export function parseLaborHours(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim().length === 0) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function validateServiceReportForCompletion(record, options = {}) {
  const report = record && typeof record === 'object' ? record : {};
  const errors = [];

  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!hasText(report[field])) {
      errors.push({ field, code: 'required' });
      continue;
    }

    if (
      (field === 'diagnosis' || field === 'solution')
      && report[field].trim().length < MIN_DETAIL_LENGTH
    ) {
      errors.push({ field, code: 'too_short' });
    }
  }

  if (!isValidPartsArray(report.parts_used)) {
    errors.push({ field: 'parts_used', code: 'invalid_array' });
  }

  if (parseLaborHours(report.labor_hours) === null) {
    errors.push({ field: 'labor_hours', code: 'invalid_number' });
  }

  if (options.highRisk === true && !hasText(report.follow_up_advice)) {
    errors.push({ field: 'follow_up_advice', code: 'required_for_high_risk' });
  }

  return {
    ok: errors.length === 0,
    errors,
    qualityStatus: errors.length === 0 ? 'complete' : 'draft',
  };
}
