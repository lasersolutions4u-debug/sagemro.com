import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';
import {
  GUIDANCE_GENERATION_STATUSES,
  GUIDANCE_VISIBLE_STATUSES,
  adaptReadinessV1,
  buildServiceGuidanceInput,
  buildServiceGuidancePrompt,
  parseServiceGuidance,
} from '../src/lib/serviceGuidance.js';

const GUIDANCE_JWT_SECRET = 'service-guidance-api-test-secret';
const guidanceSchemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const guidanceMigrationSql = readFileSync(
  new URL('../migrations/045_service_guidance_cache.sql', import.meta.url),
  'utf8',
);

function createGuidanceD1(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(guidanceSchemaSql);
  t.after(() => sqlite.close());
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...args);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
    __sqlite: sqlite,
  };
}

function createGuidanceEnv(t) {
  const DB = createGuidanceD1(t);
  DB.__sqlite.exec(`
    INSERT INTO customers (id, user_no, name, phone, password_hash) VALUES
      ('guidance-customer', 'U009001', 'Guidance Customer', '+15550009001', 'hash');
    INSERT INTO engineers (id, user_no, name, phone, password_hash, engineer_role) VALUES
      ('guidance-engineer', 'E009001', 'Assigned Engineer', '+15550009011', 'hash', 'engineer'),
      ('guidance-foreign', 'E009002', 'Foreign Engineer', '+15550009012', 'hash', 'engineer'),
      ('guidance-regional', 'E009003', 'Regional Lead', '+15550009013', 'hash', 'regional_lead');
    INSERT INTO work_orders (
      id, order_no, customer_id, engineer_id, assigned_regional_lead_id,
      type, description, urgency, status, service_mode
    ) VALUES
      ('wo-guidance-inservice-empty', 'WO-G001', 'guidance-customer', 'guidance-engineer',
       'guidance-regional', 'fault', 'Service is under way.', 'normal', 'in_service', 'onsite'),
      ('wo-guidance-completed', 'WO-G002', 'guidance-customer', 'guidance-engineer',
       'guidance-regional', 'fault', 'Service is complete.', 'normal', 'completed', 'onsite'),
      ('wo-guidance-feedback', 'WO-G003', 'guidance-customer', 'guidance-engineer',
       'guidance-regional', 'fault', 'Review alarm E204.', 'urgent', 'assigned', 'remote');
  `);
  const pending = [];
  t.after(async () => {
    await Promise.all(pending.splice(0));
  });
  return {
    JWT_SECRET: GUIDANCE_JWT_SECRET,
    DB,
    KV: { async get() { return null; }, async put() {} },
    __pending: pending,
    __fetchCalls: 0,
    __fetchBodies: [],
  };
}

