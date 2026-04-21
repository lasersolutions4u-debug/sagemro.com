-- 011_create_migrations_tracking.sql
--
-- 新增 `_migrations` 跟踪表，目的：
--   - 避免在同一 D1 上重复执行同一迁移（ALTER TABLE ADD COLUMN 重复会报错）
--   - 审计：什么时候、谁、应用了哪个迁移文件
--
-- 使用约定：
--   每个新的 NNN_xxx.sql 执行完成后，由部署脚本或人工补一条：
--     INSERT INTO _migrations (version, applied_at) VALUES ('011_create_migrations_tracking', datetime('now'));
--
--   未来可把此逻辑嵌入 deploy 脚本或替换为 wrangler d1 migrations 官方机制。

CREATE TABLE IF NOT EXISTS _migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now')),
    note TEXT
);

-- 回填已执行过的迁移版本（idempotent：INSERT OR IGNORE 允许重跑本脚本不出错）
INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('000_initial',                      '初始建表'),
    ('001_add_engineer_fields',          'V2 合伙人字段'),
    ('001a_add_user_no',                 '老库 user_no / salt 回填'),
    ('002_pricing_and_new_tables',       '核价 + 钱包/保证金/晋升/违约/提现表'),
    ('003_add_onesignal',                '工程师端 OneSignal 推送'),
    ('004_add_device_fields',            'devices 表补 name/status/photo_url/notes'),
    ('005_add_company_and_auth',         'customers/engineers 公司信息 + auth_status'),
    ('006_create_notifications',         '通知表'),
    ('007_create_engineer_reviews',      '工程师对客户的评价表'),
    ('008_sync_missing_tables',          '回补漂移表（work_order_pricing 等）'),
    ('009_add_customer_onesignal',       '客户端 OneSignal 推送'),
    ('010_add_conversation_owner',       'conversations 加 customer_id（IDOR 修复）'),
    ('011_create_migrations_tracking',   '本迁移：_migrations 跟踪表');
