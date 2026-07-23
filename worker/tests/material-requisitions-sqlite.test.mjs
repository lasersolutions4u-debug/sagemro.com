import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migrationSql = readFileSync(new URL('../migrations/038_material_requisitions_and_staff.sql', import.meta.url), 'utf8');

function minimalPreMigrationDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE _migrations (version TEXT PRIMARY KEY, note TEXT);
    CREATE TABLE customers (id TEXT PRIMARY KEY);
    CREATE TABLE engineers (id TEXT PRIMARY KEY);
    CREATE TABLE work_orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      engineer_id TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (engineer_id) REFERENCES engineers(id)
    );
    CREATE TABLE materials (
      id TEXT PRIMARY KEY,
      stock_quantity INTEGER NOT NULL DEFAULT 0
    );
  `);
  return db;
}

function seedRequisition(db, { requisitionId = 'req-1', workOrderId = 'wo-1', materialId = 'mat-1', itemIds = ['item-1'] } = {}) {
  db.prepare('INSERT OR IGNORE INTO customers (id) VALUES (?)').run('cust-1');
  db.prepare('INSERT OR IGNORE INTO engineers (id) VALUES (?)').run('eng-1');
  db.prepare('INSERT OR IGNORE INTO work_orders (id, customer_id, engineer_id) VALUES (?, ?, ?)').run(workOrderId, 'cust-1', 'eng-1');
  db.prepare('INSERT OR IGNORE INTO materials (id, stock_quantity) VALUES (?, ?)').run(materialId, 10);
  db.prepare(`
    INSERT INTO material_requisitions (
      id, requisition_no, work_order_id, requested_by_type, requested_by_id, status
    ) VALUES (?, ?, ?, 'engineer', 'eng-1', 'approved')
  `).run(requisitionId, `MR-${requisitionId}`, workOrderId);
  for (const itemId of itemIds) {
    db.prepare(`
      INSERT INTO material_requisition_items (
        id, requisition_id, material_id, name, requested_quantity, status
      ) VALUES (?, ?, ?, 'Part', 5, 'pending')
    `).run(itemId, requisitionId, materialId);
  }
}

test('migration 038 adds reservation and idempotency schema with integer quantity constraints', () => {
  const db = minimalPreMigrationDatabase();
  db.exec(migrationSql);

  const materialColumns = db.prepare('PRAGMA table_info(materials)').all().map((column) => column.name);
  const requisitionColumns = db.prepare('PRAGMA table_info(material_requisitions)').all().map((column) => column.name);
  const operationColumns = db.prepare('PRAGMA table_info(material_requisition_operations)').all().map((column) => column.name);
  const operationItemColumn = db.prepare('PRAGMA table_info(material_requisition_operations)').all()
    .find((column) => column.name === 'item_id');
  assert.ok(materialColumns.includes('reserved_quantity'));
  assert.ok(requisitionColumns.includes('submitted_at'));
  assert.deepEqual(operationColumns, ['operation_key', 'action', 'requisition_id', 'item_id', 'request_fingerprint', 'completed_at']);
  assert.equal(operationItemColumn.notnull, 0);

  seedRequisition(db);
  assert.throws(() => db.prepare(`
    INSERT INTO material_requisition_items (
      id, requisition_id, name, requested_quantity
    ) VALUES ('fractional', 'req-1', 'Fractional', 1.5)
  `).run(), /constraint/i);
});

test('full schema loads with the material requisition reservation and operation tables', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schemaSql);

  assert.equal(db.prepare("SELECT reserved_quantity FROM materials WHERE 0").columns()[0].name, 'reserved_quantity');
  assert.equal(db.prepare("SELECT submitted_at FROM material_requisitions WHERE 0").columns()[0].name, 'submitted_at');
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'material_requisition_operations'").get().name, 'material_requisition_operations');
  const itemIdColumn = db.prepare('PRAGMA table_info(material_requisition_operations)').all()
    .find((column) => column.name === 'item_id');
  assert.equal(itemIdColumn.notnull, 0);
});

test('reservation SQL prevents two requisitions from overcommitting the same material', () => {
  const db = minimalPreMigrationDatabase();
  db.exec(migrationSql);
  seedRequisition(db, { requisitionId: 'req-a', itemIds: ['item-a'] });
  seedRequisition(db, { requisitionId: 'req-b', itemIds: ['item-b'] });

  const allocate = db.prepare(`
    UPDATE materials
    SET reserved_quantity = reserved_quantity + ?
    WHERE id = ? AND stock_quantity - reserved_quantity >= ?
  `);
  assert.equal(allocate.run(7, 'mat-1', 7).changes, 1);
  assert.equal(allocate.run(4, 'mat-1', 4).changes, 0);
  assert.deepEqual({ ...db.prepare('SELECT stock_quantity, reserved_quantity FROM materials WHERE id = ?').get('mat-1') }, {
    stock_quantity: 10,
    reserved_quantity: 7,
  });
});

test('procurement receipt stock is physically available but remains reserved to its requisition', () => {
  const db = minimalPreMigrationDatabase();
  db.exec(migrationSql);
  seedRequisition(db, { requisitionId: 'req-a', itemIds: ['item-a'] });
  seedRequisition(db, { requisitionId: 'req-b', itemIds: ['item-b'] });
  db.exec("UPDATE materials SET stock_quantity = 0, reserved_quantity = 0 WHERE id = 'mat-1'");

  const receivePurchase = db.prepare(`
    UPDATE materials
    SET stock_quantity = stock_quantity + ?, reserved_quantity = reserved_quantity + ?
    WHERE id = ? AND stock_quantity = ? AND reserved_quantity = ?
  `);
  assert.equal(receivePurchase.run(3, 3, 'mat-1', 0, 0).changes, 1);
  const allocate = db.prepare(`
    UPDATE materials SET reserved_quantity = reserved_quantity + ?
    WHERE id = ? AND stock_quantity - reserved_quantity >= ?
  `);
  assert.equal(allocate.run(1, 'mat-1', 1).changes, 0);
  assert.deepEqual({ ...db.prepare('SELECT stock_quantity, reserved_quantity FROM materials WHERE id = ?').get('mat-1') }, {
    stock_quantity: 3,
    reserved_quantity: 3,
  });
});

test('stock return releases physical stock without recreating a reservation', () => {
  const db = minimalPreMigrationDatabase();
  db.exec(migrationSql);
  seedRequisition(db);
  db.prepare(`
    UPDATE materials SET reserved_quantity = reserved_quantity + ?
    WHERE id = ? AND stock_quantity - reserved_quantity >= ?
  `).run(3, 'mat-1', 3);

  const movement = db.prepare(`
    UPDATE materials
    SET stock_quantity = stock_quantity + ?, reserved_quantity = reserved_quantity + ?
    WHERE id = ? AND stock_quantity = ? AND reserved_quantity = ?
      AND stock_quantity + ? >= 0 AND reserved_quantity + ? >= 0
      AND stock_quantity - reserved_quantity >= ? AND reserved_quantity >= ?
  `);
  assert.equal(movement.run(-3, -3, 'mat-1', 10, 3, -3, -3, 0, 3).changes, 1);
  assert.deepEqual({ ...db.prepare('SELECT stock_quantity, reserved_quantity FROM materials WHERE id = ?').get('mat-1') }, {
    stock_quantity: 7,
    reserved_quantity: 0,
  });
  assert.equal(movement.run(1, 0, 'mat-1', 7, 0, 1, 0, 0, 0).changes, 1);
  assert.deepEqual({ ...db.prepare('SELECT stock_quantity, reserved_quantity FROM materials WHERE id = ?').get('mat-1') }, {
    stock_quantity: 8,
    reserved_quantity: 0,
  });
  assert.equal(movement.run(-1, 0, 'mat-1', 8, 0, -1, 0, 1, 0).changes, 1);
  assert.deepEqual({ ...db.prepare('SELECT stock_quantity, reserved_quantity FROM materials WHERE id = ?').get('mat-1') }, {
    stock_quantity: 7,
    reserved_quantity: 0,
  });
});

test('operation keys store a request fingerprint and requisition history blocks work order deletion', () => {
  const db = minimalPreMigrationDatabase();
  db.exec(migrationSql);
  seedRequisition(db);

  const operation = db.prepare(`
    INSERT INTO material_requisition_operations (
      operation_key, action, requisition_id, item_id, request_fingerprint
    ) VALUES (?, 'allocate_stock', 'req-1', 'item-1', 'fingerprint-1')
  `);
  operation.run('operation-1');
  assert.throws(() => operation.run('operation-1'), /unique/i);
  assert.throws(() => db.prepare('DELETE FROM work_orders WHERE id = ?').run('wo-1'), /foreign key/i);
});

test('migration 038 permits a requisition-level create operation without an item', () => {
  const db = minimalPreMigrationDatabase();
  db.exec(migrationSql);
  seedRequisition(db);

  db.prepare(`
    INSERT INTO material_requisition_operations (
      operation_key, action, requisition_id, item_id, request_fingerprint
    ) VALUES (?, 'create_draft', 'req-1', NULL, 'fingerprint-create')
  `).run('create-operation');

  const operation = db.prepare('SELECT * FROM material_requisition_operations WHERE operation_key = ?').get('create-operation');
  assert.equal(operation.item_id, null);
  assert.equal(operation.action, 'create_draft');
});

test('persisted-line status reconciliation sees both final receipts', () => {
  const db = minimalPreMigrationDatabase();
  db.exec(migrationSql);
  seedRequisition(db, { itemIds: ['item-a', 'item-b'] });
  db.exec("UPDATE material_requisition_items SET status = 'issued', issued_quantity = 5 WHERE requisition_id = 'req-1'");

  const reconcile = db.prepare(`
    UPDATE material_requisitions
    SET status = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM material_requisition_items
        WHERE requisition_id = material_requisitions.id AND status != 'cancelled' AND status != 'received'
      ) THEN 'received'
      WHEN NOT EXISTS (
        SELECT 1 FROM material_requisition_items
        WHERE requisition_id = material_requisitions.id AND status != 'cancelled' AND status NOT IN ('received', 'issued')
      ) THEN 'issued'
      ELSE 'partially_fulfilled'
    END
    WHERE id = ?
  `);
  db.prepare("UPDATE material_requisition_items SET engineer_received_quantity = 5, status = 'received' WHERE id = 'item-a'").run();
  reconcile.run('req-1');
  assert.equal(db.prepare("SELECT status FROM material_requisitions WHERE id = 'req-1'").get().status, 'issued');
  db.prepare("UPDATE material_requisition_items SET engineer_received_quantity = 5, status = 'received' WHERE id = 'item-b'").run();
  reconcile.run('req-1');
  assert.equal(db.prepare("SELECT status FROM material_requisitions WHERE id = 'req-1'").get().status, 'received');
});
