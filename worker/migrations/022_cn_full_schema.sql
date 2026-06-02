-- CN 数据库完整 schema 初始化（从 EN 库导出的最终结构）
-- 此文件仅用于初始化空的 CN 数据库，不要在 EN 库执行

-- 清除 000/001 已创建的表（它们的 schema 不完整）
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS work_order_logs;
DROP TABLE IF EXISTS work_orders;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS engineers;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
PRAGMA foreign_keys = ON;

-- 重建所有表（完整 schema）
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '新对话',
    last_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    summary_message_count INTEGER DEFAULT 0,
    customer_id TEXT,
    engineer_id TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    image_urls TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    region TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    user_no TEXT,
    salt TEXT NOT NULL DEFAULT '',
    company TEXT,
    address TEXT,
    city TEXT,
    company_description TEXT,
    business_scope TEXT,
    logo_url TEXT,
    auth_status TEXT DEFAULT 'pending',
    onesignal_player_id TEXT
);

CREATE TABLE IF NOT EXISTS engineers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    specialties TEXT NOT NULL DEFAULT '[]',
    brands TEXT DEFAULT '{}',
    services TEXT NOT NULL DEFAULT '[]',
    service_region TEXT,
    bio TEXT,
    status TEXT DEFAULT 'available',
    rating_timeliness REAL DEFAULT 0,
    rating_technical REAL DEFAULT 0,
    rating_communication REAL DEFAULT 0,
    rating_professional REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    user_no TEXT,
    salt TEXT NOT NULL DEFAULT '',
    level TEXT DEFAULT 'junior',
    commission_rate REAL DEFAULT 0.80,
    credit_score INTEGER DEFAULT 100,
    deposit_balance INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    tax_subject TEXT,
    legal_person TEXT,
    bank_account TEXT,
    bank_name TEXT,
    total_orders INTEGER DEFAULT 0,
    complex_orders INTEGER DEFAULT 0,
    success_orders INTEGER DEFAULT 0,
    onesignal_player_id TEXT,
    company TEXT,
    address TEXT,
    city TEXT,
    company_description TEXT,
    business_scope TEXT,
    logo_url TEXT,
    auth_status TEXT DEFAULT 'pending',
    bank_branch TEXT DEFAULT '',
    account_holder TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    type TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    power TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    name TEXT,
    status TEXT DEFAULT 'normal',
    photo_url TEXT,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    engineer_id TEXT,
    device_id TEXT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    urgency TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    ai_summary TEXT,
    ai_recommendation TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    assigned_at TEXT,
    started_at TEXT,
    resolved_at TEXT,
    completed_at TEXT,
    recommend_count INTEGER DEFAULT 0,
    rejected_engineers TEXT DEFAULT '[]',
    sla_deadline TEXT,
    sla_breached_at TEXT,
    category_l1 TEXT DEFAULT 'other',
    category_l2 TEXT DEFAULT 'other',
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS work_order_logs (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT,
    actor_id TEXT,
    content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating_timeliness INTEGER NOT NULL,
    rating_technical INTEGER NOT NULL,
    rating_communication INTEGER NOT NULL,
    rating_professional INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS admin_replies (
    id TEXT PRIMARY KEY,
    rating_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rating_id) REFERENCES ratings(id)
);

CREATE TABLE IF NOT EXISTS ai_trace_logs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    user_id TEXT,
    user_role TEXT NOT NULL CHECK(user_role IN ('guest', 'customer', 'engineer', 'admin', 'system')),
    tool_name TEXT NOT NULL,
    args_json TEXT,
    result_status TEXT NOT NULL CHECK(result_status IN ('ok', 'denied', 'error')),
    error_code TEXT,
    latency_ms INTEGER,
    iteration INTEGER DEFAULT 0,
    result_size_bytes INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    protocol_version INTEGER NOT NULL DEFAULT 1,
    summary_json TEXT NOT NULL,
    source_message_count INTEGER NOT NULL,
    generated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS engineer_deposits (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engineer_promotions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    from_level TEXT,
    to_level TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engineer_reviews (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating_cooperation INTEGER NOT NULL,
    rating_communication INTEGER NOT NULL,
    rating_payment INTEGER NOT NULL,
    rating_environment INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS engineer_violations (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    violation_type TEXT NOT NULL,
    credit_deduction INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engineer_wallets (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engineer_withdrawals (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    fail_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
);

CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'chat',
    interest TEXT,
    message TEXT,
    conversation_id TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_ratings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    onesignal_player_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE TABLE IF NOT EXISTS test_flow_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step TEXT,
    data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_order_attachments (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    uploader_type TEXT NOT NULL,
    uploader_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    r2_url TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS work_order_messages (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_order_payments (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    customer_id TEXT,
    amount INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'bank_transfer',
    transaction_id TEXT UNIQUE,
    status TEXT DEFAULT 'completed',
    paid_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

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

CREATE TABLE IF NOT EXISTS work_order_repair_records (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    symptom TEXT,
    diagnosis TEXT,
    solution TEXT,
    parts_used TEXT DEFAULT '[]',
    labor_hours REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_engineer ON work_orders(engineer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_ratings_engineer ON ratings(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineers_status ON engineers(status);
CREATE INDEX IF NOT EXISTS idx_engineers_level ON engineers(level);
CREATE INDEX IF NOT EXISTS idx_engineer_wallets_engineer ON engineer_wallets(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_deposits_engineer ON engineer_deposits(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_promotions_engineer ON engineer_promotions(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_violations_engineer ON engineer_violations(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_withdrawals_engineer ON engineer_withdrawals(engineer_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_engineer ON push_subscriptions(engineer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_work_order_messages_order ON work_order_messages(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_attachments_order ON work_order_attachments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conv ON conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
