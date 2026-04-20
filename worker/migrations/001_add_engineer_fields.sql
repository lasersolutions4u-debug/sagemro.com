-- V2迁移Step1: 为 engineers 表添加新字段
-- Step2 会处理 pricing 表重建和新表创建

-- 1. engineers 表新增字段
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
