-- 012_add_payments: 支付记录表 + 工程师银行卡补充字段
-- 用于客户模拟付款和工程师提现银行卡绑定

-- 支付记录表
CREATE TABLE IF NOT EXISTS work_order_payments (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    customer_id TEXT,
    amount INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'bank_transfer',  -- bank_transfer / alipay / wechat
    transaction_id TEXT UNIQUE,
    status TEXT DEFAULT 'completed',              -- pending / completed / failed
    paid_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_wo ON work_order_payments(work_order_id);

-- 工程师表补充银行卡字段（bank_account, bank_name 已存在于 schema，补充开户支行和开户人姓名）
ALTER TABLE engineers ADD COLUMN bank_branch TEXT DEFAULT '';
ALTER TABLE engineers ADD COLUMN account_holder TEXT DEFAULT '';
