export const EMPTY_ENGINEER_PRICING_FORM = {
  labor_fee: '',
  parts_fee: '',
  travel_fee: '',
  other_fee: '',
  other_fee_note: '',
};

export function createEngineerPricingDraft(overrides = {}) {
  return {
    form: { ...EMPTY_ENGINEER_PRICING_FORM, ...(overrides.form || {}) },
    materialItems: Array.isArray(overrides.materialItems) ? overrides.materialItems : [],
  };
}

function normalizePricingNote(value) {
  if (!value || value === '[]') return '';
  if (typeof value !== 'string') return String(value || '');

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => item?.note || item?.description || item?.name || '')
        .filter(Boolean)
        .join('; ');
    }
    return parsed?.note || parsed?.description || '';
  } catch {
    return value;
  }
}

export function createEngineerPricingDraftFromPricing(pricing = {}) {
  return createEngineerPricingDraft({
    form: {
      labor_fee: pricing.labor_fee == null ? '' : String(pricing.labor_fee),
      parts_fee: pricing.parts_fee == null ? '' : String(pricing.parts_fee),
      travel_fee: pricing.travel_fee == null ? '' : String(pricing.travel_fee),
      other_fee: pricing.other_fee == null ? '' : String(pricing.other_fee),
      other_fee_note: normalizePricingNote(pricing.parts_detail),
    },
    materialItems: Array.isArray(pricing.material_items) ? pricing.material_items : [],
  });
}

export function getEngineerPricingTotals({ form = {}, materialItems = [] }) {
  const structuredPartsFee = materialItems.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0
  );
  const partsFee = materialItems.length > 0
    ? Math.round(structuredPartsFee * 100) / 100
    : (parseInt(form.parts_fee, 10) || 0);
  const subtotal = (
    (parseInt(form.labor_fee, 10) || 0) +
    partsFee +
    (parseInt(form.travel_fee, 10) || 0) +
    (parseInt(form.other_fee, 10) || 0)
  );

  return {
    partsFee,
    subtotal,
  };
}
