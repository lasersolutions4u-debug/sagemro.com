import assert from 'node:assert/strict';
import test from 'node:test';

import { validateServiceReportForCompletion } from '../src/lib/service-report-quality.js';

function validRecord(overrides = {}) {
  return {
    symptom: 'The cutting head intermittently loses capacitive height sensing.',
    inspection_process: 'Checked grounding, nozzle alignment, ceramic ring, and sensor calibration.',
    diagnosis: 'The ceramic ring was cracked and caused an unstable sensing signal.',
    solution: 'Replaced the ceramic ring, aligned the nozzle, and recalibrated the height sensor.',
    verification_result: 'Completed ten pierces and cuts without another height-sensing alarm.',
    follow_up_advice: '',
    parts_used: [],
    labor_hours: 1.5,
    ...overrides,
  };
}

test('accepts a complete report with parts as an array and numeric labor text', () => {
  const result = validateServiceReportForCompletion(validRecord({ labor_hours: '1.5' }));

  assert.deepEqual(result, { ok: true, errors: [], qualityStatus: 'complete' });
});

test('accepts parts from the current D1 JSON representation', () => {
  const result = validateServiceReportForCompletion(validRecord({
    parts_used: JSON.stringify([{ name: 'Ceramic ring', qty: 1 }]),
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('returns one required error for each missing completion field', () => {
  const result = validateServiceReportForCompletion(validRecord({
    symptom: '   ',
    inspection_process: null,
    diagnosis: '',
    solution: undefined,
    verification_result: '\t',
  }));

  assert.deepEqual(result, {
    ok: false,
    errors: [
      { field: 'symptom', code: 'required' },
      { field: 'inspection_process', code: 'required' },
      { field: 'diagnosis', code: 'required' },
      { field: 'solution', code: 'required' },
      { field: 'verification_result', code: 'required' },
    ],
    qualityStatus: 'draft',
  });
});

test('does not add too_short when diagnosis or solution is empty', () => {
  const result = validateServiceReportForCompletion(validRecord({
    diagnosis: ' ',
    solution: '',
  }));

  assert.deepEqual(result.errors, [
    { field: 'diagnosis', code: 'required' },
    { field: 'solution', code: 'required' },
  ]);
});

test('requires at least 20 trimmed characters for diagnosis and solution', () => {
  const result = validateServiceReportForCompletion(validRecord({
    diagnosis: '  Too short  ',
    solution: '1234567890123456789',
  }));

  assert.deepEqual(result.errors, [
    { field: 'diagnosis', code: 'too_short' },
    { field: 'solution', code: 'too_short' },
  ]);
  assert.equal(result.qualityStatus, 'draft');
});

test('rejects malformed or non-array parts representations', () => {
  for (const parts_used of ['not-json', '{}', { name: 'Ceramic ring' }, null]) {
    const result = validateServiceReportForCompletion(validRecord({ parts_used }));
    assert.deepEqual(result.errors, [{ field: 'parts_used', code: 'invalid_array' }]);
  }
});

test('rejects labor hours that are non-finite, non-numeric, or negative', () => {
  for (const labor_hours of [
    'unknown',
    Number.POSITIVE_INFINITY,
    -0.5,
    undefined,
    null,
    '',
    '   ',
    false,
    [],
    {},
  ]) {
    const result = validateServiceReportForCompletion(validRecord({ labor_hours }));
    assert.deepEqual(result.errors, [{ field: 'labor_hours', code: 'invalid_number' }]);
  }
});

test('accepts zero and positive labor hours as numbers or non-empty numeric text', () => {
  for (const labor_hours of [0, '0', 1.5]) {
    const result = validateServiceReportForCompletion(validRecord({ labor_hours }));
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  }
});

test('requires follow-up advice only when the caller explicitly marks high risk', () => {
  const ordinary = validateServiceReportForCompletion(validRecord(), { highRisk: false });
  const highRisk = validateServiceReportForCompletion(validRecord(), { highRisk: true });

  assert.equal(ordinary.ok, true);
  assert.deepEqual(highRisk, {
    ok: false,
    errors: [{ field: 'follow_up_advice', code: 'required_for_high_risk' }],
    qualityStatus: 'draft',
  });
});
