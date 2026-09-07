ALTER TABLE admin_staff_accounts ADD COLUMN business_profile_required INTEGER NOT NULL DEFAULT 0 CHECK(business_profile_required IN (0,1));
CREATE TABLE IF NOT EXISTS business_staff_profiles (
  staff_id TEXT PRIMARY KEY REFERENCES admin_staff_accounts(id),
  role TEXT NOT NULL CHECK(role IN ('business_director','business_manager','business_specialist')),
  grade INTEGER NOT NULL CHECK(grade IN (1,2,3)),
  supervisor_staff_id TEXT REFERENCES admin_staff_accounts(id),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(staff_id <> supervisor_staff_id),
  CHECK((role = 'business_director' AND supervisor_staff_id IS NULL) OR (role <> 'business_director' AND supervisor_staff_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS business_territories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK(market IN ('com','cn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_director_territories (
  staff_id TEXT NOT NULL REFERENCES business_staff_profiles(staff_id),
  territory_id TEXT NOT NULL REFERENCES business_territories(id),
  PRIMARY KEY(staff_id,territory_id)
);
CREATE TABLE IF NOT EXISTS business_record_assignments (
  kind TEXT NOT NULL CHECK(kind IN ('customer','lead','work_order')),
  record_id TEXT NOT NULL,
  territory_id TEXT NOT NULL REFERENCES business_territories(id),
  owner_staff_id TEXT NOT NULL REFERENCES admin_staff_accounts(id),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(kind,record_id)
);
CREATE INDEX IF NOT EXISTS idx_business_assignments_scope ON business_record_assignments(kind,territory_id,owner_staff_id,record_id);
CREATE TABLE IF NOT EXISTS business_scope_version (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO business_scope_version(id) VALUES (1);
CREATE TRIGGER IF NOT EXISTS admin_staff_accounts_scope_insert AFTER INSERT ON admin_staff_accounts BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS admin_staff_accounts_scope_update AFTER UPDATE ON admin_staff_accounts BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS admin_staff_accounts_scope_delete AFTER DELETE ON admin_staff_accounts BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_staff_profiles_scope_insert AFTER INSERT ON business_staff_profiles BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_staff_profiles_scope_update AFTER UPDATE ON business_staff_profiles BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_staff_profiles_scope_delete AFTER DELETE ON business_staff_profiles BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_territories_scope_insert AFTER INSERT ON business_territories BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_territories_scope_update AFTER UPDATE ON business_territories BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_territories_scope_delete AFTER DELETE ON business_territories BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_director_territories_scope_insert AFTER INSERT ON business_director_territories BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_director_territories_scope_update AFTER UPDATE ON business_director_territories BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_director_territories_scope_delete AFTER DELETE ON business_director_territories BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_record_assignments_scope_insert AFTER INSERT ON business_record_assignments BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_record_assignments_scope_update AFTER UPDATE ON business_record_assignments BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_record_assignments_scope_delete AFTER DELETE ON business_record_assignments BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
INSERT OR IGNORE INTO _migrations(version,note) VALUES ('051_business_scope','Business staff identity and record scope');
