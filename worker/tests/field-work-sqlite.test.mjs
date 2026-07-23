import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const migrationSql = readFileSync(new URL('../migrations/039_field_workdays.sql', import.meta.url), 'utf8');
const cleanupMigrationSql = readFileSync(new URL('../migrations/040_field_evidence_cleanup_queue.sql', import.meta.url), 'utf8');
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

const preMigrationSql = `
  CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
  CREATE TABLE engineers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    engineer_id TEXT,
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
  );
  CREATE TABLE work_order_arrival_checks (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy_m REAL,
    coordinate_system TEXT NOT NULL DEFAULT 'wgs84',
    location_source TEXT NOT NULL DEFAULT 'browser',
    distance_m REAL,
    radius_m REAL,
    within_geofence INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
  );
`;

const principalsSql = `
  INSERT INTO engineers (id, user_no, name, phone, password_hash)
  VALUES ('eng-1', 'E000001', 'Engineer', '13800000000', 'hash');
  INSERT INTO work_orders (id, order_no, type, description, engineer_id)
  VALUES
    ('wo-1', 'WO-1', 'maintenance', 'First order', 'eng-1'),
    ('wo-2', 'WO-2', 'maintenance', 'Second order', 'eng-1');
`;

const legacyArrivalSql = `
  INSERT INTO work_order_arrival_checks (
    id, work_order_id, engineer_id, latitude, longitude, accuracy_m,
    coordinate_system, location_source, distance_m, radius_m,
    within_geofence, failure_reason, created_at
  ) VALUES (
    'arrival-legacy', 'wo-1', 'eng-1', 31.2304, 121.4737, 15,
    'wgs84', 'browser', 12, 100, 1, NULL, '2026-07-23 08:00:00'
  );
`;

const fieldDaySql = `
  INSERT INTO work_order_field_days (
    id, work_order_id, engineer_id, site_local_date, site_timezone
  ) VALUES ('day-1', 'wo-1', 'eng-1', '2026-07-23', 'Asia/Shanghai');
`;

const fieldPlanUpdateSql = `
  UPDATE work_orders SET site_timezone = 'Asia/Shanghai', expected_service_days = 3,
    expected_completion_date = '2026-07-26', planned_daily_start_time = '08:30',
    planned_daily_end_time = '17:30', updated_at = datetime('now')
  WHERE id = 'wo-1';
  SELECT site_timezone, expected_service_days, expected_completion_date,
    planned_daily_start_time, planned_daily_end_time, length(updated_at) > 0
  FROM work_orders WHERE id = 'wo-1';
`;

function runSql(databasePath, sql) {
  return spawnSync('sqlite3', ['-batch', databasePath], {
    encoding: 'utf8',
    input: `.bail on\nPRAGMA foreign_keys = ON;\n${sql}`,
  });
}

