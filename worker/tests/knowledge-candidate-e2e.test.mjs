import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
  if (type !== 'ExperimentalWarning') emitWarning.call(process, warning, ...args);
};
const { DatabaseSync } = await import('node:sqlite');
process.emitWarning = emitWarning;

import { signJwt } from '../src/lib/auth.js';
import { transitionCandidate } from '../src/lib/knowledge-candidate-workflow.js';
import worker, { executeTool } from '../src/index.js';

const JWT_SECRET = 'fictional-e2e-secret-with-sufficient-length';
const CUSTOMER_ID = 'fictional-customer';
const ENGINEER_ID = 'fictional-engineer';
const ADMIN_ID = 'fictional-admin';
const WORK_ORDERS = [
  ['fictional-normal', 'FICT-WO-NORMAL', 'Normal fictional repair'],
  ['fictional-high-risk', 'FICT-WO-HIGH-RISK', 'High-risk fictional repair'],
  ['fictional-no-parts', 'FICT-WO-NO-PARTS', 'Fictional repair without replacement parts'],
  ['fictional-customer-confirm', 'FICT-WO-CUSTOMER', 'Customer-confirmed fictional repair'],
  ['fictional-admin-confirm', 'FICT-WO-ADMIN', 'Administrator-verified fictional repair'],
];

function normalizeBindValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

class TestD1Statement {
  constructor(owner, sql) {
    this.owner = owner;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args.map(normalizeBindValue);
    return this;
  }

  async first(column) {
    const row = this.owner.sqlite.prepare(this.sql).get(...this.args);
    if (row === undefined) return null;
    return column === undefined ? row : row[column];
  }

  async all() {
    return { success: true, results: this.owner.sqlite.prepare(this.sql).all(...this.args) };
  }

  async raw() {
    const rows = this.owner.sqlite.prepare(this.sql).all(...this.args);
    if (!rows.length) return [];
    const columns = Object.keys(rows[0]);
    return rows.map((row) => columns.map((column) => row[column]));
  }