async function guidanceToken(userId, userType = 'engineer') {
  return signJwt({
    userId,
    userType,
    market: 'com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, GUIDANCE_JWT_SECRET);
}

async function guidanceApi(env, path, {
  method = 'GET',
  body,
  userId = 'guidance-engineer',
  userType = 'engineer',
} = {}) {
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await guidanceToken(userId, userType)}`,
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, {
    waitUntil(promise) {
      env.__pending.push(promise);
    },
  });
  return { response, json: await response.json() };
}

function mockGuidanceModel(t, env, content) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options = {}) => {
    const callIndex = env.__fetchCalls;
    env.__fetchCalls += 1;
    env.__fetchBodies.push(String(options.body || ''));
    const resolved = await (typeof content === 'function' ? content(callIndex) : content);
    return new Response(JSON.stringify({
      choices: [{ message: { content: typeof resolved === 'string' ? resolved : JSON.stringify(resolved) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

function createGuidanceDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushGuidanceTasks(env) {
  await Promise.all(env.__pending.splice(0));
}

const itemKeys = new Set([
  'risk.isolation_permission',
  'task.problem_and_goal',
  'ready.parts_and_consumables',
]);

function validGuidance(overrides = {}) {
  return {
    version: 2,
    step_key: 'one_visit_readiness',
    headline: 'Confirm isolation before departure',
    risk_level: 'high',
    observations: [{ priority: 'high', detail: 'Isolation is unconfirmed.', source: 'service_standard' }],
    next_actions: [{
      priority: 'high',
      action: 'Confirm isolation.',
      rationale: 'Required before work.',
      related_item_key: 'risk.isolation_permission',
    }],
    customer_questions: [{ priority: 'high', draft: 'Can the machine be isolated?' }],
    evidence_needed: ['alarm_screen'],
    ...overrides,
  };
}

test('v2 guidance clamps actions and customer questions', () => {
  const result = parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [
      { priority: 'high', action: 'Confirm isolation.', rationale: 'Required before work.', related_item_key: 'risk.isolation_permission' },
      { priority: 'medium', action: 'Request alarm photo.', rationale: 'Narrows diagnosis.', related_item_key: 'task.problem_and_goal' },
      { priority: 'low', action: 'Pack cleaning kit.', rationale: 'Likely useful.', related_item_key: 'ready.parts_and_consumables' },
      { priority: 'low', action: 'Extra action.', rationale: 'Must be removed.', related_item_key: '' },
    ],
    customer_questions: [
      { priority: 'high', draft: 'Can the machine be isolated?' },
      { priority: 'medium', draft: 'Please send the alarm screen.' },
      { priority: 'low', draft: 'This third question is removed.' },
    ],
  })), itemKeys);

  assert.equal(result.next_actions.length, 3);
  assert.equal(result.customer_questions.length, 2);
});

test('v2 guidance rejects malformed JSON, wrong scalar types, and missing collections', () => {
  assert.equal(parseServiceGuidance('{not-json}', itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ headline: 42 })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ risk_level: {} })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ observations: {} })), itemKeys), null);

  const missingQuestions = validGuidance();
  delete missingQuestions.customer_questions;
  assert.equal(parseServiceGuidance(JSON.stringify(missingQuestions), itemKeys), null);
});

test('v2 guidance rejects invalid nested shapes within retained caps', () => {
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    observations: [{ priority: 'high', detail: 'Missing source.' }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [{ priority: 'high', action: 'Confirm.', rationale: 'Needed.' }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    customer_questions: [{ priority: 'medium', draft: { text: 'Not a string' } }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ evidence_needed: ['alarm', { name: 'photo' }] })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [
      { priority: 'high', action: 'Confirm.', rationale: 'Needed.', related_item_key: 'risk.isolation_permission' },
      { priority: 'medium', action: 'Request.', rationale: 'Needed.', related_item_key: 'task.problem_and_goal' },
      { priority: 'low', action: 'Invalid retained entry.', rationale: 'Needed.', related_item_key: 'invented.item' },
      { priority: 'low', action: 'Ignored valid overflow.', rationale: 'Needed.', related_item_key: 'ready.parts_and_consumables' },
    ],
  })), itemKeys), null);
});

test('v2 guidance ignores malformed overflow entries after retained caps', () => {
  const result = parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [
      { priority: 'high', action: 'Confirm.', rationale: 'Needed.', related_item_key: 'risk.isolation_permission' },
      { priority: 'medium', action: 'Request.', rationale: 'Needed.', related_item_key: 'task.problem_and_goal' },
      { priority: 'low', action: 'Pack.', rationale: 'Needed.', related_item_key: 'ready.parts_and_consumables' },
      { priority: 'low', action: 'Ignored action.', rationale: 'Ignored.', related_item_key: '' },
    ],
    customer_questions: [
      { priority: 'high', draft: 'Can the machine be isolated?' },
      { priority: 'medium', draft: 'Please send the alarm screen.' },
      { priority: 'low', draft: null },
    ],
  })), itemKeys);

  assert.equal(result.next_actions.length, 3);
  assert.equal(result.customer_questions.length, 2);
});

test('v2 guidance rejects values outside the strict schema', () => {
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ risk_level: 'critical' })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({ step_key: 'invented_step' })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    observations: [{ priority: 'high', detail: 'Unverified.', source: 'internal_note' }],
  })), itemKeys), null);
  assert.equal(parseServiceGuidance(JSON.stringify(validGuidance({
    next_actions: [{ priority: 'high', action: 'Confirm.', rationale: 'Needed.', related_item_key: 'invented.item' }],
  })), itemKeys), null);
});

test('v2 guidance projects exact keys and rejects unexpected prototype-shaped JSON', () => {
  const parsed = parseServiceGuidance(JSON.stringify(validGuidance()), itemKeys);
  assert.deepEqual(Object.keys(parsed), [
    'version', 'step_key', 'headline', 'risk_level', 'observations', 'next_actions',
    'customer_questions', 'evidence_needed',
  ]);
  const prototypePayload = `${JSON.stringify(validGuidance()).slice(0, -1)},"__proto__":{"polluted":true}}`;
  assert.equal(parseServiceGuidance(prototypePayload, itemKeys), null);
  assert.equal({}.polluted, undefined);
});

test('guidance lifecycle exposes completed read-only and never generates it', () => {
  assert.deepEqual([...GUIDANCE_VISIBLE_STATUSES], [
    'assigned', 'in_progress', 'pricing', 'pending_payment',
    'payment_review', 'in_service', 'resolved', 'pending_review', 'completed',
  ]);
  assert.deepEqual([...GUIDANCE_GENERATION_STATUSES], [
    'assigned', 'in_progress', 'pricing', 'pending_payment',
    'payment_review', 'in_service', 'resolved', 'pending_review',
  ]);
  assert.equal(GUIDANCE_GENERATION_STATUSES.has('completed'), false);
});

test('migration 045 preserves readiness rows and constrains guidance feedback', () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
      CREATE TABLE work_orders (id TEXT PRIMARY KEY);
      CREATE TABLE work_order_service_readiness (
        work_order_id TEXT PRIMARY KEY,
        source_conversation_id TEXT,
        input_fingerprint TEXT,
        review_json TEXT,
        generation_state TEXT NOT NULL DEFAULT 'missing',
        generation_started_at TEXT,
        generated_at TEXT,
        last_error TEXT,
        updated_at TEXT
      );
      INSERT INTO work_orders (id) VALUES ('wo-migration');
      INSERT INTO work_order_service_readiness (
        work_order_id, review_json, generation_state
      ) VALUES ('wo-migration', '{"version":1}', 'ready');
    `);
    sqlite.exec(guidanceMigrationSql);
    const row = sqlite.prepare(
      `SELECT review_json, generation_state, guidance_version, guidance_json
       FROM work_order_service_readiness WHERE work_order_id = 'wo-migration'`,
    ).get();
    assert.equal(row.review_json, '{"version":1}');
    assert.equal(row.generation_state, 'ready');
    assert.equal(row.guidance_version, 1);
    assert.equal(row.guidance_json, null);
    assert.throws(() => sqlite.prepare(
      `INSERT INTO work_order_service_guidance_feedback (
        id, work_order_id, guidance_generated_at, action_index, feedback_type, created_by
      ) VALUES ('invalid-index', 'wo-migration', '2026-07-29', 3, 'accepted', 'engineer-1')`,
    ).run(), /CHECK constraint failed/);
    assert.throws(() => sqlite.prepare(
      `INSERT INTO work_order_service_guidance_feedback (
        id, work_order_id, guidance_generated_at, action_index, feedback_type, created_by
      ) VALUES ('invalid-type', 'wo-migration', '2026-07-29', 0, 'invented', 'engineer-1')`,
    ).run(), /CHECK constraint failed/);
    assert.equal(sqlite.prepare(
      "SELECT COUNT(*) AS count FROM _migrations WHERE version = '045_service_guidance_cache'",
    ).get().count, 1);
  } finally {
    sqlite.close();
  }
});

