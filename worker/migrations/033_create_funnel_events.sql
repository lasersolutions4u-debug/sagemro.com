CREATE TABLE IF NOT EXISTS funnel_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'com',
  anonymous_id TEXT,
  session_id TEXT,
  user_type TEXT,
  user_id TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  page_path TEXT,
  referrer TEXT,
  properties_json TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_event_created
  ON funnel_events(event_name, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_session_created
  ON funnel_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_campaign_created
  ON funnel_events(source, medium, campaign, created_at);

INSERT OR IGNORE INTO _migrations (version, note)
VALUES ('033_create_funnel_events', 'Controlled beta funnel event tracking');
