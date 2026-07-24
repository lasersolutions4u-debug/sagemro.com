import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAYMENT_TRIGGER_TYPES,
  buildDefaultPaymentSchedule,
  canCreateFieldDay,
  canFinanciallyArchive,
  deriveInstallmentState,
  formatSiteTimezone,
  summarizeQuoteExecution,
  validatePaymentSchedule,
  validateQuoteExecution,
} from '../src/lib/quoteExecution.js';

test('builds the exact default payment schedule', () => {
  assert.deepEqual(buildDefaultPaymentSchedule(12000, 'CNY'), [{
    sequence: 1,
    amount: 12000,
    currency: 'CNY',
    trigger_type: 'before_start',
    due_date: null,
    description: '',
    required_before_start: true,
  }]);
});

test('onsite and hybrid quotes require positive integer expected service days', () => {
  for (const serviceMode of ['onsite', 'hybrid']) {
    assert.deepEqual(validateQuoteExecution({
      service_mode: serviceMode,
      expected_service_days: 0,
      total_amount: 12000,
      currency: 'CNY',
    }), { code: 'expected_service_days_required' });
    assert.deepEqual(validateQuoteExecution({
      service_mode: serviceMode,
      expected_service_days: 1.5,
      total_amount: 12000,
      currency: 'CNY',
    }), { code: 'expected_service_days_required' });
  }
});

test('valid onsite service days normalize to an integer number', () => {
  const result = validateQuoteExecution({
    service_mode: 'onsite',
    expected_service_days: '2',
    total_amount: 12000,
    currency: 'CNY',
  });
  assert.equal(result.value.expected_service_days, 2);
});

