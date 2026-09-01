-- 049: International customers verify by email, so phone is optional.
-- Keep the same table shape and rebuild only the phone nullability constraint.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE customers_049 (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',
    region TEXT,
    company TEXT,
    address TEXT,
    city TEXT,
    company_description TEXT,
    business_scope TEXT,
    logo_url TEXT,
    auth_status TEXT DEFAULT 'pending',
    onesignal_player_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO customers_049 (
    id, user_no, name, phone, email, password_hash, salt, region, company,
    address, city, company_description, business_scope, logo_url,
    auth_status, onesignal_player_id, created_at
)
SELECT
    id, user_no, name, phone, email, password_hash, salt, region, company,
    address, city, company_description, business_scope, logo_url,
    auth_status, onesignal_player_id, created_at
FROM customers;

DROP TABLE customers;
ALTER TABLE customers_049 RENAME TO customers;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique
  ON customers(lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('049_nullable_international_customer_phone', 'Allow verified international customer accounts without a phone number');

PRAGMA defer_foreign_keys = OFF;
