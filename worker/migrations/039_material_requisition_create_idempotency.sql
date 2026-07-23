-- 039_material_requisition_create_idempotency.sql
-- Permit requisition-level idempotency operations that do not target a line item.

CREATE TABLE material_requisition_operations_new (
    operation_key TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    requisition_id TEXT NOT NULL,
    item_id TEXT,
    request_fingerprint TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id),
    FOREIGN KEY (item_id) REFERENCES material_requisition_items(id)
);

INSERT INTO material_requisition_operations_new (
    operation_key, action, requisition_id, item_id, request_fingerprint, completed_at
)
SELECT operation_key, action, requisition_id, item_id, request_fingerprint, completed_at
FROM material_requisition_operations;

DROP TABLE material_requisition_operations;
ALTER TABLE material_requisition_operations_new RENAME TO material_requisition_operations;

CREATE INDEX idx_material_requisition_operations_target
  ON material_requisition_operations(requisition_id, item_id, action);

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('039_material_requisition_create_idempotency', 'Allow idempotent material requisition draft creation');
