ALTER TABLE work_orders ADD COLUMN short_title TEXT;

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('042_work_order_short_title', 'Persisted short titles for service work orders');
