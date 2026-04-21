-- 007_create_engineer_reviews.sql
-- 工程师对客户的评价（仅工程师和平台可见，客户不可见）

CREATE TABLE IF NOT EXISTS engineer_reviews (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  rating_cooperation INTEGER NOT NULL,      -- 配合度 1-5
  rating_communication INTEGER NOT NULL,    -- 沟通顺畅度 1-5
  rating_payment INTEGER NOT NULL,          -- 付款及时性 1-5
  rating_environment INTEGER NOT NULL,      -- 现场环境 1-5
  comment TEXT,                              -- 文字评价
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE UNIQUE INDEX idx_engineer_reviews_wo ON engineer_reviews(work_order_id);
CREATE INDEX idx_engineer_reviews_customer ON engineer_reviews(customer_id);
CREATE INDEX idx_engineer_reviews_engineer ON engineer_reviews(engineer_id);
