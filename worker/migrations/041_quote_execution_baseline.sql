-- 041_quote_execution_baseline: immutable quote schedules and receipt collection records.

ALTER TABLE work_order_pricing ADD COLUMN quote_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE work_order_pricing ADD COLUMN expected_service_days INTEGER;
ALTER TABLE work_order_pricing ADD COLUMN payment_plan_mode TEXT NOT NULL DEFAULT 'single'
  CHECK (payment_plan_mode IN ('single', 'installments'));

ALTER TABLE work_order_pricing_history ADD COLUMN expected_service_days INTEGER;
ALTER TABLE work_order_pricing_history ADD COLUMN payment_plan_mode TEXT NOT NULL DEFAULT 'single'
  CHECK (payment_plan_mode IN ('single', 'installments'));
ALTER TABLE work_order_pricing_history ADD COLUMN quote_kind TEXT NOT NULL DEFAULT 'baseline';
ALTER TABLE work_order_pricing_history ADD COLUMN parent_quote_version INTEGER;
ALTER TABLE work_order_pricing_history ADD COLUMN status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE work_order_pricing_history ADD COLUMN approved_at TEXT;
ALTER TABLE work_order_pricing_history ADD COLUMN confirmed_at TEXT;

ALTER TABLE work_orders ADD COLUMN quote_expected_service_days INTEGER;
ALTER TABLE work_orders ADD COLUMN approved_extension_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN active_quote_version INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_pricing_id_order
  ON work_order_pricing(id, work_order_id);

