import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  D1_TARGETS,
  buildD1Args,
  buildLocalDrillConfig,
  buildRestoreDrillPlan,
  buildSchemaProbe,
  buildSchemaSnapshotPath,
  compareSchemaSnapshots,
  planBackupRetention,
  parseCliArgs,
  parseSchemaProbeResult,
  schemaMigrationVersions,
} from '../scripts/d1-operations.mjs';

test('D1 target map keeps international and China databases explicit', () => {
  assert.deepEqual(D1_TARGETS, {
    com: { database: 'sagemro-db', label: 'international' },
    cn: { database: 'sagemro-db-cn', label: 'china' },
  });
});

test('remote D1 operations require explicit production confirmation', () => {
  assert.throws(
    () => buildD1Args({ market: 'com', operation: 'backup', mode: 'remote', output: '/tmp/backup.sql' }),
    /confirm-production/,
  );
  assert.deepEqual(
    buildD1Args({ market: 'cn', operation: 'backup', mode: 'remote', output: '/tmp/cn.sql', confirmProduction: true }),
    ['wrangler', 'd1', 'export', 'sagemro-db-cn', '--env', 'production', '--remote', '--output', '/tmp/cn.sql'],
  );
});

test('local restore plans use separate source and restore state directories', () => {
  const plan = buildRestoreDrillPlan({ market: 'cn', workDir: '/tmp/sagemro-restore-test' });
  assert.equal(plan.backupFile, '/tmp/sagemro-restore-test/sagemro-db-cn-restore-drill.sql');
  assert.notEqual(plan.sourceState, plan.restoreState);
  assert.notEqual(plan.sourceConfig, plan.restoreConfig);
});

test('parallel restore drills receive unique work directories', () => {
  const com = buildRestoreDrillPlan({ market: 'com' });
  const cn = buildRestoreDrillPlan({ market: 'cn' });
  assert.notEqual(com.workDir, cn.workDir);
});

test('local restore configs isolate each D1 by database id', () => {
  const source = buildLocalDrillConfig({ market: 'com', databaseId: '11111111-1111-4111-8111-111111111111' });
  const restore = buildLocalDrillConfig({ market: 'com', databaseId: '22222222-2222-4222-8222-222222222222' });
  assert.match(source, /database_name = "sagemro-db"/);
  assert.match(source, /11111111-1111-4111-8111-111111111111/);
  assert.match(restore, /22222222-2222-4222-8222-222222222222/);
});

test('schema probe and migration markers are deterministic', () => {
  assert.match(buildSchemaProbe(), /sqlite_master/);
  assert.deepEqual(schemaMigrationVersions("INSERT OR IGNORE INTO _migrations (version, note) VALUES ('036_create_funnel_events', 'x'), ('037_engineer_account_activation', 'y');"), [
    '036_create_funnel_events',
    '037_engineer_account_activation',
  ]);
});

test('CLI parser resolves a production China backup without executing it', () => {
  assert.deepEqual(parseCliArgs(['backup', '--market', 'cn', '--mode', 'remote', '--output', '/tmp/cn.sql', '--confirm-production']), {
    operation: 'backup',
    market: 'cn',
    mode: 'remote',
    output: '/tmp/cn.sql',
    confirmProduction: true,
  });
});

test('schema probe results normalize D1 JSON and ignore internal SQLite objects', () => {
  const snapshot = parseSchemaProbeResult(JSON.stringify([{
    results: [
      { type: 'table', name: 'customers', sql: 'CREATE TABLE customers ( id TEXT PRIMARY KEY )' },
      { type: 'index', name: 'idx_customers_phone', sql: 'CREATE INDEX idx_customers_phone ON customers(phone)' },
      { type: 'table', name: 'sqlite_sequence', sql: 'CREATE TABLE sqlite_sequence(name,seq)' },
    ],
  }]));

  assert.deepEqual(snapshot, [
    { type: 'index', name: 'idx_customers_phone', sql: 'CREATE INDEX idx_customers_phone ON customers(phone)' },
    { type: 'table', name: 'customers', sql: 'CREATE TABLE customers ( id TEXT PRIMARY KEY )' },
  ]);
});

test('schema comparison reports missing and changed objects deterministically', () => {
  const left = [
    { type: 'table', name: 'customers', sql: 'CREATE TABLE customers(id TEXT)' },
    { type: 'index', name: 'idx_customers_phone', sql: 'CREATE INDEX idx_customers_phone ON customers(phone)' },
  ];
  const right = [
    { type: 'table', name: 'customers', sql: 'CREATE TABLE customers(id TEXT, email TEXT)' },
    { type: 'table', name: 'engineers', sql: 'CREATE TABLE engineers(id TEXT)' },
  ];

  assert.deepEqual(compareSchemaSnapshots(left, right), {
    identical: false,
    onlyLeft: ['index:idx_customers_phone'],
    onlyRight: ['table:engineers'],
    changed: ['table:customers'],
  });
});

