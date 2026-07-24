import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPricingPayload,
  createDefaultInstallment,
  createDefaultPricingForm,
  createEngineerPricingDraft,
  getEngineerPricingTotals,
  createEngineerPricingDraftFromPricing,
  isPricingFormValid,
  normalizePricingFormForServiceMode,
  scheduleTotals,
} from '../src/components/WorkOrder/pricingDraft.js';

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
        sequence: 1,
        amount: 6000,
        trigger_type: 'before_start',
        due_date: null,
        description: 'Deposit',
        required_before_start: 1,
      },
      {
        sequence: 2,
        amount: 4000,
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
      sequence: 1,
      amount: '6000',
      trigger_type: 'before_start',
      due_date: '',
      description: 'Deposit',
      required_before_start: true,
    },
    {
      sequence: 2,
      amount: '4000',
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

  assert.equal(isPricingFormValid({ form, totalAmount: 10000, serviceMode: 'onsite' }), true);
  assert.equal(isPricingFormValid({
    form: { ...form, expected_service_days: '' },
    totalAmount: 10000,
    serviceMode: 'onsite',
  }), false);
  assert.equal(isPricingFormValid({
    form: { ...form, payment_schedule: [{ ...form.payment_schedule[0], amount: '5999' }, form.payment_schedule[1]] },
    totalAmount: 10000,
    serviceMode: 'onsite',
  }), false);
  assert.equal(isPricingFormValid({
    form: { ...form, payment_schedule: form.payment_schedule.map((row) => ({ ...row, required_before_start: false })) },
    totalAmount: 10000,
    serviceMode: 'onsite',
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
