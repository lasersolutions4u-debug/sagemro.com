import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';
import { buildServiceStandardDefinition } from '../src/lib/serviceStandard.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function serviceStandardRows(state = 'legacy_not_recorded') {
  return buildServiceStandardDefinition({ serviceMode: 'remote' }).items.map((item) => ({
    work_order_id: 'wo-pay-1',
    standard_version: 1,
    step_key: item.stepKey,
    item_key: item.key,
    state,
    is_required: item.required ? 1 : 0,
    owner_type: item.owner,
    confirmed_by_type: null,
    confirmed_by_id: null,
    confirmed_at: null,
    evidence_type: null,
    evidence_id: null,
    not_applicable_reason: null,
  }));
}

function createPaymentFlowEnv() {
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'admin-pass',
    __payments: [],
    __paymentReads: 0,
    __invoiceReads: 0,
    __invoiceWrites: 0,
    __messages: [],
    __notifications: [],
    __auditLogs: [],
    __logs: [],
    __ratings: [],
    __knowledgeCandidates: [],
    __knowledgeCandidateEvents: [],
    __wallets: [],
    __payouts: [],
    __progress: serviceStandardRows(),
    __overrides: [],
    __failNextAudit: false,
    __failServiceStandardEventAudit: false,
    __workOrders: [{
      id: 'wo-pay-1',
      order_no: 'WO-PAY-1',
      customer_id: 'customer-1',
      engineer_id: 'engineer-1',
      status: 'pending_payment',
      active_quote_version: null,
      service_mode: 'remote',
      quote_expected_service_days: null,
      approved_extension_days: 0,
    }],
    __pricing: [{
      id: 'price-1',
      work_order_id: 'wo-pay-1',
      labor_fee: 3600,
      parts_fee: 1200,
      travel_fee: 400,
      other_fee: 200,
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
      const snapshot = structuredClone({
        payments: env.__payments,
        messages: env.__messages,
        notifications: env.__notifications,
        auditLogs: env.__auditLogs,
        logs: env.__logs,
        ratings: env.__ratings,
        payouts: env.__payouts,
        progress: env.__progress,
        workOrders: env.__workOrders,
        engineers: env.__engineers,
      });
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
      } catch (error) {
        env.__payments = snapshot.payments;
        env.__messages = snapshot.messages;
        env.__notifications = snapshot.notifications;
        env.__auditLogs = snapshot.auditLogs;
        env.__logs = snapshot.logs;
        env.__ratings = snapshot.ratings;
        env.__payouts = snapshot.payouts;
        env.__progress = snapshot.progress;
        env.__workOrders = snapshot.workOrders;
        env.__engineers = snapshot.engineers;
        throw error;
      }
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

      if (/SELECT id, customer_id, status FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { id: order.id, customer_id: order.customer_id, status: order.status } : null;
      }

      if (/SELECT id, customer_id, engineer_id, assigned_regional_lead_id, quote_review_status FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? {
          id: order.id,
          customer_id: order.customer_id,
          engineer_id: order.engineer_id,
          assigned_regional_lead_id: order.assigned_regional_lead_id,
          quote_review_status: order.quote_review_status || 'pending_review',
        } : null;
      }

      if (/SELECT id, customer_id, engineer_id, assigned_regional_lead_id FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? {
          id: order.id,
          customer_id: order.customer_id,
          engineer_id: order.engineer_id,
          assigned_regional_lead_id: order.assigned_regional_lead_id,
        } : null;
      }

      if (/SELECT id, engineer_id, status, order_no FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { id: order.id, engineer_id: order.engineer_id, status: order.status, order_no: order.order_no } : null;
      }

      if (/SELECT id, engineer_id, status, order_no, customer_id, service_mode, active_quote_version, quote_expected_service_days, approved_extension_days FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { ...order } : null;
      }

      if (/SELECT id, order_no, engineer_id, status FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { id: order.id, order_no: order.order_no, engineer_id: order.engineer_id, status: order.status } : null;
      }

      if (/SELECT id, status, order_no FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { id: order.id, status: order.status, order_no: order.order_no } : null;
      }

      if (/SELECT subtotal, total_amount FROM work_order_pricing WHERE work_order_id = \? AND status = \?/i.test(normalized)) {
        return env.__pricing.find((item) => item.work_order_id === this.args[0] && item.status === this.args[1]) || null;
      }

      if (/SELECT subtotal, total_amount, labor_fee, parts_fee, travel_fee, other_fee(?:, quote_version)? FROM work_order_pricing WHERE work_order_id = \? AND status = \?/i.test(normalized)) {
        return env.__pricing.find((item) => item.work_order_id === this.args[0] && item.status === this.args[1]) || null;
      }

      if (/SELECT \* FROM work_order_pricing WHERE work_order_id = \?/i.test(normalized)) {
        return env.__pricing.find((item) => item.work_order_id === this.args[0]) || null;
      }

      if (/SELECT quote_version FROM work_order_pricing WHERE work_order_id = \?/i.test(normalized)) {
        const pricing = env.__pricing.find((item) => item.work_order_id === this.args[0]);
        return pricing ? { quote_version: pricing.quote_version } : null;
      }

      if (/SELECT \* FROM work_order_payments WHERE work_order_id = \? AND payment_stage = \?/i.test(normalized)) {
        env.__paymentReads += 1;
        return env.__payments.filter((item) => item.work_order_id === this.args[0] && (item.payment_stage || 'advance') === this.args[1]).at(-1) || null;
      }

      if (/FROM invoice_requests WHERE work_order_id = \?/i.test(normalized)) {
        env.__invoiceReads += 1;
        return null;
      }

      if (/SELECT amount FROM work_order_payments WHERE work_order_id = \?/i.test(normalized)) {
        env.__paymentReads += 1;
        return null;
      }

      if (/SELECT id, status, payment_method, payment_stage FROM work_order_payments WHERE work_order_id = \? AND payment_stage = \?/i.test(normalized)) {
        env.__paymentReads += 1;
        const payment = env.__payments.filter((item) => item.work_order_id === this.args[0] && (item.payment_stage || 'advance') === this.args[1]).at(-1);
        return payment ? { id: payment.id, status: payment.status, payment_method: payment.payment_method, payment_stage: payment.payment_stage || 'advance' } : null;
      }

      if (/SELECT id, status, engineer_id, customer_id, service_mode, active_quote_version, arrival_verification_required, arrival_verified_at FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? {
          id: order.id,
          status: order.status,
          engineer_id: order.engineer_id,
          customer_id: order.customer_id,
          service_mode: order.service_mode,
          active_quote_version: order.active_quote_version,
          arrival_verification_required: order.arrival_verification_required || 0,
          arrival_verified_at: order.arrival_verified_at || null,
        } : null;
      }

      if (/SELECT symptom, inspection_process, diagnosis, solution, verification_result, follow_up_advice, parts_used, labor_hours, report_quality_status FROM work_order_repair_records WHERE work_order_id = \?/i.test(normalized)) {
        return env.__repairRecords.find((item) => item.work_order_id === this.args[0]) || null;
      }

      if (/SELECT customer_id, order_no FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { customer_id: order.customer_id, order_no: order.order_no } : null;
      }

      if (/SELECT id, engineer_id, customer_id, status, active_quote_version, service_mode, arrival_verification_required FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? {
          id: order.id,
          engineer_id: order.engineer_id,
          customer_id: order.customer_id,
          status: order.status,
          active_quote_version: order.active_quote_version,
          service_mode: order.service_mode,
          arrival_verification_required: order.arrival_verification_required || 0,
        } : null;
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

      if (/SELECT \* FROM work_order_payments WHERE work_order_id = \?/i.test(normalized)) {
        return env.__payments.filter((item) => item.work_order_id === this.args[0]).at(-1) || null;
      }

      if (/FROM work_order_service_standard_progress/i.test(normalized) && /item_key = \?/i.test(normalized)) {
        return env.__progress.find((item) =>
          item.work_order_id === this.args[0]
          && item.standard_version === this.args[1]
          && item.item_key === this.args[2]) || null;
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

      if (/SELECT \* FROM work_order_payments WHERE work_order_id = \? ORDER BY created_at ASC/i.test(normalized)) {
        return { results: env.__payments.filter((item) => item.work_order_id === this.args[0]) };
      }

      if (/FROM work_order_service_standard_progress/i.test(normalized)) {
        return {
          results: env.__progress.filter((item) =>
            item.work_order_id === this.args[0] && item.standard_version === this.args[1]),
        };
      }

      if (/FROM work_order_service_gate_overrides/i.test(normalized)) {
        return {
          results: env.__overrides.filter((item) =>
            item.work_order_id === this.args[0] && !item.revoked_at),
        };
      }

      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO work_order_payments/i.test(normalized)) {
        const [id, work_order_id, customer_id, amount, payment_method, transaction_id, status, payment_stage, quote_total_amount, advance_amount, balance_amount] = this.args;
        env.__payments.push({ id, work_order_id, customer_id, amount, payment_method, transaction_id, status, payment_stage: payment_stage || 'advance', quote_total_amount, advance_amount, balance_amount });
      }

      if (/INSERT OR IGNORE INTO work_order_service_standard_progress/i.test(normalized)) {
        const [workOrderId, standardVersion, stepKey, itemKey, isRequired, ownerType] = this.args;
        if (!env.__progress.some((item) =>
          item.work_order_id === workOrderId
          && item.standard_version === standardVersion
          && item.item_key === itemKey)) {
          env.__progress.push({
            work_order_id: workOrderId,
            standard_version: standardVersion,
            step_key: stepKey,
            item_key: itemKey,
            state: 'pending',
            is_required: isRequired,
            owner_type: ownerType,
          });
        }
      }

      if (/INSERT INTO invoice_requests/i.test(normalized)) env.__invoiceWrites += 1;

      if (/UPDATE work_order_payments SET status = 'pending_admin_confirmation' WHERE id =/i.test(normalized)) {
        const payment = env.__payments.find((item) => item.id === this.args[0]);
        if (payment) payment.status = 'pending_admin_confirmation';
      }

      if (/UPDATE work_order_payments SET status = 'completed'/i.test(normalized)) {
        const payment = env.__payments.find((item) => item.id === this.args[0] || item.work_order_id === this.args[0]);
        if (payment) payment.status = 'completed';
      }

      if (/UPDATE work_order_payments SET\s+customer_id =/i.test(normalized)) {
        const payment = env.__payments.find((item) => item.id === this.args.at(-1));
        if (payment) {
          payment.customer_id = this.args[0];
          payment.amount = this.args[1];
          payment.payment_method = this.args[2];
          payment.transaction_id = this.args[3];
          payment.status = this.args[4];
          payment.quote_total_amount = this.args[5];
          payment.advance_amount = this.args[6];
          payment.balance_amount = this.args[7];
        }
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

      if (/UPDATE work_orders SET status = 'completed', completed_at = datetime\('now'\)/i.test(normalized)) {
        const order = env.__workOrders.find((item) =>
          item.id === this.args[0]
          && item.customer_id === this.args[1]
          && ['resolved', 'pending_review'].includes(item.status));
        if (order) order.status = 'completed';
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

      if (/UPDATE work_order_payouts SET status = \?/i.test(normalized)) {
        const [status, amount, currency, method, transaction_reference, paid_at, internal_note, work_order_id] = this.args;
        const payout = env.__payouts.find((item) => item.work_order_id === work_order_id);
        if (payout) {
          Object.assign(payout, { status, amount, currency, method, transaction_reference, paid_at, internal_note });
        }
      }

      if (/INSERT INTO work_order_messages/i.test(normalized)) {
        env.__messages.push({ args: this.args });
      }

      if (/UPDATE work_order_service_standard_progress SET state = 'confirmed'/i.test(normalized)) {
        const [actorType, actorId, evidenceType, evidenceId, workOrderId, itemKey, ownerType] = this.args;
        const item = env.__progress.find((row) =>
          row.work_order_id === workOrderId
          && row.standard_version === 1
          && row.item_key === itemKey
          && [ownerType, 'system'].includes(row.owner_type)
          && row.state === 'pending');
        if (item) {
          Object.assign(item, {
            state: 'confirmed',
            confirmed_by_type: actorType,
            confirmed_by_id: actorId,
            confirmed_at: '2026-07-29 00:00:00',
            evidence_type: evidenceType,
            evidence_id: evidenceId,
          });
        }
      }

      if (/INSERT INTO notifications/i.test(normalized)) {
        env.__notifications.push({ args: this.args });
      }

      if (/INSERT INTO audit_logs/i.test(normalized)) {
        if (env.__failNextAudit) {
          env.__failNextAudit = false;
          throw new Error('audit insert failed');
        }
        if (/FROM work_order_service_standard_progress/i.test(normalized)) {
          if (env.__failServiceStandardEventAudit) {
            env.__failServiceStandardEventAudit = false;
            throw new Error('service-standard event audit insert failed');
          }
          const [
            id, actorType, actorId, targetId, beforeState, afterState, ip, device,
            workOrderId, itemKey, ownerType,
          ] = this.args;
          const item = env.__progress.find((row) =>
            row.work_order_id === workOrderId
            && row.standard_version === 1
            && row.item_key === itemKey
            && [ownerType, 'system'].includes(row.owner_type)
            && row.state === 'pending');
          if (item) {
            env.__auditLogs.push({
              args: [
                id, actorType, actorId, 'work_order', targetId,
                'service_standard_item_confirmed', beforeState, afterState, ip, device,
              ],
            });
          }
        } else {
          env.__auditLogs.push({ args: this.args });
        }
      }

      return { success: true, meta: { changes: 1 } };
    },
  };
}

async function token(env, userType, userId) {
  return signJwt({
    userId,
    userType,
    market: 'com',
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

test('payment quote exposes advance and balance amounts for service orders', async () => {
  const env = createPaymentFlowEnv();

  const { response, json } = await api(env, '/api/workorders/wo-pay-1/pricing', {
    method: 'GET',
    userType: 'customer',
    userId: 'customer-1',
  });

  assert.equal(response.status, 200);
  assert.equal(json.pricing.subtotal, 5400);
  assert.deepEqual(json.pricing.payment_policy, {
    subtotal: 5400,
    advance_amount: 3500,
    balance_amount: 1900,
    labor_fee: 3600,
    parts_fee: 1200,
    travel_fee: 400,
    other_fee: 200,
  });
});

test('versioned quotes never use the legacy advance and balance policy', async () => {
  const env = createPaymentFlowEnv();
  env.__pricing[0].quote_version = 1;
  env.__pricing[0].total_amount = {
    valueOf() { throw new Error('legacy payment policy was called'); },
    toJSON() { return 5400; },
  };

  const pricing = await api(env, '/api/workorders/wo-pay-1/pricing', {
    method: 'GET',
    userType: 'customer',
    userId: 'customer-1',
  });
  assert.equal(pricing.response.status, 200);
  assert.equal(pricing.json.pricing.payment_policy, null);

  const payment = await api(env, '/api/workorders/wo-pay-1/pay', {
    body: { payment_method: 'bank_transfer' },
  });
  assert.equal(payment.response.status, 409);
  assert.equal(env.__payments.length, 0);
});

test('versioned quotes reject every legacy payment and start route without reading or mutating legacy payments', async () => {
  const cases = [
    {
      name: 'customer advance payment',
      path: '/api/workorders/wo-pay-1/pay',
      options: { body: { payment_method: 'bank_transfer' } },
      workOrderStatus: 'pending_payment',
      paymentStage: 'advance',
      paymentStatus: 'instructions_requested',
    },
    {
      name: 'customer balance payment',
      path: '/api/workorders/wo-pay-1/pay',
      options: { body: { payment_method: 'bank_transfer', payment_stage: 'balance' } },
      workOrderStatus: 'resolved',
      paymentStage: 'balance',
      paymentStatus: 'awaiting_customer',
    },
    {
      name: 'customer payment while a supplemental is pending review',
      path: '/api/workorders/wo-pay-1/pay',
      options: { body: { payment_method: 'bank_transfer' } },
      workOrderStatus: 'pending_payment',
      pricingStatus: 'pending_review',
      paymentStage: 'advance',
      paymentStatus: 'instructions_requested',
    },
    {
      name: 'legacy payment status read',
      path: '/api/workorders/wo-pay-1/payment?payment_stage=advance',
      options: { method: 'GET' },
      workOrderStatus: 'pending_payment',
      paymentStage: 'advance',
      paymentStatus: 'instructions_requested',
    },
    {
      name: 'customer invoice request',
      path: '/api/workorders/wo-pay-1/invoice-request',
      options: { body: { company_name: 'Test Metal Works', tax_id: 'TAX-1' } },
      workOrderStatus: 'resolved',
      paymentStage: 'balance',
      paymentStatus: 'completed',
    },
    {
      name: 'engineer start request',
      path: '/api/workorders/wo-pay-1/payment/start-request',
      options: { userType: 'engineer', userId: 'engineer-1', body: { note: 'Legacy receipt.' } },
      workOrderStatus: 'pending_payment',
      paymentStage: 'advance',
      paymentStatus: 'instructions_requested',
    },
    {
      name: 'Admin start confirmation',
      path: '/api/admin/workorders/wo-pay-1/payment/approve-start',
      options: { userType: 'admin', userId: 'admin-1', body: { note: 'Legacy receipt confirmed.' } },
      workOrderStatus: 'pending_payment',
      paymentStage: 'advance',
      paymentStatus: 'instructions_requested',
    },
    {
      name: 'Admin balance confirmation',
      path: '/api/admin/workorders/wo-pay-1/payment/approve-balance',
      options: { userType: 'admin', userId: 'admin-1', body: { note: 'Legacy balance confirmed.' } },
      workOrderStatus: 'resolved',
      paymentStage: 'balance',
      paymentStatus: 'instructions_requested',
    },
  ];

  for (const item of cases) {
    const env = createPaymentFlowEnv();
    env.__pricing[0].quote_version = 1;
    if (['engineer start request', 'Admin start confirmation'].includes(item.name)) {
      env.__workOrders[0].active_quote_version = 1;
    }
    env.__pricing[0].status = item.pricingStatus || 'confirmed';
    env.__workOrders[0].status = item.workOrderStatus;
    env.__payments.push({
      id: `legacy-${item.paymentStage}`,
      work_order_id: 'wo-pay-1',
      payment_stage: item.paymentStage,
      payment_method: 'bank_transfer',
      status: item.paymentStatus,
      amount: item.paymentStage === 'advance' ? 3500 : 1900,
    });
    const beforePayments = structuredClone(env.__payments);

    const result = await api(env, item.path, item.options);

    assert.equal(result.response.status, 409, item.name);
    assert.match(result.json.error, /installment|schedule|active quote execution/i, item.name);
    assert.equal(env.__paymentReads, 0, item.name);
    assert.equal(env.__invoiceReads, 0, item.name);
    assert.equal(env.__invoiceWrites, 0, item.name);
    assert.deepEqual(env.__payments, beforePayments, item.name);
    assert.equal(env.__workOrders[0].status, item.workOrderStatus, item.name);
  }
});

test('customer payment request uses the advance amount rather than the full quote', async () => {
  const env = createPaymentFlowEnv();

  const { response, json } = await api(env, '/api/workorders/wo-pay-1/pay', {
    body: { payment_method: 'bank_transfer' },
  });

  assert.equal(response.status, 200);
  assert.equal(json.payment.amount, 3500);
  assert.equal(json.payment.advance_amount, 3500);
  assert.equal(json.payment.balance_amount, 1900);
});

test('pure service quote still requires a service advance payment', async () => {
  const env = createPaymentFlowEnv();
  env.__pricing[0] = {
    ...env.__pricing[0],
    parts_fee: 0,
    travel_fee: 0,
    labor_fee: 2000,
    other_fee: 0,
    subtotal: 2000,
    total_amount: 2000,
  };

  const { response, json } = await api(env, '/api/workorders/wo-pay-1/pay', {
    body: { payment_method: 'bank_transfer' },
  });

  assert.equal(response.status, 200);
  assert.equal(json.payment.amount, 1000);
  assert.equal(json.payment.balance_amount, 1000);
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
  assert.equal(
    env.__progress.find((item) => item.item_key === 'ready.start_conditions').state,
    'legacy_not_recorded',
  );
  assert.equal(
    env.__auditLogs.some((entry) => entry.args[5] === 'service_standard_item_confirmed'),
    false,
  );
});

test('admin start approval is blocked by deterministic service-standard items', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'payment_review';
  env.__payments.push({
    id: 'payment-start-blocked',
    work_order_id: 'wo-pay-1',
    payment_stage: 'advance',
    payment_method: 'bank_transfer',
    status: 'pending_admin_confirmation',
  });
  for (const itemKey of [
    'task.device_identity',
    'task.problem_and_goal',
    'task.contact_and_window',
    'ready.start_conditions',
  ]) {
    env.__progress.find((item) => item.item_key === itemKey).state = 'pending';
  }

  const blocked = await api(env, '/api/admin/workorders/wo-pay-1/payment/approve-start', {
    userType: 'admin',
    userId: 'admin',
    body: { note: 'Payment received.' },
  });

  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.json.code, 'service_standard_gate_blocked');
  assert.deepEqual(blocked.json.blocking_items, [
    'task.device_identity',
    'task.problem_and_goal',
    'task.contact_and_window',
  ]);
  assert.equal(env.__workOrders[0].status, 'payment_review');
  assert.equal(
    env.__progress.find((item) => item.item_key === 'ready.start_conditions').state,
    'pending',
  );
});

test('admin start approval atomically confirms and audits its pending event item', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'payment_review';
  env.__payments.push({
    id: 'payment-start-ready',
    work_order_id: 'wo-pay-1',
    payment_stage: 'advance',
    payment_method: 'bank_transfer',
    status: 'pending_admin_confirmation',
  });
  env.__progress.find((item) => item.item_key === 'ready.start_conditions').state = 'pending';

  const approved = await api(env, '/api/admin/workorders/wo-pay-1/payment/approve-start', {
    userType: 'admin',
    userId: 'admin',
    body: { note: 'Payment received.' },
  });

  assert.equal(approved.response.status, 200);
  assert.deepEqual(
    {
      state: env.__progress.find((item) => item.item_key === 'ready.start_conditions').state,
      confirmedBy: env.__progress.find((item) => item.item_key === 'ready.start_conditions').confirmed_by_type,
      evidenceType: env.__progress.find((item) => item.item_key === 'ready.start_conditions').evidence_type,
    },
    { state: 'confirmed', confirmedBy: 'admin', evidenceType: 'start_approval' },
  );
  const eventAudit = env.__auditLogs.find((entry) =>
    entry.args[5] === 'service_standard_item_confirmed'
    && JSON.parse(entry.args[7]).item_key === 'ready.start_conditions');
  assert.ok(eventAudit);

  const rollbackEnv = createPaymentFlowEnv();
  rollbackEnv.__workOrders[0].status = 'payment_review';
  rollbackEnv.__payments.push({
    id: 'payment-start-rollback',
    work_order_id: 'wo-pay-1',
    payment_stage: 'advance',
    payment_method: 'bank_transfer',
    status: 'pending_admin_confirmation',
  });
  rollbackEnv.__progress.find((item) => item.item_key === 'ready.start_conditions').state = 'pending';
  rollbackEnv.__failNextAudit = true;

  const failed = await api(rollbackEnv, '/api/admin/workorders/wo-pay-1/payment/approve-start', {
    userType: 'admin',
    userId: 'admin',
    body: { note: 'Payment received.' },
  });
  assert.equal(failed.response.status, 500);
  assert.equal(rollbackEnv.__workOrders[0].status, 'payment_review');
  assert.equal(rollbackEnv.__payments[0].status, 'pending_admin_confirmation');
  assert.equal(
    rollbackEnv.__progress.find((item) => item.item_key === 'ready.start_conditions').state,
    'pending',
  );
});

test('admin start approval creates and confirms only its missing immutable event row', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'payment_review';
  env.__payments.push({
    id: 'payment-start-missing-row',
    work_order_id: 'wo-pay-1',
    payment_stage: 'advance',
    payment_method: 'bank_transfer',
    status: 'pending_admin_confirmation',
  });
  env.__progress = env.__progress.filter((item) =>
    item.item_key !== 'ready.start_conditions');

  const approved = await api(env, '/api/admin/workorders/wo-pay-1/payment/approve-start', {
    userType: 'admin',
    userId: 'admin',
    body: { note: 'Payment received.' },
  });

  assert.equal(approved.response.status, 200);
  assert.deepEqual(
    {
      ...env.__progress.find((item) => item.item_key === 'ready.start_conditions'),
      confirmed_at: null,
    },
    {
      work_order_id: 'wo-pay-1',
      standard_version: 1,
      step_key: 'one_visit_readiness',
      item_key: 'ready.start_conditions',
      state: 'confirmed',
      is_required: 1,
      owner_type: 'admin',
      confirmed_by_type: 'admin',
      confirmed_by_id: 'admin',
      confirmed_at: null,
      evidence_type: 'start_approval',
      evidence_id: 'wo-pay-1',
    },
  );
  assert.ok(env.__auditLogs.some((entry) =>
    entry.args[5] === 'service_standard_item_confirmed'));

  const rollbackEnv = createPaymentFlowEnv();
  rollbackEnv.__workOrders[0].status = 'payment_review';
  rollbackEnv.__payments.push({
    id: 'payment-start-missing-row-rollback',
    work_order_id: 'wo-pay-1',
    payment_stage: 'advance',
    payment_method: 'bank_transfer',
    status: 'pending_admin_confirmation',
  });
  rollbackEnv.__progress = rollbackEnv.__progress.filter((item) =>
    item.item_key !== 'ready.start_conditions');
  rollbackEnv.__failServiceStandardEventAudit = true;

  const failed = await api(rollbackEnv, '/api/admin/workorders/wo-pay-1/payment/approve-start', {
    userType: 'admin',
    userId: 'admin',
    body: { note: 'Payment received.' },
  });

  assert.equal(failed.response.status, 500);
  assert.equal(
    rollbackEnv.__progress.some((item) => item.item_key === 'ready.start_conditions'),
    false,
  );
  assert.equal(rollbackEnv.__workOrders[0].status, 'payment_review');
  assert.equal(rollbackEnv.__payments[0].status, 'pending_admin_confirmation');
});

test('admin start approval does not re-audit an already-confirmed matching event item', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'payment_review';
  env.__payments.push({
    id: 'payment-start-replay',
    work_order_id: 'wo-pay-1',
    payment_stage: 'advance',
    payment_method: 'bank_transfer',
    status: 'pending_admin_confirmation',
  });
  Object.assign(
    env.__progress.find((item) => item.item_key === 'ready.start_conditions'),
    {
      state: 'confirmed',
      confirmed_by_type: 'admin',
      confirmed_by_id: 'admin',
      evidence_type: 'start_approval',
      evidence_id: 'wo-pay-1',
    },
  );

  const approved = await api(env, '/api/admin/workorders/wo-pay-1/payment/approve-start', {
    userType: 'admin',
    userId: 'admin',
    body: { note: 'Payment received.' },
  });

  assert.equal(approved.response.status, 200);
  assert.equal(
    env.__auditLogs.filter((entry) =>
      entry.args[5] === 'service_standard_item_confirmed').length,
    0,
  );
});

