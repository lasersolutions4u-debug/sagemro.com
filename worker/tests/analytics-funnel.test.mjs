import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const JWT_SECRET = 'analytics-funnel-test-secret-32-chars';

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
    JWT_SECRET,
    __rows: rows,
  };
}

async function postFunnel(body, env = createEnv(), headers = {}) {
  const response = await worker.fetch(new Request('https://api.sagemro.com/api/analytics/funnel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
      'CF-Connecting-IP': '203.0.113.40',
      'User-Agent': 'node-test-user-agent',
      ...headers,
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
    source: 'google',
    medium: 'cpc',
    campaign: 'controlled_beta',
    page_path: '/',
    referrer: 'https://www.google.com/',
    properties: {
      market: 'com',
      entry: 'main_chat',
      message: 'My laser alarm is E012',
      email: 'buyer@example.com',
      phone: '+15551234567',
    },
  });

  assert.equal(response.status, 202);
  assert.equal(json.success, true);
  assert.equal(env.__rows.length, 1);
  assert.equal(env.__rows[0].event_name, 'ai_conversation_started');
  assert.equal(env.__rows[0].market, 'com');
  assert.equal(env.__rows[0].source, 'google');
  assert.equal(env.__rows[0].medium, 'cpc');
  assert.equal(env.__rows[0].campaign, 'controlled_beta');
  assert.equal(env.__rows[0].ip_hash.length, 64);

  const properties = JSON.parse(env.__rows[0].properties_json);
  assert.equal(properties.entry, 'main_chat');
  assert.equal(properties.message, undefined);
  assert.equal(properties.email, undefined);
  assert.equal(properties.phone, undefined);
});

test('funnel sanitizer retains the v2 request fields but rejects invalid analytics versions and arbitrary properties', async () => {
  const { response, env } = await postFunnel({
    event_name: 'ai_conversation_started',
    properties: {
      request_id: 'request_safe-id_123',
      analytics_version: '2',
      arbitrary_property: 'discard',
    },
  });

  assert.equal(response.status, 202);
  assert.deepEqual(JSON.parse(env.__rows[0].properties_json), {
    request_id: 'request_safe-id_123',
    analytics_version: '2',
  });

  const invalid = await postFunnel({
    event_name: 'ai_conversation_started',
    properties: {
      request_id: 'request_safe-id_123',
      analytics_version: '1',
      arbitrary_property: 'discard',
    },
  });

  assert.deepEqual(JSON.parse(invalid.env.__rows[0].properties_json), {
    request_id: 'request_safe-id_123',
  });
});

test('funnel endpoint strips PII and free text from top-level acquisition fields', async () => {
  const { response, env } = await postFunnel({
    event_name: 'traffic_source_captured',
    anonymous_id: 'buyer@example.com',
    session_id: 'diagnosis says laser overheats',
    user_type: 'buyer@example.com',
    source: 'buyer@example.com',
    medium: '+1 555 123 4567',
    campaign: 'laser alarm E012 needs help',
    page_path: '/services/laser-cutting-machine-repair?email=buyer@example.com#contact',
    referrer: 'https://www.google.com/search?q=buyer%40example.com#results',
  });

  assert.equal(response.status, 202);
  assert.equal(env.__rows[0].anonymous_id, '');
  assert.equal(env.__rows[0].session_id, '');
  assert.equal(env.__rows[0].user_type, 'guest');
  assert.equal(env.__rows[0].source, '');
  assert.equal(env.__rows[0].medium, '');
  assert.equal(env.__rows[0].campaign, '');
  assert.equal(env.__rows[0].page_path, '/services/laser-cutting-machine-repair');
  assert.equal(env.__rows[0].referrer, 'https://www.google.com');
});

