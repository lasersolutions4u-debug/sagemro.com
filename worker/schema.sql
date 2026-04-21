-- ============================================================
-- schema.sql — 全量当前状态快照（由 migrations/000-011 累加合并而成）
--
-- 🔑 真相源政策（Source of Truth）：
--   - **migrations/** 是唯一真相源；每次改表必须通过新增 NNN_xxx.sql。
--   - **schema.sql**（本文件）是全量快照，用途仅两种：
--       1) 给新 D1 实例一键建表的便利脚本（等同于顺序跑完 migrations/*.sql）
--       2) 代码 review 时看当前整体结构的参考文档
--   - 任何 schema 改动**必须**先写 migration，再把变更同步到本文件。
--
-- 新库初始化推荐：
--     wrangler d1 execute sagemro-db --file schema.sql
-- 或（线上增量）：
--     for f in migrations/*.sql; do wrangler d1 execute sagemro-db --file "$f"; done
-- ============================================================

-- 迁移跟踪表（011）
CREATE TABLE IF NOT EXISTS _migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now')),
    note TEXT
);

-- 对话表（000 + 010）
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '新对话',
    last_message TEXT,
    customer_id TEXT,                          -- 010: 归属客户，IDOR 校验依赖此列
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);

-- 消息表（000）
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- 客户用户表（000 + 001a + 005 + 009）
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,              -- U + 6位数字
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',
    region TEXT,
    -- 005 公司信息
    company TEXT,
    address TEXT,
    city TEXT,
    company_description TEXT,
    business_scope TEXT,
    logo_url TEXT,
    auth_status TEXT DEFAULT 'pending',
    -- 009 推送
    onesignal_player_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 工程师表（000 + 001 + 001a + 003 + 005）
CREATE TABLE IF NOT EXISTS engineers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,              -- E + 6位数字
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',

    -- 背景调查信息
    specialties TEXT NOT NULL DEFAULT '[]',
    brands TEXT DEFAULT '{}',
    services TEXT NOT NULL DEFAULT '[]',
    service_region TEXT,
    bio TEXT,

    -- 001 合伙人等级体系
    level TEXT DEFAULT 'junior',               -- junior / senior / expert
    commission_rate REAL DEFAULT 0.80,
    credit_score INTEGER DEFAULT 100,

    -- 001 财务
    deposit_balance INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    tax_subject TEXT,
    legal_person TEXT,
    bank_account TEXT,
    bank_name TEXT,

    -- 状态和评分
    status TEXT DEFAULT 'available',           -- available / paused / offline / pending_approval
    rating_timeliness REAL DEFAULT 0,
    rating_technical REAL DEFAULT 0,
    rating_communication REAL DEFAULT 0,
    rating_professional REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,

    -- 统计
    total_orders INTEGER DEFAULT 0,
    complex_orders INTEGER DEFAULT 0,
    success_orders INTEGER DEFAULT 0,

    -- 005 公司信息
    company TEXT,
    address TEXT,
    city TEXT,
    company_description TEXT,
    business_scope TEXT,
    logo_url TEXT,
    auth_status TEXT DEFAULT 'pending',

    -- 003 推送
    onesignal_player_id TEXT,

    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_engineers_status ON engineers(status);
CREATE INDEX IF NOT EXISTS idx_engineers_level ON engineers(level);

-- 设备表（000 + 004）
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    type TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    power TEXT,
    -- 004 扩展
    name TEXT,                                 -- 如"车间1号激光机"
    status TEXT DEFAULT 'normal',              -- normal / running / maintenance
    photo_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 工单表（000）
CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    engineer_id TEXT,
    device_id TEXT,

    type TEXT NOT NULL,                        -- fault / maintenance / parameter / other
    description TEXT NOT NULL,
    urgency TEXT DEFAULT 'normal',             -- normal / urgent / critical

    status TEXT DEFAULT 'pending',             -- pending / assigned / in_progress / pricing / in_service / resolved / pending_review / completed / rejected / cancelled

    ai_summary TEXT,
    ai_recommendation TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    assigned_at TEXT,
    started_at TEXT,
    resolved_at TEXT,
    completed_at TEXT,

    recommend_count INTEGER DEFAULT 0,
    rejected_engineers TEXT DEFAULT '[]',      -- JSON 数组

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_engineer ON work_orders(engineer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

-- 工单进度日志（000）
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

-- 评价表（000）
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
CREATE INDEX IF NOT EXISTS idx_ratings_engineer ON ratings(engineer_id);

-- 管理员回复表（008）
CREATE TABLE IF NOT EXISTS admin_replies (
    id TEXT PRIMARY KEY,
    rating_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rating_id) REFERENCES ratings(id)
);
CREATE INDEX IF NOT EXISTS idx_admin_replies_rating ON admin_replies(rating_id);

-- 平台评价表（008）
CREATE TABLE IF NOT EXISTS platform_ratings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_platform_ratings_customer ON platform_ratings(customer_id);

-- 客户评价表（工程师→客户，仅内部，008）
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
CREATE INDEX IF NOT EXISTS idx_customer_ratings_wo ON customer_ratings(work_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_engineer ON customer_ratings(engineer_id);

-- 工单核价表（002/008）
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
    status TEXT DEFAULT 'draft',               -- draft / submitted / confirmed / rejected
    submitted_at TEXT,
    confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_pricing_wo ON work_order_pricing(work_order_id);

-- 工单消息表（008）
CREATE TABLE IF NOT EXISTS work_order_messages (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,                 -- customer / engineer / system
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',          -- text / pricing_update / system
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_messages_wo ON work_order_messages(work_order_id);

-- 工单报价历史（008）
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
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pricing_id) REFERENCES work_order_pricing(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_pricing_history_pricing ON work_order_pricing_history(pricing_id);

-- 合伙人钱包流水（001/002）
CREATE TABLE IF NOT EXISTS engineer_wallets (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,                        -- income / withdraw / deduction
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',             -- pending / completed / failed
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人保证金流水（001/002）
CREATE TABLE IF NOT EXISTS engineer_deposits (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,                        -- withhold / refund / deduction / initial
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人晋升记录（001/002）
CREATE TABLE IF NOT EXISTS engineer_promotions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    from_level TEXT,
    to_level TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',             -- pending / approved / rejected
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人违约记录（001/002）
CREATE TABLE IF NOT EXISTS engineer_violations (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    violation_type TEXT NOT NULL,              -- private_order / fake_parts / complaint / refusal / no_show
    credit_deduction INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',             -- pending / confirmed / appealed
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人提现申请（001/002）
CREATE TABLE IF NOT EXISTS engineer_withdrawals (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',             -- pending / processing / completed / failed
    fail_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- OneSignal 推送订阅记录（003）
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    onesignal_player_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 通知表（006）
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL,                   -- customer / engineer
    type TEXT NOT NULL,                        -- new_ticket / ticket_accepted / pricing_submitted / pricing_confirmed / ticket_resolved / rating_received
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,                                 -- JSON 上下文
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- 工程师对客户评价（007）
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_reviews_wo ON engineer_reviews(work_order_id);
CREATE INDEX IF NOT EXISTS idx_engineer_reviews_customer ON engineer_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_reviews_engineer ON engineer_reviews(engineer_id);

-- 回填已执行的迁移版本（011）
INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('000_initial',                      '初始建表'),
    ('001_add_engineer_fields',          'V2 合伙人字段'),
    ('001a_add_user_no',                 '老库 user_no / salt 回填'),
    ('002_pricing_and_new_tables',       '核价 + 钱包/保证金/晋升/违约/提现表'),
    ('003_add_onesignal',                '工程师端 OneSignal 推送'),
    ('004_add_device_fields',            'devices 表补 name/status/photo_url/notes'),
    ('005_add_company_and_auth',         'customers/engineers 公司信息 + auth_status'),
    ('006_create_notifications',         '通知表'),
    ('007_create_engineer_reviews',      '工程师对客户的评价表'),
    ('008_sync_missing_tables',          '回补漂移表（work_order_pricing 等）'),
    ('009_add_customer_onesignal',       '客户端 OneSignal 推送'),
    ('010_add_conversation_owner',       'conversations 加 customer_id（IDOR 修复）'),
    ('011_create_migrations_tracking',   'migrations 跟踪表');
