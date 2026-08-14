import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  mapServiceReportErrors,
  submitFinalServiceReport,
  validateServiceReportForCompletion,
} from '../src/components/WorkOrder/repairRecordValidation.js';

const root = path.resolve(import.meta.dirname, '../..');
const panel = readFileSync(
  path.join(root, 'frontend/src/components/WorkOrder/RepairRecordPanel.jsx'),
  'utf8',
);
const validationSource = readFileSync(
  path.join(root, 'frontend/src/components/WorkOrder/repairRecordValidation.js'),
  'utf8',
);
const api = readFileSync(path.join(root, 'frontend/src/services/api.js'), 'utf8');

test('service report captures and persists the complete technical record', () => {
  for (const field of ['inspection_process', 'verification_result', 'follow_up_advice']) {
    assert.match(panel, new RegExp(field));
  }

  assert.match(panel, /setInspectionProcess\(repairRecord\.inspection_process \|\| ''\)/);
  assert.match(panel, /setVerificationResult\(repairRecord\.verification_result \|\| ''\)/);
  assert.match(panel, /setFollowUpAdvice\(repairRecord\.follow_up_advice \|\| ''\)/);
  assert.match(panel, /inspection_process: inspectionProcess\.trim\(\) \|\| null/);
  assert.match(panel, /verification_result: verificationResult\.trim\(\) \|\| null/);
  assert.match(panel, /follow_up_advice: followUpAdvice\.trim\(\) \|\| null/);
});

test('service report uses the agreed technical sequence in view and edit modes', () => {
  const viewStart = panel.indexOf('if (!isEditing)');
  const editStart = panel.indexOf('// ======', viewStart + 1);
  const view = panel.slice(viewStart, editStart);
  const edit = panel.slice(editStart);

  const sequence = [
    'copy.symptom',
    'copy.inspectionProcess',
    'copy.diagnosis',
    'copy.solution',
    'copy.materialItems',
    'copy.partsUsed',
    'copy.labor',
    'copy.verificationResult',
    'copy.followUpAdvice',
  ];

  for (const source of [view, edit]) {
    let previous = -1;
    for (const token of sequence) {
      const current = source.indexOf(token);
      assert.ok(current > previous, `${token} must follow the preceding report field`);
      previous = current;
    }
  }
});

test('service report exposes professional English and Chinese labels and errors', () => {
  for (const copy of [
    'Inspection Process',
    'Verification Result',
    'Follow-up Advice (Optional)',
    'Complete the required fields before final submission.',
    '检查过程',
    '验证结果',
    '后续建议（选填）',
    '请先完成必填项，再提交最终报告。',
  ]) {
    assert.ok(panel.includes(copy), `missing bilingual copy: ${copy}`);
  }

  for (const copy of [
    'Please enter at least 20 characters.',
    'Enter a finite number of hours, 0 or greater.',
    '请至少填写 20 个字符。',
    '请输入大于或等于 0 的有效工时。',
  ]) {
    assert.ok(validationSource.includes(copy), `missing bilingual validation copy: ${copy}`);
  }
});

