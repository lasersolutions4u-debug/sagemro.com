import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCandidateRawContent,
  candidateEventId,
  candidateIdForRepairRecord,
  parseRatingScore,
  prepareWorkOrderCandidate,
  toKnowledgeMarket,
} from '../src/lib/knowledge-candidates.js';
import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

function submittedReport(overrides = {}) {
  return {
    id: 'repair-1',
    work_order_id: 'work-1',
    symptom: 'The cutting head loses height sensing.',
    inspection_process: 'Checked grounding, nozzle alignment, and calibration.',
    diagnosis: 'The ceramic ring was cracked.',
    solution: 'Replaced the ceramic ring and recalibrated the sensor.',
    verification_result: 'Completed ten cuts without another alarm.',
    follow_up_advice: 'Inspect the ceramic ring during weekly maintenance.',
    report_quality_status: 'submitted',
    customer_name: 'Private Customer',
    company: 'Private Company',
    phone: '13800000000',
    email: 'private@example.com',
    whatsapp: '+1 555 0100',
    description: 'Private work-order description',
    price: '9999',
    ...overrides,
  };
}

test('raw candidate content uses only the six technical evidence fields', () => {
  const content = buildCandidateRawContent(submittedReport());

  assert.equal(content, [
    'Symptom:',
    'The cutting head loses height sensing.',
    '',
    'Inspection Process:',
    'Checked grounding, nozzle alignment, and calibration.',
    '',
    'Diagnosis:',
    'The ceramic ring was cracked.',
    '',
    'Solution:',
    'Replaced the ceramic ring and recalibrated the sensor.',
    '',
    'Verification Result:',
    'Completed ten cuts without another alarm.',
    '',
    'Follow-up Advice:',
    'Inspect the ceramic ring during weekly maintenance.',
  ].join('\n'));
  for (const privateValue of [
    'Private Customer',
    'Private Company',
    '13800000000',
    'private@example.com',
    '+1 555 0100',
    'Private work-order description',
    '9999',
  ]) {
    assert.equal(content.includes(privateValue), false, `leaked ${privateValue}`);
  }
});

test('raw candidate content normalizes non-string and surrounding whitespace deterministically', () => {
  const content = buildCandidateRawContent(submittedReport({
    symptom: '  Stable symptom  ',
    diagnosis: null,
    solution: 42,
  }));

  assert.match(content, /^Symptom:\nStable symptom\n/m);
  assert.match(content, /Diagnosis:\n\n\nSolution:\n$/m);
  assert.equal(content.includes('42'), false);
});

test('knowledge market is derived from the trusted request market contract', () => {
  assert.equal(toKnowledgeMarket('com'), 'global');
  assert.equal(toKnowledgeMarket('cn'), 'cn');
  assert.throws(() => toKnowledgeMarket('global'), /unsupported_request_market/);
});

test('candidate and event ids are stable, bounded, and use safe characters', () => {
  const candidateA = candidateIdForRepairRecord('repair/one@example.com');
  const candidateB = candidateIdForRepairRecord('repair/one@example.com');
  const eventA = candidateEventId(candidateA, 'candidate_created', 'customer', 'customer-1');
  const eventB = candidateEventId(candidateA, 'candidate_created', 'customer', 'customer-1');

  assert.equal(candidateA, candidateB);
  assert.equal(eventA, eventB);
  assert.match(candidateA, /^kc_[a-f0-9]{16}$/);
  assert.match(eventA, /^kce_[a-f0-9]{16}$/);
});

