import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

const workerDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const wranglerBin = join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function runWrangler(persistPath, args) {
  return spawnSync(
    process.execPath,
    [wranglerBin, 'd1', 'execute', 'sagemro-db', '--local', '--persist-to', persistPath, ...args],
    { cwd: workerDir, encoding: 'utf8' },
  );
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function renderPreparedSql(call, argsOverride = call.args) {
  let index = 0;
  const sql = call.sql.replace(/\?/g, () => sqlLiteral(argsOverride[index++]));
  assert.equal(index, argsOverride.length, 'all prepared SQL binds must be rendered');
  return sql;
}

async function workflowModule() {
  return import('../src/lib/knowledge-candidate-workflow.js');
}

test('transitionCandidate exposes the allowed operations and technical review transitions', async () => {
  const { CURRENT_ADMIN_CANDIDATE_CAPABILITIES, transitionCandidate } = await workflowModule();
  assert.deepEqual(CURRENT_ADMIN_CANDIDATE_CAPABILITIES, ['operations', 'technical_review']);
  const admin = { type: 'admin', id: 'admin-1', capabilities: ['operations', 'technical_review'] };

  assert.deepEqual(
    transitionCandidate({ currentStatus: 'awaiting_operations', action: 'editorial', actor: admin, candidate: {} }),
    { ok: true, nextStatus: 'operations_editing' },
  );
  assert.deepEqual(
    transitionCandidate({ currentStatus: 'operations_editing', action: 'submit_review', actor: admin, candidate: {} }),
    { ok: true, nextStatus: 'awaiting_technical_review' },
  );
  assert.deepEqual(
    transitionCandidate({ currentStatus: 'changes_requested', action: 'editorial', actor: admin, candidate: {} }),
    { ok: true, nextStatus: 'operations_editing' },
  );
  assert.deepEqual(
    transitionCandidate({ currentStatus: 'awaiting_technical_review', action: 'request_changes', actor: admin, candidate: {} }),
    { ok: true, nextStatus: 'changes_requested' },
  );
  assert.deepEqual(
    transitionCandidate({ currentStatus: 'awaiting_technical_review', action: 'approve', actor: admin, candidate: {} }),
    { ok: true, nextStatus: 'approved' },
  );
});

test('transitionCandidate returns stable errors for invalid transition, missing capability, and high-risk self review', async () => {
  const { transitionCandidate } = await workflowModule();

  assert.deepEqual(
    transitionCandidate({
      currentStatus: 'approved',
      action: 'submit_review',
      actor: { type: 'admin', id: 'admin-1', capabilities: ['operations'] },
      candidate: {},
    }),
    { ok: false, error: 'invalid_transition' },
  );
  assert.deepEqual(
    transitionCandidate({
      currentStatus: 'awaiting_operations',
      action: 'editorial',
      actor: { type: 'admin', id: 'admin-1', capabilities: [] },
      candidate: {},
    }),
    { ok: false, error: 'forbidden' },
  );
  assert.deepEqual(
    transitionCandidate({
      currentStatus: 'awaiting_technical_review',
      action: 'approve',
      actor: { type: 'engineer', id: 'eng-1', capabilities: ['technical_review'] },
      candidate: { risk_level: 'high', contributor_engineer_id: 'eng-1' },
    }),
    { ok: false, error: 'self_review_forbidden' },
  );
});

test('readEditorialCandidate accepts only the editorial allowlist and normalizes alarm codes', async () => {
  const { readEditorialCandidate } = await workflowModule();
  const parsed = readEditorialCandidate({
    title: '  Laser alarm guide  ',
    category: ' fault ',
    sanitized_content: ' Safe technical content ',
    equipment_type: 'laser cutter',
    brand: 'Raytools',
    model: 'BM111',
    alarm_codes_json: [' E001 ', 'E001', 'E002'],
    risk_level: 'high',
    evidence_notes: 'Verified against service measurements.',
    internal_use_allowed: true,
    public_use_allowed: false,
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.values, {
    title: 'Laser alarm guide',
    category: 'fault',
    sanitized_content: 'Safe technical content',
    equipment_type: 'laser cutter',
    brand: 'Raytools',
    model: 'BM111',
    alarm_codes_json: '["E001","E002"]',
    risk_level: 'high',
    evidence_notes: 'Verified against service measurements.',
    internal_use_allowed: 1,
    public_use_allowed: 0,
  });

  for (const forbidden of ['raw_content', 'source_type', 'status', 'contributor_engineer_id', 'technical_reviewer_id', 'knowledge_article_id']) {
    assert.deepEqual(readEditorialCandidate({ [forbidden]: 'forbidden' }), {
      ok: false,
      error: 'unsupported_field',
      field: forbidden,
    });
  }
});

test('readEditorialCandidate rejects wrong types, oversized content, and invalid risk', async () => {
  const { readEditorialCandidate } = await workflowModule();
  assert.deepEqual(readEditorialCandidate({ title: 123 }), { ok: false, error: 'invalid_field', field: 'title' });
  assert.deepEqual(readEditorialCandidate({ public_use_allowed: 1 }), { ok: false, error: 'invalid_field', field: 'public_use_allowed' });
  assert.deepEqual(readEditorialCandidate({ alarm_codes_json: 'E001' }), { ok: false, error: 'invalid_field', field: 'alarm_codes_json' });
  assert.deepEqual(readEditorialCandidate({ risk_level: 'critical' }), { ok: false, error: 'invalid_field', field: 'risk_level' });
  assert.deepEqual(readEditorialCandidate({ sanitized_content: 'x'.repeat(20001) }), {
    ok: false,
    error: 'field_too_long',
    field: 'sanitized_content',
  });
});

test('validateCandidateForReview requires editorial content, evidence, and a supported risk level', async () => {
  const { validateCandidateForReview } = await workflowModule();
  const complete = {
    title: 'Title',
    category: 'fault',
    sanitized_content: 'Technical content',
    evidence_notes: 'Measured and verified',
    risk_level: 'medium',
  };
  assert.deepEqual(validateCandidateForReview(complete), { ok: true });
  for (const field of ['title', 'category', 'sanitized_content', 'evidence_notes']) {
    assert.deepEqual(validateCandidateForReview({ ...complete, [field]: ' ' }), {
      ok: false,
      error: 'required_field',
      field,
    });
  }
  assert.deepEqual(validateCandidateForReview({ ...complete, risk_level: 'critical' }), {
    ok: false,
    error: 'invalid_field',
    field: 'risk_level',
  });
});

test('candidate sensitive detector catches contact and identity clues without flagging technical brands', async () => {
  const { detectCandidateSensitiveFields } = await workflowModule();
  for (const [field, value] of [
    ['sanitized_content', 'Call +1 415 555 2671 after inspection.'],
    ['title', 'WhatsApp: +44 7700 900123'],
    ['sanitized_content', 'Customer company: ACME GmbH'],
    ['sanitized_content', 'Address: 12 Main Street'],
  ]) {
    const result = detectCandidateSensitiveFields({ [field]: value });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'sensitive_content_detected');
    assert.deepEqual(result.fields, [field]);
    assert.equal(JSON.stringify(result).includes(value), false);
  }
  assert.deepEqual(detectCandidateSensitiveFields({
    title: 'Raytools BM111 alarm E001',
    sanitized_content: 'Check CypCut interlock and Raytools BM111 measured voltage.',
    equipment_type: 'fiber laser cutter', brand: 'Raytools', model: 'BM111',
  }), { ok: true, fields: [] });
});

test('candidate phone detection requires contact context for ambiguous numeric strings', async () => {
  const { detectCandidateSensitiveFields } = await workflowModule();
  for (const value of [
    'Phone: (415) 555-2671',
    'Tel: 020 7946 0958',
    'Telephone: +1 415 555 2671',
    'Mobile: 07700 900123',
    'WhatsApp: +44 7700 900123',
    '电话：020 7946 0958',
    '手机：138 0013 8000',
    '联系电话：(415) 555-2671',
  ]) {
    assert.deepEqual(detectCandidateSensitiveFields({ sanitized_content: value }), {
      ok: false, error: 'sensitive_content_detected', fields: ['sanitized_content'],
    });
  }
  for (const value of [
    'Power correction +1.2345678 V',
    'Part code +12345678',
    'Device model +12345678',
    'Calibration offset +1 234 5678 units',
  ]) {
    assert.deepEqual(detectCandidateSensitiveFields({ sanitized_content: value }), { ok: true, fields: [] });
  }
});

test('candidate sensitive detector blocks commercial amounts across every approvable field', async () => {
  const { detectCandidateSensitiveFields } = await workflowModule();
  for (const [field, value] of [
    ['title', 'Price: USD900'], ['sanitized_content', 'Quote amount: $1,250'],
    ['equipment_type', 'Customer paid 3000 yuan'], ['brand', 'Price: EUR 900'],
    ['model', '报价：人民币3000元'], ['evidence_notes', 'Customer paid 3000 yuan after verification'],
    ['alarm_codes_json', '["E001","Price: USD900"]'],
  ]) {
    const result = detectCandidateSensitiveFields({ [field]: value });
    assert.deepEqual(result, { ok: false, error: 'sensitive_content_detected', fields: [field] });
    assert.equal(JSON.stringify(result).includes(value), false);
  }
  assert.deepEqual(detectCandidateSensitiveFields({
    title: 'BM111 alarm E001', sanitized_content: 'Measured 220V at connector X12.',
    equipment_type: 'G3015H', brand: 'Raytools', model: 'BM111',
    evidence_notes: 'Power 3000 W and pressure 1250 Pa were verified.',
    alarm_codes_json: '["E001","ALM-220V"]',
  }), { ok: true, fields: [] });
});

test('candidate sensitive detector blocks standalone high-confidence currency formats in every field', async () => {
  const { detectCandidateSensitiveFields } = await workflowModule();
  const samples = ['USD 900', 'Replacement was USD 900', 'Budget €900', 'Invoice total 3000 yuan', '$1,250', '900 dollars'];
  const fields = ['title', 'sanitized_content', 'equipment_type', 'brand', 'model', 'evidence_notes', 'alarm_codes_json'];
  for (const [index, field] of fields.entries()) {
    const value = samples[index % samples.length];
    const candidateValue = field === 'alarm_codes_json' ? JSON.stringify(['E001', value]) : value;
    assert.deepEqual(
      detectCandidateSensitiveFields({ [field]: candidateValue }),
      { ok: false, error: 'sensitive_content_detected', fields: [field] },
    );
  }
});

test('candidate display sanitizer redacts labeled customer and commercial values but preserves technical facts', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const raw = [
    'Symptom:',
    'BM111 alarm E001 at 220V. Customer company: Secret Fabrication GmbH; WhatsApp: +44 7700 900123',
    '',
    'Inspection Process:',
    'Contact: Joe Buyer; Email: joe@secret.example; Address: 12 Main Street',
    '',
    'Diagnosis:',
    'Servo feedback measured 24.6V.',
    '',
    'Solution:',
    'Quote amount: USD 1,250; replaced connector X12.',
  ].join('\n');
  const safe = sanitizeCandidateRawContent(raw);

  for (const secret of ['Secret Fabrication GmbH', '+44 7700 900123', 'Joe Buyer', 'joe@secret.example', '12 Main Street', 'USD 1,250']) {
    assert.equal(safe.includes(secret), false, `must remove ${secret}`);
  }
  for (const technical of ['Symptom:', 'BM111', 'E001', '220V', '24.6V', 'connector X12']) {
    assert.equal(safe.includes(technical), true, `must preserve ${technical}`);
  }
  assert.match(safe, /\[REDACTED CUSTOMER\]/);
  assert.match(safe, /\[REDACTED CONTACT\]/);
  assert.match(safe, /\[REDACTED COMMERCIAL\]/);
});