test('service completion creates a separate balance payment record', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'in_service';

  const resolved = await api(env, '/api/workorders/wo-pay-1/resolve', {
    userType: 'engineer',
    userId: 'engineer-1',
    body: { engineer_id: 'engineer-1' },
  });

  assert.equal(resolved.response.status, 200);
  assert.equal(env.__workOrders[0].status, 'resolved');
  assert.equal(env.__payments.length, 1);
  assert.equal(env.__payments[0].payment_stage, 'balance');
  assert.equal(env.__payments[0].status, 'awaiting_customer');
  assert.equal(env.__payments[0].amount, 1900);
});

test('customer requests and Admin confirms the service balance without changing service status', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'in_service';
  await api(env, '/api/workorders/wo-pay-1/resolve', {
    userType: 'engineer',
    userId: 'engineer-1',
    body: { engineer_id: 'engineer-1' },
  });

  const requested = await api(env, '/api/workorders/wo-pay-1/pay', {
    body: { payment_method: 'bank_transfer', payment_stage: 'balance' },
  });
  assert.equal(requested.response.status, 200);
  assert.equal(requested.json.payment.payment_stage, 'balance');
  assert.equal(requested.json.payment.amount, 1900);
  assert.equal(env.__payments[0].status, 'instructions_requested');

  const approved = await api(env, '/api/admin/workorders/wo-pay-1/payment/approve-balance', {
    userType: 'admin',
    userId: 'admin-1',
    body: { note: 'Balance receipt confirmed.' },
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.json.payment_status, 'completed');
  assert.equal(env.__payments[0].status, 'completed');
  assert.equal(env.__workOrders[0].status, 'resolved');
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
  assert.equal(env.__wallets.length, 0, 'customer rating must not auto-settle the legacy wallet');
  assert.equal(env.__engineers[0].wallet_balance, 0, 'customer rating must not change the legacy wallet balance');
  assert.equal(env.__payouts.length, 1, 'completion should create one admin-managed per-order payout record');
  assert.equal(env.__payouts[0].status, 'pending');
  assert.equal(
    env.__progress.find((item) => item.item_key === 'handover.customer_confirmation').state,
    'legacy_not_recorded',
  );
  assert.equal(
    env.__auditLogs.some((entry) => entry.args[5] === 'service_standard_item_confirmed'),
    false,
  );
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

test('customer cannot rate or accept a service order before final review opens', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'in_service';

  const rated = await api(env, '/api/workorders/rating', {
    userType: 'customer',
    userId: 'customer-1',
    body: {
      work_order_id: 'wo-pay-1',
      rating_timeliness: 5,
      rating_technical: 5,
      rating_communication: 5,
      rating_professional: 5,
      comment: 'Submitted too early.',
    },
  });

  assert.equal(rated.response.status, 409);
  assert.equal(env.__workOrders[0].status, 'in_service');
  assert.equal(env.__ratings.length, 0);
  assert.equal(env.__payouts.length, 0);
});

test('customer completion is blocked until handover requirements are satisfied', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'resolved';
  env.__repairRecords[0].report_quality_status = 'submitted';
  env.__repairRecords[0].submitted_at = '2026-08-13T00:00:00Z';
  env.__progress.find((item) => item.item_key === 'handover.service_report').state = 'pending';
  env.__progress.find((item) => item.item_key === 'handover.customer_confirmation').state = 'pending';

  const completed = await api(env, '/api/workorders/rating', {
    userType: 'customer',
    userId: 'customer-1',
    body: {
      work_order_id: 'wo-pay-1',
      rating_timeliness: 5,
      rating_technical: 5,
      rating_communication: 5,
      rating_professional: 5,
      comment: 'Accepted.',
    },
  });

  assert.equal(completed.response.status, 409);
  assert.equal(completed.json.code, 'service_standard_gate_blocked');
  assert.equal(completed.json.gate, 'handover');
  assert.deepEqual(completed.json.blocking_items, ['handover.service_report']);
  assert.equal(env.__ratings.length, 0);
  assert.equal(env.__workOrders[0].status, 'resolved');
  assert.equal(
    env.__progress.find((item) => item.item_key === 'handover.customer_confirmation').state,
    'pending',
  );
});

