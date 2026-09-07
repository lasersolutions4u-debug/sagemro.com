ALTER TABLE work_order_pricing ADD COLUMN quote_source TEXT NOT NULL DEFAULT 'engineer' CHECK (quote_source IN ('engineer','business'));
ALTER TABLE work_order_pricing_history ADD COLUMN quote_source TEXT NOT NULL DEFAULT 'engineer' CHECK (quote_source IN ('engineer','business'));
CREATE TABLE IF NOT EXISTS business_quote_drafts (
  work_order_id TEXT PRIMARY KEY REFERENCES work_orders(id),
  revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision >= 1),
  submitted_revision INTEGER,
  author_staff_id TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('CNY','USD')),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_quote_cost_snapshots (
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  quote_version INTEGER NOT NULL CHECK (typeof(quote_version) = 'integer' AND quote_version >= 1),
  author_staff_id TEXT NOT NULL,
  draft_revision INTEGER NOT NULL CHECK (typeof(draft_revision) = 'integer' AND draft_revision >= 1),
  currency TEXT NOT NULL CHECK (currency IN ('CNY','USD')),
  quoted_amount INTEGER NOT NULL CHECK (typeof(quoted_amount) = 'integer' AND quoted_amount BETWEEN 1 AND 9007199254740991),
  parts_cost INTEGER NOT NULL CHECK (typeof(parts_cost) = 'integer' AND parts_cost BETWEEN 0 AND 9007199254740991),
  engineer_cost INTEGER NOT NULL CHECK (typeof(engineer_cost) = 'integer' AND engineer_cost BETWEEN 0 AND 9007199254740991),
  travel_cost INTEGER NOT NULL CHECK (typeof(travel_cost) = 'integer' AND travel_cost BETWEEN 0 AND 9007199254740991),
  other_cost INTEGER NOT NULL CHECK (typeof(other_cost) = 'integer' AND other_cost BETWEEN 0 AND 9007199254740991),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (work_order_id, quote_version),
  UNIQUE (work_order_id, draft_revision)
);
CREATE TRIGGER IF NOT EXISTS business_quote_costs_no_update BEFORE UPDATE ON business_quote_cost_snapshots
BEGIN SELECT RAISE(ABORT, 'business quote costs immutable'); END;
CREATE TRIGGER IF NOT EXISTS business_quote_costs_no_delete BEFORE DELETE ON business_quote_cost_snapshots
BEGIN SELECT RAISE(ABORT, 'business quote costs immutable'); END;
INSERT OR IGNORE INTO _migrations(version,note) VALUES ('052_business_quote_costs','Private business quote drafts and immutable direct cost snapshots');
