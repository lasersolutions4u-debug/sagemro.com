-- 019_add_work_order_attachments: 工单附件支持 — 图片/视频上传到 R2
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

INSERT OR IGNORE INTO _migrations (version, note) VALUES
    ('019_add_work_order_attachments', '工单附件表：图片/视频上传，存储于 Cloudflare R2');
