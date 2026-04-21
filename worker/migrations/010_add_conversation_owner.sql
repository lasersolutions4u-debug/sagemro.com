-- 010_add_conversation_owner.sql
-- 为对话表添加 customer_id，以支持读路径越权（IDOR）校验。
--
-- 背景：
--   conversations 表历史上没有 owner 字段，`/api/conversations/:id` 系列读接口
--   因此无法校验归属，任意登录用户可枚举他人 AI 对话（含 PII）。
--
-- 兼容策略：
--   - customer_id NULLABLE：历史行保持 NULL，lib/guards.js 中只允许 admin 访问旧数据；
--   - 新会话由 handleChat 写入 JWT 中的 userId；
--   - 已登录客户对自己对话的访问/删除/重命名均通过 assertConversationAccess 校验。
--
-- 依赖：000_initial.sql（conversations 表）

ALTER TABLE conversations ADD COLUMN customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
