export function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function parseJsonValue(value) {
  if (!value || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function humanizeKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatEnumLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return /^[a-z][a-z0-9_ -]*$/.test(text) ? humanizeKey(text) : text;
}

function formatDisplayValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatDisplayValue(item))
      .filter(Boolean)
      .join(', ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${humanizeKey(key)}: ${formatDisplayValue(item)}`)
      .filter(Boolean)
      .join('; ');
  }
  return value == null ? '' : formatEnumLabel(value);
}

export function formatAiSummary(value) {
  const parsed = parseJsonValue(value);
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed;
  if (Array.isArray(parsed)) return formatDisplayValue(parsed);

  return Object.entries(parsed)
    .map(([key, item]) => {
      const displayValue = formatDisplayValue(item);
      return displayValue ? `${humanizeKey(key)}: ${displayValue}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

export function formatListValue(value) {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (typeof item === 'string') return formatEnumLabel(item);
        return formatEnumLabel(item?.name || item?.label || item?.description || '');
      })
      .filter(Boolean)
      .join(', ');
  }
  return typeof parsed === 'string' ? formatEnumLabel(parsed) : '';
}

export function formatQuoteNote(value) {
  if (!value || value === '[]') return '';
  const parsed = parseJsonValue(value);
  if (typeof parsed === 'string') return parsed;
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => item.note || item.description || item.name || '')
      .filter(Boolean)
      .join('; ');
  }
  return parsed?.note || parsed?.description || '';
}

export function formatEngineerOption(engineer) {
  if (!engineer) return '';
  const prefix = engineer.user_no ? `${engineer.user_no} - ` : '';
  const region = formatListValue(engineer.service_region || engineer.responsible_region);
  return `${prefix}${engineer.name || ''}${region ? ` / ${region}` : ''}`;
}

export function getQuoteReviewRows(wo) {
  const subtotal = Number(wo.pricing_total_amount || wo.pricing_subtotal || 0);
  const rows = [
    ['Labor', `${money(wo.pricing_labor_fee)} USD`],
    ['Parts', `${money(wo.pricing_parts_fee)} USD`],
    ['Travel', `${money(wo.pricing_travel_fee)} USD`],
    ['Other', `${money(wo.pricing_other_fee)} USD`],
  ];
  const note = formatQuoteNote(wo.pricing_parts_detail);
  if (note) rows.push(['Other fee note', note]);
  rows.push(['Quote subtotal price', `${money(subtotal)} USD`]);
  return rows;
}
