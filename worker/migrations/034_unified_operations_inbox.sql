CREATE TABLE IF NOT EXISTS inbox_conversations (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('direct', 'work_order')),
    work_order_id TEXT,
    subject TEXT,
    created_by_type TEXT NOT NULL,
    created_by_id TEXT NOT NULL,
    last_message_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_work_order ON inbox_conversations(work_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_conversations_unique_work_order
    ON inbox_conversations(work_order_id)
    WHERE kind = 'work_order' AND work_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inbox_participants (
    conversation_id TEXT NOT NULL,
    user_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_read_message_id TEXT,
    last_read_at TEXT,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    left_at TEXT,
    PRIMARY KEY (conversation_id, user_type, user_id),
    FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_participants_user ON inbox_participants(user_type, user_id, is_active);

CREATE TABLE IF NOT EXISTS inbox_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    content TEXT NOT NULL,
    attachment_urls TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation_created ON inbox_messages(conversation_id, created_at);

INSERT OR IGNORE INTO _migrations (version, note)
VALUES ('034_unified_operations_inbox', 'Unified operations inbox tables');
