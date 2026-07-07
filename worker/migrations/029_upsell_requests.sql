-- 029_upsell_requests.sql
-- Engineer-submitted upsell and retrofit demand records.

CREATE TABLE IF NOT EXISTS upsell_requests (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL DEFAULT 'com',
  source_type TEXT NOT NULL DEFAULT 'engineer_workspace',
  work_order_id TEXT,
  customer_id TEXT,
  engineer_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other_retrofit',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  site_context TEXT,
  expected_timeline TEXT DEFAULT 'unclear',
  budget_signal TEXT DEFAULT 'unknown',
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending_assignment',
  assigned_sales_owner TEXT,
  admin_note TEXT,
  quote_status TEXT DEFAULT 'not_started',
  deal_result TEXT DEFAULT 'undecided',
  handover_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_upsell_requests_market ON upsell_requests(market);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_status ON upsell_requests(status);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_category ON upsell_requests(category);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_engineer ON upsell_requests(engineer_id);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_work_order ON upsell_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_created_at ON upsell_requests(created_at);

INSERT OR IGNORE INTO _migrations (version, note)
VALUES ('029_upsell_requests', '工程师增购与改造需求记录');
