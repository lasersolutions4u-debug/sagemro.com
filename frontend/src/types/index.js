// 工单状态
export const WorkOrderStatus = {
  PENDING: 'pending',       // 待处理
  PROCESSING: 'processing', // 处理中
  RESOLVED: 'resolved',    // 已解决
  CLOSED: 'closed'         // 已关闭
};

// 工单类型
export const WorkOrderType = {
  MALFUNCTION: 'malfunction',   // 设备故障
  CONSULT: 'consult',         // 技术咨询
  PARTS: 'parts',             // 配件采购
  AFTERSALES: 'aftersales',   // 售后服务
  OTHER: 'other'              // 其他
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
