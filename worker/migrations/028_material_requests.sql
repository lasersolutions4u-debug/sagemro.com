-- 028_material_requests.sql
-- Engineer-submitted requests for missing parts before Admin adds them to material master data.

CREATE TABLE IF NOT EXISTS material_requests (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL DEFAULT 'com',
    status TEXT NOT NULL DEFAULT 'submitted',
    work_order_id TEXT,
    requested_by_type TEXT NOT NULL,
    requested_by_id TEXT NOT NULL,
    suggested_name TEXT NOT NULL,
    suggested_name_en TEXT,
    category TEXT DEFAULT 'other',
    spec TEXT,
    brand TEXT,
    compatible_equipment TEXT,
    supplier_suggestion TEXT,
    expected_quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    usage_note TEXT,
    urgency TEXT DEFAULT 'normal',
    attachment_urls TEXT DEFAULT '[]',
    linked_material_id TEXT,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (linked_material_id) REFERENCES materials(id)
);

CREATE INDEX IF NOT EXISTS idx_material_requests_market ON material_requests(market);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_requests_work_order ON material_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_requester ON material_requests(requested_by_type, requested_by_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_created_at ON material_requests(created_at);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('028_material_requests', 'Engineer material request workflow for Admin-reviewed material master additions');
