ALTER TABLE engineers ADD COLUMN payout_method TEXT DEFAULT 'paypal';
ALTER TABLE engineers ADD COLUMN paypal_account TEXT;
ALTER TABLE engineers ADD COLUMN bank_country TEXT;
ALTER TABLE engineers ADD COLUMN bank_swift_code TEXT;
ALTER TABLE engineers ADD COLUMN payout_notes TEXT;

CREATE TABLE IF NOT EXISTS work_order_payouts (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL UNIQUE,
  engineer_id TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  method TEXT,
  status TEXT DEFAULT 'not_ready',
  transaction_reference TEXT,
  paid_at TEXT,
  internal_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_work_order_payouts_status ON work_order_payouts(status);
CREATE INDEX IF NOT EXISTS idx_work_order_payouts_engineer ON work_order_payouts(engineer_id);

INSERT OR IGNORE INTO _migrations (version, note)
VALUES ('031_engineer_payouts', 'Engineer payout methods and per-order service payment closure');
