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

export function getEngineerPricingTotals({ form = {}, materialItems = [], commissionRate = 0.8 }) {
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
    internalEstimate: Math.round(subtotal * commissionRate),
  };
}
