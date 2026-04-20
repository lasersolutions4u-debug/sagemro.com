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

    -- 合伙人等级体系（V2新增）
    level TEXT DEFAULT 'junior',       -- junior / senior / expert
    commission_rate REAL DEFAULT 0.80, -- 提成比例：Junior 80%, Senior 85%, Expert 88%
    credit_score INTEGER DEFAULT 100,  -- 信用分，初始100分

    -- 财务相关（V2新增）
    deposit_balance INTEGER DEFAULT 0, -- 保证金余额（元）
    wallet_balance INTEGER DEFAULT 0,   -- 钱包余额（元）
    tax_subject TEXT,                  -- 税主体（个体工商户/小微企业）
    legal_person TEXT,                  -- 法人姓名
    bank_account TEXT,                 -- 对公账号
    bank_name TEXT,                    -- 开户行

    -- 状态和评分
    status TEXT DEFAULT 'available',  -- available / paused / offline / pending_approval
    rating_timeliness REAL DEFAULT 0,
    rating_technical REAL DEFAULT 0,
    rating_communication REAL DEFAULT 0,
    rating_professional REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,

    -- 统计数据
    total_orders INTEGER DEFAULT 0,   -- 总完成工单数
    complex_orders INTEGER DEFAULT 0,  -- 复杂工单数（AI标记）
    success_orders INTEGER DEFAULT 0,   -- 成功工单数

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

-- 管理员回复表
CREATE TABLE IF NOT EXISTS admin_replies (
    id TEXT PRIMARY KEY,
    rating_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rating_id) REFERENCES ratings(id)
);

-- 平台评价表（客户对平台的整体评价）
CREATE TABLE IF NOT EXISTS platform_ratings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,  -- 1-5
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 客户评价表（工程师评价客户，仅内部可见）
CREATE TABLE IF NOT EXISTS customer_ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,  -- 1-5
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 工单核价表
CREATE TABLE IF NOT EXISTS work_order_pricing (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    labor_fee INTEGER DEFAULT 0,
    parts_fee INTEGER DEFAULT 0,
    travel_fee INTEGER DEFAULT 0,
    other_fee INTEGER DEFAULT 0,
    parts_detail TEXT DEFAULT '',        -- JSON：配件明细 [{name, unit_price, qty}]
    -- commission_rate 改为从合伙人档案读取，不再存储在核价表
    platform_fee INTEGER DEFAULT 0,     -- 平台服务费 = subtotal * (1 - commission_rate)
    deposit_withhold INTEGER DEFAULT 0, -- 动态保证金扣留 = subtotal * 5%
    subtotal INTEGER DEFAULT 0,         -- 小计 = labor + parts + travel + other
    total_amount INTEGER DEFAULT 0,     -- 合计 = subtotal（客户应付）
    ai_price_check TEXT DEFAULT '',     -- JSON：AI审核结果 {status, reason, regional_avg}
    status TEXT DEFAULT 'draft',         -- draft / submitted / confirmed / rejected
    submitted_at TEXT,
    confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- 工单消息表（工程师与客户在工单内的对话）
CREATE TABLE IF NOT EXISTS work_order_messages (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,          -- 'customer' / 'engineer' / 'system'
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',   -- 'text' / 'pricing_update' / 'system'
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- 工单报价历史（支持多轮议价）
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
    commission_amount INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pricing_id) REFERENCES work_order_pricing(id)
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

-- 合伙人钱包流水（V2新增）
CREATE TABLE IF NOT EXISTS engineer_wallets (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,                     -- income（工单结算）/ withdraw（提现）/ deduction（扣款）
    amount INTEGER NOT NULL,                 -- 正数为增加，负数为扣减
    balance_after INTEGER NOT NULL,          -- 变动后余额
    status TEXT DEFAULT 'pending',          -- pending（提现待处理）/ completed（已完成）/ failed（失败）
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人保证金流水（V2新增）
CREATE TABLE IF NOT EXISTS engineer_deposits (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,                     -- 如为工单扣留则关联
    type TEXT NOT NULL,                     -- withhold（工单扣留）/ refund（退款）/ deduction（扣除赔付）/ initial（入驻缴纳）
    amount INTEGER NOT NULL,                 -- 正数为增加，负数为扣减
    balance_after INTEGER NOT NULL,          -- 扣减后余额
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人晋升记录（V2新增）
CREATE TABLE IF NOT EXISTS engineer_promotions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    from_level TEXT,
    to_level TEXT NOT NULL,               -- junior / senior / expert
    reason TEXT,
    status TEXT DEFAULT 'pending',       -- pending / approved / rejected
    reviewed_by TEXT,                    -- 审核人ID
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人违约记录（Credit_Score扣分）（V2新增）
CREATE TABLE IF NOT EXISTS engineer_violations (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    violation_type TEXT NOT NULL,         -- private_order（私单）/ fake_parts（虚报配件）/ complaint（投诉成立）/ refusal（拒单过多）/ no_show（无故不上门）
    credit_deduction INTEGER NOT NULL,     -- 扣分数
    description TEXT,
    status TEXT DEFAULT 'pending',       -- pending / confirmed / appealed
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人提现申请（V2新增）
CREATE TABLE IF NOT EXISTS engineer_withdrawals (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',       -- pending / processing / completed / failed
    fail_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
