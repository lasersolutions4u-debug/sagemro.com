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

export function formatListValue(value) {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.name || item?.label || item?.description || '';
      })
      .filter(Boolean)
      .join(', ');
  }
  return typeof parsed === 'string' ? parsed : '';
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
  const platformFee = Number(wo.pricing_platform_fee || 0);
  const commissionRate = Number(wo.engineer_commission_rate || 0);
  const engineerSettlement = platformFee > 0
    ? subtotal - platformFee
    : commissionRate > 0
      ? subtotal * commissionRate
      : 0;
  const rows = [
    ['Labor', `${money(wo.pricing_labor_fee)} CNY`],
    ['Parts', `${money(wo.pricing_parts_fee)} CNY`],
    ['Travel', `${money(wo.pricing_travel_fee)} CNY`],
    ['Other', `${money(wo.pricing_other_fee)} CNY`],
  ];
  const note = formatQuoteNote(wo.pricing_parts_detail);
  if (note) rows.push(['Other fee note', note]);
  if (engineerSettlement > 0) {
    rows.push(['Engineer settlement', `${money(engineerSettlement)} CNY`]);
  }
  if (platformFee > 0) {
    rows.push(['Platform portion', `${money(platformFee)} CNY`]);
  }
  return rows;
}
