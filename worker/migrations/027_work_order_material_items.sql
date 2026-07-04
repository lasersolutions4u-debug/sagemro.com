-- 027_work_order_material_items.sql
-- Work-order-scoped material references for quotes, preparation, and service reports.

CREATE TABLE IF NOT EXISTS work_order_material_items (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    material_id TEXT,
    purpose TEXT NOT NULL DEFAULT 'quote',
    material_code TEXT,
    name TEXT NOT NULL,
    name_en TEXT,
    spec TEXT,
    brand TEXT,
    unit TEXT DEFAULT 'pcs',
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    line_total REAL DEFAULT 0,
    note TEXT,
    status TEXT DEFAULT 'active',
    created_by_type TEXT,
    created_by_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE INDEX IF NOT EXISTS idx_work_order_material_items_wo ON work_order_material_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_material_items_material ON work_order_material_items(material_id);
CREATE INDEX IF NOT EXISTS idx_work_order_material_items_purpose ON work_order_material_items(work_order_id, purpose);
CREATE INDEX IF NOT EXISTS idx_work_order_material_items_status ON work_order_material_items(status);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('027_work_order_material_items', 'Work order material item references for quote, preparation, and service report lines');
