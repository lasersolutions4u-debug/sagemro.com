import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const migrationUrl = new URL('../migrations/041_quote_execution_baseline.sql', import.meta.url);
const migrationSql = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8') : '';
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

const triggerTypes = [
  'before_start',
  'on_arrival',
  'milestone',
  'on_completion',
  'on_acceptance',
  'fixed_date',
];

function preMigrationDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
    CREATE TABLE engineers (id TEXT PRIMARY KEY);
    CREATE TABLE work_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      site_timezone TEXT,
      expected_service_days INTEGER,
      expected_completion_date TEXT,
      planned_daily_start_time TEXT,
      planned_daily_end_time TEXT,
      updated_at TEXT
    );
    CREATE TABLE work_order_pricing (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL UNIQUE,
      engineer_id TEXT,
      total_amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE work_order_pricing_history (
      id TEXT PRIMARY KEY,
      pricing_id TEXT NOT NULL,
      total_amount INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE work_order_payments (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      customer_id TEXT,
      amount INTEGER NOT NULL,
      payment_method TEXT DEFAULT 'bank_transfer',
      transaction_id TEXT UNIQUE,
      status TEXT DEFAULT 'completed',
      paid_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      payment_stage TEXT NOT NULL DEFAULT 'advance',
      quote_total_amount INTEGER DEFAULT 0,
      advance_amount INTEGER DEFAULT 0,
      balance_amount INTEGER DEFAULT 0,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );
  `);
  seedParents(db);
  db.exec(`
    INSERT INTO work_order_pricing_history (
      id, pricing_id, total_amount, version, created_at
    ) VALUES ('history-legacy', 'pricing-1', 10000, 1, '2026-07-01 08:00:00');
    INSERT INTO work_order_payments (
      id, work_order_id, amount, payment_stage, quote_total_amount,
      advance_amount, balance_amount, transaction_id
    ) VALUES (
      'payment-legacy', 'wo-1', 4000, 'advance', 10000,
      4000, 6000, 'legacy-transaction'
    );
  `);
  return db;
}

function schemaDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schemaSql);
  seedParents(db);
  db.exec(`
    INSERT INTO work_order_pricing_history (
      id, pricing_id, total_amount, version, created_at
    ) VALUES ('history-legacy', 'pricing-1', 10000, 1, '2026-07-01 08:00:00');
    INSERT INTO work_order_payments (
      id, work_order_id, amount, payment_stage, quote_total_amount,
      advance_amount, balance_amount, transaction_id
    ) VALUES (
      'payment-legacy', 'wo-1', 4000, 'advance', 10000,
      4000, 6000, 'legacy-transaction'
    );
  `);
  return db;
}

function seedParents(db) {
  const engineerColumns = tableColumns(db, 'engineers');
  if (engineerColumns.includes('user_no')) {
    db.prepare(`
      INSERT INTO engineers (id, user_no, name, phone, password_hash)
      VALUES ('eng-1', 'E000001', 'Engineer', '13800000000', 'hash')
    `).run();
  } else {
    db.prepare('INSERT INTO engineers (id) VALUES (?)').run('eng-1');
  }
  db.prepare(`
    INSERT INTO work_orders (id, order_no, type, description)
    VALUES (?, ?, 'maintenance', 'Quote execution test')
  `).run('wo-1', 'WO-1');
  db.prepare(`
    INSERT INTO work_orders (id, order_no, type, description)
    VALUES (?, ?, 'maintenance', 'Second quote execution test')
  `).run('wo-2', 'WO-2');
  db.prepare(`
    INSERT INTO work_order_pricing (
      id, work_order_id, engineer_id, total_amount, status
    ) VALUES ('pricing-1', 'wo-1', 'eng-1', 10000, 'confirmed')
  `).run();
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

function normalizeTableInfo(db, table, columns = null) {
  return db.prepare(`PRAGMA table_info(${table})`).all()
    .filter((column) => columns === null || columns.includes(column.name))
    .map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeForeignKeys(db, table) {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all()
    .map((foreignKey) => ({
      table: foreignKey.table,
      from: foreignKey.from,
      to: foreignKey.to,
      on_update: foreignKey.on_update,
      on_delete: foreignKey.on_delete,
      match: foreignKey.match,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizeIndexes(db, table) {
  return db.prepare(`PRAGMA index_list(${table})`).all()
    .map(({ name, unique, origin, partial }) => ({
      name: origin === 'c' ? name : null,
      unique,
      origin,
      partial,
      columns: db.prepare(`PRAGMA index_info(${JSON.stringify(name)})`).all()
        .sort((left, right) => left.seqno - right.seqno)
        .map(({ name: columnName }) => columnName),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizeTriggers(db) {
  return db.prepare(`
    SELECT name, tbl_name, sql FROM sqlite_master
    WHERE type = 'trigger' AND name LIKE 'quote_execution_%'
  `).all()
    .map(({ name, tbl_name, sql }) => ({
      name,
      table: tbl_name,
      sql: sql.replace(/\s+/g, ' ').trim(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function assertConstraint(db, sql, pattern = /constraint/i) {
  assert.throws(() => db.exec(sql), pattern);
}

function insertSchedule(db, {
  id = 'schedule-1',
  pricingId = 'pricing-1',
  workOrderId = 'wo-1',
  quoteVersion = 1,
  sequence = 1,
  amount = 4000,
  currency = 'CNY',
  triggerType = 'before_start',
  dueDate = null,
  description = '',
  requiredBeforeStart = 1,
} = {}) {
  db.prepare(`
    INSERT INTO work_order_payment_schedule (
      id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    pricingId,
    workOrderId,
    quoteVersion,
    sequence,
    amount,
    currency,
    triggerType,
    dueDate,
    description,
    requiredBeforeStart,
  );
}

function insertInstallment(db, {
  id = 'installment-1',
  scheduleId = 'schedule-1',
  workOrderId = 'wo-1',
  quoteVersion = 1,
  sequence = 1,
  amount = 4000,
  currency = 'CNY',
  triggerType = 'before_start',
  dueDate = null,
  description = '',
  requiredBeforeStart = 1,
  status = 'scheduled',
  receivedAmount = 0,
} = {}) {
  db.prepare(`
    INSERT INTO work_order_installments (
      id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start, status,
      received_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    scheduleId,
    workOrderId,
    quoteVersion,
    sequence,
    amount,
    currency,
    triggerType,
    dueDate,
    description,
    requiredBeforeStart,
    status,
    receivedAmount,
  );
}

function insertClaim(db, {
  id = 'claim-1',
  installmentId = 'installment-1',
  workOrderId = 'wo-1',
  claimedAmount = 4000,
  idempotencyKey = 'claim-key-1',
  decisionIdempotencyKey = null,
} = {}) {
  db.prepare(`
    INSERT INTO work_order_receipt_claims (
      id, installment_id, work_order_id, engineer_id, claimed_amount,
      idempotency_key, decision_idempotency_key
    ) VALUES (?, ?, ?, 'eng-1', ?, ?, ?)
  `).run(
    id,
    installmentId,
    workOrderId,
    claimedAmount,
    idempotencyKey,
    decisionIdempotencyKey,
  );
}

function insertEvidence(db, {
  id = 'evidence-1',
  claimId = 'claim-1',
  workOrderId = 'wo-1',
  objectKey = 'receipt-evidence/com/wo-1/claim-1.jpg',
} = {}) {
  db.prepare(`
    INSERT INTO work_order_receipt_evidence (
      id, claim_id, work_order_id, object_key, file_name, mime_type,
      file_size, uploader_type, uploader_id
    ) VALUES (?, ?, ?, ?, 'receipt.jpg', 'image/jpeg', 100, 'engineer', 'eng-1')
  `).run(id, claimId, workOrderId, objectKey);
}

function seedExecutionGraph(db) {
  insertSchedule(db);
  insertInstallment(db);
  insertClaim(db, { decisionIdempotencyKey: 'decision-key-1' });
  insertEvidence(db);
}

const databaseFactories = [
  ['migration 041', () => {
    const db = preMigrationDatabase();
    db.exec(migrationSql);
    return db;
  }],
  ['schema snapshot', schemaDatabase],
];

test('migration 041 and schema snapshot keep quote execution metadata in parity', () => {
  const migrationDb = preMigrationDatabase();
  migrationDb.exec(migrationSql);
  const snapshotDb = schemaDatabase();
  const newTables = [
    'work_order_payment_schedule',
    'work_order_installments',
    'work_order_receipt_claims',
    'work_order_receipt_evidence',
  ];

  for (const table of newTables) {
    assert.deepEqual(normalizeTableInfo(migrationDb, table), normalizeTableInfo(snapshotDb, table), table);
    assert.deepEqual(normalizeForeignKeys(migrationDb, table), normalizeForeignKeys(snapshotDb, table), table);
    assert.deepEqual(normalizeIndexes(migrationDb, table), normalizeIndexes(snapshotDb, table), table);
  }

  for (const [table, columns] of [
    ['work_order_pricing', ['quote_version', 'expected_service_days', 'payment_plan_mode']],
    ['work_order_pricing_history', [
      'expected_service_days', 'payment_plan_mode', 'quote_kind', 'parent_quote_version',
      'status', 'approved_at', 'confirmed_at',
    ]],
    ['work_orders', ['quote_expected_service_days', 'approved_extension_days', 'active_quote_version']],
  ]) {
    assert.deepEqual(
      normalizeTableInfo(migrationDb, table, columns),
      normalizeTableInfo(snapshotDb, table, columns),
      table,
    );
  }

  const migrationTriggers = normalizeTriggers(migrationDb);
  assert.deepEqual(migrationTriggers.map((trigger) => trigger.name), [
    'quote_execution_installment_snapshot_insert',
    'quote_execution_installment_snapshot_update',
    'quote_execution_schedule_delete_guard',
    'quote_execution_schedule_update_guard',
  ]);
  assert.deepEqual(migrationTriggers, normalizeTriggers(snapshotDb));
});

for (const [label, createDatabase] of databaseFactories) {
  test(`${label} preserves a confirmed legacy quote without fabricating execution records`, () => {
    assert.notEqual(migrationSql, '', 'migration 041 must exist');
    const db = createDatabase();

    assert.equal(
      db.prepare("SELECT status FROM work_order_pricing WHERE id = 'pricing-1'").get().status,
      'confirmed',
    );
    assert.deepEqual({ ...db.prepare(`
      SELECT status, approved_at, confirmed_at
      FROM work_order_pricing_history WHERE id = 'history-legacy'
    `).get() }, {
      status: 'legacy',
      approved_at: null,
      confirmed_at: null,
    });
    assert.deepEqual({ ...db.prepare(`
      SELECT payment_stage, amount, quote_total_amount, advance_amount,
        balance_amount, transaction_id
      FROM work_order_payments WHERE id = 'payment-legacy'
    `).get() }, {
      payment_stage: 'advance',
      amount: 4000,
      quote_total_amount: 10000,
      advance_amount: 4000,
      balance_amount: 6000,
      transaction_id: 'legacy-transaction',
    });
    for (const table of [
      'work_order_payment_schedule',
      'work_order_installments',
      'work_order_receipt_claims',
      'work_order_receipt_evidence',
    ]) {
      assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
    }
  });

  test(`${label} exposes quote execution columns, tables, and migration metadata`, () => {
    const db = createDatabase();
    assert.deepEqual(
      tableColumns(db, 'work_order_pricing').filter((name) => [
        'quote_version', 'expected_service_days', 'payment_plan_mode',
      ].includes(name)),
      ['quote_version', 'expected_service_days', 'payment_plan_mode'],
    );
    assert.deepEqual(
      tableColumns(db, 'work_order_pricing_history').filter((name) => [
        'expected_service_days', 'payment_plan_mode', 'quote_kind',
        'parent_quote_version', 'status', 'approved_at', 'confirmed_at',
      ].includes(name)),
      [
        'expected_service_days', 'payment_plan_mode', 'quote_kind',
        'parent_quote_version', 'status', 'approved_at', 'confirmed_at',
      ],
    );
    assert.deepEqual(
      tableColumns(db, 'work_orders').filter((name) => [
        'quote_expected_service_days', 'approved_extension_days', 'active_quote_version',
      ].includes(name)),
      ['quote_expected_service_days', 'approved_extension_days', 'active_quote_version'],
    );
    for (const table of [
      'work_order_payment_schedule',
      'work_order_installments',
      'work_order_receipt_claims',
      'work_order_receipt_evidence',
    ]) {
      assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?").get(table).count,
        1,
      );
    }
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM _migrations WHERE version = '041_quote_execution_baseline'").get().count,
      1,
    );
    assertConstraint(db, "UPDATE work_order_pricing SET payment_plan_mode = 'split' WHERE id = 'pricing-1'");
  });

  test(`${label} enforces immutable payment schedule row constraints`, () => {
    const db = createDatabase();
    insertSchedule(db);

    assertConstraint(db, `
      INSERT INTO work_order_payment_schedule (
        id, pricing_id, work_order_id, quote_version, sequence, amount, currency, trigger_type
      ) VALUES ('schedule-duplicate', 'pricing-1', 'wo-1', 1, 1, 1000, 'CNY', 'before_start')
    `, /unique/i);

    for (const sequence of [0, 7]) {
      assertConstraint(db, `
        INSERT INTO work_order_payment_schedule (
          id, pricing_id, work_order_id, quote_version, sequence, amount, currency, trigger_type
        ) VALUES ('schedule-sequence-${sequence}', 'pricing-1', 'wo-1', 2, ${sequence}, 1000, 'CNY', 'before_start')
      `);
    }
    for (const amount of [0, -1]) {
      assertConstraint(db, `
        INSERT INTO work_order_payment_schedule (
          id, pricing_id, work_order_id, quote_version, sequence, amount, currency, trigger_type
        ) VALUES ('schedule-amount-${amount}', 'pricing-1', 'wo-1', 2, 1, ${amount}, 'CNY', 'before_start')
      `);
    }
    assertConstraint(db, `
      INSERT INTO work_order_payment_schedule (
        id, pricing_id, work_order_id, quote_version, sequence, amount, currency, trigger_type
      ) VALUES ('schedule-trigger', 'pricing-1', 'wo-1', 2, 1, 1000, 'CNY', 'after_lunch')
    `);
    assertConstraint(db, `
      INSERT INTO work_order_payment_schedule (
        id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
        trigger_type, description
      ) VALUES ('schedule-milestone', 'pricing-1', 'wo-1', 2, 1, 1000, 'CNY', 'milestone', '   ')
    `);

    for (const dueDateSql of ['NULL', "'2026/07/24'", "'2026-7-24'", "'2026-07-240'"]) {
      assertConstraint(db, `
        INSERT INTO work_order_payment_schedule (
          id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
          trigger_type, due_date
        ) VALUES ('schedule-date-${dueDateSql.replaceAll("'", '').replaceAll('/', '-')}',
          'pricing-1', 'wo-1', 2, 1, 1000, 'CNY', 'fixed_date', ${dueDateSql})
      `);
    }
    assertConstraint(db, `
      INSERT INTO work_order_payment_schedule (
        id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
        trigger_type, due_date
      ) VALUES ('schedule-non-fixed-date', 'pricing-1', 'wo-1', 2, 1, 1000, 'CNY',
        'on_completion', '2026-07-24')
    `);

    insertSchedule(db, {
      id: 'schedule-fixed-date',
      quoteVersion: 2,
      triggerType: 'fixed_date',
      dueDate: '2026-02-30',
    });
    assert.equal(
      db.prepare("SELECT due_date FROM work_order_payment_schedule WHERE id = 'schedule-fixed-date'").get().due_date,
      '2026-02-30',
      'calendar-date semantics remain a Worker validation invariant',
    );
    assert.deepEqual(
      triggerTypes,
      ['before_start', 'on_arrival', 'milestone', 'on_completion', 'on_acceptance', 'fixed_date'],
    );
  });

  test(`${label} enforces operational installment constraints`, () => {
    const db = createDatabase();
    insertSchedule(db);
    insertInstallment(db);

    assertConstraint(db, `
      INSERT INTO work_order_installments (
        id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
        trigger_type, required_before_start
      ) VALUES ('installment-schedule-duplicate', 'schedule-1', 'wo-1', 1, 1,
        4000, 'CNY', 'before_start', 1)
    `, /unique/i);

    insertSchedule(db, { id: 'schedule-2', quoteVersion: 2 });

    for (const receivedAmount of [-1, 4001]) {
      assertConstraint(db, `
        INSERT INTO work_order_installments (
          id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
          trigger_type, required_before_start, received_amount
        ) VALUES ('installment-received-${receivedAmount}', 'schedule-2', 'wo-1', 2, 1,
          4000, 'CNY', 'before_start', 1, ${receivedAmount})
      `);
    }
    assertConstraint(db, `
        INSERT INTO work_order_installments (
          id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
          trigger_type, required_before_start, status
      ) VALUES ('installment-status', 'schedule-2', 'wo-1', 2, 1, 4000, 'CNY',
        'before_start', 1, 'refunded')
    `);
    insertSchedule(db, { id: 'schedule-3', quoteVersion: 3 });
    for (const [suffix, columns, values] of [
      ['sequence', '', "'schedule-3', 'wo-1', 3, 7, 4000, 'CNY', 'before_start'"],
      ['amount', '', "'schedule-3', 'wo-1', 3, 1, 0, 'CNY', 'before_start'"],
      ['trigger', '', "'schedule-3', 'wo-1', 3, 1, 4000, 'CNY', 'after_lunch'"],
      ['milestone', ', description', "'schedule-3', 'wo-1', 3, 1, 4000, 'CNY', 'milestone', '   '"],
      ['fixed-date', ', due_date', "'schedule-3', 'wo-1', 3, 1, 4000, 'CNY', 'fixed_date', '2026/07/24'"],
      ['non-fixed-date', ', due_date', "'schedule-3', 'wo-1', 3, 1, 4000, 'CNY', 'on_completion', '2026-07-24'"],
    ]) {
      assertConstraint(db, `
        INSERT INTO work_order_installments (
          id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
          trigger_type${columns}
        ) VALUES ('installment-${suffix}', ${values})
      `, /installment schedule snapshot mismatch/i);
    }
    assertConstraint(db, `
      INSERT INTO work_order_installments (
        id, schedule_id, work_order_id, quote_version, sequence, amount, currency, trigger_type
      ) VALUES ('installment-cross-order', 'schedule-2', 'wo-2', 2, 1, 4000, 'CNY', 'before_start')
    `, /installment schedule snapshot mismatch/i);
  });

  test(`${label} rejects installment snapshot mismatches on insert and update`, () => {
    const db = createDatabase();
    insertSchedule(db, {
      triggerType: 'fixed_date',
      dueDate: '2026-07-30',
      description: 'Scheduled deposit',
    });

    const insertMismatches = [
      { workOrderId: 'wo-2' },
      { quoteVersion: 2 },
      { sequence: 2 },
      { amount: 3999 },
      { currency: 'USD' },
      { triggerType: 'on_completion', dueDate: null },
      { dueDate: '2026-07-31' },
      { description: 'Changed deposit' },
      { requiredBeforeStart: 0 },
    ];
    for (const [index, mismatch] of insertMismatches.entries()) {
      assert.throws(() => insertInstallment(db, {
        id: `installment-mismatch-${index}`,
        triggerType: 'fixed_date',
        dueDate: '2026-07-30',
        description: 'Scheduled deposit',
        ...mismatch,
      }), /installment schedule snapshot mismatch/i);
    }

    insertInstallment(db, {
      triggerType: 'fixed_date',
      dueDate: '2026-07-30',
      description: 'Scheduled deposit',
    });
    for (const [column, value] of [
      ['work_order_id', "'wo-2'"],
      ['quote_version', '2'],
      ['sequence', '2'],
      ['amount', '3999'],
      ['currency', "'USD'"],
      ['trigger_type', "'on_completion'"],
      ['due_date', "'2026-07-31'"],
      ['description', "'Changed deposit'"],
      ['required_before_start', '0'],
    ]) {
      assertConstraint(
        db,
        `UPDATE work_order_installments SET ${column} = ${value} WHERE id = 'installment-1'`,
        /installment schedule snapshot mismatch/i,
      );
    }

    db.exec(`
      UPDATE work_order_installments SET
        status = 'collecting',
        payment_method = 'bank_transfer',
        collection_started_at = '2026-07-30 08:00:00',
        received_amount = 100,
        completed_at = NULL,
        updated_at = '2026-07-30 08:00:01'
      WHERE id = 'installment-1';
    `);
    assert.deepEqual({ ...db.prepare(`
      SELECT status, payment_method, collection_started_at, received_amount,
        completed_at, updated_at
      FROM work_order_installments WHERE id = 'installment-1'
    `).get() }, {
      status: 'collecting',
      payment_method: 'bank_transfer',
      collection_started_at: '2026-07-30 08:00:00',
      received_amount: 100,
      completed_at: null,
      updated_at: '2026-07-30 08:00:01',
    });
  });

  test(`${label} protects approved, confirmed, and activated schedules while allowing safe retries`, () => {
    const db = createDatabase();
    db.exec(`
      INSERT INTO work_order_pricing_history (
        id, pricing_id, total_amount, version, status
      ) VALUES
        ('history-pending', 'pricing-1', 10000, 2, 'pending_review'),
        ('history-approved', 'pricing-1', 10000, 3, 'approved'),
        ('history-confirmed', 'pricing-1', 10000, 4, 'confirmed'),
        ('history-activated', 'pricing-1', 10000, 5, 'pending_review');
    `);

    insertSchedule(db, { id: 'schedule-pending-edit', quoteVersion: 2 });
    db.exec("UPDATE work_order_payment_schedule SET amount = 4100 WHERE id = 'schedule-pending-edit'");
    assert.equal(
      db.prepare("SELECT amount FROM work_order_payment_schedule WHERE id = 'schedule-pending-edit'").get().amount,
      4100,
    );
    insertSchedule(db, { id: 'schedule-pending-delete', quoteVersion: 2, sequence: 2 });
    db.exec("DELETE FROM work_order_payment_schedule WHERE id = 'schedule-pending-delete'");
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM work_order_payment_schedule WHERE id = 'schedule-pending-delete'").get().count,
      0,
    );
    insertSchedule(db, { id: 'schedule-draft-edit', quoteVersion: 6 });
    db.exec("UPDATE work_order_payment_schedule SET amount = 4200 WHERE id = 'schedule-draft-edit'");
    assert.equal(
      db.prepare("SELECT amount FROM work_order_payment_schedule WHERE id = 'schedule-draft-edit'").get().amount,
      4200,
    );
    insertSchedule(db, { id: 'schedule-draft-delete', quoteVersion: 6, sequence: 2 });
    db.exec("DELETE FROM work_order_payment_schedule WHERE id = 'schedule-draft-delete'");
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM work_order_payment_schedule WHERE id = 'schedule-draft-delete'").get().count,
      0,
    );

    for (const [id, quoteVersion] of [
      ['schedule-approved', 3],
      ['schedule-confirmed', 4],
    ]) {
      insertSchedule(db, { id, quoteVersion });
      assertConstraint(
        db,
        `UPDATE work_order_payment_schedule SET amount = 4100 WHERE id = '${id}'`,
        /protected quote payment schedule/i,
      );
      assertConstraint(
        db,
        `DELETE FROM work_order_payment_schedule WHERE id = '${id}'`,
        /protected quote payment schedule/i,
      );
    }

    insertSchedule(db, { id: 'schedule-activated', quoteVersion: 5 });
    insertInstallment(db, {
      id: 'installment-activated',
      scheduleId: 'schedule-activated',
      quoteVersion: 5,
    });
    assertConstraint(
      db,
      "UPDATE work_order_payment_schedule SET amount = 4100 WHERE id = 'schedule-activated'",
      /protected quote payment schedule/i,
    );
    assertConstraint(
      db,
      "DELETE FROM work_order_payment_schedule WHERE id = 'schedule-activated'",
      /protected quote payment schedule/i,
    );
  });

  test(`${label} enforces receipt claim and private evidence integrity`, () => {
    const db = createDatabase();
    insertSchedule(db);
    insertInstallment(db);
    insertClaim(db, { decisionIdempotencyKey: 'decision-key-1' });
    insertEvidence(db);

    assertConstraint(db, `
      INSERT INTO work_order_receipt_claims (
        id, installment_id, work_order_id, engineer_id, claimed_amount, idempotency_key
      ) VALUES ('claim-idempotency', 'installment-1', 'wo-1', 'eng-1', 1, 'claim-key-1')
    `, /unique/i);
    assertConstraint(db, `
      INSERT INTO work_order_receipt_claims (
        id, installment_id, work_order_id, engineer_id, claimed_amount,
        idempotency_key, decision_idempotency_key
      ) VALUES ('claim-decision-idempotency', 'installment-1', 'wo-1', 'eng-1', 1,
        'claim-key-2', 'decision-key-1')
    `, /unique/i);
    for (const amount of [0, -1]) {
      assertConstraint(db, `
        INSERT INTO work_order_receipt_claims (
          id, installment_id, work_order_id, engineer_id, claimed_amount, idempotency_key
        ) VALUES ('claim-amount-${amount}', 'installment-1', 'wo-1', 'eng-1', ${amount},
          'claim-amount-key-${amount}')
      `);
    }
    assertConstraint(db, `
      INSERT INTO work_order_receipt_claims (
        id, installment_id, work_order_id, engineer_id, claimed_amount,
        status, idempotency_key
      ) VALUES ('claim-status', 'installment-1', 'wo-1', 'eng-1', 1,
        'cancelled', 'claim-status-key')
    `);
    assertConstraint(db, `
      INSERT INTO work_order_receipt_claims (
        id, installment_id, work_order_id, engineer_id, claimed_amount,
        confirmed_amount, idempotency_key
      ) VALUES ('claim-confirmed-negative', 'installment-1', 'wo-1', 'eng-1', 1,
        -1, 'claim-confirmed-negative-key')
    `);
    assertConstraint(db, `
      INSERT INTO work_order_receipt_claims (
        id, installment_id, work_order_id, engineer_id, claimed_amount, idempotency_key
      ) VALUES ('claim-cross-order', 'installment-1', 'wo-2', 'eng-1', 1, 'claim-cross-key')
    `, /foreign key/i);
    assertConstraint(db, `
      INSERT INTO work_order_receipt_evidence (
        id, claim_id, work_order_id, object_key, file_name, mime_type,
        file_size, uploader_type, uploader_id
      ) VALUES ('evidence-object-duplicate', 'claim-1', 'wo-1',
        'receipt-evidence/com/wo-1/claim-1.jpg', 'second.jpg', 'image/jpeg', 100,
        'engineer', 'eng-1')
    `, /unique/i);
    assertConstraint(db, `
      INSERT INTO work_order_receipt_evidence (
        id, claim_id, work_order_id, object_key, file_name, mime_type,
        file_size, uploader_type, uploader_id
      ) VALUES ('evidence-claim-duplicate', 'claim-1', 'wo-1',
        'receipt-evidence/com/wo-1/second.jpg', 'second.jpg', 'image/jpeg', 100,
        'engineer', 'eng-1')
    `, /unique/i);
    for (const [id, fileSize, uploaderType] of [
      ['evidence-file-size', 0, 'engineer'],
      ['evidence-uploader', 100, 'system'],
    ]) {
      insertClaim(db, {
        id: `claim-${id}`,
        claimedAmount: 1,
        idempotencyKey: `claim-key-${id}`,
      });
      assertConstraint(db, `
        INSERT INTO work_order_receipt_evidence (
          id, claim_id, work_order_id, object_key, file_name, mime_type,
          file_size, uploader_type, uploader_id
        ) VALUES ('${id}', 'claim-${id}', 'wo-1',
          'receipt-evidence/com/wo-1/${id}.jpg', '${id}.jpg', 'image/jpeg',
          ${fileSize}, '${uploaderType}', 'eng-1')
      `);
    }
    insertClaim(db, {
      id: 'claim-2',
      claimedAmount: 1,
      idempotencyKey: 'claim-key-2',
      decisionIdempotencyKey: 'decision-key-2',
    });
    assertConstraint(db, `
      INSERT INTO work_order_receipt_evidence (
        id, claim_id, work_order_id, object_key, file_name, mime_type,
        file_size, uploader_type, uploader_id
      ) VALUES ('evidence-cross-order', 'claim-2', 'wo-2',
        'receipt-evidence/com/wo-2/cross.jpg', 'cross.jpg', 'image/jpeg', 100,
        'engineer', 'eng-1')
    `, /foreign key/i);
  });

  test(`${label} retains receipt engineer identity as an immutable audit snapshot`, () => {
    const db = createDatabase();
    insertSchedule(db);
    insertInstallment(db);
    insertClaim(db);

    db.exec("DELETE FROM engineers WHERE id = 'eng-1'");
    assert.deepEqual({ ...db.prepare(`
      SELECT engineer_id, status, claimed_amount
      FROM work_order_receipt_claims WHERE id = 'claim-1'
    `).get() }, {
      engineer_id: 'eng-1',
      status: 'pending',
      claimed_amount: 4000,
    });
  });

  test(`${label} blocks parent deletion while commercial receipt evidence exists`, () => {
    const db = createDatabase();
    seedExecutionGraph(db);

    for (const [table, id, pattern] of [
      ['work_orders', 'wo-1', /foreign key/i],
      ['work_order_pricing', 'pricing-1', /foreign key/i],
      ['work_order_payment_schedule', 'schedule-1', /protected quote payment schedule/i],
      ['work_order_installments', 'installment-1', /foreign key/i],
      ['work_order_receipt_claims', 'claim-1', /foreign key/i],
    ]) {
      assertConstraint(db, `DELETE FROM ${table} WHERE id = '${id}'`, pattern);
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_evidence').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM work_order_receipt_claims').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM work_order_payments').get().count, 1);
  });
}
