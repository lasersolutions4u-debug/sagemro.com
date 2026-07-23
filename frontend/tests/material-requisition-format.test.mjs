import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMaterialRequisitionDate } from '../src/components/WorkOrder/materialRequisitionFormat.js';

test('date-only values keep the requested calendar day in English and Chinese', () => {
  const english = formatMaterialRequisitionDate('2026-07-30', false);
  const chinese = formatMaterialRequisitionDate('2026-07-30', true);

  assert.match(english, /Jul 30, 2026/);
  assert.match(chinese, /2026.*7.*30/);
});

test('invalid and empty dates remain safe display values', () => {
  assert.equal(formatMaterialRequisitionDate('', false), '-');
  assert.equal(formatMaterialRequisitionDate('not-a-date', false), 'not-a-date');
});
