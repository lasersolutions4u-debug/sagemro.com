-- 017_add_sla_fields: SLA 时效管理 — deadline + 超时标记
ALTER TABLE work_orders ADD COLUMN sla_deadline TEXT;
ALTER TABLE work_orders ADD COLUMN sla_breached_at TEXT;

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('017_add_sla_fields', 'SLA 时效管理：sla_deadline / sla_breached_at');