test('guidance API is visible through service and completed is read-only', async (t) => {
  const env = createGuidanceEnv(t);
  const guidance = (id) => guidanceApi(env, `/api/workorders/${id}/service-guidance`);
  const refresh = (id) => guidanceApi(env, `/api/workorders/${id}/service-guidance/refresh`, {
    method: 'POST',
    body: { force: false },
  });

  const visible = await guidance('wo-guidance-inservice-empty');
  assert.equal(visible.response.status, 200, JSON.stringify(visible.json));
  assert.equal(env.DB.__sqlite.prepare(
    "SELECT COUNT(*) AS count FROM work_order_service_readiness WHERE work_order_id = 'wo-guidance-inservice-empty'",
  ).get().count, 0);
  assert.equal(env.DB.__sqlite.prepare(
    "SELECT COUNT(*) AS count FROM work_order_service_standard_progress WHERE work_order_id = 'wo-guidance-inservice-empty'",
  ).get().count, 0);
  assert.equal((await refresh('wo-guidance-inservice-empty')).response.status, 202);
  assert.equal((await refresh('wo-guidance-completed')).response.status, 409);
  assert.equal((await guidance('wo-guidance-completed')).response.status, 200);
});

test('guidance GET derives an expired lease without writes and completed refresh is fully read-only', async (t) => {
  const env = createGuidanceEnv(t);
  const expiredStartedAt = '2000-01-01T00:00:00.000Z';
  env.DB.__sqlite.prepare(
    `INSERT INTO work_order_service_readiness (
      work_order_id, generation_state, generation_started_at, trigger_reason
    ) VALUES (?, 'generating', ?, 'existing-trigger')`,
  ).run('wo-guidance-inservice-empty', expiredStartedAt);

  const beforeExpired = env.DB.__sqlite.prepare(
    'SELECT * FROM work_order_service_readiness WHERE work_order_id = ?',
  ).get('wo-guidance-inservice-empty');
  const expired = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-inservice-empty/service-guidance',
  );
  assert.equal(expired.response.status, 200);
  assert.equal(expired.json.state, 'failed');
  const afterExpired = env.DB.__sqlite.prepare(
    'SELECT * FROM work_order_service_readiness WHERE work_order_id = ?',
  ).get('wo-guidance-inservice-empty');
  assert.deepEqual({ ...afterExpired }, { ...beforeExpired });

  const beforeCompleted = {
    cache: env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM work_order_service_readiness WHERE work_order_id = 'wo-guidance-completed'",
    ).get().count,
    standard: env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM work_order_service_standard_progress WHERE work_order_id = 'wo-guidance-completed'",
    ).get().count,
    feedback: env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM work_order_service_guidance_feedback WHERE work_order_id = 'wo-guidance-completed'",
    ).get().count,
  };
  const completed = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-completed/service-guidance/refresh',
    { method: 'POST', body: { force: false } },
  );
  assert.equal(completed.response.status, 409);
  const afterCompleted = {
    cache: env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM work_order_service_readiness WHERE work_order_id = 'wo-guidance-completed'",
    ).get().count,
    standard: env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM work_order_service_standard_progress WHERE work_order_id = 'wo-guidance-completed'",
    ).get().count,
    feedback: env.DB.__sqlite.prepare(
      "SELECT COUNT(*) AS count FROM work_order_service_guidance_feedback WHERE work_order_id = 'wo-guidance-completed'",
    ).get().count,
  };
  assert.deepEqual(afterCompleted, beforeCompleted);
});

