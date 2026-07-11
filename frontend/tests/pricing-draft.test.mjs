import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEngineerPricingDraft,
  getEngineerPricingTotals,
  createEngineerPricingDraftFromPricing,
} from '../src/components/WorkOrder/pricingDraft.js';

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
  });
  assert.equal(draft.materialItems.length, 1);
});

test('creates editable engineer draft with clean note from stored JSON', () => {
  const draft = createEngineerPricingDraftFromPricing({
    other_fee: 120,
    parts_detail: JSON.stringify([{ note: 'Weekend crane access' }, { description: 'Parking permit' }]),
  });

  assert.equal(draft.form.other_fee, '120');
  assert.equal(draft.form.other_fee_note, 'Weekend crane access; Parking permit');
});
