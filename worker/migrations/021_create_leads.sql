-- 021: 商机线索表（Lead 收集）
-- 当 AI 对话中检测到购买意向时，前端弹出表单收集潜在客户信息
-- 部署前需手动执行：wrangler d1 execute sagemro-db --env production --remote --file migrations/021_create_leads.sql

CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'chat',              -- chat / landing / referral
    interest TEXT,                            -- 感兴趣的产品/需求
    message TEXT,                             -- 客户描述
    conversation_id TEXT,                     -- 关联对话 ID（如有）
    status TEXT DEFAULT 'new',                -- new / contacted / converted / lost
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
