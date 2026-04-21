// 工单详情相关的静态配置

export const statusConfig = {
  pending: { text: '待处理', color: 'bg-blue-500' },
  assigned: { text: '已分配', color: 'bg-yellow-500' },
  in_progress: { text: '处理中', color: 'bg-orange-500' },
  pricing: { text: '等待报价确认', color: 'bg-purple-500' },
  in_service: { text: '服务中', color: 'bg-cyan-500' },
  resolved: { text: '已解决', color: 'bg-green-500' },
  pending_review: { text: '待评价', color: 'bg-teal-500' },
  completed: { text: '已完成', color: 'bg-gray-500' },
  rejected: { text: '已拒绝', color: 'bg-red-500' },
  cancelled: { text: '已取消', color: 'bg-gray-400' },
};

export const urgencyConfig = {
  normal: { text: '普通', color: 'text-gray-500' },
  urgent: { text: '紧急', color: 'text-orange-500' },
  critical: { text: '非常紧急', color: 'text-red-500' },
};

export const typeLabels = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '配件采购',
  aftersales: '售后服务',
  other: '其他',
};
