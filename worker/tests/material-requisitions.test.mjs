import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';
import { hashPasswordNew, signJwt } from '../src/lib/auth.js';
import { isKnownProtectedRoute } from '../src/lib/routes.js';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function clone(value) {
  return value == null ? value : structuredClone(value);
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

      if (/FROM admin_staff_accounts WHERE normalized_login = \? OR normalized_phone = \?/i.test(normalized)) {
        return clone(env.__staff.find((item) => item.normalized_login === this.args[0] || item.normalized_phone === this.args[1]) || null);
      }
      if (/FROM admin_staff_accounts WHERE normalized_login = \?/i.test(normalized)) {
        return clone(env.__staff.find((item) => item.normalized_login === this.args[0]) || null);
      }
      if (/FROM admin_staff_accounts WHERE id = \?/i.test(normalized)) {
        return clone(env.__staff.find((item) => item.id === this.args[0]) || null);
      }
      if (/SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = \?/i.test(normalized)) {
        return clone(env.__workOrders.find((item) => item.id === this.args[0]) || null);
      }
      if (/SELECT COUNT\(\*\) AS count FROM material_requisitions WHERE requisition_no LIKE \?/i.test(normalized)) {
        const prefix = String(this.args[0] || '').replace('%', '');
        return { count: env.__requisitions.filter((item) => item.requisition_no.startsWith(prefix)).length };
      }
      if (/FROM material_requisitions WHERE id = \?/i.test(normalized)) {
        return clone(env.__requisitions.find((item) => item.id === this.args[0]) || null);
      }
      if (/FROM material_requisition_items WHERE id = \? AND requisition_id = \?/i.test(normalized)) {
        return clone(env.__items.find((item) => item.id === this.args[0] && item.requisition_id === this.args[1]) || null);
      }
      if (/SELECT \* FROM materials WHERE id = \?/i.test(normalized)) {
        return clone(env.__materials.find((item) => item.id === this.args[0]) || null);
      }
      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);

      if (/FROM admin_staff_accounts/i.test(normalized)) {
        return { results: clone(env.__staff) };
      }
      if (/FROM material_requisition_items WHERE requisition_id = \?/i.test(normalized)) {
        return { results: clone(env.__items.filter((item) => item.requisition_id === this.args[0])) };
      }
      if (/FROM material_requisitions/i.test(normalized)) {
        let results = [...env.__requisitions];
        if (/JOIN work_orders/i.test(normalized)) {
          const workOrderIds = new Set(env.__workOrders.filter((order) => order.engineer_id === this.args[0]).map((order) => order.id));
          results = results.filter((item) => workOrderIds.has(item.work_order_id));
        } else if (/requested_by_type = 'engineer' AND requested_by_id = \?/i.test(normalized)) {
          results = results.filter((item) => item.requested_by_type === 'engineer' && item.requested_by_id === this.args[0]);
        }
        return { results: clone(results) };
      }
      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO admin_staff_accounts/i.test(normalized)) {
        const [id, normalizedLogin, normalizedPhone, passwordHash, salt, role, displayName, marketScope, createdBy] = this.args;
        env.__staff.push({
          id,
          normalized_login: normalizedLogin,
          normalized_phone: normalizedPhone,
          password_hash: passwordHash,
          salt,
          role,
          display_name: displayName,
          market_scope: marketScope,
          is_active: 1,
          must_change_password: 1,
          created_by: createdBy,
          created_at: '2026-07-23 00:00:00',
          updated_at: '2026-07-23 00:00:00',
        });
      } else if (/UPDATE admin_staff_accounts SET is_active = 0/i.test(normalized)) {
        const staff = env.__staff.find((item) => item.id === this.args[0]);
        if (staff) staff.is_active = 0;
      } else if (/UPDATE admin_staff_accounts SET password_hash = \?, salt = \?, must_change_password = 1/i.test(normalized)) {
        const staff = env.__staff.find((item) => item.id === this.args[2]);
        if (staff) Object.assign(staff, { password_hash: this.args[0], salt: this.args[1], must_change_password: 1 });
      } else if (/UPDATE admin_staff_accounts SET password_hash = \?, salt = \?, must_change_password = 0/i.test(normalized)) {
        const staff = env.__staff.find((item) => item.id === this.args[2]);
        if (staff) Object.assign(staff, { password_hash: this.args[0], salt: this.args[1], must_change_password: 0 });
      } else if (/INSERT INTO material_requisitions/i.test(normalized)) {
        const [id, requisitionNo, market, workOrderId, requestedByType, requestedById, status, urgency, requiredDate, purpose] = this.args;
        env.__requisitions.push({
          id,
          requisition_no: requisitionNo,
          market,
          work_order_id: workOrderId,
          requested_by_type: requestedByType,
          requested_by_id: requestedById,
          status,
          urgency,
          required_date: requiredDate,
          purpose,
          created_at: '2026-07-23 00:00:00',
          updated_at: '2026-07-23 00:00:00',
        });
      } else if (/INSERT INTO material_requisition_items/i.test(normalized)) {
        const [id, requisitionId, materialId, materialCode, name, nameEn, spec, brand, unit, requestedQuantity, notes] = this.args;
        env.__items.push({
          id,
          requisition_id: requisitionId,
          material_id: materialId,
          material_code: materialCode,
          name,
          name_en: nameEn,
          spec,
          brand,
          unit,
          requested_quantity: requestedQuantity,
          stock_allocated_quantity: 0,
          procurement_ordered_quantity: 0,
          procurement_received_quantity: 0,
          issued_quantity: 0,
          returned_quantity: 0,
          engineer_received_quantity: 0,
          fulfillment_source: 'unassigned',
          notes,
          status: 'pending',
        });
      } else if (/UPDATE material_requisitions SET/i.test(normalized)) {
        const requisition = env.__requisitions.find((item) => item.id === this.args.at(-1));
        if (requisition) {
          if (/SET status = \?, approved_by = \?/i.test(normalized)) {
            Object.assign(requisition, { status: this.args[0], approved_by: this.args[1], approved_at: env.__now });
          } else if (/SET status = \?, rejection_reason = \?/i.test(normalized)) {
            Object.assign(requisition, { status: this.args[0], rejection_reason: this.args[1] });
          } else if (/SET status = \?, cancellation_reason = \?/i.test(normalized)) {
            Object.assign(requisition, { status: this.args[0], cancellation_reason: this.args[1], cancelled_at: env.__now });
          } else if (/assigned_warehouse_staff_id = \?/i.test(normalized)) {
            requisition.assigned_warehouse_staff_id = this.args[0];
            if (/issued_at = COALESCE/i.test(normalized)) requisition.issued_at ||= env.__now;
          } else if (/assigned_procurement_staff_id = \?/i.test(normalized)) {
            requisition.assigned_procurement_staff_id = this.args[0];
          } else if (/received_at = COALESCE/i.test(normalized)) {
            if (/SET status = \?/i.test(normalized)) requisition.status = this.args[0];
            requisition.received_at ||= env.__now;
          } else if (/SET status = 'closed'/i.test(normalized)) {
            requisition.status = 'closed';
            requisition.closed_at = env.__now;
          } else if (/SET status = \?/i.test(normalized)) {
            requisition.status = this.args[0];
          }
        }
      } else if (/UPDATE material_requisition_items SET/i.test(normalized)) {
        const item = env.__items.find((entry) => entry.id === this.args.at(-2) && entry.requisition_id === this.args.at(-1));
        if (item) {
          const assignments = normalized.match(/SET (.+?) WHERE/i)?.[1].split(',').map((part) => part.trim()) || [];
          assignments.forEach((assignment, index) => {
            const column = assignment.split('=')[0].trim();
            if (!/updated_at/i.test(column)) item[column] = this.args[index];
          });
        }
      } else if (/UPDATE materials SET stock_quantity = stock_quantity \+ \?/i.test(normalized)) {
        const material = env.__materials.find((item) => item.id === this.args[1]);
        if (material) material.stock_quantity += this.args[0];
      } else if (/INSERT INTO material_inventory_adjustments/i.test(normalized)) {
        env.__adjustments.push({ args: clone(this.args) });
      } else if (/INSERT INTO audit_logs/i.test(normalized)) {
        env.__auditLogs.push({ args: clone(this.args) });
      }
      return { success: true, meta: { changes: 1 } };
    },
  };
}

