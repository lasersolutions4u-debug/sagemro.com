import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createPaymentFlowEnv() {
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'admin-pass',
    __payments: [],
    __messages: [],
    __notifications: [],
    __auditLogs: [],
    __logs: [],
    __ratings: [],
    __knowledgeCandidates: [],
    __knowledgeCandidateEvents: [],
    __wallets: [],
    __payouts: [],
    __workOrders: [{
      id: 'wo-pay-1',
      order_no: 'WO-PAY-1',
      customer_id: 'customer-1',
      engineer_id: 'engineer-1',
      status: 'pending_payment',
    }],
    __pricing: [{
      id: 'price-1',
      work_order_id: 'wo-pay-1',
      subtotal: 5400,
      total_amount: 5400,
      status: 'confirmed',
    }],
    __repairRecords: [{
      id: 'repair-pay-1',
      work_order_id: 'wo-pay-1',
      symptom: 'Laser cutting quality dropped after lens contamination.',
      inspection_process: 'Inspected the protective lens, optical path, nozzle alignment, and assist gas pressure.',
      diagnosis: 'Protective lens contaminated and gas pressure unstable.',
      solution: 'Replaced lens, cleaned optical path, and tuned gas pressure.',
      verification_result: 'Completed repeated pierces and cuts with stable pressure and acceptable edge quality.',
      follow_up_advice: 'Inspect the protective lens daily and verify assist gas pressure before production.',
      parts_used: JSON.stringify([{ name: 'Protective lens', qty: 1, unit: 'pcs' }]),
      labor_hours: 2,
      report_quality_status: 'draft',
      submitted_at: null,
      customer_confirmed_at: null,
    }],
    __engineers: [{
      id: 'engineer-1',
      name: 'Test Engineer',
      company: 'Field Service Team',
      user_no: 'E-000001',
      commission_rate: 0.8,
      wallet_balance: 0,
      payout_method: 'paypal',
    }],
    __customers: [{
      id: 'customer-1',
      name: 'Test Customer',
      company: 'Test Metal Works',
      user_no: 'C-000001',
    }],
    KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
  };

  env.DB = {
    prepare(sql) {
      return createStatement(env, sql);
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };

  return env;
}

