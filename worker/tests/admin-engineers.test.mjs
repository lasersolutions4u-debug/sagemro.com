import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

const JWT_SECRET = 'admin-engineers-test-secret-32-chars';

function makeEnv() {
  const engineer = {
    id: 'eng-1',
    user_no: 'E-20260708-001',
    name: 'SAGEMRO Test Engineer',
    phone: '13800000001',
    company: 'Test Service Team',
    specialties: JSON.stringify(['laser_cutting', 'press_brake']),
    services: JSON.stringify(['laser_source_repair', 'parameter_tuning']),
    service_region: 'North America',
    status: 'available',
    rating_count: 2,
    rating_technical: 4.8,
    rating_timeliness: 4.7,
    rating_communication: 4.6,
    rating_professional: 4.9,
    created_at: '2026-07-08T00:00:00Z',
    engineer_role: 'engineer',
    regional_lead_id: 'lead-1',
    responsible_region: '',
    team_name: 'Laser Service Team',
    certification_status: 'verified',
    cooperation_status: 'active',
    workload_status: 'normal',
    bio: 'Laser cutting field service.',
    regional_lead_name: 'Regional Lead',
    regional_lead_no: 'E-LEAD-001',
  };
  const workOrders = [
    {
      id: 'wo-1',
      order_no: 'WO-20260708-001',
      type: 'fault',
      urgency: 'critical',
      status: 'completed',
      created_at: '2026-07-08T01:00:00Z',
      customer_name: 'Customer One',
      customer_company: 'Metal Works Ltd.',
      pricing_status: 'confirmed',
      pricing_total_amount: 5000,
    },
  ];
  const calendarEvents = [
    {
      id: 'cal-1',
      title: 'Available for field service',
      event_type: 'engineer_available',
      start_at: '2026-07-10T09:00:00Z',
      end_at: '2026-07-10T17:00:00Z',
      location: 'Chicago',
      note: 'Remote or onsite window',
    },
  ];
  const updates = [];

  return {
    JWT_SECRET,
    __updates: updates,
    DB: {
      prepare(sql) {
        return {
          args: [],
          bind(...args) {
            this.args = args;
            return this;
          },
          async first() {
            if (/SELECT id, engineer_role FROM engineers WHERE id = \?/i.test(sql)) {
              return this.args[0] === engineer.id ? { id: engineer.id, engineer_role: engineer.engineer_role } : null;
            }
            if (/SELECT e\.id, e\.user_no/i.test(sql) && /WHERE e\.id = \?/i.test(sql)) {
              return {
                ...engineer,
                engineer_role: 'regional_lead',
                responsible_region: 'North America',
                team_name: 'Lead Team',
                regional_lead_id: null,
              };
            }
            if (/FROM engineers e/i.test(sql) && /WHERE e\.id = \?/i.test(sql)) {
              return this.args[0] === engineer.id ? engineer : null;
            }
            return null;
          },
          async all() {
            if (/FROM work_orders w/i.test(sql) && /w\.engineer_id = \?/i.test(sql)) {
              return { results: workOrders };
            }
            if (/FROM engineer_calendar_events/i.test(sql)) {
              return { results: calendarEvents };
            }
            return { results: [] };
          },
          async run() {
            updates.push({ sql, args: this.args });
            return { success: true };
          },
        };
      },
    },
  };
}

async function adminRequest(path, options = {}) {
  const token = await signJwt({
    userId: 'admin',
    userType: 'admin',
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);

  return new Request(`https://api.sagemro.com${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: 'https://admin.sagemro.com',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

test('admin can open an engineer profile with service history by engineer id', async () => {
  const env = makeEnv();

  const response = await worker.fetch(
    await adminRequest('/api/admin/engineers/eng-1'),
    env,
    { waitUntil() {} },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.engineer.user_no, 'E-20260708-001');
  assert.equal(body.engineer.name, 'SAGEMRO Test Engineer');
  assert.deepEqual(body.engineer.specialties, ['laser_cutting', 'press_brake']);
  assert.deepEqual(body.engineer.services, ['laser_source_repair', 'parameter_tuning']);
  assert.equal(body.work_orders.length, 1);
  assert.equal(body.work_orders[0].order_no, 'WO-20260708-001');
  assert.equal(body.stats.total_work_orders, 1);
  assert.equal(body.calendar_events.length, 1);
  assert.equal(body.calendar_events[0].event_type, 'engineer_available');
});

test('admin can promote an existing engineer to regional lead', async () => {
  const env = makeEnv();

  const response = await worker.fetch(
    await adminRequest('/api/admin/engineers/eng-1', {
      method: 'PATCH',
      body: {
        engineer_role: 'regional_lead',
        responsible_region: 'North America',
        team_name: 'Lead Team',
      },
    }),
    env,
    { waitUntil() {} },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.engineer.engineer_role, 'regional_lead');
  assert.equal(body.engineer.responsible_region, 'North America');
  assert.equal(env.__updates.length, 1);
  assert.match(env.__updates[0].sql, /engineer_role = \?/);
  assert.match(env.__updates[0].sql, /regional_lead_id = NULL/);
});
