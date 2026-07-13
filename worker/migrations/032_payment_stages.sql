-- Separate advance and balance payment records for service work orders.
ALTER TABLE work_order_payments ADD COLUMN payment_stage TEXT NOT NULL DEFAULT 'advance';
ALTER TABLE work_order_payments ADD COLUMN quote_total_amount INTEGER DEFAULT 0;
ALTER TABLE work_order_payments ADD COLUMN advance_amount INTEGER DEFAULT 0;
ALTER TABLE work_order_payments ADD COLUMN balance_amount INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_work_order_payments_stage
  ON work_order_payments(work_order_id, payment_stage, created_at);

INSERT OR IGNORE INTO _migrations (version, note)
VALUES ('032_payment_stages', 'Separate advance and balance payment stages for service work orders');