test('candidate display sanitizer covers natural-language contact, identity, address, and payment disclosures', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const disclosures = [
    ['Please call +44 7700 900123 when the repair is complete.', '+44 7700 900123'],
    ['The customer is Atlas Fabrication GmbH and paid USD 1,250 before service.', 'Atlas Fabrication GmbH'],
    ['The customer is Atlas Fabrication GmbH and paid USD 1,250 before service.', 'USD 1,250'],
    ['Inspection took place at 12 Main Street, Birmingham before startup.', '12 Main Street, Birmingham'],
    ['联系人张伟，客户已支付人民币3000元，地址山东省济南市历下区经十路123号。', '张伟'],
    ['联系人张伟，客户已支付人民币3000元，地址山东省济南市历下区经十路123号。', '人民币3000元'],
    ['联系人张伟，客户已支付人民币3000元，地址山东省济南市历下区经十路123号。', '山东省济南市历下区经十路123号'],
  ];
  for (const [line, secret] of disclosures) {
    const safe = sanitizeCandidateRawContent(`Symptom:\n${line}`);
    assert.equal(safe.includes(secret), false, `must remove ${secret}`);
    assert.equal(safe.includes('Symptom:'), true);
  }
});

test('candidate display sanitizer does not mistake technical identifiers or measurements for sensitive data', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const technical = [
    'Symptom: BM111 alarm E001 on G3015H.',
    'Inspection Process: measured 220V and 24.6V at connector X12.',
    'Diagnosis: Calibration offset +1 234 5678 units.',
    'Solution: Part code +44 7700 900123 remains on the replacement label.',
    'Verification Result: Power correction +1.2345678 V stayed stable.',
  ].join('\n');
  assert.equal(sanitizeCandidateRawContent(technical), technical);
});