test('accepted customer completion atomically confirms and audits its pending event item', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'resolved';
  env.__repairRecords[0].report_quality_status = 'submitted';
  env.__repairRecords[0].submitted_at = '2026-08-13T00:00:00Z';
  env.__progress.find((item) => item.item_key === 'handover.customer_confirmation').state = 'pending';

  const body = {
    work_order_id: 'wo-pay-1',
    rating_timeliness: 5,
    rating_technical: 4,
    rating_communication: 5,
    rating_professional: 5,
    comment: 'Accepted.',
  };
  const completed = await api(env, '/api/workorders/rating', {
    userType: 'customer',
    userId: 'customer-1',
    body,
  });

  assert.equal(completed.response.status, 200);
  assert.equal(env.__workOrders[0].status, 'completed');
  assert.equal(env.__ratings.length, 1);
  const confirmation = env.__progress.find((item) =>
    item.item_key === 'handover.customer_confirmation');
  assert.deepEqual(
    {
      state: confirmation.state,
      confirmedBy: confirmation.confirmed_by_type,
      evidenceType: confirmation.evidence_type,
    },
    { state: 'confirmed', confirmedBy: 'customer', evidenceType: 'customer_rating' },
  );
  assert.ok(env.__auditLogs.some((entry) =>
    entry.args[5] === 'service_standard_item_confirmed'
    && JSON.parse(entry.args[7]).item_key === 'handover.customer_confirmation'));

  const rollbackEnv = createPaymentFlowEnv();
  rollbackEnv.__workOrders[0].status = 'resolved';
  rollbackEnv.__repairRecords[0].report_quality_status = 'submitted';
  rollbackEnv.__repairRecords[0].submitted_at = '2026-08-13T00:00:00Z';
  rollbackEnv.__progress.find((item) =>
    item.item_key === 'handover.customer_confirmation').state = 'pending';
  rollbackEnv.__failNextAudit = true;
  const failed = await api(rollbackEnv, '/api/workorders/rating', {
    userType: 'customer',
    userId: 'customer-1',
    body,
  });

  assert.equal(failed.response.status, 500);
  assert.equal(rollbackEnv.__workOrders[0].status, 'resolved');
  assert.equal(rollbackEnv.__ratings.length, 0);
  assert.equal(
    rollbackEnv.__progress.find((item) =>
      item.item_key === 'handover.customer_confirmation').state,
    'pending',
  );
});

