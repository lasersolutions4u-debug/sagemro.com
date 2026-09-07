PRAGMA defer_foreign_keys = ON;
CREATE TABLE receipt_evidence_migration_copy AS SELECT * FROM work_order_receipt_evidence;
DROP TABLE work_order_receipt_evidence;
CREATE TABLE work_order_receipt_claims_new (
  id TEXT PRIMARY KEY,
  installment_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT,
  submitted_by_staff_id TEXT,
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
  CHECK ((engineer_id IS NOT NULL) + (submitted_by_staff_id IS NOT NULL) = 1),
  UNIQUE (id, work_order_id),
  FOREIGN KEY (installment_id, work_order_id)
    REFERENCES work_order_installments(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
INSERT INTO work_order_receipt_claims_new (id,installment_id,work_order_id,engineer_id,claimed_amount,transaction_reference,engineer_note,status,confirmed_amount,decision_reason,decided_by,decided_at,idempotency_key,decision_idempotency_key,created_at)
SELECT id,installment_id,work_order_id,engineer_id,claimed_amount,transaction_reference,engineer_note,status,confirmed_amount,decision_reason,decided_by,decided_at,idempotency_key,decision_idempotency_key,created_at FROM work_order_receipt_claims;
DROP TABLE work_order_receipt_claims;
ALTER TABLE work_order_receipt_claims_new RENAME TO work_order_receipt_claims;
CREATE TABLE work_order_receipt_evidence (
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
  FOREIGN KEY (claim_id, work_order_id) REFERENCES work_order_receipt_claims(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
INSERT INTO work_order_receipt_evidence SELECT * FROM receipt_evidence_migration_copy;
DROP TABLE receipt_evidence_migration_copy;
CREATE INDEX idx_receipt_evidence_order ON work_order_receipt_evidence(work_order_id, created_at);
CREATE INDEX idx_receipt_claims_installment_status ON work_order_receipt_claims(installment_id,status,created_at);
CREATE INDEX idx_receipt_claims_order_status ON work_order_receipt_claims(work_order_id,status,created_at);
CREATE TRIGGER receipt_claim_actor_immutable BEFORE UPDATE OF engineer_id, submitted_by_staff_id ON work_order_receipt_claims
WHEN NEW.engineer_id IS NOT OLD.engineer_id OR NEW.submitted_by_staff_id IS NOT OLD.submitted_by_staff_id
BEGIN SELECT RAISE(ABORT, 'receipt actor snapshot is immutable'); END;
INSERT OR IGNORE INTO _migrations(version,note) VALUES ('053_business_receipt_actors','Business receipt submitter audit snapshots');
