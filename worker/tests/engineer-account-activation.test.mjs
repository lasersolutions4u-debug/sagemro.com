import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

test('activation migration adds engineer email, shared identities, and activation records', () => {
  const sql = readFileSync(
    path.join(root, 'worker/migrations/037_engineer_account_activation.sql'),
    'utf8',
  );

  assert.match(sql, /ALTER TABLE engineers ADD COLUMN email TEXT/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_identities/);
  assert.match(sql, /PRIMARY KEY\s*\(identity_type, normalized_value\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS engineer_account_activations/);
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(sql, /expires_at TEXT NOT NULL/);
  assert.match(sql, /037_engineer_account_activation/);
});