async function createDatabase(t, setupSql, seedSql) {
  const directory = await mkdtemp(join(tmpdir(), 'sagemro-field-work-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const databasePath = join(directory, 'test.sqlite');
  execFileSync('sqlite3', ['-batch', databasePath], {
    encoding: 'utf8',
    input: `.bail on\nPRAGMA foreign_keys = ON;\n${setupSql}\n${seedSql}`,
  });
  return databasePath;
}

function assertForeignKeyFailure(result) {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /foreign key constraint failed/i);
}

const crossOrderWrites = [
  ['media', `
    INSERT INTO work_order_field_day_media (
      id, work_order_id, field_day_id, purpose, object_key, mime_type,
      file_size, uploader_type, uploader_id, capture_source
    ) VALUES (
      'media-cross', 'wo-2', 'day-1', 'progress', 'media/cross.jpg', 'image/jpeg',
      100, 'engineer', 'eng-1', 'camera'
    );
  `],
  ['extension', `
    INSERT INTO work_order_extension_requests (
      id, work_order_id, field_day_id, engineer_id, reason, customer_explanation,
      requested_additional_days, proposed_completion_date, status, original_plan
    ) VALUES (
      'extension-cross', 'wo-2', 'day-1', 'eng-1', 'More work', 'One more day',
      1, '2026-07-25', 'rejected', '{}'
    );
  `],
  ['revision', `
    INSERT INTO work_order_field_day_revisions (
      id, work_order_id, field_day_id, previous_report, changed_by_type,
      changed_by_id, reason
    ) VALUES (
      'revision-cross', 'wo-2', 'day-1', '{}', 'engineer', 'eng-1', 'Correction'
    );
  `],
];

for (const [label, setupSql, seedSql] of [
  ['migration 039', `${preMigrationSql}\n${principalsSql}\n${legacyArrivalSql}\n${migrationSql}`, fieldDaySql],
  ['schema snapshot', schemaSql, `${principalsSql}\n${fieldDaySql}`],
]) {
  test(`${label} keeps field-day evidence on the same work order`, async (t) => {
    const databasePath = await createDatabase(t, setupSql, seedSql);

    const fieldPlanUpdate = runSql(databasePath, fieldPlanUpdateSql);
    assert.equal(fieldPlanUpdate.status, 0, fieldPlanUpdate.stderr);
    assert.equal(fieldPlanUpdate.stdout.trim(), 'Asia/Shanghai|3|2026-07-26|08:30|17:30|1');

    if (label === 'migration 039') {
      const arrival = runSql(databasePath, `
        SELECT id, work_order_id, engineer_id, latitude, longitude, accuracy_m,
          coordinate_system, location_source, distance_m, radius_m,
          within_geofence, ifnull(failure_reason, ''), created_at
        FROM work_order_arrival_checks
        WHERE id = 'arrival-legacy';
      `);
      assert.equal(arrival.status, 0, arrival.stderr);
      assert.equal(
        arrival.stdout.trim(),
        'arrival-legacy|wo-1|eng-1|31.2304|121.4737|15.0|wgs84|browser|12.0|100.0|1||2026-07-23 08:00:00',
      );
    }

    const sameOrder = runSql(databasePath, `
      INSERT INTO work_order_field_day_media (
        id, work_order_id, field_day_id, purpose, object_key, mime_type,
        file_size, uploader_type, uploader_id, capture_source
      ) VALUES (
        'media-same', 'wo-1', 'day-1', 'progress', 'media/same.jpg', 'image/jpeg',
        100, 'engineer', 'eng-1', 'camera'
      );
      INSERT INTO work_order_extension_requests (
        id, work_order_id, field_day_id, engineer_id, reason, customer_explanation,
        requested_additional_days, proposed_completion_date, original_plan
      ) VALUES (
        'extension-same', 'wo-1', 'day-1', 'eng-1', 'More work', 'One more day',
        1, '2026-07-24', '{}'
      );
      INSERT INTO work_order_field_day_revisions (
        id, work_order_id, field_day_id, previous_report, changed_by_type,
        changed_by_id, reason
      ) VALUES (
        'revision-same', 'wo-1', 'day-1', '{}', 'engineer', 'eng-1', 'Correction'
      );
      INSERT INTO work_order_extension_requests (
        id, work_order_id, field_day_id, engineer_id, reason, customer_explanation,
        requested_additional_days, proposed_completion_date, status, original_plan
      ) VALUES (
        'extension-null', 'wo-2', NULL, 'eng-1', 'Plan update', 'One more day',
        1, '2026-07-25', 'approved', '{}'
      );
    `);
    assert.equal(sameOrder.status, 0, sameOrder.stderr);

    const retentionColumns = runSql(databasePath, `
      SELECT group_concat(name, '|')
      FROM pragma_table_info('work_order_field_day_media')
      WHERE name IN ('retention_claim_token', 'retention_claimed_at');
    `);
    assert.equal(retentionColumns.status, 0, retentionColumns.stderr);
    assert.equal(retentionColumns.stdout.trim(), 'retention_claim_token|retention_claimed_at');

    const invalidHoldCategory = runSql(databasePath, `
      INSERT INTO work_order_field_evidence_holds (
        id, work_order_id, reason_category, reason, opened_by
      ) VALUES ('hold-invalid', 'wo-1', 'other', 'Unsupported category', 'eng-1');
    `);
    assert.notEqual(invalidHoldCategory.status, 0);
    assert.match(invalidHoldCategory.stderr, /check constraint failed/i);

    for (const [childTable, sql] of crossOrderWrites) {
      await t.test(`rejects cross-order ${childTable} links`, () => {
        assertForeignKeyFailure(runSql(databasePath, sql));
      });
    }
  });
}

test('retention claims and evidence holds are mutually exclusive in SQLite', async (t) => {
  const databasePath = await createDatabase(t, schemaSql, `${principalsSql}\n${fieldDaySql}`);
  const seed = runSql(databasePath, `
    INSERT INTO work_order_field_day_media (
      id, work_order_id, field_day_id, purpose, object_key, mime_type,
      file_size, uploader_type, uploader_id, capture_source
    ) VALUES ('media-1', 'wo-1', 'day-1', 'check_in', 'media/1.jpg', 'image/jpeg', 100, 'engineer', 'eng-1', 'camera');
  `);
  assert.equal(seed.status, 0, seed.stderr);

  const claimFirst = runSql(databasePath, `
    UPDATE work_order_field_day_media
    SET retention_claim_token = 'claim-1', retention_claimed_at = '2026-07-24T00:00:00Z'
    WHERE id = 'media-1' AND retention_claim_token IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM work_order_field_evidence_holds h
        WHERE h.work_order_id = work_order_field_day_media.work_order_id AND h.status = 'open'
      );
    INSERT INTO work_order_field_evidence_holds (id, work_order_id, reason_category, reason, opened_by)
    SELECT 'hold-blocked', 'wo-1', 'complaint', 'Review', 'admin-1'
    WHERE NOT EXISTS (
      SELECT 1 FROM work_order_field_day_media
      WHERE work_order_id = 'wo-1' AND deleted_at IS NULL AND retention_claim_token IS NOT NULL
    );
    SELECT changes();
  `);
  assert.equal(claimFirst.status, 0, claimFirst.stderr);
  assert.equal(claimFirst.stdout.trim(), '0');

  const holdFirst = runSql(databasePath, `
    UPDATE work_order_field_day_media SET retention_claim_token = NULL, retention_claimed_at = NULL WHERE id = 'media-1';
    INSERT INTO work_order_field_evidence_holds (id, work_order_id, reason_category, reason, opened_by)
    VALUES ('hold-1', 'wo-1', 'legal_hold', 'Legal review', 'admin-1');
    UPDATE work_order_field_day_media
    SET retention_claim_token = 'claim-blocked', retention_claimed_at = '2026-07-24T00:00:00Z'
    WHERE id = 'media-1' AND retention_claim_token IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM work_order_field_evidence_holds h
        WHERE h.work_order_id = work_order_field_day_media.work_order_id AND h.status = 'open'
      );
    SELECT changes();
  `);
  assert.equal(holdFirst.status, 0, holdFirst.stderr);
  assert.equal(holdFirst.stdout.trim(), '0');
});

test('migration 040 adds a durable cleanup queue for failed R2 rollbacks', async (t) => {
  const databasePath = await createDatabase(t, `${preMigrationSql}\n${principalsSql}\n${legacyArrivalSql}\n${migrationSql}\n${cleanupMigrationSql}`, '');
  const result = runSql(databasePath, `
    INSERT INTO field_evidence_cleanup_queue (object_key, failure_reason)
    VALUES ('field-evidence/com/wo-1/orphan.jpg', 'check_in_persistence_failed');
    SELECT object_key, failure_reason FROM field_evidence_cleanup_queue;
    SELECT COUNT(*) FROM _migrations WHERE version = '040_field_evidence_cleanup_queue';
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'field-evidence/com/wo-1/orphan.jpg|check_in_persistence_failed\n1');
});
