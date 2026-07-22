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
      let changes = 0;
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
          reserved_quantity: 0,
          safety_stock,
          status,
          notes,
        });
        changes = 1;
      }
      if (/UPDATE materials SET stock_quantity = stock_quantity \+ \?/i.test(normalized)) {
        const [delta, id, expectedStock, expectedReserved] = this.args;
        const material = env.__materials.find((item) => item.id === id);
        if (!material) {
          env.__lastChanges = 0;
          return { success: true, meta: { changes: 0 } };
        }
        if (env.__forceNextStockMiss) {
          env.__forceNextStockMiss = false;
          env.__lastChanges = 0;
          return { success: true, meta: { changes: 0 } };
        }
        if (expectedStock !== undefined && (material.stock_quantity !== expectedStock || material.reserved_quantity !== expectedReserved)) {
          env.__lastChanges = 0;
          return { success: true, meta: { changes: 0 } };
        }
        if (material.stock_quantity + delta < material.reserved_quantity) {
          env.__lastChanges = 0;
          return { success: true, meta: { changes: 0 } };
        }
        material.stock_quantity += delta;
        changes = 1;
      }
      else if (/UPDATE materials SET/i.test(normalized) && /WHERE id = \?/i.test(normalized)) {
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
      else if (/INSERT INTO material_inventory_adjustments/i.test(normalized)) {
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
        changes = 1;
      }
      else if (/INSERT INTO audit_logs/i.test(normalized)) {
        if (env.__failNextAudit) {
          env.__failNextAudit = false;
          throw new Error('audit insert failed');
        }
        env.__auditLogs.push({ args: this.args });
        changes = 1;
      }
      else if (/SELECT CASE WHEN changes\(\) = 1/i.test(normalized)) {
        if (env.__lastChanges !== 1) throw new Error('material requisition concurrent update');
        changes = 1;
      }
      env.__lastChanges = changes;
      return { success: true, meta: { changes } };
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
      async batch(statements) {
        const snapshot = structuredClone({
          materials: env.__materials,
          adjustments: env.__adjustments,
          auditLogs: env.__auditLogs,
        });
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          return results;
        } catch (error) {
          env.__materials = snapshot.materials;
          env.__adjustments = snapshot.adjustments;
          env.__auditLogs = snapshot.auditLogs;
          throw error;
        }
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
    market: 'cn',
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

test('manual inventory reduction cannot consume reserved stock', async () => {
  const env = createEnv();
  const created = await api(env, '/api/admin/materials', {
    method: 'POST',
    body: { material_code: 'RESERVED-001', name: 'Reserved part', stock_quantity: 10 },
  });
  env.__materials[0].reserved_quantity = 7;

  const denied = await api(env, `/api/admin/materials/${created.json.material.id}/inventory-adjustments`, {
    method: 'POST', body: { change_type: 'manual_out', delta: -5, reason: 'Count correction' },
  });

  assert.equal(denied.response.status, 409);
  assert.equal(env.__materials[0].stock_quantity, 10);
  assert.equal(env.__adjustments.length, 0);
  assert.equal(env.__auditLogs.length, 1, 'only material creation audit remains');
});

test('manual inventory adjustment rolls back stock and adjustment when audit or guard fails', async () => {
  for (const failure of ['audit', 'stale']) {
    const env = createEnv();
    const created = await api(env, '/api/admin/materials', {
      method: 'POST', body: { material_code: `ATOMIC-${failure}`, name: 'Atomic part', stock_quantity: 10 },
    });
    const before = structuredClone({ material: env.__materials[0], adjustments: env.__adjustments, audits: env.__auditLogs });
    if (failure === 'audit') env.__failNextAudit = true;
    else env.__forceNextStockMiss = true;

    const result = await api(env, `/api/admin/materials/${created.json.material.id}/inventory-adjustments`, {
      method: 'POST', body: { change_type: 'manual_out', delta: -2, reason: failure },
    });

    assert.equal(result.response.status, failure === 'audit' ? 500 : 409, failure);
    assert.deepEqual(env.__materials[0], before.material, failure);
    assert.deepEqual(env.__adjustments, before.adjustments, failure);
    assert.deepEqual(env.__auditLogs, before.audits, failure);
  }
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
