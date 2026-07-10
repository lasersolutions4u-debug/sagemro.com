import { test } from 'node:test';
import assert from 'node:assert/strict';

import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

const JWT_SECRET = 'machine-leads-test-secret-32-chars';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function makeSseResponse(text = 'Noted.') {
  return new Response([
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
    '',
    'data: [DONE]',
    '',
  ].join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
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

      if (/FROM conversations WHERE id = \?/i.test(normalized)) {
        const conversation = env.__conversations.find((item) => item.id === this.args[0]);
        return conversation ? { customer_id: conversation.customer_id, engineer_id: conversation.engineer_id } : null;
      }

      if (/FROM leads WHERE conversation_id = \?/i.test(normalized)) {
        return env.__leads.find((item) => item.conversation_id === this.args[0]) || null;
      }

      if (/SELECT name, phone, region FROM customers WHERE id = \?/i.test(normalized)) {
        return env.__customers.find((item) => item.id === this.args[0]) || null;
      }

      if (/SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = \?/i.test(normalized)) {
        const order = env.__workOrders.find((item) => item.id === this.args[0]);
        return order ? { ...order } : null;
      }

      if (/SELECT COUNT\(\*\) AS total/i.test(normalized)) {
        return { total: 2, summary_message_count: 0 };
      }

      return null;
    },
    async all() {
      const normalized = normalizeSql(sql);

      if (/SELECT role, content, image_urls FROM messages WHERE conversation_id = \?/i.test(normalized)) {
        return { results: [] };
      }

      if (/SELECT type, brand, model, power FROM devices WHERE customer_id = \?/i.test(normalized)) {
        return { results: [] };
      }

      if (/SELECT order_no, type, description, status, created_at FROM work_orders WHERE customer_id = \?/i.test(normalized)) {
        return { results: [] };
      }

      return { results: [] };
    },
    async run() {
      const normalized = normalizeSql(sql);

      if (/INSERT INTO conversations/i.test(normalized)) {
        env.__conversations.push({
          id: this.args[0],
          title: this.args[1],
          last_message: this.args[2],
          customer_id: this.args[3],
          engineer_id: this.args[4],
        });
      }

      if (/INSERT INTO messages/i.test(normalized)) {
        env.__messages.push({
          id: this.args[0],
          conversation_id: this.args[1],
          role: this.args[2],
          content: this.args[3],
        });
      }

      if (/INSERT INTO leads/i.test(normalized)) {
        env.__leads.push({
          id: this.args[0],
          name: this.args[1],
          email: this.args[2],
          phone: this.args[3],
          source: this.args[4],
          interest: this.args[5],
          message: this.args[6],
          conversation_id: this.args[7],
          source_type: this.args[8],
          ai_summary: this.args[9],
          recommended_next_step: this.args[10],
          assignment_status: this.args[11],
          customer_id: this.args[12],
          work_order_id: this.args[13],
          region: this.args[14],
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
    JWT_SECRET,
    OPENAI_API_ENDPOINT: 'https://llm.invalid',
    OPENAI_API_KEY: 'test-key',
    OPENAI_DAILY_PER_USER: '999',
    OPENAI_DAILY_TOTAL: '999',
    __auditLogs: [],
    __conversations: [],
    __customers: [
      { id: 'customer-1', name: 'Buyer One', phone: '+15550001111', region: 'USA' },
    ],
    __leads: [],
    __messages: [],
    __workOrders: [
      {
        id: 'wo-1',
        customer_id: 'customer-1',
        engineer_id: 'engineer-1',
        assigned_regional_lead_id: 'lead-1',
        status: 'in_service',
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
      async delete() {},
    },
  };
  return env;
}

async function token(env, userType, userId) {
  return signJwt({
    userId,
    userType,
    phone: '+15550001111',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function chat(env, message) {
  const jwt = await token(env, 'customer', 'customer-1');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => makeSseResponse('SAGEMRO can help coordinate the next step.');
  try {
    const response = await worker.fetch(new Request('https://api.sagemro.com/api/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Origin: 'https://sagemro.com',
      },
      body: JSON.stringify({ conversation_id: 'conv-1', message }),
    }), env, { waitUntil() {} });
    await response.text();
    return response;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('customer chat creates a lead only for whole machine purchase intent', async () => {
  const env = createEnv();

  const response = await chat(env, 'We want to buy a new fiber laser cutting machine from EUCHIO. Please arrange a quote.');

  assert.equal(response.status, 200);
  assert.equal(env.__leads.length, 1);
  assert.equal(env.__leads[0].source, 'machine_selection_ai');
  assert.equal(env.__leads[0].source_type, 'machine_purchase_ai');
  assert.equal(env.__leads[0].customer_id, 'customer-1');
  assert.equal(env.__leads[0].conversation_id, 'conv-1');
  assert.doesNotMatch(env.__leads[0].recommended_next_step, /Euchio/i);
  assert.match(env.__leads[0].recommended_next_step, /Admin/i);
});

test('customer chat does not create a lead for parts or consumables demand', async () => {
  const env = createEnv();

  const response = await chat(env, 'I need to buy nozzles, protective lenses, and other consumables for my laser cutting machine.');

  assert.equal(response.status, 200);
  assert.equal(env.__leads.length, 0);
});

test('engineer can submit a work-order-linked whole machine lead with multiple equipment needs for admin follow-up', async () => {
  const env = createEnv();
  const jwt = await token(env, 'engineer', 'engineer-1');

  const response = await worker.fetch(new Request('https://api.sagemro.com/api/leads/machine', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://engineer.sagemro.com',
    },
    body: JSON.stringify({
      work_order_id: 'wo-1',
      equipment_needs: [
        { type: 'Laser cutting machine', quantity: '1', specification: '3015 single table 3000W', note: 'Compare service coverage and ROI.' },
        { type: 'Press brake', quantity: '1', specification: '100T/3200', note: 'May purchase in the same project.' },
      ],
      customer_intent: 'Customer is planning to purchase a new laser cutting machine and press brake line this quarter.',
      contact_name: 'Buyer One',
      contact_phone: '+15550001111',
      region: 'USA',
    }),
  }), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.lead.source, 'engineer_machine_opportunity');
  assert.equal(body.lead.source_type, 'machine_purchase_engineer');
  assert.equal(body.lead.work_order_id, 'wo-1');
  assert.equal(body.lead.customer_id, 'customer-1');
  assert.match(body.lead.interest, /Laser cutting machine/);
  assert.match(body.lead.interest, /Press brake/);
  assert.match(body.lead.message, /Equipment needs:/);
  assert.match(body.lead.message, /3015 single table 3000W/);
  assert.match(body.lead.ai_summary, /2 equipment needs/);
  assert.match(body.lead.recommended_next_step, /Admin/i);
  assert.doesNotMatch(body.lead.recommended_next_step, /Euchio/i);
  assert.equal(env.__leads.length, 1);
  assert.equal(env.__auditLogs.length, 1);
});
