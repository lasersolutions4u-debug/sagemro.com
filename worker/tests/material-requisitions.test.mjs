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
      let changes = 0;

      if (/INSERT INTO admin_staff_accounts/i.test(normalized)) {
        const [id, normalizedLogin, normalizedPhone, passwordHash, salt, role, displayName, marketScope, createdBy] = this.args;
        if (env.__staff.some((item) => item.normalized_login === normalizedLogin || (normalizedPhone && item.normalized_phone === normalizedPhone))) {
          throw new Error('UNIQUE constraint failed: admin_staff_accounts.normalized_login');
        }
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
        changes = 1;
      } else if (/UPDATE admin_staff_accounts SET is_active = 0/i.test(normalized)) {
        const staff = env.__staff.find((item) => item.id === this.args[0]);
        if (staff) {
          staff.is_active = 0;
          changes = 1;
        }
      } else if (/UPDATE admin_staff_accounts SET password_hash = \?, salt = \?, must_change_password = 1/i.test(normalized)) {
        const staff = env.__staff.find((item) => item.id === this.args[2]);
        if (staff) {
          Object.assign(staff, { password_hash: this.args[0], salt: this.args[1], must_change_password: 1 });
          changes = 1;
        }
      } else if (/UPDATE admin_staff_accounts SET password_hash = \?, salt = \?, must_change_password = 0/i.test(normalized)) {
        const staff = env.__staff.find((item) => item.id === this.args[2]);
        if (staff) {
          Object.assign(staff, { password_hash: this.args[0], salt: this.args[1], must_change_password: 0 });
          changes = 1;
        }
      } else if (/INSERT INTO material_requisitions/i.test(normalized)) {
        const [id, requisitionNo, market, workOrderId, requestedByType, requestedById, status, urgency, requiredDate, purpose] = this.args;
        if (env.__requisitionInsertCollisions > 0) {
          env.__requisitionInsertCollisions -= 1;
          throw new Error('UNIQUE constraint failed: material_requisitions.requisition_no');
        }
        if (env.__requisitions.some((item) => item.id === id || item.requisition_no === requisitionNo)) {
          throw new Error('UNIQUE constraint failed: material_requisitions.requisition_no');
        }
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
        changes = 1;
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
        changes = 1;
      } else if (/UPDATE material_requisitions SET/i.test(normalized)) {
        const hasStatusPredicate = /WHERE id = \? AND status = \?/i.test(normalized);
        const idIndex = hasStatusPredicate ? this.args.length - 2 : this.args.length - 1;
        const requisition = env.__requisitions.find((item) => item.id === this.args[idIndex]);
        if (requisition && hasStatusPredicate && requisition.status !== this.args.at(-1)) {
          env.__lastChanges = 0;
          return { success: true, meta: { changes: 0 } };
        }
        if (requisition && /NOT EXISTS/i.test(normalized)
          && env.__items.some((item) => item.requisition_id === requisition.id
            && (Number(item.procurement_received_quantity || 0) > 0
              || Number(item.issued_quantity || 0) > 0
              || Number(item.engineer_received_quantity || 0) > 0))) {
          env.__lastChanges = 0;
          return { success: true, meta: { changes: 0 } };
        }
        if (requisition) {
          if (/SET status = \?, approved_by = \?/i.test(normalized)) {
            Object.assign(requisition, { status: this.args[0], approved_by: this.args[1], approved_at: env.__now });
          } else if (/SET status = \?, rejection_reason = \?/i.test(normalized)) {
            Object.assign(requisition, { status: this.args[0], rejection_reason: this.args[1] });
          } else if (/SET status = \?, cancellation_reason = \?/i.test(normalized)) {
            Object.assign(requisition, { status: this.args[0], cancellation_reason: this.args[1], cancelled_at: env.__now });
          } else if (/assigned_warehouse_staff_id = \?/i.test(normalized)) {
            requisition.status = this.args[0];
            requisition.assigned_warehouse_staff_id = this.args[1];
            if (/issued_at = COALESCE/i.test(normalized)) requisition.issued_at ||= env.__now;
          } else if (/assigned_procurement_staff_id = \?/i.test(normalized)) {
            requisition.status = this.args[0];
            requisition.assigned_procurement_staff_id = this.args[1];
          } else if (/received_at = COALESCE/i.test(normalized)) {
            if (/SET status = \?/i.test(normalized)) requisition.status = this.args[0];
            requisition.received_at ||= env.__now;
          } else if (/SET status = 'closed'/i.test(normalized)) {
            requisition.status = 'closed';
            requisition.closed_at = env.__now;
          } else if (/SET status = \?/i.test(normalized)) {
            requisition.status = this.args[0];
          }
          changes = 1;
        }
      } else if (/UPDATE material_requisition_items SET/i.test(normalized)) {
        const whereStart = normalized.indexOf(' WHERE ');
        const whereSql = whereStart >= 0 ? normalized.slice(whereStart) : '';
        const predicateColumns = [...whereSql.matchAll(/(?:WHERE|AND) ([a-z_]+) = \?/gi)].map((match) => match[1]);
        const idOffset = this.args.length - predicateColumns.length;
        const predicates = Object.fromEntries(predicateColumns.map((column, index) => [column, this.args[idOffset + index]]));
        const item = env.__items.find((entry) => entry.id === predicates.id && entry.requisition_id === predicates.requisition_id);
        if (env.__forceNextConditionalItemMiss && predicateColumns.length > 2) {
          env.__forceNextConditionalItemMiss = false;
          env.__lastChanges = 0;
          return { success: true, meta: { changes: 0 } };
        }
        const matches = item && predicateColumns.every((column) => {
          if (column === 'id' || column === 'requisition_id') return item[column] === predicates[column];
          if (column === 'status') return item[column] === predicates[column];
          return Number.isFinite(Number(item[column])) && Number(item[column]) === Number(predicates[column]);
        });
        if (matches) {
          const assignments = normalized.match(/SET (.+?) WHERE/i)?.[1].split(',').map((part) => part.trim()) || [];
          assignments.forEach((assignment, index) => {
            const column = assignment.split('=')[0].trim();
            if (!/updated_at/i.test(column)) item[column] = this.args[index];
          });
          changes = 1;
        }
      } else if (/UPDATE materials SET stock_quantity = stock_quantity(?: [+-] \?)?/i.test(normalized)) {
        const subtract = /stock_quantity = stock_quantity - \?/i.test(normalized);
        const add = /stock_quantity = stock_quantity \+ \?/i.test(normalized);
        const quantity = add || subtract ? Number(this.args[0]) : 0;
        const materialId = add || subtract ? this.args[1] : this.args[0];
        const material = env.__materials.find((item) => item.id === materialId);
        if (env.__stockBeforeNextMutation !== undefined) {
          if (material) material.stock_quantity = env.__stockBeforeNextMutation;
          delete env.__stockBeforeNextMutation;
        }
        const expectedIndex = /stock_quantity = \?/i.test(normalized) ? (add || subtract ? 2 : 1) : -1;
        const hasEnough = !/stock_quantity >= \?/i.test(normalized)
          || Number(material?.stock_quantity || 0) >= Number(this.args.at(-1));
        const expectedMatches = expectedIndex < 0 || Number(material?.stock_quantity || 0) === Number(this.args[expectedIndex]);
        if (material && hasEnough && expectedMatches) {
          material.stock_quantity += subtract ? -quantity : quantity;
          changes = 1;
        }
      } else if (/INSERT INTO material_inventory_adjustments/i.test(normalized)) {
        env.__adjustments.push({ args: clone(this.args) });
        changes = 1;
      } else if (/INSERT INTO audit_logs/i.test(normalized)) {
        if (env.__failNextAudit) {
          env.__failNextAudit = false;
          throw new Error('audit insert failed');
        }
        env.__auditLogs.push({ args: clone(this.args) });
        changes = 1;
      } else if (/SELECT CASE WHEN changes\(\) = 1/i.test(normalized)) {
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
    JWT_SECRET: 'material-requisition-test-secret',
    ADMIN_PHONE: '13800000000',
    ADMIN_PASSWORD: 'bootstrap-password',
    __staff: [],
    __requisitions: [],
    __items: [],
    __auditLogs: [],
    __adjustments: [],
    __requisitionInsertCollisions: 0,
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
        if (env.__issueBeforeNextBatch) {
          const item = env.__items.find((entry) => entry.requisition_id === env.__issueBeforeNextBatch);
          if (item) item.issued_quantity = 1;
          delete env.__issueBeforeNextBatch;
        }
        if (env.__terminalStatusBeforeNextBatch) {
          const requisition = env.__requisitions.find((entry) => entry.id === env.__terminalStatusBeforeNextBatch.id);
          if (requisition) requisition.status = env.__terminalStatusBeforeNextBatch.status;
          delete env.__terminalStatusBeforeNextBatch;
        }
        const snapshot = clone({
          staff: env.__staff,
          requisitions: env.__requisitions,
          items: env.__items,
          auditLogs: env.__auditLogs,
          adjustments: env.__adjustments,
          materials: env.__materials,
        });
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          return results;
        } catch (error) {
          env.__staff = snapshot.staff;
          env.__requisitions = snapshot.requisitions;
          env.__items = snapshot.items;
          env.__auditLogs = snapshot.auditLogs;
          env.__adjustments = snapshot.adjustments;
          env.__materials = snapshot.materials;
          throw error;
        }
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

  const listed = await api(env, '/api/admin/staff', { auth: bootstrap });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.staff.length, 1);
  assert.equal(listed.json.staff[0].id, created.json.staff.id);

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
  const rejectedSession = await api(env, '/api/material-requisitions', { auth: temporaryAuth });
  assert.equal(rejectedSession.response.status, 403);
  const inactiveSession = await api(env, '/api/auth/session', { auth: temporaryAuth });
  assert.equal(inactiveSession.response.status, 200);
  assert.equal(inactiveSession.json.authenticated, false);
  assert.equal(env.__auditLogs.length, 4);
});

