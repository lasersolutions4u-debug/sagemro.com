import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatEngineerOption,
  getQuoteReviewRows,
} from './workOrderDisplay.js';

test('formats engineer option without leaking JSON array strings', () => {
  const label = formatEngineerOption({
    user_no: 'E90002',
    name: 'SAGEMRO Test Engineer',
    service_region: '["North America","Europe"]',
  });

  assert.equal(label, 'E90002 - SAGEMRO Test Engineer / North America, Europe');
});

test('builds quote review rows with fee breakdown and other fee note', () => {
  const rows = getQuoteReviewRows({
    pricing_labor_fee: 1200,
    pricing_parts_fee: 500,
    pricing_travel_fee: 300,
    pricing_other_fee: 80,
    pricing_parts_detail: 'Custom parking fee',
    pricing_subtotal: 2080,
    pricing_total_amount: 2080,
    engineer_commission_rate: 0.8,
    pricing_platform_fee: 416,
  });

  assert.deepEqual(rows, [
    ['Labor', '1,200 CNY'],
    ['Parts', '500 CNY'],
    ['Travel', '300 CNY'],
    ['Other', '80 CNY'],
    ['Other fee note', 'Custom parking fee'],
    ['Engineer settlement', '1,664 CNY'],
    ['Platform portion', '416 CNY'],
  ]);
});
