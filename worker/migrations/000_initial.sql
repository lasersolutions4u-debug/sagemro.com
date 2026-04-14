-- 对话表
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '新对话',
    last_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 客户用户表
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,  -- 用户编号：U + 6位数字，如 U000001
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',  -- 密码盐值
    region TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 工程师表
CREATE TABLE IF NOT EXISTS engineers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,  -- 用户编号：E + 6位数字，如 E000001
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',  -- 密码盐值

    -- 背景调查信息
    specialties TEXT NOT NULL DEFAULT '[]',       -- JSON数组：设备类型标签
    brands TEXT DEFAULT '{}',                     -- JSON：按设备类型分类的品牌标签
    services TEXT NOT NULL DEFAULT '[]',           -- JSON数组：维修保养项目标签
    service_region TEXT,              -- 服务覆盖地区
    bio TEXT,                         -- 个人简介

    -- 状态和评分
    status TEXT DEFAULT 'available',  -- available / paused / offline
    rating_timeliness REAL DEFAULT 0,
    rating_technical REAL DEFAULT 0,
    rating_communication REAL DEFAULT 0,
    rating_professional REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,

    created_at TEXT DEFAULT (datetime('now'))
);

-- 设备表（客户绑定的设备）
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    type TEXT NOT NULL,        -- 设备类型标签
    brand TEXT,                 -- 品牌标签
    model TEXT,                 -- 型号
    power TEXT,                 -- 功率
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 工单表
CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,  -- WO-2025-0001
    customer_id TEXT,
    engineer_id TEXT,
    device_id TEXT,

    -- 工单基本信息
    type TEXT NOT NULL,         -- fault / maintenance / parameter / other
    description TEXT NOT NULL,
    urgency TEXT DEFAULT 'normal',  -- normal / urgent / critical

    -- 状态
    status TEXT DEFAULT 'pending',  -- pending / assigned / in_progress / resolved / pending_review / completed / rejected / cancelled

    -- AI 摘要
    ai_summary TEXT,
    ai_recommendation TEXT,     -- JSON：推荐的工程师ID和理由

    -- 时间戳
    created_at TEXT DEFAULT (datetime('now')),
    assigned_at TEXT,
    started_at TEXT,
    resolved_at TEXT,
    completed_at TEXT,

    -- 推荐跟踪
    recommend_count INTEGER DEFAULT 0,
    rejected_engineers TEXT DEFAULT '[]',    -- JSON数组：已拒绝的工程师ID

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- 工单进度记录
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

-- 评价表
CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating_timeliness INTEGER NOT NULL,  -- 1-5
    rating_technical INTEGER NOT NULL,
    rating_communication INTEGER NOT NULL,
    rating_professional INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_engineer ON work_orders(engineer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_ratings_engineer ON ratings(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineers_status ON engineers(status);
