-- 增量迁移：为 customers 和 engineers 表添加 user_no 和 salt 字段
-- 已有线上数据时，需要手动在 D1 控制台执行此迁移

-- user_no 字段
ALTER TABLE customers ADD COLUMN user_no TEXT;
ALTER TABLE engineers ADD COLUMN user_no TEXT;

-- salt 字段（密码盐值）
ALTER TABLE customers ADD COLUMN salt TEXT NOT NULL DEFAULT '';
ALTER TABLE engineers ADD COLUMN salt TEXT NOT NULL DEFAULT '';

-- 注意：
-- 1. 为已有用户生成 user_no 需要在应用层处理或手动执行
-- 2. 已有用户的密码哈希仍使用旧算法（SHA-256 + 固定盐），salt 字段为空
-- 3. 用户下次登录时可引导修改密码，迁移到新哈希算法