test('candidate display sanitizer preserves technical facts after an English street address', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const model = sanitizeCandidateRawContent('Send to 12 Main Street, London. Model BM111.');
  assert.equal(model.includes('12 Main Street, London'), false);
  assert.match(model, /\[REDACTED ADDRESS\]/);
  assert.equal(model.includes('Model BM111.'), true);

  const alarm = sanitizeCandidateRawContent('Service at 48 King Road, Bristol; Alarm E001 measured 220V.');
  assert.equal(alarm.includes('48 King Road, Bristol'), false);
  assert.equal(alarm.includes('Alarm E001 measured 220V.'), true);
});

test('candidate display sanitizer blocks identity-bearing natural language without blocking customer-reported technical phrases', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const identity = sanitizeCandidateRawContent('The customer, Atlas Fabrication GmbH, reported alarm E001.');
  assert.equal(identity.includes('Atlas Fabrication GmbH'), false);
  assert.equal(identity.includes('alarm E001'), true);
  assert.match(identity, /\[REDACTED CUSTOMER\]|\[SENSITIVE LINE REDACTED\]/);

  assert.equal(
    sanitizeCandidateRawContent('Customer-reported alarm E001 on BM111.'),
    'Customer-reported alarm E001 on BM111.',
  );
});

test('candidate display sanitizer catches local phone only with explicit contact context', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const contact = sanitizeCandidateRawContent('Please call me at 415-555-0123 about alarm E001.');
  assert.equal(contact.includes('415-555-0123'), false);
  assert.equal(contact.includes('alarm E001'), true);

  assert.equal(
    sanitizeCandidateRawContent('Part 415-555-0123 triggered alarm E001.'),
    'Part 415-555-0123 triggered alarm E001.',
  );
  const uk = sanitizeCandidateRawContent('Phone 020 7946 0958 for alarm E001 follow-up.');
  assert.equal(uk.includes('020 7946 0958'), false);
  assert.equal(uk.includes('alarm E001'), true);
  assert.equal(sanitizeCandidateRawContent('Part 020 7946 0958 alarm E001.'), 'Part 020 7946 0958 alarm E001.');
});

test('candidate display sanitizer covers contact names and letter-number street addresses', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const contact = sanitizeCandidateRawContent('Contact John Smith after repair; Alarm E001 verified.');
  assert.equal(contact.includes('John Smith'), false);
  assert.equal(contact.includes('Alarm E001'), true);
  const address = sanitizeCandidateRawContent('Send to 221B Baker Street, London. Model BM111.');
  assert.equal(address.includes('221B Baker Street, London'), false);
  assert.equal(address.includes('Model BM111.'), true);
});

test('candidate display sanitizer does not treat a model phrase as a street address', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  assert.equal(
    sanitizeCandidateRawContent('Model 221B Baker drive alarm E001'),
    'Model 221B Baker drive alarm E001',
  );
  const shipping = sanitizeCandidateRawContent('Ship to 221B Baker Street. Alarm E001');
  assert.equal(shipping.includes('221B Baker Street'), false);
  assert.equal(shipping.includes('Alarm E001'), true);
});

test('candidate display sanitizer processes 20k input within a broad local bound and bounded output', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  const input = `${'Model BM111 alarm E001 measured 220V. '.repeat(500)}Phone 020 7946 0958.`.slice(0, 20000);
  const start = performance.now();
  const output = sanitizeCandidateRawContent(input);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1000, `20k sanitizer took ${elapsed}ms`);
  assert.ok(output.length <= input.length + 128);
});

test('candidate display sanitizer covers currency words and symbols without masking technical quantities', async () => {
  const { sanitizeCandidateRawContent } = await workflowModule();
  for (const value of ['1250 dollars', '900 euros', '700 pounds', '3000 yuan', '$1,250', '€900', '£700', '¥3000']) {
    const safe = sanitizeCandidateRawContent(`Customer paid ${value} after repair.`);
    assert.equal(safe.includes(value), false, `must remove ${value}`);
  }
  for (const technical of [
    'Pressure measured 1250 Pa after repair.',
    'Power measured 3000 W after repair.',
    'Part quantity 1250 remained in stock.',
  ]) {
    assert.equal(sanitizeCandidateRawContent(technical), technical);
  }
});

test('candidate category uses the same fixed knowledge taxonomy', async () => {
  const { KNOWLEDGE_CATEGORIES, readEditorialCandidate, validateCandidateForReview } = await workflowModule();
  assert.equal(KNOWLEDGE_CATEGORIES.has('fault'), true);
  assert.equal(KNOWLEDGE_CATEGORIES.has('maintenance'), true);
  assert.deepEqual(readEditorialCandidate({ category: 'made_up' }), {
    ok: false, error: 'invalid_field', field: 'category',
  });
  assert.deepEqual(validateCandidateForReview({
    title: 'Title', category: 'made_up', sanitized_content: 'Content', evidence_notes: 'Evidence', risk_level: 'low',
  }), { ok: false, error: 'invalid_field', field: 'category' });
});

test('parseCandidatePagination accepts only finite integer bounds', async () => {
  const { parseCandidatePagination } = await workflowModule();
  assert.deepEqual(parseCandidatePagination(null, null), { ok: true, page: 1, pageSize: 20, offset: 0 });
  assert.deepEqual(parseCandidatePagination('2', '100'), { ok: true, page: 2, pageSize: 100, offset: 100 });
  for (const [page, pageSize] of [['1.5', '20'], ['NaN', '20'], ['0', '20'], ['1', '0'], ['1', '101'], ['Infinity', '20']]) {
    assert.deepEqual(parseCandidatePagination(page, pageSize), { ok: false, error: 'invalid_pagination' });
  }
});

function createReadonlyEnv() {
  const calls = [];
  const env = {
    JWT_SECRET: 'knowledge-workflow-test-secret-32-chars',
    __calls: calls,
    DB: {
      prepare(sql) {
        const statement = {
          args: [],
          bind(...args) { this.args = args; return this; },
          async first() {
            calls.push({ kind: 'first', sql, args: this.args });
            if (/COUNT\(\*\)/i.test(sql)) return { count: 0 };
            return null;
          },
          async all() {
            calls.push({ kind: 'all', sql, args: this.args });
            return { results: [] };
          },
          async run() {
            calls.push({ kind: 'run', sql, args: this.args });
            return { success: true, meta: { changes: 0 } };
          },
        };
        return statement;
      },
      async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
    },
    KV: { async get() { return null; }, async put() {} },
  };
  return env;
}

function candidateFixture(overrides = {}) {
  return {
    id: 'cand-1', market: 'global', source_type: 'work_order', source_work_order_id: 'wo-1',
    source_repair_record_id: 'repair-1', contributor_engineer_id: 'eng-1', status: 'awaiting_operations',
    title: null, category: null, raw_content: 'Original customer-free service evidence', sanitized_content: null,
    equipment_type: null, brand: null, model: null, alarm_codes_json: '[]', risk_level: 'medium',
    evidence_type: 'service_report', evidence_notes: 'Original verified report', operations_owner_type: null,
    operations_owner_id: null, technical_reviewer_type: null, technical_reviewer_id: null,
    review_notes: null, knowledge_article_id: null, internal_use_allowed: 1, public_use_allowed: 0,
    created_at: '2026-08-13 00:00:00', updated_at: '2026-08-13 00:00:00',
    ...overrides,
  };
}