test('guidance access is limited to the assigned engineer', async (t) => {
  const env = createGuidanceEnv(t);
  for (const actor of [
    { userType: 'engineer', userId: 'guidance-foreign' },
    { userType: 'engineer', userId: 'guidance-regional' },
    { userType: 'customer', userId: 'guidance-customer' },
    { userType: 'admin', userId: 'admin-1' },
  ]) {
    const result = await guidanceApi(
      env,
      '/api/workorders/wo-guidance-feedback/service-guidance',
      actor,
    );
    assert.equal(result.response.status, 403);
    assert.equal(Object.hasOwn(result.json, 'guidance'), false);
  }
});

test('legacy readiness remains available through v1 adaptation and the old endpoint', async (t) => {
  const env = createGuidanceEnv(t);
  const review = {
    version: 1,
    service_mode: 'remote',
    readiness: 'needs_confirmation',
    confirmed_facts: [{ label: 'Alarm', detail: 'E204 confirmed.', source: 'work_order' }],
    gaps: [{
      priority: 'high',
      category: 'evidence',
      detail: 'Alarm screen is missing.',
      why_it_matters: 'Needed for diagnosis.',
    }],
    customer_questions: [{ priority: 'high', draft: 'Please send the alarm screen.' }],
    service_mode_readiness: [],
    media_review_required: false,
  };
  env.DB.__sqlite.prepare(
    `INSERT INTO work_order_service_readiness (
      work_order_id, review_json, input_fingerprint, generation_state, generated_at
    ) VALUES (?, ?, ?, 'ready', ?)`,
  ).run(
    'wo-guidance-feedback',
    JSON.stringify(review),
    'legacy-readiness-fingerprint',
    '2026-07-29 03:00:00',
  );

  const guidance = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.equal(guidance.response.status, 200);
  assert.equal(guidance.json.guidance_version, 1);
  assert.equal(guidance.json.guidance.version, 2);
  assert.equal(guidance.json.guidance.headline, 'Alarm screen is missing.');

  const readiness = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-readiness',
  );
  assert.equal(readiness.response.status, 200);
  assert.deepEqual(readiness.json.review, review);
});

test('guidance generation caches v2 without overwriting v1 readiness', async (t) => {
  const env = createGuidanceEnv(t);
  const legacyReview = JSON.stringify({
    version: 1,
    service_mode: 'remote',
    readiness: 'ready',
    confirmed_facts: [],
    gaps: [],
    customer_questions: [],
    service_mode_readiness: [],
    media_review_required: false,
  });
  env.DB.__sqlite.prepare(
    `INSERT INTO work_order_service_readiness (
      work_order_id, review_json, input_fingerprint, generation_state, generated_at
    ) VALUES (?, ?, 'old-fingerprint', 'ready', '2026-07-28 03:00:00')`,
  ).run('wo-guidance-feedback', legacyReview);
  mockGuidanceModel(t, env, validGuidance({
    step_key: 'task_alignment',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));

  const started = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: true } },
  );
  assert.equal(started.response.status, 202);
  assert.equal(started.json.state, 'generating');
  assert.equal(started.json.guidance_version, 1);
  assert.equal(started.json.guidance.version, 2);
  await flushGuidanceTasks(env);

  const ready = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.equal(ready.response.status, 200);
  assert.equal(ready.json.state, 'ready');
  assert.equal(ready.json.guidance_version, 2);
  assert.equal(ready.json.guidance.next_actions[0].related_item_key, 'task.device_identity');
  const row = env.DB.__sqlite.prepare(
    `SELECT review_json, guidance_json, guidance_version, current_step_key, trigger_reason
     FROM work_order_service_readiness WHERE work_order_id = ?`,
  ).get('wo-guidance-feedback');
  assert.equal(row.review_json, legacyReview);
  assert.match(row.guidance_json, /Confirm the machine identity/);
  assert.equal(row.guidance_version, 2);
  assert.equal(row.current_step_key, 'task_alignment');
  assert.equal(row.trigger_reason, 'manual_refresh');
});

