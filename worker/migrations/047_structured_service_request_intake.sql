-- 047: Structured service-request intake fields for existing work orders.

ALTER TABLE work_orders ADD COLUMN service_request_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN service_request_kind TEXT;
ALTER TABLE work_orders ADD COLUMN device_types_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE work_orders ADD COLUMN device_brands_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE work_orders ADD COLUMN device_model TEXT;
ALTER TABLE work_orders ADD COLUMN region_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE work_orders ADD COLUMN alarm_code TEXT;
ALTER TABLE work_orders ADD COLUMN production_impact TEXT;
ALTER TABLE work_orders ADD COLUMN contact_name TEXT;
ALTER TABLE work_orders ADD COLUMN contact_email TEXT;
ALTER TABLE work_orders ADD COLUMN contact_phone TEXT;
ALTER TABLE work_orders ADD COLUMN contact_whatsapp TEXT;
ALTER TABLE work_orders ADD COLUMN contact_preference TEXT;

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('047_structured_service_request_intake', 'Structured service-request intake fields for work orders');