function createEnv() {
  const env = {
    JWT_SECRET: 'material-requisition-test-secret',
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'bootstrap-password',
    __staff: [],
    __requisitions: [],
    __items: [],
    __auditLogs: [],
    __adjustments: [],
    __materials: [
      { id: 'material-stock', material_code: 'STOCK-1', name: 'Stock item', unit: 'pcs', stock_quantity: 10 },
      { id: 'material-buy', material_code: 'BUY-1', name: 'Purchased item', unit: 'pcs', stock_quantity: 0 },
    ],
    __workOrders: [
      { id: 'wo-1', customer_id: 'customer-1', engineer_id: 'engineer-1', assigned_regional_lead_id: 'lead-1', status: 'in_progress' },
    ],
    __now: '2026-07-23 00:00:00',
    DB: {
      prepare(sql) { return createStatement(env, sql); },
      async batch(statements) {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
      },
    },
    KV: {
      values: new Map(),
      async get(key) { return this.values.get(key) || null; },
      async put(key, value) { this.values.set(key, value); },
      async delete(key) { this.values.delete(key); },
    },
  };
  return env;
}

async function authToken(env, payload) {
  return signJwt({
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  }, env.JWT_SECRET);
}

async function api(env, path, {
  method = 'GET',
  body,
  auth = { userId: 'engineer-1', userType: 'engineer' },
  origin = auth?.userType === 'admin' ? 'https://admin.sagemro.com' : 'https://engineer.sagemro.com',
} = {}) {
  if (auth?.staffId && !env.__staff.some((staff) => staff.id === auth.staffId)) {
    env.__staff.push({
      id: auth.staffId,
      normalized_login: auth.staffId,
      normalized_phone: null,
      password_hash: '',
      salt: '',
      role: auth.staffRole,
      display_name: auth.staffRole,
      market_scope: 'all',
      is_active: 1,
      must_change_password: 0,
    });
  }
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (auth) headers.Authorization = `Bearer ${await authToken(env, auth)}`;
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

function staffAuth(role, staffId = `${role}-1`) {
  return { userId: staffId, userType: 'admin', staffId, staffRole: role, mustChangePassword: false, market: 'com' };
}

async function createAndSubmit(env) {
  const created = await api(env, '/api/material-requisitions', {
    method: 'POST',
    body: {
      work_order_id: 'wo-1',
      urgency: 'urgent',
      required_date: '2026-07-30',
      purpose: 'Field repair',
      items: [
        { material_id: 'material-stock', requested_quantity: 2, notes: 'Use local stock' },
        { material_id: 'material-buy', requested_quantity: 3, notes: 'Purchase shortage' },
      ],
    },
  });
  assert.equal(created.response.status, 201);
  const submitted = await api(env, `/api/material-requisitions/${created.json.requisition.id}/submit`, { method: 'POST' });
  assert.equal(submitted.response.status, 200);
  return submitted.json.requisition;
}

test('material requisition and staff routes are protected', async () => {
  assert.equal(isKnownProtectedRoute('/api/material-requisitions'), true);
  assert.equal(isKnownProtectedRoute('/api/material-requisitions/req-1/submit'), true);
  assert.equal(isKnownProtectedRoute('/api/admin/staff'), true);

  const result = await api(createEnv(), '/api/material-requisitions', { auth: null });
  assert.equal(result.response.status, 401);
});

test('bootstrap admin creates staff, staff login carries role claims, and only bootstrap manages accounts', async () => {
  const env = createEnv();
  const bootstrap = { userId: 'admin', userType: 'admin' };
  const created = await api(env, '/api/admin/staff', {
    method: 'POST',
    auth: bootstrap,
    body: { login: ' Warehouse One ', phone: '+86 138 1111 2222', role: 'warehouse', display_name: 'Warehouse One', market_scope: 'all' },
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.json.staff.normalized_login, 'warehouse one');
  assert.equal(created.json.staff.normalized_phone, '+8613811112222');
  assert.equal(created.json.staff.must_change_password, 1);
  assert.match(created.json.temporary_password, /^[A-Za-z0-9]{12}$/);

  const denied = await api(env, '/api/admin/staff', { auth: staffAuth('admin') });
  assert.equal(denied.response.status, 403);

  const loginResponse = await worker.fetch(new Request('https://api.sagemro.cn/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://api.sagemro.cn' },
    body: JSON.stringify({ phone: '+86 138 1111 2222', password: created.json.temporary_password }),
  }), env, { waitUntil() {} });
  const login = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.equal(login.user.staffRole, 'warehouse');
  assert.equal(login.user.mustChangePassword, true);
  assert.match(login.token, /^[^.]+\.[^.]+\.[^.]+$/);

  const temporaryAuth = staffAuth('warehouse', created.json.staff.id);
  const blockedUntilChanged = await api(env, '/api/material-requisitions', { auth: temporaryAuth });
  assert.equal(blockedUntilChanged.response.status, 403);
  const changed = await api(env, '/api/auth/change-password', {
    method: 'POST',
    auth: temporaryAuth,
    body: { oldPassword: created.json.temporary_password, newPassword: 'permanent-password-123' },
  });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.json.mustChangePassword, false);
  assert.equal((await api(env, '/api/material-requisitions', { auth: temporaryAuth })).response.status, 200);
  const crossMarket = await api(env, '/api/material-requisitions', {
    auth: { ...temporaryAuth, market: 'cn' },
  });
  assert.equal(crossMarket.response.status, 403);
  const crossMarketSession = await api(env, '/api/auth/session', {
    auth: { ...temporaryAuth, market: 'cn' },
  });
  assert.equal(crossMarketSession.response.status, 200);
  assert.equal(crossMarketSession.json.authenticated, false);

  const reset = await api(env, `/api/admin/staff/${created.json.staff.id}/reset-password`, { method: 'POST', auth: bootstrap });
  assert.equal(reset.response.status, 200);
  assert.notEqual(reset.json.temporary_password, created.json.temporary_password);

  const deactivated = await api(env, `/api/admin/staff/${created.json.staff.id}/deactivate`, { method: 'POST', auth: bootstrap });
  assert.equal(deactivated.response.status, 200);
  assert.equal(deactivated.json.staff.is_active, 0);
  assert.equal(env.__auditLogs.length, 4);
});