  async run() {
    const result = this.owner.sqlite.prepare(this.sql).run(...this.args);
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

class TestD1Database {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec('PRAGMA foreign_keys = ON');
  }

  prepare(sql) {
    return new TestD1Statement(this, sql);
  }

  async batch(statements) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(sql) {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }

  close() {
    this.sqlite.close();
  }
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function createE2eEnv() {
  const DB = new TestD1Database();
  DB.sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ai_trace_logs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      user_id TEXT,
      user_role TEXT,
      tool_name TEXT,
      args_json TEXT,
      result_status TEXT,
      error_code TEXT,
      iteration INTEGER,
      latency_ms INTEGER,
      result_size_bytes INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO customers (id, user_no, name, phone, password_hash, salt)
    VALUES (${sqlText(CUSTOMER_ID)}, 'U900001', 'Fictional Customer', 'TEST-CUSTOMER-CONTACT', 'unused', 'unused');
    INSERT INTO engineers (
      id, user_no, name, phone, password_hash, salt, status, commission_rate,
      rating_count, rating_timeliness, rating_technical, rating_communication, rating_professional
    ) VALUES (
      ${sqlText(ENGINEER_ID)}, 'E900001', 'Fictional Engineer', 'TEST-ENGINEER-CONTACT',
      'unused', 'unused', 'available', 0.8, 0, 0, 0, 0, 0
    );
    ${WORK_ORDERS.map(([id, orderNo, description]) => `
      INSERT INTO work_orders (
        id, order_no, customer_id, engineer_id, type, description, urgency, status
      ) VALUES (
        ${sqlText(id)}, ${sqlText(orderNo)}, ${sqlText(CUSTOMER_ID)}, ${sqlText(ENGINEER_ID)},
        'fault', ${sqlText(description)}, 'normal', 'in_service'
      );
    `).join('\n')}
  `);
  return {
    DB,
    JWT_SECRET,
    KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
  };
}

async function route(env, role, path, {
  method = 'POST',
  body,
  host = 'api.sagemro.com',
} = {}) {
  const userId = role === 'customer' ? CUSTOMER_ID : role === 'engineer' ? ENGINEER_ID : ADMIN_ID;
  const token = await signJwt({
    userId,
    userType: role,
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, JWT_SECRET);
  const waits = [];
  const response = await worker.fetch(new Request(`https://${host}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: host.endsWith('.cn') ? 'https://sagemro.cn' : 'https://sagemro.com',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env, { waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
  const text = await response.text();
  return { response, json: text ? JSON.parse(text) : null };
}

function report(overrides = {}) {
  return {
    symptom: 'A fictional capacitive height alarm appears during controlled test cuts.',
    inspection_process: 'Inspected grounding, nozzle alignment, ceramic ring, and calibration values.',
    diagnosis: 'A cracked fictional ceramic ring caused an unstable capacitive sensing signal.',
    solution: 'Replaced the fictional ceramic ring and recalibrated the height sensing circuit.',
    verification_result: 'Completed ten fictional dry runs and test cuts without another alarm.',
    follow_up_advice: 'Inspect nozzle alignment again after one hundred operating hours.',
    parts_used: [],
    labor_hours: 1.5,
    ...overrides,
  };
}

const rating = {
  rating_timeliness: 5,
  rating_technical: 5,
  rating_communication: 4,
  rating_professional: 5,
  comment: 'Fictional acceptance test completed successfully.',
};

async function saveAndResolve(env, workOrderId, payload = report(), host = 'api.sagemro.com') {
  const saved = await route(env, 'engineer', `/api/workorders/${workOrderId}/repair-record`, {
    body: payload,
    host,
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.json));
  const resolved = await route(env, 'engineer', `/api/workorders/${workOrderId}/resolve`, { host });
  assert.equal(resolved.response.status, 200, JSON.stringify(resolved.json));
}

async function confirmByCustomer(env, workOrderId, host = 'api.sagemro.com') {
  return route(env, 'customer', '/api/workorders/rating', {
    body: { work_order_id: workOrderId, ...rating },
    host,
  });
}

async function candidateForWorkOrder(env, workOrderId) {
  return env.DB.prepare(
    'SELECT * FROM knowledge_candidates WHERE source_work_order_id = ?'
  ).bind(workOrderId).first();
}

async function editSubmitAndApprove(env, candidateId, editorial, host = 'api.sagemro.com') {
  const edited = await route(env, 'admin', `/api/admin/knowledge-candidates/${candidateId}/editorial`, {
    method: 'PATCH',
    body: editorial,
    host,
  });
  assert.equal(edited.response.status, 200, JSON.stringify(edited.json));
  const submitted = await route(env, 'admin', `/api/admin/knowledge-candidates/${candidateId}/submit-review`, {
    host,
  });
  assert.equal(submitted.response.status, 200, JSON.stringify(submitted.json));
  return route(env, 'admin', `/api/admin/knowledge-candidates/${candidateId}/approve`, {
    body: { notes: 'Fictional technical review completed against the service evidence.' },
    host,
  });
}

test('five fictional work-order fixtures cover report completion, no-parts evidence, and customer candidate creation', async (t) => {
  const env = createE2eEnv();
  t.after(() => env.DB.close());

  await saveAndResolve(env, 'fictional-normal');
  const normal = await env.DB.prepare(`
    SELECT wo.status, rr.report_quality_status, rr.submitted_at
    FROM work_orders wo JOIN work_order_repair_records rr ON rr.work_order_id = wo.id
    WHERE wo.id = ?
  `).bind('fictional-normal').first();
  assert.equal(normal.status, 'resolved');
  assert.equal(normal.report_quality_status, 'submitted');
  assert.ok(normal.submitted_at);

  await saveAndResolve(env, 'fictional-no-parts', report({ parts_used: [], labor_hours: 0.75 }));
  const noParts = await env.DB.prepare(
    'SELECT parts_used, report_quality_status FROM work_order_repair_records WHERE work_order_id = ?'
  ).bind('fictional-no-parts').first();
  assert.equal(noParts.parts_used, '[]');
  assert.equal(noParts.report_quality_status, 'submitted');

  await saveAndResolve(env, 'fictional-customer-confirm');
  const confirmed = await confirmByCustomer(env, 'fictional-customer-confirm');
  assert.equal(confirmed.response.status, 200, JSON.stringify(confirmed.json));
  assert.equal(confirmed.json.rating_status, 'created');
  assert.equal(confirmed.json.candidate.status, 'created');
  const candidate = await candidateForWorkOrder(env, 'fictional-customer-confirm');
  assert.equal(candidate.status, 'awaiting_operations');
  assert.equal(candidate.market, 'global');
  assert.equal(candidate.contributor_engineer_id, ENGINEER_ID);
  assert.equal(candidate.public_use_allowed, 0);
  assert.match(candidate.raw_content, /Symptom:/);
  assert.match(candidate.raw_content, /Verification Result:/);
  assert.equal(candidate.raw_content.includes('Parts Used:'), false);
});

test('complete customer-confirmed route chain creates only a private draft article excluded from retrieval', async (t) => {
  const env = createE2eEnv();
  t.after(() => env.DB.close());
  await saveAndResolve(env, 'fictional-customer-confirm');
  const firstRating = await confirmByCustomer(env, 'fictional-customer-confirm');
  assert.equal(firstRating.response.status, 200, JSON.stringify(firstRating.json));
  const candidate = await candidateForWorkOrder(env, 'fictional-customer-confirm');

  const approved = await editSubmitAndApprove(env, candidate.id, {
    title: 'Fictional capacitive height alarm diagnostic guide',
    category: 'fault',
    sanitized_content: 'Inspect grounding and nozzle alignment, replace a cracked ceramic ring, then recalibrate and verify with controlled cuts.',
    equipment_type: 'fictional fiber cutting test rig',
    brand: 'FictionalBrand',
    model: 'FICT-MODEL-01',
    alarm_codes_json: ['FICT-E001'],
    risk_level: 'medium',
    evidence_notes: 'Fictional service evidence includes inspection steps and ten successful verification cuts.',
    internal_use_allowed: true,
    public_use_allowed: true,
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.json));
  assert.equal(approved.json.candidate.status, 'approved');

  const article = await env.DB.prepare(
    'SELECT * FROM knowledge_articles WHERE source = ?'
  ).bind(`work_order_candidate:${candidate.id}`).first();
  assert.ok(article);
  assert.equal(article.status, 'draft');
  assert.equal(article.market, 'com');
  assert.equal(article.locale, 'en');
  assert.equal(approved.json.candidate.public_use_allowed, 1);

  const pending = [];
  const search = await executeTool({
    toolName: 'search_knowledge_base',
    args: { locale: 'en', query: 'capacitive height alarm' },
    env,
    ctx: { waitUntil(promise) { pending.push(promise); } },
    userRole: 'guest',
    conversationId: 'fictional-conversation',
    iteration: 0,
    market: 'com',
  });
  await Promise.all(pending);
  assert.equal(search.count, 0);
  assert.deepEqual(search.articles, []);
  assert.equal(await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM knowledge_articles WHERE status = 'published'"
  ).first('count'), 0);

  await env.DB.prepare(
    "UPDATE knowledge_articles SET status = 'published' WHERE id = ? AND market = 'com'"
  ).bind(article.id).run();
  const published = await executeTool({
    toolName: 'search_knowledge_base',
    args: { locale: 'en', query: 'capacitive height alarm' },
    env,
    ctx: { waitUntil(promise) { pending.push(promise); } },
    userRole: 'guest',
    conversationId: 'fictional-conversation-published-control',
    iteration: 0,
    market: 'com',
  });
  await Promise.all(pending.splice(0));
  assert.equal(published.count, 1);
  assert.equal(published.articles[0].id, article.id);
});

test('incomplete reports are blocked before submission and do not create downstream facts', async (t) => {
  const env = createE2eEnv();
  t.after(() => env.DB.close());
  const saved = await route(env, 'engineer', '/api/workorders/fictional-normal/repair-record', {
    body: report({ inspection_process: '', diagnosis: 'too short', verification_result: '' }),
  });
  assert.equal(saved.response.status, 200);
  const resolved = await route(env, 'engineer', '/api/workorders/fictional-normal/resolve');
  assert.equal(resolved.response.status, 400);
  assert.equal(resolved.json.error, 'service_report_incomplete');
  assert.deepEqual(resolved.json.fields, [
    { field: 'inspection_process', code: 'required' },
    { field: 'diagnosis', code: 'too_short' },
    { field: 'verification_result', code: 'required' },
  ]);
  assert.equal(await env.DB.prepare(
    'SELECT status FROM work_orders WHERE id = ?'
  ).bind('fictional-normal').first('status'), 'in_service');
  assert.equal(await env.DB.prepare(
    'SELECT report_quality_status FROM work_order_repair_records WHERE work_order_id = ?'
  ).bind('fictional-normal').first('report_quality_status'), 'draft');
  assert.equal(await env.DB.prepare('SELECT COUNT(*) AS count FROM knowledge_candidates').first('count'), 0);
});

test('rating and admin creation retries are idempotent for candidate and action events', async (t) => {
  const env = createE2eEnv();
  t.after(() => env.DB.close());

  await saveAndResolve(env, 'fictional-customer-confirm');
  const first = await confirmByCustomer(env, 'fictional-customer-confirm');
  const retry = await confirmByCustomer(env, 'fictional-customer-confirm');
  assert.equal(first.response.status, 200);
  assert.equal(retry.response.status, 200);
  assert.equal(retry.json.rating_status, 'existing');
  assert.equal(retry.json.candidate.status, 'existing');
  const customerCandidate = await candidateForWorkOrder(env, 'fictional-customer-confirm');
  assert.equal(await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM knowledge_candidates WHERE source_work_order_id = ?'
  ).bind('fictional-customer-confirm').first('count'), 1);
  assert.equal(await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM knowledge_candidate_events
    WHERE candidate_id = ? AND action = 'customer_confirmed_candidate'
  `).bind(customerCandidate.id).first('count'), 1);

  await saveAndResolve(env, 'fictional-admin-confirm');
  const createBody = { reason: 'Fictional operations verification found reusable technical evidence.' };
  const adminFirst = await route(env, 'admin', '/api/admin/workorders/fictional-admin-confirm/knowledge-candidate', {
    body: createBody,
  });
  const adminRetry = await route(env, 'admin', '/api/admin/workorders/fictional-admin-confirm/knowledge-candidate', {
    body: createBody,
  });
  assert.equal(adminFirst.response.status, 201, JSON.stringify(adminFirst.json));
  assert.equal(adminRetry.response.status, 200, JSON.stringify(adminRetry.json));
  assert.equal(adminRetry.json.candidate.status, 'existing');
  const adminCandidate = await candidateForWorkOrder(env, 'fictional-admin-confirm');
  assert.equal(await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM knowledge_candidates WHERE source_work_order_id = ?'
  ).bind('fictional-admin-confirm').first('count'), 1);
  assert.equal(await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM knowledge_candidate_events
    WHERE candidate_id = ? AND action = 'admin_created_candidate'
  `).bind(adminCandidate.id).first('count'), 1);
});

