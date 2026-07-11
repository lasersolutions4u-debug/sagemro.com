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
      work_order_id: 'wo-pay-1',
      symptom: 'Laser cutting quality dropped after lens contamination.',
      diagnosis: 'Protective lens contaminated and gas pressure unstable.',
      solution: 'Replaced lens, cleaned optical path, and tuned gas pressure.',
      parts_used: JSON.stringify([{ name: 'Protective lens', qty: 1, unit: 'pcs' }]),
      labor_hours: 2,
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

      if (/SELECT symptom, diagnosis, solution, parts_used, labor_hours FROM work_order_repair_records WHERE work_order_id = \?/i.test(normalized)) {
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
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        if (order) order.status = 'resolved';
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

  assert.equal(rated.response.status, 200);
  assert.equal(env.__workOrders[0].status, 'completed');
  assert.equal(env.__ratings.length, 1);

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
