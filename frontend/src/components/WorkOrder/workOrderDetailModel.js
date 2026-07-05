export function parseAiSummary(aiSummary) {
  if (!aiSummary) return null;
  if (typeof aiSummary === 'object') return aiSummary;
  try {
    const parsed = JSON.parse(aiSummary);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function deriveSafetyStage(workOrder = {}, aiSummary = null) {
  if (workOrder.urgency === 'critical') {
    return {
      label: '高风险',
      tone: 'red',
      description: '到场前确认断电、激光、电气和现场防护条件。',
    };
  }
  if (workOrder.urgency === 'urgent') {
    return {
      label: '需优先处理',
      tone: 'amber',
      description: '建议提前确认现场联系人、停机窗口和必要备件。',
    };
  }
  if (aiSummary?.safety_risks?.length) {
    return {
      label: '需现场复核',
      tone: 'amber',
      description: 'AI 摘要包含安全风险提示，请到场前复核。',
    };
  }
  return {
    label: '常规',
    tone: 'green',
    description: '按常规现场服务流程确认环境、设备状态和防护要求。',
  };
}

function quoteStatus(workOrder = {}) {
  if (workOrder.quote_review_status === 'approved') return '已通过运营复核';
  if (workOrder.quote_review_status === 'pending_review') return '待运营复核';
  if (workOrder.status === 'pricing') return '待报价';
  return '未报价';
}

function customerStatus(workOrder = {}) {
  if (['in_service', 'resolved', 'pending_review', 'completed'].includes(workOrder.status)) return '已确认';
  return '待客户确认';
}

function paymentStatus(workOrder = {}, payment = null) {
  const status = payment?.payment?.status || payment?.status;
  if (status === 'paid' || workOrder.status === 'completed') return '已回款';
  if (workOrder.status === 'pending_payment' || status === 'pending') return '待回款';
  return '暂无付款记录';
}

function serviceStatus(workOrder = {}) {
  if (workOrder.status === 'completed') return '已完成';
  if (workOrder.status === 'resolved' || workOrder.status === 'pending_review') return '待客户确认';
  return '服务处理中';
}

export function derivePaymentSummary(workOrder = {}, payment = null) {
  return [
    { label: '报价状态', value: quoteStatus(workOrder), tone: 'blue' },
    { label: '客户确认', value: customerStatus(workOrder), tone: 'teal' },
    { label: '付款状态', value: paymentStatus(workOrder, payment), tone: workOrder.status === 'pending_payment' ? 'amber' : 'slate' },
    { label: '服务完成', value: serviceStatus(workOrder), tone: 'green' },
    { label: '运营结算', value: workOrder.status === 'completed' ? '已记录' : '运营确认中', tone: 'slate' },
  ];
}
