function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function formatMetric(value, kind = 'number', locale = 'en') {
  const number = numeric(value);
  if (number === null) return '—';
  if (kind === 'percent') return `${(number * 100).toFixed(1)}%`;
  return new Intl.NumberFormat(locale).format(number);
}

export function formatChange(value, kind = 'number', locale = 'en') {
  const number = numeric(value);
  if (number === null) return '—';
  const sign = number > 0 ? '+' : number < 0 ? '−' : '';
  return `${sign}${formatMetric(Math.abs(number), kind, locale)}`;
}

export function buildLinePoints(values, width, height) {
  const safeValues = (values || []).map((value) => Math.max(0, numeric(value) ?? 0));
  if (!safeValues.length) return [];
  const max = Math.max(...safeValues, 0);
  const horizontal = safeValues.length === 1 ? 0 : width / (safeValues.length - 1);
  return safeValues.map((value, index) => {
    const x = Math.round(index * horizontal * 100) / 100;
    const y = max > 0 ? Math.round((height - ((value / max) * height)) * 100) / 100 : height;
    return `${x},${y}`;
  });
}

export function statusTone(level) {
  if (level === 'critical') return 'error';
  if (level === 'warning') return 'warning';
  return 'success';
}
