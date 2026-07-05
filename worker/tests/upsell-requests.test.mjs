import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
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

      if (/SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { ...order } : null;
      }

      if (/SELECT COUNT\(\*\) as count FROM upsell_requests/i.test(normalized)) {
        return { count: env.__upsellRequests.length };
      }

      if (/SELECT \* FROM upsell_requests WHERE id = \?/i.test(normalized)) {
        return env.__upsellRequests.find((item) => item.id === this.args[0]) || null;
      }

      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);

      if (/FROM upsell_requests/i.test(normalized)) {
        let results = [...env.__upsellRequests];
        if (/engineer_id = \?/i.test(normalized)) {
          results = results.filter((item) => item.engineer_id === this.args[0]);
        }
        if (/status = \?/i.test(normalized)) {
          const status = this.args.find((arg) => [
            'pending_assignment',
            'sales_following',
            'quoted',
            'won',
            'lost',
            'delivery_support',
            'completed',
          ].includes(arg));
          if (status) results = results.filter((item) => item.status === status);
        }
        return { results };
      }

      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO upsell_requests/i.test(normalized)) {
        const [
          id,
          market,
          source_type,
          work_order_id,
          customer_id,
          engineer_id,
          category,
          title,
          description,
          site_context,
          expected_timeline,
          budget_signal,
          contact_name,
          contact_phone,
          status,
          assigned_sales_owner,
          admin_note,
          quote_status,
          deal_result,
          handover_note,
        ] = this.args;
        env.__upsellRequests.push({
          id,
          market,
          source_type,
          work_order_id,
          customer_id,
          engineer_id,
          category,
          title,
          description,
          site_context,
          expected_timeline,
          budget_signal,
          contact_name,
          contact_phone,
          status,
          assigned_sales_owner,
          admin_note,
          quote_status,
          deal_result,
          handover_note,
        });
      }

      if (/UPDATE upsell_requests SET/i.test(normalized)) {
        const id = this.args.at(-1);
        const request = env.__upsellRequests.find((item) => item.id === id);
        if (!request) return { success: true, meta: { changes: 0 } };
        [
          request.status,
          request.assigned_sales_owner,
          request.admin_note,
          request.quote_status,
          request.deal_result,
          request.handover_note,
        ] = this.args.slice(0, 6);
        return { success: true, meta: { changes: 1 } };
      }

      if (/INSERT INTO audit_logs/i.test(normalized)) {
        env.__auditLogs.push({ args: this.args });
      }

      return { success: true, meta: { changes: 1 } };
    },
  };
}

