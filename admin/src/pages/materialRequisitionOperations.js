const LABELS = {
  en: {
    status: {
      draft: 'Draft', submitted: 'Submitted', approved: 'Approved', processing: 'Processing',
      partially_fulfilled: 'Partially fulfilled', pending: 'Pending', stock_allocated: 'Stock allocated',
      purchasing: 'Purchasing', partially_ready: 'Partially ready', ready: 'Ready', issued: 'Issued',
      received: 'Received', closed: 'Closed', rejected: 'Rejected', cancelled: 'Cancelled',
    },
    urgency: { normal: 'Normal', urgent: 'Urgent', critical: 'Critical' },
    action: {
      material_requisition_created: 'Created', material_requisition_submitted: 'Submitted',
      material_requisition_approved: 'Approved', material_requisition_rejected: 'Rejected',
      material_requisition_cancelled: 'Cancelled', material_requisition_allocate_stock: 'Allocated stock',
      material_requisition_record_purchase: 'Recorded purchase', material_requisition_procurement_updated: 'Updated purchase information',
      material_requisition_receive_purchase: 'Received purchase', material_requisition_issue: 'Issued material',
      material_requisition_return: 'Returned material', material_requisition_engineer_receipt: 'Engineer confirmed receipt',
      material_requisition_item_cancelled: 'Cancelled line', material_requisition_closed: 'Closed',
    },
    actor: {
      admin: 'Administrator', operations: 'Operations', warehouse: 'Warehouse', procurement: 'Procurement',
      engineer: 'Engineer', warehouse_staff: 'Warehouse staff', system: 'System',
    },
  },
  'zh-CN': {
    status: {
      draft: '草稿', submitted: '待审批', approved: '已批准', processing: '处理中',
      partially_fulfilled: '部分履约', pending: '待处理', stock_allocated: '已分配库存',
      purchasing: '采购中', partially_ready: '部分备齐', ready: '已备齐', issued: '已发料',
      received: '已签收', closed: '已关闭', rejected: '已驳回', cancelled: '已取消',
    },
    urgency: { normal: '普通', urgent: '紧急', critical: '非常紧急' },
    action: {
      material_requisition_created: '创建申请', material_requisition_submitted: '提交审批',
      material_requisition_approved: '批准申请', material_requisition_rejected: '驳回申请',
      material_requisition_cancelled: '取消申请', material_requisition_allocate_stock: '分配库存',
      material_requisition_record_purchase: '记录采购', material_requisition_procurement_updated: '更新采购信息',
      material_requisition_receive_purchase: '采购入库', material_requisition_issue: '发料',
      material_requisition_return: '退库', material_requisition_engineer_receipt: '工程师确认签收',
      material_requisition_item_cancelled: '取消物料明细', material_requisition_closed: '关闭申请',
    },
    actor: {
      admin: '管理员', operations: '运营人员', warehouse: '仓库人员', procurement: '采购人员',
      engineer: '工程师', warehouse_staff: '仓库人员', system: '系统',
    },
  },
};

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalPayload(payload) {
  return JSON.stringify(canonicalize(payload));
}

export function getRetryOperation(current, action, payload, createKey = () => crypto.randomUUID()) {
  const payloadKey = canonicalPayload(payload);
  if (current?.action === action && current?.payloadKey === payloadKey) return current;
  return { action, payloadKey, idempotencyKey: createKey() };
}

export function retryOperationMatches(operation, action, payload) {
  return operation?.action === action && operation?.payloadKey === canonicalPayload(payload);
}

export function isRetryableActionError(error) {
  return error?.status == null || error.status === 429 || error.status >= 500;
}

export function requisitionLabel(locale, kind, value) {
  const normalizedLocale = locale === 'zh-CN' ? 'zh-CN' : 'en';
  const key = String(value || '');
  const mapped = LABELS[normalizedLocale]?.[kind]?.[key];
  if (mapped) return mapped;
  if (normalizedLocale === 'zh-CN') {
    return { status: '未知状态', urgency: '未知紧急程度', action: '其他操作', actor: '其他人员' }[kind] || '未知';
  }
  return key ? key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '-';
}