test('sensitive high-risk editorial content cannot create an article or approval facts', async (t) => {
  const env = createE2eEnv();
  t.after(() => env.DB.close());
  await saveAndResolve(env, 'fictional-high-risk');
  const created = await route(env, 'admin', '/api/admin/workorders/fictional-high-risk/knowledge-candidate', {
    body: { reason: 'Fictional high-risk evidence requires independent technical review.' },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.json));
  const candidate = await candidateForWorkOrder(env, 'fictional-high-risk');
  const edited = await route(env, 'admin', `/api/admin/knowledge-candidates/${candidate.id}/editorial`, {
    method: 'PATCH',
    body: {
      title: 'Fictional high-risk guide',
      category: 'safety',
      sanitized_content: 'Customer company: FICTIONAL TEST ENTITY; Phone: +999 000 000 0000; Quote amount: USD 1234.',
      risk_level: 'high',
      evidence_notes: 'Fictional measurements were reviewed for this test only.',
    },
  });
  assert.equal(edited.response.status, 200, JSON.stringify(edited.json));
  const submitted = await route(env, 'admin', `/api/admin/knowledge-candidates/${candidate.id}/submit-review`);
  assert.equal(submitted.response.status, 200, JSON.stringify(submitted.json));

  const before = {
    status: await env.DB.prepare('SELECT status FROM knowledge_candidates WHERE id = ?').bind(candidate.id).first('status'),
    articles: await env.DB.prepare('SELECT COUNT(*) AS count FROM knowledge_articles').first('count'),
    events: await env.DB.prepare('SELECT COUNT(*) AS count FROM knowledge_candidate_events').first('count'),
  };
  const rejected = await route(env, 'admin', `/api/admin/knowledge-candidates/${candidate.id}/approve`, {
    body: { notes: 'Fictional review attempt.' },
  });
  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.json.error, 'sensitive_content_detected');
  assert.deepEqual(new Set(rejected.json.fields), new Set(['sanitized_content']));
  assert.equal(await env.DB.prepare('SELECT status FROM knowledge_candidates WHERE id = ?').bind(candidate.id).first('status'), before.status);
  assert.equal(await env.DB.prepare('SELECT COUNT(*) AS count FROM knowledge_articles').first('count'), before.articles);
  assert.equal(await env.DB.prepare('SELECT COUNT(*) AS count FROM knowledge_candidate_events').first('count'), before.events);
});

