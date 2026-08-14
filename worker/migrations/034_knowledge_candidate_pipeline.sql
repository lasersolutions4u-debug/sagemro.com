-- 034: Structured service-report evidence and the reviewed knowledge-candidate pipeline.

ALTER TABLE work_order_repair_records ADD COLUMN inspection_process TEXT;
ALTER TABLE work_order_repair_records ADD COLUMN verification_result TEXT;
ALTER TABLE work_order_repair_records ADD COLUMN follow_up_advice TEXT;
ALTER TABLE work_order_repair_records ADD COLUMN report_quality_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE work_order_repair_records ADD COLUMN submitted_at TEXT;
ALTER TABLE work_order_repair_records ADD COLUMN customer_confirmed_at TEXT;

CREATE TABLE IF NOT EXISTS knowledge_candidates (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL CHECK (market IN ('global', 'cn')),
    source_type TEXT NOT NULL CHECK (source_type IN ('work_order', 'historical_case', 'manual')),
    source_work_order_id TEXT,
    source_repair_record_id TEXT UNIQUE,
    contributor_engineer_id TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_operations' CHECK (
        status IN (
            'awaiting_operations',
            'operations_editing',
            'awaiting_technical_review',
            'changes_requested',
            'approved',
            'retrieval_testing',
            'ai_active',
            'rejected',
            'archived'
        )
    ),
    title TEXT,
    category TEXT,
    raw_content TEXT NOT NULL,
    sanitized_content TEXT,
    equipment_type TEXT,
    brand TEXT,
    model TEXT,
    alarm_codes_json TEXT NOT NULL DEFAULT '[]',
    risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
    evidence_type TEXT NOT NULL DEFAULT 'service_report',
    evidence_notes TEXT,
    -- Intentionally typed actor references: operations owners are admins; technical reviewers are admins or engineers.
    operations_owner_type TEXT CHECK (operations_owner_type IN ('admin')),
    operations_owner_id TEXT,
    technical_reviewer_type TEXT CHECK (technical_reviewer_type IN ('admin', 'engineer')),
    technical_reviewer_id TEXT,
    review_notes TEXT,
    knowledge_article_id TEXT,
    internal_use_allowed INTEGER NOT NULL DEFAULT 1 CHECK (internal_use_allowed IN (0, 1)),
    public_use_allowed INTEGER NOT NULL DEFAULT 0 CHECK (public_use_allowed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (source_repair_record_id) REFERENCES work_order_repair_records(id),
    FOREIGN KEY (contributor_engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (knowledge_article_id) REFERENCES knowledge_articles(id),
    CHECK (
        (operations_owner_type IS NULL AND operations_owner_id IS NULL)
        OR (operations_owner_type IS NOT NULL AND operations_owner_id IS NOT NULL)
    ),
    CHECK (
        (technical_reviewer_type IS NULL AND technical_reviewer_id IS NULL)
        OR (technical_reviewer_type IS NOT NULL AND technical_reviewer_id IS NOT NULL)
    ),
    CHECK (
        (
            source_type = 'work_order'
            AND source_work_order_id IS NOT NULL
            AND source_repair_record_id IS NOT NULL
        )
        OR (
            source_type IN ('historical_case', 'manual')
            AND source_work_order_id IS NULL
            AND source_repair_record_id IS NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status_market
    ON knowledge_candidates(market, status, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_knowledge_candidates_source_match_insert
BEFORE INSERT ON knowledge_candidates
WHEN NEW.source_type = 'work_order'
BEGIN
    SELECT RAISE(ABORT, 'knowledge_candidate_source_mismatch')
    WHERE NOT EXISTS (
        SELECT 1
        FROM work_order_repair_records
        WHERE id = NEW.source_repair_record_id
          AND work_order_id = NEW.source_work_order_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_candidates_source_match_update
BEFORE UPDATE OF source_type, source_work_order_id, source_repair_record_id ON knowledge_candidates
WHEN NEW.source_type = 'work_order'
BEGIN
    SELECT RAISE(ABORT, 'knowledge_candidate_source_mismatch')
    WHERE NOT EXISTS (
        SELECT 1
        FROM work_order_repair_records
        WHERE id = NEW.source_repair_record_id
          AND work_order_id = NEW.source_work_order_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_repair_records_preserve_candidate_source
BEFORE UPDATE OF work_order_id ON work_order_repair_records
BEGIN
    SELECT RAISE(ABORT, 'knowledge_candidate_source_mismatch')
    WHERE EXISTS (
        SELECT 1
        FROM knowledge_candidates
        WHERE source_repair_record_id = OLD.id
          AND source_type = 'work_order'
          AND source_work_order_id <> NEW.work_order_id
    );
END;

CREATE TABLE IF NOT EXISTS knowledge_candidate_events (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    -- Intentionally polymorphic actor reference: human actors carry an id; system actors do not.
    actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'engineer', 'customer', 'system')),
    actor_user_id TEXT,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    notes TEXT,
    snapshot_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES knowledge_candidates(id),
    CHECK (
        (actor_type = 'system' AND actor_user_id IS NULL)
        OR (actor_type IN ('admin', 'engineer', 'customer') AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidate_events_candidate_created
    ON knowledge_candidate_events(candidate_id, created_at DESC);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('034_knowledge_candidate_pipeline', 'Structured repair evidence and reviewed knowledge-candidate lifecycle');
