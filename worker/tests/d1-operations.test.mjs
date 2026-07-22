import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  D1_TARGETS,
  buildD1Args,
  buildLocalDrillConfig,
  buildRestoreDrillPlan,
  buildSchemaProbe,
  parseCliArgs,
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
