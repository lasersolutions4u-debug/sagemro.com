ALTER TABLE work_orders ADD COLUMN service_mode TEXT NOT NULL DEFAULT 'remote';

UPDATE work_orders
SET service_mode = CASE
  WHEN arrival_verification_required = 1 THEN 'onsite'
  ELSE 'remote'
END
WHERE service_mode IS NULL OR service_mode = '' OR service_mode = 'remote';

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('034_add_service_mode', 'Allow remote, onsite, and hybrid service workflows');
