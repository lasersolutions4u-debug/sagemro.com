import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPricingPayload,
  createDefaultInstallment,
  createDefaultPricingForm,
  createEngineerPricingDraft,
  getEngineerPricingTotals,
  createEngineerPricingDraftFromPricing,
  isPaymentScheduleValid,
  isPricingFormValid,
  isQuoteTermsValid,
  normalizePricingFormForServiceMode,
  parseCanonicalDecimalInteger,
  scheduleTotals,
} from '../src/components/WorkOrder/pricingDraft.js';

test('parses only canonical unsigned decimal integers within the safe range', () => {
  for (const value of [0, 10, Number.MAX_SAFE_INTEGER, '0', '10', String(Number.MAX_SAFE_INTEGER)]) {
    assert.equal(parseCanonicalDecimalInteger(value), Number(value));
  }

  for (const value of [
    '',
    '00',
    '0010',
    '1e3',
    '10.5',
    '100abc',
    ' 10',
    '10 ',
    '+10',
    '-10',
    -0,
    10.5,
    Number.MAX_SAFE_INTEGER + 1,
    String(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
  ]) {
    assert.equal(parseCanonicalDecimalInteger(value), null, String(value));
  }
});

test('creates the complete quote execution form with string values', () => {
  assert.deepEqual(createDefaultPricingForm(), {
    labor_fee: '',
    parts_fee: '',
    travel_fee: '',
    other_fee: '',
    other_fee_note: '',
    expected_service_days: '',
    payment_plan_mode: 'single',
    payment_schedule: [],
  });
});

test('creates editable installments and calculates their difference from the quote total', () => {
  assert.deepEqual(createDefaultInstallment(2), {
    sequence: 2,
    amount: '',
    trigger_type: 'on_completion',
    due_date: '',
    description: '',
    required_before_start: false,
  });
  assert.deepEqual(scheduleTotals([{ amount: '6000' }, { amount: '4000' }], 10000), {
    scheduled: 10000,
    difference: 0,
  });
  assert.deepEqual(scheduleTotals([
    { amount: '1e3' },
    { amount: '10.5' },
    { amount: '100abc' },
    { amount: String(BigInt(Number.MAX_SAFE_INTEGER) + 1n) },
  ], 10000), {
    scheduled: 0,
    difference: 10000,
  });
});

test('creates a reusable engineer quote draft with other fee note', () => {
  const draft = createEngineerPricingDraft({
    form: {
      labor_fee: '1000',
      other_fee: '300',
      other_fee_note: 'Weekend crane access',
    },
    materialItems: [{ name: 'Lens', quantity: 2, unit_price: 500 }],
  });

  assert.equal(draft.form.labor_fee, '1000');
  assert.equal(draft.form.other_fee_note, 'Weekend crane access');
  assert.equal(draft.materialItems.length, 1);
});

test('calculates quote subtotal without internal settlement estimate', () => {
  const totals = getEngineerPricingTotals({
    form: {
      labor_fee: '1000',
      parts_fee: '2000',
      travel_fee: '1000',
      other_fee: '1000',
    },
  });

  assert.deepEqual(totals, {
    partsFee: 2000,
    subtotal: 5000,
  });
});

test('creates editable engineer draft from returned pricing', () => {
  const draft = createEngineerPricingDraftFromPricing({
    labor_fee: 1500,
    parts_fee: 2000,
    travel_fee: 1000,
    other_fee: 1000,
    parts_detail: '1 2 3',
    material_items: [{ name: 'Nozzle', quantity: 1, unit_price: 1000 }],
  });

  assert.deepEqual(draft.form, {
    labor_fee: '1500',
    parts_fee: '2000',
    travel_fee: '1000',
    other_fee: '1000',
    other_fee_note: '1 2 3',
    expected_service_days: '',
    payment_plan_mode: 'single',
    payment_schedule: [],
  });
  assert.equal(draft.materialItems.length, 1);
});

test('hydrates quote execution fields as editable string values', () => {
  const draft = createEngineerPricingDraftFromPricing({
    expected_service_days: 4,
    payment_plan_mode: 'installments',
    payment_schedule: [
      {
        sequence: 3,
        amount: 6000,
        currency: 'USD',
        trigger_type: 'before_start',
        due_date: null,
        description: 'Deposit',
        required_before_start: 1,
      },
      {
        sequence: 7,
        amount: 4000,
        currency: 'USD',
        trigger_type: 'fixed_date',
        due_date: '2026-08-15',
        description: 'Balance',
        required_before_start: 0,
      },
    ],
  });

  assert.equal(draft.form.expected_service_days, '4');
  assert.equal(draft.form.payment_plan_mode, 'installments');
  assert.deepEqual(draft.form.payment_schedule.map((row) => ({
    ...row,
  })), [
    {
      sequence: 3,
      amount: '6000',
      currency: 'USD',
      trigger_type: 'before_start',
      due_date: '',
      description: 'Deposit',
      required_before_start: true,
    },
    {
      sequence: 7,
      amount: '4000',
      currency: 'USD',
      trigger_type: 'fixed_date',
      due_date: '2026-08-15',
      description: 'Balance',
      required_before_start: false,
    },
  ]);
});

test('remote mode clears expected onsite workdays', () => {
  const form = normalizePricingFormForServiceMode({
    ...createDefaultPricingForm(),
    expected_service_days: '5',
  }, 'remote');

  assert.equal(form.expected_service_days, '');
  assert.equal(normalizePricingFormForServiceMode(form, 'onsite'), form);
});

test('builds integer payloads and defaults single payment to 100 percent before start', () => {
  assert.deepEqual(buildPricingPayload({
    form: {
      ...createDefaultPricingForm(),
      labor_fee: '6000',
      parts_fee: '2500',
      travel_fee: '1000',
      other_fee: '500',
      other_fee_note: 'Weekend access',
      expected_service_days: '3',
    },
    partsFee: 2500,
    materialItems: [],
    engineerId: 'engineer-1',
    serviceMode: 'onsite',
    currency: 'USD',
  }), {
    labor_fee: 6000,
    parts_fee: 2500,
    travel_fee: 1000,
    other_fee: 500,
    parts_detail: 'Weekend access',
    material_items: [],
    engineer_id: 'engineer-1',
    expected_service_days: 3,
    payment_plan_mode: 'single',
    payment_schedule: [{
      sequence: 1,
      amount: 10000,
      currency: 'USD',
      trigger_type: 'before_start',
      due_date: null,
      description: '',
      required_before_start: true,
    }],
  });
});

test('builds normalized integer installment payloads and clears remote days', () => {
  const payload = buildPricingPayload({
    form: {
      ...createDefaultPricingForm(),
      labor_fee: '10000',
      expected_service_days: '9',
      payment_plan_mode: 'installments',
      payment_schedule: [
        { ...createDefaultInstallment(1), amount: '6000', description: 'Deposit' },
        {
          ...createDefaultInstallment(2),
          amount: '4000',
          trigger_type: 'fixed_date',
          due_date: '2026-08-15',
          description: 'Balance',
        },
      ],
    },
    partsFee: 0,
    materialItems: [],
    engineerId: 'engineer-1',
    serviceMode: 'remote',
    currency: 'USD',
  });

  assert.equal(payload.expected_service_days, null);
  assert.deepEqual(payload.payment_schedule.map((row) => row.amount), [6000, 4000]);
  assert.deepEqual(payload.payment_schedule.map((row) => row.sequence), [1, 2]);
  assert.equal(payload.payment_schedule[1].due_date, '2026-08-15');
});

test('refuses malformed quote integers when building payloads', () => {
  const base = {
    ...createDefaultPricingForm(),
    labor_fee: '10000',
    expected_service_days: '3',
  };
  const options = {
    partsFee: 0,
    materialItems: [],
    engineerId: 'engineer-1',
    serviceMode: 'onsite',
    currency: 'USD',
  };

  for (const value of ['1e3', '10.5', '100abc', '0010', String(BigInt(Number.MAX_SAFE_INTEGER) + 1n)]) {
    for (const key of ['labor_fee', 'travel_fee', 'other_fee']) {
      assert.equal(buildPricingPayload({ form: { ...base, [key]: value }, ...options }), null, `${key}: ${value}`);
    }
    assert.equal(buildPricingPayload({ form: base, ...options, partsFee: value }), null, `parts_fee: ${value}`);
    assert.equal(buildPricingPayload({ form: { ...base, expected_service_days: value }, ...options }), null, value);
    assert.equal(buildPricingPayload({
      form: {
        ...base,
        payment_plan_mode: 'installments',
        payment_schedule: [
          { ...createDefaultInstallment(1), amount: value },
          { ...createDefaultInstallment(2), amount: '10000' },
        ],
      },
      ...options,
    }), null, `schedule: ${value}`);
  }
});

test('validates onsite days and installment schedule invariants before submission', () => {
  const form = {
    ...createDefaultPricingForm(),
    labor_fee: '10000',
    expected_service_days: '3',
    payment_plan_mode: 'installments',
    payment_schedule: [
      { ...createDefaultInstallment(1), amount: '6000' },
      { ...createDefaultInstallment(2), amount: '4000' },
    ],
  };

  assert.equal(isPricingFormValid({ form, totalAmount: 10000, serviceMode: 'onsite', currency: 'USD' }), true);
  for (const value of ['1e3', '10.5', '100abc', '0010', String(BigInt(Number.MAX_SAFE_INTEGER) + 1n)]) {
    for (const key of ['labor_fee', 'parts_fee', 'travel_fee', 'other_fee']) {
      assert.equal(isPricingFormValid({
        form: { ...form, [key]: value },
        totalAmount: 10000,
        serviceMode: 'onsite',
        currency: 'USD',
      }), false, `${key}: ${value}`);
    }
    assert.equal(isPricingFormValid({
      form: { ...form, expected_service_days: value },
      totalAmount: 10000,
      serviceMode: 'onsite',
      currency: 'USD',
    }), false, value);
    assert.equal(isPricingFormValid({
      form: {
        ...form,
        payment_schedule: [{ ...form.payment_schedule[0], amount: value }, form.payment_schedule[1]],
      },
      totalAmount: 10000,
      serviceMode: 'onsite',
      currency: 'USD',
    }), false, `schedule: ${value}`);
  }
  assert.equal(isPricingFormValid({
    form: { ...form, expected_service_days: '' },
    totalAmount: 10000,
    serviceMode: 'onsite',
    currency: 'USD',
  }), false);
  assert.equal(isPricingFormValid({
    form: { ...form, payment_schedule: [{ ...form.payment_schedule[0], amount: '5999' }, form.payment_schedule[1]] },
    totalAmount: 10000,
    serviceMode: 'onsite',
    currency: 'USD',
  }), false);
  assert.equal(isPricingFormValid({
    form: { ...form, payment_schedule: form.payment_schedule.map((row) => ({ ...row, required_before_start: false })) },
    totalAmount: 10000,
    serviceMode: 'onsite',
    currency: 'USD',
  }), false);
});

test('requires milestone descriptions and valid fixed dates', () => {
  const baseForm = {
    ...createDefaultPricingForm(),
    labor_fee: '10000',
    payment_plan_mode: 'installments',
    payment_schedule: [
      { ...createDefaultInstallment(1), amount: '6000' },
      { ...createDefaultInstallment(2), amount: '4000' },
    ],
  };

  assert.equal(isPricingFormValid({
    form: {
      ...baseForm,
      payment_schedule: [baseForm.payment_schedule[0], {
        ...baseForm.payment_schedule[1],
        trigger_type: 'milestone',
      }],
    },
    totalAmount: 10000,
    serviceMode: 'remote',
    currency: 'USD',
  }), false);
  assert.equal(isPricingFormValid({
    form: {
      ...baseForm,
      payment_schedule: [baseForm.payment_schedule[0], {
        ...baseForm.payment_schedule[1],
        trigger_type: 'fixed_date',
        due_date: '2026-02-30',
      }],
    },
    totalAmount: 10000,
    serviceMode: 'remote',
    currency: 'USD',
  }), false);
});

test('strictly validates the complete single-payment terms returned by the API', () => {
  const valid = {
    paymentPlanMode: 'single',
    totalAmount: 10000,
    currency: 'USD',
    schedule: [{
      sequence: 1,
      amount: 10000,
      currency: 'USD',
      trigger_type: 'before_start',
      due_date: null,
      description: '',
      required_before_start: true,
    }],
  };

  assert.equal(isPaymentScheduleValid(valid), true);
  for (const patch of [
    { sequence: 2 },
    { amount: 9999 },
    { amount: '10000' },
    { currency: 'CNY' },
    { trigger_type: 'on_completion' },
    { due_date: '' },
    { description: null },
    { required_before_start: false },
  ]) {
    assert.equal(isPaymentScheduleValid({
      ...valid,
      schedule: [{ ...valid.schedule[0], ...patch }],
    }), false);
  }
  assert.equal(isPaymentScheduleValid({ ...valid, schedule: [] }), false);
  assert.equal(isPaymentScheduleValid({ ...valid, schedule: [...valid.schedule, valid.schedule[0]] }), false);
});

test('quote terms normalize canonical server integers and reject malformed or unsafe values', () => {
  const pricing = {
    quote_version: 2,
    total_amount: 10000,
    expected_service_days: 3,
    payment_plan_mode: 'single',
    payment_schedule: [{
      sequence: 1,
      amount: 10000,
      currency: 'USD',
      trigger_type: 'before_start',
      due_date: null,
      description: '',
      required_before_start: true,
    }],
  };

  assert.equal(isQuoteTermsValid({ pricing, serviceMode: 'onsite', currency: 'USD' }), true);
  assert.equal(isQuoteTermsValid({
    pricing: { ...pricing, total_amount: '10000' },
    serviceMode: 'onsite',
    currency: 'USD',
  }), true);
  assert.equal(isQuoteTermsValid({
    pricing: { ...pricing, expected_service_days: '3' },
    serviceMode: 'onsite',
    currency: 'USD',
  }), true);
  for (const value of ['1e3', '10.5', '100abc', '0010', String(BigInt(Number.MAX_SAFE_INTEGER) + 1n)]) {
    assert.equal(isQuoteTermsValid({
      pricing: { ...pricing, total_amount: value },
      serviceMode: 'onsite',
      currency: 'USD',
    }), false, value);
    assert.equal(isQuoteTermsValid({
      pricing: { ...pricing, expected_service_days: value },
      serviceMode: 'onsite',
      currency: 'USD',
    }), false, value);
    assert.equal(isQuoteTermsValid({
      pricing: {
        ...pricing,
        payment_schedule: [{ ...pricing.payment_schedule[0], amount: value }],
      },
      serviceMode: 'onsite',
      currency: 'USD',
    }), false, value);
  }
});

test('remote quote terms require expected service days to be cleared', () => {
  const pricing = {
    quote_version: 2,
    total_amount: 10000,
    payment_plan_mode: 'single',
    payment_schedule: [{
      sequence: 1,
      amount: 10000,
      currency: 'USD',
      trigger_type: 'before_start',
      due_date: null,
      description: '',
      required_before_start: true,
    }],
  };

  assert.equal(isQuoteTermsValid({ pricing, serviceMode: 'remote', currency: 'USD' }), true);
  assert.equal(isQuoteTermsValid({
    pricing: { ...pricing, expected_service_days: null },
    serviceMode: 'remote',
    currency: 'USD',
  }), true);
  for (const value of [3, '3', '', '1e3', 'onsite']) {
    assert.equal(isQuoteTermsValid({
      pricing: { ...pricing, expected_service_days: value },
      serviceMode: 'remote',
      currency: 'USD',
    }), false, String(value));
  }
});

test('strictly validates installment trigger currency and contiguous sequence terms', () => {
  const valid = {
    paymentPlanMode: 'installments',
    totalAmount: 10000,
    currency: 'USD',
    schedule: [
      {
        sequence: 1,
        amount: 6000,
        currency: 'USD',
        trigger_type: 'before_start',
        due_date: null,
        description: 'Deposit',
        required_before_start: true,
      },
      {
        sequence: 2,
        amount: 4000,
        currency: 'USD',
        trigger_type: 'on_completion',
        due_date: null,
        description: 'Balance',
        required_before_start: false,
      },
    ],
  };

  assert.equal(isPaymentScheduleValid(valid), true);
  assert.equal(isPaymentScheduleValid({
    ...valid,
    schedule: [valid.schedule[0], { ...valid.schedule[1], trigger_type: 'after_lunch' }],
  }), false);
  assert.equal(isPaymentScheduleValid({
    ...valid,
    schedule: [valid.schedule[0], { ...valid.schedule[1], currency: 'CNY' }],
  }), false);
  assert.equal(isPaymentScheduleValid({
    ...valid,
    schedule: [valid.schedule[0], { ...valid.schedule[1], sequence: 3 }],
  }), false);
  assert.equal(isPaymentScheduleValid({
    ...valid,
    schedule: [valid.schedule[0], { ...valid.schedule[1], sequence: 1 }],
  }), false);
});

test('creates editable engineer draft with clean note from stored JSON', () => {
  const draft = createEngineerPricingDraftFromPricing({
    other_fee: 120,
    parts_detail: JSON.stringify([{ note: 'Weekend crane access' }, { description: 'Parking permit' }]),
  });

  assert.equal(draft.form.other_fee, '120');
  assert.equal(draft.form.other_fee_note, 'Weekend crane access; Parking permit');
});
