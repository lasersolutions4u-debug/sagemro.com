export function parseApiDate(value) {
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  return new Date(normalized);
}

export function formatApiDateTime(value, locale, options) {
  if (!value) return '-';
  const date = parseApiDate(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locale, options) : value;
}
