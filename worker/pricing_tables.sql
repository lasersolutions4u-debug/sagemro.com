-- 工单核价表（V2：按合伙人等级浮动佣金）
CREATE TABLE IF NOT EXISTS work_order_pricing (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT,
    labor_fee INTEGER DEFAULT 0,
    parts_fee INTEGER DEFAULT 0,
    travel_fee INTEGER DEFAULT 0,
    other_fee INTEGER DEFAULT 0,
    parts_detail TEXT DEFAULT '',
    platform_fee INTEGER DEFAULT 0,     -- 平台服务费 = subtotal * (1 - commission_rate)
    deposit_withhold INTEGER DEFAULT 0,  -- 动态保证金 = subtotal * 5%
    subtotal INTEGER DEFAULT 0,           -- 小计 = labor + parts + travel + other
    total_amount INTEGER DEFAULT 0,       -- 合计 = subtotal（客户应付）
    ai_price_check TEXT DEFAULT '',      -- JSON：AI审核结果 {status, reason, regional_avg}
    status TEXT DEFAULT 'draft',
    submitted_at TEXT,
    confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 工单消息表
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
    platform_fee INTEGER DEFAULT 0,
    deposit_withhold INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 合伙人钱包流水（V2新增）
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

-- 合伙人保证金流水（V2新增）
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

-- 合伙人晋升记录（V2新增）
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

-- 合伙人违约记录（V2新增）
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

-- 合伙人提现申请（V2新增）
CREATE TABLE IF NOT EXISTS engineer_withdrawals (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    fail_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
);
