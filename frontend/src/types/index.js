// 工程师等级
export const PartnerLevel = {
  JUNIOR: 'junior',       // 初级：提成80%
  SENIOR: 'senior',       // 中级：提成85%
  EXPERT: 'expert',       // 核心专家：提成88%
};

// 工程师等级对应的提成比例
export const CommissionRates = {
  [PartnerLevel.JUNIOR]: 0.80,  // 工程师拿80%，平台收20%
  [PartnerLevel.SENIOR]: 0.85,  // 工程师拿85%，平台收15%
  [PartnerLevel.EXPERT]: 0.88,  // 工程师拿88%，平台收12%
};

// 工程师等级标签
export const PartnerLevelLabels = {
  [PartnerLevel.JUNIOR]: { label: '初级', color: 'bg-blue-500', textColor: 'text-white' },
  [PartnerLevel.SENIOR]: { label: '中级', color: 'bg-amber-500', textColor: 'text-white' },
  [PartnerLevel.EXPERT]: { label: '核心专家', color: 'bg-red-500', textColor: 'text-white' },
};

// 工单状态
export const WorkOrderStatus = {
  PENDING: 'pending',       // 待处理
  ASSIGNED: 'assigned',     // 已分配
  IN_PROGRESS: 'in_progress', // 处理中
  PRICING: 'pricing',      // 等待报价确认
  IN_SERVICE: 'in_service', // 服务中
  RESOLVED: 'resolved',    // 已解决
  PENDING_REVIEW: 'pending_review', // 待评价
  COMPLETED: 'completed',  // 已完成
  REJECTED: 'rejected',   // 已拒绝
  CANCELLED: 'cancelled', // 已取消
};

// 核价状态
export const PricingStatus = {
  DRAFT: 'draft',       // 草稿/议价中
  SUBMITTED: 'submitted', // 已提交等待确认
  CONFIRMED: 'confirmed', // 已确认
};

// 工单类型
export const WorkOrderType = {
  FAULT: 'fault',             // 设备故障
  MAINTENANCE: 'maintenance', // 维护保养
  PARAMETER: 'parameter',     // 参数调试
  CONSULT: 'consult',         // 技术咨询
  PARTS: 'parts',            // 配件采购
  AFTERSALES: 'aftersales', // 售后服务
  OTHER: 'other'             // 其他
};

// 紧急程度
export const UrgencyLevel = {
  NORMAL: 'normal',       // 普通
  URGENT: 'urgent',       // 紧急
  CRITICAL: 'critical'   // 非常紧急
};

// 评价维度
export const EvaluationDimension = {
  TIMELINESS: 'timeliness',           // 时效性
  TECHNICAL: 'technical',             // 技术熟练程度
  COMMUNICATION: 'communication',     // 沟通流畅度
  PROFESSIONALISM: 'professionalism'  // 专业性
};
