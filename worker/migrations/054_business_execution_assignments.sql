CREATE TABLE IF NOT EXISTS business_execution_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  work_order_id TEXT NOT NULL UNIQUE REFERENCES work_orders(id),
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id),
  staff_name TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  revision INTEGER NOT NULL CHECK (revision = 1),
  quote_version INTEGER NOT NULL CHECK (quote_version > 0),
  market TEXT NOT NULL CHECK (market IN ('com','cn')),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  scope_snapshot TEXT NOT NULL CHECK (json_valid(scope_snapshot)),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status = 'assigned')
);
CREATE TRIGGER IF NOT EXISTS business_execution_insert_guard
BEFORE INSERT ON business_execution_assignments
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM work_orders WHERE id = NEW.work_order_id AND status = 'pending_payment'
      AND engineer_id IS NULL AND assigned_regional_lead_id IS NULL
      AND started_at IS NULL AND resolved_at IS NULL AND completed_at IS NULL
  ) THEN 1 ELSE RAISE(ABORT, 'business execution state changed') END;
END;
CREATE TRIGGER IF NOT EXISTS business_execution_work_order_guard
BEFORE UPDATE ON work_orders
WHEN EXISTS (SELECT 1 FROM business_execution_assignments WHERE work_order_id = OLD.id)
  AND (NEW.engineer_id IS NOT NULL OR NEW.assigned_regional_lead_id IS NOT NULL
    OR NEW.started_at IS NOT NULL OR NEW.resolved_at IS NOT NULL OR NEW.completed_at IS NOT NULL
    OR NEW.status IN ('in_progress','in_service','resolved','pending_review','completed'))
BEGIN
  SELECT RAISE(ABORT, 'business execution is assigned; service execution is not enabled');
END;
INSERT OR IGNORE INTO _migrations(version,note)
VALUES ('054_business_execution_assignments','Internal business execution identity and Admin assignment');
