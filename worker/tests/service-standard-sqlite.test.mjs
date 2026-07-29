import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migrationUrl = new URL('../migrations/044_service_standard_progress.sql', import.meta.url);
const migrationSql = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8') : '';

test('schema stores item progress and one active override per work order gate', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schemaSql);
  const columns = sqlite.prepare(
    "SELECT name FROM pragma_table_info('work_order_service_standard_progress') ORDER BY cid",
  ).all().map((row) => row.name);
  assert.deepEqual(columns, [
    'work_order_id', 'standard_version', 'step_key', 'item_key', 'state',
    'is_required', 'owner_type', 'confirmed_by_type', 'confirmed_by_id',
    'confirmed_at', 'evidence_type', 'evidence_id', 'not_applicable_reason',
    'created_at', 'updated_at',
  ]);
});

test('migration backfills legacy progress and enforces progress and override persistence', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
    CREATE TABLE work_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL
    );
    INSERT INTO work_orders (id, order_no, type, description, status) VALUES
      ('wo-in-service', 'WO-001', 'maintenance', 'In service', 'in_service'),
      ('wo-completed', 'WO-002', 'maintenance', 'Completed', 'completed');
  `);
  sqlite.exec(migrationSql);

  const rowsFor = (workOrderId) => sqlite.prepare(`
    SELECT item_key, state
    FROM work_order_service_standard_progress
    WHERE work_order_id = ?
    ORDER BY item_key
  `).all(workOrderId);
  const inServiceRows = rowsFor('wo-in-service');
  const completedRows = rowsFor('wo-completed');

  assert.equal(inServiceRows.length, 18);
  assert.equal(inServiceRows.filter((row) => row.state === 'legacy_not_recorded').length, 12);
  assert.equal(completedRows.every((row) => row.state === 'legacy_not_recorded'), true);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM _migrations WHERE version = '044_service_standard_progress'").get().count,
    1,
  );

  assert.throws(() => sqlite.prepare(`
    INSERT INTO work_order_service_standard_progress (
      work_order_id, standard_version, step_key, item_key, state, is_required, owner_type
    ) VALUES ('wo-in-service', 1, 'task_alignment', 'invalid.state', 'invalid', 1, 'engineer')
  `).run(), /CHECK constraint failed/);

  const insertSecondActiveStartOverride = () => sqlite.prepare(`
    INSERT INTO work_order_service_gate_overrides (id, work_order_id, gate_key, reason, overridden_by)
    VALUES ('override-2', 'wo-completed', 'start', 'Second active exception', 'admin-2')
  `).run();
  sqlite.prepare(`
    INSERT INTO work_order_service_gate_overrides (id, work_order_id, gate_key, reason, overridden_by)
    VALUES ('override-1', 'wo-completed', 'start', 'First active exception', 'admin-1')
  `).run();
  assert.throws(() => insertSecondActiveStartOverride(), /UNIQUE constraint failed/);
  sqlite.prepare("UPDATE work_order_service_gate_overrides SET revoked_at = datetime('now') WHERE id = 'override-1'").run();
  insertSecondActiveStartOverride();

  sqlite.prepare("DELETE FROM work_orders WHERE id = 'wo-in-service'").run();
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM work_order_service_standard_progress WHERE work_order_id = 'wo-in-service'").get().count,
    0,
  );
});
