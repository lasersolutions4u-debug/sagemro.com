-- 039_field_workdays: photo-first multi-day onsite work records and protected evidence.

ALTER TABLE work_orders ADD COLUMN site_timezone TEXT;
ALTER TABLE work_orders ADD COLUMN expected_service_days INTEGER;
ALTER TABLE work_orders ADD COLUMN expected_completion_date TEXT;
ALTER TABLE work_orders ADD COLUMN planned_daily_start_time TEXT;
ALTER TABLE work_orders ADD COLUMN planned_daily_end_time TEXT;
ALTER TABLE work_orders ADD COLUMN updated_at TEXT;

-- Photo check-ins must retain a compatibility arrival record even when browser
-- location is unavailable. Rebuild the legacy table so those evidence fields
-- can remain honestly NULL while preserving existing arrival history.
CREATE TABLE work_order_arrival_checks_039 (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy_m REAL,
  coordinate_system TEXT,
  location_source TEXT NOT NULL DEFAULT 'browser',
  distance_m REAL,
  radius_m REAL,
  within_geofence INTEGER,
  failure_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
INSERT INTO work_order_arrival_checks_039 (
  id, work_order_id, engineer_id, latitude, longitude, accuracy_m,
  coordinate_system, location_source, distance_m, radius_m,
  within_geofence, failure_reason, created_at
)
SELECT
  id, work_order_id, engineer_id, latitude, longitude, accuracy_m,
  coordinate_system, location_source, distance_m, radius_m,
  within_geofence, failure_reason, created_at
FROM work_order_arrival_checks;
DROP TABLE work_order_arrival_checks;
ALTER TABLE work_order_arrival_checks_039 RENAME TO work_order_arrival_checks;
CREATE INDEX IF NOT EXISTS idx_arrival_checks_work_order
  ON work_order_arrival_checks(work_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arrival_checks_engineer
  ON work_order_arrival_checks(engineer_id, created_at);

CREATE TABLE IF NOT EXISTS work_order_field_days (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  site_local_date TEXT NOT NULL,
  site_timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'checked_in',
  check_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  expected_check_out_at TEXT,
  report_submitted_at TEXT,
  labor_hours REAL,
  completed_work TEXT,
  issues_risks TEXT,
  next_plan TEXT,
  customer_support_needed TEXT,
  internal_note TEXT,
  late_reason TEXT,
  location_status TEXT NOT NULL DEFAULT 'unavailable',
  latitude REAL,
  longitude REAL,
  accuracy_m REAL,
  coordinate_system TEXT,
  location_source TEXT,
  distance_m REAL,
  radius_m REAL,
  within_geofence INTEGER,
  check_in_idempotency_key TEXT,
  report_idempotency_key TEXT,
  checkout_reminder_sent_at TEXT,
  overdue_notification_sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(id, work_order_id),
  UNIQUE(work_order_id, engineer_id, site_local_date),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_field_days_work_order_date
  ON work_order_field_days(work_order_id, site_local_date DESC);
CREATE INDEX IF NOT EXISTS idx_field_days_status
  ON work_order_field_days(status, expected_check_out_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_days_check_in_idempotency
  ON work_order_field_days(check_in_idempotency_key)
  WHERE check_in_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_days_report_idempotency
  ON work_order_field_days(report_idempotency_key)
  WHERE report_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS work_order_field_day_media (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  field_day_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploader_type TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  customer_visible INTEGER NOT NULL DEFAULT 1,
  capture_source TEXT NOT NULL,
  privacy_retention_due_at TEXT,
  retention_claim_token TEXT,
  retention_claimed_at TEXT,
  deleted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (field_day_id, work_order_id) REFERENCES work_order_field_days(id, work_order_id)
);
CREATE INDEX IF NOT EXISTS idx_field_day_media_day
  ON work_order_field_day_media(field_day_id, created_at);
CREATE INDEX IF NOT EXISTS idx_field_day_media_retention
  ON work_order_field_day_media(privacy_retention_due_at, deleted_at);
CREATE INDEX IF NOT EXISTS idx_field_day_media_retention_claim
  ON work_order_field_day_media(retention_claim_token, retention_claimed_at);

CREATE TABLE IF NOT EXISTS work_order_extension_requests (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  field_day_id TEXT,
  engineer_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  customer_explanation TEXT NOT NULL,
  internal_note TEXT,
  requested_additional_days INTEGER NOT NULL,
  proposed_completion_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  original_plan TEXT NOT NULL,
  approved_plan TEXT,
  decided_by TEXT,
  decision_reason TEXT,
  decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (field_day_id, work_order_id) REFERENCES work_order_field_days(id, work_order_id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_extension_requests_work_order
  ON work_order_extension_requests(work_order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_requests_one_pending
  ON work_order_extension_requests(work_order_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS work_order_field_day_revisions (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  field_day_id TEXT NOT NULL,
  previous_report TEXT NOT NULL,
  changed_by_type TEXT NOT NULL,
  changed_by_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (field_day_id, work_order_id) REFERENCES work_order_field_days(id, work_order_id)
);
CREATE INDEX IF NOT EXISTS idx_field_day_revisions_day
  ON work_order_field_day_revisions(field_day_id, created_at DESC);

CREATE TABLE IF NOT EXISTS work_order_field_evidence_holds (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  reason_category TEXT NOT NULL CHECK (reason_category IN ('complaint', 'warranty', 'safety_review', 'legal_hold', 'dispute')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  opened_by TEXT NOT NULL,
  opened_at TEXT DEFAULT (datetime('now')),
  resolved_by TEXT,
  resolution_reason TEXT,
  resolved_at TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_field_evidence_holds_work_order
  ON work_order_field_evidence_holds(work_order_id, status, opened_at DESC);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('039_field_workdays', 'Photo-first multi-day onsite work records, daily reports, extensions, and protected evidence');
