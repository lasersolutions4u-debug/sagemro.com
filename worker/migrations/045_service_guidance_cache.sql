ALTER TABLE work_order_service_readiness ADD COLUMN guidance_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_order_service_readiness ADD COLUMN current_step_key TEXT;
ALTER TABLE work_order_service_readiness ADD COLUMN trigger_reason TEXT;
ALTER TABLE work_order_service_readiness ADD COLUMN guidance_json TEXT;

CREATE TABLE IF NOT EXISTS work_order_service_guidance_feedback (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  guidance_generated_at TEXT NOT NULL,
  action_index INTEGER NOT NULL CHECK (action_index BETWEEN 0 AND 2),
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('accepted', 'ignored', 'corrected')),
  correction_note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_guidance_feedback_work_order
  ON work_order_service_guidance_feedback(work_order_id, created_at DESC);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('045_service_guidance_cache', 'Full lifecycle engineer service guidance cache with v1 readiness compatibility');
