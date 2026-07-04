import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

function createStatement(env, sql) {
  return {
    args: [],
    bind(...args) {
      this.args = args;
      return this;
    },
    async first() {
      const normalized = sql.replace(/\s+/g, ' ');
      if (/SELECT COUNT\(\*\) as count FROM materials/i.test(normalized)) {
        return { count: env.__materials.length };
      }
      if (/SELECT \* FROM materials WHERE id = \?/i.test(normalized)) {
        return env.__materials.find((item) => item.id === this.args[0]) || null;
      }
      return null;
    },
    async all() {
      const normalized = sql.replace(/\s+/g, ' ');
      if (/FROM materials/i.test(normalized)) {
        return { results: [...env.__materials] };
      }
      return { results: [] };
    },
    async run() {
      const normalized = sql.replace(/\s+/g, ' ');
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
      if (/UPDATE materials SET stock_quantity = stock_quantity \+ \?/i.test(normalized)) {
        const [delta, id] = this.args;
        const material = env.__materials.find((item) => item.id === id);
        if (!material) return { success: true, meta: { changes: 0 } };
        material.stock_quantity += delta;
        return { success: true, meta: { changes: 1 } };
      }
      if (/UPDATE materials SET/i.test(normalized) && /WHERE id = \?/i.test(normalized)) {
        const id = this.args.at(-1);
        const material = env.__materials.find((item) => item.id === id);
        if (!material) return { success: true, meta: { changes: 0 } };
        [
          material.material_code,
          material.category,
          material.name,
          material.name_en,
          material.spec,
          material.brand,
          material.compatible_equipment,
          material.supplier,
          material.production_code,
          material.unit,
          material.reference_cost,
          material.reference_price,
          material.safety_stock,
          material.status,
          material.notes,
        ] = this.args.slice(0, 15);
        return { success: true, meta: { changes: 1 } };
      }
      if (/INSERT INTO material_inventory_adjustments/i.test(normalized)) {
        const [id, material_id, change_type, delta, before_quantity, after_quantity, reason, created_by] = this.args;
        env.__adjustments.push({
          id,
          material_id,
          change_type,
          delta,
          before_quantity,
          after_quantity,
          reason,
          created_by,
        });
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
    __materials: [],
    __adjustments: [],
    __auditLogs: [],
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

async function token(env, userType = 'admin') {
  return signJwt({
    userId: `${userType}-1`,
    userType,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function api(env, path, { method = 'GET', body, userType = 'admin' } = {}) {
  const jwt = await token(env, userType);
  const response = await worker.fetch(new Request(`https://api.sagemro.cn${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://admin.sagemro.cn',
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('admin can create and list material master data', async () => {
  const env = createEnv();

  const created = await api(env, '/api/admin/materials', {
    method: 'POST',
    body: {
      material_code: 'LC-NOZZLE-1.5',
      category: 'laser_cutting',
      name: '激光切割喷嘴',
      name_en: 'Laser cutting nozzle',
      spec: '1.5mm single layer',
      supplier: 'Demo Supplier',
      unit: 'pcs',
      reference_cost: 12.5,
      reference_price: 35,
      stock_quantity: 20,
      safety_stock: 5,
      notes: '常用易损件',
    },
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.json.material.material_code, 'LC-NOZZLE-1.5');
  assert.equal(created.json.material.market, 'cn');
  assert.equal(env.__materials[0].stock_quantity, 20);

  const listed = await api(env, '/api/admin/materials');
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.total, 1);
  assert.equal(listed.json.list[0].name, '激光切割喷嘴');
});

test('admin can update material inventory with an adjustment record', async () => {
  const env = createEnv();
  const created = await api(env, '/api/admin/materials', {
    method: 'POST',
    body: {
      material_code: 'BEND-SEAL-001',
      category: 'bending',
      name: '折弯机密封圈',
      unit: 'pcs',
      stock_quantity: 10,
    },
  });
  const materialId = created.json.material.id;

  const adjusted = await api(env, `/api/admin/materials/${materialId}/inventory-adjustments`, {
    method: 'POST',
    body: {
      change_type: 'manual_in',
      delta: 6,
      reason: '采购入库',
    },
  });

  assert.equal(adjusted.response.status, 200);
  assert.equal(adjusted.json.material.stock_quantity, 16);
  assert.equal(env.__adjustments.length, 1);
  assert.equal(env.__adjustments[0].before_quantity, 10);
  assert.equal(env.__adjustments[0].after_quantity, 16);
});

test('admin can update material master fields without directly changing stock', async () => {
  const env = createEnv();
  const created = await api(env, '/api/admin/materials', {
    method: 'POST',
    body: {
      material_code: 'WELD-LENS-001',
      category: 'welding',
      name: '焊接保护镜片',
      supplier: 'Old Supplier',
      stock_quantity: 8,
    },
  });
  const materialId = created.json.material.id;

  const updated = await api(env, `/api/admin/materials/${materialId}`, {
    method: 'PATCH',
    body: {
      material_code: 'WELD-LENS-001',
      category: 'welding',
      name: '手持焊保护镜片',
      supplier: 'Preferred Supplier',
      reference_price: 28,
      stock_quantity: 99,
      status: 'active',
    },
  });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.material.name, '手持焊保护镜片');
  assert.equal(env.__materials[0].supplier, 'Preferred Supplier');
  assert.equal(env.__materials[0].stock_quantity, 8);
});

test('engineer cannot access admin material management', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/materials', { userType: 'engineer' });

  assert.equal(result.response.status, 403);
  assert.equal(result.json.error, '需要管理员权限');
});
