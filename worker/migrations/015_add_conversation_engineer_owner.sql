-- 015_add_conversation_engineer_owner.sql
-- 为对话表添加 engineer_id，配对 010 的 customer_id 构成完整 owner 结构。
--
-- 背景：
--   conversations 表在 000 只有基础字段，010 加了 customer_id。但合伙人身份
--   进入 /api/chat 时也会创建对话，而 src/lib/summary.js::generateSummaryForConversation
--   与 get_conversation_history / SummaryProtocol 查询都依赖 c.engineer_id 字段识别
--   对话归属（`userRoleLabel = conv.engineer_id ? '合伙人' : conv.customer_id ? '客户' : '访客'`）。
--   生产库此前缺这个列，会让任何合伙人发起的对话在摘要生成时报
--   "no such column: engineer_id: SQLITE_ERROR"。
--
-- 兼容策略：
--   - engineer_id NULLABLE：历史行保持 NULL（userRoleLabel 降级为 customer 或 guest）
--   - 新会话由 handleChat 写入 JWT 中的 engineer userId（见同批 handleChat 的 INSERT 修复）
--   - guards.assertConversationAccess 已按 customer_id / engineer_id 两种归属判断
--
-- 依赖：000_initial.sql（conversations 表）、010_add_conversation_owner.sql（customer_id）

ALTER TABLE conversations ADD COLUMN engineer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_engineer_id ON conversations(engineer_id);