test('quote totals must be positive integer minor-unit number primitives', () => {
  const invalidTotals = ['100', 1.5, undefined, Number.NaN, 0, -1, Number.MAX_SAFE_INTEGER + 1];
  for (const paymentPlanMode of ['single', 'installments']) {
    for (const totalAmount of invalidTotals) {
      assert.deepEqual(validateQuoteExecution({
        service_mode: 'remote',
        payment_plan_mode: paymentPlanMode,
        total_amount: totalAmount,
        currency: 'CNY',
        payment_schedule: [
          { sequence: 1, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: true },
          { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion' },
        ],
      }), { code: 'quote_total_amount_invalid' });
    }
  }
});

test('quote totals allow the maximum safe integer', () => {
  const result = validateQuoteExecution({
    service_mode: 'remote',
    total_amount: Number.MAX_SAFE_INTEGER,
    currency: 'CNY',
  });
  assert.equal(result.value.total_amount, Number.MAX_SAFE_INTEGER);
  assert.equal(result.value.payment_schedule[0].amount, Number.MAX_SAFE_INTEGER);
});

test('installment schedules require two to six rows', () => {
  assert.deepEqual([...PAYMENT_TRIGGER_TYPES], [
    'before_start',
    'on_arrival',
    'milestone',
    'on_completion',
    'on_acceptance',
    'fixed_date',
  ]);
  assert.deepEqual(validatePaymentSchedule([], { totalAmount: 100, currency: 'CNY' }), {
    code: 'payment_schedule_count_invalid',
  });
  assert.deepEqual(validatePaymentSchedule([{
    sequence: 1,
    amount: 100,
    currency: 'CNY',
    trigger_type: 'before_start',
    required_before_start: true,
  }], { totalAmount: 100, currency: 'CNY' }), {
    code: 'payment_schedule_count_invalid',
  });
  const sevenRows = Array.from({ length: 7 }, (_, index) => ({
    sequence: index + 1,
    amount: 10,
    currency: 'CNY',
    trigger_type: 'before_start',
    required_before_start: index === 0,
  }));
  assert.deepEqual(validatePaymentSchedule(sevenRows, { totalAmount: 70, currency: 'CNY' }), {
    code: 'payment_schedule_count_invalid',
  });
});

test('installment amounts must be positive integer minor units', () => {
  const base = [
    { sequence: 1, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: true },
    { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion' },
  ];
  for (const amount of [0, -1, 1.5]) {
    const schedule = base.map((row) => ({ ...row }));
    schedule[0].amount = amount;
    assert.deepEqual(validatePaymentSchedule(schedule, { totalAmount: 100, currency: 'CNY' }), {
      code: 'payment_schedule_amount_invalid',
    });
  }
});

test('installment amounts enforce safe-integer boundaries without precision loss', () => {
  const maximumSafeSchedule = [
    {
      sequence: 1,
      amount: Number.MAX_SAFE_INTEGER - 1,
      currency: 'CNY',
      trigger_type: 'before_start',
      required_before_start: true,
    },
    { sequence: 2, amount: 1, currency: 'CNY', trigger_type: 'on_completion' },
  ];
  assert.equal(validatePaymentSchedule(maximumSafeSchedule, {
    totalAmount: Number.MAX_SAFE_INTEGER,
    currency: 'CNY',
  }).value[0].amount, Number.MAX_SAFE_INTEGER - 1);

  assert.deepEqual(validatePaymentSchedule([
    { ...maximumSafeSchedule[0], amount: Number.MAX_SAFE_INTEGER + 1 },
    maximumSafeSchedule[1],
  ], { totalAmount: Number.MAX_SAFE_INTEGER, currency: 'CNY' }), {
    code: 'payment_schedule_amount_invalid',
  });
  assert.deepEqual(validatePaymentSchedule([
    { ...maximumSafeSchedule[0], amount: 2 ** 53 },
    maximumSafeSchedule[1],
  ], { totalAmount: 2 ** 53, currency: 'CNY' }), {
    code: 'payment_schedule_amount_invalid',
  });
  assert.deepEqual(validatePaymentSchedule(maximumSafeSchedule, {
    totalAmount: Number.MAX_SAFE_INTEGER + 1,
    currency: 'CNY',
  }), {
    code: 'quote_total_amount_invalid',
  });
});

test('malformed schedule rows return a deterministic validation code', () => {
  assert.deepEqual(validatePaymentSchedule([
    null,
    { sequence: 2, amount: 100, currency: 'CNY', trigger_type: 'before_start', required_before_start: true },
  ], { totalAmount: 100, currency: 'CNY' }), {
    code: 'payment_schedule_row_invalid',
  });
});

test('installment sequences must be integers', () => {
  assert.deepEqual(validatePaymentSchedule([
    { sequence: 1.5, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: true },
    { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion' },
  ], { totalAmount: 100, currency: 'CNY' }), {
    code: 'payment_schedule_sequence_invalid',
  });
});

test('duplicate sequences fail while unique gapped and unsorted sequences normalize to 1..N', () => {
  const duplicate = [
    { sequence: 2, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: true },
    { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion' },
  ];
  assert.deepEqual(validatePaymentSchedule(duplicate, { totalAmount: 100, currency: 'CNY' }), {
    code: 'payment_schedule_sequence_duplicate',
  });

  const unsorted = [
    { sequence: 9, amount: 60, currency: 'CNY', trigger_type: 'on_completion', description: ' Final ' },
    { sequence: 3, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: 1 },
  ];
  assert.deepEqual(validatePaymentSchedule(unsorted, { totalAmount: 100, currency: 'CNY' }), {
    value: [
      {
        sequence: 1,
        amount: 40,
        currency: 'CNY',
        trigger_type: 'before_start',
        due_date: null,
        description: '',
        required_before_start: true,
      },
      {
        sequence: 2,
        amount: 60,
        currency: 'CNY',
        trigger_type: 'on_completion',
        due_date: null,
        description: 'Final',
        required_before_start: false,
      },
    ],
  });
});

test('schedule currency and triggers must match the quote contract', () => {
  const base = [
    { sequence: 1, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: true },
    { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion' },
  ];
  assert.deepEqual(validatePaymentSchedule([
    base[0],
    { ...base[1], currency: 'USD' },
  ], { totalAmount: 100, currency: 'CNY' }), { code: 'payment_schedule_currency_mismatch' });
  assert.deepEqual(validatePaymentSchedule([
    base[0],
    { ...base[1], trigger_type: 'after_lunch' },
  ], { totalAmount: 100, currency: 'CNY' }), { code: 'payment_schedule_trigger_invalid' });
});

test('milestones require descriptions and fixed dates require real YYYY-MM-DD dates', () => {
  const start = { sequence: 1, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: true };
  assert.deepEqual(validatePaymentSchedule([
    start,
    { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'milestone', description: '   ' },
  ], { totalAmount: 100, currency: 'CNY' }), { code: 'payment_schedule_milestone_description_required' });

  for (const dueDate of [null, '2026-02-30', '24-07-2026']) {
    assert.deepEqual(validatePaymentSchedule([
      start,
      { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'fixed_date', due_date: dueDate },
    ], { totalAmount: 100, currency: 'CNY' }), { code: 'payment_schedule_due_date_invalid' });
  }
  assert.equal(validatePaymentSchedule([
    start,
    { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'fixed_date', due_date: '2026-07-24' },
  ], { totalAmount: 100, currency: 'CNY' }).value[1].due_date, '2026-07-24');
});

test('schedule total must match exactly and at least one row must gate service start', () => {
  const noStartGate = [
    { sequence: 1, amount: 40, currency: 'CNY', trigger_type: 'on_arrival' },
    { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion' },
  ];
  assert.deepEqual(validatePaymentSchedule(noStartGate, { totalAmount: 101, currency: 'CNY' }), {
    code: 'payment_schedule_total_mismatch',
  });
  assert.deepEqual(validatePaymentSchedule(noStartGate, { totalAmount: 100, currency: 'CNY' }), {
    code: 'payment_schedule_start_prerequisite_required',
  });
});

test('start prerequisite flags accept only booleans and integer boolean values', () => {
  const start = { sequence: 1, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: true };
  for (const value of ['false', '1', null, undefined, 2]) {
    assert.deepEqual(validatePaymentSchedule([
      start,
      { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion', required_before_start: value },
    ], { totalAmount: 100, currency: 'CNY' }), {
      code: 'payment_schedule_start_prerequisite_invalid',
    });
  }

  for (const value of [false, 0]) {
    const result = validatePaymentSchedule([
      start,
      { sequence: 2, amount: 60, currency: 'CNY', trigger_type: 'on_completion', required_before_start: value },
    ], { totalAmount: 100, currency: 'CNY' });
    assert.equal(result.value[1].required_before_start, false);
  }
});

test('quote validation uses normalized installment schedules without mutating input', () => {
  const input = {
    service_mode: 'onsite',
    expected_service_days: 2,
    payment_plan_mode: 'installments',
    total_amount: 100,
    currency: 'CNY',
    payment_schedule: [
      { sequence: 9, amount: 60, currency: 'CNY', trigger_type: 'on_completion', description: ' Final ' },
      { sequence: 3, amount: 40, currency: 'CNY', trigger_type: 'before_start', required_before_start: 1 },
    ],
  };
  const original = structuredClone(input);
  const result = validateQuoteExecution(input);

  assert.deepEqual(input, original);
  assert.deepEqual(result.value.payment_schedule.map((row) => row.sequence), [1, 2]);
  assert.equal(result.value.payment_schedule[1].description, 'Final');
});

test('installment state follows the documented deterministic priority', () => {
  const now = '2026-07-25T00:00:00Z';
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 100, status: 'exception', pending_claim_count: 2 }, now), 'received');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 0, status: 'exception', pending_claim_count: 2 }, now), 'exception');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 0, pending_claim_count: 1, due_date: '2026-07-20' }, now), 'pending_confirmation');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 40, pending_claim_count: 0, due_date: '2026-07-20' }, now), 'partially_received');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 0, due_date: '2026-07-24' }, now), 'overdue');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 0, collection_started_at: '2026-07-20T00:00:00Z' }, now), 'collecting');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 0, status: 'due' }, now), 'due');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 0, source: 'due' }, now), 'due');
  assert.equal(deriveInstallmentState({ amount: 100, received_amount: 0 }, now), 'scheduled');
});

