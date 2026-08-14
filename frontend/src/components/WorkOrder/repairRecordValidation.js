const requiredCompletionFields = ['symptom', 'inspection_process', 'diagnosis', 'solution', 'verification_result'];

const errorMessages = {
  en: {
    required: 'This field is required for final submission.',
    too_short: 'Please enter at least 20 characters.',
    invalid_number: 'Enter a finite number of hours, 0 or greater.',
    invalid_array: 'Parts data is invalid. Please review the parts list.',
    invalid: 'Please review this field and enter a valid value.',
  },
  cn: {
    required: '最终提交前必须填写此项。',
    too_short: '请至少填写 20 个字符。',
    invalid_number: '请输入大于或等于 0 的有效工时。',
    invalid_array: '配件数据无效，请检查配件清单。',
    invalid: '请检查此字段并输入有效内容。',
  },
};

export function validateServiceReportForCompletion(report) {
  const errors = [];

  for (const field of requiredCompletionFields) {
    if (!report?.[field]?.trim()) {
      errors.push({ field, code: 'required' });
    } else if (
      (field === 'diagnosis' || field === 'solution')
      && report[field].trim().length < 20
    ) {
      errors.push({ field, code: 'too_short' });
    }
  }

  if (!Array.isArray(report?.parts_used)) {
    errors.push({ field: 'parts_used', code: 'invalid_array' });
  }

  const laborInput = report?.labor_hours;
  const laborHours = Number(laborInput);
  if (
    (typeof laborInput !== 'number' && typeof laborInput !== 'string')
    || (typeof laborInput === 'string' && laborInput.trim().length === 0)
    || !(Number.isFinite(laborHours) && laborHours >= 0)
  ) {
    errors.push({ field: 'labor_hours', code: 'invalid_number' });
  }

  return { ok: errors.length === 0, errors };
}

export function mapServiceReportErrors(errors, isCn = false) {
  const messages = isCn ? errorMessages.cn : errorMessages.en;
  return (Array.isArray(errors) ? errors : []).reduce((mapped, error) => {
    if (!error?.field) return mapped;
    const code = error.code === 'required_for_high_risk' ? 'required' : error.code;
    mapped[error.field] = messages[code] || messages.invalid;
    return mapped;
  }, {});
}

export async function submitFinalServiceReport({ report, confirm, save, refresh, complete }) {
  const validation = validateServiceReportForCompletion(report);
  if (!validation.ok) {
    return { status: 'invalid', errors: validation.errors };
  }

  if (!(await confirm())) {
    return { status: 'cancelled', errors: [] };
  }

  await save(report);
  await refresh();
  await complete();
  return { status: 'completed', errors: [] };
}
