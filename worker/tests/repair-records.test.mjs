import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { signJwt } from '../src/lib/auth.js';
import worker from '../src/index.js';

const migrationUrl = new URL('../migrations/034_knowledge_candidate_pipeline.sql', import.meta.url);
const schemaUrl = new URL('../schema.sql', import.meta.url);
const workerDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const wranglerBin = join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function runWrangler(persistPath, args) {
  return spawnSync(
    process.execPath,
    [wranglerBin, 'd1', 'execute', 'sagemro-db', '--local', '--persist-to', persistPath, ...args],
    {
      cwd: workerDir,
      encoding: 'utf8',
    },
  );
}

test('034 migration extends repair records with evidence and lifecycle fields', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /ALTER TABLE work_order_repair_records ADD COLUMN inspection_process TEXT/i);
  assert.match(sql, /ALTER TABLE work_order_repair_records ADD COLUMN verification_result TEXT/i);
  assert.match(sql, /ALTER TABLE work_order_repair_records ADD COLUMN follow_up_advice TEXT/i);
  assert.match(
    sql,
    /ALTER TABLE work_order_repair_records ADD COLUMN report_quality_status TEXT NOT NULL DEFAULT 'draft'/i,
  );
  assert.match(sql, /ALTER TABLE work_order_repair_records ADD COLUMN submitted_at TEXT/i);
  assert.match(sql, /ALTER TABLE work_order_repair_records ADD COLUMN customer_confirmed_at TEXT/i);
});

test('034 migration registers its version in the migration ledger', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /INSERT OR IGNORE INTO _migrations \(version, note\)/i);
  assert.match(sql, /'034_knowledge_candidate_pipeline'/i);
});

