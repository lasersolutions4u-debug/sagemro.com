import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEngineerPricingDraft,
  getEngineerPricingTotals,
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

test('calculates customer subtotal and internal settlement estimate from commission rate', () => {
  const totals = getEngineerPricingTotals({
    form: {
      labor_fee: '1000',
      parts_fee: '2000',
      travel_fee: '1000',
      other_fee: '1000',
    },
    commissionRate: 0.8,
  });

  assert.deepEqual(totals, {
    partsFee: 2000,
    subtotal: 5000,
    internalEstimate: 4000,
  });
});
