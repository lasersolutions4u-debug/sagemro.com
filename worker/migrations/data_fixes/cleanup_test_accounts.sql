-- ============================================================
-- 上线前清理脚本：按明确白名单删除测试账号及关联数据
--
-- ⚠️ D1 删除不可逆，本脚本采用显式手机号白名单（phone IN (...)），
--    不再使用 `phone LIKE '1380000%'` / `name LIKE '%test%'`，
--    这些模式会误伤 138 开头的真实中国移动号段或姓名含 "test" 的真实用户。
--
-- 使用方法：
--   1. 编辑下方 `__cleanup_targets` 表的 INSERT，逐条列出要删除的账号
--      （来自 preflight 脚本的输出 + 人工签字确认）
--   2. 先跑 preflight：
--        wrangler d1 execute sagemro-db --file migrations/data_fixes/cleanup_test_accounts_preflight.sql --env production
--      preflight 与本脚本 INSERT 相同的白名单，确认返回行数与预期一致
--   3. 负责人签字后，再跑本脚本：
--        wrangler d1 execute sagemro-db --file migrations/data_fixes/cleanup_test_accounts.sql --env production
--
-- 新增/修改账号时：同步编辑本文件和 preflight 的 INSERT 语句（两处保持一致）。
-- ============================================================

-- 1. 创建临时表存白名单（customer / engineer / orphan_conversation）
--    scope ∈ ('customer','engineer','conversation')
--    identifier 对 customer/engineer 是 phone，对 conversation 是 id
DROP TABLE IF EXISTS __cleanup_targets;
CREATE TEMP TABLE __cleanup_targets (
  scope TEXT NOT NULL,
  identifier TEXT NOT NULL,
  note TEXT
);

-- ============================================================
-- ⬇ 在这里维护要删除的账号白名单（与 preflight 保持完全一致）⬇
-- ============================================================

-- 示例（占位，需要人工替换为真实要清理的手机号）：
-- INSERT INTO __cleanup_targets (scope, identifier, note) VALUES
--   ('customer', '13800000001', '功能测试账号 - 张三'),
--   ('customer', '13800000002', '冒烟测试账号'),
--   ('engineer', '13900000001', '工程师测试账号 - 李四'),
--   ('conversation', 'conv-abc-123', '孤儿对话');

-- 默认为空：未填白名单则本脚本不会删任何数据（safe by default）

-- ============================================================
-- ⬇ 以下为固定的级联删除逻辑，不要修改 ⬇
-- ============================================================

-- 2. 生成受影响的 customer id / engineer id / conversation id 集合
DROP TABLE IF EXISTS __cleanup_customer_ids;
CREATE TEMP TABLE __cleanup_customer_ids AS
  SELECT c.id
    FROM customers c
    JOIN __cleanup_targets t
      ON t.scope = 'customer' AND t.identifier = c.phone;

DROP TABLE IF EXISTS __cleanup_engineer_ids;
CREATE TEMP TABLE __cleanup_engineer_ids AS
  SELECT e.id
    FROM engineers e
    JOIN __cleanup_targets t
      ON t.scope = 'engineer' AND t.identifier = e.phone;

-- 3. 按外键顺序级联删除（客户侧）

DELETE FROM work_order_messages
 WHERE work_order_id IN (
   SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids)
 );

DELETE FROM work_order_pricing_history
 WHERE pricing_id IN (
   SELECT id FROM work_order_pricing WHERE work_order_id IN (
     SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids)
   )
 );

DELETE FROM work_order_pricing
 WHERE work_order_id IN (
   SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids)
 );

DELETE FROM work_order_logs
 WHERE work_order_id IN (
   SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids)
 );

DELETE FROM ratings
 WHERE work_order_id IN (
   SELECT id FROM work_orders WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids)
 );

DELETE FROM work_orders WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids);

DELETE FROM devices WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids);

-- 清理客户名下的对话（通过 customer_id 关联）
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids)
);
DELETE FROM conversations WHERE customer_id IN (SELECT id FROM __cleanup_customer_ids);

DELETE FROM customers WHERE id IN (SELECT id FROM __cleanup_customer_ids);

-- 4. 合伙人侧

DELETE FROM engineer_wallets      WHERE engineer_id IN (SELECT id FROM __cleanup_engineer_ids);
DELETE FROM engineer_deposits     WHERE engineer_id IN (SELECT id FROM __cleanup_engineer_ids);
DELETE FROM engineer_promotions   WHERE engineer_id IN (SELECT id FROM __cleanup_engineer_ids);
DELETE FROM engineer_violations   WHERE engineer_id IN (SELECT id FROM __cleanup_engineer_ids);
DELETE FROM engineer_withdrawals  WHERE engineer_id IN (SELECT id FROM __cleanup_engineer_ids);
DELETE FROM engineers             WHERE id IN (SELECT id FROM __cleanup_engineer_ids);

-- 5. 显式指定的孤儿对话（scope='conversation' 的 id 列表）
DELETE FROM messages WHERE conversation_id IN (
  SELECT identifier FROM __cleanup_targets WHERE scope = 'conversation'
);
DELETE FROM conversations
 WHERE id IN (SELECT identifier FROM __cleanup_targets WHERE scope = 'conversation');

-- 6. 清理临时表
DROP TABLE IF EXISTS __cleanup_customer_ids;
DROP TABLE IF EXISTS __cleanup_engineer_ids;
DROP TABLE IF EXISTS __cleanup_targets;

-- 完成后建议 VACUUM 回收空间（D1 不直接支持，可忽略）
