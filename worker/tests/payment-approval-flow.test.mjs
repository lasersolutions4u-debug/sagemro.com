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

      return null;
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