test('requisition number collisions retry without leaving a partial requisition', async () => {
  const env = createEnv();
  env.__requisitionInsertCollisions = 1;

  const created = await api(env, '/api/material-requisitions', {
    method: 'POST',
    body: {
      work_order_id: 'wo-1',
      items: [{ material_id: 'material-stock', requested_quantity: 1 }],
    },
  });

  assert.equal(created.response.status, 201);
  assert.equal(env.__requisitions.length, 1);
  assert.equal(env.__items.length, 1);
  assert.match(created.json.requisition.requisition_no, /^MR-\d{8}-[A-Z0-9]{8,}$/);
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
  assert.deepEqual(env.__adjustments.map((entry) => entry.args.slice(3, 6)), [
    [3, 0, 3],
    [-2, 10, 8],
    [-3, 3, 0],
    [1, 0, 1],
  ]);
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

test('stale item updates fail atomically without item, stock, adjustment, or audit drift', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  const item = requisition.items[0];
  await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 2 },
  });
  const before = clone({ item: env.__items[0], material: env.__materials[0], adjustments: env.__adjustments, auditLogs: env.__auditLogs });
  env.__forceNextConditionalItemMiss = true;

  const result = await api(env, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 1 },
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual(env.__items[0], before.item);
  assert.deepEqual(env.__materials[0], before.material);
  assert.deepEqual(env.__adjustments, before.adjustments);
  assert.deepEqual(env.__auditLogs, before.auditLogs);
});