test('schema snapshot paths separate COM and CN artifacts', () => {
  assert.equal(buildSchemaSnapshotPath({ market: 'com', directory: '/tmp/schema' }), '/tmp/schema/sagemro-db-schema.json');
  assert.equal(buildSchemaSnapshotPath({ market: 'cn', directory: '/tmp/schema' }), '/tmp/schema/sagemro-db-cn-schema.json');
});

test('backup retention keeps recent daily files and older weekly representatives', () => {
  const files = [];
  for (let day = 0; day < 50; day += 1) {
    const date = new Date(Date.UTC(2026, 6, 22 - day));
    files.push({
      path: `/backups/sagemro-db-${date.toISOString().slice(0, 10)}.sql`,
      modifiedAt: date,
    });
  }

  const plan = planBackupRetention(files, {
    now: new Date('2026-07-22T12:00:00Z'),
    dailyDays: 30,
    weeklyWeeks: 12,
  });

  assert.equal(plan.keep.length > 30, true);
  assert.equal(plan.remove.length > 0, true);
  assert.equal(plan.keep.some((file) => file.path.endsWith('2026-07-22.sql')), true);
  assert.equal(plan.remove.some((file) => file.path.endsWith('2026-07-22.sql')), false);
});

test('CLI parser requires an explicit flag before retention deletes files', () => {
  assert.deepEqual(parseCliArgs(['retention-check', '--directory', '/secure-backups']), {
    operation: 'retention-check',
    market: 'com',
    mode: 'local',
    confirmProduction: false,
    directory: '/secure-backups',
    applyRetention: false,
  });
  assert.deepEqual(parseCliArgs(['retention-check', '--directory', '/secure-backups', '--apply-retention']), {
    operation: 'retention-check',
    market: 'com',
    mode: 'local',
    confirmProduction: false,
    directory: '/secure-backups',
    applyRetention: true,
  });
});

test('CLI parser accepts an isolated Wrangler config for local CN operations', () => {
  assert.deepEqual(parseCliArgs([
    'schema-snapshot',
    '--market', 'cn',
    '--config', '/tmp/cn-wrangler.toml',
  ]), {
    operation: 'schema-snapshot',
    market: 'cn',
    mode: 'local',
    confirmProduction: false,
    config: '/tmp/cn-wrangler.toml',
  });
});

test('backup retention keeps only the newest representative for each recent day', () => {
  const plan = planBackupRetention([
    { path: '/backups/sagemro-db-2026-07-22T01.sql', modifiedAt: new Date('2026-07-22T01:00:00Z') },
    { path: '/backups/sagemro-db-2026-07-22T12.sql', modifiedAt: new Date('2026-07-22T12:00:00Z') },
    { path: '/backups/sagemro-db-2026-07-21.sql', modifiedAt: new Date('2026-07-21T12:00:00Z') },
  ], {
    now: new Date('2026-07-22T13:00:00Z'),
    dailyDays: 30,
    weeklyWeeks: 0,
  });

  assert.deepEqual(plan.keep.map((file) => file.path), [
    '/backups/sagemro-db-2026-07-22T12.sql',
    '/backups/sagemro-db-2026-07-21.sql',
  ]);
  assert.deepEqual(plan.remove.map((file) => file.path), [
    '/backups/sagemro-db-2026-07-22T01.sql',
  ]);
});

test('backup retention counts recent daily representatives by UTC calendar day', () => {
  const plan = planBackupRetention([
    { path: '/backups/sagemro-db-2026-07-22.sql', modifiedAt: new Date('2026-07-22T00:01:00Z') },
    { path: '/backups/sagemro-db-2026-07-21.sql', modifiedAt: new Date('2026-07-21T00:01:00Z') },
    { path: '/backups/sagemro-db-2026-07-20.sql', modifiedAt: new Date('2026-07-20T23:59:00Z') },
  ], {
    now: new Date('2026-07-22T23:59:00Z'),
    dailyDays: 2,
    weeklyWeeks: 0,
  });

  assert.deepEqual(plan.keep.map((file) => file.path), [
    '/backups/sagemro-db-2026-07-22.sql',
    '/backups/sagemro-db-2026-07-21.sql',
  ]);
  assert.deepEqual(plan.remove.map((file) => file.path), [
    '/backups/sagemro-db-2026-07-20.sql',
  ]);
});