test('work-order candidate preparation requires a submitted report and ignores untrusted market fields', () => {
  const report = submittedReport({ market: 'cn' });
  const candidate = prepareWorkOrderCandidate({
    report,
    workOrder: {
      id: 'work-1',
      engineer_id: 'engineer-1',
      market: 'cn',
    },
    requestMarket: 'com',
    evidenceNotes: null,
  });

  assert.equal(candidate.market, 'global');
  assert.equal(candidate.contributor_engineer_id, 'engineer-1');
  assert.equal(candidate.source_type, 'work_order');
  assert.equal(candidate.status, 'awaiting_operations');
  assert.equal(candidate.internal_use_allowed, 1);
  assert.equal(candidate.public_use_allowed, 0);
  assert.throws(
    () => prepareWorkOrderCandidate({
      report: submittedReport({ report_quality_status: 'draft' }),
      workOrder: { id: 'work-1', engineer_id: 'engineer-1' },
      requestMarket: 'com',
    }),
    /service_report_not_submitted/,
  );
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createCandidateEnv({
  reportStatus = 'submitted',
  workOrderStatus = 'resolved',
  candidateFailure = false,
  eventFailure = false,
  existingCandidate = false,
  existingCandidateId = null,
  beforeBatch,
} = {}) {
  const state = {
    workOrder: {
      id: 'work-1', order_no: 'WO-1', customer_id: 'customer-1', engineer_id: 'engineer-1', status: workOrderStatus,
    },
    report: submittedReport({ customer_confirmed_at: null, report_quality_status: reportStatus }),
    ratings: [],
    candidates: existingCandidate ? [{
      id: existingCandidateId || candidateIdForRepairRecord('repair-1'),
      status: 'awaiting_operations',
      source_work_order_id: 'work-1',
      source_repair_record_id: 'repair-1',
      contributor_engineer_id: 'engineer-1',
      market: 'global',
      evidence_notes: 'Admin verified: Existing review.',
    }] : [],
    events: [],
    notifications: [],
    batchCalls: 0,
    failEvents: eventFailure,
    settlementCalls: 0,
    payoutCalls: 0,
    aggregateWrites: 0,
    executed: [],
  };

  function statement(sql) {
    const normalized = normalizeSql(sql);
    return {
      args: [],
      bind(...args) { this.args = args; return this; },
      async first() {
        if (/FROM work_orders wo JOIN work_order_repair_records r/i.test(normalized)) {
          return { ...state.report, ...state.workOrder, repair_record_id: state.report.id };
        }
        if (/SELECT id FROM ratings WHERE work_order_id = \?/i.test(normalized)) {
          return state.ratings.find((row) => row.work_order_id === this.args[0]) || null;
        }
        if (/SELECT id FROM knowledge_candidates WHERE source_repair_record_id = \?/i.test(normalized)) {
          return state.candidates.find((row) => row.source_repair_record_id === this.args[0]) || null;
        }
        if (/SELECT status, customer_id, engineer_id FROM work_orders WHERE id = \?/i.test(normalized)) {
          return { ...state.workOrder };
        }
        if (/FROM work_order_repair_records WHERE id = \?/i.test(normalized)) {
          return {
            work_order_id: state.report.work_order_id,
            customer_confirmed_at: state.report.customer_confirmed_at,
            report_quality_status: state.report.report_quality_status,
          };
        }
        if (/SELECT id, status(?:,| FROM) .*knowledge_candidates WHERE source_repair_record_id/i.test(normalized)) {
          return state.candidates.find((row) => row.source_repair_record_id === this.args[0]) || null;
        }
        if (/SELECT id FROM engineer_wallets/i.test(normalized)) {
          state.settlementCalls += 1;
          return { id: 'wallet-existing' };
        }
        if (/SELECT \* FROM work_order_payouts WHERE work_order_id/i.test(normalized)) {
          state.payoutCalls += 1;
          return { id: 'payout-existing', work_order_id: 'work-1', engineer_id: 'engineer-1', status: 'pending' };
        }
        if (/SELECT order_no FROM work_orders/i.test(normalized)) return { order_no: state.workOrder.order_no };
        if (/SELECT onesignal_player_id FROM engineers/i.test(normalized)) return null;
        return null;
      },
      async all() {
        if (/FROM work_order_service_gate_overrides/i.test(normalized)) {
          return {
            results: [{
              gate_key: 'handover',
              reason: 'Candidate fixture isolates the reviewed-report workflow.',
              overridden_by: 'admin-test',
              revoked_at: null,
            }],
          };
        }
        return { results: [] };
      },
      async run() {
        state.executed.push({ sql: normalized, args: [...this.args] });
        if (/INSERT INTO ratings/i.test(normalized)) {
          if (state.ratings.some((row) => row.work_order_id === this.args[1])) return { meta: { changes: 0 } };
          const workOrderMatches = (
            state.workOrder.id === this.args[9]
            && state.workOrder.customer_id === this.args[10]
            && state.workOrder.engineer_id === this.args[11]
            && state.workOrder.status === this.args[12]
          );
          const reportMatches = (
            state.report.id === this.args[13]
            && state.report.work_order_id === state.workOrder.id
            && state.report.report_quality_status === 'submitted'
          );
          if (!workOrderMatches || !reportMatches) return { meta: { changes: 0 } };
          state.ratings.push({
            id: this.args[0],
            work_order_id: this.args[1],
            engineer_id: this.args[2],
            customer_id: this.args[3],
          });
          return { meta: { changes: 1 } };
        }
        if (/UPDATE work_order_repair_records SET customer_confirmed_at/i.test(normalized)) {
          const allowed = (
            state.report.id === this.args[0]
            && state.report.work_order_id === this.args[1]
            && state.report.report_quality_status === 'submitted'
            && state.workOrder.id === this.args[2]
            && state.workOrder.customer_id === this.args[3]
            && state.workOrder.engineer_id === this.args[4]
            && state.workOrder.status === this.args[5]
            && state.ratings.some((row) => row.work_order_id === this.args[6])
          );
          if (!allowed) return { meta: { changes: 0 } };
          state.report.customer_confirmed_at ||= '2026-08-13 12:00:00';
          return { meta: { changes: 1 } };
        }
        if (/INSERT INTO knowledge_candidates/i.test(normalized)) {
          if (candidateFailure) throw new Error('candidate_write_failed');
          const repairId = this.args[3];
          if (state.candidates.some((row) => row.source_repair_record_id === repairId)) return { meta: { changes: 0 } };
          const conditionalCustomerInsert = /WHERE EXISTS \( SELECT 1 FROM work_orders wo/i.test(normalized);
          const customerInsert = /customer_confirmed_at IS NOT NULL/i.test(normalized);
          const allowed = !conditionalCustomerInsert || (customerInsert ? (
            state.workOrder.id === this.args[8]
            && state.workOrder.customer_id === this.args[9]
            && state.workOrder.engineer_id === this.args[10]
            && state.workOrder.status === this.args[11]
            && state.report.id === this.args[12]
            && state.report.work_order_id === state.workOrder.id
            && state.report.report_quality_status === 'submitted'
            && (!customerInsert || (
              state.report.customer_confirmed_at
              && state.ratings.some((row) => row.work_order_id === state.workOrder.id)
            ))
          ) : (
            state.workOrder.id === this.args[8]
            && state.workOrder.engineer_id === this.args[9]
            && state.workOrder.status === this.args[10]
            && state.report.id === this.args[11]
            && state.report.work_order_id === this.args[12]
            && state.report.report_quality_status === 'submitted'
          ));
          if (!allowed) return { meta: { changes: 0 } };
          state.candidates.push({
            id: this.args[0],
            status: 'awaiting_operations',
            source_work_order_id: this.args[2],
            source_repair_record_id: repairId,
            contributor_engineer_id: this.args[4],
            market: this.args[1],
            evidence_notes: this.args[7],
          });
          return { meta: { changes: 1 } };
        }
        if (/INSERT OR IGNORE INTO knowledge_candidate_events/i.test(normalized)) {
          if (state.failEvents) throw new Error('candidate_event_write_failed');
          if (state.events.some((row) => row.id === this.args[0])) return { meta: { changes: 0 } };
          const adminEvent = /'admin'.*'admin_created_candidate'/i.test(normalized);
          const customerConfirmation = /customer_confirmed_candidate/i.test(normalized);
          if (customerConfirmation) {
            const candidate = state.candidates.find((row) => row.source_repair_record_id === this.args[3]);
            const allowed = (
              candidate
              && state.workOrder.id === this.args[4]
              && state.workOrder.customer_id === this.args[5]
              && state.workOrder.engineer_id === this.args[6]
              && state.workOrder.status === this.args[7]
              && state.report.id === this.args[8]
              && state.report.work_order_id === state.workOrder.id
              && state.report.report_quality_status === 'submitted'
              && state.report.customer_confirmed_at
              && state.ratings.some((row) => row.work_order_id === state.workOrder.id)
            );
            if (!allowed) return { meta: { changes: 0 } };
            state.events.push({ id: this.args[0], candidate_id: candidate.id, actor_type: 'customer', actor_user_id: this.args[1], action: 'customer_confirmed_candidate' });
            return { meta: { changes: 1 } };
          }
          if (adminEvent) {
            const candidate = state.candidates.find((row) => row.id === this.args[3]);
            const allowed = candidate
              && candidate.source_work_order_id === this.args[4]
              && candidate.source_repair_record_id === this.args[5]
              && candidate.contributor_engineer_id === this.args[6]
              && state.workOrder.id === this.args[7]
              && state.workOrder.engineer_id === this.args[8]
              && state.workOrder.status === this.args[9]
              && state.report.id === this.args[10]
              && state.report.work_order_id === this.args[11]
              && state.report.report_quality_status === 'submitted';
            if (!allowed) return { meta: { changes: 0 } };
            state.events.push({ id: this.args[0], candidate_id: candidate.id, actor_type: 'admin', actor_user_id: this.args[1], action: 'admin_created_candidate' });
            return { meta: { changes: 1 } };
          }
          state.events.push(
            { id: this.args[0], candidate_id: this.args[1], actor_type: this.args[2], actor_user_id: this.args[3], action: this.args[4] });
          return { meta: { changes: 1 } };
        }
        if (/UPDATE engineers SET rating_timeliness = \(SELECT AVG/i.test(normalized)) {
          const allowed = (
            state.workOrder.id === this.args[6]
            && state.workOrder.customer_id === this.args[7]
            && state.workOrder.engineer_id === this.args[8]
            && state.workOrder.status === this.args[9]
            && state.report.id === this.args[10]
            && state.report.work_order_id === this.args[11]
            && state.report.report_quality_status === 'submitted'
            && state.report.customer_confirmed_at
            && state.ratings.some((row) => (
              row.work_order_id === this.args[12]
              && row.customer_id === this.args[13]
              && row.engineer_id === this.args[14]
            ))
            && state.candidates.some((row) => (
              row.source_work_order_id === this.args[15]
              && row.source_repair_record_id === this.args[16]
              && row.contributor_engineer_id === this.args[17]
            ))
          );
          if (allowed) state.aggregateWrites += 1;
          return { meta: { changes: allowed ? 1 : 0 } };
        }
        if (/UPDATE work_orders SET status = 'completed'/i.test(normalized)) {
          const complete = (
            state.workOrder.id === this.args[0]
            && state.workOrder.customer_id === this.args[1]
            && state.workOrder.engineer_id === this.args[2]
            && state.workOrder.status === this.args[3]
            && state.ratings.some((row) => row.work_order_id === this.args[4])
            && state.report.id === this.args[5]
            && state.report.work_order_id === this.args[6]
            && state.report.report_quality_status === 'submitted'
            && state.report.customer_confirmed_at
            && state.candidates.some((row) => row.source_repair_record_id === this.args[7])
          );
          if (complete) state.workOrder.status = 'completed';
          return { meta: { changes: complete ? 1 : 0 } };
        }
        if (/INSERT INTO notifications/i.test(normalized)) {
          state.notifications.push({ id: this.args[0], type: this.args[3] });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      },
    };
  }

  const env = {
    JWT_SECRET: 'candidate-test-secret-with-enough-length',
    DB: {
      prepare: statement,
      async batch(statements) {
        state.batchCalls += 1;
        beforeBatch?.(state);
        const snapshot = structuredClone(state);
        try {
          const results = [];
          for (const item of statements) results.push(await item.run());
          return results;
        } catch (error) {
          Object.assign(state, snapshot);
          throw error;
        }
      },
    },
    KV: { async get() { return null; }, async put() {} },
  };
  return { env, state };
}

async function authenticatedRequest(env, { type, path, body, host = 'api.sagemro.com' }) {
  const token = await signJwt({
    userId: `${type}-1`,
    userType: type,
    market: host.endsWith('.cn') ? 'cn' : 'com',
    iat: 1,
  }, env.JWT_SECRET);
  const response = await worker.fetch(new Request(`https://${host}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

const ratingBody = {
  work_order_id: 'work-1',
  rating_timeliness: 5,
  rating_technical: 5,
  rating_communication: 5,
  rating_professional: 5,
  comment: 'Resolved.',
  market: 'cn',
};

test('rating scores accept frontend numbers and trimmed integer strings only', () => {
  for (const value of [1, 2, 3, 4, 5, '1', ' 5 ']) {
    assert.equal(parseRatingScore(value), Number(String(value).trim()));
  }
  for (const value of [null, undefined, '', ' ', true, false, [], {}, 0, 6, -1, 1.5, NaN, Infinity, '01', '1.0', '5x']) {
    assert.equal(parseRatingScore(value), null, `accepted ${String(value)}`);
  }
});

test('rating endpoint rejects any invalid score with a stable 400 before database writes', async () => {
  for (const invalid of [null, '', true, [], {}, 0, 6, 1.5, '1.0']) {
    const { env, state } = createCandidateEnv();
    const result = await authenticatedRequest(env, {
      type: 'customer',
      path: '/api/workorders/rating',
      body: { ...ratingBody, rating_technical: invalid },
    });
    assert.equal(result.response.status, 400, `accepted ${String(invalid)}`);
    assert.equal(result.json.error, 'invalid_rating_scores');
    assert.equal(state.batchCalls, 0);
  }
});

test('customer rating atomically confirms a submitted report and creates a server-market candidate', async () => {
  const { env, state } = createCandidateEnv();
  const result = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });

  assert.equal(result.response.status, 200, JSON.stringify({ response: result.json, state }));
  assert.equal(result.json.success, true);
  assert.equal(result.json.rating_status, 'created');
  assert.equal(result.json.candidate.status, 'created');
  assert.equal(state.workOrder.status, 'completed');
  assert.ok(state.report.customer_confirmed_at);
  assert.equal(state.candidates[0].market, 'global');
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].actor_type, 'customer');
  assert.equal(state.events[0].actor_user_id, 'customer-1');
  assert.equal(state.notifications.length, 1);
  assert.equal(state.settlementCalls, 0, 'customer rating must not auto-settle the legacy wallet');
  assert.equal(state.payoutCalls, 1);
  const aggregate = state.executed.find((item) => /UPDATE engineers SET rating_timeliness = \(SELECT AVG/i.test(item.sql));
  assert.deepEqual(aggregate.args, [
    'engineer-1', 'engineer-1', 'engineer-1', 'engineer-1', 'engineer-1', 'engineer-1',
    'work-1', 'customer-1', 'engineer-1', 'resolved', 'repair-1', 'work-1',
    'work-1', 'customer-1', 'engineer-1', 'work-1', 'repair-1', 'engineer-1',
  ]);
});

test('customer rating requires ownership and a submitted report', async () => {
  const ownership = createCandidateEnv();
  ownership.state.workOrder.customer_id = 'someone-else';
  const forbidden = await authenticatedRequest(ownership.env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
  assert.equal(forbidden.response.status, 403);
  assert.equal(ownership.state.batchCalls, 0);

  const draft = createCandidateEnv({ reportStatus: 'draft' });
  const rejected = await authenticatedRequest(draft.env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
  assert.equal(rejected.response.status, 409);
  assert.equal(rejected.json.error, 'service_report_not_submitted');
  assert.equal(draft.state.batchCalls, 0);
});

test('candidate write failure rolls back rating and does not report a completed work order', async () => {
  const { env, state } = createCandidateEnv({ candidateFailure: true });
  const result = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });

  assert.equal(result.response.status, 500);
  assert.equal(result.json.error, 'Unable to confirm rating');
  assert.equal(state.ratings.length, 0);
  assert.equal(state.candidates.length, 0);
  assert.equal(state.events.length, 0);
  assert.equal(state.workOrder.status, 'resolved');
  assert.equal(state.report.customer_confirmed_at, null);
});

test('rating retry recovers idempotently without duplicate rating, candidate, event, or notification', async () => {
  const { env, state } = createCandidateEnv();
  const first = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
  const second = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });

  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(second.json.rating_status, 'existing');
  assert.equal(second.json.candidate.status, 'existing');
  assert.equal(state.ratings.length, 1);
  assert.equal(state.candidates.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.notifications.length, 1);
});

test('customer rating records confirmation once when an admin candidate already exists', async () => {
  const { env, state } = createCandidateEnv({ existingCandidate: true, existingCandidateId: 'historical-candidate-id' });

  const first = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
  const second = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });

  assert.equal(first.response.status, 200);
  assert.equal(first.json.candidate.status, 'existing');
  assert.equal(second.response.status, 200);
  assert.equal(state.workOrder.status, 'completed');
  assert.ok(state.report.customer_confirmed_at);
  assert.equal(state.candidates.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].action, 'customer_confirmed_candidate');
  assert.equal(state.events[0].actor_type, 'customer');
  assert.equal(state.events[0].actor_user_id, 'customer-1');
  assert.equal(state.events[0].candidate_id, 'historical-candidate-id');
});

test('candidate appearing after pre-read keeps the customer event idempotent and references its stored id', async () => {
  const { env, state } = createCandidateEnv({
    beforeBatch(current) {
      if (current.candidates.length === 0) {
        current.candidates.push({
          id: 'raced-candidate-id',
          status: 'awaiting_operations',
          source_work_order_id: 'work-1',
          source_repair_record_id: 'repair-1',
          contributor_engineer_id: 'engineer-1',
          market: 'global',
          evidence_notes: 'Admin verified: Concurrent review.',
        });
      }
    },
  });

  const first = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
  const second = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });

  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].candidate_id, 'raced-candidate-id');
});

test('snapshot drift before the core batch leaves no partial confirmation facts', async () => {
  const driftCases = [
    (state) => { state.workOrder.customer_id = 'changed-customer'; },
    (state) => { state.workOrder.engineer_id = 'changed-engineer'; },
    (state) => { state.workOrder.status = 'completed'; },
    (state) => { state.workOrder.status = 'cancelled'; },
    (state) => { state.report.work_order_id = 'changed-work-order'; },
    (state) => { state.report.report_quality_status = 'draft'; },
  ];
  for (const drift of driftCases) {
    const { env, state } = createCandidateEnv({ beforeBatch: drift });
    const result = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
    assert.equal(result.response.status, 409);
    assert.equal(result.json.error, 'rating_confirmation_conflict');
    assert.equal(state.ratings.length, 0);
    assert.equal(state.candidates.length, 0);
    assert.equal(state.events.length, 0);
    assert.equal(state.report.customer_confirmed_at, null);
  }
});

test('rating retry does not update engineer aggregates when the submitted repair snapshot drifts', async () => {
  const driftCases = [
    (state) => { state.report.report_quality_status = 'draft'; },
    (state) => { state.report.work_order_id = 'changed-work-order'; },
  ];
  for (const drift of driftCases) {
    let batchCount = 0;
    const { env, state } = createCandidateEnv({
      beforeBatch(current) {
        batchCount += 1;
        if (batchCount === 2) drift(current);
      },
    });
    const first = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
    assert.equal(first.response.status, 200);
    assert.equal(state.aggregateWrites, 1);

    const retry = await authenticatedRequest(env, { type: 'customer', path: '/api/workorders/rating', body: ratingBody });
    assert.equal(retry.response.status, 409);
    assert.equal(retry.json.error, 'rating_confirmation_conflict');
    assert.equal(state.aggregateWrites, 1);
  }
});

test('admin candidate creation requires a reason and never fabricates customer confirmation', async () => {
  const missing = createCandidateEnv();
  const invalid = await authenticatedRequest(missing.env, {
    type: 'admin', path: '/api/admin/workorders/work-1/knowledge-candidate', body: { reason: '   ', market: 'cn' },
  });
  assert.equal(invalid.response.status, 400, JSON.stringify(invalid.json));
  assert.equal(missing.state.candidates.length, 0);

  const { env, state } = createCandidateEnv();
  const created = await authenticatedRequest(env, {
    type: 'admin', path: '/api/admin/workorders/work-1/knowledge-candidate', body: { reason: 'Reviewed service evidence.', market: 'cn' },
  });
  const repeated = await authenticatedRequest(env, {
    type: 'admin', path: '/api/admin/workorders/work-1/knowledge-candidate', body: { reason: 'Reviewed service evidence.', market: 'cn' },
  });

  assert.equal(created.response.status, 201, JSON.stringify({ response: created.json, state }));
  assert.equal(created.json.candidate.status, 'created');
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.json.candidate.status, 'existing');
  assert.equal(state.candidates.length, 1);
  assert.equal(state.candidates[0].market, 'global');
  assert.equal(state.candidates[0].evidence_notes, 'Admin verified: Reviewed service evidence.');
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].action, 'admin_created_candidate');
  assert.equal(state.events[0].actor_type, 'admin');
  assert.equal(state.report.customer_confirmed_at, null);
});

test('admin event failure rolls back candidate creation and a retry creates both once', async () => {
  const { env, state } = createCandidateEnv({ eventFailure: true });
  const request = {
    type: 'admin',
    path: '/api/admin/workorders/work-1/knowledge-candidate',
    body: { reason: 'Reviewed service evidence.' },
  };

  const failed = await authenticatedRequest(env, request);
  assert.equal(failed.response.status, 500);
  assert.equal(failed.json.error, 'Unable to create knowledge candidate');
  assert.equal(state.candidates.length, 0);
  assert.equal(state.events.length, 0);

  state.failEvents = false;
  const recovered = await authenticatedRequest(env, request);
  const repeated = await authenticatedRequest(env, request);
  assert.equal(recovered.response.status, 201);
  assert.equal(repeated.response.status, 200);
  assert.equal(state.candidates.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].action, 'admin_created_candidate');
});

test('admin candidate uses the stored concurrent candidate id without creating an admin event', async () => {
  const { env, state } = createCandidateEnv({
    beforeBatch(current) {
      if (current.candidates.length === 0) {
        current.candidates.push({
          id: 'concurrent-admin-candidate',
          status: 'awaiting_operations',
          source_work_order_id: 'work-1',
          source_repair_record_id: 'repair-1',
          contributor_engineer_id: 'engineer-1',
          market: 'global',
          evidence_notes: 'Admin verified: Concurrent review.',
        });
      }
    },
  });
  const result = await authenticatedRequest(env, {
    type: 'admin', path: '/api/admin/workorders/work-1/knowledge-candidate', body: { reason: 'Reviewed service evidence.' },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.json.candidate.id, 'concurrent-admin-candidate');
  assert.equal(result.json.candidate.status, 'existing');
  assert.equal(state.candidates.length, 1);
  assert.equal(state.events.length, 0);
});

test('admin candidate snapshot drift leaves no candidate or event facts', async () => {
  const driftCases = [
    (state) => { state.report.report_quality_status = 'draft'; },
    (state) => { state.report.work_order_id = 'changed-work-order'; },
  ];
  for (const drift of driftCases) {
    const { env, state } = createCandidateEnv({ beforeBatch: drift });
    const result = await authenticatedRequest(env, {
      type: 'admin', path: '/api/admin/workorders/work-1/knowledge-candidate', body: { reason: 'Reviewed service evidence.' },
    });

    assert.equal(result.response.status, 409);
    assert.equal(result.json.error, 'knowledge_candidate_creation_conflict');
    assert.equal(state.candidates.length, 0);
    assert.equal(state.events.length, 0);
  }
});
