-- 024: SAGEMRO AI evolution foundation
-- Deploy note:
-- wrangler d1 execute sagemro-db --env production --remote --file migrations/024_ai_evolution_foundation.sql

CREATE TABLE IF NOT EXISTS ai_interactions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    user_id TEXT,
    user_type TEXT,
    market TEXT NOT NULL,
    locale TEXT NOT NULL,
    intent TEXT,
    message TEXT NOT NULL,
    response TEXT,
    model TEXT,
    prompt_version TEXT,
    knowledge_version TEXT,
    response_time_ms INTEGER,
    created_work_order INTEGER DEFAULT 0,
    created_lead INTEGER DEFAULT 0,
    user_feedback TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_feedback_items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    interaction_id TEXT,
    conversation_id TEXT,
    work_order_id TEXT,
    title TEXT NOT NULL,
    original_message TEXT,
    ai_response TEXT,
    human_correction TEXT,
    recommended_action TEXT,
    owner_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL,
    locale TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    applicable_equipment TEXT,
    applicable_brand TEXT,
    applicable_model TEXT,
    risk_level TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_eval_cases (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL,
    locale TEXT NOT NULL,
    category TEXT NOT NULL,
    user_message TEXT NOT NULL,
    expected_behavior TEXT NOT NULL,
    must_include TEXT,
    must_not_include TEXT,
    should_create_work_order INTEGER DEFAULT 0,
    risk_level TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_eval_runs (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    prompt_version TEXT,
    knowledge_version TEXT,
    total_cases INTEGER NOT NULL,
    passed_cases INTEGER NOT NULL,
    failed_cases INTEGER NOT NULL,
    pass_rate REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_tool_traces (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    work_order_id TEXT,
    user_id TEXT,
    user_type TEXT,
    tool_name TEXT NOT NULL,
    tool_input TEXT,
    tool_output TEXT,
    allowed INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_conversation
  ON ai_interactions(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_market_intent
  ON ai_interactions(market, intent, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_status
  ON ai_feedback_items(status, severity, created_at);

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_lookup
  ON knowledge_articles(market, locale, category, status);

CREATE INDEX IF NOT EXISTS idx_ai_eval_cases_active
  ON ai_eval_cases(status, market, locale, category);

CREATE INDEX IF NOT EXISTS idx_ai_tool_traces_context
  ON ai_tool_traces(conversation_id, tool_name, created_at);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('024_ai_evolution_foundation', 'AI evolution foundation: interactions, feedback, knowledge, evals, tool traces');
