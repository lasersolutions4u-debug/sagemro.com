-- 012_create_ai_trace_logs.sql
--
-- Phase 0.1：AI 工具调用确定性日志表
--
-- 目的：
--   - 给 Phase 0 的多轮 tool call 修复、role guard、specialties 过滤提供可验证日志
--   - 给 Phase 3 (RAG) / 未来 Agent 化提供可追溯链路
--   - 审计：哪个角色在哪个对话里调了什么工具、传了什么参、耗时多少、成功还是被拒/失败
--
-- 写入方式：worker 侧 ctx.waitUntil() 异步写入，不阻塞 SSE 响应
-- 留存策略：60 天自动裁剪（由独立 cron 或手动脚本处理；本迁移只建表）
--
-- 依赖：conversations.id 外键（软外键，不加 CASCADE；日志独立于对话生命周期）

CREATE TABLE IF NOT EXISTS ai_trace_logs (
    id TEXT PRIMARY KEY,

    -- 关联上下文
    conversation_id TEXT,                        -- 允许 NULL（比如 cron 里的独立调用）
    user_id TEXT,                                -- customers.id 或 engineers.id；NULL=游客
    user_role TEXT NOT NULL CHECK(user_role IN ('guest', 'customer', 'engineer', 'admin', 'system')),

    -- 调用本体
    tool_name TEXT NOT NULL,                     -- e.g. get_customer_devices
    args_json TEXT,                              -- 入参序列化（脱敏后）；超大入参只留 hash+size
    result_status TEXT NOT NULL CHECK(result_status IN ('ok', 'denied', 'error')),
    error_code TEXT,                             -- e.g. permission_denied / d1_error / upstream_timeout
    latency_ms INTEGER,                          -- 执行耗时

    -- 扩展字段（可选）
    iteration INTEGER DEFAULT 0,                 -- 多轮 tool call 里的第几轮（0=首轮）
    result_size_bytes INTEGER,                   -- 返回数据字节数，用于监控是否超预算

    created_at TEXT DEFAULT (datetime('now'))
);

-- 按对话查（调试 Phase 0 多轮 tool call 时最常用）
CREATE INDEX IF NOT EXISTS idx_ai_trace_logs_conv
  ON ai_trace_logs(conversation_id, created_at);

-- 按工具统计（监控哪个工具最常被拒/最常失败）
CREATE INDEX IF NOT EXISTS idx_ai_trace_logs_tool_status
  ON ai_trace_logs(tool_name, result_status, created_at);

-- 按时间清理（60 天留存策略依赖此索引）
CREATE INDEX IF NOT EXISTS idx_ai_trace_logs_created
  ON ai_trace_logs(created_at);

-- 记录迁移版本
INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('012_create_ai_trace_logs', 'Phase 0.1：AI 工具调用确定性日志表（tracing）');
