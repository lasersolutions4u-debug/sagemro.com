// Reserved internal query marker. User-facing inputs and labels must never render it.
export const DIRECT_ATTRIBUTION_FILTER = '__sagemro_direct__';

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

function channelNumber(row, key) {
  const value = numeric(row?.[key]);
  if (value !== null) return value;
  if (key === 'aiSuccessRate') {
    const requests = numeric(row?.aiRequests);
    const successes = numeric(row?.aiSuccesses);
    return requests && successes !== null ? successes / requests : null;
  }
  if (key === 'sessionToRequestRate') {
    const sessions = numeric(row?.sessions);
    const requests = numeric(row?.serviceRequests);
    return sessions && requests !== null ? requests / sessions : null;
  }
  return null;
}

function channelTieBreak(left, right) {
  return String(left?.source || '').localeCompare(String(right?.source || ''))
    || String(left?.medium || '').localeCompare(String(right?.medium || ''))
    || String(left?.campaign || '').localeCompare(String(right?.campaign || ''));
}

export function sortChannelRows(rows, key = 'serviceRequests', direction = 'desc') {
  const descending = direction !== 'asc';
  const defaultSort = key === 'serviceRequests' && descending;
  return (rows || []).map((row, index) => ({ row, index })).sort((left, right) => {
    if (defaultSort) {
      const defaultDifference = channelNumber(right.row, 'serviceRequests') - channelNumber(left.row, 'serviceRequests')
        || channelNumber(right.row, 'registrations') - channelNumber(left.row, 'registrations')
        || channelNumber(right.row, 'sessions') - channelNumber(left.row, 'sessions');
      return defaultDifference || channelTieBreak(left.row, right.row) || left.index - right.index;
    }
    if (key === 'source' || key === 'campaign') {
      const leftValue = key === 'source'
        ? `${left.row?.source || ''}\u0000${left.row?.medium || ''}`
        : String(left.row?.campaign || '');
      const rightValue = key === 'source'
        ? `${right.row?.source || ''}\u0000${right.row?.medium || ''}`
        : String(right.row?.campaign || '');
      const difference = leftValue.localeCompare(rightValue);
      return (descending ? -difference : difference) || left.index - right.index;
    }
    const leftValue = channelNumber(left.row, key);
    const rightValue = channelNumber(right.row, key);
    if (leftValue === null || rightValue === null) {
      if (leftValue !== rightValue) return leftValue === null ? 1 : -1;
    } else if (leftValue !== rightValue) {
      return descending ? rightValue - leftValue : leftValue - rightValue;
    }
    return channelTieBreak(left.row, right.row) || left.index - right.index;
  }).map(({ row }) => row);
}

export function filterChannelRows(rows, query) {
  const search = String(query || '').trim().toLocaleLowerCase();
  if (!search) return [...(rows || [])];
  return (rows || []).filter((row) => ['source', 'medium', 'campaign'].some((key) => (
    String(row?.[key] || '').toLocaleLowerCase().includes(search)
  )));
}

export function statusTone(level) {
  if (level === 'critical') return 'error';
  if (level === 'warning') return 'warning';
  return 'success';
}