test('high-risk contributor cannot self-review in the workflow state machine', () => {
  const result = transitionCandidate({
    currentStatus: 'awaiting_technical_review',
    action: 'approve',
    actor: { type: 'engineer', id: ENGINEER_ID, capabilities: ['technical_review'] },
    candidate: { risk_level: 'high', contributor_engineer_id: ENGINEER_ID },
  });
  assert.deepEqual(result, { ok: false, error: 'self_review_forbidden' });
});

test('China-market admin candidate is isolated from the global admin routes', async (t) => {
  const env = createE2eEnv();
  t.after(() => env.DB.close());
  await saveAndResolve(
    env,
    'fictional-admin-confirm',
    report({ parts_used: [], follow_up_advice: 'Fictional follow-up inspection is optional.' }),
    'api.sagemro.cn',
  );
  const created = await route(env, 'admin', '/api/admin/workorders/fictional-admin-confirm/knowledge-candidate', {
    body: { reason: 'Fictional China-market evidence was verified.' },
    host: 'api.sagemro.cn',
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.json));
  const candidate = await candidateForWorkOrder(env, 'fictional-admin-confirm');
  assert.equal(candidate.market, 'cn');

  const globalDetail = await route(env, 'admin', `/api/admin/knowledge-candidates/${candidate.id}`, {
    method: 'GET',
  });
  assert.equal(globalDetail.response.status, 404);
  assert.equal(globalDetail.json.error, 'knowledge_candidate_not_found');

  const cnDetail = await route(env, 'admin', `/api/admin/knowledge-candidates/${candidate.id}`, {
    method: 'GET',
    host: 'api.sagemro.cn',
  });
  assert.equal(cnDetail.response.status, 200, JSON.stringify(cnDetail.json));
  assert.equal(cnDetail.json.candidate.market, 'cn');
});