test('assigned engineer creates and submits a deterministic multi-line draft; other engineers are denied', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);

  assert.match(requisition.requisition_no, /^MR-\d{8}-[A-Z0-9]{8,}$/);
  assert.equal(requisition.status, 'submitted');
  assert.equal(requisition.items.length, 2);

  const denied = await api(env, '/api/material-requisitions', {
    method: 'POST',
    auth: { userId: 'engineer-2', userType: 'engineer' },
    body: { work_order_id: 'wo-1', items: [{ name: 'Manual item', requested_quantity: 1 }] },
  });
  assert.equal(denied.response.status, 403);
  assert.equal(env.__requisitions.length, 1);

  const empty = await api(env, '/api/material-requisitions', {
    method: 'POST',
    body: { work_order_id: 'wo-1', items: [] },
  });
  assert.equal(empty.response.status, 400);

  const ownList = await api(env, '/api/material-requisitions');
  assert.equal(ownList.response.status, 200);
  assert.equal(ownList.json.requisitions.length, 1);
  const otherList = await api(env, '/api/material-requisitions', { auth: { userId: 'engineer-2', userType: 'engineer' } });
  assert.equal(otherList.json.requisitions.length, 0);
  const deniedDetail = await api(env, `/api/material-requisitions/${requisition.id}`, {
    auth: { userId: 'engineer-2', userType: 'engineer' },
  });
  assert.equal(deniedDetail.response.status, 403);
});