test('final report validation matches backend rules without blocking draft saves', () => {
  const complete = {
    symptom: 'Height sensing alarm during piercing.',
    inspection_process: 'Checked nozzle alignment, grounding, and sensor calibration.',
    diagnosis: 'The ceramic ring was cracked and caused an unstable sensor signal.',
    solution: 'Replaced the ceramic ring and recalibrated the height sensing system.',
    verification_result: 'Completed ten pierces without another alarm.',
    follow_up_advice: '',
    parts_used: [],
    labor_hours: 1.5,
  };

  assert.deepEqual(validateServiceReportForCompletion(complete), { ok: true, errors: [] });
  assert.deepEqual(validateServiceReportForCompletion({
    symptom: '',
    inspection_process: '',
    diagnosis: '',
    solution: '',
    verification_result: '',
    parts_used: [],
    labor_hours: 0,
  }).errors, [
    { field: 'symptom', code: 'required' },
    { field: 'inspection_process', code: 'required' },
    { field: 'diagnosis', code: 'required' },
    { field: 'solution', code: 'required' },
    { field: 'verification_result', code: 'required' },
  ]);
  assert.deepEqual(validateServiceReportForCompletion({ ...complete, labor_hours: Infinity }).errors, [
    { field: 'labor_hours', code: 'invalid_number' },
  ]);
  assert.deepEqual(validateServiceReportForCompletion({ ...complete, labor_hours: null }).errors, [
    { field: 'labor_hours', code: 'invalid_number' },
  ]);
  assert.deepEqual(validateServiceReportForCompletion({ ...complete, diagnosis: 'Too short' }).errors, [
    { field: 'diagnosis', code: 'too_short' },
  ]);
  assert.deepEqual(validateServiceReportForCompletion(complete, { highRisk: true }).errors, []);
  assert.match(panel, /onClick=\{\(\) => handleSave\(\)\}/);
  assert.match(panel, /const handleSubmitFinal = async \(\) =>/);
  assert.match(panel, /await submitFinalServiceReport\(\{/);
  assert.match(panel, /confirm: \(\) => onConfirmComplete\?\.\(\) \?\? false/);
});

test('field errors are inline and backend structured errors are preserved', () => {
  assert.deepEqual(mapServiceReportErrors([
    { field: 'diagnosis', code: 'too_short' },
    { field: 'labor_hours', code: 'invalid_number' },
  ]), {
    diagnosis: 'Please enter at least 20 characters.',
    labor_hours: 'Enter a finite number of hours, 0 or greater.',
  });
  assert.deepEqual(mapServiceReportErrors([
    { field: 'verification_result', code: 'required' },
  ], true), {
    verification_result: '最终提交前必须填写此项。',
  });
  assert.deepEqual(mapServiceReportErrors([
    { field: 'symptom', code: 'future_rule' },
  ]), {
    symptom: 'Please review this field and enter a valid value.',
  });
  assert.match(panel, /e\?\.code === 'service_report_incomplete'/);
  assert.match(panel, /setFieldErrors\(mapServiceReportErrors\(e\.fields, isCn\)\)/);
  assert.match(panel, /role="alert"/);

  assert.match(api, /error\.code = d\.error/);
  assert.match(api, /error\.fields = Array\.isArray\(d\.fields\) \? d\.fields : \[\]/);
});

test('final submission cancellation performs no writes', async () => {
  const calls = [];
  const result = await submitFinalServiceReport({
    report: completeReport(),
    confirm: async () => { calls.push('confirm'); return false; },
    save: async () => calls.push('save'),
    refresh: async () => calls.push('refresh'),
    complete: async () => calls.push('complete'),
  });

  assert.deepEqual(calls, ['confirm']);
  assert.deepEqual(result, { status: 'cancelled', errors: [] });
});

test('final submission confirms before save, refresh, and completion', async () => {
  const calls = [];
  const result = await submitFinalServiceReport({
    report: completeReport(),
    confirm: async () => { calls.push('confirm'); return true; },
    save: async () => calls.push('save'),
    refresh: async () => calls.push('refresh'),
    complete: async () => calls.push('complete'),
  });

  assert.deepEqual(calls, ['confirm', 'save', 'refresh', 'complete']);
  assert.deepEqual(result, { status: 'completed', errors: [] });
});

test('save failure prevents refresh and completion', async () => {
  const calls = [];
  await assert.rejects(() => submitFinalServiceReport({
    report: completeReport(),
    confirm: async () => { calls.push('confirm'); return true; },
    save: async () => { calls.push('save'); throw new Error('save failed'); },
    refresh: async () => calls.push('refresh'),
    complete: async () => calls.push('complete'),
  }), /save failed/);

  assert.deepEqual(calls, ['confirm', 'save']);
});

test('completion failure happens after the saved report was refreshed', async () => {
  const calls = [];
  await assert.rejects(() => submitFinalServiceReport({
    report: completeReport(),
    confirm: async () => { calls.push('confirm'); return true; },
    save: async () => calls.push('save'),
    refresh: async () => calls.push('refresh'),
    complete: async () => { calls.push('complete'); throw new Error('resolve failed'); },
  }), /resolve failed/);

  assert.deepEqual(calls, ['confirm', 'save', 'refresh', 'complete']);
});

test('report fields associate labels and inline errors for assistive technology', () => {
  for (const field of [
    'symptom',
    'inspection_process',
    'diagnosis',
    'solution',
    'labor_hours',
    'verification_result',
    'follow_up_advice',
  ]) {
    assert.match(panel, new RegExp(`htmlFor=\\{fieldId\\('${field}'\\)\\}`));
    assert.match(panel, new RegExp(`id=\\{fieldId\\('${field}'\\)\\}`));
    assert.match(panel, new RegExp(`aria-invalid=\\{Boolean\\(fieldErrors\\.${field}\\)\\}`));
    assert.match(panel, new RegExp(`aria-describedby=\\{fieldErrors\\.${field} \\? errorId\\('${field}'\\) : undefined\\}`));
    assert.match(panel, new RegExp(`id=\\{errorId\\('${field}'\\)\\} message=\\{fieldErrors\\.${field}\\}`));
  }

  assert.match(panel, /aria-describedby=\{fieldErrors\.parts_used \? errorId\('parts_used'\) : undefined\}/);
  assert.match(panel, /<FieldError id=\{errorId\('parts_used'\)\} message=\{fieldErrors\.parts_used\} \/>/);
});

function completeReport() {
  return {
    symptom: 'Height sensing alarm during piercing.',
    inspection_process: 'Checked nozzle alignment, grounding, and sensor calibration.',
    diagnosis: 'The ceramic ring was cracked and caused an unstable sensor signal.',
    solution: 'Replaced the ceramic ring and recalibrated the height sensing system.',
    verification_result: 'Completed ten pierces without another alarm.',
    follow_up_advice: '',
    parts_used: [],
    labor_hours: 1.5,
  };
}