test('concurrent stock overdraw fails atomically and preserves adjustment provenance', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  const item = requisition.items[0];
  await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 2 },
  });
  const beforeItem = clone(env.__items[0]);
  const beforeAuditCount = env.__auditLogs.length;
  env.__stockBeforeNextMutation = 0;

  const result = await api(env, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 2 },
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual(env.__items[0], beforeItem);
  assert.equal(env.__materials[0].stock_quantity, 10);
  assert.equal(env.__adjustments.length, 0);
  assert.equal(env.__auditLogs.length, beforeAuditCount);
});

test('audit insertion failure rolls back staff, requisition, line, and stock workflow writes', async () => {
  const staffEnv = createEnv();
  staffEnv.__failNextAudit = true;
  const staffResult = await api(staffEnv, '/api/admin/staff', {
    method: 'POST', auth: { userId: 'admin', userType: 'admin' },
    body: { login: 'ops', role: 'operations', display_name: 'Ops', market_scope: 'all' },
  });
  assert.equal(staffResult.response.status, 500);
  assert.equal(staffEnv.__staff.length, 0);

  const createEnvWithAuditFailure = createEnv();
  createEnvWithAuditFailure.__failNextAudit = true;
  const createResult = await api(createEnvWithAuditFailure, '/api/material-requisitions', {
    method: 'POST', body: { work_order_id: 'wo-1', items: [{ material_id: 'material-stock', requested_quantity: 1 }] },
  });
  assert.equal(createResult.response.status, 500);
  assert.equal(createEnvWithAuditFailure.__requisitions.length, 0);
  assert.equal(createEnvWithAuditFailure.__items.length, 0);

  const stockEnv = createEnv();
  const requisition = await createAndSubmit(stockEnv);
  const item = requisition.items[0];
  await api(stockEnv, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  await api(stockEnv, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 2 },
  });
  const before = clone({ item: stockEnv.__items[0], material: stockEnv.__materials[0], adjustments: stockEnv.__adjustments });
  stockEnv.__failNextAudit = true;
  const stockResult = await api(stockEnv, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 1 },
  });
  assert.equal(stockResult.response.status, 500);
  assert.deepEqual(stockEnv.__items[0], before.item);
  assert.deepEqual(stockEnv.__materials[0], before.material);
  assert.deepEqual(stockEnv.__adjustments, before.adjustments);
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