test('admin-created draft remains operable by the engineer assigned to the work order', async () => {
  const env = createEnv();
  const created = await api(env, '/api/material-requisitions', {
    method: 'POST',
    auth: staffAuth('admin'),
    body: {
      work_order_id: 'wo-1',
      items: [{ material_id: 'material-stock', requested_quantity: 1 }],
    },
  });
  assert.equal(created.response.status, 201);

  const requisitionId = created.json.requisition.id;
  const itemId = created.json.requisition.items[0].id;
  const listed = await api(env, '/api/material-requisitions');
  assert.equal(listed.json.requisitions.length, 1);
  const detail = await api(env, `/api/material-requisitions/${requisitionId}`);
  assert.equal(detail.response.status, 200);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/submit`, { method: 'POST' })).response.status, 200);
  const approval = await api(env, `/api/material-requisitions/${requisitionId}/approve`, { method: 'POST', auth: staffAuth('operations') });
  assert.equal(approval.response.status, 200);
  assert.equal(approval.json.requisition.approved_by, 'operations-1');
  assert.equal(approval.json.requisition.approved_at, env.__now);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: itemId, quantity: 1 },
  })).response.status, 200);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: itemId, quantity: 1 },
  })).response.status, 200);
  assert.equal(env.__requisitions[0].assigned_warehouse_staff_id, 'warehouse-1');
  assert.equal(env.__requisitions[0].issued_at, env.__now);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/engineer-receipt`, {
    method: 'POST', body: { item_id: itemId, quantity: 1 },
  })).response.status, 200);
  assert.equal(env.__requisitions[0].received_at, env.__now);
});