test('accepted customer completion creates and confirms its missing immutable event row', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'resolved';
  env.__repairRecords[0].report_quality_status = 'submitted';
  env.__repairRecords[0].submitted_at = '2026-08-13T00:00:00Z';
  env.__progress = env.__progress.filter((item) =>
    item.item_key !== 'handover.customer_confirmation');

  const completed = await api(env, '/api/workorders/rating', {
    userType: 'customer',
    userId: 'customer-1',
    body: {
      work_order_id: 'wo-pay-1',
      rating_timeliness: 5,
      rating_technical: 5,
      rating_communication: 5,
      rating_professional: 5,
      comment: 'Accepted.',
    },
  });

  assert.equal(completed.response.status, 200);
  const confirmation = env.__progress.find((item) =>
    item.item_key === 'handover.customer_confirmation');
  assert.deepEqual(
    {
      stepKey: confirmation?.step_key,
      state: confirmation?.state,
      required: confirmation?.is_required,
      owner: confirmation?.owner_type,
      confirmedBy: confirmation?.confirmed_by_type,
    },
    {
      stepKey: 'transparent_handover',
      state: 'confirmed',
      required: 1,
      owner: 'customer',
      confirmedBy: 'customer',
    },
  );

  const rollbackEnv = createPaymentFlowEnv();
  rollbackEnv.__workOrders[0].status = 'resolved';
  rollbackEnv.__repairRecords[0].report_quality_status = 'submitted';
  rollbackEnv.__repairRecords[0].submitted_at = '2026-08-13T00:00:00Z';
  rollbackEnv.__progress = rollbackEnv.__progress.filter((item) =>
    item.item_key !== 'handover.customer_confirmation');
  rollbackEnv.__failServiceStandardEventAudit = true;

  const failed = await api(rollbackEnv, '/api/workorders/rating', {
    userType: 'customer',
    userId: 'customer-1',
    body: {
      work_order_id: 'wo-pay-1',
      rating_timeliness: 5,
      rating_technical: 5,
      rating_communication: 5,
      rating_professional: 5,
      comment: 'Accepted.',
    },
  });

  assert.equal(failed.response.status, 500);
  assert.equal(rollbackEnv.__workOrders[0].status, 'resolved');
  assert.equal(rollbackEnv.__ratings.length, 0);
  assert.equal(
    rollbackEnv.__progress.some((item) =>
      item.item_key === 'handover.customer_confirmation'),
    false,
  );
});