function createWorkflowEnv(candidate = candidateFixture()) {
  const env = createReadonlyEnv();
  env.__candidates = [structuredClone(candidate)];
  env.__events = [];
  env.__articles = [];
  env.__failEvent = false;
  env.DB.prepare = (sql) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    return {
      args: [],
      bind(...args) { this.args = args; return this; },
      async first() {
        env.__calls.push({ kind: 'first', sql, args: this.args });
        if (/COUNT\(\*\).*knowledge_candidates/i.test(normalized)) {
          const [market, status] = this.args;
          return { count: env.__candidates.filter((item) => item.market === market && (!status || item.status === status)).length };
        }
        if (/FROM knowledge_candidates.*WHERE id = \? AND market = \?/i.test(normalized)) {
          return env.__candidates.find((item) => item.id === this.args[0] && item.market === this.args[1]) || null;
        }
        if (/FROM knowledge_articles WHERE id = \?/i.test(normalized)) {
          return env.__articles.find((item) => item.id === this.args[0]) || null;
        }
        return null;
      },
      async all() {
        env.__calls.push({ kind: 'all', sql, args: this.args });
        if (/FROM knowledge_candidate_events/i.test(normalized)) {
          return { results: env.__events.filter((item) => item.candidate_id === this.args[0]) };
        }
        if (/FROM knowledge_candidates/i.test(normalized)) {
          const [market, maybeStatus] = this.args;
          return { results: env.__candidates.filter((item) => item.market === market && (!maybeStatus || item.status === maybeStatus)) };
        }
        return { results: [] };
      },
      async run() {
        env.__calls.push({ kind: 'run', sql, args: this.args });
        if (/knowledge_candidate_editorial/i.test(normalized)) {
          const snapshotFields = [
            'title', 'category', 'sanitized_content', 'equipment_type', 'brand', 'model',
            'alarm_codes_json', 'risk_level', 'evidence_notes', 'operations_owner_type',
            'operations_owner_id', 'internal_use_allowed', 'public_use_allowed', 'updated_at',
          ];
          const nextStatus = this.args.at(-4 - snapshotFields.length);
          const id = this.args.at(-3 - snapshotFields.length);
          const market = this.args.at(-2 - snapshotFields.length);
          const expectedStatus = this.args.at(-1 - snapshotFields.length);
          const snapshotValues = this.args.slice(-snapshotFields.length);
          const item = env.__candidates.find((row) => row.id === id && row.market === market && row.status === expectedStatus);
          if (!item) return { success: true, meta: { changes: 0 } };
          if (snapshotFields.some((field, index) => item[field] !== snapshotValues[index])) {
            return { success: true, meta: { changes: 0 } };
          }
          const assignmentMatch = normalized.match(/SET (.+), operations_owner_type/s)?.[1] || '';
          const fields = assignmentMatch.split(',').map((part) => part.trim().split(' ')[0]).filter(Boolean);
          fields.forEach((field, index) => { item[field] = this.args[index]; });
          item.operations_owner_type = 'admin';
          item.operations_owner_id = this.args[fields.length];
          item.status = nextStatus;
          return { success: true, meta: { changes: 1 } };
        }
        if (/knowledge_candidate_transition/i.test(normalized)) {
          const [nextStatus, reviewerType, reviewerId, reviewNotes, id, market, expectedStatus] = this.args;
          const item = env.__candidates.find((row) => row.id === id && row.market === market && row.status === expectedStatus);
          if (!item) return { success: true, meta: { changes: 0 } };
          if (/title IS \?/i.test(normalized)) {
            const snapshotFields = [
              'title', 'category', 'sanitized_content', 'equipment_type', 'brand', 'model',
              'alarm_codes_json', 'risk_level', 'evidence_notes', 'operations_owner_type',
              'operations_owner_id', 'internal_use_allowed', 'public_use_allowed', 'updated_at',
            ];
            const snapshotValues = this.args.slice(-snapshotFields.length);
            if (snapshotFields.some((field, index) => item[field] !== snapshotValues[index])) {
              return { success: true, meta: { changes: 0 } };
            }
          }
          item.status = nextStatus;
          item.technical_reviewer_type = reviewerType;
          item.technical_reviewer_id = reviewerId;
          item.review_notes = reviewNotes;
          return { success: true, meta: { changes: 1 } };
        }
        if (/knowledge_candidate_approve_candidate/i.test(normalized)) {
          const snapshotFields = [
            'title', 'category', 'sanitized_content', 'equipment_type', 'brand', 'model',
            'alarm_codes_json', 'risk_level', 'evidence_notes', 'operations_owner_type',
            'operations_owner_id', 'internal_use_allowed', 'public_use_allowed', 'updated_at',
          ];
          const [articleId, reviewerType, reviewerId, reviewNotes, id, market, expectedStatus] = this.args;
          const snapshotValues = this.args.slice(7, 7 + snapshotFields.length);
          const source = this.args.at(-1);
          const item = env.__candidates.find((row) => row.id === id && row.market === market && row.status === expectedStatus);
          const article = env.__articles.find((row) => row.id === articleId && row.source === source);
          if (!item || !article) return { success: true, meta: { changes: 0 } };
          if (snapshotFields.some((field, index) => item[field] !== snapshotValues[index])) {
            return { success: true, meta: { changes: 0 } };
          }
          Object.assign(item, {
            status: 'approved', knowledge_article_id: articleId, technical_reviewer_type: reviewerType,
            technical_reviewer_id: reviewerId, review_notes: reviewNotes,
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (/knowledge_candidate_approve_article/i.test(normalized)) {
          const snapshotFields = [
            'title', 'category', 'sanitized_content', 'equipment_type', 'brand', 'model',
            'alarm_codes_json', 'risk_level', 'evidence_notes', 'operations_owner_type',
            'operations_owner_id', 'internal_use_allowed', 'public_use_allowed', 'updated_at',
          ];
          const [id, market, locale, category, title, content, source, equipment, brand, model, risk, , candidateId, candidateMarket, expectedStatus] = this.args;
          const snapshotValues = this.args.slice(15, 15 + snapshotFields.length);
          const candidateRow = env.__candidates.find((row) => row.id === candidateId && row.market === candidateMarket && row.status === expectedStatus);
          if (!candidateRow) return { success: true, meta: { changes: 0 } };
          if (snapshotFields.some((field, index) => candidateRow[field] !== snapshotValues[index])) {
            return { success: true, meta: { changes: 0 } };
          }
          const existing = env.__articles.find((row) => row.id === id);
          if (existing && existing.source !== source) return { success: true, meta: { changes: 0 } };
          const values = { id, market, locale, category, title, content, source, applicable_equipment: equipment,
            applicable_brand: brand, applicable_model: model, risk_level: risk, status: 'draft', reviewed_by: 'admin-1' };
          if (existing) Object.assign(existing, values);
          else env.__articles.push(values);
          return { success: true, meta: { changes: 1 } };
        }
        if (/knowledge_candidate_event/i.test(normalized)) {
          if (env.__failEvent) throw new Error('simulated_event_failure');
          const [id, candidateId, actorType, actorId, action, fromStatus, toStatus, notes, snapshot] = this.args;
          const candidateRow = env.__candidates.find((row) => row.id === candidateId && row.status === fromStatus);
          if (!candidateRow) return { success: true, meta: { changes: 0 } };
          if (/title IS \?/i.test(normalized)) {
            const snapshotFields = [
              'title', 'category', 'sanitized_content', 'equipment_type', 'brand', 'model',
              'alarm_codes_json', 'risk_level', 'evidence_notes', 'operations_owner_type',
              'operations_owner_id', 'internal_use_allowed', 'public_use_allowed', 'updated_at',
            ];
            const snapshotValues = this.args.slice(-snapshotFields.length);
            if (snapshotFields.some((field, index) => candidateRow[field] !== snapshotValues[index])) {
              return { success: true, meta: { changes: 0 } };
            }
          }
          env.__events.push({ id, candidate_id: candidateId, actor_type: actorType, actor_user_id: actorId,
            action, from_status: fromStatus, to_status: toStatus, notes, snapshot_json: snapshot });
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      },
    };
  };
  env.DB.batch = async (statements) => {
    const snapshot = structuredClone({ candidates: env.__candidates, events: env.__events, articles: env.__articles });
    try { return await Promise.all(statements.map((statement) => statement.run())); }
    catch (error) {
      env.__candidates = snapshot.candidates; env.__events = snapshot.events; env.__articles = snapshot.articles;
      throw error;
    }
  };
  return env;
}

async function token(env, userType = 'admin') {
  return signJwt({
    userId: `${userType}-1`,
    userType,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function api(env, path, { method = 'GET', body, userType = 'admin', host = 'api.sagemro.com' } = {}) {
  const jwt = await token(env, userType);
  const response = await worker.fetch(new Request(`https://${host}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: host.endsWith('.cn') ? 'https://admin.sagemro.cn' : 'https://admin.sagemro.com',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

test('knowledge candidate list is admin-only and derives market from the request host', async () => {
  const env = createReadonlyEnv();
  const forbidden = await api(env, '/api/admin/knowledge-candidates', { userType: 'engineer' });
  assert.equal(forbidden.response.status, 403);

  const global = await api(env, '/api/admin/knowledge-candidates?market=cn&status=awaiting_operations&page=2&pageSize=5');
  assert.equal(global.response.status, 200);
  assert.deepEqual(global.json, { total: 0, list: [], page: 2, pageSize: 5 });
  const listCall = env.__calls.find((call) => call.kind === 'all' && /FROM knowledge_candidates/i.test(call.sql));
  assert.ok(listCall);
  assert.equal(listCall.args[0], 'global');
  assert.match(listCall.sql, /operations_owner_type/i);
  assert.match(listCall.sql, /operations_owner_id/i);

  const invalidStatus = await api(env, '/api/admin/knowledge-candidates?status=made_up');
  assert.equal(invalidStatus.response.status, 400);
  assert.equal(invalidStatus.json.error, 'invalid_status');

  for (const query of ['page=1.5', 'page=NaN', 'page=0', 'pageSize=0', 'pageSize=101']) {
    const invalid = await api(env, `/api/admin/knowledge-candidates?${query}`);
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.json.error, 'invalid_pagination');
  }
});

test('candidate detail is market isolated and returns only display-sanitized evidence plus events to admin', async () => {
  const env = createWorkflowEnv(candidateFixture({
    raw_content: 'Symptom:\nBM111 alarm E001. Customer company: Secret GmbH; WhatsApp: +44 7700 900123; Quote amount: USD 900',
  }));
  env.__events.push({
    id: 'event-1', candidate_id: 'cand-1', actor_type: 'admin', actor_user_id: 'admin-secret-id',
    action: 'created', from_status: null, to_status: 'awaiting_operations',
    notes: 'Customer company: Event Secret GmbH', snapshot_json: '{"secret":"Snapshot Secret GmbH"}',
    created_at: '2026-08-13 00:00:00',
  });
  const detail = await api(env, '/api/admin/knowledge-candidates/cand-1');
  assert.equal(detail.response.status, 200);
  assert.equal('raw_content' in detail.json.candidate, false);
  assert.equal(detail.json.candidate.safe_raw_content.includes('BM111 alarm E001'), true);
  assert.equal(detail.json.candidate.safe_raw_content.includes('Secret GmbH'), false);
  assert.equal(detail.json.candidate.safe_raw_content.includes('+44 7700 900123'), false);
  assert.equal(detail.json.candidate.safe_raw_content.includes('USD 900'), false);
  assert.equal(detail.json.candidate.raw_content_redacted, true);
  assert.equal(detail.json.candidate.raw_content_policy, 'display_sanitized');
  assert.equal(detail.json.candidate.raw_content_redaction_policy, 'fail_closed_sensitive_lines_v1');
  assert.equal(detail.json.candidate.raw_content_redaction_warning, 'automated_redaction_requires_human_review');
  assert.equal(JSON.stringify(detail.json).includes('Secret GmbH'), false);
  assert.equal(detail.json.events.length, 1);
  assert.equal(detail.json.events[0].action, 'unknown');
  assert.equal(detail.json.events[0].actor_user_id, 'admin-secret-id');
  assert.equal(detail.json.events[0].notes.includes('Event Secret GmbH'), false);
  assert.equal('snapshot_json' in detail.json.events[0], false);
  assert.equal(JSON.stringify(detail.json).includes('Snapshot Secret GmbH'), false);

  env.__events.push({
    id: 'event-customer', candidate_id: 'cand-1', actor_type: 'customer', actor_user_id: 'customer-private-id',
    action: 'customer_confirmed_candidate', from_status: null, to_status: 'awaiting_operations', notes: null,
    created_at: '2026-08-13 00:01:00',
  });
  const privacyDetail = await api(env, '/api/admin/knowledge-candidates/cand-1');
  const customerEvent = privacyDetail.json.events.find((event) => event.id === 'event-customer');
  assert.equal(customerEvent.actor_user_id, null);
  assert.equal(JSON.stringify(privacyDetail.json).includes('customer-private-id'), false);

  const wrongMarket = await api(env, '/api/admin/knowledge-candidates/cand-1', { host: 'api.sagemro.cn' });
  assert.equal(wrongMarket.response.status, 404);
  assert.equal(wrongMarket.json.error, 'knowledge_candidate_not_found');
});

test('editorial patch applies only validated fields, returns safe evidence, and writes an atomic before/after event', async () => {
  const env = createWorkflowEnv(candidateFixture({ raw_content: 'Symptom:\nBM111 alarm. Customer company: Secret GmbH' }));
  const blocked = await api(env, '/api/admin/knowledge-candidates/cand-1/editorial', {
    method: 'PATCH', body: { raw_content: 'replace evidence' },
  });
  assert.equal(blocked.response.status, 400);
  assert.equal(blocked.json.error, 'unsupported_field');

  const empty = await api(env, '/api/admin/knowledge-candidates/cand-1/editorial', { method: 'PATCH', body: {} });
  assert.equal(empty.response.status, 400);
  assert.equal(empty.json.error, 'no_editorial_fields');

  const edited = await api(env, '/api/admin/knowledge-candidates/cand-1/editorial', {
    method: 'PATCH',
    body: {
      title: 'Laser alarm guide', category: 'fault', sanitized_content: 'Verified diagnostic steps',
      risk_level: 'high', evidence_notes: 'Verified measurements', alarm_codes_json: ['E001'],
      public_use_allowed: false,
    },
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.json.candidate.status, 'operations_editing');
  assert.equal(edited.json.candidate.operations_owner_id, 'admin-1');
  assert.equal('raw_content' in edited.json.candidate, false);
  assert.equal(edited.json.candidate.safe_raw_content.includes('BM111 alarm'), true);
  assert.equal(edited.json.candidate.safe_raw_content.includes('Secret GmbH'), false);
  assert.equal(env.__events.length, 1);
  const snapshot = JSON.parse(env.__events[0].snapshot_json);
  assert.equal(snapshot.before.status, 'awaiting_operations');
  assert.equal(snapshot.after.status, 'operations_editing');
  assert.equal(env.__candidates[0].raw_content, 'Symptom:\nBM111 alarm. Customer company: Secret GmbH');
});

test('editorial patch detects same-status concurrent edits with a full NULL-safe snapshot and no event', async () => {
  const env = createWorkflowEnv(candidateFixture({ status: 'operations_editing', title: 'Original title' }));
  const originalBatch = env.DB.batch;
  env.DB.batch = async (statements) => {
    env.__candidates[0].title = 'Concurrent title';
    return originalBatch(statements);
  };
  const result = await api(env, '/api/admin/knowledge-candidates/cand-1/editorial', {
    method: 'PATCH', body: { title: 'My title' },
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.json.error, 'candidate_changed');
  assert.equal(env.__candidates[0].title, 'Concurrent title');
  assert.equal(env.__events.length, 0);
  const updateCall = env.__calls.find((call) => call.kind === 'run' && /knowledge_candidate_editorial/i.test(call.sql));
  assert.match(updateCall.sql, /title IS \?/i);
  assert.match(updateCall.sql, /sanitized_content IS \?/i);
  assert.match(updateCall.sql, /operations_owner_id IS \?/i);
});

test('submit review enforces required content and transitions atomically', async () => {
  const incompleteEnv = createWorkflowEnv(candidateFixture({ status: 'operations_editing' }));
  const incomplete = await api(incompleteEnv, '/api/admin/knowledge-candidates/cand-1/submit-review', { method: 'POST' });
  assert.equal(incomplete.response.status, 400);
  assert.equal(incomplete.json.error, 'required_field');

  const env = createWorkflowEnv(candidateFixture({
    status: 'operations_editing', title: 'Guide', category: 'fault', sanitized_content: 'Verified steps',
    evidence_notes: 'Measurements', risk_level: 'medium',
  }));
  const submitted = await api(env, '/api/admin/knowledge-candidates/cand-1/submit-review', { method: 'POST' });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.json.candidate.status, 'awaiting_technical_review');
  assert.equal(env.__events[0].action, 'submit_review');

  const driftEnv = createWorkflowEnv(candidateFixture({
    status: 'operations_editing', title: 'Guide', category: 'fault', sanitized_content: 'Verified steps',
    evidence_notes: 'Measurements', risk_level: 'medium',
  }));
  driftEnv.__failEvent = true;
  const failed = await api(driftEnv, '/api/admin/knowledge-candidates/cand-1/submit-review', { method: 'POST' });
  assert.equal(failed.response.status, 500);
  assert.equal(driftEnv.__candidates[0].status, 'operations_editing');

  const resubmitEnv = createWorkflowEnv(candidateFixture({
    status: 'changes_requested', title: 'Guide', category: 'fault', sanitized_content: 'Verified steps',
    evidence_notes: 'Measurements', risk_level: 'medium', technical_reviewer_type: 'admin',
    technical_reviewer_id: 'admin-previous', review_notes: 'Add stronger evidence.',
  }));
  const resubmitted = await api(resubmitEnv, '/api/admin/knowledge-candidates/cand-1/submit-review', { method: 'POST' });
  assert.equal(resubmitted.response.status, 200);
  assert.equal(resubmitted.json.candidate.technical_reviewer_id, 'admin-previous');
  assert.equal(resubmitted.json.candidate.review_notes, 'Add stronger evidence.');
});

test('submit review uses the editorial snapshot and rejects same-status content drift without an event', async () => {
  const env = createWorkflowEnv(candidateFixture({
    status: 'operations_editing', title: 'Guide', category: 'fault', sanitized_content: 'Verified steps',
    evidence_notes: 'Measurements', risk_level: 'medium',
  }));
  const originalBatch = env.DB.batch;
  env.DB.batch = async (statements) => {
    env.__candidates[0].sanitized_content = '';
    return originalBatch(statements);
  };
  const result = await api(env, '/api/admin/knowledge-candidates/cand-1/submit-review', { method: 'POST' });
  assert.equal(result.response.status, 409);
  assert.equal(result.json.error, 'candidate_changed');
  assert.equal(env.__candidates[0].status, 'operations_editing');
  assert.equal(env.__events.length, 0);
  const updateCall = env.__calls.find((call) => call.kind === 'run' && /knowledge_candidate_transition/i.test(call.sql));
  assert.match(updateCall.sql, /title IS \?/i);
  assert.match(updateCall.sql, /sanitized_content IS \?/i);
  assert.match(updateCall.sql, /operations_owner_id IS \?/i);
});

test('request changes and reject require bounded notes and record reviewer metadata', async () => {
  const env = createWorkflowEnv(candidateFixture({ status: 'awaiting_technical_review' }));
  const missing = await api(env, '/api/admin/knowledge-candidates/cand-1/request-changes', { method: 'POST', body: {} });
  assert.equal(missing.response.status, 400);
  assert.equal(missing.json.error, 'notes_required');
  const oversized = await api(env, '/api/admin/knowledge-candidates/cand-1/request-changes', {
    method: 'POST', body: { notes: 'x'.repeat(4001) },
  });
  assert.equal(oversized.response.status, 400);
  assert.equal(oversized.json.error, 'notes_too_long');

  const changed = await api(env, '/api/admin/knowledge-candidates/cand-1/request-changes', {
    method: 'POST', body: { notes: 'Add oscilloscope evidence.' },
  });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.json.candidate.status, 'changes_requested');
  assert.equal(changed.json.candidate.technical_reviewer_id, 'admin-1');

  const rejected = await api(env, '/api/admin/knowledge-candidates/cand-1/reject', {
    method: 'POST', body: { notes: 'Evidence cannot be verified.' },
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.json.candidate.status, 'rejected');
});

test('reject does not record a stale decision when same-status editorial content drifts', async () => {
  const env = createWorkflowEnv(candidateFixture({ status: 'operations_editing', title: 'Original guide' }));
  const originalBatch = env.DB.batch;
  env.DB.batch = async (statements) => {
    env.__candidates[0].title = 'Concurrent guide';
    return originalBatch(statements);
  };
  const result = await api(env, '/api/admin/knowledge-candidates/cand-1/reject', {
    method: 'POST', body: { notes: 'Evidence rejected.' },
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.json.error, 'candidate_changed');
  assert.equal(env.__candidates[0].status, 'operations_editing');
  assert.equal(env.__events.length, 0);
});

test('approve rejects PII and atomically creates a private draft article with candidate linkage', async () => {
  const base = candidateFixture({
    status: 'awaiting_technical_review', title: 'Laser guide', category: 'fault',
    sanitized_content: 'Check the controller and contact joe@example.com', evidence_notes: 'Measurements', risk_level: 'high',
  });
  const piiEnv = createWorkflowEnv(base);
  const pii = await api(piiEnv, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: 'Reviewed against service evidence.' },
  });
  assert.equal(pii.response.status, 400);
  assert.equal(pii.json.error, 'sensitive_content_detected');
  assert.equal(piiEnv.__articles.length, 0);

  for (const override of [
    { title: 'WhatsApp: +44 7700 900123', sanitized_content: 'Safe steps' },
    { sanitized_content: 'Customer company: ACME GmbH' },
    { sanitized_content: 'Address: 12 Main Street' },
    { equipment_type: 'Call +1 415 555 2671' },
  ]) {
    const sensitiveEnv = createWorkflowEnv({ ...base, sanitized_content: 'Safe steps', ...override });
    const sensitive = await api(sensitiveEnv, '/api/admin/knowledge-candidates/cand-1/approve', {
      method: 'POST', body: { notes: 'Reviewed.' },
    });
    assert.equal(sensitive.response.status, 400);
    assert.equal(sensitive.json.error, 'sensitive_content_detected');
    assert.ok(Array.isArray(sensitive.json.fields));
    assert.equal(sensitiveEnv.__articles.length, 0);
  }

  const env = createWorkflowEnv({ ...base, sanitized_content: 'Check the controller interlock and measured voltage.' });
  const approved = await api(env, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: 'Reviewed against service evidence.' },
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.json.candidate.status, 'approved');
  assert.equal(env.__articles.length, 1);
  assert.equal(env.__articles[0].status, 'draft');
  assert.equal(env.__articles[0].market, 'com');
  assert.equal(env.__articles[0].locale, 'en');
  assert.equal(env.__articles[0].source, 'work_order_candidate:cand-1');
  assert.equal(env.__events[0].action, 'approve');

  const cnEnv = createWorkflowEnv({ ...base, market: 'cn', sanitized_content: '检查控制器互锁和实测电压。' });
  const cnApproved = await api(cnEnv, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: '已核对服务证据。' }, host: 'api.sagemro.cn',
  });
  assert.equal(cnApproved.response.status, 200);
  assert.equal(cnEnv.__articles[0].market, 'cn');
  assert.equal(cnEnv.__articles[0].locale, 'zh-CN');
});

test('approve blocks commercial values before creating article, status, or event facts', async () => {
  for (const override of [
    { sanitized_content: 'Quote amount: $1,250' },
    { evidence_notes: 'Replacement was USD 900 after verification' },
    { model: 'Budget €900' },
    { alarm_codes_json: '["E001","Invoice total 3000 yuan"]' },
  ]) {
    const env = createWorkflowEnv(candidateFixture({
      status: 'awaiting_technical_review', title: 'Laser guide', category: 'fault',
      sanitized_content: 'Safe verified steps', evidence_notes: 'Measurements', risk_level: 'medium',
      ...override,
    }));
    const result = await api(env, '/api/admin/knowledge-candidates/cand-1/approve', {
      method: 'POST', body: { notes: 'Reviewed.' },
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.json.error, 'sensitive_content_detected');
    assert.equal(env.__articles.length, 0);
    assert.equal(env.__events.length, 0);
    assert.equal(env.__candidates[0].status, 'awaiting_technical_review');
  }
});

test('approve never overwrites an article from another source and retry has no partial facts', async () => {
  const candidate = candidateFixture({
    status: 'awaiting_technical_review', title: 'Laser guide', category: 'fault',
    sanitized_content: 'Check measured voltage.', evidence_notes: 'Measurements', risk_level: 'medium',
    knowledge_article_id: 'knowledge-candidate-cand-1',
  });
  const env = createWorkflowEnv(candidate);
  env.__articles.push({ id: 'knowledge-candidate-cand-1', source: 'manual:other', content: 'Do not overwrite' });
  const conflict = await api(env, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: 'Reviewed.' },
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.json.error, 'knowledge_article_source_conflict');
  assert.equal(env.__candidates[0].status, 'awaiting_technical_review');
  assert.equal(env.__articles[0].content, 'Do not overwrite');

  const retryEnv = createWorkflowEnv({ ...candidate, knowledge_article_id: null });
  retryEnv.__failEvent = true;
  const failed = await api(retryEnv, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: 'Reviewed.' },
  });
  assert.equal(failed.response.status, 500);
  assert.equal(retryEnv.__articles.length, 0);
  assert.equal(retryEnv.__candidates[0].status, 'awaiting_technical_review');

  const approvedCandidate = { ...candidate, status: 'approved' };
  const idempotentEnv = createWorkflowEnv(approvedCandidate);
  idempotentEnv.__articles.push({
    id: 'knowledge-candidate-cand-1', source: 'work_order_candidate:cand-1', status: 'draft',
  });
  const retried = await api(idempotentEnv, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: 'Reviewed.' },
  });
  assert.equal(retried.response.status, 200);
  assert.equal(retried.json.candidate.status, 'approved');
  assert.equal(idempotentEnv.__articles.length, 1);
  assert.equal(idempotentEnv.__events.length, 0);
});

test('approve rejects same-status content drift without article, status, or event facts', async () => {
  const env = createWorkflowEnv(candidateFixture({
    status: 'awaiting_technical_review', title: 'Laser guide', category: 'fault',
    sanitized_content: 'Safe verified steps', evidence_notes: 'Measurements', risk_level: 'medium',
  }));
  const originalBatch = env.DB.batch;
  env.DB.batch = async (statements) => {
    env.__candidates[0].sanitized_content = 'Phone: (415) 555-2671';
    return originalBatch(statements);
  };
  const result = await api(env, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: 'Reviewed.' },
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.json.error, 'candidate_changed');
  assert.equal(env.__candidates[0].status, 'awaiting_technical_review');
  assert.equal(env.__articles.length, 0);
  assert.equal(env.__events.length, 0);
  const articleCall = env.__calls.find((call) => call.kind === 'run' && /knowledge_candidate_approve_article/i.test(call.sql));
  const candidateCall = env.__calls.find((call) => call.kind === 'run' && /knowledge_candidate_approve_candidate/i.test(call.sql));
  assert.match(articleCall.sql, /sanitized_content IS \?/i);
  assert.match(candidateCall.sql, /sanitized_content IS \?/i);
});

test('local D1 validates exact approve SQL order and stale predicates without simulating DB.batch', async () => {
  const captureEnv = createWorkflowEnv(candidateFixture({
    status: 'awaiting_technical_review', title: 'Laser guide', category: 'fault',
    sanitized_content: 'Check measured voltage.', evidence_notes: 'Measurements', risk_level: 'medium',
  }));
  const captured = await api(captureEnv, '/api/admin/knowledge-candidates/cand-1/approve', {
    method: 'POST', body: { notes: 'Reviewed.' },
  });
  assert.equal(captured.response.status, 200);
  const eventCall = captureEnv.__calls.find((call) => call.kind === 'run' && /knowledge_candidate_event/i.test(call.sql));
  const articleCall = captureEnv.__calls.find((call) => call.kind === 'run' && /knowledge_candidate_approve_article/i.test(call.sql));
  const candidateCall = captureEnv.__calls.find((call) => call.kind === 'run' && /knowledge_candidate_approve_candidate/i.test(call.sql));
  assert.ok(eventCall && articleCall && candidateCall);

  const persistPath = mkdtempSync(join(tmpdir(), 'sagemro-candidate-approve-'));
  const setupPath = join(persistPath, 'setup.sql');
  writeFileSync(setupPath, `
PRAGMA foreign_keys = ON;
CREATE TABLE knowledge_articles (
  id TEXT PRIMARY KEY, market TEXT NOT NULL, locale TEXT NOT NULL, category TEXT NOT NULL,
  title TEXT NOT NULL, content TEXT NOT NULL, source TEXT, applicable_equipment TEXT,
  applicable_brand TEXT, applicable_model TEXT, risk_level TEXT CHECK (risk_level IN ('low','medium','high')),
  version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft', reviewed_by TEXT,
  reviewed_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE knowledge_candidates (
  id TEXT PRIMARY KEY, market TEXT NOT NULL, status TEXT NOT NULL, title TEXT, category TEXT,
  sanitized_content TEXT, equipment_type TEXT, brand TEXT, model TEXT, risk_level TEXT,
  evidence_notes TEXT, contributor_engineer_id TEXT, knowledge_article_id TEXT,
  alarm_codes_json TEXT NOT NULL DEFAULT '[]', operations_owner_type TEXT, operations_owner_id TEXT,
  internal_use_allowed INTEGER NOT NULL DEFAULT 1, public_use_allowed INTEGER NOT NULL DEFAULT 0,
  technical_reviewer_type TEXT, technical_reviewer_id TEXT, review_notes TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (knowledge_article_id) REFERENCES knowledge_articles(id)
);
CREATE TABLE knowledge_candidate_events (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, actor_type TEXT NOT NULL, actor_user_id TEXT,
  action TEXT NOT NULL, from_status TEXT, to_status TEXT, notes TEXT, snapshot_json TEXT,
  created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (candidate_id) REFERENCES knowledge_candidates(id)
);
INSERT INTO knowledge_candidates (
  id, market, status, title, category, sanitized_content, equipment_type, brand, model,
  risk_level, evidence_notes, contributor_engineer_id, updated_at
) VALUES (
  'cand-1', 'global', 'awaiting_technical_review', 'Laser guide', 'fault',
  'Check measured voltage.', NULL, NULL, NULL, 'medium', 'Measurements', 'eng-1', '2026-08-13 00:00:00'
);
`, 'utf8');
  const setup = runWrangler(persistPath, ['--file', setupPath]);
  assert.equal(setup.status, 0, `${setup.stdout}\n${setup.stderr}`);

  const approvePath = join(persistPath, 'approve.sql');
  writeFileSync(approvePath, `${renderPreparedSql(eventCall)};\n${renderPreparedSql(articleCall)};\n${renderPreparedSql(candidateCall)};`, 'utf8');
  const approve = runWrangler(persistPath, ['--file', approvePath]);
  assert.equal(approve.status, 0, `${approve.stdout}\n${approve.stderr}`);
  const approvedState = runWrangler(persistPath, ['--command', `
SELECT c.status, c.knowledge_article_id, a.status AS article_status, a.source,
       (SELECT COUNT(*) FROM knowledge_candidate_events WHERE candidate_id = c.id) AS event_count
FROM knowledge_candidates c JOIN knowledge_articles a ON a.id = c.knowledge_article_id
WHERE c.id = 'cand-1';
`]);
  assert.equal(approvedState.status, 0, `${approvedState.stdout}\n${approvedState.stderr}`);
  assert.match(approvedState.stdout, /approved/i);
  assert.match(approvedState.stdout, /draft/i);
  assert.match(approvedState.stdout, /work_order_candidate:cand-1/i);
  assert.match(approvedState.stdout, /event_count[\s\S]*1/i);

  const reset = runWrangler(persistPath, ['--command', `
DELETE FROM knowledge_candidate_events;
UPDATE knowledge_candidates SET status = 'changes_requested', knowledge_article_id = NULL;
DELETE FROM knowledge_articles;
`]);
  assert.equal(reset.status, 0, `${reset.stdout}\n${reset.stderr}`);
  const stalePath = join(persistPath, 'stale.sql');
  writeFileSync(stalePath, `${renderPreparedSql(eventCall)};\n${renderPreparedSql(articleCall)};\n${renderPreparedSql(candidateCall)};`, 'utf8');
  const stale = runWrangler(persistPath, ['--file', stalePath]);
  assert.equal(stale.status, 0, `${stale.stdout}\n${stale.stderr}`);
  const staleState = runWrangler(persistPath, ['--command', `
SELECT status, knowledge_article_id,
       (SELECT COUNT(*) FROM knowledge_articles) AS article_count,
       (SELECT COUNT(*) FROM knowledge_candidate_events) AS event_count
FROM knowledge_candidates WHERE id = 'cand-1';
`]);
  assert.equal(staleState.status, 0, `${staleState.stdout}\n${staleState.stderr}`);
  assert.match(staleState.stdout, /changes_requested/i);
  assert.match(staleState.stdout, /article_count[\s\S]*0/i);
  assert.match(staleState.stdout, /event_count[\s\S]*0/i);

  // Wrangler local D1 rejects SQL BEGIN/SAVEPOINT, so this test intentionally
  // validates the exact predicates and runtime order only. The env.DB.batch
  // rollback boundary is covered by the simulated event failure tests above.
});
