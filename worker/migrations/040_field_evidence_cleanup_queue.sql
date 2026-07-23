-- 040_field_evidence_cleanup_queue: retry private R2 cleanup after a failed rollback.

CREATE TABLE IF NOT EXISTS field_evidence_cleanup_queue (
  object_key TEXT PRIMARY KEY,
  failure_reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('040_field_evidence_cleanup_queue', 'Retry private field evidence cleanup after failed rollback');