test('installment state does not derive overdue without a valid explicit now', () => {
  const installment = { amount: 100, received_amount: 0, due_date: '2000-01-01' };
  assert.deepEqual([
    deriveInstallmentState(installment),
    deriveInstallmentState(installment),
    deriveInstallmentState(installment, 'invalid'),
  ], ['scheduled', 'scheduled', 'scheduled']);
  assert.equal(deriveInstallmentState({ ...installment, collection_started_at: '2026-07-20T00:00:00Z' }), 'collecting');
  assert.equal(deriveInstallmentState({ ...installment, source: 'due' }), 'due');
});

test('installment state returns exception for malformed monetary projections', () => {
  for (const installment of [
    {},
    { received_amount: 0 },
    { amount: Number.MAX_SAFE_INTEGER + 1, received_amount: 0 },
    { amount: 100 },
    { amount: 100, received_amount: -1 },
    { amount: 100, received_amount: Number.NaN },
    { amount: 100, received_amount: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.equal(deriveInstallmentState(installment, '2026-07-25T00:00:00Z'), 'exception');
  }
});

test('overdue begins only after the end of the due date', () => {
  const installment = { amount: 100, received_amount: 0, due_date: '2026-07-24' };
  assert.equal(deriveInstallmentState(installment, '2026-07-24T23:59:59.999Z'), 'scheduled');
  assert.equal(deriveInstallmentState(installment, '2026-07-25T00:00:00.000Z'), 'overdue');
});

test('deriving installment state does not mutate input', () => {
  const installment = {
    amount: 100,
    received_amount: 40,
    pending_claim_count: 0,
    due_date: '2026-07-24',
  };
  const original = structuredClone(installment);
  deriveInstallmentState(installment, '2026-07-25T00:00:00Z');
  assert.deepEqual(installment, original);
});

test('summary caps receipts and requires every start prerequisite to be fully received', () => {
  const summary = summarizeQuoteExecution({
    total_amount: 10000,
    installments: [
      { amount: 3000, received_amount: 4000, required_before_start: 1 },
      { amount: 2000, received_amount: 1999, required_before_start: true },
      { amount: 5000, received_amount: 1000, required_before_start: false },
    ],
    initial_workdays: 3,
    extension_days: 1,
    reported_dates: [],
  });

  assert.equal(summary.received_amount, 5999);
  assert.equal(summary.outstanding_amount, 4001);
  assert.equal(summary.start_ready, false);
  assert.equal(summary.financially_settled, false);
  assert.equal(summary.payment_state, 'partially_received');
  assert.equal(canFinanciallyArchive(summary), false);

  const ready = summarizeQuoteExecution({
    total_amount: 10000,
    installments: [
      { amount: 3000, received_amount: 3000, required_before_start: true },
      { amount: 2000, received_amount: 2000, required_before_start: true },
      { amount: 5000, received_amount: 0, required_before_start: false },
    ],
  });
  assert.equal(ready.start_ready, true);
});

test('empty installments cannot project a positive quote total', () => {
  const summary = summarizeQuoteExecution({ total_amount: 100, installments: [] });
  assert.equal(summary.scheduled_amount, null);
  assert.equal(summary.start_ready, false);
  assert.equal(summary.financially_settled, false);
  assert.equal(summary.payment_state, 'exception');
});

test('a schedule without a start prerequisite is not start-ready', () => {
  const summary = summarizeQuoteExecution({
    total_amount: 100,
    installments: [
      { amount: 40, received_amount: 40 },
      { amount: 60, received_amount: 60, required_before_start: false },
    ],
  });
  assert.equal(summary.start_ready, false);
});

test('financial settlement requires every installment to be fully received', () => {
  const summary = summarizeQuoteExecution({
    total_amount: 100,
    installments: [
      { amount: 60, received_amount: 60 },
      { amount: 60, received_amount: 40 },
    ],
  });
  assert.equal(summary.scheduled_amount, null);
  assert.equal(summary.outstanding_amount, null);
  assert.equal(summary.financially_settled, false);
  assert.equal(summary.payment_state, 'exception');
});

test('scheduled installment total must equal the quote total exactly', () => {
  const overScheduled = summarizeQuoteExecution({
    total_amount: 100,
    installments: [
      { amount: 60, received_amount: 60 },
      { amount: 60, received_amount: 60 },
    ],
  });
  assert.equal(overScheduled.scheduled_amount, null);
  assert.equal(overScheduled.start_ready, false);
  assert.equal(overScheduled.financially_settled, false);
  assert.equal(overScheduled.payment_state, 'exception');
  assert.equal(canFinanciallyArchive(overScheduled), false);

  const summary = summarizeQuoteExecution({
    total_amount: 100,
    installments: [
      { amount: 40, received_amount: 40 },
      { amount: 40, received_amount: 40 },
    ],
  });
  assert.equal(summary.scheduled_amount, null);
  assert.equal(summary.outstanding_amount, null);
  assert.equal(summary.financially_settled, false);
  assert.equal(summary.payment_state, 'exception');
  assert.equal(canFinanciallyArchive(summary), false);

  const exact = summarizeQuoteExecution({
    total_amount: 100,
    installments: [
      { amount: 40, received_amount: 40 },
      { amount: 60, received_amount: 60 },
    ],
  });
  assert.equal(exact.scheduled_amount, 100);
  assert.equal(exact.received_amount, 100);
  assert.equal(exact.outstanding_amount, 0);
  assert.equal(exact.financially_settled, true);
  assert.equal(exact.payment_state, 'settled');
});

test('summary fails closed for malformed monetary projections', () => {
  const malformedInputs = [
    {},
    { total_amount: undefined, installments: [] },
    { total_amount: -1, installments: [] },
    { total_amount: Number.NaN, installments: [] },
    { total_amount: Number.MAX_SAFE_INTEGER + 1, installments: [] },
    { total_amount: 100, installments: [null] },
    { total_amount: 100, installments: [{}] },
    { total_amount: 100, installments: [{ received_amount: 0 }] },
    { total_amount: 100, installments: [{ amount: Number.MAX_SAFE_INTEGER + 1, received_amount: 0 }] },
    { total_amount: 100, installments: [{ amount: 100 }] },
    { total_amount: 100, installments: [{ amount: 100, received_amount: -1 }] },
    { total_amount: 100, installments: [{ amount: 100, received_amount: Number.NaN }] },
  ];

  for (const input of malformedInputs) {
    const summary = summarizeQuoteExecution(input);
    assert.equal(summary.scheduled_amount, null);
    assert.equal(summary.received_amount, null);
    assert.equal(summary.outstanding_amount, null);
    assert.equal(summary.start_ready, false);
    assert.equal(summary.financially_settled, false);
    assert.equal(summary.payment_state, 'exception');
    assert.equal(canFinanciallyArchive(summary), false);
  }
});

test('unsafe scheduled amount aggregation fails closed', () => {
  const summary = summarizeQuoteExecution({
    total_amount: Number.MAX_SAFE_INTEGER,
    installments: [
      { amount: Number.MAX_SAFE_INTEGER, received_amount: 0 },
      { amount: 1, received_amount: 0 },
    ],
  });
  assert.equal(summary.scheduled_amount, null);
  assert.equal(summary.received_amount, null);
  assert.equal(summary.outstanding_amount, null);
  assert.equal(summary.start_ready, false);
  assert.equal(summary.financially_settled, false);
  assert.equal(summary.payment_state, 'exception');
  assert.equal(canFinanciallyArchive(summary), false);
});

test('a nonempty schedule with zero total fails closed', () => {
  const summary = summarizeQuoteExecution({
    total_amount: 0,
    installments: [{ amount: 100, received_amount: 100, required_before_start: true }],
  });
  assert.equal(summary.payment_state, 'exception');
  assert.equal(summary.start_ready, false);
  assert.equal(summary.financially_settled, false);
  assert.equal(canFinanciallyArchive(summary), false);
});

test('payment state priority is settled, pending confirmation, overdue, partial, unpaid', () => {
  assert.equal(summarizeQuoteExecution({
    total_amount: 200,
    installments: [
      { amount: 100, received_amount: 0, pending_claim_count: 1 },
      { amount: 100, received_amount: 0, status: 'overdue' },
    ],
  }).payment_state, 'pending_confirmation');

  assert.equal(summarizeQuoteExecution({
    total_amount: 200,
    installments: [
      { amount: 100, received_amount: 20 },
      { amount: 100, received_amount: 0, status: 'overdue' },
    ],
  }).payment_state, 'overdue');

  const settled = summarizeQuoteExecution({
    total_amount: 200,
    installments: [
      { amount: 100, received_amount: 100, pending_claim_count: 1 },
      { amount: 100, received_amount: 150, status: 'overdue' },
    ],
  });
  assert.equal(settled.payment_state, 'settled');
  assert.equal(canFinanciallyArchive(settled), true);
});

test('payment state derives overdue from a passed due date without persisted status', () => {
  const summary = summarizeQuoteExecution({
    total_amount: 100,
    installments: [{ amount: 100, received_amount: 0, due_date: '2026-07-24' }],
    now: '2026-07-25T00:00:00Z',
  });
  assert.equal(summary.payment_state, 'overdue');
});

test('workday summary counts distinct nonblank dates and exhausts the nonnegative allowance', () => {
  const summary = summarizeQuoteExecution({
    total_amount: 100,
    installments: [{ amount: 100, received_amount: 100, required_before_start: true }],
    initial_workdays: 2,
    extension_days: 1,
    reported_dates: ['2026-07-24', ' 2026-07-24 ', '', null, '2026-07-25', '2026-07-26'],
  });
  assert.equal(summary.consumed_workdays, 3);
  assert.equal(summary.permitted_workdays, 3);
  assert.equal(summary.remaining_workdays, 0);
  assert.equal(summary.allowance_exhausted, true);
  assert.equal(canCreateFieldDay(summary), false);

  const zeroAllowance = summarizeQuoteExecution({
    total_amount: 0,
    installments: [],
    initial_workdays: -2,
    extension_days: -1,
    reported_dates: ['2026-07-24'],
  });
  assert.equal(zeroAllowance.permitted_workdays, 0);
  assert.equal(zeroAllowance.remaining_workdays, 0);
  assert.equal(zeroAllowance.allowance_exhausted, false);
  assert.equal(canCreateFieldDay(zeroAllowance), true);
});

test('site timezone localizes only Asia/Shanghai for the CN market', () => {
  assert.equal(formatSiteTimezone('Asia/Shanghai', 'cn'), '中国标准时间（上海）');
  assert.equal(formatSiteTimezone('Asia/Shanghai', 'CN'), '中国标准时间（上海）');
  assert.equal(formatSiteTimezone('Asia/Shanghai', 'com'), 'Asia/Shanghai');
  assert.equal(formatSiteTimezone('America/Los_Angeles', 'cn'), 'America/Los_Angeles');
  assert.equal(formatSiteTimezone('Unknown/Zone', 'cn'), 'Unknown/Zone');
  assert.equal(formatSiteTimezone('', 'cn'), '');
  assert.equal(formatSiteTimezone(null, 'cn'), '');
});

test('remote quotes clear expected days and non-installment modes normalize to single', () => {
  assert.deepEqual(validateQuoteExecution({
    service_mode: 'remote',
    expected_service_days: 4,
    payment_plan_mode: 'custom',
    total_amount: 12000,
    currency: 'CNY',
    payment_schedule: [{ amount: 1 }],
  }), {
    value: {
      service_mode: 'remote',
      expected_service_days: null,
      payment_plan_mode: 'single',
      total_amount: 12000,
      currency: 'CNY',
      payment_schedule: buildDefaultPaymentSchedule(12000, 'CNY'),
    },
  });
});
