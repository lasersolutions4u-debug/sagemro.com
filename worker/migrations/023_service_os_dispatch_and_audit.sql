-- 023: SAGEMRO Service OS dispatch, work-order conversation, and audit fields
-- Deploy note:
-- wrangler d1 execute sagemro-db --env production --remote --file migrations/023_service_os_dispatch_and_audit.sql

ALTER TABLE leads ADD COLUMN source_type TEXT;
ALTER TABLE leads ADD COLUMN risk_level TEXT;
ALTER TABLE leads ADD COLUMN ai_summary TEXT;
ALTER TABLE leads ADD COLUMN recommended_next_step TEXT;
ALTER TABLE leads ADD COLUMN assignment_status TEXT DEFAULT 'unassigned';
ALTER TABLE leads ADD COLUMN customer_id TEXT;
ALTER TABLE leads ADD COLUMN device_id TEXT;
ALTER TABLE leads ADD COLUMN work_order_id TEXT;
ALTER TABLE leads ADD COLUMN region TEXT;

ALTER TABLE engineers ADD COLUMN engineer_role TEXT DEFAULT 'engineer';
ALTER TABLE engineers ADD COLUMN regional_lead_id TEXT;
ALTER TABLE engineers ADD COLUMN cooperation_status TEXT DEFAULT 'confirmed';
ALTER TABLE engineers ADD COLUMN certification_status TEXT DEFAULT 'pending';
ALTER TABLE engineers ADD COLUMN capability_tags TEXT DEFAULT '[]';
ALTER TABLE engineers ADD COLUMN brand_coverage TEXT DEFAULT '[]';
ALTER TABLE engineers ADD COLUMN workload_status TEXT DEFAULT 'available';
ALTER TABLE engineers ADD COLUMN responsible_region TEXT;
ALTER TABLE engineers ADD COLUMN team_name TEXT;
ALTER TABLE engineers ADD COLUMN first_login_password_reset_required INTEGER DEFAULT 1;
ALTER TABLE engineers ADD COLUMN service_policy_acknowledged_at TEXT;

ALTER TABLE work_orders ADD COLUMN assigned_regional_lead_id TEXT;
ALTER TABLE work_orders ADD COLUMN conflict_status TEXT DEFAULT 'clear';
ALTER TABLE work_orders ADD COLUMN conflict_reason TEXT;
ALTER TABLE work_orders ADD COLUMN quote_review_status TEXT DEFAULT 'not_required';
ALTER TABLE work_orders ADD COLUMN customer_confirmation_method TEXT;

ALTER TABLE work_order_messages ADD COLUMN attachment_urls TEXT;
ALTER TABLE work_order_messages ADD COLUMN is_internal_note INTEGER DEFAULT 0;
ALTER TABLE work_order_messages ADD COLUMN is_customer_visible INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    action TEXT NOT NULL,
    before_state TEXT,
    after_state TEXT,
    ip TEXT,
    device_info TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_source_type ON leads(source_type);
CREATE INDEX IF NOT EXISTS idx_leads_assignment_status ON leads(assignment_status);
CREATE INDEX IF NOT EXISTS idx_engineers_role ON engineers(engineer_role);
CREATE INDEX IF NOT EXISTS idx_engineers_regional_lead ON engineers(regional_lead_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_regional_lead ON work_orders(assigned_regional_lead_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_conflict_status ON work_orders(conflict_status);
CREATE INDEX IF NOT EXISTS idx_work_order_messages_visibility ON work_order_messages(work_order_id, is_customer_visible, is_internal_note);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
