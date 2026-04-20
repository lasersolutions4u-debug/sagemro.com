-- V2合伙人体系迁移脚本 (最简版)
-- 只添加真正需要的新字段，不触碰已有数据

-- 1. engineers 表新增字段（IF NOT EXISTS 不支持 ADD COLUMN，手动逐条）
ALTER TABLE engineers ADD COLUMN level TEXT DEFAULT 'junior';
ALTER TABLE engineers ADD COLUMN commission_rate REAL DEFAULT 0.80;
ALTER TABLE engineers ADD COLUMN credit_score INTEGER DEFAULT 100;
ALTER TABLE engineers ADD COLUMN deposit_balance INTEGER DEFAULT 0;
ALTER TABLE engineers ADD COLUMN wallet_balance INTEGER DEFAULT 0;
ALTER TABLE engineers ADD COLUMN tax_subject TEXT;
ALTER TABLE engineers ADD COLUMN legal_person TEXT;
ALTER TABLE engineers ADD COLUMN bank_account TEXT;
ALTER TABLE engineers ADD COLUMN bank_name TEXT;
ALTER TABLE engineers ADD COLUMN total_orders INTEGER DEFAULT 0;
ALTER TABLE engineers ADD COLUMN complex_orders INTEGER DEFAULT 0;
ALTER TABLE engineers ADD COLUMN success_orders INTEGER DEFAULT 0;

-- 2. work_order_pricing 表：重建迁移
ALTER TABLE work_order_pricing RENAME TO work_order_pricing_v1;
CREATE TABLE work_order_pricing (
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
INSERT INTO work_order_pricing (id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, total_amount, ai_price_check, status, submitted_at, confirmed_at, created_at)
SELECT id, work_order_id, NULL, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, total_amount, ai_price_check, status, submitted_at, confirmed_at, created_at FROM work_order_pricing_v1;
DROP TABLE work_order_pricing_v1;

-- 3. work_order_pricing_history 表：重建迁移
ALTER TABLE work_order_pricing_history RENAME TO work_order_pricing_history_v1;
CREATE TABLE work_order_pricing_history (
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
INSERT INTO work_order_pricing_history (id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, total_amount, version, created_at)
SELECT id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, total_amount, version, created_at FROM work_order_pricing_history_v1;
DROP TABLE work_order_pricing_history_v1;

-- 4. 新增钱包/保证金/违规/晋升/提现表
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

CREATE TABLE IF NOT EXISTS engineer_withdrawals (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    fail_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
);

-- 5. 新增索引
CREATE INDEX IF NOT EXISTS idx_engineers_level ON engineers(level);
CREATE INDEX IF NOT EXISTS idx_engineer_wallets_engineer ON engineer_wallets(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_deposits_engineer ON engineer_deposits(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_promotions_engineer ON engineer_promotions(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_violations_engineer ON engineer_violations(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_withdrawals_engineer ON engineer_withdrawals(engineer_id);