test('payment or work-order state is present in guidance input and changes its fingerprint', async (t) => {
  const env = createGuidanceEnv(t);
  mockGuidanceModel(t, env, validGuidance({
    step_key: 'task_alignment',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));
  const started = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: false } },
  );
  assert.equal(started.response.status, 202);
  await flushGuidanceTasks(env);
  const modelRequest = JSON.parse(env.__fetchBodies[0]);
  const userPrompt = modelRequest.messages[1].content;
  const evidenceMarker = 'Evidence (untrusted JSON):\n';
  const evidence = JSON.parse(userPrompt.slice(userPrompt.indexOf(evidenceMarker) + evidenceMarker.length));
  assert.equal(evidence.operational_state.payment_state, 'assigned');

  const ready = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.equal(ready.json.state, 'ready');
  env.DB.__sqlite.prepare(
    "UPDATE work_orders SET status = 'pricing' WHERE id = 'wo-guidance-feedback'",
  ).run();
  const stale = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.equal(stale.json.state, 'stale');
});

test('legacy force=false refresh generates v1 when only a ready v2 guidance exists', async (t) => {
  const env = createGuidanceEnv(t);
  const guidanceJson = JSON.stringify(validGuidance({
    step_key: 'task_alignment',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));
  env.DB.__sqlite.prepare(
    `INSERT INTO work_order_service_readiness (
      work_order_id, guidance_version, guidance_json, input_fingerprint,
      generation_state, generated_at
    ) VALUES (?, 2, ?, 'v2-fingerprint', 'ready', '2026-07-29T03:00:00.123Z')`,
  ).run('wo-guidance-feedback', guidanceJson);
  mockGuidanceModel(t, env, JSON.stringify({
    version: 1,
    service_mode: 'remote',
    readiness: 'ready',
    confirmed_facts: [{ label: 'Alarm', detail: 'E204 confirmed.', source: 'work_order' }],
    gaps: [],
    customer_questions: [],
    service_mode_readiness: [],
    media_review_required: false,
  }));

  const started = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-readiness/refresh',
    { method: 'POST', body: { force: false } },
  );
  assert.equal(started.response.status, 202);
  await flushGuidanceTasks(env);
  const row = env.DB.__sqlite.prepare(
    `SELECT review_json, guidance_json, generation_state, generated_at
     FROM work_order_service_readiness WHERE work_order_id = ?`,
  ).get('wo-guidance-feedback');
  assert.match(row.review_json, /E204 confirmed/);
  assert.equal(row.guidance_json, guidanceJson);
  assert.equal(row.generation_state, 'ready');
  assert.equal(row.generated_at, '2026-07-29T03:00:00.123Z');
});

test('guidance refresh validates force, leases once, and rejects a late lease result', async (t) => {
  const env = createGuidanceEnv(t);
  const invalid = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: 'yes' } },
  );
  assert.equal(invalid.response.status, 400);

  const firstModel = createGuidanceDeferred();
  const secondModel = createGuidanceDeferred();
  mockGuidanceModel(t, env, (callIndex) => (
    callIndex === 0 ? firstModel.promise : secondModel.promise
  ));
  const firstRefresh = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: false } },
  );
  assert.equal(firstRefresh.response.status, 202);
  assert.equal(env.__fetchCalls, 1);

  env.DB.__sqlite.prepare(
    `UPDATE work_order_service_readiness
     SET generation_started_at = '2000-01-01T00:00:00.000Z'
     WHERE work_order_id = ?`,
  ).run('wo-guidance-feedback');
  const expired = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.equal(expired.json.state, 'failed');

  const secondRefresh = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: false } },
  );
  assert.equal(secondRefresh.response.status, 202);
  assert.equal(env.__fetchCalls, 2);
  secondModel.resolve(validGuidance({
    step_key: 'task_alignment',
    headline: 'NEWER-LEASE-GUIDANCE',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));
  await new Promise((resolve) => setImmediate(resolve));
  firstModel.resolve(validGuidance({
    step_key: 'task_alignment',
    headline: 'LATE-LEASE-GUIDANCE',
    next_actions: [{
      priority: 'high',
      action: 'Use stale evidence.',
      rationale: 'This must not persist.',
      related_item_key: 'task.device_identity',
    }],
  }));
  await flushGuidanceTasks(env);
  const stored = env.DB.__sqlite.prepare(
    'SELECT guidance_json FROM work_order_service_readiness WHERE work_order_id = ?',
  ).get('wo-guidance-feedback');
  assert.match(stored.guidance_json, /NEWER-LEASE-GUIDANCE/);
  assert.doesNotMatch(stored.guidance_json, /LATE-LEASE-GUIDANCE/);
});

