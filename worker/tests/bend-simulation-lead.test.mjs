import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

function createEnv() {
  const leads = [];
  return {
    DB: {
      prepare(sql) {
        return {
          args: [],
          bind(...args) {
            this.args = args;
            return this;
          },
          async run() {
            if (/INSERT INTO leads/i.test(sql)) {
              leads.push({
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
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    },
    __leads: leads,
  };
}

function validRequest(overrides = {}) {
  const body = {
    contact: {
      name: 'Ada Buyer',
      email: 'ada@example.com',
      phone: '',
      company: 'Example Fabrication',
    },
    simulation: {
      unit_system: 'metric',
      material: 'carbon_steel',
      thickness_mm: 3,
      bend_length_mm: 1000,
      machine: 'shop-100',
      upper_tool: 'standard-punch',
      lower_tool: 'v-die-24',
      segments: [
        { length_mm: 100, angle_deg: 90, inside_radius_mm: 3, order: 1 },
        { length_mm: 80, angle_deg: 120, inside_radius_mm: 3, order: 2 },
      ],
      flat_length_mm: 190.2,
      bend_allowance_mm: 10.2,
      required_tonnage: 8.4,
      customer_email: 'do-not-store@example.com',
      notes: 'do not keep this free text',
    },
    ...overrides,
  };
  return new Request('https://api.sagemro.com/api/leads/bend-simulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://sagemro.com' },
    body: JSON.stringify(body),
  });
}

test('public bend simulation review accepts a valid contact and inserts a sanitized lead', async () => {
  const env = createEnv();

  const response = await worker.fetch(validRequest(), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.lead_id, env.__leads[0].id);
  assert.equal(env.__leads.length, 1);
  assert.equal(env.__leads[0].source, 'bend_simulator');
  assert.equal(env.__leads[0].source_type, 'bend_simulation_review');
  assert.equal(env.__leads[0].name, 'Ada Buyer');
  assert.equal(env.__leads[0].email, 'ada@example.com');
  assert.match(env.__leads[0].message, /carbon_steel/);
  assert.match(env.__leads[0].message, /2 bends/);
  assert.match(env.__leads[0].ai_summary, /Engineer review requested/);
  assert.match(env.__leads[0].recommended_next_step, /engineer/i);
  assert.doesNotMatch(env.__leads[0].message, /do-not-store|customer_email|ada@example.com/i);
  assert.doesNotMatch(env.__leads[0].ai_summary, /do-not-store|customer_email|ada@example.com/i);
});

test('public bend simulation review rejects missing email and phone', async () => {
  const env = createEnv();
  const response = await worker.fetch(validRequest({
    contact: { name: 'Ada Buyer', email: '', phone: '' },
  }), env, { waitUntil() {} });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /邮箱或手机号/);
  assert.equal(env.__leads.length, 0);
});

test('public bend simulation review omits unavailable optional result values from its summary', async () => {
  const env = createEnv();
  const requestBody = JSON.parse(await validRequest().text());
  requestBody.simulation.flat_length_mm = null;
  requestBody.simulation.bend_allowance_mm = null;
  requestBody.simulation.required_tonnage = null;

  const response = await worker.fetch(validRequest(requestBody), env, { waitUntil() {} });

  assert.equal(response.status, 201);
  assert.doesNotMatch(env.__leads[0].message, /flat length 0 mm|bend allowance 0 mm|estimated 0 t/);
});

test('public bend simulation review rejects oversized or invalid segment context', async () => {
  const oversizedEnv = createEnv();
  const oversized = Array.from({ length: 13 }, (_, index) => ({
    length_mm: 100,
    angle_deg: 90,
    inside_radius_mm: 3,
    order: index + 1,
  }));
  const oversizedResponse = await worker.fetch(validRequest({
    simulation: { ...JSON.parse(await validRequest().text()).simulation, segments: oversized },
  }), oversizedEnv, { waitUntil() {} });

  assert.equal(oversizedResponse.status, 400);
  assert.equal(oversizedEnv.__leads.length, 0);

  const invalidEnv = createEnv();
  const invalidResponse = await worker.fetch(validRequest({
    simulation: { ...JSON.parse(await validRequest().text()).simulation, segments: [{ length_mm: 100, angle_deg: 280, inside_radius_mm: 3, order: 1 }] },
  }), invalidEnv, { waitUntil() {} });

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidEnv.__leads.length, 0);
});
