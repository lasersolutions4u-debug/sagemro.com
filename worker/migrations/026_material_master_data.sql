-- 026_material_master_data.sql
-- Admin-managed material master data and manual inventory adjustment records.

CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL DEFAULT 'com',
    material_code TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    name TEXT NOT NULL,
    name_en TEXT,
    spec TEXT,
    brand TEXT,
    compatible_equipment TEXT,
    supplier TEXT,
    production_code TEXT,
    unit TEXT DEFAULT 'pcs',
    reference_cost REAL DEFAULT 0,
    reference_price REAL DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    safety_stock INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(market, material_code)
);

CREATE INDEX IF NOT EXISTS idx_materials_market ON materials(market);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);

CREATE TABLE IF NOT EXISTS material_inventory_adjustments (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    delta INTEGER NOT NULL,
    before_quantity INTEGER NOT NULL,
    after_quantity INTEGER NOT NULL,
    reason TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE INDEX IF NOT EXISTS idx_material_adjustments_material ON material_inventory_adjustments(material_id);
CREATE INDEX IF NOT EXISTS idx_material_adjustments_created_at ON material_inventory_adjustments(created_at);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('026_material_master_data', 'Admin-managed material master data and manual inventory adjustments');