test('fresh schema snapshot defines repair records with 016 and 034 fields', async () => {
  const sql = await readFile(schemaUrl, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS work_order_repair_records\s*\(/i);
  assert.match(sql, /work_order_id TEXT NOT NULL UNIQUE/i);
  assert.match(sql, /symptom TEXT/i);
  assert.match(sql, /diagnosis TEXT/i);
  assert.match(sql, /solution TEXT/i);
  assert.match(sql, /parts_used TEXT DEFAULT '\[\]'/i);
  assert.match(sql, /labor_hours REAL DEFAULT 0/i);
  assert.match(sql, /inspection_process TEXT/i);
  assert.match(sql, /verification_result TEXT/i);
  assert.match(sql, /follow_up_advice TEXT/i);
  assert.match(sql, /report_quality_status TEXT NOT NULL DEFAULT 'draft'/i);
  assert.match(sql, /submitted_at TEXT/i);
  assert.match(sql, /customer_confirmed_at TEXT/i);
});

test('034 executes on a 016 baseline and D1 enforces source consistency', () => {
  const persistPath = mkdtempSync(join(tmpdir(), 'sagemro-kb034-sql-'));
  const baselinePath = join(persistPath, 'baseline.sql');
  writeFileSync(
    baselinePath,
    `
CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
CREATE TABLE work_orders (id TEXT PRIMARY KEY);
CREATE TABLE engineers (id TEXT PRIMARY KEY);
CREATE TABLE knowledge_articles (id TEXT PRIMARY KEY);
CREATE TABLE work_order_repair_records (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL UNIQUE,
  symptom TEXT,
  diagnosis TEXT,
  solution TEXT,
  parts_used TEXT DEFAULT '[]',
  labor_hours REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
`,
    'utf8',
  );

  const baseline = runWrangler(persistPath, ['--file', baselinePath]);
  assert.equal(baseline.status, 0, `${baseline.stdout}\n${baseline.stderr}`);

  const migration = runWrangler(persistPath, ['--file', fileURLToPath(migrationUrl)]);
  assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`);

  const fixtures = runWrangler(persistPath, [
    '--command',
    "INSERT INTO work_orders (id) VALUES ('work-a'), ('work-b'); INSERT INTO work_order_repair_records (id, work_order_id) VALUES ('repair-a', 'work-a'), ('repair-b', 'work-b');",
  ]);
  assert.equal(fixtures.status, 0, `${fixtures.stdout}\n${fixtures.stderr}`);

  const invalidCandidate = runWrangler(persistPath, [
    '--command',
    "INSERT INTO knowledge_candidates (id, market, source_type, raw_content) VALUES ('invalid-source', 'global', 'work_order', 'evidence');",
  ]);
  assert.notEqual(invalidCandidate.status, 0, 'D1 accepted a work-order candidate without source ids');
  assert.match(`${invalidCandidate.stdout}\n${invalidCandidate.stderr}`, /knowledge_candidate_source_mismatch/i);

  const mismatchedCandidate = runWrangler(persistPath, [
    '--command',
    "INSERT INTO knowledge_candidates (id, market, source_type, source_work_order_id, source_repair_record_id, raw_content) VALUES ('mismatch', 'global', 'work_order', 'work-a', 'repair-b', 'evidence');",
  ]);
  assert.notEqual(mismatchedCandidate.status, 0, 'D1 accepted mismatched work-order and repair-record sources');
  assert.match(`${mismatchedCandidate.stdout}\n${mismatchedCandidate.stderr}`, /knowledge_candidate_source_mismatch/i);

  const validCandidate = runWrangler(persistPath, [
    '--command',
    "INSERT INTO knowledge_candidates (id, market, source_type, source_work_order_id, source_repair_record_id, raw_content) VALUES ('valid-source', 'global', 'work_order', 'work-a', 'repair-a', 'evidence');",
  ]);
  assert.equal(validCandidate.status, 0, `${validCandidate.stdout}\n${validCandidate.stderr}`);

  const invalidCandidateUpdate = runWrangler(persistPath, [
    '--command',
    "UPDATE knowledge_candidates SET source_repair_record_id = 'repair-b' WHERE id = 'valid-source';",
  ]);
  assert.notEqual(invalidCandidateUpdate.status, 0, 'D1 accepted a candidate update to mismatched sources');
  assert.match(`${invalidCandidateUpdate.stdout}\n${invalidCandidateUpdate.stderr}`, /knowledge_candidate_source_mismatch/i);

  const clearUnreferencedRepair = runWrangler(persistPath, [
    '--command',
    "DELETE FROM work_order_repair_records WHERE id = 'repair-b';",
  ]);
  assert.equal(clearUnreferencedRepair.status, 0, `${clearUnreferencedRepair.stdout}\n${clearUnreferencedRepair.stderr}`);

  const invalidRepairRebind = runWrangler(persistPath, [
    '--command',
    "UPDATE work_order_repair_records SET work_order_id = 'work-b' WHERE id = 'repair-a';",
  ]);
  assert.notEqual(invalidRepairRebind.status, 0, 'D1 allowed a referenced repair record to move to another work order');
  assert.match(`${invalidRepairRebind.stdout}\n${invalidRepairRebind.stderr}`, /knowledge_candidate_source_mismatch/i);

  const actorCases = runWrangler(persistPath, [
    '--command',
    "INSERT INTO knowledge_candidate_events (id, candidate_id, actor_type, actor_user_id, action) VALUES ('human-empty', 'valid-source', 'admin', NULL, 'review');",
  ]);
  assert.notEqual(actorCases.status, 0, 'D1 accepted a human actor without an id');
  assert.match(`${actorCases.stdout}\n${actorCases.stderr}`, /CHECK constraint failed/i);

  const invalidSystemActor = runWrangler(persistPath, [
    '--command',
    "INSERT INTO knowledge_candidate_events (id, candidate_id, actor_type, actor_user_id, action) VALUES ('system-with-id', 'valid-source', 'system', 'unexpected', 'index');",
  ]);
  assert.notEqual(invalidSystemActor.status, 0, 'D1 accepted a system actor with a user id');
  assert.match(`${invalidSystemActor.stdout}\n${invalidSystemActor.stderr}`, /CHECK constraint failed/i);

  const validSystemActor = runWrangler(persistPath, [
    '--command',
    "INSERT INTO knowledge_candidate_events (id, candidate_id, actor_type, actor_user_id, action) VALUES ('system-empty', 'valid-source', 'system', NULL, 'index');",
  ]);
  assert.equal(validSystemActor.status, 0, `${validSystemActor.stdout}\n${validSystemActor.stderr}`);

  const indexQuery = runWrangler(persistPath, [
    '--command',
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_knowledge_candidate_events_candidate_created';",
  ]);
  assert.equal(indexQuery.status, 0, `${indexQuery.stdout}\n${indexQuery.stderr}`);
  assert.match(indexQuery.stdout, /idx_knowledge_candidate_events_candidate_created/i);
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function completeRepairRecord(overrides = {}) {
  return {
    work_order_id: 'work-report-1',
    symptom: 'The cutting head intermittently loses capacitive height sensing.',
    inspection_process: 'Checked grounding, nozzle alignment, ceramic ring, and sensor calibration.',
    diagnosis: 'The ceramic ring was cracked and caused an unstable sensing signal.',
    solution: 'Replaced the ceramic ring, aligned the nozzle, and recalibrated the height sensor.',
    verification_result: 'Completed ten pierces and cuts without another height-sensing alarm.',
    follow_up_advice: 'Recheck nozzle alignment and sensor calibration after the next 100 operating hours.',
    parts_used: '[]',
    labor_hours: 1.5,
    report_quality_status: 'draft',
    submitted_at: null,
    ...overrides,
  };
}

function createRepairRecordEnv({
  repairRecord = completeRepairRecord(),
  workOrderStatus = 'in_service',
  beforeSaveRun,
  beforeBatch,
} = {}) {
  const state = {
    workOrder: {
      id: 'work-report-1',
      order_no: 'WO-REPORT-1',
      customer_id: 'customer-1',
      engineer_id: 'engineer-1',
      status: workOrderStatus,
    },
    repairRecord: { ...repairRecord },
    statements: [],
    batchResults: null,
  };

  function createStatement(sql) {
    const statement = {
      sql: normalizeSql(sql),
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async first() {
        if (/SELECT status, engineer_id FROM work_orders WHERE id = \?/i.test(this.sql)) {
          return { status: state.workOrder.status, engineer_id: state.workOrder.engineer_id };
        }
        if (/FROM work_order_repair_records WHERE work_order_id = \?/i.test(this.sql)) {
          return state.repairRecord ? { ...state.repairRecord } : null;
        }
        if (/SELECT customer_id, order_no FROM work_orders WHERE id = \?/i.test(this.sql)) {
          return { customer_id: state.workOrder.customer_id, order_no: state.workOrder.order_no };
        }
        if (/SELECT onesignal_player_id FROM customers WHERE id = \?/i.test(this.sql)) {
          return null;
        }
        return null;
      },
      async run() {
        state.statements.push(this);
        if (/INSERT INTO work_order_repair_records/i.test(this.sql)) {
          beforeSaveRun?.(state);
          const [
            id,
            workOrderId,
            symptom,
            inspectionProcess,
            diagnosis,
            solution,
            verificationResult,
            followUpAdvice,
            partsUsed,
            laborHours,
            insertWorkOrderId,
            insertEngineerId,
            updateWorkOrderId,
            updateEngineerId,
          ] = this.args;
          const allowed = (
            state.workOrder.id === workOrderId
            && insertWorkOrderId === workOrderId
            && updateWorkOrderId === workOrderId
            && state.workOrder.engineer_id === insertEngineerId
            && state.workOrder.engineer_id === updateEngineerId
            && ['in_service', 'pricing'].includes(state.workOrder.status)
          );
          if (!allowed) return { success: true, meta: { changes: 0 } };
          state.repairRecord = {
            id,
            work_order_id: workOrderId,
            symptom,
            inspection_process: inspectionProcess,
            diagnosis,
            solution,
            verification_result: verificationResult,
            follow_up_advice: followUpAdvice,
            parts_used: partsUsed,
            labor_hours: laborHours,
            report_quality_status: 'draft',
            submitted_at: null,
          };
          return { success: true, meta: { changes: 1 } };
        }
        if (/UPDATE work_order_repair_records SET report_quality_status = 'submitted'/i.test(this.sql)) {
          const [
            repairWorkOrderId,
            expectedWorkOrderId,
            engineerId,
            symptom,
            inspectionProcess,
            diagnosis,
            solution,
            verificationResult,
            followUpAdvice,
            partsUsed,
            laborHours,
            qualityStatus,
          ] = this.args;
          const allowed = (
            state.repairRecord?.work_order_id === repairWorkOrderId
            && state.workOrder.id === expectedWorkOrderId
            && state.workOrder.engineer_id === engineerId
            && ['in_service', 'pricing'].includes(state.workOrder.status)
            && state.repairRecord.symptom === symptom
            && state.repairRecord.inspection_process === inspectionProcess
            && state.repairRecord.diagnosis === diagnosis
            && state.repairRecord.solution === solution
            && state.repairRecord.verification_result === verificationResult
            && state.repairRecord.follow_up_advice === followUpAdvice
            && state.repairRecord.parts_used === partsUsed
            && state.repairRecord.labor_hours === laborHours
            && state.repairRecord.report_quality_status === qualityStatus
          );
          if (!allowed) return { success: true, meta: { changes: 0 } };
          state.repairRecord.report_quality_status = 'submitted';
          state.repairRecord.submitted_at = '2026-08-13T00:00:00Z';
        }
        if (/UPDATE work_orders SET status = 'resolved'/i.test(this.sql)) {
          const [workOrderId, engineerId, reportWorkOrderId] = this.args;
          const allowed = (
            state.workOrder.id === workOrderId
            && state.workOrder.engineer_id === engineerId
            && ['in_service', 'pricing'].includes(state.workOrder.status)
            && state.repairRecord?.work_order_id === reportWorkOrderId
            && reportWorkOrderId === workOrderId
            && state.repairRecord.report_quality_status === 'submitted'
          );
          if (!allowed) return { success: true, meta: { changes: 0 } };
          state.workOrder.status = 'resolved';
        }
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }

  const env = {
    JWT_SECRET: 'repair-record-test-secret-with-enough-length',
    KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
    DB: {
      prepare: createStatement,
      async batch(statements) {
        beforeBatch?.(state);
        state.batchResults = [];
        for (const statement of statements) {
          state.batchResults.push(await statement.run());
        }
        return state.batchResults;
      },
    },
  };

  return { env, state };
}

async function engineerRequest(env, path, body = {}) {
  const token = await signJwt({
    userId: 'engineer-1',
    userType: 'engineer',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
  const response = await worker.fetch(new Request(`https://api.sagemro.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: 'https://sagemro.com',
    },
    body: JSON.stringify(body),
  }), env, { waitUntil() {} });
  return { response, json: await response.json() };
}