test('Admin payout completion requires a completed work order and positive amount', async () => {
  const env = createPaymentFlowEnv();

  const beforeCompletion = await api(env, '/api/admin/workorders/wo-pay-1/payout', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    body: { status: 'completed', amount: 720, currency: 'USD', method: 'paypal' },
  });
  assert.equal(beforeCompletion.response.status, 409);

  env.__workOrders[0].status = 'completed';
  const zeroAmount = await api(env, '/api/admin/workorders/wo-pay-1/payout', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    body: { status: 'completed', amount: 0, currency: 'USD', method: 'paypal' },
  });
  assert.equal(zeroAmount.response.status, 400);
});

test('completed engineer payout is idempotent and cannot be reopened', async () => {
  const env = createPaymentFlowEnv();
  env.__workOrders[0].status = 'completed';

  const completed = await api(env, '/api/admin/workorders/wo-pay-1/payout', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    body: {
      status: 'completed',
      amount: 720,
      currency: 'USD',
      method: 'paypal',
      transaction_reference: 'E2E-SETTLEMENT-1',
    },
  });
  assert.equal(completed.response.status, 200);
  const paidAt = completed.json.payout.paid_at;

  const repeated = await api(env, '/api/admin/workorders/wo-pay-1/payout', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    body: { status: 'completed', amount: 999, currency: 'USD', method: 'paypal' },
  });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.json.payout.amount, 720);
  assert.equal(repeated.json.payout.paid_at, paidAt);

  const reopen = await api(env, '/api/admin/workorders/wo-pay-1/payout', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    body: { status: 'processing', amount: 720, currency: 'USD', method: 'paypal' },
  });
  assert.equal(reopen.response.status, 409);
  assert.equal(env.__payouts[0].status, 'completed');
});