function createStatement(env, sql) {
  return {
    args: [],
    bind(...args) {
      this.args = args;
      return this;
    },
    async first() {
      const normalized = normalizeSql(sql);

      if (/FROM work_orders wo JOIN work_order_repair_records r ON r.work_order_id = wo.id WHERE wo.id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        const report = env.__repairRecords.find((item) => item.work_order_id === this.args[0]);
        return order && report
          ? { ...order, ...report, id: order.id, repair_record_id: report.id }
          : null;
      }

      if (/SELECT id, customer_id, status, order_no, engineer_id FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { ...order } : null;
      }

      if (/SELECT id, engineer_id, status, order_no FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { id: order.id, engineer_id: order.engineer_id, status: order.status, order_no: order.order_no } : null;
      }

      if (/SELECT id, status, order_no FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { id: order.id, status: order.status, order_no: order.order_no } : null;
      }

      if (/SELECT subtotal, total_amount FROM work_order_pricing WHERE work_order_id = \? AND status = \?/i.test(normalized)) {
        return env.__pricing.find((item) => item.work_order_id === this.args[0] && item.status === this.args[1]) || null;
      }

      if (/SELECT \* FROM work_order_payments WHERE work_order_id = \?/i.test(normalized)) {
        return env.__payments.filter((item) => item.work_order_id === this.args[0]).at(-1) || null;
      }

      if (/SELECT id, status, payment_method FROM work_order_payments WHERE work_order_id = \?/i.test(normalized)) {
        const payment = env.__payments.filter((item) => item.work_order_id === this.args[0]).at(-1);
        return payment ? { id: payment.id, status: payment.status, payment_method: payment.payment_method } : null;
      }

      if (/SELECT status, engineer_id FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { status: order.status, engineer_id: order.engineer_id } : null;
      }

      if (/SELECT symptom, inspection_process, diagnosis, solution, verification_result, follow_up_advice, parts_used, labor_hours, report_quality_status FROM work_order_repair_records WHERE work_order_id = \?/i.test(normalized)) {
        return env.__repairRecords.find((item) => item.work_order_id === this.args[0]) || null;
      }

      if (/SELECT customer_id, order_no FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { customer_id: order.customer_id, order_no: order.order_no } : null;
      }

      if (/SELECT id, engineer_id, customer_id, status FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { id: order.id, engineer_id: order.engineer_id, customer_id: order.customer_id, status: order.status } : null;
      }

      if (/SELECT id FROM ratings WHERE work_order_id = \?/i.test(normalized)) {
        const rating = env.__ratings.find((item) => item.work_order_id === this.args[0]);
        return rating ? { id: rating.id } : null;
      }

      if (/SELECT id FROM engineer_wallets WHERE work_order_id = \? AND engineer_id = \?/i.test(normalized)) {
        const wallet = env.__wallets.find((item) => item.work_order_id === this.args[0] && item.engineer_id === this.args[1]);
        return wallet ? { id: wallet.id } : null;
      }

      if (/SELECT id, subtotal, status FROM work_order_pricing WHERE work_order_id = \?/i.test(normalized)) {
        return env.__pricing.find((item) => item.work_order_id === this.args[0]) || null;
      }

      if (/SELECT commission_rate, wallet_balance FROM engineers WHERE id = \?/i.test(normalized)) {
        const engineer = env.__engineers.find((item) => item.id === this.args[0]);
        return engineer ? { commission_rate: engineer.commission_rate, wallet_balance: engineer.wallet_balance } : null;
      }

      if (/SELECT \* FROM work_order_payouts WHERE work_order_id = \?/i.test(normalized)) {
        return env.__payouts.find((item) => item.work_order_id === this.args[0]) || null;
      }

      if (/SELECT payout_method FROM engineers WHERE id = \?/i.test(normalized)) {
        const engineer = env.__engineers.find((item) => item.id === this.args[0]);
        return engineer ? { payout_method: engineer.payout_method } : null;
      }

      if (/SELECT \* FROM work_order_payouts WHERE id = \?/i.test(normalized)) {
        return env.__payouts.find((item) => item.id === this.args[0]) || null;
      }

      if (/SELECT order_no FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { order_no: order.order_no } : null;
      }

      if (/SELECT COUNT\(\*\) as count FROM ratings r/i.test(normalized)) {
        return { count: env.__ratings.length };
      }

      if (/SELECT id FROM knowledge_candidates WHERE source_repair_record_id = \?/i.test(normalized)) {
        return env.__knowledgeCandidates.find((item) => item.source_repair_record_id === this.args[0]) || null;
      }

      if (/SELECT status, customer_id, engineer_id FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order || null;
      }

      if (/FROM work_order_repair_records WHERE id = \?/i.test(normalized)) {
        const report = env.__repairRecords.find((item) => item.id === this.args[0]);
        return report ? {
          work_order_id: report.work_order_id,
          customer_confirmed_at: report.customer_confirmed_at,
          report_quality_status: report.report_quality_status,
        } : null;
      }

      if (/SELECT id, status(?:,| FROM) .*knowledge_candidates WHERE source_repair_record_id = \?/i.test(normalized)) {
        const candidate = env.__knowledgeCandidates.find((item) => item.source_repair_record_id === this.args[0]);
        return candidate || null;
      }

      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);

      if (/SELECT \* FROM ratings WHERE engineer_id = \?/i.test(normalized)) {
        return { results: env.__ratings.filter((item) => item.engineer_id === this.args[0]) };
      }

      if (/FROM ratings r LEFT JOIN customers c ON r.customer_id = c.id LEFT JOIN engineers e ON r.engineer_id = e.id LEFT JOIN work_orders w ON r.work_order_id = w.id/i.test(normalized)) {
        return {
          results: env.__ratings.map((rating) => {
            const customer = env.__customers.find((item) => item.id === rating.customer_id) || {};
            const engineer = env.__engineers.find((item) => item.id === rating.engineer_id) || {};
            const order = env.__workOrders.find((item) => item.id === rating.work_order_id) || {};
            return {
              ...rating,
              customer_name: customer.name,
              customer_company: customer.company,
              customer_no: customer.user_no,
              engineer_name: engineer.name,
              engineer_company: engineer.company,
              engineer_no: engineer.user_no,
              order_no: order.order_no,
            };
          }),
        };
      }

      if (/SELECT \* FROM admin_replies WHERE rating_id IN/i.test(normalized)) {
        return { results: [] };
      }

      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO work_order_payments/i.test(normalized)) {
        const [id, work_order_id, customer_id, amount, payment_method, transaction_id, status] = this.args;
        env.__payments.push({ id, work_order_id, customer_id, amount, payment_method, transaction_id, status });
      }

      if (/UPDATE work_order_payments SET status = 'pending_admin_confirmation'/i.test(normalized)) {
        const payment = env.__payments.find((item) => item.work_order_id === this.args[0]);
        if (payment) payment.status = 'pending_admin_confirmation';
      }

      if (/UPDATE work_order_payments SET status = 'completed'/i.test(normalized)) {
        const payment = env.__payments.find((item) => item.work_order_id === this.args[0]);
        if (payment) payment.status = 'completed';
      }

      if (/UPDATE work_orders SET status = 'payment_review'/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        if (order) order.status = 'payment_review';
      }

      if (/UPDATE work_orders SET status = 'in_service'/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        if (order) order.status = 'in_service';
      }

      if (/UPDATE work_orders SET status = 'resolved'/i.test(normalized)) {
        const [workOrderId, engineerId, reportWorkOrderId] = this.args;
        const order = env.__workOrders.find((item) => item.id === workOrderId);
        const report = env.__repairRecords.find((item) => item.work_order_id === reportWorkOrderId);
        if (
          order?.engineer_id === engineerId
          && ['in_service', 'pricing'].includes(order.status)
          && reportWorkOrderId === workOrderId
          && report?.report_quality_status === 'submitted'
        ) {
          order.status = 'resolved';
        } else {
          return { success: true, meta: { changes: 0 } };
        }
      }

      if (/UPDATE work_order_repair_records SET report_quality_status = 'submitted'/i.test(normalized)) {
        const [
          workOrderId,
          expectedWorkOrderId,
          engineerId,
          symptom,
          inspectionProcess,
          diagnosis,
          solution,
          verificationResult,
          followUpAdvice,
          partsUsed,
          laborHours,
          qualityStatus,
        ] = this.args;
        const order = env.__workOrders.find((item) => item.id === expectedWorkOrderId);
        const record = env.__repairRecords.find((item) => item.work_order_id === workOrderId);
        if (
          order?.engineer_id === engineerId
          && ['in_service', 'pricing'].includes(order.status)
          && record?.symptom === symptom
          && record.inspection_process === inspectionProcess
          && record.diagnosis === diagnosis
          && record.solution === solution
          && record.verification_result === verificationResult
          && record.follow_up_advice === followUpAdvice
          && record.parts_used === partsUsed
          && record.labor_hours === laborHours
          && record.report_quality_status === qualityStatus
        ) {
          record.report_quality_status = 'submitted';
          record.submitted_at = '2026-08-13T00:00:00Z';
        } else {
          return { success: true, meta: { changes: 0 } };
        }
      }

      if (/UPDATE work_orders SET status = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[1]);
        if (order) order.status = this.args[0];
      }

      if (/INSERT INTO work_order_logs/i.test(normalized)) {
        env.__logs.push({ args: this.args });
      }

      if (/INSERT INTO ratings/i.test(normalized)) {
        const [id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment] = this.args;
        if (env.__ratings.some((item) => item.work_order_id === work_order_id)) {
          return { success: true, meta: { changes: 0 } };
        }
        env.__ratings.push({
          id,
          work_order_id,
          engineer_id,
          customer_id,
          rating_timeliness,
          rating_technical,
          rating_communication,
          rating_professional,
          comment,
          created_at: '2026-07-10T00:00:00Z',
        });
        return { success: true, meta: { changes: 1 } };
      }

      if (/UPDATE work_order_repair_records SET customer_confirmed_at/i.test(normalized)) {
        const report = env.__repairRecords.find((item) => item.id === this.args[0] && item.work_order_id === this.args[1]);
        if (!report || report.report_quality_status !== 'submitted') return { success: true, meta: { changes: 0 } };
        report.customer_confirmed_at ||= '2026-08-13T00:00:00Z';
        return { success: true, meta: { changes: 1 } };
      }

      if (/INSERT INTO knowledge_candidates/i.test(normalized)) {
        const [id, market, workOrderId, repairRecordId, engineerId, rawContent, internalUseAllowed, evidenceNotes] = this.args;
        if (env.__knowledgeCandidates.some((item) => item.source_repair_record_id === repairRecordId)) {
          return { success: true, meta: { changes: 0 } };
        }
        env.__knowledgeCandidates.push({
          id,
          market,
          source_work_order_id: workOrderId,
          source_repair_record_id: repairRecordId,
          contributor_engineer_id: engineerId,
          raw_content: rawContent,
          internal_use_allowed: internalUseAllowed,
          evidence_notes: evidenceNotes,
          status: 'awaiting_operations',
        });
        return { success: true, meta: { changes: 1 } };
      }

      if (/INSERT OR IGNORE INTO knowledge_candidate_events/i.test(normalized)) {
        if (env.__knowledgeCandidateEvents.some((item) => item.id === this.args[0])) {
          return { success: true, meta: { changes: 0 } };
        }
        const customerConfirmation = /customer_confirmed_candidate/i.test(normalized);
        const candidate = customerConfirmation
          ? env.__knowledgeCandidates.find((item) => item.source_repair_record_id === this.args[3])
          : null;
        env.__knowledgeCandidateEvents.push(customerConfirmation ? {
          id: this.args[0],
          candidate_id: candidate?.id,
          actor_type: 'customer',
          actor_user_id: this.args[1],
          action: 'customer_confirmed_candidate',
        } : {
          id: this.args[0],
          candidate_id: this.args[1],
          actor_type: this.args[2],
          actor_user_id: this.args[3],
          action: this.args[4],
        });
        return { success: true, meta: { changes: 1 } };
      }

      if (/UPDATE engineers SET rating_timeliness = \(SELECT AVG/i.test(normalized)) {
        const engineerId = this.args[5];
        const engineer = env.__engineers.find((item) => item.id === engineerId);
        const ratings = env.__ratings.filter((item) => item.engineer_id === engineerId);
        if (engineer && ratings.length) {
          engineer.rating_timeliness = ratings.reduce((sum, item) => sum + item.rating_timeliness, 0) / ratings.length;
          engineer.rating_technical = ratings.reduce((sum, item) => sum + item.rating_technical, 0) / ratings.length;
          engineer.rating_communication = ratings.reduce((sum, item) => sum + item.rating_communication, 0) / ratings.length;
          engineer.rating_professional = ratings.reduce((sum, item) => sum + item.rating_professional, 0) / ratings.length;
          engineer.rating_count = ratings.length;
        }
      }

      if (/UPDATE engineers SET rating_timeliness = \?/i.test(normalized)) {
        const engineer = env.__engineers.find((item) => item.id === this.args.at(-1));
        if (engineer) {
          engineer.rating_timeliness = this.args[0];
          engineer.rating_technical = this.args[1];
          engineer.rating_communication = this.args[2];
          engineer.rating_professional = this.args[3];
          engineer.rating_count = this.args[4];
        }
      }

      if (/UPDATE work_orders SET status = 'completed'/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        const report = env.__repairRecords.find((item) => item.id === this.args[5]);
        const rating = env.__ratings.find((item) => item.work_order_id === this.args[4]);
        const candidate = env.__knowledgeCandidates.find((item) => item.source_repair_record_id === this.args[7]);
        if (
          order?.customer_id === this.args[1]
          && order.engineer_id === this.args[2]
          && order.status === this.args[3]
          && rating
          && report?.report_quality_status === 'submitted'
          && report.customer_confirmed_at
          && candidate
        ) {
          order.status = 'completed';
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      }

      if (/UPDATE engineers SET wallet_balance = \?/i.test(normalized)) {
        const engineer = env.__engineers.find((item) => item.id === this.args[1]);
        if (engineer) {
          engineer.wallet_balance = this.args[0];
          engineer.total_orders = (engineer.total_orders || 0) + 1;
          engineer.success_orders = (engineer.success_orders || 0) + 1;
        }
      }

      if (/INSERT INTO engineer_wallets/i.test(normalized)) {
        const [id, engineer_id, work_order_id, amount, balance_after] = this.args;
        env.__wallets.push({ id, engineer_id, work_order_id, amount, balance_after });
      }

      if (/INSERT INTO work_order_payouts/i.test(normalized)) {
        const [id, work_order_id, engineer_id, amount, currency, method, status] = this.args;
        env.__payouts.push({ id, work_order_id, engineer_id, amount, currency, method, status });
      }

      if (/INSERT INTO work_order_messages/i.test(normalized)) {
        env.__messages.push({ args: this.args });
      }

      if (/INSERT INTO notifications/i.test(normalized)) {
        env.__notifications.push({ args: this.args });
      }

      if (/INSERT INTO audit_logs/i.test(normalized)) {
        env.__auditLogs.push({ args: this.args });
      }

      return { success: true, meta: { changes: 1 } };
    },
  };
}

