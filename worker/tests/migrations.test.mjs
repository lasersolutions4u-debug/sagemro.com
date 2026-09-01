import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const migrationUrl = new URL('../migrations/046_knowledge_candidate_pipeline.sql', import.meta.url);
const structuredServiceRequestMigrationUrl = new URL(
  '../migrations/047_structured_service_request_intake.sql',
  import.meta.url,
);
const serviceRequestAssistQuotaMigrationUrl = new URL(
  '../migrations/048_service_request_assist_quota.sql',
  import.meta.url,
);
const nullableInternationalCustomerPhoneMigrationUrl = new URL(
  '../migrations/049_nullable_international_customer_phone.sql',
  import.meta.url,
);
const schemaUrl = new URL('../schema.sql', import.meta.url);

const structuredServiceRequestColumns = [
  'service_request_version',
  'service_request_kind',
  'device_types_json',
  'device_brands_json',
  'device_model',
  'region_json',
  'alarm_code',
  'production_impact',
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_whatsapp',
  'contact_preference',
];

test('049 migration makes customer phone nullable without losing data or foreign-key integrity', async () => {
  const sql = await readFile(nullableInternationalCustomerPhoneMigrationUrl, 'utf8');
  const db = new DatabaseSync(':memory:');

  try {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(`
      CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        user_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        email TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL DEFAULT '',
        region TEXT,
        company TEXT,
        address TEXT,
        city TEXT,
        company_description TEXT,
        business_scope TEXT,
        logo_url TEXT,
        auth_status TEXT DEFAULT 'pending',
        onesignal_player_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_customers_email_normalized_unique
        ON customers(lower(trim(email)))
        WHERE email IS NOT NULL AND trim(email) <> '';
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
      CREATE TABLE work_orders (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id));
      CREATE TABLE ratings (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id));
      CREATE TABLE platform_ratings (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id));
      CREATE TABLE customer_ratings (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id));
      CREATE TABLE engineer_reviews (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id));
      CREATE TABLE upsell_requests (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id));
      INSERT INTO customers (
        id, user_no, name, phone, email, password_hash, salt, region, company,
        address, city, company_description, business_scope, logo_url,
        auth_status, onesignal_player_id, created_at
      ) VALUES (
        'cust-legacy', 'U000001', 'Legacy', '13800000000', 'legacy@example.com',
        'hash', 'salt', '山东', 'Legacy Co', 'Address', 'Jinan', 'Description',
        'Scope', 'https://example.com/logo.png', 'authenticated', 'player-1',
        '2026-01-02 03:04:05'
      );
      INSERT INTO conversations (id, customer_id) VALUES ('conv-1', 'cust-legacy');
      INSERT INTO work_orders (id, customer_id) VALUES ('work-1', 'cust-legacy');
      INSERT INTO ratings (id, customer_id) VALUES ('rating-1', 'cust-legacy');
      INSERT INTO platform_ratings (id, customer_id) VALUES ('platform-1', 'cust-legacy');
      INSERT INTO customer_ratings (id, customer_id) VALUES ('customer-rating-1', 'cust-legacy');
      INSERT INTO engineer_reviews (id, customer_id) VALUES ('engineer-review-1', 'cust-legacy');
      INSERT INTO upsell_requests (id, customer_id) VALUES ('upsell-1', 'cust-legacy');
    `);

    db.exec('BEGIN IMMEDIATE;');
    db.exec(sql);
    db.exec('COMMIT;');

    const phoneColumn = db.prepare('PRAGMA table_info(customers)').all()
      .find((column) => column.name === 'phone');
    assert.equal(phoneColumn.notnull, 0);
    assert.deepEqual({ ...db.prepare('SELECT * FROM customers WHERE id = ?').get('cust-legacy') }, {
      id: 'cust-legacy',
      user_no: 'U000001',
      name: 'Legacy',
      phone: '13800000000',
      email: 'legacy@example.com',
      password_hash: 'hash',
      salt: 'salt',
      region: '山东',
      company: 'Legacy Co',
      address: 'Address',
      city: 'Jinan',
      company_description: 'Description',
      business_scope: 'Scope',
      logo_url: 'https://example.com/logo.png',
      auth_status: 'authenticated',
      onesignal_player_id: 'player-1',
      created_at: '2026-01-02 03:04:05',
    });
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    for (const [tableName, rowId] of [
      ['conversations', 'conv-1'],
      ['work_orders', 'work-1'],
      ['ratings', 'rating-1'],
      ['platform_ratings', 'platform-1'],
      ['customer_ratings', 'customer-rating-1'],
      ['engineer_reviews', 'engineer-review-1'],
      ['upsell_requests', 'upsell-1'],
    ]) {
      assert.equal(
        db.prepare(`SELECT customer_id FROM ${tableName} WHERE id = ?`).get(rowId).customer_id,
        'cust-legacy',
      );
    }

    db.prepare(`
      INSERT INTO customers (id, user_no, name, phone, email, password_hash)
      VALUES (?, ?, ?, NULL, ?, ?)
    `).run('cust-null-1', 'U000002', 'Null One', 'null1@example.com', 'hash');
    db.prepare(`
      INSERT INTO customers (id, user_no, name, phone, email, password_hash)
      VALUES (?, ?, ?, NULL, ?, ?)
    `).run('cust-null-2', 'U000003', 'Null Two', 'null2@example.com', 'hash');
    assert.throws(() => db.prepare(`
      INSERT INTO customers (id, user_no, name, phone, email, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('cust-phone-dup', 'U000004', 'Phone Dup', '13800000000', 'phone-dup@example.com', 'hash'), /UNIQUE constraint failed/i);
    assert.throws(() => db.prepare(`
      INSERT INTO customers (id, user_no, name, phone, email, password_hash)
      VALUES (?, ?, ?, NULL, ?, ?)
    `).run('cust-email-dup', 'U000005', 'Email Dup', ' LEGACY@example.com ', 'hash'), /UNIQUE constraint failed/i);
    assert.equal(
      db.prepare('SELECT version FROM _migrations WHERE version = ?').get('049_nullable_international_customer_phone')?.version,
      '049_nullable_international_customer_phone',
    );
  } finally {
    db.close();
  }
});

test('fresh schema snapshot keeps customer phone nullable and records migration 049', async () => {
  const sql = await readFile(schemaUrl, 'utf8');
  const customersTable = sql.match(/CREATE TABLE IF NOT EXISTS customers \([\s\S]*?\n\);/)?.[0] || '';

  assert.match(customersTable, /phone TEXT UNIQUE/);
  assert.doesNotMatch(customersTable, /phone TEXT NOT NULL UNIQUE/);
  assert.match(sql, /'049_nullable_international_customer_phone'/);
});

test('048 migration atomically scopes public service-request assist quotas', async () => {
  const sql = await readFile(serviceRequestAssistQuotaMigrationUrl, 'utf8');
  const db = new DatabaseSync(':memory:');

  try {
    db.exec('CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);');
    db.exec(sql);

    const columns = db.prepare('PRAGMA table_info(service_request_assist_quotas)').all();
    assert.deepEqual(columns.map((column) => column.name), [
      'market', 'scope', 'bucket', 'count', 'expires_at',
    ]);
    assert.deepEqual(
      columns.filter((column) => column.pk > 0).sort((left, right) => left.pk - right.pk).map((column) => column.name),
      ['market', 'scope', 'bucket'],
    );
    assert.match(sql, /market IN \('com', 'cn'\)/i);
    assert.match(sql, /count INTEGER NOT NULL DEFAULT 0 CHECK \(count >= 0\)/i);
    assert.match(sql, /idx_service_request_assist_quotas_expiry/i);

    assert.throws(() => db.prepare(`
      INSERT INTO service_request_assist_quotas (market, scope, bucket, count, expires_at)
      VALUES ('invalid', 'ip:test', '20260901T10', 1, '2026-09-01T11:00:00.000Z')
    `).run(), /CHECK constraint failed/i);

    db.prepare(`
      INSERT INTO service_request_assist_quotas (market, scope, bucket, count, expires_at)
      VALUES (?, ?, ?, 1, ?)
    `).run('com', 'hourly_ip:hashed-only', '20260901T10', '2026-09-01T11:00:00.000Z');
    assert.throws(() => db.prepare(`
      INSERT INTO service_request_assist_quotas (market, scope, bucket, count, expires_at)
      VALUES (?, ?, ?, 1, ?)
    `).run('com', 'hourly_ip:hashed-only', '20260901T10', '2026-09-01T11:00:00.000Z'), /UNIQUE constraint failed/i);

    const ledger = db.prepare('SELECT version FROM _migrations WHERE version = ?').get(
      '048_service_request_assist_quota',
    );
    assert.equal(ledger?.version, '048_service_request_assist_quota');
  } finally {
    db.close();
  }
});

test('fresh schema snapshot contains the 048 assist quota table and ledger', async () => {
  const sql = await readFile(schemaUrl, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS service_request_assist_quotas/i);
  assert.match(sql, /PRIMARY KEY \(market, scope, bucket\)/i);
  assert.match(sql, /idx_service_request_assist_quotas_expiry/i);
  assert.match(sql, /'048_service_request_assist_quota'/i);
});

test('047 migration declares the structured service request field set and ledger version', async () => {
  const sql = await readFile(structuredServiceRequestMigrationUrl, 'utf8');

  for (const columnName of structuredServiceRequestColumns) {
    assert.match(sql, new RegExp(`\\b${columnName}\\b`, 'i'));
  }
  assert.match(sql, /INSERT OR IGNORE INTO _migrations \(version, note\) VALUES[\s\S]*'047_structured_service_request_intake'/i);
});

test('fresh schema snapshot contains the 047 structured service request fields and ledger', async () => {
  const sql = await readFile(schemaUrl, 'utf8');
  const workOrdersTable = sql.match(/CREATE TABLE IF NOT EXISTS work_orders \([\s\S]*?\n\);/)?.[0] || '';

  for (const columnName of structuredServiceRequestColumns) {
    assert.match(workOrdersTable, new RegExp(`\\b${columnName}\\b`, 'i'));
  }
  assert.match(workOrdersTable, /service_request_version INTEGER NOT NULL DEFAULT 1/i);
  for (const columnName of ['device_types_json', 'device_brands_json', 'region_json']) {
    assert.match(workOrdersTable, new RegExp(`${columnName} TEXT NOT NULL DEFAULT '\\\[\\\]'`, 'i'));
  }
  assert.match(sql, /'047_structured_service_request_intake'/i);
});

test('047 migration executes and preserves compatible defaults for legacy work orders', async () => {
  const sql = await readFile(structuredServiceRequestMigrationUrl, 'utf8');
  const db = new DatabaseSync(':memory:');

  try {
    db.exec(`
      CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
      CREATE TABLE work_orders (id TEXT PRIMARY KEY);
      INSERT INTO work_orders (id) VALUES ('legacy-work-order');
    `);
    db.exec(sql);

    const tableInfo = db.prepare('PRAGMA table_info(work_orders)').all();
    const columnsByName = new Map(tableInfo.map((column) => [column.name, column]));
    assert.deepEqual(
      structuredServiceRequestColumns.filter((columnName) => !columnsByName.has(columnName)),
      [],
    );

    const versionColumn = columnsByName.get('service_request_version');
    assert.equal(versionColumn.type, 'INTEGER');
    assert.equal(versionColumn.notnull, 1);
    assert.equal(versionColumn.dflt_value, '1');

    for (const columnName of ['device_types_json', 'device_brands_json', 'region_json']) {
      const column = columnsByName.get(columnName);
      assert.equal(column.type, 'TEXT');
      assert.equal(column.notnull, 1);
      assert.equal(column.dflt_value, "'[]'");
    }

    const optionalColumns = structuredServiceRequestColumns.filter((columnName) => (
      columnName !== 'service_request_version'
      && !['device_types_json', 'device_brands_json', 'region_json'].includes(columnName)
    ));
    for (const columnName of optionalColumns) {
      const column = columnsByName.get(columnName);
      assert.equal(column.notnull, 0);
      assert.equal(column.dflt_value, null);
    }

    const legacyRow = db.prepare(`
      SELECT service_request_version, service_request_kind,
             device_types_json, device_brands_json, device_model, region_json,
             alarm_code, production_impact, contact_name, contact_email,
             contact_phone, contact_whatsapp, contact_preference
      FROM work_orders
      WHERE id = 'legacy-work-order'
    `).get();
    assert.deepEqual({ ...legacyRow }, {
      service_request_version: 1,
      service_request_kind: null,
      device_types_json: '[]',
      device_brands_json: '[]',
      device_model: null,
      region_json: '[]',
      alarm_code: null,
      production_impact: null,
      contact_name: null,
      contact_email: null,
      contact_phone: null,
      contact_whatsapp: null,
      contact_preference: null,
    });

    const ledger = db.prepare('SELECT version FROM _migrations WHERE version = ?').get(
      '047_structured_service_request_intake',
    );
    assert.equal(ledger?.version, '047_structured_service_request_intake');
  } finally {
    db.close();
  }
});

test('046 migration defines the knowledge candidate pipeline tables and index', async () => {
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

test('046 migration constrains candidate classifications and references existing entities', async () => {
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

test('046 migration requires typed reviewers and consistent source references', async () => {
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

test('046 migration rejects mismatched work-order repair sources on insert and update', async () => {
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

test('046 migration types event actors and indexes candidate history', async () => {
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

test('fresh schema snapshot contains the 046 knowledge candidate pipeline', async () => {
  const sql = await readFile(schemaUrl, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS knowledge_candidates\s*\(/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS knowledge_candidate_events\s*\(/i);
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status_market\s+ON knowledge_candidates\s*\(market, status, updated_at DESC\)/i,
  );
  assert.match(sql, /'046_knowledge_candidate_pipeline'/i);
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
