ALTER TABLE engineers ADD COLUMN email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_engineers_email_normalized
  ON engineers(lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique
  ON customers(lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE TABLE IF NOT EXISTS account_identities (
  identity_type TEXT NOT NULL CHECK(identity_type IN ('email', 'phone')),
  normalized_value TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('customer', 'engineer')),
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (identity_type, normalized_value),
  UNIQUE (owner_type, owner_id, identity_type)
);

CREATE INDEX IF NOT EXISTS idx_account_identities_owner
  ON account_identities(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS engineer_account_activations (
  id TEXT PRIMARY KEY,
  engineer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_by TEXT,
  sent_at TEXT,
  send_status TEXT NOT NULL DEFAULT 'pending',
  send_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

CREATE INDEX IF NOT EXISTS idx_engineer_activations_engineer
  ON engineer_account_activations(engineer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engineer_activations_active
  ON engineer_account_activations(engineer_id, used_at, revoked_at, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_activations_one_open
  ON engineer_account_activations(engineer_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_engineer_applications_converted_user
  ON engineer_applications(converted_user_id);

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
SELECT 'email', lower(trim(email)), 'customer', id
FROM customers
WHERE email IS NOT NULL AND trim(email) <> '';

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
SELECT 'phone', replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '-', ''), '(', ''), ')', ''), '.', ''), 'customer', id
FROM customers
WHERE phone IS NOT NULL AND trim(phone) <> '';

INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
SELECT 'phone', replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '-', ''), '(', ''), ')', ''), '.', ''), 'engineer', id
FROM engineers
WHERE phone IS NOT NULL AND trim(phone) <> '';

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('037_engineer_account_activation', 'Engineer email activation and cross-role identity registry');
