-- 016_add_repair_records: 维修记录结构化 — 故障现象 / 诊断 / 方案 / 配件清单
-- 用于 RAG 数据质量提升，替换纯自由文本工单描述为结构化字段。

CREATE TABLE IF NOT EXISTS work_order_repair_records (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    symptom TEXT,              -- 故障现象
    diagnosis TEXT,            -- 诊断结果
    solution TEXT,             -- 维修方案
    parts_used TEXT DEFAULT '[]',  -- 更换配件清单 JSON: [{"name":"","qty":1,"unit":"个","specs":""}]
    labor_hours REAL DEFAULT 0,    -- 工时（小时）
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_repair_records_wo ON work_order_repair_records(work_order_id);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('016_add_repair_records', '维修记录结构化表：symptom/diagnosis/solution/parts_used/labor_hours');
