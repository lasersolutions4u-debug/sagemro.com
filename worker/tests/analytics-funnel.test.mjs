import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';

function createEnv() {
  const rows = [];
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
            if (/INSERT INTO funnel_events/i.test(sql)) {
              rows.push({
                id: this.args[0],
                event_name: this.args[1],
                market: this.args[2],
                anonymous_id: this.args[3],
                session_id: this.args[4],
                user_type: this.args[5],
                user_id: this.args[6],
                source: this.args[7],
                medium: this.args[8],
                campaign: this.args[9],
                page_path: this.args[10],
                referrer: this.args[11],
                properties_json: this.args[12],
                ip_hash: this.args[13],
                user_agent: this.args[14],
              });
            }
            return { success: true };
          },
        };
      },
    },
    __rows: rows,
  };
}

async function postFunnel(body, env = createEnv()) {
  const response = await worker.fetch(new Request('https://api.sagemro.cn/api/analytics/funnel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.cn',
      'CF-Connecting-IP': '203.0.113.40',
      'User-Agent': 'node-test-user-agent',
    },
    body: JSON.stringify(body),
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json, env };
}

test('public funnel endpoint records allowed beta conversion events with attribution only', async () => {
  const { response, json, env } = await postFunnel({
    event_name: 'ai_conversation_started',
    anonymous_id: 'anon-123',
    session_id: 'session-123',
    user_type: 'guest',
    source: 'baidu',
    medium: 'cpc',
    campaign: 'cn_controlled_beta',
    page_path: '/',
    referrer: 'https://www.baidu.com/',
    properties: {
      market: 'cn',
      entry: 'main_chat',
      message: '激光切割机报警',
      email: 'buyer@example.com',
      phone: '13800000000',
    },
  });

  assert.equal(response.status, 202);
  assert.equal(json.success, true);
  assert.equal(env.__rows.length, 1);
  assert.equal(env.__rows[0].event_name, 'ai_conversation_started');
  assert.equal(env.__rows[0].market, 'cn');
  assert.equal(env.__rows[0].source, 'baidu');
  assert.equal(env.__rows[0].medium, 'cpc');
  assert.equal(env.__rows[0].campaign, 'cn_controlled_beta');
  assert.equal(env.__rows[0].ip_hash.length, 64);

  const properties = JSON.parse(env.__rows[0].properties_json);
  assert.equal(properties.entry, 'main_chat');
  assert.equal(properties.message, undefined);
  assert.equal(properties.email, undefined);
  assert.equal(properties.phone, undefined);
});

test('public funnel endpoint rejects unknown event names', async () => {
  const { response, json, env } = await postFunnel({
    event_name: 'freeform_clicked',
    anonymous_id: 'anon-123',
    session_id: 'session-123',
  });

  assert.equal(response.status, 400);
  assert.match(json.error, /Invalid funnel event/);
  assert.equal(env.__rows.length, 0);
});
