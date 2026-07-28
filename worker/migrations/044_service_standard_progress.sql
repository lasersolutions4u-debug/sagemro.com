CREATE TABLE IF NOT EXISTS work_order_service_standard_progress (
  work_order_id TEXT NOT NULL,
  standard_version INTEGER NOT NULL DEFAULT 1,
  step_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'confirmed', 'not_applicable', 'legacy_not_recorded')),
  is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('engineer', 'admin', 'customer', 'system')),
  confirmed_by_type TEXT,
  confirmed_by_id TEXT,
  confirmed_at TEXT,
  evidence_type TEXT,
  evidence_id TEXT,
  not_applicable_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (work_order_id, standard_version, item_key),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_standard_work_order_step
  ON work_order_service_standard_progress(work_order_id, standard_version, step_key);

CREATE TABLE IF NOT EXISTS work_order_service_gate_overrides (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  gate_key TEXT NOT NULL CHECK (gate_key IN ('start', 'resolve', 'handover')),
  reason TEXT NOT NULL,
  overridden_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_gate_active_override
  ON work_order_service_gate_overrides(work_order_id, gate_key)
  WHERE revoked_at IS NULL;

WITH standard_items(step_key, step_index, item_key, is_required, owner_type) AS (VALUES
  ('task_alignment', 0, 'task.device_identity', 1, 'engineer'),
  ('task_alignment', 0, 'task.problem_and_goal', 1, 'engineer'),
  ('task_alignment', 0, 'task.contact_and_window', 1, 'engineer'),
  ('risk_control', 1, 'risk.hazards_reviewed', 1, 'engineer'),
  ('risk_control', 1, 'risk.isolation_permission', 1, 'engineer'),
  ('risk_control', 1, 'risk.ppe_and_access', 1, 'engineer'),
  ('one_visit_readiness', 2, 'ready.tools_and_documents', 1, 'engineer'),
  ('one_visit_readiness', 2, 'ready.parts_and_consumables', 0, 'engineer'),
  ('one_visit_readiness', 2, 'ready.start_conditions', 1, 'admin'),
  ('evidence_execution', 3, 'execute.baseline_evidence', 1, 'engineer'),
  ('evidence_execution', 3, 'execute.actions_recorded', 1, 'engineer'),
  ('evidence_execution', 3, 'execute.scope_authorized', 1, 'engineer'),
  ('recovery_verification', 4, 'verify.functional_test', 1, 'engineer'),
  ('recovery_verification', 4, 'verify.safety_restored', 1, 'engineer'),
  ('recovery_verification', 4, 'verify.residual_risk', 1, 'engineer'),
  ('transparent_handover', 5, 'handover.service_report', 1, 'system'),
  ('transparent_handover', 5, 'handover.customer_confirmation', 1, 'customer'),
  ('transparent_handover', 5, 'handover.follow_up', 0, 'engineer')
), existing AS (
  SELECT id, CASE
    WHEN status IN ('completed') THEN 6
    WHEN status IN ('resolved', 'pending_review') THEN 5
    WHEN status = 'in_service' THEN 4
    WHEN status IN ('pricing', 'pending_payment', 'payment_review') THEN 3
    WHEN status IN ('assigned', 'in_progress') THEN 1
    ELSE 0
  END AS current_step
  FROM work_orders
)
INSERT INTO work_order_service_standard_progress (
  work_order_id, standard_version, step_key, item_key, state, is_required, owner_type
)
SELECT
  existing.id, 1, item.step_key, item.item_key,
  CASE WHEN item.step_index < existing.current_step
    THEN 'legacy_not_recorded'
    ELSE 'pending'
  END,
  item.is_required, item.owner_type
FROM existing
CROSS JOIN standard_items AS item;

INSERT OR IGNORE INTO _migrations (version, note) VALUES
  ('044_service_standard_progress', 'Persisted SAGEMRO six-step service standard progress and audited gate overrides');
