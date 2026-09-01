-- 048: Atomic quotas for the public service-request AI assistant.

CREATE TABLE IF NOT EXISTS service_request_assist_quotas (
    market TEXT NOT NULL CHECK (market IN ('com', 'cn')),
    scope TEXT NOT NULL,
    bucket TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    expires_at TEXT NOT NULL,
    PRIMARY KEY (market, scope, bucket)
);

CREATE INDEX IF NOT EXISTS idx_service_request_assist_quotas_expiry
    ON service_request_assist_quotas(expires_at);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('048_service_request_assist_quota', 'Atomic public service-request AI assistant quotas');
