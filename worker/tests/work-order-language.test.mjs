import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import { formatSiteTimezone } from '../src/lib/quoteExecution.js';
import worker from '../src/index.js';
import { readFile } from 'node:fs/promises';

const JWT_SECRET = 'work-order-language-test-secret-32-chars';
const HAN_RE = /[\u4e00-\u9fff]/;

function makeEnv() {
  const state = {
    workOrders: [],
    logs: [],
    notifications: [],
  };
  const kv = new Map();

  return {
    JWT_SECRET,
    KV: {
      async get(key) {
        return kv.get(key) || null;
      },
      async put(key, value) {
        kv.set(key, value);
      },
      async delete(key) {
        kv.delete(key);
      },
    },
    DB: {
      prepare(sql) {
        return {
          args: [],
          bind(...args) {
            this.args = args;
            return this;
          },
          async first() {
            if (/SELECT region FROM customers WHERE id = \?/i.test(sql)) {
              return { region: 'United States / Chicago' };
            }
            return null;
          },
          async all() {
            if (/SELECT \* FROM engineers WHERE status = \?/i.test(sql)) {
              return {
                results: [{
                  id: 'eng-1',
                  name: 'Taylor Engineer',
                  onesignal_player_id: null,
                  specialties: JSON.stringify(['laser cutting']),
                  services: JSON.stringify(['repair']),
                  brands: JSON.stringify({ laser_cutting: ['TRUMPF'] }),
                  service_region: 'North America, United States',
                  status: 'available',
                  level: 'senior',
                  rating_count: 0,
                  total_orders: 0,
                }],
              };
            }
            return { results: [] };
          },
          async run() {
            if (/INSERT INTO work_orders/i.test(sql)) {
              state.workOrders.push({
                id: this.args[0],
                order_no: this.args[1],
                customer_id: this.args[2],
                type: this.args[3],
                description: this.args[4],
                urgency: this.args[5],
                device_id: this.args[6],
                sla_deadline: this.args[7],
                category_l1: this.args[8],
                category_l2: this.args[9],
              });
            }
            if (/INSERT INTO work_order_logs/i.test(sql)) {
              state.logs.push({
                id: this.args[0],
                work_order_id: this.args[1],
                action: this.args[2],
                actor_type: this.args[3],
                actor_id: this.args[4],
                content: this.args[5],
              });
            }
            if (/INSERT INTO notifications/i.test(sql)) {
              state.notifications.push({
                id: this.args[0],
                user_id: this.args[1],
                user_type: this.args[2],
                type: this.args[3],
                title: this.args[4],
                body: this.args[5],
                data: this.args[6],
              });
            }
            return { success: true };
          },
        };
      },
    },
    __state: state,
  };
}

async function makeCustomerToken() {
  return signJwt({
    userType: 'customer',
    userId: 'cust-1',
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);
}

test('COM work order creation writes customer and engineer service text in English', async () => {
  const env = makeEnv();
  const token = await makeCustomerToken();
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));

  let response;
  let body;
  try {
    response = await worker.fetch(new Request('https://api.sagemro.com/api/workorders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Origin: 'https://sagemro.com',
      },
      body: JSON.stringify({
        customer_id: 'cust-1',
        type: 'fault',
        description: 'Equipment type: Laser Cutter; Brand: TRUMPF; Model: TruLaser 3030; Region: United States / Chicago. Cut edge has heavy burrs.',
        urgency: 'urgent',
        category_l1: 'laser_cutting',
        category_l2: 'mechanical_fault',
      }),
    }), env, { waitUntil() {} });
    body = await response.json();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    console.error = originalError;
  }

  assert.equal(response.status, 200);
  assert.equal(body.work_order.status, 'pending');
  assert.doesNotMatch(JSON.stringify(body), HAN_RE);
  assert.equal(env.__state.logs[0].content, 'Service request created');
  assert.doesNotMatch(JSON.stringify(env.__state.logs), HAN_RE);
  assert.equal(env.__state.notifications[0].title, 'New service task pending confirmation');
  assert.match(env.__state.notifications[0].body, /Service No\.:/);
  assert.doesNotMatch(JSON.stringify(env.__state.notifications), HAN_RE);
  assert.deepEqual(errors, []);
});

test('field-work role detail exposes localized display timezone while retaining the raw identifier', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

  assert.equal(formatSiteTimezone('Asia/Shanghai', 'cn'), '中国标准时间（上海）');
  assert.equal(formatSiteTimezone('Asia/Shanghai', 'com'), 'Asia/Shanghai');
  assert.match(source, /site_timezone_display:\s*formatSiteTimezone\([^,]+,\s*market\)/);
  assert.match(source, /site_timezone:\s*workOrder\?\.site_timezone \|\| null/);
  assert.match(source, /Number\(workOrder\?\.active_quote_version \|\| 0\) >= 1[\s\S]*quote_expected_service_days/);
});

test('field-day check-in notification follows the request market', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function handleFieldDayCheckIn');
  const end = source.indexOf('async function handleSubmitFieldDayReport', start);
  const checkInHandler = source.slice(start, end);

  assert.match(checkInHandler, /const market = getRequestMarket\(request\)/);
  assert.match(checkInHandler, /工程师已到场签到/);
  assert.match(checkInHandler, /工程师已为工单/);
  assert.match(checkInHandler, /Engineer checked in/);
  assert.match(checkInHandler, /Engineer checked in for/);
});
