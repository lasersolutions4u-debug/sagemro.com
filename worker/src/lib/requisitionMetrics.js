export const REQUISITION_OPERATION_METRIC_QUERIES = Object.freeze({
  pendingApproval: `
    SELECT COUNT(*) AS count
    FROM material_requisitions
    WHERE status = 'submitted'
  `,
  shortages: `
    SELECT COUNT(*) AS count
    FROM material_requisition_items mri
    JOIN material_requisitions mr ON mr.id = mri.requisition_id
    WHERE mri.status != 'cancelled'
      AND mr.status NOT IN ('draft', 'rejected', 'cancelled', 'closed')
      AND stock_allocated_quantity + procurement_received_quantity < requested_quantity
  `,
  overdue: `
    SELECT COUNT(*) AS count
    FROM material_requisitions
    WHERE required_date IS NOT NULL
      AND required_date < date('now')
      AND status NOT IN ('rejected', 'cancelled', 'closed')
  `,
  medianApproval: `
    WITH durations AS (
      SELECT (julianday(approved_at) - julianday(created_at)) * 24.0 AS hours
      FROM material_requisitions
      WHERE approved_at IS NOT NULL
    ), ranked AS (
      SELECT hours,
             ROW_NUMBER() OVER (ORDER BY hours) AS row_number,
             COUNT(*) OVER () AS sample_count
      FROM durations
    )
    SELECT AVG(hours) AS value
    FROM ranked
    WHERE row_number IN ((sample_count + 1) / 2, (sample_count + 2) / 2)
  `,
  medianFulfillment: `
    WITH durations AS (
      SELECT (julianday(received_at) - julianday(approved_at)) * 24.0 AS hours
      FROM material_requisitions
      WHERE received_at IS NOT NULL AND approved_at IS NOT NULL
    ), ranked AS (
      SELECT hours,
             ROW_NUMBER() OVER (ORDER BY hours) AS row_number,
             COUNT(*) OVER () AS sample_count
      FROM durations
    )
    SELECT AVG(hours) AS value
    FROM ranked
    WHERE row_number IN ((sample_count + 1) / 2, (sample_count + 2) / 2)
  `,
  closureRate: `
    SELECT CASE
      WHEN COUNT(*) = 0 THEN NULL
      ELSE ROUND(100.0 * SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) / COUNT(*), 2)
    END AS closure_rate_percent
    FROM material_requisitions
    WHERE status != 'draft'
  `,
});

export async function getRequisitionOperationsMetrics(env) {
  const [pendingApproval, shortages, overdue, medianApproval, medianFulfillment, closureRate] = await Promise.all([
    env.DB.prepare(REQUISITION_OPERATION_METRIC_QUERIES.pendingApproval).first(),
    env.DB.prepare(REQUISITION_OPERATION_METRIC_QUERIES.shortages).first(),
    env.DB.prepare(REQUISITION_OPERATION_METRIC_QUERIES.overdue).first(),
    env.DB.prepare(REQUISITION_OPERATION_METRIC_QUERIES.medianApproval).first(),
    env.DB.prepare(REQUISITION_OPERATION_METRIC_QUERIES.medianFulfillment).first(),
    env.DB.prepare(REQUISITION_OPERATION_METRIC_QUERIES.closureRate).first(),
  ]);

  return {
    pendingApproval: pendingApproval?.count || 0,
    shortages: shortages?.count || 0,
    overdue: overdue?.count || 0,
    medianApprovalHours: medianApproval?.value == null ? null : Number(medianApproval.value),
    medianFulfillmentHours: medianFulfillment?.value == null ? null : Number(medianFulfillment.value),
    closureRatePercent: closureRate?.closure_rate_percent == null ? null : Number(closureRate.closure_rate_percent),
  };
}
