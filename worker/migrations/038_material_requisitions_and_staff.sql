-- 038_material_requisitions_and_staff.sql
-- Internal staff accounts and work-order material requisition operations.

CREATE TABLE IF NOT EXISTS admin_staff_accounts (
    id TEXT PRIMARY KEY,
    normalized_login TEXT NOT NULL UNIQUE,
    normalized_phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'operations', 'warehouse', 'procurement')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    display_name TEXT NOT NULL,
    market_scope TEXT NOT NULL DEFAULT 'all' CHECK (market_scope IN ('all', 'com', 'cn')),
    must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_staff_active_role
  ON admin_staff_accounts(is_active, role);
CREATE INDEX IF NOT EXISTS idx_admin_staff_market
  ON admin_staff_accounts(market_scope, is_active);

CREATE TABLE IF NOT EXISTS material_requisitions (
    id TEXT PRIMARY KEY,
    requisition_no TEXT NOT NULL UNIQUE,
    market TEXT NOT NULL DEFAULT 'com',
    work_order_id TEXT NOT NULL,
    requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('engineer', 'admin')),
    requested_by_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
      'draft', 'submitted', 'approved', 'processing', 'partially_fulfilled',
      'ready', 'issued', 'received', 'closed', 'rejected', 'cancelled'
    )),
    urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'critical')),
    required_date TEXT,
    purpose TEXT,
    approved_by TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    assigned_warehouse_staff_id TEXT,
    assigned_procurement_staff_id TEXT,
    issued_at TEXT,
    received_at TEXT,
    closed_at TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_material_requisitions_market_status
  ON material_requisitions(market, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_work_order
  ON material_requisitions(work_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_requester
  ON material_requisitions(requested_by_type, requested_by_id, created_at DESC);

CREATE TABLE IF NOT EXISTS material_requisition_items (
    id TEXT PRIMARY KEY,
    requisition_id TEXT NOT NULL,
    material_id TEXT,
    material_code TEXT,
    name TEXT NOT NULL,
    name_en TEXT,
    spec TEXT,
    brand TEXT,
    unit TEXT NOT NULL DEFAULT 'pcs',
    requested_quantity REAL NOT NULL CHECK (requested_quantity > 0),
    stock_allocated_quantity REAL NOT NULL DEFAULT 0 CHECK (stock_allocated_quantity >= 0),
    procurement_ordered_quantity REAL NOT NULL DEFAULT 0 CHECK (procurement_ordered_quantity >= 0),
    procurement_received_quantity REAL NOT NULL DEFAULT 0 CHECK (procurement_received_quantity >= 0),
    issued_quantity REAL NOT NULL DEFAULT 0 CHECK (issued_quantity >= 0),
    returned_quantity REAL NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
    engineer_received_quantity REAL NOT NULL DEFAULT 0 CHECK (engineer_received_quantity >= 0),
    fulfillment_source TEXT NOT NULL DEFAULT 'unassigned' CHECK (fulfillment_source IN ('unassigned', 'stock', 'procurement', 'mixed')),
    expected_arrival TEXT,
    supplier_reference TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
      'pending', 'stock_allocated', 'purchasing', 'partially_ready',
      'ready', 'issued', 'received', 'cancelled'
    )),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE INDEX IF NOT EXISTS idx_material_requisition_items_requisition
  ON material_requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_material_requisition_items_material
  ON material_requisition_items(material_id);
CREATE INDEX IF NOT EXISTS idx_material_requisition_items_status
  ON material_requisition_items(status);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('038_material_requisitions_and_staff', 'Internal staff accounts and material requisition operations');