test('same-second forced guidance generations get unique timestamps and reject old feedback versions', async (t) => {
  const env = createGuidanceEnv(t);
  mockGuidanceModel(t, env, validGuidance({
    step_key: 'task_alignment',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the first machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));
  const first = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: false } },
  );
  assert.equal(first.response.status, 202);
  await flushGuidanceTasks(env);
  const firstReady = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.match(firstReady.json.generated_at, /^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/);

  const second = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: true } },
  );
  assert.equal(second.response.status, 202);
  await flushGuidanceTasks(env);
  const secondReady = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.notEqual(secondReady.json.generated_at, firstReady.json.generated_at);

  const staleFeedback = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/feedback',
    {
      method: 'POST',
      body: {
        guidance_generated_at: firstReady.json.generated_at,
        action_index: 0,
        feedback_type: 'accepted',
      },
    },
  );
  assert.equal(staleFeedback.response.status, 409);
});

test('provider timeout retains the previous v2 guidance', async (t) => {
  const env = createGuidanceEnv(t);
  env.OPENAI_API_ENDPOINT = 'https://model.example.test/v1/chat/completions';
  env.OPENAI_API_KEY = 'test-model-key';
  const oldGuidance = JSON.stringify(validGuidance({
    step_key: 'task_alignment',
    headline: 'RETAINED-GUIDANCE',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));
  env.DB.__sqlite.prepare(
    `INSERT INTO work_order_service_readiness (
      work_order_id, guidance_version, guidance_json, input_fingerprint,
      generation_state, generated_at
    ) VALUES (?, 2, ?, 'old-fingerprint', 'ready', '2026-07-29T03:00:00.123Z')`,
  ).run('wo-guidance-feedback', oldGuidance);
  mockGuidanceModel(t, env, () => {
    throw Object.assign(new Error('timed out'), { name: 'AbortError' });
  });
  const started = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: true } },
  );
  assert.equal(started.response.status, 202);
  assert.match(started.json.guidance.headline, /RETAINED-GUIDANCE/);
  await flushGuidanceTasks(env);
  const row = env.DB.__sqlite.prepare(
    `SELECT guidance_json, generation_state, last_error
     FROM work_order_service_readiness WHERE work_order_id = ?`,
  ).get('wo-guidance-feedback');
  assert.equal(row.guidance_json, oldGuidance);
  assert.equal(row.generation_state, 'failed');
  assert.equal(row.last_error, 'provider_timeout');
});

test('feedback is bounded, audited, makes guidance stale, and enters the next prompt', async (t) => {
  const env = createGuidanceEnv(t);
  mockGuidanceModel(t, env, validGuidance({
    step_key: 'task_alignment',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));
  const initial = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: false } },
  );
  assert.equal(initial.response.status, 202);
  await flushGuidanceTasks(env);
  const generated = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.equal(generated.json.state, 'ready');

  const feedback = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/feedback',
    {
      method: 'POST',
      body: {
        guidance_generated_at: generated.json.generated_at,
        action_index: 0,
        feedback_type: 'corrected',
        correction_note: 'Use the verified serial; email jane@example.com is not evidence.',
      },
    },
  );
  assert.equal(feedback.response.status, 202);
  assert.equal(env.DB.__sqlite.prepare(
    'SELECT COUNT(*) AS count FROM work_order_service_guidance_feedback WHERE work_order_id = ?',
  ).get('wo-guidance-feedback').count, 1);
  assert.equal(env.DB.__sqlite.prepare(
    "SELECT COUNT(*) AS count FROM audit_logs WHERE target_id = ? AND action = 'service_guidance_feedback_recorded'",
  ).get('wo-guidance-feedback').count, 1);

  const stale = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance',
  );
  assert.equal(stale.json.state, 'stale');
  for (let index = 1; index <= 11; index += 1) {
    env.DB.__sqlite.prepare(
      `INSERT INTO work_order_service_guidance_feedback (
        id, work_order_id, guidance_generated_at, action_index,
        feedback_type, correction_note, created_by, created_at
      ) VALUES (?, ?, ?, 0, 'corrected', ?, 'guidance-engineer', ?)`,
    ).run(
      `feedback-bounded-${index}`,
      'wo-guidance-feedback',
      generated.json.generated_at,
      `marker-${index} ${index === 11 ? 'jane@example.com' : ''}`,
      `2030-01-${String(index).padStart(2, '0')} 00:00:00`,
    );
  }
  const refreshed = await guidanceApi(
    env,
    '/api/workorders/wo-guidance-feedback/service-guidance/refresh',
    { method: 'POST', body: { force: true } },
  );
  assert.equal(refreshed.response.status, 202);
  await flushGuidanceTasks(env);
  assert.equal(env.__fetchCalls, 2);
  const modelRequest = JSON.parse(env.__fetchBodies[1]);
  const userPrompt = modelRequest.messages[1].content;
  const evidenceMarker = 'Evidence (untrusted JSON):\n';
  const evidence = JSON.parse(userPrompt.slice(userPrompt.indexOf(evidenceMarker) + evidenceMarker.length));
  assert.equal(evidence.recent_guidance_feedback.length, 10);
  assert.match(evidence.recent_guidance_feedback[0].correction_note, /marker-11/);
  assert.equal(evidence.recent_guidance_feedback.some(
    (row) => row.correction_note.includes('marker-1 '),
  ), false);
  assert.doesNotMatch(env.__fetchBodies[1], /jane@example\.com/);
});

