export function createDefaultPricingForm() {
  return {
    labor_fee: '',
    parts_fee: '',
    travel_fee: '',
    other_fee: '',
    other_fee_note: '',
    expected_service_days: '',
    payment_plan_mode: 'single',
    payment_schedule: [],
  };
}

export const EMPTY_ENGINEER_PRICING_FORM = createDefaultPricingForm();

export function createDefaultInstallment(sequence) {
  return {
    sequence,
    amount: '',
    trigger_type: sequence === 1 ? 'before_start' : 'on_completion',
    due_date: '',
    description: '',
    required_before_start: sequence === 1,
  };
}

function hydrateInstallment(row = {}, index) {
  return {
    sequence: row.sequence == null ? index + 1 : row.sequence,
    amount: row.amount == null ? '' : String(row.amount),
    currency: row.currency || '',
    trigger_type: row.trigger_type || (index === 0 ? 'before_start' : 'on_completion'),
    due_date: row.due_date || '',
    description: row.description || '',
    required_before_start: Boolean(row.required_before_start),
  };
}

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
      expected_service_days: pricing.expected_service_days == null
        ? ''
        : String(pricing.expected_service_days),
      payment_plan_mode: pricing.payment_plan_mode === 'installments' ? 'installments' : 'single',
      payment_schedule: Array.isArray(pricing.payment_schedule)
        ? pricing.payment_schedule.map(hydrateInstallment)
        : [],
    },
    materialItems: Array.isArray(pricing.material_items) ? pricing.material_items : [],
  });
}

export function scheduleTotals(schedule = [], totalAmount = 0) {
  const scheduled = schedule.reduce((sum, row) => sum + (parseInt(row.amount, 10) || 0), 0);
  return {
    scheduled,
    difference: Number(totalAmount || 0) - scheduled,
  };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const PAYMENT_TRIGGER_TYPES = new Set([
  'before_start',
  'on_arrival',
  'milestone',
  'on_completion',
  'on_acceptance',
  'fixed_date',
]);

function isExpectedServiceDaysValid(value, serviceMode) {
  if (!['onsite', 'hybrid'].includes(serviceMode)) return true;
  const expectedDays = Number(value);
  return Number.isInteger(expectedDays) && expectedDays > 0;
}

export function isPaymentScheduleValid({ schedule, paymentPlanMode, totalAmount, currency }) {
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 1) return false;
  if (!Array.isArray(schedule)) return false;
  if (paymentPlanMode === 'single') {
    if (schedule.length !== 1) return false;
    const [row] = schedule;
    return row !== null
      && typeof row === 'object'
      && !Array.isArray(row)
      && row.sequence === 1
      && row.amount === totalAmount
      && row.currency === currency
      && row.trigger_type === 'before_start'
      && row.due_date === null
      && typeof row.description === 'string'
      && row.required_before_start === true;
  }
  if (paymentPlanMode !== 'installments' || schedule.length < 2 || schedule.length > 6) return false;
  if (schedule.some((row) => row === null || typeof row !== 'object' || Array.isArray(row))) {
    return false;
  }
  if (schedule.some((row, index) => row.sequence !== index + 1)) return false;
  if (schedule.some((row) => row.currency !== currency)) return false;
  if (schedule.some((row) => !PAYMENT_TRIGGER_TYPES.has(row.trigger_type))) return false;
  if (schedule.some((row) => !Number.isSafeInteger(row.amount) || row.amount < 1)) return false;
  if (schedule.some((row) => typeof row.description !== 'string')) return false;
  if (schedule.some((row) => typeof row.required_before_start !== 'boolean')) return false;
  if (schedule.some((row) => row.trigger_type === 'milestone' && !String(row.description || '').trim())) {
    return false;
  }
  if (schedule.some((row) => row.trigger_type === 'fixed_date' && !isValidDate(row.due_date))) {
    return false;
  }
  if (schedule.some((row) => row.trigger_type !== 'fixed_date' && row.due_date !== null)) return false;
  if (!schedule.some((row) => row.required_before_start)) return false;
  let scheduled = 0;
  for (const row of schedule) {
    scheduled += row.amount;
    if (!Number.isSafeInteger(scheduled)) return false;
  }
  return scheduled === totalAmount;
}

function buildFormPaymentSchedule(form, totalAmount, currency) {
  if (form.payment_plan_mode !== 'installments') {
    return [{
      sequence: 1,
      amount: totalAmount,
      currency,
      trigger_type: 'before_start',
      due_date: null,
      description: '',
      required_before_start: true,
    }];
  }
  return form.payment_schedule.map((row, index) => ({
    sequence: index + 1,
    amount: Number(row.amount),
    currency,
    trigger_type: row.trigger_type,
    due_date: row.trigger_type === 'fixed_date' ? row.due_date || null : null,
    description: String(row.description || '').trim(),
    required_before_start: Boolean(row.required_before_start),
  }));
}

export function isPricingFormValid({ form, totalAmount, serviceMode, currency }) {
  if (!isExpectedServiceDaysValid(form.expected_service_days, serviceMode)) return false;
  return isPaymentScheduleValid({
    schedule: buildFormPaymentSchedule(form, totalAmount, currency),
    paymentPlanMode: form.payment_plan_mode,
    totalAmount,
    currency,
  });
}

export function isQuoteTermsValid({ pricing, serviceMode, currency }) {
  const totalAmount = pricing?.total_amount ?? pricing?.subtotal;
  return Number.isInteger(Number(pricing?.quote_version))
    && Number(pricing.quote_version) > 0
    && Number.isSafeInteger(totalAmount)
    && totalAmount > 0
    && (
      !['onsite', 'hybrid'].includes(serviceMode)
      || (Number.isInteger(pricing.expected_service_days) && pricing.expected_service_days > 0)
    )
    && isPaymentScheduleValid({
      schedule: pricing.payment_schedule,
      paymentPlanMode: pricing.payment_plan_mode,
      totalAmount,
      currency,
    });
}

export function normalizePricingFormForServiceMode(form, serviceMode) {
  if (serviceMode !== 'remote' || !form.expected_service_days) return form;
  return { ...form, expected_service_days: '' };
}

function integerValue(value) {
  return parseInt(value, 10) || 0;
}

export function buildPricingPayload({
  form,
  partsFee,
  materialItems,
  engineerId,
  serviceMode,
  currency,
}) {
  const laborFee = integerValue(form.labor_fee);
  const normalizedPartsFee = integerValue(partsFee);
  const travelFee = integerValue(form.travel_fee);
  const otherFee = integerValue(form.other_fee);
  const totalAmount = laborFee + normalizedPartsFee + travelFee + otherFee;
  const paymentPlanMode = form.payment_plan_mode === 'installments' ? 'installments' : 'single';
  const paymentSchedule = buildFormPaymentSchedule(form, totalAmount, currency)
    .map((row) => ({ ...row, amount: integerValue(row.amount) }));

  return {
    labor_fee: laborFee,
    parts_fee: normalizedPartsFee,
    travel_fee: travelFee,
    other_fee: otherFee,
    parts_detail: form.other_fee_note,
    material_items: materialItems,
    engineer_id: engineerId,
    expected_service_days: serviceMode === 'remote'
      ? null
      : integerValue(form.expected_service_days),
    payment_plan_mode: paymentPlanMode,
    payment_schedule: paymentSchedule,
  };
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
