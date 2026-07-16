ALTER TABLE work_orders ADD COLUMN onsite_conversion_status TEXT NOT NULL DEFAULT 'not_requested';
ALTER TABLE work_orders ADD COLUMN onsite_conversion_requested_at TEXT;
ALTER TABLE work_orders ADD COLUMN onsite_conversion_requested_by TEXT;
ALTER TABLE work_orders ADD COLUMN onsite_conversion_request_note TEXT;
ALTER TABLE work_orders ADD COLUMN onsite_conversion_confirmed_at TEXT;
ALTER TABLE work_orders ADD COLUMN onsite_conversion_confirmed_by TEXT;
ALTER TABLE work_orders ADD COLUMN onsite_conversion_confirmation_note TEXT;
ALTER TABLE work_orders ADD COLUMN arrival_override_at TEXT;
ALTER TABLE work_orders ADD COLUMN arrival_override_by TEXT;
ALTER TABLE work_orders ADD COLUMN arrival_override_reason TEXT;

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('035_onsite_conversion_workflow', 'Add audited remote-to-onsite conversion and arrival override workflow');
