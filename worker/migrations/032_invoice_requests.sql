-- 发票申请表
-- China edition: 客户可申请开具增值税普通发票/专用发票

CREATE TABLE IF NOT EXISTS invoice_requests (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    customer_id TEXT,

    -- 开票信息
    invoice_type TEXT DEFAULT '普通发票',  -- 普通发票 / 专用发票
    company_name TEXT NOT NULL,            -- 公司名称
    tax_id TEXT NOT NULL,                  -- 纳税人识别号
    company_address TEXT DEFAULT '',        -- 地址
    company_phone TEXT DEFAULT '',          -- 电话
    bank_name TEXT DEFAULT '',              -- 开户银行
    bank_account TEXT DEFAULT '',           -- 银行账号

    -- 金额与状态
    amount INTEGER NOT NULL,               -- 开票金额
    status TEXT DEFAULT 'pending',         -- pending / issued / cancelled
    notes TEXT DEFAULT '',                  -- 客户备注

    -- 管理员填写
    invoice_number TEXT DEFAULT '',         -- 发票号码
    admin_notes TEXT DEFAULT '',
    issued_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_requests_wo ON invoice_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status ON invoice_requests(status);
