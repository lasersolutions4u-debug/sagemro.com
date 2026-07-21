import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const migrationPath = path.join(root, 'worker/migrations/037_engineer_account_activation.sql');
const preflightPath = path.join(root, 'worker/migrations/data_fixes/account_identity_preflight.sql');
const schemaPath = path.join(root, 'worker/schema.sql');
const funnelMigrationPath = path.join(root, 'worker/migrations/036_create_funnel_events.sql');

test('activation migration adds engineer email, shared identities, and activation records', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  assert.match(sql, /ALTER TABLE engineers ADD COLUMN email TEXT/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_identities/);
  assert.match(sql, /PRIMARY KEY\s*\(identity_type, normalized_value\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS engineer_account_activations/);
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(sql, /expires_at TEXT NOT NULL/);
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_activations_one_open[\s\S]*WHERE used_at IS NULL AND revoked_at IS NULL/,
  );
  assert.equal((sql.match(/INSERT INTO account_identities/g) || []).length, 3);
  assert.match(sql, /SELECT 'email',[\s\S]*'customer', id[\s\S]*FROM customers/);
  assert.match(sql, /SELECT 'phone',[\s\S]*'customer', id[\s\S]*FROM customers/);
  assert.match(sql, /SELECT 'phone',[\s\S]*'engineer', id[\s\S]*FROM engineers/);
  assert.match(sql, /037_engineer_account_activation/);
});

test('activation preflight and migration normalize historical phone whitespace consistently', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');
  const preflightSql = readFileSync(preflightPath, 'utf8');

  for (const sql of [migrationSql, preflightSql]) {
    assert.match(sql, /replace\([^\n]+char\(9\)[^\n]+\)/);
    assert.match(sql, /replace\([^\n]+char\(10\)[^\n]+\)/);
    assert.match(sql, /replace\([^\n]+char\(13\)[^\n]+\)/);
  }
  assert.equal((migrationSql.match(/char\(9\)/g) || []).length, 2);
  assert.equal((preflightSql.match(/char\(9\)/g) || []).length, 2);
});

test('schema snapshot includes migration 036 before activation migration 037', () => {
  const funnelMigrationSql = readFileSync(funnelMigrationPath, 'utf8').trim();
  const schemaSql = readFileSync(schemaPath, 'utf8');
  const funnelSchemaSql = funnelMigrationSql.split('INSERT OR IGNORE INTO _migrations')[0].trim();

  assert.ok(schemaSql.includes(funnelSchemaSql));
  assert.match(schemaSql, /\('036_create_funnel_events',\s+'Controlled beta funnel event tracking'\)/);
  assert.ok(schemaSql.indexOf('036_create_funnel_events') < schemaSql.indexOf('037_engineer_account_activation'));
  assert.ok(schemaSql.indexOf('CREATE TABLE IF NOT EXISTS funnel_events') < schemaSql.indexOf('CREATE TABLE IF NOT EXISTS account_identities'));
});
