ALTER TABLE customers ADD COLUMN email TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
