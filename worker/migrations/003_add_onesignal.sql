-- 添加 OneSignal 推送订阅字段到 engineers 表
ALTER TABLE engineers ADD COLUMN onesignal_player_id TEXT;

-- 推送订阅记录表（可选，用于追踪订阅历史）
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    onesignal_player_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