test('saving a repair record persists evidence fields as a draft without a submitted timestamp', async () => {
  const { env, state } = createRepairRecordEnv();
  const payload = completeRepairRecord();

  const result = await engineerRequest(env, '/api/workorders/work-report-1/repair-record', payload);

  assert.equal(result.response.status, 200);
  const saved = state.statements.find((statement) => /INSERT INTO work_order_repair_records/i.test(statement.sql));
  assert.ok(saved, 'repair record INSERT/UPSERT was not executed');
  assert.match(saved.sql, /inspection_process/);
  assert.match(saved.sql, /verification_result/);
  assert.match(saved.sql, /follow_up_advice/);
  assert.match(saved.sql, /report_quality_status/);
  assert.match(saved.sql, /submitted_at = NULL/i);
  assert.match(saved.sql, /'draft'/i);
  assert.ok(saved.args.includes(payload.inspection_process));
  assert.ok(saved.args.includes(payload.verification_result));
  assert.ok(saved.args.includes(payload.follow_up_advice));
});

test('saving a repair record is rejected after the work order is resolved', async () => {
  const { env, state } = createRepairRecordEnv({ workOrderStatus: 'resolved' });

  const result = await engineerRequest(
    env,
    '/api/workorders/work-report-1/repair-record',
    completeRepairRecord(),
  );

  assert.equal(result.response.status, 400);
  assert.equal(result.json.error, 'This work order cannot be edited in its current status');
  assert.equal(
    state.statements.some((statement) => /INSERT INTO work_order_repair_records/i.test(statement.sql)),
    false,
  );
  assert.equal(state.repairRecord.report_quality_status, 'draft');
});