function createEnv() {
  const env = {
    JWT_SECRET: 'test-secret-with-enough-length',
    __auditLogs: [],
    __upsellRequests: [],
    __workOrders: [
      {
        id: 'wo-1',
        customer_id: 'customer-1',
        engineer_id: 'engineer-1',
        assigned_regional_lead_id: 'lead-1',
        status: 'in_progress',
      },
    ],
    DB: {
      prepare(sql) {
        return createStatement(env, sql);
      },
    },
    KV: {
      async get() { return null; },
      async put() {},
    },
  };
  return env;
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

async function api(env, path, { method = 'GET', body, userType = 'engineer', userId = 'engineer-1', origin = 'https://engineer.sagemro.cn' } = {}) {
  const jwt = await token(env, userType, userId);
  const response = await worker.fetch(new Request(`https://api.sagemro.cn${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('engineer can create a workspace upsell request', async () => {
  const env = createEnv();
  const result = await api(env, '/api/upsell-requests', {
    method: 'POST',
    body: {
      source_type: 'engineer_workspace',
      category: 'laser_peripheral',
      title: '客户考虑增加除尘装置',
      description: '现场粉尘较大，客户希望了解除尘方案。',
      site_context: '光纤激光切割机，车间已有集中气源。',
      expected_timeline: 'within_3_months',
      budget_signal: 'comparing_quotes',
      contact_name: '王经理',
      contact_phone: '13800000000',
    },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.json.request.status, 'pending_assignment');
  assert.equal(result.json.request.source_type, 'engineer_workspace');
  assert.equal(result.json.request.engineer_id, 'engineer-1');
  assert.equal(env.__upsellRequests.length, 1);
});

test('engineer create derives market from request context', async () => {
  const env = createEnv();
  const result = await api(env, '/api/upsell-requests', {
    method: 'POST',
    body: {
      market: 'com',
      source_type: 'engineer_workspace',
      category: 'laser_peripheral',
      title: '客户考虑增加除尘装置',
      description: '现场粉尘较大，客户希望了解除尘方案。',
    },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.json.request.market, 'cn');
  assert.equal(env.__upsellRequests[0].market, 'cn');
});

test('engineer can create a work-order-linked upsell request for assigned order', async () => {
  const env = createEnv();
  const result = await api(env, '/api/upsell-requests', {
    method: 'POST',
    body: {
      source_type: 'work_order',
      work_order_id: 'wo-1',
      category: 'automation_retrofit',
      title: '客户咨询桁架上下料改造',
      description: '客户希望降低人工上下料强度。',
    },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.json.request.work_order_id, 'wo-1');
  assert.equal(result.json.request.customer_id, 'customer-1');
});

test('engineer cannot create an upsell request for another engineer work order', async () => {
  const env = createEnv();
  const result = await api(env, '/api/upsell-requests', {
    method: 'POST',
    userId: 'engineer-2',
    body: {
      source_type: 'work_order',
      work_order_id: 'wo-1',
      category: 'parts_consumables',
      title: '客户需要喷嘴',
      description: '客户想补充常用喷嘴。',
    },
  });

  assert.equal(result.response.status, 403);
});

test('engineer can list only own upsell requests', async () => {
  const env = createEnv();
  env.__upsellRequests.push(
    { id: 'up-1', engineer_id: 'engineer-1', title: '我的需求', status: 'pending_assignment' },
    { id: 'up-2', engineer_id: 'engineer-2', title: '别人的需求', status: 'pending_assignment' },
  );

  const result = await api(env, '/api/upsell-requests/mine');

  assert.equal(result.response.status, 200);
  assert.equal(result.json.requests.length, 1);
  assert.equal(result.json.requests[0].id, 'up-1');
});

test('admin can list and update upsell requests', async () => {
  const env = createEnv();
  env.__upsellRequests.push({
    id: 'up-1',
    market: 'cn',
    source_type: 'engineer_workspace',
    engineer_id: 'engineer-1',
    category: 'laser_peripheral',
    title: '除尘装置',
    description: '客户希望了解除尘方案',
    status: 'pending_assignment',
    assigned_sales_owner: '',
    admin_note: '',
    quote_status: 'not_started',
    deal_result: 'undecided',
    handover_note: '',
  });

  const list = await api(env, '/api/admin/upsell-requests', {
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.json.requests.length, 1);

  const detail = await api(env, '/api/admin/upsell-requests/up-1', {
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
  });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.request.id, 'up-1');

  const updated = await api(env, '/api/admin/upsell-requests/up-1', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
    body: {
      status: 'sales_following',
      assigned_sales_owner: '李经理',
      admin_note: '已安排业务联系客户',
      quote_status: 'in_progress',
      deal_result: 'undecided',
      handover_note: '',
    },
  });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.request.status, 'sales_following');
  assert.equal(updated.json.request.assigned_sales_owner, '李经理');
});

test('admin update rejects invalid upsell enum values', async () => {
  const env = createEnv();
  env.__upsellRequests.push({
    id: 'up-1',
    market: 'cn',
    source_type: 'engineer_workspace',
    engineer_id: 'engineer-1',
    category: 'laser_peripheral',
    title: '除尘装置',
    description: '客户希望了解除尘方案',
    status: 'pending_assignment',
    assigned_sales_owner: '',
    admin_note: '',
    quote_status: 'not_started',
    deal_result: 'undecided',
    handover_note: '',
  });

  const result = await api(env, '/api/admin/upsell-requests/up-1', {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
    body: {
      status: 'not_a_status',
    },
  });

  assert.equal(result.response.status, 400);
  assert.equal(env.__upsellRequests[0].status, 'pending_assignment');
});
