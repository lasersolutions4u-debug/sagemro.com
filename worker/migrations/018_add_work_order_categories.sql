-- 018_add_work_order_categories: 工单分类细化 — 二级分类体系
ALTER TABLE work_orders ADD COLUMN category_l1 TEXT DEFAULT 'other';
ALTER TABLE work_orders ADD COLUMN category_l2 TEXT DEFAULT 'other';

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('018_add_work_order_categories', '工单分类细化：category_l1（设备大类）/ category_l2（问题类型）');
