ALTER TABLE work_orders ADD COLUMN arrival_verification_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN service_address TEXT;
ALTER TABLE work_orders ADD COLUMN service_latitude REAL;
ALTER TABLE work_orders ADD COLUMN service_longitude REAL;
ALTER TABLE work_orders ADD COLUMN service_accuracy_m REAL;
ALTER TABLE work_orders ADD COLUMN service_coordinate_system TEXT DEFAULT 'wgs84';
ALTER TABLE work_orders ADD COLUMN service_location_source TEXT;
ALTER TABLE work_orders ADD COLUMN service_location_confirmed_at TEXT;
ALTER TABLE work_orders ADD COLUMN arrival_verified_at TEXT;
ALTER TABLE work_orders ADD COLUMN arrival_distance_m REAL;
ALTER TABLE work_orders ADD COLUMN arrival_radius_m REAL;
ALTER TABLE work_orders ADD COLUMN arrival_accuracy_m REAL;
ALTER TABLE work_orders ADD COLUMN arrival_latitude REAL;
ALTER TABLE work_orders ADD COLUMN arrival_longitude REAL;
ALTER TABLE work_orders ADD COLUMN arrival_coordinate_system TEXT;
ALTER TABLE work_orders ADD COLUMN arrival_location_source TEXT;

CREATE TABLE IF NOT EXISTS work_order_arrival_checks (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy_m REAL,
    coordinate_system TEXT NOT NULL DEFAULT 'wgs84',
    location_source TEXT NOT NULL DEFAULT 'browser',
    distance_m REAL,
    radius_m REAL,
    within_geofence INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_arrival_checks_work_order ON work_order_arrival_checks(work_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arrival_checks_engineer ON work_order_arrival_checks(engineer_id, created_at);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('033_work_order_location_verification', 'Add service location fields and engineer arrival verification records');
