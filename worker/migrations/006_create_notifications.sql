-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL,          -- 'customer' | 'engineer'
  type TEXT NOT NULL,                -- 'new_ticket' | 'ticket_accepted' | 'pricing_submitted' | 'pricing_confirmed' | 'ticket_resolved' | 'rating_received'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT,                         -- JSON: { work_order_id, order_no, ... }
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