test('whole cancellation is rejected after issue or receipt', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  const item = requisition.items[0];
  await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  await api(env, `/api/material-requisitions/${requisition.id}/stock-allocation`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 1 },
  });
  await api(env, `/api/material-requisitions/${requisition.id}/issue`, {
    method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 1 },
  });

  const issuedCancellation = await api(env, `/api/material-requisitions/${requisition.id}/cancel`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'Too late' },
  });
  assert.equal(issuedCancellation.response.status, 409);

  env.__items[0].issued_quantity = 0;
  env.__items[0].engineer_received_quantity = 1;
  const receivedCancellation = await api(env, `/api/material-requisitions/${requisition.id}/cancel`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'Still too late' },
  });
  assert.equal(receivedCancellation.response.status, 409);
  assert.notEqual(env.__requisitions[0].status, 'cancelled');

  env.__items[0].engineer_received_quantity = 0;
  env.__items[0].procurement_received_quantity = 1;
  const procuredCancellation = await api(env, `/api/material-requisitions/${requisition.id}/cancel`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'Received stock exists' },
  });
  assert.equal(procuredCancellation.response.status, 409);
});

test('cancellation loses a race with issue without overwriting the issued requisition', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  env.__issueBeforeNextBatch = requisition.id;

  const result = await api(env, `/api/material-requisitions/${requisition.id}/cancel`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'Concurrent cancellation' },
  });

  assert.equal(result.response.status, 409);
  assert.equal(env.__items[0].issued_quantity, 1);
  assert.notEqual(env.__requisitions[0].status, 'cancelled');
});

test('procurement metadata loses a race with a terminal transition', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  const item = requisition.items[1];
  await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  env.__terminalStatusBeforeNextBatch = { id: requisition.id, status: 'cancelled' };

  const result = await api(env, `/api/material-requisitions/${requisition.id}/procurement`, {
    method: 'PATCH', auth: staffAuth('procurement'),
    body: { item_id: item.id, supplier_reference: 'LATE' },
  });

  assert.equal(result.response.status, 409);
  assert.equal(env.__requisitions[0].status, 'cancelled');
  assert.equal(env.__items[1].supplier_reference, undefined);
});

test('terminal requisitions reject line, procurement, receipt, and fulfillment writes', async () => {
  for (const terminalStatus of ['cancelled', 'rejected', 'closed']) {
    const env = createEnv();
    const requisition = await createAndSubmit(env);
    const item = requisition.items[0];
    env.__requisitions[0].status = terminalStatus;
    const before = clone({ item: env.__items[0], material: env.__materials[0], audits: env.__auditLogs });
    const requests = [
      api(env, `/api/material-requisitions/${requisition.id}/items/${item.id}/cancel`, { method: 'POST', auth: staffAuth('operations') }),
      api(env, `/api/material-requisitions/${requisition.id}/procurement`, { method: 'PATCH', auth: staffAuth('procurement'), body: { item_id: item.id, supplier_reference: 'NOPE' } }),
      api(env, `/api/material-requisitions/${requisition.id}/engineer-receipt`, { method: 'POST', body: { item_id: item.id, quantity: 1 } }),
      api(env, `/api/material-requisitions/${requisition.id}/issue`, { method: 'POST', auth: staffAuth('warehouse'), body: { item_id: item.id, quantity: 1 } }),
    ];
    const results = await Promise.all(requests);
    assert.deepEqual(results.map((result) => result.response.status), [409, 409, 409, 409], terminalStatus);
    assert.deepEqual(env.__items[0], before.item);
    assert.deepEqual(env.__materials[0], before.material);
    assert.deepEqual(env.__auditLogs, before.audits);
  }
});

test('closed requisitions reject repeated close writes', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  env.__requisitions[0].status = 'closed';
  env.__items.forEach((item) => { item.status = 'received'; });
  const auditCount = env.__auditLogs.length;

  const result = await api(env, `/api/material-requisitions/${requisition.id}/close`, {
    method: 'POST', auth: staffAuth('operations'),
  });

  assert.equal(result.response.status, 409);
  assert.equal(env.__auditLogs.length, auditCount);
});

test('received procurement lines cannot be cancelled', async () => {
  const env = createEnv();
  const requisition = await createAndSubmit(env);
  const item = requisition.items[1];
  await api(env, `/api/material-requisitions/${requisition.id}/approve`, { method: 'POST', auth: staffAuth('operations') });
  await api(env, `/api/material-requisitions/${requisition.id}/procurement`, {
    method: 'POST', auth: staffAuth('procurement'), body: { item_id: item.id, quantity: 1 },
  });
  await api(env, `/api/material-requisitions/${requisition.id}/procurement-receipt`, {
    method: 'POST', auth: staffAuth('procurement'), body: { item_id: item.id, quantity: 1 },
  });
  const before = clone(env.__items[1]);

  const result = await api(env, `/api/material-requisitions/${requisition.id}/items/${item.id}/cancel`, {
    method: 'POST', auth: staffAuth('operations'), body: { reason: 'No longer needed' },
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual(env.__items[1], before);
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