test('conditional save does not overwrite the report when work-order status changes after the initial read', async () => {
  const original = completeRepairRecord({ report_quality_status: 'submitted' });
  const { env, state } = createRepairRecordEnv({
    repairRecord: original,
    beforeSaveRun(current) {
      current.workOrder.status = 'resolved';
    },
  });

  const result = await engineerRequest(
    env,
    '/api/workorders/work-report-1/repair-record',
    completeRepairRecord({ symptom: 'A concurrently stale edit must not be saved.' }),
  );

  assert.equal(result.response.status, 400);
  assert.equal(result.json.error, 'This work order cannot be edited in its current status');
  assert.equal(state.workOrder.status, 'resolved');
  assert.equal(state.repairRecord.symptom, original.symptom);
  assert.equal(state.repairRecord.report_quality_status, 'submitted');
});

test('resolve rejects a partially filled service report with stable field codes', async () => {
  const { env, state } = createRepairRecordEnv({
    repairRecord: completeRepairRecord({
      inspection_process: '',
      diagnosis: 'short diagnosis',
      solution: null,
      verification_result: '',
    }),
  });

  const result = await engineerRequest(env, '/api/workorders/work-report-1/resolve');

  assert.equal(result.response.status, 400);
  assert.deepEqual(result.json, {
    error: 'service_report_incomplete',
    fields: [
      { field: 'inspection_process', code: 'required' },
      { field: 'diagnosis', code: 'too_short' },
      { field: 'solution', code: 'required' },
      { field: 'verification_result', code: 'required' },
    ],
  });
  assert.equal(state.workOrder.status, 'in_service');
  assert.equal(state.repairRecord.report_quality_status, 'draft');
});