test('funnel endpoint accepts bounded identifier-like acquisition dimensions', async () => {
  const { response, env } = await postFunnel({
    event_name: 'traffic_source_captured',
    anonymous_id: 'anon_safe-id_123',
    session_id: 'session_safe-id_123',
    user_type: 'guest',
    source: 'chatgpt_referral',
    medium: 'ai_referral',
    campaign: 'technical-service-2026',
    page_path: '/services/laser-cutting-machine-repair',
    referrer: 'https://chatgpt.com/c/secret-conversation?prompt=private',
  });

  assert.equal(response.status, 202);
  assert.equal(env.__rows[0].anonymous_id, 'anon_safe-id_123');
  assert.equal(env.__rows[0].session_id, 'session_safe-id_123');
  assert.equal(env.__rows[0].user_type, 'guest');
  assert.equal(env.__rows[0].source, 'chatgpt_referral');
  assert.equal(env.__rows[0].medium, 'ai_referral');
  assert.equal(env.__rows[0].campaign, 'technical-service-2026');
  assert.equal(env.__rows[0].page_path, '/services/laser-cutting-machine-repair');
  assert.equal(env.__rows[0].referrer, 'https://chatgpt.com');
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

test('cookie-authenticated funnel events reject missing CSRF', async () => {
  const csrf = 'analytics-csrf-token';
  const token = await signJwt({
    userId: 'customer-analytics-1',
    userType: 'customer',
    csrf,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);

  const { response, json, env } = await postFunnel({
    event_name: 'ai_conversation_started',
    anonymous_id: 'anon-cookie',
    session_id: 'session-cookie',
  }, createEnv(), {
    Cookie: `__Host-sagemro_customer_session=${token}`,
  });

  assert.equal(response.status, 403);
  assert.equal(json.error, 'Invalid CSRF token');
  assert.equal(env.__rows.length, 0);
});

test('cookie-authenticated funnel events accept matching CSRF and trust the session identity', async () => {
  const csrf = 'analytics-csrf-token';
  const token = await signJwt({
    userId: 'customer-analytics-1',
    userType: 'customer',
    csrf,
    exp: Math.floor(Date.now() / 1000) + 60,
  }, JWT_SECRET);

  const { response, env } = await postFunnel({
    event_name: 'ai_conversation_started',
    anonymous_id: 'anon-cookie',
    session_id: 'session-cookie',
    user_type: 'engineer',
  }, createEnv(), {
    Cookie: `__Host-sagemro_customer_session=${token}`,
    'X-CSRF-Token': csrf,
  });

  assert.equal(response.status, 202);
  assert.equal(env.__rows[0].user_type, 'customer');
  assert.equal(env.__rows[0].user_id, 'customer-analytics-1');
});

test('bend simulator funnel events retain only approved non-PII properties', async () => {
  const eventNames = [
    'bend_simulator_started',
    'bend_simulator_segment_adjusted',
    'bend_simulator_completed',
  ];

  for (const event_name of eventNames) {
    const { response, env } = await postFunnel({
      event_name,
      properties: {
        material: 'carbon_steel',
        bend_count: 2,
        previous_bend_count: 1,
        unit_system: 'metric',
        view_mode: '2d',
        email: 'buyer@example.com',
        phone: '+15551234567',
        arbitrary_notes: 'do not store',
      },
    });

    assert.equal(response.status, 202);
    const properties = JSON.parse(env.__rows[0].properties_json);
    assert.deepEqual(properties, {
      material: 'carbon_steel',
      bend_count: 2,
      previous_bend_count: 1,
      unit_system: 'metric',
      view_mode: '2d',
    });
  }
});

test('funnel property sanitization enforces enum, number, boolean, and PII-safe string types', async () => {
  const { response, env } = await postFunnel({
    event_name: 'bend_simulator_completed',
    properties: {
      material: 'buyer@example.com',
      unit_system: '13800138000',
      view_mode: '+1 555 123 4567',
      bend_count: 'buyer@example.com',
      previous_bend_count: 99,
      authenticated: 'true',
      conversation_id: 'buyer@example.com',
      entry: 'buyer@example.com',
    },
  });

  assert.equal(response.status, 202);
  assert.deepEqual(JSON.parse(env.__rows[0].properties_json), {});
});

test('acquisition events retain only approved, valid, and bounded properties', async () => {
  const longSlug = `laser-${'repair-'.repeat(30)}`;
  const { response, env } = await postFunnel({
    event_name: 'conversion_cta_clicked',
    properties: {
      content_type: 'service',
      content_slug: longSlug,
      cta_type: 'ai_diagnosis',
      engagement_bucket: '30s',
      result_state: 'valid',
      prompt: 'My laser alarm is E012',
      email: 'buyer@example.com',
      phone: '+15551234567',
      serial_number: 'SN-12345678',
      file_name: 'laser-photo.jpg',
      device_info: 'Fiber laser 6kW',
    },
  });

  assert.equal(response.status, 202);
  assert.deepEqual(JSON.parse(env.__rows[0].properties_json), {
    content_type: 'service',
    content_slug: longSlug.slice(0, 120),
    cta_type: 'ai_diagnosis',
    engagement_bucket: '30s',
    result_state: 'valid',
  });
});

test('acquisition events drop each invalid enum while retaining valid properties', async () => {
  const invalidProperties = {
    content_type: 'article',
    cta_type: 'contact_sales',
    engagement_bucket: '60s',
    result_state: 'complete',
  };
  const validProperties = {
    content_type: 'service',
    content_slug: 'laser-cutting-machine-repair',
    cta_type: 'ai_diagnosis',
    engagement_bucket: '30s',
    result_state: 'valid',
  };

  for (const [invalidKey, invalidValue] of Object.entries(invalidProperties)) {
    const { response, env } = await postFunnel({
      event_name: 'conversion_cta_clicked',
      properties: {
        ...validProperties,
        [invalidKey]: invalidValue,
        prompt: 'My laser alarm is E012',
        email: 'buyer@example.com',
        phone: '+15551234567',
        serial_number: 'SN-12345678',
        file_name: 'laser-photo.jpg',
        device_info: 'Fiber laser 6kW',
        arbitrary_property: 'discard',
      },
    });

    assert.equal(response.status, 202);
    const properties = JSON.parse(env.__rows[0].properties_json);
    assert.equal(properties[invalidKey], undefined);
    assert.deepEqual(properties, Object.fromEntries(
      Object.entries(validProperties).filter(([key]) => key !== invalidKey),
    ));
  }
});

test('acquisition events truncate overlength content slugs to 120 characters', async () => {
  const content_slug = `laser-${'repair-'.repeat(30)}`;
  const { response, env } = await postFunnel({
    event_name: 'seo_landing_viewed',
    properties: { content_type: 'service', content_slug },
  });

  assert.equal(response.status, 202);
  assert.equal(JSON.parse(env.__rows[0].properties_json).content_slug, content_slug.slice(0, 120));
});
