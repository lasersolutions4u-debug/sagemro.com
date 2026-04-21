-- 005_add_company_and_auth.sql
-- 公司信息和认证状态字段（客户和合伙人）

-- customers 表新增字段
ALTER TABLE customers ADD COLUMN company TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN city TEXT;
ALTER TABLE customers ADD COLUMN company_description TEXT;
ALTER TABLE customers ADD COLUMN business_scope TEXT;
ALTER TABLE customers ADD COLUMN logo_url TEXT;
ALTER TABLE customers ADD COLUMN auth_status TEXT DEFAULT 'pending';

-- engineers 表新增字段
ALTER TABLE engineers ADD COLUMN company TEXT;
ALTER TABLE engineers ADD COLUMN address TEXT;
ALTER TABLE engineers ADD COLUMN city TEXT;
ALTER TABLE engineers ADD COLUMN company_description TEXT;
ALTER TABLE engineers ADD COLUMN business_scope TEXT;
ALTER TABLE engineers ADD COLUMN logo_url TEXT;
ALTER TABLE engineers ADD COLUMN auth_status TEXT DEFAULT 'pending';