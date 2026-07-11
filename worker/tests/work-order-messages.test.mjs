import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

const JWT_SECRET = 'work-order-messages-test-secret-32-chars';

function makeEnv() {
  const state = {
    workOrder: {
      id: 'wo-1',
      customer_id: 'cust-1',
      engineer_id: 'eng-1',
      assigned_regional_lead_id: null,
    },
    customers: [{ id: 'cust-1', name: 'Alice Customer' }],
    engineers: [{ id: 'eng-1', name: 'Bob Engineer' }],
    messages: [],
  };

  return {
    JWT_SECRET,
    DB: {
      prepare(sql) {
        return {
          args: [],
          bind(...args) {
            this.args = args;
            return this;
          },
          async first() {
            if (/FROM work_orders WHERE id = \?/i.test(sql)) {
              return this.args[0] === state.workOrder.id ? state.workOrder : null;
            }
            if (/SELECT name FROM customers WHERE id = \?/i.test(sql)) {
              return state.customers.find((row) => row.id === this.args[0]) || null;
            }
            if (/SELECT name FROM engineers WHERE id = \?/i.test(sql)) {
              return state.engineers.find((row) => row.id === this.args[0]) || null;
            }
            return null;
          },
          async all() {
            if (/FROM work_order_messages WHERE work_order_id = \?/i.test(sql)) {
              return { results: state.messages.filter((row) => row.work_order_id === this.args[0]) };
            }
            return { results: [] };
          },
          async run() {
            if (/INSERT INTO work_order_messages/i.test(sql)) {
              state.messages.push({
                id: this.args[0],
                work_order_id: this.args[1],
                sender_type: this.args[2],
                sender_id: this.args[3],
                sender_name: this.args[4],
                content: this.args[5],
                message_type: this.args[6],
                attachment_urls: this.args[7],
                is_internal_note: this.args[8],
                is_customer_visible: this.args[9],
                created_at: '2026-07-08T00:00:00Z',
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

async function makeToken(userType = 'customer', userId = 'cust-1') {
  return signJwt({
    userType,
    userId,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);
}

async function api(env, path, { method = 'GET', body, userType = 'customer', userId = 'cust-1' } = {}) {
  const token = await makeToken(userType, userId);
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('work order messages persist and return image and video attachment URLs', async () => {
  const env = makeEnv();
  const attachmentUrls = [
    'https://cdn.sagemro.com/workorders/wo-1/photo.webp',
    'https://cdn.sagemro.com/workorders/wo-1/video.mp4',
  ];

  const created = await api(env, '/api/workorders/wo-1/messages', {
    method: 'POST',
    body: {
      content: 'Please review these media files.',
      message_type: 'text',
      attachment_urls: attachmentUrls,
    },
  });

  assert.equal(created.response.status, 200);
  assert.equal(created.json.success, true);

  const listed = await api(env, '/api/workorders/wo-1/messages');

  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.list.length, 1);
  assert.deepEqual(listed.json.list[0].attachment_urls, attachmentUrls);
});

test('work order messages redact direct contact details as XXX', async () => {
  const env = makeEnv();

  const created = await api(env, '/api/workorders/wo-1/messages', {
    method: 'POST',
    body: {
      content: 'Call me at +66961135966 or email ops@example.com. WhatsApp: +1 555 0100',
      message_type: 'text',
    },
  });

  assert.equal(created.response.status, 200);
  assert.equal(env.__state.messages[0].content, 'Call me at XXX or email XXX. WhatsApp: XXX');

  const listed = await api(env, '/api/workorders/wo-1/messages');
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.list[0].content, 'Call me at XXX or email XXX. WhatsApp: XXX');
});
