-- 014_conversation_summaries.sql
--
-- Phase 1.1：SummaryProtocol v1 — 跨会话结构化摘要
--
-- 设计依据：docs/summary-protocol-v1-proposal.md 第 5.1 节
--
-- 目的：
--   - 存 conversation 的结构化 JSON 摘要（SummaryProtocol v1），替代"拿原始 messages 喂 AI"
--   - 支持 Phase 1 get_conversation_history 工具，让 AI 跨会话识别客户/合伙人的历史上下文
--   - 为 Phase 3 (RAG / FTS5 / 向量检索) 提供可检索的结构化语料
--
-- 关键决策（已锁定）：
--   - 独立表（不是给 conversations 加 summary 列），支持同一会话多个版本并存，摘要不可 in-place 修改
--   - protocol_version 字段从 1 起，将来 schema 破坏性迭代时按 version 分支读
--   - summary_json 保留 TEXT 存原始 JSON；消费端用 json_extract() 按需拆字段（D1/SQLite 支持）
--
-- 写入路径：
--   - 实时：handleChat 阈值触发（消息数 ≥6 且距上次摘要 ≥3）→ ctx.waitUntil(generateSummary(...))
--   - 存量：scripts/migrate_summaries.mjs 一次性回填 Phase 1 上线前的历史对话
--
-- 读取路径：get_conversation_history 工具按 conversation_id 取最新一条

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,

    -- 协议版本。破坏性 schema 变更时 bump；消费端按 version 分支处理
    protocol_version INTEGER NOT NULL DEFAULT 1,

    -- SummaryProtocol v1 JSON 序列化
    -- 主 schema 字段：conversation_type / summary_text / device / fault_keywords /
    --                intent / pending_items / sentiment / referenced_ids / generated_at /
    --                source_message_count
    -- Fallback（解析失败）：raw_text_preview / generation_error
    summary_json TEXT NOT NULL,

    -- 该摘要基于几条消息生成（和 conversations.summary_message_count 对齐）
    source_message_count INTEGER NOT NULL,

    generated_at TEXT DEFAULT (datetime('now')),

    -- 对话删除时级联清理摘要（摘要脱离对话无意义）
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 主查询范式：拿指定对话的最新一条摘要 / 按客户取近 N 会话的最新摘要
CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv_generated
  ON conversation_summaries(conversation_id, generated_at DESC);

-- 监控 / 统计用：按时间扫描近期生成的摘要（比如 24h 内生成了多少条）
CREATE INDEX IF NOT EXISTS idx_conv_summaries_generated_at
  ON conversation_summaries(generated_at);

-- conversations 表加计数字段，用于阈值触发判断：
--   trigger when (messages.count(conv) - conversations.summary_message_count) >= 3
--              and messages.count(conv) >= 6
-- 注：D1/SQLite 的 ALTER TABLE 只支持 ADD COLUMN，不支持 IF NOT EXISTS 语法 —
-- 若重复执行会报 duplicate column name，migrations 追踪表 _migrations 会挡住重跑
ALTER TABLE conversations ADD COLUMN summary_message_count INTEGER DEFAULT 0;

-- 记录迁移版本
INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('014_conversation_summaries', 'Phase 1.1：SummaryProtocol v1 结构化摘要表 + conversations.summary_message_count 计数');