test('operations, warehouse, procurement, and engineer complete a mixed fulfillment lifecycle', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  const [stockItem, buyItem] = requisition.items;

  const approved = await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  assert.equal(approved.response.status, 200);

  const allocated = await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST',
    auth: staffAuth('warehouse'),
    body: { item_id: stockItem.id, quantity: 2 },
  });
  assert.equal(allocated.response.status, 200);
  assert.equal(env.__materials[0].stock_quantity, 10, 'allocation does not change aggregate stock');

  const ordered = await api(env, `/api/material-requisitions/${requisition.id}/procurement`, {
    method: 'POST',
    auth: staffAuth('procurement'),
    body: { item_id: buyItem.id, quantity: 3, supplier_reference: 'SUP-42', expected_arrival: '2026-07-28' },
  });
  assert.equal(ordered.response.status, 200);
  assert.equal(env.__requisitions[0].assigned_procurement_staff_id, 'procurement-1');

  const purchaseUpdated = await api(env, `/api/material-requisitions/${requisition.id}/procurement`, {
    method: 'PATCH',
    auth: staffAuth('procurement'),
    body: { item_id: buyItem.id, supplier_reference: 'SUP-43', expected_arrival: '2026-07-29' },
  });
  assert.equal(purchaseUpdated.response.status, 200);
  assert.equal(purchaseUpdated.json.requisition.items[1].supplier_reference, 'SUP-43');

  const receivedPurchase = await api(env, `/api/material-requisitions/${requisition.id}/procurement-receipt`, {
    method: 'POST',
    auth: staffAuth('procurement'),
    body: { item_id: buyItem.id, quantity: 3 },
  });
  assert.equal(receivedPurchase.response.status, 200);
  assert.equal(env.__materials[1].stock_quantity, 3);

  const issuedStock = await api(env, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST',
    auth: staffAuth('warehouse'),
    body: { item_id: stockItem.id, quantity: 2 },
  });
  assert.equal(issuedStock.response.status, 200);
  const issuedBuy = await api(env, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST',
    auth: staffAuth('warehouse'),
    body: { item_id: buyItem.id, quantity: 3 },
  });
  assert.equal(issuedBuy.response.status, 200);
  assert.deepEqual(env.__materials.map((item) => item.stock_quantity), [8, 0]);

  const returned = await api(env, `/api/material-requisitions/${requisition.id}/return`, {
    method: 'POST',
    auth: staffAuth('warehouse'),
    body: { item_id: buyItem.id, quantity: 1 },
  });
  assert.equal(returned.response.status, 200);
  assert.equal(env.__materials[1].stock_quantity, 1);

  for (const [itemId, quantity] of [[stockItem.id, 2], [buyItem.id, 2]]) {
    const receipt = await api(env, `/api/material-requisitions/${requisition.id}/engineer-receipt`, {
      method: 'POST',
      body: { item_id: itemId, quantity },
    });
    assert.equal(receipt.response.status, 200);
  }

  const closed = await api(env, `/api/material-requisitions/${requisition.id}/close`, { method: 'POST', auth: staffAuth('operations') });
  assert.equal(closed.response.status, 200);
  assert.equal(closed.json.requisition.status, 'closed');
  assert.equal(env.__requisitions[0].closed_at, env.__now);
  assert.equal(env.__adjustments.length, 4);
  assert.ok(env.__auditLogs.length >= 11);
});

