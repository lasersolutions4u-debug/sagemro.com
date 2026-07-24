export const PAYMENT_TRIGGER_TYPES = new Set([
  'before_start',
  'on_arrival',
  'milestone',
  'on_completion',
  'on_acceptance',
  'fixed_date',
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidStartPrerequisite(value) {
  return value === true || value === false || value === 1 || value === 0;
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonnegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function buildDefaultPaymentSchedule(totalAmount, currency) {
  return [{
    sequence: 1,
    amount: totalAmount,
    currency,
    trigger_type: 'before_start',
    due_date: null,
    description: '',
    required_before_start: true,
  }];
}

export function validatePaymentSchedule(schedule, { totalAmount, currency }) {
  if (!Array.isArray(schedule) || schedule.length < 2 || schedule.length > 6) {
    return { code: 'payment_schedule_count_invalid' };
  }
  if (schedule.some((row) => row === null || typeof row !== 'object' || Array.isArray(row))) {
    return { code: 'payment_schedule_row_invalid' };
  }
  if (schedule.some((row) => !isPositiveSafeInteger(row.amount))) {
    return { code: 'payment_schedule_amount_invalid' };
  }
  if (!isPositiveSafeInteger(totalAmount)) {
    return { code: 'quote_total_amount_invalid' };
  }
  if (schedule.some((row) => !Number.isInteger(row.sequence))) {
    return { code: 'payment_schedule_sequence_invalid' };
  }
  if (new Set(schedule.map((row) => row.sequence)).size !== schedule.length) {
    return { code: 'payment_schedule_sequence_duplicate' };
  }
  if (schedule.some((row) => row.currency !== currency)) {
    return { code: 'payment_schedule_currency_mismatch' };
  }
  if (schedule.some((row) => !PAYMENT_TRIGGER_TYPES.has(row.trigger_type))) {
    return { code: 'payment_schedule_trigger_invalid' };
  }
  if (schedule.some((row) => (
    Object.hasOwn(row, 'required_before_start')
    && !isValidStartPrerequisite(row.required_before_start)
  ))) {
    return { code: 'payment_schedule_start_prerequisite_invalid' };
  }
  if (schedule.some((row) => row.trigger_type === 'milestone' && !String(row.description || '').trim())) {
    return { code: 'payment_schedule_milestone_description_required' };
  }
  if (schedule.some((row) => row.trigger_type === 'fixed_date' && !isValidDate(row.due_date))) {
    return { code: 'payment_schedule_due_date_invalid' };
  }
  let scheduleTotal = 0;
  for (const row of schedule) {
    scheduleTotal += row.amount;
    if (!Number.isSafeInteger(scheduleTotal)) return { code: 'payment_schedule_total_mismatch' };
  }
  if (scheduleTotal !== totalAmount) {
    return { code: 'payment_schedule_total_mismatch' };
  }
  if (!schedule.some((row) => Boolean(row.required_before_start))) {
    return { code: 'payment_schedule_start_prerequisite_required' };
  }

  const normalized = [...schedule]
    .sort((left, right) => left.sequence - right.sequence)
    .map((row, index) => ({
      sequence: index + 1,
      amount: row.amount,
      currency: row.currency,
      trigger_type: row.trigger_type,
      due_date: row.trigger_type === 'fixed_date' ? row.due_date : null,
      description: String(row.description || '').trim(),
      required_before_start: Boolean(row.required_before_start),
    }));
  return { value: normalized };
}

export function validateQuoteExecution(input = {}) {
  if (!isPositiveSafeInteger(input.total_amount)) {
    return { code: 'quote_total_amount_invalid' };
  }
  const expectedServiceDays = Number(input.expected_service_days);
  if (
    ['onsite', 'hybrid'].includes(input.service_mode)
    && (!Number.isInteger(expectedServiceDays) || expectedServiceDays < 1)
  ) {
    return { code: 'expected_service_days_required' };
  }

  const paymentPlanMode = input.payment_plan_mode === 'installments' ? 'installments' : 'single';
  const scheduleResult = paymentPlanMode === 'installments'
    ? validatePaymentSchedule(input.payment_schedule, {
      totalAmount: input.total_amount,
      currency: input.currency,
    })
    : { value: buildDefaultPaymentSchedule(input.total_amount, input.currency) };
  if (scheduleResult.code) return scheduleResult;

  return {
    value: {
      ...input,
      expected_service_days: input.service_mode === 'remote' ? null : expectedServiceDays,
      payment_plan_mode: paymentPlanMode,
      payment_schedule: scheduleResult.value,
    },
  };
}

export function deriveInstallmentState(installment = {}, now) {
  if (
    installment === null
    || typeof installment !== 'object'
    || Array.isArray(installment)
    || !isPositiveSafeInteger(installment.amount)
    || !isNonnegativeSafeInteger(installment.received_amount)
  ) return 'exception';

  const amount = installment.amount;
  const receivedAmount = installment.received_amount;
  if (receivedAmount >= amount) return 'received';
  if (installment.status === 'exception') return 'exception';
  if ((Number(installment.pending_claim_count) || 0) > 0) return 'pending_confirmation';
  if (receivedAmount > 0) return 'partially_received';

  if (installment.due_date && now !== undefined && now !== null) {
    const current = new Date(now);
    const dueDateEnd = new Date(`${installment.due_date}T23:59:59.999Z`);
    if (Number.isFinite(current.getTime()) && current.getTime() > dueDateEnd.getTime()) return 'overdue';
  }
  if (installment.collection_started_at) return 'collecting';
  if (installment.status === 'due' || installment.source === 'due') return 'due';
  return 'scheduled';
}

export function summarizeQuoteExecution(input = {}) {
  const installments = Array.isArray(input.installments) ? input.installments : [];
  const totalAmountValid = isNonnegativeSafeInteger(input.total_amount)
    && (installments.length === 0 || input.total_amount > 0);
  const installmentsValid = installments.every((installment) => (
    installment !== null
    && typeof installment === 'object'
    && !Array.isArray(installment)
    && isPositiveSafeInteger(installment.amount)
    && isNonnegativeSafeInteger(installment.received_amount)
  ));
  let receivedAmount = 0;
  let aggregateValid = totalAmountValid && installmentsValid;
  if (aggregateValid) {
    for (const installment of installments) {
      receivedAmount += Math.min(installment.amount, installment.received_amount);
      if (!Number.isSafeInteger(receivedAmount)) {
        aggregateValid = false;
        break;
      }
    }
  }
  const outstandingAmount = aggregateValid
    ? Math.max(0, input.total_amount - receivedAmount)
    : null;
  const requiredInstallments = installments.filter((installment) => Boolean(installment.required_before_start));
  const startReady = aggregateValid
    && requiredInstallments.length > 0
    && requiredInstallments.every((installment) => (
      installment.received_amount >= installment.amount
    ));
  const financiallySettled = aggregateValid
    && installments.length > 0
    && outstandingAmount === 0
    && installments.every((installment) => (
      installment.received_amount >= installment.amount
    ));

  const reportedDates = Array.isArray(input.reported_dates) ? input.reported_dates : [];
  const consumedWorkdays = new Set(
    reportedDates.map((date) => String(date || '').trim()).filter(Boolean),
  ).size;
  const initialWorkdays = Math.max(0, Number(input.initial_workdays) || 0);
  const extensionDays = Math.max(0, Number(input.extension_days) || 0);
  const permittedWorkdays = initialWorkdays + extensionDays;
  const remainingWorkdays = Math.max(0, permittedWorkdays - consumedWorkdays);
  const allowanceExhausted = permittedWorkdays > 0 && consumedWorkdays >= permittedWorkdays;

  let paymentState = aggregateValid ? 'unpaid' : 'exception';
  if (financiallySettled) paymentState = 'settled';
  else if (!aggregateValid) paymentState = 'exception';
  else if (installments.some((installment) => (Number(installment.pending_claim_count) || 0) > 0 || installment.status === 'pending_confirmation')) {
    paymentState = 'pending_confirmation';
  } else if (installments.some((installment) => (
    installment.status === 'overdue'
    || deriveInstallmentState(installment, input.now) === 'overdue'
  ))) paymentState = 'overdue';
  else if (receivedAmount > 0) paymentState = 'partially_received';

  return {
    received_amount: aggregateValid ? receivedAmount : null,
    outstanding_amount: outstandingAmount,
    start_ready: startReady,
    financially_settled: financiallySettled,
    consumed_workdays: consumedWorkdays,
    permitted_workdays: permittedWorkdays,
    remaining_workdays: remainingWorkdays,
    allowance_exhausted: allowanceExhausted,
    payment_state: paymentState,
  };
}

export function canCreateFieldDay(summary = {}) {
  return !summary.allowance_exhausted;
}

export function canFinanciallyArchive(summary = {}) {
  return summary.financially_settled === true;
}

export function formatSiteTimezone(timezone, market) {
  const identifier = String(timezone || '');
  if (identifier === 'Asia/Shanghai' && String(market || '').toLowerCase() === 'cn') {
    return '中国标准时间（上海）';
  }
  return identifier;
}
