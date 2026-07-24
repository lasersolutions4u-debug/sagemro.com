-- ============================================================
-- schema.sql — 全量当前状态快照（由 migrations/ 累加合并而成）
--
-- 🔑 真相源政策（Source of Truth）：
--   - **migrations/** 是唯一真相源；每次改表必须通过新增 NNN_xxx.sql。
--   - **schema.sql**（本文件）是全量快照，用途仅两种：
--       1) 给新 D1 实例一键建表的便利脚本（等同于顺序跑完 migrations/*.sql）
--       2) 代码 review 时看当前整体结构的参考文档
--   - 任何 schema 改动**必须**先写 migration，再把变更同步到本文件。
--
-- 新库初始化推荐：
--     wrangler d1 execute sagemro-db --file schema.sql
-- 或（线上增量）：
--     for f in migrations/*.sql; do wrangler d1 execute sagemro-db --file "$f"; done
-- ============================================================

-- 迁移跟踪表（011）
CREATE TABLE IF NOT EXISTS _migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now')),
    note TEXT
);

-- 对话表（000 + 010 + 015）
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '新对话',
    last_message TEXT,
    customer_id TEXT,                          -- 010: 归属客户，IDOR 校验依赖此列
    engineer_id TEXT,                          -- 015: 归属工程师，工程师对话查询依赖此列
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_engineer_id ON conversations(engineer_id);

-- 消息表（000 + 020）
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    image_urls TEXT,                               -- JSON 数组，存储聊天图片 URL
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- 客户用户表（000 + 001a + 005 + 009）
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,              -- U + 6位数字
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,                                -- 030: international customer login email
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',
    region TEXT,
    -- 005 公司信息
    company TEXT,
    address TEXT,
    city TEXT,
    company_description TEXT,
    business_scope TEXT,
    logo_url TEXT,
    auth_status TEXT DEFAULT 'pending',
    -- 009 推送
    onesignal_player_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_normalized_unique
  ON customers(lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- 工程师表（000 + 001 + 001a + 003 + 005）
CREATE TABLE IF NOT EXISTS engineers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,              -- E + 6位数字
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,                                -- 037: account activation and email login
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL DEFAULT '',

    -- 背景调查信息
    specialties TEXT NOT NULL DEFAULT '[]',
    brands TEXT DEFAULT '{}',
    services TEXT NOT NULL DEFAULT '[]',
    service_region TEXT,
    bio TEXT,

    -- 001 合伙人等级体系
    level TEXT DEFAULT 'junior',               -- junior / senior / expert
    commission_rate REAL DEFAULT 0.80,
    credit_score INTEGER DEFAULT 100,

    -- 001 财务
    deposit_balance INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    tax_subject TEXT,
    legal_person TEXT,
    bank_account TEXT,
    bank_name TEXT,
    bank_branch TEXT DEFAULT '',         -- 012
    account_holder TEXT DEFAULT '',      -- 012
    payout_method TEXT DEFAULT 'paypal',
    paypal_account TEXT,
    bank_country TEXT,
    bank_swift_code TEXT,
    payout_notes TEXT,

    -- 状态和评分
    status TEXT DEFAULT 'available',           -- available / paused / offline / pending_approval
    engineer_role TEXT DEFAULT 'engineer',     -- 023: regional_lead / engineer
    regional_lead_id TEXT,                     -- 023: 所属区域负责人
    cooperation_status TEXT DEFAULT 'confirmed',
    certification_status TEXT DEFAULT 'pending',
    capability_tags TEXT DEFAULT '[]',
    brand_coverage TEXT DEFAULT '[]',
    workload_status TEXT DEFAULT 'available',
    responsible_region TEXT,
    team_name TEXT,
    first_login_password_reset_required INTEGER DEFAULT 1,
    service_policy_acknowledged_at TEXT,
    rating_timeliness REAL DEFAULT 0,
    rating_technical REAL DEFAULT 0,
    rating_communication REAL DEFAULT 0,
    rating_professional REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,

    -- 统计
    total_orders INTEGER DEFAULT 0,
    complex_orders INTEGER DEFAULT 0,
    success_orders INTEGER DEFAULT 0,

    -- 005 公司信息
    company TEXT,
    address TEXT,
    city TEXT,
    company_description TEXT,
    business_scope TEXT,
    logo_url TEXT,
    auth_status TEXT DEFAULT 'pending',

    -- 003 推送
    onesignal_player_id TEXT,

    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_engineers_status ON engineers(status);
CREATE INDEX IF NOT EXISTS idx_engineers_level ON engineers(level);
CREATE INDEX IF NOT EXISTS idx_engineers_role ON engineers(engineer_role);
CREATE INDEX IF NOT EXISTS idx_engineers_regional_lead ON engineers(regional_lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_engineers_email_normalized
  ON engineers(lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- 设备表（000 + 004）
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    type TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    power TEXT,
    -- 004 扩展
    name TEXT,                                 -- 如"车间1号激光机"
    status TEXT DEFAULT 'normal',              -- normal / running / maintenance
    photo_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 工单表（000）
CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    engineer_id TEXT,
    device_id TEXT,

    type TEXT NOT NULL,                        -- fault / maintenance / parameter / other
    description TEXT NOT NULL,
    urgency TEXT DEFAULT 'normal',             -- normal / urgent / critical

    status TEXT DEFAULT 'pending',             -- pending / assigned / in_progress / pricing / in_service / resolved / pending_review / completed / rejected / cancelled

    ai_summary TEXT,
    ai_recommendation TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    assigned_at TEXT,
    started_at TEXT,
    resolved_at TEXT,
    completed_at TEXT,

    recommend_count INTEGER DEFAULT 0,
    rejected_engineers TEXT DEFAULT '[]',      -- JSON 数组

    sla_deadline TEXT,                         -- 017: SLA 截止时间 (ISO 8601)
    sla_breached_at TEXT,                      -- 017: SLA 超时标记时间

    category_l1 TEXT DEFAULT 'other',          -- 018: 设备大类
    category_l2 TEXT DEFAULT 'other',          -- 018: 问题类型

    assigned_regional_lead_id TEXT,            -- 023: Admin 分配的区域负责人
    conflict_status TEXT DEFAULT 'clear',      -- 023: clear / review_required / blocked
    conflict_reason TEXT,
    quote_review_status TEXT DEFAULT 'not_required',
    customer_confirmation_method TEXT,
    service_mode TEXT NOT NULL DEFAULT 'remote',
    arrival_verification_required INTEGER NOT NULL DEFAULT 0,
    service_address TEXT,
    service_latitude REAL,
    service_longitude REAL,
    service_accuracy_m REAL,
    service_coordinate_system TEXT DEFAULT 'wgs84',
    service_location_source TEXT,
    service_location_confirmed_at TEXT,
    arrival_verified_at TEXT,
    arrival_distance_m REAL,
    arrival_radius_m REAL,
    arrival_accuracy_m REAL,
    arrival_latitude REAL,
    arrival_longitude REAL,
    arrival_coordinate_system TEXT,
    arrival_location_source TEXT,
    onsite_conversion_status TEXT NOT NULL DEFAULT 'not_requested',
    onsite_conversion_requested_at TEXT,
    onsite_conversion_requested_by TEXT,
    onsite_conversion_request_note TEXT,
    onsite_conversion_confirmed_at TEXT,
    onsite_conversion_confirmed_by TEXT,
    onsite_conversion_confirmation_note TEXT,
    arrival_override_at TEXT,
    arrival_override_by TEXT,
    arrival_override_reason TEXT,
    site_timezone TEXT,
    expected_service_days INTEGER,
    expected_completion_date TEXT,
    planned_daily_start_time TEXT,
    planned_daily_end_time TEXT,
    updated_at TEXT,
    quote_expected_service_days INTEGER,
    approved_extension_days INTEGER NOT NULL DEFAULT 0,
    active_quote_version INTEGER,

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_engineer ON work_orders(engineer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_regional_lead ON work_orders(assigned_regional_lead_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_conflict_status ON work_orders(conflict_status);

CREATE TABLE IF NOT EXISTS work_order_arrival_checks (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    accuracy_m REAL,
    coordinate_system TEXT,
    location_source TEXT NOT NULL DEFAULT 'browser',
    distance_m REAL,
    radius_m REAL,
    within_geofence INTEGER,
    failure_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_arrival_checks_work_order ON work_order_arrival_checks(work_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arrival_checks_engineer ON work_order_arrival_checks(engineer_id, created_at);

-- 现场作业日与私有证据（039）
CREATE TABLE IF NOT EXISTS work_order_field_days (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  site_local_date TEXT NOT NULL,
  site_timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'checked_in',
  check_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  expected_check_out_at TEXT,
  report_submitted_at TEXT,
  labor_hours REAL,
  completed_work TEXT,
  issues_risks TEXT,
  next_plan TEXT,
  customer_support_needed TEXT,
  internal_note TEXT,
  late_reason TEXT,
  location_status TEXT NOT NULL DEFAULT 'unavailable',
  latitude REAL,
  longitude REAL,
  accuracy_m REAL,
  coordinate_system TEXT,
  location_source TEXT,
  distance_m REAL,
  radius_m REAL,
  within_geofence INTEGER,
  check_in_idempotency_key TEXT,
  report_idempotency_key TEXT,
  checkout_reminder_sent_at TEXT,
  overdue_notification_sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(id, work_order_id),
  UNIQUE(work_order_id, engineer_id, site_local_date),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_field_days_work_order_date ON work_order_field_days(work_order_id, site_local_date DESC);
CREATE INDEX IF NOT EXISTS idx_field_days_status ON work_order_field_days(status, expected_check_out_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_days_check_in_idempotency ON work_order_field_days(check_in_idempotency_key) WHERE check_in_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_days_report_idempotency ON work_order_field_days(report_idempotency_key) WHERE report_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS work_order_field_day_media (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  field_day_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploader_type TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  customer_visible INTEGER NOT NULL DEFAULT 1,
  capture_source TEXT NOT NULL,
  privacy_retention_due_at TEXT,
  retention_claim_token TEXT,
  retention_claimed_at TEXT,
  deleted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (field_day_id, work_order_id) REFERENCES work_order_field_days(id, work_order_id)
);
CREATE INDEX IF NOT EXISTS idx_field_day_media_day ON work_order_field_day_media(field_day_id, created_at);
CREATE INDEX IF NOT EXISTS idx_field_day_media_retention ON work_order_field_day_media(privacy_retention_due_at, deleted_at);
CREATE INDEX IF NOT EXISTS idx_field_day_media_retention_claim ON work_order_field_day_media(retention_claim_token, retention_claimed_at);

CREATE TABLE IF NOT EXISTS work_order_extension_requests (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  field_day_id TEXT,
  engineer_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  customer_explanation TEXT NOT NULL,
  internal_note TEXT,
  requested_additional_days INTEGER NOT NULL,
  proposed_completion_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  original_plan TEXT NOT NULL,
  approved_plan TEXT,
  decided_by TEXT,
  decision_reason TEXT,
  decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (field_day_id, work_order_id) REFERENCES work_order_field_days(id, work_order_id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_extension_requests_work_order ON work_order_extension_requests(work_order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_requests_one_pending ON work_order_extension_requests(work_order_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS work_order_field_day_revisions (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  field_day_id TEXT NOT NULL,
  previous_report TEXT NOT NULL,
  changed_by_type TEXT NOT NULL,
  changed_by_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (field_day_id, work_order_id) REFERENCES work_order_field_days(id, work_order_id)
);
CREATE INDEX IF NOT EXISTS idx_field_day_revisions_day ON work_order_field_day_revisions(field_day_id, created_at DESC);

CREATE TABLE IF NOT EXISTS work_order_field_evidence_holds (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  reason_category TEXT NOT NULL CHECK (reason_category IN ('complaint', 'warranty', 'safety_review', 'legal_hold', 'dispute')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  opened_by TEXT NOT NULL,
  opened_at TEXT DEFAULT (datetime('now')),
  resolved_by TEXT,
  resolution_reason TEXT,
  resolved_at TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_field_evidence_holds_work_order ON work_order_field_evidence_holds(work_order_id, status, opened_at DESC);

CREATE TABLE IF NOT EXISTS field_evidence_cleanup_queue (
  object_key TEXT PRIMARY KEY,
  failure_reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 工单进度日志（000）
CREATE TABLE IF NOT EXISTS work_order_logs (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT,
    actor_id TEXT,
    content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);

-- 维修记录（016）
CREATE TABLE IF NOT EXISTS work_order_repair_records (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    symptom TEXT,
    diagnosis TEXT,
    solution TEXT,
    parts_used TEXT DEFAULT '[]',
    labor_hours REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_repair_records_wo ON work_order_repair_records(work_order_id);

-- 评价表（000）
CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating_timeliness INTEGER NOT NULL,
    rating_technical INTEGER NOT NULL,
    rating_communication INTEGER NOT NULL,
    rating_professional INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_engineer ON ratings(engineer_id);

-- 管理员回复表（008）
CREATE TABLE IF NOT EXISTS admin_replies (
    id TEXT PRIMARY KEY,
    rating_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rating_id) REFERENCES ratings(id)
);
CREATE INDEX IF NOT EXISTS idx_admin_replies_rating ON admin_replies(rating_id);

-- 平台评价表（008）
CREATE TABLE IF NOT EXISTS platform_ratings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_platform_ratings_customer ON platform_ratings(customer_id);

-- 客户评价表（工程师→客户，仅内部，008）
CREATE TABLE IF NOT EXISTS customer_ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_wo ON customer_ratings(work_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_engineer ON customer_ratings(engineer_id);

-- 工单核价表（002/008）
CREATE TABLE IF NOT EXISTS work_order_pricing (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT,
    labor_fee INTEGER DEFAULT 0,
    parts_fee INTEGER DEFAULT 0,
    travel_fee INTEGER DEFAULT 0,
    other_fee INTEGER DEFAULT 0,
    parts_detail TEXT DEFAULT '',
    platform_fee INTEGER DEFAULT 0,
    deposit_withhold INTEGER DEFAULT 0,
    subtotal INTEGER DEFAULT 0,
    total_amount INTEGER DEFAULT 0,
    ai_price_check TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',               -- draft / submitted / confirmed / rejected
    submitted_at TEXT,
    confirmed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    quote_version INTEGER NOT NULL DEFAULT 0,
    expected_service_days INTEGER,
    payment_plan_mode TEXT NOT NULL DEFAULT 'single'
      CHECK (payment_plan_mode IN ('single', 'installments')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_pricing_wo ON work_order_pricing(work_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_pricing_id_order ON work_order_pricing(id, work_order_id);

-- 工单消息表（008）
CREATE TABLE IF NOT EXISTS work_order_messages (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,                 -- customer / engineer / system
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',          -- text / pricing_update / system
    attachment_urls TEXT,                      -- 023: JSON 数组
    is_internal_note INTEGER DEFAULT 0,        -- 023: 内部备注
    is_customer_visible INTEGER DEFAULT 1,     -- 023: 客户可见消息
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_messages_wo ON work_order_messages(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_messages_visibility ON work_order_messages(work_order_id, is_customer_visible, is_internal_note);

-- 工单报价历史（008）
CREATE TABLE IF NOT EXISTS work_order_pricing_history (
    id TEXT PRIMARY KEY,
    pricing_id TEXT NOT NULL,
    labor_fee INTEGER DEFAULT 0,
    parts_fee INTEGER DEFAULT 0,
    travel_fee INTEGER DEFAULT 0,
    other_fee INTEGER DEFAULT 0,
    parts_detail TEXT DEFAULT '',
    subtotal INTEGER DEFAULT 0,
    total_amount INTEGER DEFAULT 0,
    platform_fee INTEGER DEFAULT 0,
    deposit_withhold INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    expected_service_days INTEGER,
    payment_plan_mode TEXT NOT NULL DEFAULT 'single'
      CHECK (payment_plan_mode IN ('single', 'installments')),
    quote_kind TEXT NOT NULL DEFAULT 'baseline',
    parent_quote_version INTEGER,
    status TEXT NOT NULL DEFAULT 'legacy',
    approved_at TEXT,
    confirmed_at TEXT,
    FOREIGN KEY (pricing_id) REFERENCES work_order_pricing(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_pricing_history_pricing ON work_order_pricing_history(pricing_id);

-- 报价执行计划、收款进度与私有凭证元数据（041）
CREATE TABLE IF NOT EXISTS work_order_payment_schedule (
  id TEXT PRIMARY KEY,
  pricing_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  quote_version INTEGER NOT NULL CHECK (quote_version >= 1 AND typeof(quote_version) = 'integer'),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 6 AND typeof(sequence) = 'integer'),
  amount INTEGER NOT NULL CHECK (amount > 0 AND typeof(amount) = 'integer'),
  currency TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'before_start', 'on_arrival', 'milestone', 'on_completion', 'on_acceptance', 'fixed_date'
  )),
  due_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  required_before_start INTEGER NOT NULL DEFAULT 0
    CHECK (required_before_start IN (0, 1) AND typeof(required_before_start) = 'integer'),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (id, work_order_id),
  UNIQUE (pricing_id, quote_version, sequence),
  CHECK (
    (trigger_type = 'fixed_date'
      AND due_date IS NOT NULL
      AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
    OR (trigger_type <> 'fixed_date' AND due_date IS NULL)
  ),
  CHECK (trigger_type <> 'milestone' OR trim(description) <> ''),
  FOREIGN KEY (pricing_id, work_order_id) REFERENCES work_order_pricing(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_order_version
  ON work_order_payment_schedule(work_order_id, quote_version, sequence);

CREATE TABLE IF NOT EXISTS work_order_installments (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL UNIQUE,
  work_order_id TEXT NOT NULL,
  quote_version INTEGER NOT NULL CHECK (quote_version >= 1 AND typeof(quote_version) = 'integer'),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 6 AND typeof(sequence) = 'integer'),
  amount INTEGER NOT NULL CHECK (amount > 0 AND typeof(amount) = 'integer'),
  currency TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'before_start', 'on_arrival', 'milestone', 'on_completion', 'on_acceptance', 'fixed_date'
  )),
  due_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  required_before_start INTEGER NOT NULL DEFAULT 0
    CHECK (required_before_start IN (0, 1) AND typeof(required_before_start) = 'integer'),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'due', 'collecting', 'pending_confirmation',
    'partially_received', 'received', 'overdue', 'exception'
  )),
  payment_method TEXT,
  collection_started_at TEXT,
  received_amount INTEGER NOT NULL DEFAULT 0 CHECK (
    received_amount >= 0 AND received_amount <= amount AND typeof(received_amount) = 'integer'
  ),
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (id, work_order_id),
  UNIQUE (work_order_id, quote_version, sequence),
  CHECK (
    (trigger_type = 'fixed_date'
      AND due_date IS NOT NULL
      AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
    OR (trigger_type <> 'fixed_date' AND due_date IS NULL)
  ),
  CHECK (trigger_type <> 'milestone' OR trim(description) <> ''),
  FOREIGN KEY (schedule_id, work_order_id)
    REFERENCES work_order_payment_schedule(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_installments_order_status
  ON work_order_installments(work_order_id, status, sequence);
CREATE INDEX IF NOT EXISTS idx_installments_status_due_date
  ON work_order_installments(status, due_date);

CREATE TRIGGER IF NOT EXISTS quote_execution_installment_snapshot_insert
BEFORE INSERT ON work_order_installments
WHEN NOT EXISTS (
  SELECT 1 FROM work_order_payment_schedule schedule
  WHERE schedule.id = NEW.schedule_id
    AND schedule.work_order_id = NEW.work_order_id
    AND schedule.quote_version = NEW.quote_version
    AND schedule.sequence = NEW.sequence
    AND schedule.amount = NEW.amount
    AND schedule.currency = NEW.currency
    AND schedule.trigger_type = NEW.trigger_type
    AND schedule.due_date IS NEW.due_date
    AND schedule.description = NEW.description
    AND schedule.required_before_start = NEW.required_before_start
)
BEGIN
  SELECT RAISE(ABORT, 'installment schedule snapshot mismatch');
END;

CREATE TRIGGER IF NOT EXISTS quote_execution_installment_snapshot_update
BEFORE UPDATE ON work_order_installments
WHEN NOT EXISTS (
  SELECT 1 FROM work_order_payment_schedule schedule
  WHERE schedule.id = NEW.schedule_id
    AND schedule.work_order_id = NEW.work_order_id
    AND schedule.quote_version = NEW.quote_version
    AND schedule.sequence = NEW.sequence
    AND schedule.amount = NEW.amount
    AND schedule.currency = NEW.currency
    AND schedule.trigger_type = NEW.trigger_type
    AND schedule.due_date IS NEW.due_date
    AND schedule.description = NEW.description
    AND schedule.required_before_start = NEW.required_before_start
)
BEGIN
  SELECT RAISE(ABORT, 'installment schedule snapshot mismatch');
END;

CREATE TRIGGER IF NOT EXISTS quote_execution_schedule_update_guard
BEFORE UPDATE ON work_order_payment_schedule
WHEN EXISTS (
  SELECT 1 FROM work_order_pricing_history history
  WHERE history.status IN ('approved', 'confirmed')
    AND (
      (history.pricing_id = OLD.pricing_id AND history.version = OLD.quote_version)
      OR (history.pricing_id = NEW.pricing_id AND history.version = NEW.quote_version)
    )
)
OR EXISTS (
  SELECT 1 FROM work_order_installments installment
  WHERE installment.schedule_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'protected quote payment schedule');
END;

CREATE TRIGGER IF NOT EXISTS quote_execution_schedule_delete_guard
BEFORE DELETE ON work_order_payment_schedule
WHEN EXISTS (
  SELECT 1 FROM work_order_pricing_history history
  WHERE history.pricing_id = OLD.pricing_id
    AND history.version = OLD.quote_version
    AND history.status IN ('approved', 'confirmed')
)
OR EXISTS (
  SELECT 1 FROM work_order_installments installment
  WHERE installment.schedule_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'protected quote payment schedule');
END;

CREATE TABLE IF NOT EXISTS work_order_receipt_claims (
  id TEXT PRIMARY KEY,
  installment_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  engineer_id TEXT NOT NULL,
  claimed_amount INTEGER NOT NULL CHECK (claimed_amount > 0 AND typeof(claimed_amount) = 'integer'),
  transaction_reference TEXT,
  engineer_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_amount INTEGER CHECK (
    confirmed_amount IS NULL
    OR (confirmed_amount >= 0 AND typeof(confirmed_amount) = 'integer')
  ),
  decision_reason TEXT,
  decided_by TEXT,
  decided_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  decision_idempotency_key TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (id, work_order_id),
  FOREIGN KEY (installment_id, work_order_id)
    REFERENCES work_order_installments(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_claims_installment_status
  ON work_order_receipt_claims(installment_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_receipt_claims_order_status
  ON work_order_receipt_claims(work_order_id, status, created_at);

CREATE TABLE IF NOT EXISTS work_order_receipt_evidence (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE,
  work_order_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND typeof(file_size) = 'integer'),
  uploader_type TEXT NOT NULL CHECK (uploader_type IN ('engineer', 'customer', 'admin')),
  uploader_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (claim_id, work_order_id)
    REFERENCES work_order_receipt_claims(id, work_order_id),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_evidence_order
  ON work_order_receipt_evidence(work_order_id, created_at);

-- 工单支付记录表（012）
CREATE TABLE IF NOT EXISTS work_order_payments (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    customer_id TEXT,
    amount INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'bank_transfer',
    transaction_id TEXT UNIQUE,
    status TEXT DEFAULT 'completed',
    payment_stage TEXT NOT NULL DEFAULT 'advance',
    quote_total_amount INTEGER DEFAULT 0,
    advance_amount INTEGER DEFAULT 0,
    balance_amount INTEGER DEFAULT 0,
    paid_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_wo ON work_order_payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_stage ON work_order_payments(work_order_id, payment_stage, created_at);

-- 发票申请（032）
CREATE TABLE IF NOT EXISTS invoice_requests (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    customer_id TEXT,
    invoice_type TEXT DEFAULT '普通发票',
    company_name TEXT NOT NULL,
    tax_id TEXT NOT NULL,
    company_address TEXT DEFAULT '',
    company_phone TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    bank_account TEXT DEFAULT '',
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    invoice_number TEXT DEFAULT '',
    admin_notes TEXT DEFAULT '',
    issued_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_wo ON invoice_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status ON invoice_requests(status);

CREATE TABLE IF NOT EXISTS work_order_payouts (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT NOT NULL,
    amount INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    method TEXT,
    status TEXT DEFAULT 'not_ready',
    transaction_reference TEXT,
    paid_at TEXT,
    internal_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_payouts_status ON work_order_payouts(status);
CREATE INDEX IF NOT EXISTS idx_work_order_payouts_engineer ON work_order_payouts(engineer_id);

-- 工单附件表（019）
CREATE TABLE IF NOT EXISTS work_order_attachments (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    uploader_type TEXT NOT NULL,
    uploader_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    r2_url TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attachments_work_order ON work_order_attachments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON work_order_attachments(uploader_id, uploader_type);

-- 合伙人钱包流水（001/002）
CREATE TABLE IF NOT EXISTS engineer_wallets (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,                        -- income / withdraw / deduction
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',             -- pending / completed / failed
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人保证金流水（001/002）
CREATE TABLE IF NOT EXISTS engineer_deposits (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,                        -- withhold / refund / deduction / initial
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人晋升记录（001/002）
CREATE TABLE IF NOT EXISTS engineer_promotions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    from_level TEXT,
    to_level TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',             -- pending / approved / rejected
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人违约记录（001/002）
CREATE TABLE IF NOT EXISTS engineer_violations (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    violation_type TEXT NOT NULL,              -- private_order / fake_parts / complaint / refusal / no_show
    credit_deduction INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',             -- pending / confirmed / appealed
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 合伙人提现申请（001/002）
CREATE TABLE IF NOT EXISTS engineer_withdrawals (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',             -- pending / processing / completed / failed
    fail_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- OneSignal 推送订阅记录（003）
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    onesignal_player_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);

-- 通知表（006）
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL,                   -- customer / engineer
    type TEXT NOT NULL,                        -- new_ticket / ticket_accepted / pricing_submitted / pricing_confirmed / ticket_resolved / rating_received
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,                                 -- JSON 上下文
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- 工程师对客户评价（007）
CREATE TABLE IF NOT EXISTS engineer_reviews (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating_cooperation INTEGER NOT NULL,
    rating_communication INTEGER NOT NULL,
    rating_payment INTEGER NOT NULL,
    rating_environment INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_reviews_wo ON engineer_reviews(work_order_id);
CREATE INDEX IF NOT EXISTS idx_engineer_reviews_customer ON engineer_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_reviews_engineer ON engineer_reviews(engineer_id);

-- 物料主数据（026）
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL DEFAULT 'com',
    material_code TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    name TEXT NOT NULL,
    name_en TEXT,
    spec TEXT,
    brand TEXT,
    compatible_equipment TEXT,
    supplier TEXT,
    production_code TEXT,
    unit TEXT DEFAULT 'pcs',
    reference_cost REAL DEFAULT 0,
    reference_price REAL DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND typeof(reserved_quantity) = 'integer'),
    safety_stock INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(market, material_code)
);
CREATE INDEX IF NOT EXISTS idx_materials_market ON materials(market);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);

-- 物料库存手动调整记录（026）
CREATE TABLE IF NOT EXISTS material_inventory_adjustments (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    delta INTEGER NOT NULL,
    before_quantity INTEGER NOT NULL,
    after_quantity INTEGER NOT NULL,
    reason TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (material_id) REFERENCES materials(id)
);
CREATE INDEX IF NOT EXISTS idx_material_adjustments_material ON material_inventory_adjustments(material_id);
CREATE INDEX IF NOT EXISTS idx_material_adjustments_created_at ON material_inventory_adjustments(created_at);

-- 内部员工账号与工单领料流程（038）
CREATE TABLE IF NOT EXISTS admin_staff_accounts (
    id TEXT PRIMARY KEY,
    normalized_login TEXT NOT NULL UNIQUE,
    normalized_phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'operations', 'warehouse', 'procurement')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    display_name TEXT NOT NULL,
    market_scope TEXT NOT NULL DEFAULT 'all' CHECK (market_scope IN ('all', 'com', 'cn')),
    must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_staff_active_role ON admin_staff_accounts(is_active, role);
CREATE INDEX IF NOT EXISTS idx_admin_staff_market ON admin_staff_accounts(market_scope, is_active);

CREATE TABLE IF NOT EXISTS material_requisitions (
    id TEXT PRIMARY KEY,
    requisition_no TEXT NOT NULL UNIQUE,
    market TEXT NOT NULL DEFAULT 'com',
    work_order_id TEXT NOT NULL,
    requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('engineer', 'admin')),
    requested_by_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'processing', 'partially_fulfilled', 'ready', 'issued', 'received', 'closed', 'rejected', 'cancelled')),
    urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'critical')),
    required_date TEXT,
    purpose TEXT,
    submitted_at TEXT,
    approved_by TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    assigned_warehouse_staff_id TEXT,
    assigned_procurement_staff_id TEXT,
    issued_at TEXT,
    received_at TEXT,
    closed_at TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_market_status ON material_requisitions(market, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_work_order ON material_requisitions(work_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_requester ON material_requisitions(requested_by_type, requested_by_id, created_at DESC);

CREATE TABLE IF NOT EXISTS material_requisition_items (
    id TEXT PRIMARY KEY,
    requisition_id TEXT NOT NULL,
    material_id TEXT,
    material_code TEXT,
    name TEXT NOT NULL,
    name_en TEXT,
    spec TEXT,
    brand TEXT,
    unit TEXT NOT NULL DEFAULT 'pcs',
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0 AND typeof(requested_quantity) = 'integer'),
    stock_allocated_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_allocated_quantity >= 0 AND typeof(stock_allocated_quantity) = 'integer'),
    procurement_ordered_quantity INTEGER NOT NULL DEFAULT 0 CHECK (procurement_ordered_quantity >= 0 AND typeof(procurement_ordered_quantity) = 'integer'),
    procurement_received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (procurement_received_quantity >= 0 AND typeof(procurement_received_quantity) = 'integer'),
    issued_quantity INTEGER NOT NULL DEFAULT 0 CHECK (issued_quantity >= 0 AND typeof(issued_quantity) = 'integer'),
    stock_issued_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_issued_quantity >= 0 AND typeof(stock_issued_quantity) = 'integer'),
    returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND typeof(returned_quantity) = 'integer'),
    engineer_received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (engineer_received_quantity >= 0 AND typeof(engineer_received_quantity) = 'integer'),
    fulfillment_source TEXT NOT NULL DEFAULT 'unassigned' CHECK (fulfillment_source IN ('unassigned', 'stock', 'procurement', 'mixed')),
    expected_arrival TEXT,
    supplier_reference TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'stock_allocated', 'purchasing', 'partially_ready', 'ready', 'issued', 'received', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
);
CREATE INDEX IF NOT EXISTS idx_material_requisition_items_requisition ON material_requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_material_requisition_items_material ON material_requisition_items(material_id);
CREATE INDEX IF NOT EXISTS idx_material_requisition_items_status ON material_requisition_items(status);

CREATE TABLE IF NOT EXISTS material_requisition_operations (
    operation_key TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    requisition_id TEXT NOT NULL,
    item_id TEXT,
    request_fingerprint TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id),
    FOREIGN KEY (item_id) REFERENCES material_requisition_items(id)
);
CREATE INDEX IF NOT EXISTS idx_material_requisition_operations_target
  ON material_requisition_operations(requisition_id, item_id, action);

-- 工单物料引用（027）
CREATE TABLE IF NOT EXISTS work_order_material_items (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    material_id TEXT,
    purpose TEXT NOT NULL DEFAULT 'quote',
    material_code TEXT,
    name TEXT NOT NULL,
    name_en TEXT,
    spec TEXT,
    brand TEXT,
    unit TEXT DEFAULT 'pcs',
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    line_total REAL DEFAULT 0,
    note TEXT,
    status TEXT DEFAULT 'active',
    created_by_type TEXT,
    created_by_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (material_id) REFERENCES materials(id)
);
CREATE INDEX IF NOT EXISTS idx_work_order_material_items_wo ON work_order_material_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_material_items_material ON work_order_material_items(material_id);
CREATE INDEX IF NOT EXISTS idx_work_order_material_items_purpose ON work_order_material_items(work_order_id, purpose);
CREATE INDEX IF NOT EXISTS idx_work_order_material_items_status ON work_order_material_items(status);

-- 工程师新增物料申请（028）
CREATE TABLE IF NOT EXISTS material_requests (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL DEFAULT 'com',
    status TEXT NOT NULL DEFAULT 'submitted',
    work_order_id TEXT,
    requested_by_type TEXT NOT NULL,
    requested_by_id TEXT NOT NULL,
    suggested_name TEXT NOT NULL,
    suggested_name_en TEXT,
    category TEXT DEFAULT 'other',
    spec TEXT,
    brand TEXT,
    compatible_equipment TEXT,
    supplier_suggestion TEXT,
    expected_quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'pcs',
    usage_note TEXT,
    urgency TEXT DEFAULT 'normal',
    attachment_urls TEXT DEFAULT '[]',
    linked_material_id TEXT,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (linked_material_id) REFERENCES materials(id)
);
CREATE INDEX IF NOT EXISTS idx_material_requests_market ON material_requests(market);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_requests_work_order ON material_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_requester ON material_requests(requested_by_type, requested_by_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_created_at ON material_requests(created_at);

-- 增购与改造需求记录（029）
CREATE TABLE IF NOT EXISTS upsell_requests (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL DEFAULT 'com',
  source_type TEXT NOT NULL DEFAULT 'engineer_workspace',
  work_order_id TEXT,
  customer_id TEXT,
  engineer_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other_retrofit',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  site_context TEXT,
  expected_timeline TEXT DEFAULT 'unclear',
  budget_signal TEXT DEFAULT 'unknown',
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending_assignment',
  assigned_sales_owner TEXT,
  admin_note TEXT,
  quote_status TEXT DEFAULT 'not_started',
  deal_result TEXT DEFAULT 'undecided',
  handover_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_market ON upsell_requests(market);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_status ON upsell_requests(status);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_category ON upsell_requests(category);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_engineer ON upsell_requests(engineer_id);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_work_order ON upsell_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_upsell_requests_created_at ON upsell_requests(created_at);

-- 商机线索表（021）
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'chat',              -- chat / landing / referral
    interest TEXT,                            -- 感兴趣的产品/需求
    message TEXT,                             -- 客户描述
    conversation_id TEXT,                     -- 关联对话 ID（如有）
    status TEXT DEFAULT 'new',                -- new / contacted / converted / lost
    source_type TEXT,                         -- 023: Service OS AI 来源
    risk_level TEXT,                          -- 023: low / medium / high / critical
    ai_summary TEXT,
    recommended_next_step TEXT,
    assignment_status TEXT DEFAULT 'unassigned',
    customer_id TEXT,
    device_id TEXT,
    work_order_id TEXT,
    region TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_source_type ON leads(source_type);
CREATE INDEX IF NOT EXISTS idx_leads_assignment_status ON leads(assignment_status);

-- AI 演进基础表（024）
CREATE TABLE IF NOT EXISTS ai_interactions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    user_id TEXT,
    user_type TEXT,
    market TEXT NOT NULL,
    locale TEXT NOT NULL,
    intent TEXT,
    message TEXT NOT NULL,
    response TEXT,
    model TEXT,
    prompt_version TEXT,
    knowledge_version TEXT,
    response_time_ms INTEGER,
    created_work_order INTEGER DEFAULT 0,
    created_lead INTEGER DEFAULT 0,
    user_feedback TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_feedback_items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    interaction_id TEXT,
    conversation_id TEXT,
    work_order_id TEXT,
    title TEXT NOT NULL,
    original_message TEXT,
    ai_response TEXT,
    human_correction TEXT,
    recommended_action TEXT,
    owner_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL,
    locale TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    applicable_equipment TEXT,
    applicable_brand TEXT,
    applicable_model TEXT,
    risk_level TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_eval_cases (
    id TEXT PRIMARY KEY,
    market TEXT NOT NULL,
    locale TEXT NOT NULL,
    category TEXT NOT NULL,
    user_message TEXT NOT NULL,
    expected_behavior TEXT NOT NULL,
    must_include TEXT,
    must_not_include TEXT,
    should_create_work_order INTEGER DEFAULT 0,
    risk_level TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_eval_runs (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    prompt_version TEXT,
    knowledge_version TEXT,
    total_cases INTEGER NOT NULL,
    passed_cases INTEGER NOT NULL,
    failed_cases INTEGER NOT NULL,
    pass_rate REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_tool_traces (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    work_order_id TEXT,
    user_id TEXT,
    user_type TEXT,
    tool_name TEXT NOT NULL,
    tool_input TEXT,
    tool_output TEXT,
    allowed INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_conversation
  ON ai_interactions(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_market_intent
  ON ai_interactions(market, intent, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_status
  ON ai_feedback_items(status, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_lookup
  ON knowledge_articles(market, locale, category, status);
CREATE INDEX IF NOT EXISTS idx_ai_eval_cases_active
  ON ai_eval_cases(status, market, locale, category);
CREATE INDEX IF NOT EXISTS idx_ai_tool_traces_context
  ON ai_tool_traces(conversation_id, tool_name, created_at);

-- 工程师申请（025）
CREATE TABLE IF NOT EXISTS engineer_applications (
    id TEXT PRIMARY KEY,
    market TEXT DEFAULT 'com',
    status TEXT DEFAULT 'submitted',
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    whatsapp TEXT,
    country TEXT,
    province TEXT,
    city TEXT,
    base_region TEXT,
    service_regions TEXT DEFAULT '[]',
    years_experience TEXT,
    equipment_types TEXT DEFAULT '[]',
    brand_experience TEXT DEFAULT '[]',
    skill_tags TEXT DEFAULT '[]',
    languages TEXT DEFAULT '[]',
    can_travel INTEGER DEFAULT 0,
    can_weekend INTEGER DEFAULT 0,
    can_night INTEGER DEFAULT 0,
    has_tools INTEGER DEFAULT 0,
    experience_summary TEXT,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    converted_user_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_status ON engineer_applications(status);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_market ON engineer_applications(market);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_created_at ON engineer_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_engineer_applications_converted_user ON engineer_applications(converted_user_id);

CREATE TABLE IF NOT EXISTS funnel_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'com',
  anonymous_id TEXT,
  session_id TEXT,
  user_type TEXT,
  user_id TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  page_path TEXT,
  referrer TEXT,
  properties_json TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_event_created
  ON funnel_events(event_name, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_session_created
  ON funnel_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_campaign_created
  ON funnel_events(source, medium, campaign, created_at);

-- 跨角色登录身份与工程师账号激活（037）
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

-- 工程师本人维护的排单日历（025）
CREATE TABLE IF NOT EXISTS engineer_calendar_events (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    market TEXT DEFAULT 'com',
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    work_order_id TEXT,
    region TEXT,
    city TEXT,
    confirmation_status TEXT DEFAULT 'confirmed',
    engineer_response TEXT,
    visibility TEXT DEFAULT 'admin_team',
    notes TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id)
);
CREATE INDEX IF NOT EXISTS idx_engineer_calendar_engineer ON engineer_calendar_events(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_calendar_range ON engineer_calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_engineer_calendar_type ON engineer_calendar_events(event_type);

-- 审计日志（023）
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_type, actor_id);

-- 回填已执行的迁移版本（011）
INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('000_initial',                      '初始建表'),
    ('001_add_engineer_fields',          'V2 合伙人字段'),
    ('001a_add_user_no',                 '老库 user_no / salt 回填'),
    ('002_pricing_and_new_tables',       '核价 + 钱包/保证金/晋升/违约/提现表'),
    ('003_add_onesignal',                '工程师端 OneSignal 推送'),
    ('004_add_device_fields',            'devices 表补 name/status/photo_url/notes'),
    ('005_add_company_and_auth',         'customers/engineers 公司信息 + auth_status'),
    ('006_create_notifications',         '通知表'),
    ('007_create_engineer_reviews',      '工程师对客户的评价表'),
    ('008_sync_missing_tables',          '回补漂移表（work_order_pricing 等）'),
    ('009_add_customer_onesignal',       '客户端 OneSignal 推送'),
    ('010_add_conversation_owner',       'conversations 加 customer_id（IDOR 修复）'),
    ('011_create_migrations_tracking',   'migrations 跟踪表'),
    ('012_create_ai_trace_logs',         'AI 工具调用 trace 日志表'),
    ('012_add_payments',                 '工单支付记录表'),
    ('014_conversation_summaries',       '对话摘要表'),
    ('015_add_conversation_engineer_owner', 'conversations 加 engineer_id'),
    ('016_add_repair_records',           '维修记录结构化表'),
    ('017_add_sla_fields',               'SLA 时效管理：sla_deadline / sla_breached_at'),
    ('018_add_work_order_categories',    '工单分类细化：category_l1 / category_l2'),
    ('019_add_work_order_attachments',   '工单附件表：图片/视频上传至 R2'),
    ('020_add_message_images',           '消息表新增 image_urls 列'),
    ('021_create_leads',                 '商机线索表'),
    ('023_service_os_dispatch_and_audit', 'Service OS 派工、工单会话和审计字段'),
    ('024_ai_evolution_foundation',      'AI evolution foundation: interactions, feedback, knowledge, evals, tool traces'),
    ('025_engineer_applications_and_calendar', '工程师申请与工程师本人维护的排单日历'),
    ('026_material_master_data',        'Admin 物料主数据与库存手动调整记录'),
    ('027_work_order_material_items',   '工单物料引用：报价、备件准备和服务报告'),
    ('028_material_requests',           '工程师新增物料申请与 Admin 审核入库'),
    ('029_upsell_requests',             '工程师增购与改造需求记录'),
    ('030_add_customer_email',          'Add customer email login field'),
    ('031_engineer_payouts',            'Add engineer payout settings and work-order payouts'),
    ('032_invoice_requests',            'Add China invoice request workflow'),
    ('032_payment_stages',              'Add advance and balance payment stages'),
    ('033_work_order_location_verification', 'Add service location and engineer arrival verification'),
    ('034_add_service_mode',            'Add remote, onsite, and hybrid service modes'),
    ('035_onsite_conversion_workflow',  'Add audited remote-to-onsite conversion and arrival override workflow'),
    ('036_create_funnel_events',         'Controlled beta funnel event tracking'),
    ('037_engineer_account_activation', 'Engineer email activation and cross-role identity registry'),
    ('038_material_requisitions_and_staff', 'Internal staff accounts and material requisition operations'),
    ('039_field_workdays',              'Photo-first multi-day onsite work records and protected evidence'),
    ('040_field_evidence_cleanup_queue', 'Retry private field evidence cleanup after failed rollback'),
    ('041_quote_execution_baseline',    'Immutable quote schedules, installments, and private receipt evidence metadata');