test('role, state, ownership, and quantity invariants reject invalid writes without stock changes', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  const item = requisition.items[0];

  const wrongRole = await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('warehouse') });
  assert.equal(wrongRole.response.status, 403);

  const beforeApproval = await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 1 },
  });
  assert.equal(beforeApproval.response.status, 409);

  await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  const overAllocate = await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 3 },
  });
  assert.equal(overAllocate.response.status, 400);

  const overIssue = await api(env, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 1 },
  });
  assert.equal(overIssue.response.status, 400);

  env.__items[0].requested_quantity = 20;
  const overStock = await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 11 },
  });
  assert.equal(overStock.response.status, 400);

  const otherEngineerReceipt = await api(env, `/api/material-requisitions/${requisition.id}/engineer-receipt`, {
    method: 'POST', auth: { userId: 'engineer-2', userType: 'engineer' }, body: { item_id: item.id, quantity: 1 },
  });
  assert.equal(otherEngineerReceipt.response.status, 403);

  const prematureClose = await api(env, `/api/material-requisitions/${requisition.id}/close`, { method: 'POST', auth: staffAuth('operations') });
  assert.equal(prematureClose.response.status, 409);
  assert.deepEqual(env.__materials.map((entry) => entry.stock_quantity), [10, 0]);
  assert.equal(env.__adjustments.length, 0);
});

test('operations can reject submitted requisitions and cancel non-terminal requisitions', async () => {
  const rejectedEnv = createEnv();
  const rejected = await createAndSubmit(rejectedEnv);
  const rejectResult = await api(rejectedEnv, `/api/material-requisitions/${rejected.id}/reject`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'Insufficient justification' },
  });
  assert.equal(rejectResult.response.status, 200);
  assert.equal(rejectResult.json.requisition.status, 'rejected');
  assert.equal(rejectResult.json.requisition.rejection_reason, 'Insufficient justification');

  const cancelledEnv = createEnv();
  const cancelled = await createAndSubmit(cancelledEnv);
  const cancelResult = await api(cancelledEnv, `/api/material-requisitions/${cancelled.id}/cancel`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'Work order cancelled' },
  });
  assert.equal(cancelResult.response.status, 200);
  assert.equal(cancelResult.json.requisition.status, 'cancelled');
  assert.equal(cancelResult.json.requisition.cancellation_reason, 'Work order cancelled');
});

test('operations can cancel an unneeded line so the remaining received lines can close', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  const [receivedItem, cancelledItem] = requisition.items;
  await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: receivedItem.id, quantity: 2 },
  });
  await api(env, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: receivedItem.id, quantity: 2 },
  });
  await api(env, `/api/material-requisitions/${requisition.id}/engineer-receipt`, {
    method: 'POST', body: { item_id: receivedItem.id, quantity: 2 },
  });

  const cancelled = await api(env, `/api/material-requisitions/${requisition.id}/items/${cancelledItem.id}/cancel`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'No longer required' },
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.json.requisition.items[1].status, 'cancelled');
  assert.equal(env.__requisitions[0].received_at, env.__now);

  const closed = await api(env, `/api/material-requisitions/${requisition.id}/close`, {
    method: 'POST', auth: staffAuth('operations'),
  });
  assert.equal(closed.response.status, 200);
});

test('free-form items can use procurement fulfillment without changing aggregate material stock', async () => {
  const env = createEnv();
  const created = await api(env, '/api/material-requisitions', {
    method: 'POST',
    body: {
      work_order_id: 'wo-1',
      items: [{ name: 'Custom hose assembly', unit: 'set', requested_quantity: 1 }],
    },
  });
  const requisitionId = created.json.requisition.id;
  const itemId = created.json.requisition.items[0].id;
  await api(env, `/api/material-requisitions/${requisitionId}/submit`, { method: 'POST' });
  await api(env, `/api/material-requisitions/${requisitionId}/approve`, { method: 'POST', auth: staffAuth('operations') });

  const stockDenied = await api(env, `/api/material-requisitions/${requisitionId}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: itemId, quantity: 1 },
  });
  assert.equal(stockDenied.response.status, 400);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/procurement`, {
    method: 'POST', auth: staffAuth('procurement'), body: { item_id: itemId, quantity: 1 },
  })).response.status, 200);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/procurement-receipt`, {
    method: 'POST', auth: staffAuth('procurement'), body: { item_id: itemId, quantity: 1 },
  })).response.status, 200);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: itemId, quantity: 1 },
  })).response.status, 200);
  assert.equal((await api(env, `/api/material-requisitions/${requisitionId}/engineer-receipt`, {
    method: 'POST', body: { item_id: itemId, quantity: 1 },
  })).response.status, 200);
  assert.equal(env.__adjustments.length, 0);
  assert.deepEqual(env.__materials.map((item) => item.stock_quantity), [10, 0]);
});
