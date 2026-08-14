import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../migrations/034_knowledge_candidate_pipeline.sql', import.meta.url);
const schemaUrl = new URL('../schema.sql', import.meta.url);

test('034 migration defines the knowledge candidate pipeline tables and index', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS knowledge_candidates\s*\(/i);
  assert.match(sql, /source_repair_record_id TEXT UNIQUE/i);
  assert.match(sql, /raw_content TEXT NOT NULL/i);
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'awaiting_operations'/i);
  assert.match(sql, /alarm_codes_json TEXT NOT NULL DEFAULT '\[\]'/i);
  assert.match(sql, /risk_level TEXT NOT NULL DEFAULT 'medium'/i);
  assert.match(sql, /internal_use_allowed INTEGER NOT NULL DEFAULT 1/i);
  assert.match(sql, /public_use_allowed INTEGER NOT NULL DEFAULT 0/i);
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status_market\s+ON knowledge_candidates\s*\(market, status, updated_at DESC\)/i,
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS knowledge_candidate_events\s*\(/i);
  assert.match(sql, /FOREIGN KEY \(candidate_id\) REFERENCES knowledge_candidates\(id\)/i);
});

test('034 migration constrains candidate classifications and references existing entities', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /CHECK\s*\(market IN \('global', 'cn'\)\)/i);
  assert.match(sql, /CHECK\s*\(source_type IN \('work_order', 'historical_case', 'manual'\)\)/i);
  assert.match(sql, /CHECK\s*\(risk_level IN \('low', 'medium', 'high'\)\)/i);
  assert.match(sql, /FOREIGN KEY \(source_work_order_id\) REFERENCES work_orders\(id\)/i);
  assert.match(sql, /FOREIGN KEY \(source_repair_record_id\) REFERENCES work_order_repair_records\(id\)/i);
  assert.match(sql, /FOREIGN KEY \(contributor_engineer_id\) REFERENCES engineers\(id\)/i);
  assert.match(sql, /FOREIGN KEY \(knowledge_article_id\) REFERENCES knowledge_articles\(id\)/i);
  assert.doesNotMatch(sql, /REFERENCES (?:users|admins|admin_users)\s*\(/i);
  assert.match(sql, /intentionally polymorphic actor reference/i);
});

test('034 migration requires typed reviewers and consistent source references', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /operations_owner_type TEXT/i);
  assert.match(sql, /operations_owner_type IN \('admin'\)/i);
  assert.match(sql, /technical_reviewer_type TEXT/i);
  assert.match(sql, /technical_reviewer_type IN \('admin', 'engineer'\)/i);
  assert.doesNotMatch(sql, /operations_owner_type IN \([^)]*engineer/i);
  assert.match(
    sql,
    /operations_owner_type IS NULL AND operations_owner_id IS NULL[\s\S]*operations_owner_type IS NOT NULL AND operations_owner_id IS NOT NULL/i,
  );
  assert.match(
    sql,
    /technical_reviewer_type IS NULL AND technical_reviewer_id IS NULL[\s\S]*technical_reviewer_type IS NOT NULL AND technical_reviewer_id IS NOT NULL/i,
  );
  assert.match(
    sql,
    /source_type = 'work_order'[\s\S]*source_work_order_id IS NOT NULL[\s\S]*source_repair_record_id IS NOT NULL/i,
  );
  assert.match(
    sql,
    /source_type IN \('historical_case', 'manual'\)[\s\S]*source_work_order_id IS NULL[\s\S]*source_repair_record_id IS NULL/i,
  );
});

test('034 migration rejects mismatched work-order repair sources on insert and update', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /CREATE TRIGGER IF NOT EXISTS trg_knowledge_candidates_source_match_insert/i);
  assert.match(sql, /CREATE TRIGGER IF NOT EXISTS trg_knowledge_candidates_source_match_update/i);
  assert.match(sql, /CREATE TRIGGER IF NOT EXISTS trg_repair_records_preserve_candidate_source/i);
  assert.match(
    sql,
    /SELECT RAISE\(ABORT, 'knowledge_candidate_source_mismatch'\)[\s\S]*FROM work_order_repair_records[\s\S]*id = NEW\.source_repair_record_id[\s\S]*work_order_id = NEW\.source_work_order_id/i,
  );
  assert.match(
    sql,
    /BEFORE UPDATE OF work_order_id ON work_order_repair_records[\s\S]*FROM knowledge_candidates[\s\S]*source_repair_record_id = OLD\.id[\s\S]*source_type = 'work_order'[\s\S]*source_work_order_id <> NEW\.work_order_id/i,
  );
});

test('034 migration types event actors and indexes candidate history', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /actor_type TEXT NOT NULL CHECK \(actor_type IN \('admin', 'engineer', 'customer', 'system'\)\)/i);
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS idx_knowledge_candidate_events_candidate_created\s+ON knowledge_candidate_events\s*\(candidate_id, created_at DESC\)/i,
  );
  assert.match(
    sql,
    /actor_type = 'system' AND actor_user_id IS NULL[\s\S]*actor_type IN \('admin', 'engineer', 'customer'\) AND actor_user_id IS NOT NULL/i,
  );
});

test('fresh schema snapshot contains the 034 knowledge candidate pipeline', async () => {
  const sql = await readFile(schemaUrl, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS knowledge_candidates\s*\(/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS knowledge_candidate_events\s*\(/i);
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status_market\s+ON knowledge_candidates\s*\(market, status, updated_at DESC\)/i,
  );
  assert.match(sql, /'034_knowledge_candidate_pipeline'/i);
  assert.doesNotMatch(sql, /REFERENCES (?:users|admins|admin_users)\s*\(/i);
  assert.match(sql, /operations_owner_type TEXT/i);
  assert.match(sql, /technical_reviewer_type TEXT/i);
  assert.match(sql, /actor_type TEXT NOT NULL CHECK \(actor_type IN \('admin', 'engineer', 'customer', 'system'\)\)/i);
  assert.match(sql, /idx_knowledge_candidate_events_candidate_created/i);
  assert.match(sql, /trg_knowledge_candidates_source_match_insert/i);
  assert.match(sql, /trg_knowledge_candidates_source_match_update/i);
  assert.match(sql, /trg_repair_records_preserve_candidate_source/i);
  assert.match(
    sql,
    /actor_type = 'system' AND actor_user_id IS NULL[\s\S]*actor_type IN \('admin', 'engineer', 'customer'\) AND actor_user_id IS NOT NULL/i,
  );
});