CREATE TABLE IF NOT EXISTS work_order_payment_schedule (
  id TEXT PRIMARY KEY,
  pricing_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  quote_version INTEGER NOT NULL CHECK (quote_version >= 1 AND typeof(quote_version) = 'integer'),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 6 AND typeof(sequence) = 'integer'),
  amount INTEGER NOT NULL CHECK (amount > 0 AND typeof(amount) = 'integer'),
  currency TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'before_start', 'on_arrival', 'milestone', 'on_completion', 'on_acceptance', 'fixed_date'
  )),
  due_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  required_before_start INTEGER NOT NULL DEFAULT 0
    CHECK (required_before_start IN (0, 1) AND typeof(required_before_start) = 'integer'),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (id, work_order_id),
  UNIQUE (pricing_id, quote_version, sequence),
  CHECK (
    (trigger_type = 'fixed_date'
      AND due_date IS NOT NULL
      AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
    OR (trigger_type <> 'fixed_date' AND due_date IS NULL)
  ),
  CHECK (trigger_type <> 'milestone' OR trim(description) <> ''),
  FOREIGN KEY (pricing_id, work_order_id) REFERENCES work_order_pricing(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_order_version
  ON work_order_payment_schedule(work_order_id, quote_version, sequence);

CREATE TABLE IF NOT EXISTS work_order_installments (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL UNIQUE,
  work_order_id TEXT NOT NULL,
  quote_version INTEGER NOT NULL CHECK (quote_version >= 1 AND typeof(quote_version) = 'integer'),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 6 AND typeof(sequence) = 'integer'),
  amount INTEGER NOT NULL CHECK (amount > 0 AND typeof(amount) = 'integer'),
  currency TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'before_start', 'on_arrival', 'milestone', 'on_completion', 'on_acceptance', 'fixed_date'
  )),
  due_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  required_before_start INTEGER NOT NULL DEFAULT 0
    CHECK (required_before_start IN (0, 1) AND typeof(required_before_start) = 'integer'),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'due', 'collecting', 'pending_confirmation',
    'partially_received', 'received', 'overdue', 'exception'
  )),
  payment_method TEXT,
  collection_started_at TEXT,
  received_amount INTEGER NOT NULL DEFAULT 0 CHECK (
    received_amount >= 0 AND received_amount <= amount AND typeof(received_amount) = 'integer'
  ),
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (id, work_order_id),
  UNIQUE (work_order_id, quote_version, sequence),
  CHECK (
    (trigger_type = 'fixed_date'
      AND due_date IS NOT NULL
      AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
    OR (trigger_type <> 'fixed_date' AND due_date IS NULL)
  ),
  CHECK (trigger_type <> 'milestone' OR trim(description) <> ''),
  FOREIGN KEY (schedule_id, work_order_id)
    REFERENCES work_order_payment_schedule(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_installments_order_status
  ON work_order_installments(work_order_id, status, sequence);
CREATE INDEX IF NOT EXISTS idx_installments_status_due_date
  ON work_order_installments(status, due_date);

CREATE TRIGGER IF NOT EXISTS quote_execution_installment_snapshot_insert
BEFORE INSERT ON work_order_installments
WHEN NOT EXISTS (
  SELECT 1 FROM work_order_payment_schedule schedule
  WHERE schedule.id = NEW.schedule_id
    AND schedule.work_order_id = NEW.work_order_id
    AND schedule.quote_version = NEW.quote_version
    AND schedule.sequence = NEW.sequence
    AND schedule.amount = NEW.amount
    AND schedule.currency = NEW.currency
    AND schedule.trigger_type = NEW.trigger_type
    AND schedule.due_date IS NEW.due_date
    AND schedule.description = NEW.description
    AND schedule.required_before_start = NEW.required_before_start
)
BEGIN
  SELECT RAISE(ABORT, 'installment schedule snapshot mismatch');
END;

CREATE TRIGGER IF NOT EXISTS quote_execution_installment_snapshot_update
BEFORE UPDATE ON work_order_installments
WHEN NOT EXISTS (
  SELECT 1 FROM work_order_payment_schedule schedule
  WHERE schedule.id = NEW.schedule_id
    AND schedule.work_order_id = NEW.work_order_id
    AND schedule.quote_version = NEW.quote_version
    AND schedule.sequence = NEW.sequence
    AND schedule.amount = NEW.amount
    AND schedule.currency = NEW.currency
    AND schedule.trigger_type = NEW.trigger_type
    AND schedule.due_date IS NEW.due_date
    AND schedule.description = NEW.description
    AND schedule.required_before_start = NEW.required_before_start
)
BEGIN
  SELECT RAISE(ABORT, 'installment schedule snapshot mismatch');
END;

CREATE TRIGGER IF NOT EXISTS quote_execution_schedule_update_guard
BEFORE UPDATE ON work_order_payment_schedule
WHEN EXISTS (
  SELECT 1 FROM work_order_pricing_history history
  WHERE history.status IN ('approved', 'confirmed')
    AND (
      (history.pricing_id = OLD.pricing_id AND history.version = OLD.quote_version)
      OR (history.pricing_id = NEW.pricing_id AND history.version = NEW.quote_version)
    )
)
OR EXISTS (
  SELECT 1 FROM work_order_installments installment
  WHERE installment.schedule_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'protected quote payment schedule');
END;

CREATE TRIGGER IF NOT EXISTS quote_execution_schedule_delete_guard
BEFORE DELETE ON work_order_payment_schedule
WHEN EXISTS (
  SELECT 1 FROM work_order_pricing_history history
  WHERE history.pricing_id = OLD.pricing_id
    AND history.version = OLD.quote_version
    AND history.status IN ('approved', 'confirmed')
)
OR EXISTS (
  SELECT 1 FROM work_order_installments installment
  WHERE installment.schedule_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'protected quote payment schedule');
END;

CREATE TABLE IF NOT EXISTS work_order_receipt_claims (
  id TEXT PRIMARY KEY,
  installment_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  claimed_amount INTEGER NOT NULL CHECK (claimed_amount > 0 AND typeof(claimed_amount) = 'integer'),
  transaction_reference TEXT,
  engineer_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_amount INTEGER CHECK (
    confirmed_amount IS NULL
    OR (confirmed_amount >= 0 AND typeof(confirmed_amount) = 'integer')
  ),
  decision_reason TEXT,
  decided_by TEXT,
  decided_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  decision_idempotency_key TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (id, work_order_id),
  FOREIGN KEY (installment_id, work_order_id)
    REFERENCES work_order_installments(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_claims_installment_status
  ON work_order_receipt_claims(installment_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_receipt_claims_order_status
  ON work_order_receipt_claims(work_order_id, status, created_at);

CREATE TABLE IF NOT EXISTS work_order_receipt_evidence (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE,
  work_order_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND typeof(file_size) = 'integer'),
  uploader_type TEXT NOT NULL CHECK (uploader_type IN ('engineer', 'customer', 'admin')),
  uploader_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (claim_id, work_order_id)
    REFERENCES work_order_receipt_claims(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_evidence_order
  ON work_order_receipt_evidence(work_order_id, created_at);

-- Exact quote totals and at least one start prerequisite span schedule rows, so
-- they remain transactional API invariants. Safe-integer upper bounds and real
-- calendar-date validity also remain Worker validation responsibilities.

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('041_quote_execution_baseline', 'Immutable quote schedules, installments, and private receipt evidence metadata');
