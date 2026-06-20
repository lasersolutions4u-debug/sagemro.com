-- 024_engineer_applications_and_calendar.sql
-- Engineer recruiting applications and engineer-owned availability calendar.

CREATE TABLE IF NOT EXISTS engineer_applications (
  id TEXT PRIMARY KEY,
  market TEXT DEFAULT 'com',
  status TEXT DEFAULT 'submitted',
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  country TEXT,
  province TEXT,
  city TEXT,
  base_region TEXT,
  service_regions TEXT DEFAULT '[]',
  years_experience TEXT,
  equipment_types TEXT DEFAULT '[]',
  brand_experience TEXT DEFAULT '[]',
  skill_tags TEXT DEFAULT '[]',
  languages TEXT DEFAULT '[]',
  can_travel INTEGER DEFAULT 0,
  can_weekend INTEGER DEFAULT 0,
  can_night INTEGER DEFAULT 0,
  has_tools INTEGER DEFAULT 0,
  experience_summary TEXT,
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  converted_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_engineer_applications_status ON engineer_applications(status);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_market ON engineer_applications(market);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_created_at ON engineer_applications(created_at);

CREATE TABLE IF NOT EXISTS engineer_calendar_events (
  id TEXT PRIMARY KEY,
  engineer_id TEXT NOT NULL,
  market TEXT DEFAULT 'com',
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  work_order_id TEXT,
  region TEXT,
  city TEXT,
  confirmation_status TEXT DEFAULT 'confirmed',
  engineer_response TEXT,
  visibility TEXT DEFAULT 'admin_team',
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_engineer_calendar_engineer ON engineer_calendar_events(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_calendar_range ON engineer_calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_engineer_calendar_type ON engineer_calendar_events(event_type);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('024_engineer_applications_and_calendar', '工程师申请与工程师本人维护的排单日历');
