PRAGMA defer_foreign_keys = ON;

CREATE TABLE work_order_arrival_checks_055_backup AS SELECT * FROM work_order_arrival_checks;
CREATE TABLE work_order_field_days_055_backup AS SELECT * FROM work_order_field_days;
CREATE TABLE work_order_field_day_media_055_backup AS SELECT * FROM work_order_field_day_media;
CREATE TABLE work_order_extension_requests_055_backup AS SELECT * FROM work_order_extension_requests;
CREATE TABLE work_order_field_day_revisions_055_backup AS SELECT * FROM work_order_field_day_revisions;
DROP TABLE work_order_field_day_revisions;
DROP TABLE work_order_extension_requests;
DROP TABLE work_order_field_day_media;
DROP TABLE work_order_field_days;
DROP TABLE work_order_arrival_checks;

CREATE TABLE IF NOT EXISTS work_order_arrival_checks (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT,
  staff_id TEXT,
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
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
  FOREIGN KEY (staff_id) REFERENCES admin_staff_accounts(id),
  CHECK ((engineer_id IS NOT NULL) <> (staff_id IS NOT NULL))
);
INSERT INTO work_order_arrival_checks (id,work_order_id,engineer_id,latitude,longitude,accuracy_m,coordinate_system,location_source,distance_m,radius_m,within_geofence,failure_reason,created_at) SELECT id,work_order_id,engineer_id,latitude,longitude,accuracy_m,coordinate_system,location_source,distance_m,radius_m,within_geofence,failure_reason,created_at FROM work_order_arrival_checks_055_backup;
DROP TABLE work_order_arrival_checks_055_backup;
CREATE INDEX IF NOT EXISTS idx_arrival_checks_work_order ON work_order_arrival_checks(work_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arrival_checks_engineer ON work_order_arrival_checks(engineer_id, created_at);

CREATE TABLE IF NOT EXISTS work_order_field_days (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT,
  staff_id TEXT,
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
  FOREIGN KEY (engineer_id) REFERENCES engineers(id),
  FOREIGN KEY (staff_id) REFERENCES admin_staff_accounts(id),
  CHECK ((engineer_id IS NOT NULL) <> (staff_id IS NOT NULL))
);
INSERT INTO work_order_field_days (id,work_order_id,engineer_id,site_local_date,site_timezone,status,check_in_at,expected_check_out_at,report_submitted_at,labor_hours,completed_work,issues_risks,next_plan,customer_support_needed,internal_note,late_reason,location_status,latitude,longitude,accuracy_m,coordinate_system,location_source,distance_m,radius_m,within_geofence,check_in_idempotency_key,report_idempotency_key,checkout_reminder_sent_at,overdue_notification_sent_at,created_at,updated_at) SELECT id,work_order_id,engineer_id,site_local_date,site_timezone,status,check_in_at,expected_check_out_at,report_submitted_at,labor_hours,completed_work,issues_risks,next_plan,customer_support_needed,internal_note,late_reason,location_status,latitude,longitude,accuracy_m,coordinate_system,location_source,distance_m,radius_m,within_geofence,check_in_idempotency_key,report_idempotency_key,checkout_reminder_sent_at,overdue_notification_sent_at,created_at,updated_at FROM work_order_field_days_055_backup;
DROP TABLE work_order_field_days_055_backup;
CREATE INDEX IF NOT EXISTS idx_field_days_work_order_date ON work_order_field_days(work_order_id, site_local_date DESC);
CREATE INDEX IF NOT EXISTS idx_field_days_status ON work_order_field_days(status, expected_check_out_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_days_check_in_idempotency ON work_order_field_days(check_in_idempotency_key) WHERE check_in_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_days_report_idempotency ON work_order_field_days(report_idempotency_key) WHERE report_idempotency_key IS NOT NULL;

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
INSERT INTO work_order_field_day_media (id,work_order_id,field_day_id,purpose,object_key,mime_type,file_size,uploader_type,uploader_id,customer_visible,capture_source,privacy_retention_due_at,retention_claim_token,retention_claimed_at,deleted_at,created_at) SELECT id,work_order_id,field_day_id,purpose,object_key,mime_type,file_size,uploader_type,uploader_id,customer_visible,capture_source,privacy_retention_due_at,retention_claim_token,retention_claimed_at,deleted_at,created_at FROM work_order_field_day_media_055_backup;
DROP TABLE work_order_field_day_media_055_backup;
CREATE INDEX IF NOT EXISTS idx_field_day_media_day ON work_order_field_day_media(field_day_id, created_at);
CREATE INDEX IF NOT EXISTS idx_field_day_media_retention ON work_order_field_day_media(privacy_retention_due_at, deleted_at);
CREATE INDEX IF NOT EXISTS idx_field_day_media_retention_claim ON work_order_field_day_media(retention_claim_token, retention_claimed_at);

CREATE TABLE IF NOT EXISTS work_order_extension_requests (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  field_day_id TEXT,
  engineer_id TEXT,
  staff_id TEXT,
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
  FOREIGN KEY (engineer_id) REFERENCES engineers(id),
  FOREIGN KEY (staff_id) REFERENCES admin_staff_accounts(id),
  CHECK ((engineer_id IS NOT NULL) <> (staff_id IS NOT NULL))
);
INSERT INTO work_order_extension_requests (id,work_order_id,field_day_id,engineer_id,reason,customer_explanation,internal_note,requested_additional_days,proposed_completion_date,status,original_plan,approved_plan,decided_by,decision_reason,decided_at,created_at,updated_at) SELECT id,work_order_id,field_day_id,engineer_id,reason,customer_explanation,internal_note,requested_additional_days,proposed_completion_date,status,original_plan,approved_plan,decided_by,decision_reason,decided_at,created_at,updated_at FROM work_order_extension_requests_055_backup;
DROP TABLE work_order_extension_requests_055_backup;
CREATE INDEX IF NOT EXISTS idx_extension_requests_work_order ON work_order_extension_requests(work_order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_requests_one_pending ON work_order_extension_requests(work_order_id) WHERE status = 'pending';

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
INSERT INTO work_order_field_day_revisions (id,work_order_id,field_day_id,previous_report,changed_by_type,changed_by_id,reason,created_at) SELECT id,work_order_id,field_day_id,previous_report,changed_by_type,changed_by_id,reason,created_at FROM work_order_field_day_revisions_055_backup;
DROP TABLE work_order_field_day_revisions_055_backup;
CREATE INDEX IF NOT EXISTS idx_field_day_revisions_day ON work_order_field_day_revisions(field_day_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_service_execution (
  work_order_id TEXT PRIMARY KEY REFERENCES work_orders(id),
  staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  requested_at TEXT,
  requested_by TEXT REFERENCES admin_staff_accounts(id),
  approved_at TEXT,
  approved_by TEXT,
  approved_quote_version INTEGER,
  CHECK ((approved_at IS NULL) = (approved_by IS NULL))
);
CREATE TABLE IF NOT EXISTS business_service_actions (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id),
  staff_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_days_staff_date
  ON work_order_field_days(work_order_id,staff_id,site_local_date) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_arrival_checks_staff ON work_order_arrival_checks(staff_id,created_at);
DROP TRIGGER IF EXISTS business_execution_work_order_guard;
CREATE TRIGGER business_execution_work_order_guard
BEFORE UPDATE ON work_orders
WHEN EXISTS (SELECT 1 FROM business_execution_assignments WHERE work_order_id=OLD.id)
  AND (NEW.engineer_id IS NOT NULL OR NEW.assigned_regional_lead_id IS NOT NULL
    OR ((NEW.started_at IS NOT NULL OR NEW.resolved_at IS NOT NULL OR NEW.completed_at IS NOT NULL
      OR NEW.status IN ('in_progress','in_service','resolved','pending_review','completed'))
      AND NOT EXISTS (SELECT 1 FROM business_service_execution service
        JOIN business_execution_assignments assignment ON assignment.work_order_id=service.work_order_id
        WHERE service.work_order_id=OLD.id AND service.staff_id=assignment.staff_id
          AND service.approved_at IS NOT NULL AND service.approved_by IS NOT NULL)))
BEGIN
  SELECT RAISE(ABORT, 'business execution requires Admin service approval and exclusive assignment');
END;
INSERT OR IGNORE INTO _migrations(version,note)
VALUES ('055_business_service_execution','Business service approval and real staff field-work actors');
