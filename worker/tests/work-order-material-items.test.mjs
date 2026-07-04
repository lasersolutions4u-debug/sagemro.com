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

      if (/SELECT \* FROM materials WHERE id = \?/i.test(normalized)) {
        return env.__materials.find((material) => material.id === this.args[0]) || null;
      }

      if (/FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        if (!order) return null;
        return { ...order };
      }

      if (/SELECT \* FROM work_order_material_items WHERE id = \?/i.test(normalized)) {
        return env.__materialItems.find((item) => item.id === this.args[0]) || null;
      }

      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);

      if (/FROM materials/i.test(normalized)) {
        const market = this.args[0];
        const search = this.args.find((arg) => typeof arg === 'string' && arg.startsWith('%'));
        let results = env.__materials.filter((material) => material.market === market && material.status === 'active');
        if (search) {
          const needle = search.replaceAll('%', '').toLowerCase();
          results = results.filter((material) => [
            material.material_code,
            material.name,
            material.name_en,
            material.spec,
            material.brand,
          ].some((value) => String(value || '').toLowerCase().includes(needle)));
        }
        return { results };
      }

      if (/FROM work_order_material_items/i.test(normalized)) {
        const workOrderId = this.args[0];
        let results = env.__materialItems.filter((item) => item.work_order_id === workOrderId && item.status !== 'removed');
        if (/AND purpose = \?/i.test(normalized)) {
          const purpose = this.args[1];
          results = results.filter((item) => item.purpose === purpose);
        }
        return { results };
      }

      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO work_order_material_items/i.test(normalized)) {
        const [
          id,
          work_order_id,
          material_id,
          purpose,
          material_code,
          name,
          name_en,
          spec,
          brand,
          unit,
          quantity,
          unit_price,
          line_total,
          note,
          status,
          created_by_type,
          created_by_id,
        ] = this.args;
        env.__materialItems.push({
          id,
          work_order_id,
          material_id,
          purpose,
          material_code,
          name,
          name_en,
          spec,
          brand,
          unit,
          quantity,
          unit_price,
          line_total,
          note,
          status,
          created_by_type,
          created_by_id,
        });
      }

      if (/UPDATE work_order_material_items SET/i.test(normalized)) {
        const id = this.args.at(-1);
        const item = env.__materialItems.find((entry) => entry.id === id);
        if (!item) return { success: true, meta: { changes: 0 } };
        [
          item.purpose,
          item.quantity,
          item.unit_price,
          item.line_total,
          item.note,
          item.status,
        ] = this.args.slice(0, 6);
        return { success: true, meta: { changes: 1 } };
      }

      if (/UPDATE work_order_material_items SET status = 'removed'/i.test(normalized)) {
        const workOrderId = this.args[0];
        const purpose = this.args[1];
        env.__materialItems
          .filter((item) => item.work_order_id === workOrderId && item.purpose === purpose)
          .forEach((item) => { item.status = 'removed'; });
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
    __materials: [
      {
        id: 'mat-1',
        market: 'cn',
        material_code: 'LC-NOZZLE-1.5',
        category: 'laser_cutting',
        name: '激光切割喷嘴',
        name_en: 'Laser cutting nozzle',
        spec: '1.5mm single layer',
        brand: 'Generic',
        compatible_equipment: 'Fiber laser cutter',
        supplier: 'Hidden Supplier',
        production_code: 'BATCH-001',
        unit: 'pcs',
        reference_cost: 12,
        reference_price: 35,
        stock_quantity: 20,
        safety_stock: 5,
        status: 'active',
      },
    ],
    __workOrders: [
      {
        id: 'wo-1',
        customer_id: 'customer-1',
        engineer_id: 'engineer-1',
        assigned_regional_lead_id: 'lead-1',
        status: 'in_progress',
        quote_review_status: 'draft',
      },
    ],
    __materialItems: [],
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

async function api(env, path, { method = 'GET', body, userType = 'engineer', userId = 'engineer-1' } = {}) {
  const jwt = await token(env, userType, userId);
  const response = await worker.fetch(new Request(`https://api.sagemro.cn${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://engineer.sagemro.cn',
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('engineer can search active materials without supplier cost or inventory fields', async () => {
  const env = createEnv();

  const result = await api(env, '/api/materials?search=nozzle');

  assert.equal(result.response.status, 200);
  assert.equal(result.json.list.length, 1);
  assert.equal(result.json.list[0].material_code, 'LC-NOZZLE-1.5');
  assert.equal(result.json.list[0].reference_price, 35);
  assert.equal('supplier' in result.json.list[0], false);
  assert.equal('reference_cost' in result.json.list[0], false);
  assert.equal('stock_quantity' in result.json.list[0], false);
});

test('assigned engineer can attach a material item to a work order quote', async () => {
  const env = createEnv();

  const created = await api(env, '/api/workorders/wo-1/material-items', {
    method: 'POST',
    body: {
      material_id: 'mat-1',
      purpose: 'quote',
      quantity: 2,
      unit_price: 35,
      note: '更换喷嘴',
    },
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.json.item.material_code, 'LC-NOZZLE-1.5');
  assert.equal(created.json.item.quantity, 2);
  assert.equal(created.json.item.line_total, 70);
  assert.equal(created.json.item.purpose, 'quote');
  assert.equal(created.json.item.created_by_type, 'engineer');
  assert.equal('supplier' in created.json.item, false);
  assert.equal(env.__materialItems.length, 1);
});

test('customer can read work order material items but only safe quote fields', async () => {
  const env = createEnv();
  await api(env, '/api/workorders/wo-1/material-items', {
    method: 'POST',
    body: {
      material_id: 'mat-1',
      purpose: 'quote',
      quantity: 1,
      unit_price: 35,
    },
  });

  const result = await api(env, '/api/workorders/wo-1/material-items', {
    userType: 'customer',
    userId: 'customer-1',
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.json.list.length, 1);
  assert.equal(result.json.list[0].name, '激光切割喷嘴');
  assert.equal('supplier' in result.json.list[0], false);
  assert.equal('reference_cost' in result.json.list[0], false);
  assert.equal('stock_quantity' in result.json.list[0], false);
});

test('customer cannot read internal preparation material items', async () => {
  const env = createEnv();
  await api(env, '/api/workorders/wo-1/material-items', {
    method: 'POST',
    body: {
      material_id: 'mat-1',
      purpose: 'preparation',
      quantity: 1,
      unit_price: 35,
      note: '工程师内部到场准备',
    },
  });

  const result = await api(env, '/api/workorders/wo-1/material-items', {
    userType: 'customer',
    userId: 'customer-1',
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.json.list.length, 0);
});

test('unassigned engineer cannot attach material items to another engineer work order', async () => {
  const env = createEnv();

  const result = await api(env, '/api/workorders/wo-1/material-items', {
    method: 'POST',
    userType: 'engineer',
    userId: 'engineer-2',
    body: {
      material_id: 'mat-1',
      purpose: 'quote',
      quantity: 1,
      unit_price: 35,
    },
  });

  assert.equal(result.response.status, 403);
  assert.equal(env.__materialItems.length, 0);
});
