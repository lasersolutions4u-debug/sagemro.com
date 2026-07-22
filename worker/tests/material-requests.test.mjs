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

      if (/SELECT COUNT\(\*\) as count FROM material_requests/i.test(normalized)) {
        return { count: env.__materialRequests.length };
      }

      if (/SELECT \* FROM material_requests WHERE id = \?/i.test(normalized)) {
        return env.__materialRequests.find((item) => item.id === this.args[0]) || null;
      }

      if (/SELECT \* FROM materials WHERE id = \?/i.test(normalized)) {
        return env.__materials.find((item) => item.id === this.args[0]) || null;
      }

      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);

      if (/FROM material_requests/i.test(normalized)) {
        let results = [...env.__materialRequests];
        if (/requested_by_id = \?/i.test(normalized)) {
          const requesterId = this.args[0];
          results = results.filter((item) => item.requested_by_id === requesterId);
        }
        if (/status = \?/i.test(normalized)) {
          const status = this.args.find((arg) => ['submitted', 'needs_info', 'approved', 'rejected', 'linked_existing'].includes(arg));
          if (status) results = results.filter((item) => item.status === status);
        }
        return { results };
      }

      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO material_requests/i.test(normalized)) {
        const [
          id,
          market,
          status,
          work_order_id,
          requested_by_type,
          requested_by_id,
          suggested_name,
          suggested_name_en,
          category,
          spec,
          brand,
          compatible_equipment,
          supplier_suggestion,
          expected_quantity,
          unit,
          usage_note,
          urgency,
          attachment_urls,
        ] = this.args;
        env.__materialRequests.push({
          id,
          market,
          status,
          work_order_id,
          requested_by_type,
          requested_by_id,
          suggested_name,
          suggested_name_en,
          category,
          spec,
          brand,
          compatible_equipment,
          supplier_suggestion,
          expected_quantity,
          unit,
          usage_note,
          urgency,
          attachment_urls,
        });
      }

      if (/INSERT INTO materials/i.test(normalized)) {
        const [
          id,
          market,
          material_code,
          category,
          name,
          name_en,
          spec,
          brand,
          compatible_equipment,
          supplier,
          production_code,
          unit,
          reference_cost,
          reference_price,
          stock_quantity,
          safety_stock,
          status,
          notes,
        ] = this.args;
        env.__materials.push({
          id,
          market,
          material_code,
          category,
          name,
          name_en,
          spec,
          brand,
          compatible_equipment,
          supplier,
          production_code,
          unit,
          reference_cost,
          reference_price,
          stock_quantity,
          safety_stock,
          status,
          notes,
        });
      }

      if (/UPDATE material_requests SET/i.test(normalized)) {
        const id = this.args.at(-1);
        const request = env.__materialRequests.find((item) => item.id === id);
        if (!request) return { success: true, meta: { changes: 0 } };
        [
          request.status,
          request.review_notes,
          request.linked_material_id,
          request.reviewed_by,
        ] = this.args.slice(0, 4);
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
    __materials: [],
    __materialRequests: [],
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
    market: 'cn',
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

test('assigned engineer can request a missing material from a work order', async () => {
  const env = createEnv();

  const result = await api(env, '/api/material-requests', {
    method: 'POST',
    body: {
      work_order_id: 'wo-1',
      suggested_name: '激光切割喷嘴 2.0mm',
      suggested_name_en: 'Laser cutting nozzle 2.0mm',
      category: 'laser_cutting',
      spec: '2.0mm single layer',
      brand: 'Generic',
      compatible_equipment: 'Fiber laser cutter',
      supplier_suggestion: 'Local supplier',
      expected_quantity: 4,
      unit: 'pcs',
      usage_note: '报价时需要加入配件清单',
      urgency: 'urgent',
    },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.json.request.suggested_name, '激光切割喷嘴 2.0mm');
  assert.equal(result.json.request.status, 'submitted');
  assert.equal(result.json.request.requested_by_id, 'engineer-1');
  assert.equal(env.__materialRequests.length, 1);
});

test('unassigned engineer cannot request material for another engineer work order', async () => {
  const env = createEnv();

  const result = await api(env, '/api/material-requests', {
    method: 'POST',
    userId: 'engineer-2',
    body: {
      work_order_id: 'wo-1',
      suggested_name: '保护镜片',
      category: 'laser_cutting',
    },
  });

  assert.equal(result.response.status, 403);
  assert.equal(env.__materialRequests.length, 0);
});

test('admin can review material requests and approve one into material master', async () => {
  const env = createEnv();
  const created = await api(env, '/api/material-requests', {
    method: 'POST',
    body: {
      work_order_id: 'wo-1',
      suggested_name: '折弯机密封圈',
      suggested_name_en: 'Press brake seal ring',
      category: 'bending',
      spec: '63x75x8',
      expected_quantity: 2,
      unit: 'pcs',
      usage_note: '现场更换后加入服务报告',
    },
  });

  const listed = await api(env, '/api/admin/material-requests', {
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
  });

  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.total, 1);
  assert.equal(listed.json.list[0].suggested_name, '折弯机密封圈');

  const reviewed = await api(env, `/api/admin/material-requests/${created.json.request.id}`, {
    method: 'PATCH',
    userType: 'admin',
    userId: 'admin-1',
    origin: 'https://admin.sagemro.cn',
    body: {
      action: 'approve_create',
      review_notes: '常用件，加入物料库。',
      material: {
        material_code: 'BEND-SEAL-063075',
        category: 'bending',
        name: '折弯机密封圈',
        name_en: 'Press brake seal ring',
        spec: '63x75x8',
        unit: 'pcs',
        reference_price: 48,
        stock_quantity: 10,
      },
    },
  });

  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.json.request.status, 'approved');
  assert.equal(reviewed.json.material.material_code, 'BEND-SEAL-063075');
  assert.equal(env.__materials.length, 1);
  assert.equal(env.__materialRequests[0].linked_material_id, reviewed.json.material.id);
});
