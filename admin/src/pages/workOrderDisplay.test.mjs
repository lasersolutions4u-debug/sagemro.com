import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  formatAiSummary,
  formatEngineerOption,
  formatListValue,
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

test('formats engineer profile list and enum values for display', () => {
  assert.equal(
    formatListValue('["North America","Europe","Asia Pacific"]'),
    'North America, Europe, Asia Pacific',
  );
  assert.equal(
    formatListValue(['laser_cutting', 'press_brake']),
    'Laser cutting, Press brake',
  );
  assert.equal(
    formatListValue(['diagnosis', 'maintenance', 'onsite_service']),
    'Diagnosis, Maintenance, Onsite service',
  );
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
  });

  assert.deepEqual(rows, [
    ['Labor', '1,200 USD'],
    ['Parts', '500 USD'],
    ['Travel', '300 USD'],
    ['Other', '80 USD'],
    ['Other fee note', 'Custom parking fee'],
    ['Quote subtotal price', '2,080 USD'],
  ]);
});

test('formats AI summary JSON into readable review notes', () => {
  const formatted = formatAiSummary(JSON.stringify({
    summary: 'Z axis calibration failed.',
    required_specialties: ['laser cutting', 'servo diagnostics'],
    urgency_notes: 'Production is stopped.',
  }));

  assert.match(formatted, /Summary: Z axis calibration failed\./);
  assert.match(formatted, /Required specialties: Laser cutting, Servo diagnostics/);
  assert.match(formatted, /Urgency notes: Production is stopped\./);
  assert.equal(formatted.includes('{'), false);
  assert.equal(formatted.includes('required_specialties'), false);
});

test('work order quote display uses USD without internal settlement split', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.equal(source.includes(' CNY'), false);
  assert.equal(source.includes('internalSettlement'), false);
  assert.equal(source.includes('platformPart'), false);
  assert.match(source, /Quote subtotal price/);
  assert.match(source, /USD/);
});
