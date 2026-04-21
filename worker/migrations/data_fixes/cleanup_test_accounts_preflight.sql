-- ============================================================
-- 上线前清理脚本 —— 预演（只读）
--
-- 用途：在跑 cleanup_test_accounts.sql 之前，用相同的白名单查询一遍，
-- 确认真实会被删除的记录范围，签字后再执行真正的清理。
--
-- 使用：
--   1. 修改本文件和 cleanup_test_accounts.sql 中的 INSERT 白名单，
--      保持两处完全一致
--   2. 运行：
--        wrangler d1 execute sagemro-db --file migrations/data_fixes/cleanup_test_accounts_preflight.sql --env production
--   3. 把 SELECT 结果贴给负责人确认，再跑真正的 cleanup
--
-- 设计原则：本脚本只读，任何 INSERT/UPDATE/DELETE 都是临时表操作。
-- ============================================================

DROP TABLE IF EXISTS __cleanup_targets;
CREATE TEMP TABLE __cleanup_targets (
  scope TEXT NOT NULL,
  identifier TEXT NOT NULL,
  note TEXT
);

-- ============================================================
-- ⬇ 在这里维护要删除的账号白名单（与 cleanup_test_accounts.sql 保持一致）⬇
-- ============================================================

-- 示例（占位，需要人工替换为真实要清理的手机号）：
-- INSERT INTO __cleanup_targets (scope, identifier, note) VALUES
--   ('customer', '13800000001', '功能测试账号 - 张三'),
--   ('customer', '13800000002', '冒烟测试账号'),
--   ('engineer', '13900000001', '工程师测试账号 - 李四'),
--   ('conversation', 'conv-abc-123', '孤儿对话');

-- ============================================================
-- ⬇ 下面的 SELECT 是固定的，逐一展示影响范围 ⬇
-- ============================================================

-- 0. 白名单本身
SELECT 'whitelist' AS scope, scope AS target_scope, identifier, note FROM __cleanup_targets;

-- 1. 会被删除的客户账号（若白名单有未匹配手机号，此处会少于白名单）
SELECT 'customers_matched' AS scope, c.id, c.user_no, c.name, c.phone, c.created_at, t.note
  FROM customers c
  JOIN __cleanup_targets t
    ON t.scope = 'customer' AND t.identifier = c.phone;

-- 2. 白名单里但库中找不到的客户手机号（排错用）
SELECT 'customers_not_found' AS scope, t.identifier AS phone, t.note
  FROM __cleanup_targets t
  LEFT JOIN customers c ON t.scope = 'customer' AND t.identifier = c.phone
 WHERE t.scope = 'customer' AND c.id IS NULL;

-- 3. 会被删除的合伙人账号
SELECT 'engineers_matched' AS scope, e.id, e.user_no, e.name, e.phone, e.level, e.wallet_balance, t.note
  FROM engineers e
  JOIN __cleanup_targets t
    ON t.scope = 'engineer' AND t.identifier = e.phone;

-- 4. 白名单里但库中找不到的合伙人手机号
SELECT 'engineers_not_found' AS scope, t.identifier AS phone, t.note
  FROM __cleanup_targets t
  LEFT JOIN engineers e ON t.scope = 'engineer' AND t.identifier = e.phone
 WHERE t.scope = 'engineer' AND e.id IS NULL;

-- 5. 会被级联删除的工单数量（按客户白名单）
SELECT 'workorders_to_delete' AS scope, COUNT(*) AS total FROM work_orders
 WHERE customer_id IN (
   SELECT c.id FROM customers c JOIN __cleanup_targets t ON t.scope='customer' AND t.identifier=c.phone
 );

-- 6. 会被级联删除的设备数量
SELECT 'devices_to_delete' AS scope, COUNT(*) AS total FROM devices
 WHERE customer_id IN (
   SELECT c.id FROM customers c JOIN __cleanup_targets t ON t.scope='customer' AND t.identifier=c.phone
 );

-- 7. 会被级联删除的合伙人钱包流水数量
SELECT 'engineer_wallet_logs' AS scope, COUNT(*) AS total FROM engineer_wallets
 WHERE engineer_id IN (
   SELECT e.id FROM engineers e JOIN __cleanup_targets t ON t.scope='engineer' AND t.identifier=e.phone
 );

-- 8. 会被级联删除的客户对话数量
SELECT 'customer_conversations' AS scope, COUNT(*) AS total FROM conversations
 WHERE customer_id IN (
   SELECT c.id FROM customers c JOIN __cleanup_targets t ON t.scope='customer' AND t.identifier=c.phone
 );

-- 9. 显式指定要删的孤儿对话（scope='conversation'）
SELECT 'orphan_conversations_matched' AS scope, cv.id, cv.title, cv.customer_id, cv.created_at, t.note
  FROM conversations cv
  JOIN __cleanup_targets t ON t.scope='conversation' AND t.identifier=cv.id;

SELECT 'orphan_conversations_not_found' AS scope, t.identifier AS conversation_id, t.note
  FROM __cleanup_targets t
  LEFT JOIN conversations cv ON t.scope='conversation' AND t.identifier=cv.id
 WHERE t.scope = 'conversation' AND cv.id IS NULL;

DROP TABLE IF EXISTS __cleanup_targets;