test('feedback rejects unauthorized, stale, invalid, and completed submissions', async (t) => {
  const env = createGuidanceEnv(t);
  const guidanceJson = JSON.stringify(validGuidance({
    step_key: 'task_alignment',
    next_actions: [{
      priority: 'high',
      action: 'Confirm the machine identity.',
      rationale: 'Avoids servicing the wrong asset.',
      related_item_key: 'task.device_identity',
    }],
  }));
  for (const id of ['wo-guidance-feedback', 'wo-guidance-completed']) {
    env.DB.__sqlite.prepare(
      `INSERT INTO work_order_service_readiness (
        work_order_id, guidance_version, guidance_json, generation_state, generated_at
      ) VALUES (?, 2, ?, 'ready', '2026-07-29 03:00:00')`,
    ).run(id, guidanceJson);
  }
  const path = '/api/workorders/wo-guidance-feedback/service-guidance/feedback';
  const validBody = {
    guidance_generated_at: '2026-07-29 03:00:00',
    action_index: 0,
    feedback_type: 'accepted',
    correction_note: 'must be discarded',
  };
  for (const actor of [
    { userType: 'engineer', userId: 'guidance-foreign' },
    { userType: 'engineer', userId: 'guidance-regional' },
    { userType: 'customer', userId: 'guidance-customer' },
  ]) {
    const result = await guidanceApi(env, path, {
      method: 'POST',
      body: validBody,
      ...actor,
    });
    assert.equal(result.response.status, 403);
  }
  assert.equal((await guidanceApi(env, path, {
    method: 'POST',
    body: { ...validBody, guidance_generated_at: '2026-07-29 03:00:01' },
  })).response.status, 409);
  assert.equal((await guidanceApi(env, path, {
    method: 'POST',
    body: { ...validBody, action_index: 1 },
  })).response.status, 400);
  assert.equal((await guidanceApi(env, path, {
    method: 'POST',
    body: { ...validBody, feedback_type: 'corrected', correction_note: '' },
  })).response.status, 400);
  assert.equal((await guidanceApi(
    env,
    '/api/workorders/wo-guidance-completed/service-guidance/feedback',
    { method: 'POST', body: validBody },
  )).response.status, 409);

  const accepted = await guidanceApi(env, path, {
    method: 'POST',
    body: validBody,
  });
  assert.equal(accepted.response.status, 202);
  assert.equal(env.DB.__sqlite.prepare(
    `SELECT correction_note FROM work_order_service_guidance_feedback
     WHERE id = ?`,
  ).get(accepted.json.feedback_id).correction_note, null);
});

test('guidance input is bounded, redacted, and contains no private evidence', () => {
  const input = buildServiceGuidanceInput({
    workOrder: {
      type: 'repair', description: 'Call jane@example.com on 415-555-0123', urgency: 'high',
      service_mode: 'onsite', ai_summary: 'Customer phone 020 1234 5678', internal_note: 'never expose',
    },
    device: { brand: 'Acme', model: 'M-1' },
    sourceConversationId: 'conversation-1',
    sourceSummary: 'Email jane@example.com',
    sourceMessages: Array.from({ length: 13 }, () => ({ role: 'user', content: 'Call 415-555-0123' })),
    publicMessages: Array.from({ length: 13 }, () => ({
      sender_type: 'customer', content: 'Email jane@example.com', is_internal_note: 0, is_customer_visible: 1,
    })),
    serviceStandard: {
      currentStepKey: 'one_visit_readiness',
      blockingItemKeys: ['risk.isolation_permission'],
      pendingItemKeys: ['ready.parts_and_consumables'],
      internal_reasoning: 'never expose',
    },
    operationalState: {
      paymentState: 'pending_payment', materialRequestCount: 1, fieldDayCount: 2,
      fieldReportCount: 3, serviceReportPresent: false, private_note: 'never expose',
    },
    mediaCounts: {
      source_conversation_image_count: 1,
      work_order_attachment_count: 2,
      work_order_message_attachment_count: 3,
      protected_url: 'https://private.example/media',
    },
  });

  assert.deepEqual(Object.keys(input), [
    'work_order', 'source_conversation', 'public_work_order_messages', 'service_standard',
    'operational_state', 'media_counts',
  ]);
  assert.equal(input.source_conversation.messages.length, 12);
  assert.equal(input.public_work_order_messages.length, 12);
  assert.doesNotMatch(JSON.stringify(input), /jane@example\.com|415-555-0123|020 1234 5678|internal_note|private_note|protected_url|private\.example/);
  assert.deepEqual(input.service_standard, {
    current_step_key: 'one_visit_readiness',
    blocking_item_keys: ['risk.isolation_permission'],
    pending_item_keys: ['ready.parts_and_consumables'],
  });
});

