-- 008_sync_missing_tables.sql
-- 补齐 schema.sql 中已有但早期 migrations 未包含的表。
-- 均使用 IF NOT EXISTS，幂等；在老库上会跳过，在纯靠 migrations 构建的新库上会创建。

-- 管理员回复表（用于管理员回复客户评价）
CREATE TABLE IF NOT EXISTS admin_replies (
    id TEXT PRIMARY KEY,
    rating_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 平台评价表（客户对平台整体的评价）
CREATE TABLE IF NOT EXISTS platform_ratings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 客户评价表（工程师对客户的评价，仅工程师与平台可见）
CREATE TABLE IF NOT EXISTS customer_ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 工单报价表（合伙人提交的报价）
CREATE TABLE IF NOT EXISTS work_order_pricing (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT,
    labor_fee INTEGER DEFAULT 0,
    parts_fee INTEGER DEFAULT 0,
    travel_fee INTEGER DEFAULT 0,
    other_fee INTEGER DEFAULT 0,
    parts_detail TEXT DEFAULT '',
    platform_fee INTEGER DEFAULT 0,
    deposit_withhold INTEGER DEFAULT 0,
    subtotal INTEGER DEFAULT 0,
    total_amount INTEGER DEFAULT 0,
    ai_price_check TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    submitted_at TEXT,
    confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 工单报价历史（多轮议价）
CREATE TABLE IF NOT EXISTS work_order_pricing_history (
    id TEXT PRIMARY KEY,
    pricing_id TEXT NOT NULL,
    labor_fee INTEGER DEFAULT 0,
    parts_fee INTEGER DEFAULT 0,
    travel_fee INTEGER DEFAULT 0,
    other_fee INTEGER DEFAULT 0,
    parts_detail TEXT DEFAULT '',
    subtotal INTEGER DEFAULT 0,
    total_amount INTEGER DEFAULT 0,
    platform_fee INTEGER DEFAULT 0,
    deposit_withhold INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 工单消息表（工单内对话，客户/工程师/系统消息）
CREATE TABLE IF NOT EXISTS work_order_messages (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,          -- 'customer' / 'engineer' / 'system'
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',   -- 'text' / 'pricing_update' / 'system'
    created_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_admin_replies_rating ON admin_replies(rating_id);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_wo ON customer_ratings(work_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_engineer ON customer_ratings(engineer_id);
CREATE INDEX IF NOT EXISTS idx_platform_ratings_customer ON platform_ratings(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_order_messages_wo ON work_order_messages(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_pricing_wo ON work_order_pricing(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_pricing_history_pricing ON work_order_pricing_history(pricing_id);