async function token(env, userType, userId) {
  return signJwt({
    userId,
    userType,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function api(env, path, { method = 'POST', body, userType = 'customer', userId = 'customer-1' } = {}) {
  const jwt = await token(env, userType, userId);
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

test('customer payment method confirmation does not start service automatically', async () => {
  const env = createPaymentFlowEnv();

  const { response, json } = await api(env, '/api/workorders/wo-pay-1/pay', {
    body: { payment_method: 'paypal_card' },
  });

  assert.equal(response.status, 200);
  assert.equal(json.payment.status, 'instructions_requested');
  assert.equal(env.__payments.at(-1).payment_method, 'paypal_card');
  assert.equal(env.__workOrders[0].status, 'pending_payment');
});

test('engineer requests service start after following up payment', async () => {
  const env = createPaymentFlowEnv();
  await api(env, '/api/workorders/wo-pay-1/pay', {
    body: { payment_method: 'bank_transfer' },
  });

  const { response, json } = await api(env, '/api/workorders/wo-pay-1/payment/start-request', {
    userType: 'engineer',
    userId: 'engineer-1',
    body: { note: 'Customer sent bank transfer receipt.' },
  });

  assert.equal(response.status, 200);
  assert.equal(json.status, 'payment_review');
  assert.equal(env.__payments.at(-1).status, 'pending_admin_confirmation');
  assert.equal(env.__workOrders[0].status, 'payment_review');
});

test('admin confirms payment before work order enters service', async () => {
  const env = createPaymentFlowEnv();
  await api(env, '/api/workorders/wo-pay-1/pay', {
    body: { payment_method: 'bank_transfer' },
  });
  await api(env, '/api/workorders/wo-pay-1/payment/start-request', {
    userType: 'engineer',
    userId: 'engineer-1',
    body: { note: 'Customer sent bank transfer receipt.' },
  });

  const { response, json } = await api(env, '/api/admin/workorders/wo-pay-1/payment/approve-start', {
    userType: 'admin',
    userId: 'admin-1',
    body: { note: 'Receipt confirmed in company account.' },
  });

  assert.equal(response.status, 200);
  assert.equal(json.status, 'in_service');
  assert.equal(env.__payments.at(-1).status, 'completed');
  assert.equal(env.__workOrders[0].status, 'in_service');
});

test('final service report opens customer review and creates admin service review record', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'in_service';

  const resolved = await api(env, '/api/workorders/wo-pay-1/resolve', {
    userType: 'engineer',
    userId: 'engineer-1',
    body: { engineer_id: 'engineer-1' },
  });

  assert.equal(resolved.response.status, 200);
  assert.equal(env.__workOrders[0].status, 'resolved');
  assert.equal(env.__repairRecords[0].report_quality_status, 'submitted');
  assert.ok(env.__repairRecords[0].submitted_at);
  assert.equal(env.__notifications.length, 1);

  const rated = await api(env, '/api/workorders/rating', {
    userType: 'customer',
    userId: 'customer-1',
    body: {
      work_order_id: 'wo-pay-1',
      rating_timeliness: 5,
      rating_technical: 5,
      rating_communication: 5,
      rating_professional: 5,
      comment: 'Service report received and accepted.',
    },
  });

  assert.equal(rated.response.status, 200, JSON.stringify({
    response: rated.json,
    workOrders: env.__workOrders,
    repairRecords: env.__repairRecords,
    candidates: env.__knowledgeCandidates,
  }));
  assert.equal(env.__workOrders[0].status, 'completed');
  assert.equal(env.__ratings.length, 1);
  assert.ok(env.__repairRecords[0].customer_confirmed_at);
  assert.equal(env.__knowledgeCandidates.length, 1);
  assert.equal(env.__knowledgeCandidates[0].market, 'global');
  assert.equal(env.__knowledgeCandidateEvents.length, 1);
  assert.equal(env.__knowledgeCandidateEvents[0].action, 'customer_confirmed_candidate');

  const reviews = await api(env, '/api/admin/ratings?page=1&pageSize=20', {
    method: 'GET',
    userType: 'admin',
    userId: 'admin-1',
  });

  assert.equal(reviews.response.status, 200);
  assert.equal(reviews.json.total, 1);
  assert.equal(reviews.json.list[0].order_no, 'WO-PAY-1');
  assert.equal(reviews.json.list[0].comment, 'Service report received and accepted.');
});