test('guidance input accepts only canonical public evidence and standard item keys', () => {
  const input = buildServiceGuidanceInput({
    workOrder: { description: { private: 'must not stringify' } },
    sourceConversationId: 'conversation-1',
    sourceMessages: [
      { role: 'user', content: 'Customer report' },
      { role: 'system', content: 'SYSTEM-SECRET' },
      { role: 'tool', content: 'TOOL-SECRET' },
      { role: 'assistant', content: { secret: 'OBJECT-SECRET' } },
    ],
    publicMessages: [
      { sender_type: 'customer', content: 'Visible customer message', is_internal_note: 0, is_customer_visible: 1 },
      { sender_type: 'engineer', content: 'Visible engineer message', is_internal_note: false, is_customer_visible: true },
      { sender_type: 'admin', content: 'ADMIN-SECRET', is_internal_note: 0, is_customer_visible: 1 },
      { sender_type: 'customer', content: 'INTERNAL-SECRET', is_internal_note: 1, is_customer_visible: 1 },
      { sender_type: 'engineer', content: 'HIDDEN-SECRET', is_internal_note: 0, is_customer_visible: 0 },
      { sender_type: 'customer', content: { secret: 'OBJECT-SECRET' }, is_internal_note: 0, is_customer_visible: 1 },
    ],
    serviceStandard: {
      blockingItemKeys: ['risk.isolation_permission', 'invented.item'],
      pendingItemKeys: ['ready.parts_and_consumables', 'not.a.standard.item'],
    },
  });

  assert.deepEqual(input.source_conversation.messages, [{ role: 'user', content: 'Customer report' }]);
  assert.deepEqual(input.public_work_order_messages, [
    { sender_type: 'customer', content: 'Visible customer message' },
    { sender_type: 'engineer', content: 'Visible engineer message' },
  ]);
  assert.deepEqual(input.service_standard.blocking_item_keys, ['risk.isolation_permission']);
  assert.deepEqual(input.service_standard.pending_item_keys, ['ready.parts_and_consumables']);
  assert.doesNotMatch(JSON.stringify(input), /SECRET|\[object Object\]|invented\.item|not\.a\.standard\.item/);
});

test('guidance prompts prohibit completion authority in both languages', () => {
  const input = buildServiceGuidanceInput({ workOrder: {}, serviceStandard: {} });
  const english = buildServiceGuidancePrompt({
    market: 'com',
    input,
  });
  const chinese = buildServiceGuidancePrompt({ market: 'cn', input });

  assert.match(english.systemPrompt, /Do not confirm/i);
  assert.match(english.systemPrompt, /clear a gate/i);
  assert.match(english.systemPrompt, /customer-visible completion/i);
  assert.match(english.userPrompt, /at most 3/i);
  assert.match(english.userPrompt, /at most 2/i);
  assert.match(chinese.systemPrompt, /不得确认/);
  assert.match(chinese.systemPrompt, /清除闸门/);
  assert.match(chinese.systemPrompt, /面向客户的完成状态/);
});

test('v1 readiness adaptation uses the first high-priority gap without creating standard progress', () => {
  const guidance = adaptReadinessV1({
    gaps: [
      { priority: 'medium', detail: 'Confirm controller version.', why_it_matters: 'Needed for diagnosis.' },
      { priority: 'high', detail: 'Confirm isolation permission.', why_it_matters: 'Required before work.' },
      { priority: 'high', detail: 'Confirm access window.', why_it_matters: 'Needed for entry.' },
    ],
    customer_questions: [
      { priority: 'high', draft: 'Can the machine be isolated?' },
      { priority: 'medium', draft: 'What is the controller version?' },
      { priority: 'low', draft: 'This is removed.' },
    ],
  });

  assert.equal(guidance.headline, 'Confirm isolation permission.');
  assert.deepEqual(guidance.customer_questions, [
    { priority: 'high', draft: 'Can the machine be isolated?' },
    { priority: 'medium', draft: 'What is the controller version?' },
  ]);
  assert.equal(Object.hasOwn(guidance, 'service_standard_progress'), false);
  assert.doesNotMatch(JSON.stringify(guidance), /completed|confirmed/);
});
