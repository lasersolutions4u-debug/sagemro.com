CREATE TABLE IF NOT EXISTS work_order_service_readiness (
  work_order_id TEXT PRIMARY KEY,
  source_conversation_id TEXT,
  input_fingerprint TEXT,
  review_json TEXT,
  generation_state TEXT NOT NULL DEFAULT 'missing'
    CHECK (generation_state IN ('missing', 'generating', 'ready', 'failed')),
  generation_started_at TEXT,
  generated_at TEXT,
  last_error TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('043_engineer_service_readiness', 'Internal engineer AI service-readiness cache and verified source conversation link');