test('resolve submits a complete report and resolves the work order', async () => {
  const { env, state } = createRepairRecordEnv();

  const result = await engineerRequest(env, '/api/workorders/work-report-1/resolve');

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.json, { success: true });
  assert.equal(state.repairRecord.report_quality_status, 'submitted');
  assert.ok(state.repairRecord.submitted_at);
  assert.equal(state.workOrder.status, 'resolved');
  const reportFinalization = state.statements.find((statement) => (
    /UPDATE work_order_repair_records SET report_quality_status = 'submitted'/i.test(statement.sql)
  ));
  assert.match(reportFinalization.sql, /EXISTS \( SELECT 1 FROM work_orders/i);
  assert.match(reportFinalization.sql, /engineer_id = \?/i);
  assert.match(reportFinalization.sql, /status IN \('in_service', 'pricing'\)/i);
  const workOrderFinalization = state.statements.find((statement) => (
    /UPDATE work_orders SET status = 'resolved'/i.test(statement.sql)
  ));
  assert.match(workOrderFinalization.sql, /EXISTS \( SELECT 1 FROM work_order_repair_records/i);
  assert.match(workOrderFinalization.sql, /report_quality_status = 'submitted'/i);
});

test('resolve leaves the work order unchanged when the report disappears before finalization', async () => {
  const { env, state } = createRepairRecordEnv({
    beforeBatch(current) {
      current.repairRecord = null;
    },
  });

  const result = await engineerRequest(env, '/api/workorders/work-report-1/resolve');

  assert.equal(result.response.status, 500);
  assert.notEqual(result.json.success, true);
  assert.deepEqual(state.batchResults.map((item) => item.meta.changes), [0, 0]);
  assert.equal(state.workOrder.status, 'in_service');
  assert.equal(state.repairRecord, null);
});

test('resolve does not submit the report when work-order status changes before finalization', async () => {
  const { env, state } = createRepairRecordEnv({
    beforeBatch(current) {
      current.workOrder.status = 'completed';
    },
  });

  const result = await engineerRequest(env, '/api/workorders/work-report-1/resolve');

  assert.equal(result.response.status, 500);
  assert.notEqual(result.json.success, true);
  assert.deepEqual(state.batchResults.map((item) => item.meta.changes), [0, 0]);
  assert.equal(state.workOrder.status, 'completed');
  assert.equal(state.repairRecord.report_quality_status, 'draft');
});

test('resolve does not finalize a report changed after quality validation', async () => {
  const { env, state } = createRepairRecordEnv({
    beforeBatch(current) {
      current.repairRecord.symptom = '';
      current.repairRecord.report_quality_status = 'draft';
    },
  });

  const result = await engineerRequest(env, '/api/workorders/work-report-1/resolve');

  assert.equal(result.response.status, 500);
  assert.notEqual(result.json.success, true);
  assert.deepEqual(state.batchResults.map((item) => item.meta.changes), [0, 0]);
  assert.equal(state.workOrder.status, 'in_service');
  assert.equal(state.repairRecord.symptom, '');
  assert.equal(state.repairRecord.report_quality_status, 'draft');
});

test('D1 sequentially executing the finalization predicates keeps both states consistent', () => {
  const persistPath = mkdtempSync(join(tmpdir(), 'sagemro-report-finalize-'));
  const setupPath = join(persistPath, 'setup.sql');
  writeFileSync(setupPath, `
CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  engineer_id TEXT,
  status TEXT,
  resolved_at TEXT
);
CREATE TABLE work_order_repair_records (
  work_order_id TEXT PRIMARY KEY,
  report_quality_status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TEXT,
  updated_at TEXT
);
INSERT INTO work_orders (id, engineer_id, status) VALUES
  ('normal', 'engineer-1', 'in_service'),
  ('missing-report', 'engineer-1', 'in_service'),
  ('status-changed', 'engineer-1', 'completed');
INSERT INTO work_order_repair_records (work_order_id, report_quality_status) VALUES
  ('normal', 'draft'),
  ('status-changed', 'draft');
`, 'utf8');
  const setup = runWrangler(persistPath, ['--file', setupPath]);
  assert.equal(setup.status, 0, `${setup.stdout}\n${setup.stderr}`);

  function finalize(workOrderId) {
    return runWrangler(persistPath, ['--command', `
UPDATE work_order_repair_records
SET report_quality_status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
WHERE work_order_id = '${workOrderId}'
  AND EXISTS (
    SELECT 1 FROM work_orders
    WHERE id = '${workOrderId}' AND engineer_id = 'engineer-1' AND status IN ('in_service', 'pricing')
  );
UPDATE work_orders
SET status = 'resolved', resolved_at = datetime('now')
WHERE id = '${workOrderId}' AND engineer_id = 'engineer-1' AND status IN ('in_service', 'pricing')
  AND EXISTS (
    SELECT 1 FROM work_order_repair_records
    WHERE work_order_id = '${workOrderId}' AND report_quality_status = 'submitted'
  );
`]);
  }

  for (const id of ['normal', 'missing-report', 'status-changed']) {
    const result = finalize(id);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }

  const state = runWrangler(persistPath, ['--command', `
SELECT w.id, w.status, COALESCE(r.report_quality_status, 'missing') AS report_status
FROM work_orders w
LEFT JOIN work_order_repair_records r ON r.work_order_id = w.id
ORDER BY w.id;
`]);
  assert.equal(state.status, 0, `${state.stdout}\n${state.stderr}`);
  assert.match(state.stdout, /missing-report[\s\S]*in_service[\s\S]*missing/i);
  assert.match(state.stdout, /normal[\s\S]*resolved[\s\S]*submitted/i);
  assert.match(state.stdout, /status-changed[\s\S]*completed[\s\S]*draft/i);
});

test('D1 enforces conditional save and stale report snapshot predicates', () => {
  const persistPath = mkdtempSync(join(tmpdir(), 'sagemro-report-locks-'));
  const setupPath = join(persistPath, 'setup.sql');
  writeFileSync(setupPath, `
CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  engineer_id TEXT,
  status TEXT,
  resolved_at TEXT
);
CREATE TABLE work_order_repair_records (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL UNIQUE,
  symptom TEXT,
  inspection_process TEXT,
  diagnosis TEXT,
  solution TEXT,
  verification_result TEXT,
  follow_up_advice TEXT,
  parts_used TEXT,
  labor_hours REAL,
  report_quality_status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TEXT,
  updated_at TEXT
);
INSERT INTO work_orders (id, engineer_id, status) VALUES
  ('save-locked', 'engineer-1', 'resolved'),
  ('snapshot-stale', 'engineer-1', 'in_service');
INSERT INTO work_order_repair_records (
  id, work_order_id, symptom, inspection_process, diagnosis, solution,
  verification_result, follow_up_advice, parts_used, labor_hours, report_quality_status
) VALUES
  ('repair-save', 'save-locked', 'Original symptom', 'Original inspection', 'Original diagnosis detail', 'Original solution detail', 'Original verification', 'Original advice', '[]', 1, 'submitted'),
  ('repair-stale', 'snapshot-stale', 'Changed symptom', 'Inspection detail', 'Diagnosis detail long enough', 'Solution detail long enough', 'Verification detail', 'Follow-up advice', '[]', 2, 'draft');
`, 'utf8');
  const setup = runWrangler(persistPath, ['--file', setupPath]);
  assert.equal(setup.status, 0, `${setup.stdout}\n${setup.stderr}`);

  const conditionalSave = runWrangler(persistPath, ['--command', `
INSERT INTO work_order_repair_records (
  id, work_order_id, symptom, inspection_process, diagnosis, solution,
  verification_result, follow_up_advice, parts_used, labor_hours,
  report_quality_status, submitted_at, updated_at
)
SELECT 'replacement', 'save-locked', 'Stale edit', 'Inspection', 'Diagnosis detail long enough',
       'Solution detail long enough', 'Verification', 'Advice', '[]', 3,
       'draft', NULL, datetime('now')
WHERE EXISTS (
  SELECT 1 FROM work_orders
  WHERE id = 'save-locked' AND engineer_id = 'engineer-1' AND status IN ('in_service', 'pricing')
)
ON CONFLICT(work_order_id) DO UPDATE SET
  symptom = excluded.symptom,
  report_quality_status = 'draft',
  submitted_at = NULL,
  updated_at = datetime('now')
WHERE EXISTS (
  SELECT 1 FROM work_orders
  WHERE id = 'save-locked' AND engineer_id = 'engineer-1' AND status IN ('in_service', 'pricing')
);
`]);
  assert.equal(conditionalSave.status, 0, `${conditionalSave.stdout}\n${conditionalSave.stderr}`);

  const staleFinalize = runWrangler(persistPath, ['--command', `
UPDATE work_order_repair_records
SET report_quality_status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
WHERE work_order_id = 'snapshot-stale'
  AND EXISTS (
    SELECT 1 FROM work_orders
    WHERE id = 'snapshot-stale' AND engineer_id = 'engineer-1' AND status IN ('in_service', 'pricing')
  )
  AND symptom IS 'Old validated symptom'
  AND inspection_process IS 'Inspection detail'
  AND diagnosis IS 'Diagnosis detail long enough'
  AND solution IS 'Solution detail long enough'
  AND verification_result IS 'Verification detail'
  AND follow_up_advice IS 'Follow-up advice'
  AND parts_used IS '[]'
  AND labor_hours IS 2
  AND report_quality_status IS 'draft';
UPDATE work_orders
SET status = 'resolved', resolved_at = datetime('now')
WHERE id = 'snapshot-stale' AND engineer_id = 'engineer-1' AND status IN ('in_service', 'pricing')
  AND EXISTS (
    SELECT 1 FROM work_order_repair_records
    WHERE work_order_id = 'snapshot-stale' AND report_quality_status = 'submitted'
  );
`]);
  assert.equal(staleFinalize.status, 0, `${staleFinalize.stdout}\n${staleFinalize.stderr}`);

  const state = runWrangler(persistPath, ['--command', `
SELECT w.id, w.status, r.symptom, r.report_quality_status
FROM work_orders w
JOIN work_order_repair_records r ON r.work_order_id = w.id
ORDER BY w.id;
`]);
  assert.equal(state.status, 0, `${state.stdout}\n${state.stderr}`);
  assert.match(state.stdout, /save-locked[\s\S]*resolved[\s\S]*Original symptom[\s\S]*submitted/i);
  assert.match(state.stdout, /snapshot-stale[\s\S]*in_service[\s\S]*Changed symptom[\s\S]*draft/i);
});
