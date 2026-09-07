CREATE TABLE IF NOT EXISTS engineer_service_profiles (
    engineer_id TEXT PRIMARY KEY NOT NULL REFERENCES engineers(id) ON DELETE CASCADE,
    profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
    revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision > 0),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('050_engineer_service_profiles', 'Private self-reported engineer service costs and capabilities');
