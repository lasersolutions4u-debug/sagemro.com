import { useState, useEffect } from 'react';
import {
  assignAdminWorkOrder,
  assignAdminWorkOrderRegionalLead,
  approveAdminWorkOrderPricing,
  approveAdminWorkOrderPaymentStart,
  archiveAdminWorkOrder,
  getAdminInvoiceRequest,
  getAdminWorkOrder,
  getAdminWorkOrderMessages,
  getAdminUsers,
  getAdminWorkOrders,
  postAdminWorkOrderMessage,
  processAdminInvoiceRequest,
  rejectAdminWorkOrderPricing,
  updateAdminWorkOrderPayout,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';
import {
  formatAiSummary,
  formatEngineerOption,
  formatListValue,
  formatQuoteNote,
  money,
  parseJsonValue,
} from './workOrderDisplay';

const STATUS_MAP = {
  pending: { color: 'var(--color-info)' },
  pending_dispatch: { color: 'var(--color-warning)' },
  assigned: { color: 'var(--color-warning)' },
  in_progress: { color: 'var(--color-warning)' },
  payment_review: { color: 'var(--color-warning)' },
  pending_payment: { color: 'var(--color-warning)' },
  pricing: { color: 'var(--color-primary)' },
  in_service: { color: 'var(--color-info)' },
  resolved: { color: 'var(--color-success)' },
  completed: { color: 'var(--color-success)' },
  rejected: { color: 'var(--color-error)' },
  cancelled: { color: 'var(--color-text-muted)' },
};

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : '-';
}

function averageScore(values) {
  const scores = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!scores.length) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function ScoreRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-[var(--color-primary)]">{formatScore(value)}</span>
    </div>
  );
}

function MoneyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-[var(--color-primary)]">{money(value)} {CURRENCY}</span>
    </div>
  );
}

function payoutLabel(status, t = TEXT.en) {
  const labels = t.payoutStatuses || {
    not_ready: 'Not ready',
    pending: 'Payout pending',
    processing: 'Processing',
    completed: 'Completed',
    exception: 'Exception',
  };
  return labels[status] || status || 'Not ready';
}

function isImageAttachment(attachment) {
  return attachment?.file_type?.startsWith('image/');
}

function describeEngineer(engineer) {
  if (!engineer) return '';
  return [
    formatListValue(engineer.service_region || engineer.responsible_region),
    engineer.team_name,
    formatListValue(engineer.specialties),
    engineer.rating_avg ? `rating ${formatScore(engineer.rating_avg)}` : '',
  ].filter(Boolean).join(' · ');
}

function quoteParts(detail) {
  const items = Array.isArray(detail?.pricing?.material_items)
    ? detail.pricing.material_items
    : Array.isArray(detail?.material_items)
      ? detail.material_items.filter((item) => item.purpose === 'quote')
      : [];
  return items;
}

function quoteAiCheck(pricing) {
  const parsed = parseJsonValue(pricing?.ai_price_check);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

const TEXT = {
  en: {
    statuses: {
      pending: 'Pending',
      pending_dispatch: 'Regional dispatch pending',
      assigned: 'Assigned',
      in_progress: 'In progress',
      pricing: 'Quote confirmation',
      pending_payment: 'Payment follow-up',
      payment_review: 'Payment review',
      in_service: 'In service',
      resolved: 'Resolved',
      completed: 'Completed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    },
    urgency: {
      normal: 'Normal',
      urgent: 'Urgent',
      critical: 'Critical',
    },
    types: {
      fault: 'Equipment fault',
      maintenance: 'Maintenance',
      parameter: 'Parameter tuning',
      other: 'Other',
    },
    pricing: {
      pending_review: 'Operations review pending',
      submitted: 'Sent to customer',
      confirmed: 'Customer confirmed',
      draft: 'Returned for revision',
    },
    tabs: {
      all: 'All',
      pending: 'Pending',
      pending_dispatch: 'Regional dispatch pending',
      in_progress: 'In progress',
      completed: 'Completed',
    },
    title: 'Service Orders',
    subtitle: 'The main flow is Admin to regional lead, then regional lead to engineer. Direct engineer dispatch remains as a compatibility operation and is restricted by conflict checks.',
    loading: 'Loading...',
    empty: 'No data',
    selectRegionalLead: 'Please select a regional lead first',
    assignedRegionalLead: (orderNo) => `Regional lead assigned: ${orderNo}`,
    assignRegionalLeadFailed: 'Failed to assign regional lead',
    selectEngineer: 'Please select an internal engineer first',
    assignedEngineer: (orderNo) => `Dispatched: ${orderNo}`,
    assignEngineerFailed: 'Dispatch failed',
    quoteSent: (orderNo) => `Reviewed quote sent to customer: ${orderNo}`,
    quoteReviewFailed: 'Quote review failed',
    rejectPrompt: 'Reason for return (optional, visible to engineer as an internal note):',
    quoteReturned: (orderNo) => `Quote returned for revision: ${orderNo}`,
    quoteReturnFailed: 'Failed to return quote',
    paymentStartApproved: (orderNo) => `Payment confirmed. Service can start: ${orderNo}`,
    paymentStartApproveFailed: 'Failed to approve service start',
    approvePaymentStart: 'Confirm payment & start',
    paymentReviewTitle: 'Payment confirmation required',
    paymentReviewHint: 'Engineer has followed up payment. Confirm receipt before allowing service execution.',
    archived: (orderNo) => `Archived: ${orderNo}`,
    archiveFailed: 'Archive failed',
    detailLoadFailed: 'Failed to load service order detail',
    noteSaveFailed: 'Failed to save internal note',
    headers: {
      orderNo: 'Service No.',
      customer: 'Customer',
      regionalLead: 'Regional lead',
      engineer: 'Internal engineer',
      type: 'Type',
      urgency: 'Urgency',
      status: 'Status',
      quoteArchive: 'Quote / archive',
      createdAt: 'Created',
      dispatch: 'Dispatch',
      detail: 'Detail',
    },
    conflictFallback: 'Conflict exists',
    noQuote: 'No quote',
    approve: 'Approve',
    approveFullOrder: 'Approve full order',
    return: 'Return',
    returnQuote: 'Return quote',
    viewQuoteDetail: 'Review full order',
    reviewQuoteFirst: 'Open the quote details before approving.',
    fullOrderReviewTitle: 'Full order review required',
    fullOrderReviewHint: 'Review the customer issue, AI summary, attachments, quote details, parts, quote subtotal price, and internal notes before approval.',
    archive: 'Archive',
    regionalLeadOption: 'Select regional lead',
    assigning: 'Assigning',
    assignRegion: 'Assign region',
    engineerOption: 'Select engineer',
    dispatching: 'Dispatching',
    directDispatch: 'Direct dispatch',
    searchEngineer: 'Search engineer by name, region, skill, or team',
    exportEngineers: 'Export engineer pool',
    view: 'View',
    previous: 'Previous',
    next: 'Next',
    drawerTitle: 'Service Control View',
    drawerSubtitle: 'Review customer communication, internal notes, AI summary, service report, and two-way reviews.',
    close: 'Close',
    customerLabel: 'Customer',
    engineerLabel: 'Engineer',
    quoteReviewLabel: 'Quote review',
    serviceRecordLabel: 'Service Record',
    quoteDetailTitle: 'Quote Details',
    quoteSubtotalPrice: 'Quote subtotal price',
    otherFeeNote: 'Other fee note',
    partsList: 'Parts list',
    aiPriceCheck: 'AI price check',
    noQuoteDetail: 'No quote detail',
    riskControlLabel: 'Risk control',
    clearRisk: 'clear',
    engineerPayoutTitle: 'Engineer service payment',
    engineerPayoutHint: "Internal closure is not complete until this work order's engineer payout is completed.",
    payoutFields: {
      status: 'Status',
      method: 'Method',
      amount: 'Amount',
      reference: 'Reference',
      paidAt: 'Paid at',
      note: 'Note',
    },
    payoutMethods: {
      bank_swift: 'Bank transfer / SWIFT',
      paypal: 'PayPal account',
    },
    payoutActions: {
      processing: 'Mark payout processing',
      completed: 'Mark payout completed',
      exception: 'Mark payout exception',
    },
    paymentConfirmationNote: 'Payment confirmation note (optional):',
    payoutUpdated: (status) => `Engineer service payment updated: ${status}`,
    payoutUpdateFailed: 'Failed to update engineer service payment',
    payoutPrompts: {
      amount: 'Engineer service payment amount in USD (optional):',
      reference: 'Payment reference / transaction ID (optional):',
      note: 'Internal payout note (optional):',
    },
    payoutStatuses: {
      not_ready: 'Not ready',
      pending: 'Payout pending',
      processing: 'Processing',
      completed: 'Completed',
      exception: 'Exception',
    },
    quoteFeeLabels: {
      labor: 'Labor Fee',
      parts: 'Parts Fee',
      travel: 'Travel Fee',
      other: 'Other Fees',
    },
    aiSummaryTitle: 'AI Intake Summary',
    noAiSummary: 'No AI summary',
    attachmentsTitle: 'Diagnostic Images & Attachments',
    attachmentCount: (count) => `${count} item(s)`,
    openAttachment: 'Open attachment',
    noAttachments: 'No diagnostic images or attachments',
    reportTitle: 'Service Report',
    reportFields: {
      symptom: 'Symptom',
      diagnosis: 'Diagnosis',
      solution: 'Solution',
      laborHours: 'Labor hours',
    },
    noReport: 'No service report',
    customerReviewTitle: 'Customer Service Review',
    average: 'Average',
    scoreRows: {
      timeliness: 'Timeliness',
      technical: 'Technical ability',
      communication: 'Communication',
      professional: 'Professionalism',
      cooperation: 'Cooperation',
      payment: 'Payment cooperation',
      environment: 'Site conditions',
    },
    noCustomerReview: 'Customer has not reviewed this service',
    engineerReviewTitle: 'Engineer Internal Customer Review',
    internalRiskNote: 'Internal risk-control material only. It is used for dispatch decisions, service preparation, and quality review, and is not visible to customers.',
    noEngineerReview: 'Engineer has not submitted a customer cooperation review',
    messagesTitle: 'Service Conversation & Internal Notes',
    messageCount: (count) => `${count} message(s)`,
    noMessages: 'No messages',
    internalNote: 'Internal note',
    notePlaceholder: 'Add an internal note. Visible only to Admin / regional lead / engineer, not to the customer.',
    saveNote: 'Save internal note',
    noDetail: 'No service order detail loaded',
    invoiceTitle: 'Invoice Request',
    invoiceStatus: (status) => status === 'issued' ? 'Issued' : 'Pending',
    invoiceProcessBtn: 'Mark as Issued',
    invoiceNumber: 'Invoice No.',
    noInvoice: 'No invoice request',
    invoiceConfirmLabel: 'Invoice number (required):',
  },
  'zh-CN': {
    statuses: {
      pending: '待审核',
      pending_dispatch: '待区域派工',
      assigned: '已派工',
      in_progress: '处理中',
      pricing: '报价确认',
      pending_payment: '待付款跟进',
      payment_review: '付款审核',
      in_service: '服务中',
      resolved: '已解决',
      completed: '已完成',
      rejected: '已驳回',
      cancelled: '已取消',
    },
    urgency: {
      normal: '普通',
      urgent: '紧急',
      critical: '停机',
    },
    types: {
      fault: '设备故障',
      maintenance: '维护保养',
      parameter: '参数调试',
      other: '其他',
    },
    pricing: {
      pending_review: '待运营审核',
      submitted: '已发送给客户',
      confirmed: '客户已确认',
      draft: '已退回修改',
    },
    tabs: {
      all: '全部',
      pending: '待审核',
      pending_dispatch: '待区域派工',
      in_progress: '处理中',
      completed: '已完成',
    },
    title: '服务工单',
    subtitle: '常规流程：Admin → 区域负责人 → 工程师。直接派给工程师仅作为备用方式，受冲突检查限制。',
    loading: '加载中...',
    empty: '暂无数据',
    selectRegionalLead: '请先选择区域负责人',
    assignedRegionalLead: (orderNo) => `已分配区域负责人：${orderNo}`,
    assignRegionalLeadFailed: '区域负责人分配失败',
    selectEngineer: '请先选择内部工程师',
    assignedEngineer: (orderNo) => `已派工：${orderNo}`,
    assignEngineerFailed: '派工失败',
    quoteSent: (orderNo) => `审核后的报价已发送给客户：${orderNo}`,
    quoteReviewFailed: '报价审核失败',
    rejectPrompt: '退回原因（可选，将作为内部备注给工程师查看）：',
    quoteReturned: (orderNo) => `报价已退回修改：${orderNo}`,
    quoteReturnFailed: '报价退回失败',
    paymentStartApproved: (orderNo) => `付款已确认，可以开始服务：${orderNo}`,
    paymentStartApproveFailed: '服务开始确认失败',
    approvePaymentStart: '确认付款并开始',
    paymentReviewTitle: '需要确认付款',
    paymentReviewHint: '工程师已跟进付款。确认到账后再安排工程师现场服务。',
    archived: (orderNo) => `已归档：${orderNo}`,
    archiveFailed: '归档失败',
    detailLoadFailed: '工单详情加载失败',
    noteSaveFailed: '内部备注保存失败',
    headers: {
      orderNo: '服务单号',
      customer: '客户',
      regionalLead: '区域负责人',
      engineer: '内部工程师',
      type: '类型',
      urgency: '紧急程度',
      status: '状态',
      quoteArchive: '报价 / 归档',
      createdAt: '创建时间',
      dispatch: '派工',
      detail: '详情',
    },
    conflictFallback: '存在冲突',
    noQuote: '暂无报价',
    approve: '批准',
    approveFullOrder: '批准完整订单',
    return: '退回',
    returnQuote: '退回报价',
    viewQuoteDetail: '审核完整订单',
    reviewQuoteFirst: '请先打开报价详情完成审核。',
    fullOrderReviewTitle: '需要完整订单审核',
    fullOrderReviewHint: '批准前请核对客户问题、AI 摘要、附件、报价明细、配件、报价小计和内部备注。',
    archive: '归档',
    regionalLeadOption: '选择区域负责人',
    assigning: '分配中',
    assignRegion: '分配区域',
    engineerOption: '选择工程师',
    dispatching: '派工中',
    directDispatch: '直接派工',
    searchEngineer: '按姓名、地区、技能或团队搜索工程师',
    exportEngineers: '导出工程师池',
    view: '查看',
    previous: '上一页',
    next: '下一页',
    drawerTitle: '服务管控视图',
    drawerSubtitle: '审核客户沟通、内部备注、AI 摘要、服务报告和双向评价。',
    close: '关闭',
    customerLabel: '客户',
    engineerLabel: '工程师',
    quoteReviewLabel: '报价审核',
    serviceRecordLabel: '服务记录',
    quoteDetailTitle: '报价详情',
    quoteSubtotalPrice: '报价小计',
    otherFeeNote: '其他费用备注',
    partsList: '配件清单',
    aiPriceCheck: 'AI 价格检查',
    noQuoteDetail: '暂无报价详情',
    riskControlLabel: '风控状态',
    clearRisk: '正常',
    engineerPayoutTitle: '工程师服务费结算',
    engineerPayoutHint: '工程师服务费结算完成后，该工单才算正式完结。',
    payoutFields: {
      status: '状态',
      method: '方式',
      amount: '金额',
      reference: '流水号',
      paidAt: '付款时间',
      note: '备注',
    },
    payoutMethods: {
      bank_swift: '银行转账 / SWIFT',
      paypal: 'PayPal 账号',
    },
    payoutActions: {
      processing: '标记为结算中',
      completed: '标记为已结算',
      exception: '标记为结算异常',
    },
    paymentConfirmationNote: '付款确认备注（可选）：',
    payoutUpdated: (status) => `工程师服务费已更新：${status}`,
    payoutUpdateFailed: '工程师服务费更新失败',
    payoutPrompts: {
      amount: '工程师服务费金额（CNY，可选）：',
      reference: '付款流水号 / 交易编号（可选）：',
      note: '内部结算备注（可选）：',
    },
    payoutStatuses: {
      not_ready: '未就绪',
      pending: '待结算',
      processing: '结算中',
      completed: '已结算',
      exception: '异常',
    },
    quoteFeeLabels: {
      labor: '人工费',
      parts: '配件费',
      travel: '差旅费',
      other: '其他费用',
    },
    aiSummaryTitle: 'AI 需求摘要',
    noAiSummary: '暂无 AI 摘要',
    attachmentsTitle: '诊断图片与附件',
    attachmentCount: (count) => `${count} 个附件`,
    openAttachment: '打开附件',
    noAttachments: '暂无诊断图片或附件',
    reportTitle: '服务报告',
    reportFields: {
      symptom: '现象',
      diagnosis: '诊断',
      solution: '处理方案',
      laborHours: '工时',
    },
    noReport: '暂无服务报告',
    customerReviewTitle: '客户服务评价',
    average: '平均',
    scoreRows: {
      timeliness: '响应及时性',
      technical: '技术能力',
      communication: '沟通',
      professional: '专业度',
      cooperation: '配合度',
      payment: '付款配合',
      environment: '现场条件',
    },
    noCustomerReview: '客户尚未评价本次服务',
    engineerReviewTitle: '工程师内部客户评价',
    internalRiskNote: '仅作为内部风控资料，用于派工判断、服务准备和质量复盘，不向客户展示。',
    noEngineerReview: '工程师尚未提交客户配合评价',
    messagesTitle: '服务沟通与内部备注',
    messageCount: (count) => `${count} 条消息`,
    noMessages: '暂无消息',
    internalNote: '内部备注',
    notePlaceholder: '添加内部备注。仅 Admin / 区域负责人 / 工程师可见，客户不可见。',
    saveNote: '保存内部备注',
    noDetail: '尚未加载工单详情',
    invoiceTitle: '发票申请',
    invoiceStatus: (status) => status === 'issued' ? '已开票' : '待处理',
    invoiceProcessBtn: '标记为已开票',
    invoiceNumber: '发票号码',
    noInvoice: '暂无发票申请',
    invoiceConfirmLabel: '发票号码（必填）：',
  },
};

export function WorkOrdersPage() {
  const t = { ...TEXT.en, ...(TEXT[runtimeConfig.locale] || {}) };
  const CURRENCY = runtimeConfig.locale === 'zh-CN' ? 'CNY' : 'USD';
  const [status, setStatus] = useState('all');
  const [data, setData] = useState({ total: 0, list: [] });
  const [engineers, setEngineers] = useState([]);
  const [regionalLeads, setRegionalLeads] = useState([]);
  const [selectedEngineers, setSelectedEngineers] = useState({});
  const [selectedRegionalLeads, setSelectedRegionalLeads] = useState({});
  const [assigningId, setAssigningId] = useState('');
  const [message, setMessage] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailMessages, setDetailMessages] = useState([]);
  const [internalNote, setInternalNote] = useState('');
  const [reviewedQuoteIds, setReviewedQuoteIds] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [invoiceProcessing, setInvoiceProcessing] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    setLoading(true);
    getAdminWorkOrders(status, page, pageSize)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => {
    getAdminUsers('engineer', 1, 50, { status: 'available' })
      .then((res) => {
        const list = res.list || [];
        setEngineers(list.filter((engineer) => engineer.engineer_role !== 'regional_lead'));
        setRegionalLeads(list.filter((engineer) => engineer.engineer_role === 'regional_lead'));
      })
      .catch(() => {
        setEngineers([]);
        setRegionalLeads([]);
      });
  }, []);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const statusTabs = [
    { key: 'all', label: t.tabs.all },
    { key: 'pending', label: t.tabs.pending },
    { key: 'pending_dispatch', label: t.tabs.pending_dispatch },
    { key: 'in_progress', label: t.tabs.in_progress },
    { key: 'completed', label: t.tabs.completed },
  ];

  async function handleAssignRegionalLead(wo) {
    const regionalLeadId = selectedRegionalLeads[wo.id];
    if (!regionalLeadId) {
      setMessage(t.selectRegionalLead);
      return;
    }
    setAssigningId(`${wo.id}:lead`);
    setMessage('');
    try {
      const res = await assignAdminWorkOrderRegionalLead(wo.id, regionalLeadId);
      const assigned = res.work_order || {};
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? {
                ...item,
                status: assigned.status || 'pending_dispatch',
                assigned_regional_lead_id: assigned.assigned_regional_lead_id,
                regional_lead_name: assigned.regional_lead_name || item.regional_lead_name,
              }
            : item
        )),
      }));
      setMessage(t.assignedRegionalLead(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.assignRegionalLeadFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleAssign(wo) {
    const engineerId = selectedEngineers[wo.id];
    if (!engineerId) {
      setMessage(t.selectEngineer);
      return;
    }
    setAssigningId(`${wo.id}:engineer`);
    setMessage('');
    try {
      const res = await assignAdminWorkOrder(wo.id, engineerId);
      const assigned = res.work_order || {};
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? {
                ...item,
                status: assigned.status || 'assigned',
                engineer_id: assigned.engineer_id || item.engineer_id,
                engineer_name: assigned.engineer_name || item.engineer_name,
                conflict_status: 'clear',
                conflict_reason: '',
              }
            : item
        )),
      }));
      setMessage(t.assignedEngineer(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.assignEngineerFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleApprovePricing(wo) {
    if (!reviewedQuoteIds[wo.id]) {
      setMessage(t.reviewQuoteFirst || 'Open the quote details before approving.');
      await openDetail(wo);
      return;
    }
    setAssigningId(`${wo.id}:approve`);
    setMessage('');
    try {
      await approveAdminWorkOrderPricing(wo.id);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? { ...item, pricing_status: 'submitted', quote_review_status: 'approved', status: 'pricing' }
            : item
        )),
      }));
      setDetail((prev) => (
        prev?.id === wo.id
          ? {
              ...prev,
              status: 'pricing',
              quote_review_status: 'approved',
              pricing: prev.pricing ? { ...prev.pricing, status: 'submitted' } : prev.pricing,
            }
          : prev
      ));
      setMessage(t.quoteSent(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.quoteReviewFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleRejectPricing(wo) {
    const note = window.prompt(t.rejectPrompt) || '';
    setAssigningId(`${wo.id}:reject`);
    setMessage('');
    try {
      await rejectAdminWorkOrderPricing(wo.id, note);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? { ...item, pricing_status: 'draft', quote_review_status: 'rejected', status: 'in_progress' }
            : item
        )),
      }));
      setDetail((prev) => (
        prev?.id === wo.id
          ? {
              ...prev,
              status: 'in_progress',
              quote_review_status: 'rejected',
              pricing: prev.pricing ? { ...prev.pricing, status: 'draft' } : prev.pricing,
            }
          : prev
      ));
      setMessage(t.quoteReturned(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.quoteReturnFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleApprovePaymentStart(wo) {
    const note = window.prompt(t.paymentConfirmationNote) || '';
    setAssigningId(`${wo.id}:payment-start`);
    setMessage('');
    try {
      await approveAdminWorkOrderPaymentStart(wo.id, note);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id
            ? { ...item, status: 'in_service' }
            : item
        )),
      }));
      setDetail((prev) => (
        prev?.id === wo.id
          ? { ...prev, status: 'in_service' }
          : prev
      ));
      setMessage(t.paymentStartApproved(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.paymentStartApproveFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleArchive(wo) {
    setAssigningId(`${wo.id}:archive`);
    setMessage('');
    try {
      await archiveAdminWorkOrder(wo.id);
      setData((prev) => ({
        ...prev,
        list: prev.list.map((item) => (
          item.id === wo.id ? { ...item, status: 'completed' } : item
        )),
      }));
      setMessage(t.archived(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.archiveFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function handleUpdatePayout(wo, status) {
    const currentPayout = wo.payout || {};
    const amountInput = window.prompt(t.payoutPrompts.amount, currentPayout.amount || '');
    if (amountInput === null) return;
    const reference = window.prompt(t.payoutPrompts.reference, currentPayout.transaction_reference || '') || '';
    const note = window.prompt(t.payoutPrompts.note, currentPayout.internal_note || '') || '';
    setAssigningId(`${wo.id}:payout:${status}`);
    setMessage('');
    try {
      const response = await updateAdminWorkOrderPayout(wo.id, {
        status,
        amount: amountInput,
        currency: currentPayout.currency || CURRENCY,
        method: currentPayout.method || 'paypal',
        transaction_reference: reference,
        internal_note: note,
      });
      setDetail((prev) => (
        prev?.id === wo.id
          ? { ...prev, payout: response.payout, payout_status: response.payout_status }
          : prev
      ));
      setMessage(t.payoutUpdated(payoutLabel(response.payout_status)));
    } catch (err) {
      setMessage(err.message || t.payoutUpdateFailed);
    } finally {
      setAssigningId('');
    }
  }

  async function openDetail(wo) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailMessages([]);
    if (wo.pricing_status === 'pending_review') {
      setReviewedQuoteIds((prev) => ({ ...prev, [wo.id]: true }));
    }
    try {
      const [detailData, messagesData] = await Promise.all([
        getAdminWorkOrder(wo.id),
        getAdminWorkOrderMessages(wo.id),
      ]);
      setDetail(detailData);
      setDetailMessages(messagesData.list || []);
      getAdminInvoiceRequest(wo.id).then(setDetailInvoice).catch(() => setDetailInvoice(null));
    } catch (err) {
      setMessage(err.message || t.detailLoadFailed);
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitInternalNote() {
    if (!detail?.id || !internalNote.trim()) return;
    try {
      await postAdminWorkOrderMessage(detail.id, internalNote.trim(), true);
      const messagesData = await getAdminWorkOrderMessages(detail.id);
      setDetailMessages(messagesData.list || []);
      setInternalNote('');
    } catch (err) {
      setMessage(err.message || t.noteSaveFailed);
    }
  }

  async function handleProcessInvoice() {
    const invoiceNumber = window.prompt(t.invoiceConfirmLabel);
    if (!invoiceNumber) return;
    setInvoiceProcessing(true);
    try {
      await processAdminInvoiceRequest(detail.id, {
        action: 'issue',
        invoice_number: invoiceNumber,
      });
      setDetailInvoice((prev) => (
        prev ? { ...prev, status: 'issued', invoice_number: invoiceNumber } : prev
      ));
      setMessage(t.invoiceStatus('issued'));
    } catch (err) {
      setMessage(err.message || '处理发票失败');
    } finally {
      setInvoiceProcessing(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t.subtitle}
          </p>
        </div>
      </div>
      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mb-6 sm:flex-wrap sm:px-0">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`shrink-0 px-3 py-2 sm:px-4 rounded-lg text-sm font-medium transition-colors ${
              status === tab.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {data.list.length === 0 ? (
              <div className="rounded-xl bg-[var(--color-surface-elevated)] py-8 text-center text-sm text-[var(--color-text-muted)]">
                {t.empty}
              </div>
            ) : data.list.map((wo) => {
              const statusInfo = STATUS_MAP[wo.status] || { color: 'var(--color-text-muted)' };
              return (
                <article key={wo.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => openDetail(wo)}
                      className="min-w-0 break-all text-left font-mono text-sm font-semibold text-[var(--color-primary)]"
                    >
                      {wo.order_no}
                    </button>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-surface-elevated)] px-2 py-1 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                      {t.statuses[wo.status] || wo.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="font-medium">{wo.customer_name || '-'}</div>
                    {wo.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.customer_company}</div>}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)]">
                    <div>{t.headers.type}: {t.types[wo.type] || wo.type || '-'}</div>
                    <div>
                      {t.headers.urgency}: <span className={wo.urgency === 'critical' ? 'text-[var(--color-error)] font-medium' : wo.urgency === 'urgent' ? 'text-[var(--color-warning)]' : ''}>
                        {t.urgency[wo.urgency] || wo.urgency || '-'}
                      </span>
                    </div>
                    <div>{t.headers.regionalLead}: {wo.regional_lead_name || '-'}</div>
                    <div>{t.headers.engineer}: {wo.engineer_name || '-'}</div>
                    <div>
                      {t.headers.quoteArchive}: {wo.pricing_status
                        ? `${t.pricing[wo.pricing_status] || wo.pricing_status}${wo.pricing_total_amount || wo.pricing_subtotal ? ` / ${money(wo.pricing_total_amount || wo.pricing_subtotal)} ${CURRENCY}` : ''}`
                        : t.noQuote}
                    </div>
                  </div>
                  {wo.conflict_status === 'blocked' && (
                    <div className="mt-3 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
                      {wo.conflict_reason || t.conflictFallback}
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => openDetail(wo)}
                      className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)]"
                    >
                      {wo.pricing_status === 'pending_review' ? (t.viewQuoteDetail || t.view) : t.view}
                    </button>
                    {wo.status === 'payment_review' && (
                      <button
                        onClick={() => handleApprovePaymentStart(wo)}
                        disabled={assigningId === `${wo.id}:payment-start`}
                        className="min-h-10 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t.approvePaymentStart}
                      </button>
                    )}
                    {['resolved', 'pending_review'].includes(wo.status) && (
                      <button
                        onClick={() => handleArchive(wo)}
                        disabled={assigningId === `${wo.id}:archive`}
                        className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        {t.archive}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {wo.created_at?.slice(0, 16)?.replace('T', ' ')}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.orderNo}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.customer}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.regionalLead}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.engineer}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.type}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.urgency}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.status}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.quoteArchive}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.createdAt}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.detail}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-[var(--color-text-muted)]">
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  data.list.map((wo) => {
                    const statusInfo = STATUS_MAP[wo.status] || { color: 'var(--color-text-muted)' };
                    return (
                      <tr key={wo.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                        <td className="py-3 px-2">
                          <button
                            onClick={() => openDetail(wo)}
                            className="font-mono text-left text-[var(--color-primary)] hover:underline"
                          >
                            {wo.order_no}
                          </button>
                        </td>
                        <td className="py-3 px-2">
                          <div>{wo.customer_name || '-'}</div>
                          {wo.customer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.customer_company}</div>}
                        </td>
                        <td className="py-3 px-2">
                          <div>{wo.regional_lead_name || '-'}</div>
                          {wo.regional_lead_no && <div className="text-xs text-[var(--color-text-muted)]">{wo.regional_lead_no}</div>}
                        </td>
                        <td className="py-3 px-2">
                          <div>{wo.engineer_name || '-'}</div>
                          {wo.engineer_company && <div className="text-xs text-[var(--color-text-muted)]">{wo.engineer_company}</div>}
                          {wo.conflict_status === 'blocked' && (
                            <div className="mt-1 text-xs text-[var(--color-error)]">{wo.conflict_reason || t.conflictFallback}</div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-[var(--color-text-secondary)]">{t.types[wo.type] || wo.type}</td>
                        <td className="py-3 px-2">
                          <span className={wo.urgency === 'critical' ? 'text-[var(--color-error)] font-medium' : wo.urgency === 'urgent' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}>
                            {t.urgency[wo.urgency] || wo.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                            {t.statuses[wo.status] || wo.status}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="min-w-[170px] space-y-2">
                            <div className="text-xs text-[var(--color-text-secondary)]">
                              {wo.pricing_status
                                ? `${t.pricing[wo.pricing_status] || wo.pricing_status}${wo.pricing_total_amount || wo.pricing_subtotal ? ` · ${money(wo.pricing_total_amount || wo.pricing_subtotal)} ${CURRENCY}` : ''}`
                                : t.noQuote}
                            </div>
                            {wo.pricing_status === 'pending_review' && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    onClick={() => openDetail(wo)}
                                    className="rounded-lg border border-[var(--color-primary)]/40 px-2 py-1 text-xs text-[var(--color-primary)]"
                                  >
                                    {t.viewQuoteDetail || t.view}
                                  </button>
                                </div>
                              </div>
                            )}
                            {wo.status === 'payment_review' && (
                              <button
                                onClick={() => handleApprovePaymentStart(wo)}
                                disabled={assigningId === `${wo.id}:payment-start`}
                                className="rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)] disabled:opacity-50"
                              >
                                {t.approvePaymentStart}
                              </button>
                            )}
                            {['resolved', 'pending_review'].includes(wo.status) && (
                              <button
                                onClick={() => handleArchive(wo)}
                                disabled={assigningId === `${wo.id}:archive`}
                                className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] disabled:opacity-50"
                              >
                                {t.archive}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-[var(--color-text-secondary)]">
                          {wo.created_at?.slice(0, 16)?.replace('T', ' ')}
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => openDetail(wo)}
                            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                          >
                            {t.view}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                {t.previous}
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-elevated)] disabled:opacity-30 hover:bg-[var(--color-border)] transition-colors"
              >
                {t.next}
              </button>
            </div>
          )}
        </>
      )}

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailOpen(false)} />
          <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden bg-[var(--color-surface)] shadow-2xl">
            <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-5">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-primary)]">{t.serviceRecordLabel}</div>
                <h3 className="text-lg font-semibold">{t.drawerTitle}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.drawerSubtitle}</p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                {t.close}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">

            {detailLoading ? (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
            ) : detail ? (
              <div className="space-y-4">
                {detail.pricing?.status === 'pending_review' && (
                  <section className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-text)]">{t.fullOrderReviewTitle}</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.fullOrderReviewHint}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRejectPricing(detail)}
                          disabled={assigningId === `${detail.id}:reject`}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
                        >
                          {t.returnQuote || t.return}
                        </button>
                        <button
                          onClick={() => handleApprovePricing(detail)}
                          disabled={assigningId === `${detail.id}:approve`}
                          className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {t.approveFullOrder || t.approve}
                        </button>
                      </div>
                    </div>
                  </section>
                )}
                {detail.status === 'payment_review' && (
                  <section className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-text)]">{t.paymentReviewTitle}</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t.paymentReviewHint}</p>
                      </div>
                      <button
                        onClick={() => handleApprovePaymentStart(detail)}
                        disabled={assigningId === `${detail.id}:payment-start`}
                        className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t.approvePaymentStart}
                      </button>
                    </div>
                  </section>
                )}
                <section className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-mono text-[var(--color-primary)]">{detail.order_no}</div>
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">{detail.status}</span>
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">{detail.description}</div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2">
                    <div>{t.customerLabel}: {detail.customer_name || '-'}</div>
                    <div>{t.engineerLabel}: {detail.engineer_name || '-'}</div>
                    <div>{t.quoteReviewLabel}: {detail.quote_review_status || '-'}</div>
                    <div>{t.riskControlLabel}: {detail.conflict_status || t.clearRisk}</div>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-3 font-medium text-[var(--color-text)]">{t.headers.dispatch}</h4>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRegionalLeads[detail.id] || detail.assigned_regional_lead_id || ''}
                        onChange={(event) => setSelectedRegionalLeads((prev) => ({ ...prev, [detail.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                      >
                        <option value="">{t.regionalLeadOption}</option>
                        {regionalLeads.map((lead) => (
                          <option key={lead.id} value={lead.id}>{formatEngineerOption(lead)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssignRegionalLead(detail)}
                        disabled={assigningId === `${detail.id}:lead`}
                        className="whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {assigningId === `${detail.id}:lead` ? t.assigning : t.assignRegion}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedEngineers[detail.id] || detail.engineer_id || ''}
                        onChange={(event) => setSelectedEngineers((prev) => ({ ...prev, [detail.id]: event.target.value }))}
                        className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                      >
                        <option value="">{t.engineerOption}</option>
                        {engineers.map((engineer) => (
                          <option key={engineer.id} value={engineer.id}>{formatEngineerOption(engineer)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(detail)}
                        disabled={assigningId === `${detail.id}:engineer`}
                        className="whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {assigningId === `${detail.id}:engineer` ? t.dispatching : t.directDispatch}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-medium text-[var(--color-text)]">{t.engineerPayoutTitle}</h4>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {t.engineerPayoutHint}
                      </p>
                      <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2">
                        <div>{t.payoutFields.status}: {payoutLabel(detail.payout_status, t)}</div>
                        <div>{t.payoutFields.method}: {detail.payout?.method === 'bank_swift' ? t.payoutMethods.bank_swift : t.payoutMethods.paypal}</div>
                        <div>{t.payoutFields.amount}: {detail.payout?.amount ? `${money(detail.payout.amount)} ${detail.payout.currency || CURRENCY}` : '-'}</div>
                        <div>{t.payoutFields.reference}: {detail.payout?.transaction_reference || '-'}</div>
                        <div>{t.payoutFields.paidAt}: {detail.payout?.paid_at ? new Date(detail.payout.paid_at).toLocaleString(runtimeConfig.locale === 'zh-CN' ? 'zh-CN' : 'en-US') : '-'}</div>
                        <div>{t.payoutFields.note}: {detail.payout?.internal_note || '-'}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleUpdatePayout(detail, 'processing')}
                        disabled={assigningId === `${detail.id}:payout:processing`}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        {t.payoutActions.processing}
                      </button>
                      <button
                        onClick={() => handleUpdatePayout(detail, 'completed')}
                        disabled={assigningId === `${detail.id}:payout:completed`}
                        className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t.payoutActions.completed}
                      </button>
                      <button
                        onClick={() => handleUpdatePayout(detail, 'exception')}
                        disabled={assigningId === `${detail.id}:payout:exception`}
                        className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-500 disabled:opacity-50"
                      >
                        {t.payoutActions.exception}
                      </button>
                    </div>
                  </div>
                </section>

                {runtimeConfig.locale === 'zh-CN' && (
                  <section className="rounded-xl border border-[var(--color-border)] p-4">
                    <h4 className="mb-2 font-medium">{t.invoiceTitle}</h4>
                    {detailInvoice ? (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--color-text-secondary)]">
                            {t.invoiceStatus(detailInvoice.status)}
                          </span>
                          {detailInvoice.status === 'issued' && detailInvoice.invoice_number && (
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {t.invoiceNumber}: {detailInvoice.invoice_number}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <div>{detailInvoice.company_name}</div>
                          <div>税号: {detailInvoice.tax_id}</div>
                        </div>
                        {detailInvoice.status === 'pending' && (
                          <button
                            onClick={handleProcessInvoice}
                            disabled={invoiceProcessing}
                            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {invoiceProcessing ? t.loading : t.invoiceProcessBtn}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--color-text-muted)]">{t.noInvoice}</div>
                    )}
                  </section>
                )}

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-2 font-medium">{t.aiSummaryTitle}</h4>
                  <div className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface-elevated)] p-3 text-xs text-[var(--color-text-secondary)]">
                    {formatAiSummary(detail.ai_summary) || t.noAiSummary}
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.quoteDetailTitle || 'Quote Details'}</h4>
                    {detail.pricing?.status && (
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs text-[var(--color-primary)]">
                        {t.pricing[detail.pricing.status] || detail.pricing.status}
                      </span>
                    )}
                  </div>
                  {detail.pricing ? (() => {
                    const pricing = detail.pricing;
                    const parts = quoteParts(detail);
                    const subtotal = pricing.subtotal || pricing.total_amount || 0;
                    const note = formatQuoteNote(pricing.parts_detail);
                    const aiCheck = quoteAiCheck(pricing);
                    return (
                      <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <MoneyRow label={t.quoteFeeLabels.labor} value={pricing.labor_fee || 0} />
                          <MoneyRow label={t.quoteFeeLabels.parts} value={pricing.parts_fee || 0} />
                          <MoneyRow label={t.quoteFeeLabels.travel} value={pricing.travel_fee || 0} />
                          <MoneyRow label={t.quoteFeeLabels.other} value={pricing.other_fee || 0} />
                        </div>
                        {note && (
                          <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                            <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">{t.otherFeeNote || 'Other fee note'}</div>
                            <div>{note}</div>
                          </div>
                        )}
                        {parts.length > 0 && (
                          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                            <div className="bg-[var(--color-surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">
                              {t.partsList || 'Parts list'}
                            </div>
                            <table className="w-full text-xs">
                              <tbody>
                                {parts.map((part, index) => (
                                  <tr key={part.id || `${part.material_code || part.name}-${index}`} className="border-t border-[var(--color-border)]">
                                    <td className="px-3 py-2">
                                      <div className="text-[var(--color-text)]">{part.name_en || part.name || '-'}</div>
                                      <div className="text-[var(--color-text-muted)]">{[part.material_code, part.spec, part.brand].filter(Boolean).join(' · ') || '-'}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right">{part.quantity || 1} {part.unit || 'pcs'}</td>
                                    <td className="px-3 py-2 text-right">{money(part.unit_price)} {CURRENCY}</td>
                                    <td className="px-3 py-2 text-right">{money(part.line_total || Number(part.quantity || 0) * Number(part.unit_price || 0))} {CURRENCY}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                          <div className="flex justify-between">
                            <span>{t.quoteSubtotalPrice || 'Quote subtotal price'}</span>
                            <span className="font-semibold text-[var(--color-primary)]">{money(subtotal)} {CURRENCY}</span>
                          </div>
                        </div>
                        {aiCheck && (
                          <div className="rounded-lg border border-[var(--color-border)] p-3">
                            <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">{t.aiPriceCheck || 'AI price check'}</div>
                            <div className="font-medium text-[var(--color-text)]">{aiCheck.status || '-'}</div>
                            {(aiCheck.reason || aiCheck.ai_note) && (
                              <div className="mt-1 text-xs whitespace-pre-wrap">{aiCheck.reason || aiCheck.ai_note}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noQuoteDetail || t.noQuote}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.attachmentsTitle}</h4>
                    <span className="text-xs text-[var(--color-text-muted)]">{t.attachmentCount(detail.attachments?.length || 0)}</span>
                  </div>
                  {detail.attachments?.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {detail.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.r2_url}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
                        >
                          {isImageAttachment(attachment) ? (
                            <img
                              src={attachment.r2_url}
                              alt={attachment.file_name}
                              className="h-32 w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-32 items-center justify-center text-xs text-[var(--color-text-muted)]">
                              {t.openAttachment}
                            </div>
                          )}
                          <div className="p-2 text-xs text-[var(--color-text-secondary)]">
                            <div className="truncate" title={attachment.file_name}>{attachment.file_name}</div>
                            <div className="text-[var(--color-text-muted)]">{attachment.uploader_type || '-'}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noAttachments}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-2 font-medium">{t.reportTitle}</h4>
                  {detail.repair_record ? (
                    <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                      <div>{t.reportFields.symptom}: {detail.repair_record.symptom || '-'}</div>
                      <div>{t.reportFields.diagnosis}: {detail.repair_record.diagnosis || '-'}</div>
                      <div>{t.reportFields.solution}: {detail.repair_record.solution || '-'}</div>
                      <div>{t.reportFields.laborHours}: {detail.repair_record.labor_hours || 0}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noReport}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.customerReviewTitle}</h4>
                    {detail.rating && (
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
                        {t.average} {formatScore(averageScore([
                          detail.rating.rating_timeliness,
                          detail.rating.rating_technical,
                          detail.rating.rating_communication,
                          detail.rating.rating_professional,
                        ]))}
                      </span>
                    )}
                  </div>
                  {detail.rating ? (
                    <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ScoreRow label={t.scoreRows.timeliness} value={detail.rating.rating_timeliness} />
                        <ScoreRow label={t.scoreRows.technical} value={detail.rating.rating_technical} />
                        <ScoreRow label={t.scoreRows.communication} value={detail.rating.rating_communication} />
                        <ScoreRow label={t.scoreRows.professional} value={detail.rating.rating_professional} />
                      </div>
                      {detail.rating.comment && (
                        <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                          {detail.rating.comment}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noCustomerReview}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-medium">{t.engineerReviewTitle}</h4>
                    {detail.engineer_review && (
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--color-primary)]">
                        {t.average} {formatScore(averageScore([
                          detail.engineer_review.rating_cooperation,
                          detail.engineer_review.rating_communication,
                          detail.engineer_review.rating_payment,
                          detail.engineer_review.rating_environment,
                        ]))}
                      </span>
                    )}
                  </div>
                  {detail.engineer_review ? (
                    <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ScoreRow label={t.scoreRows.cooperation} value={detail.engineer_review.rating_cooperation} />
                        <ScoreRow label={t.scoreRows.communication} value={detail.engineer_review.rating_communication} />
                        <ScoreRow label={t.scoreRows.payment} value={detail.engineer_review.rating_payment} />
                        <ScoreRow label={t.scoreRows.environment} value={detail.engineer_review.rating_environment} />
                      </div>
                      {detail.engineer_review.comment && (
                        <div className="rounded-lg bg-[var(--color-surface-elevated)] p-3">
                          {detail.engineer_review.comment}
                        </div>
                      )}
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {t.internalRiskNote}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)]">{t.noEngineerReview}</div>
                  )}
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium">{t.messagesTitle}</h4>
                    <span className="text-xs text-[var(--color-text-muted)]">{t.messageCount(detailMessages.length)}</span>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {detailMessages.length === 0 ? (
                      <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t.noMessages}</div>
                    ) : detailMessages.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-lg p-3 text-sm ${item.is_internal_note ? 'bg-amber-500/10 text-amber-700' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span>{item.sender_name || item.sender_type}{item.is_internal_note ? ` · ${t.internalNote}` : ''}</span>
                          <span className="text-[var(--color-text-muted)]">{item.created_at?.slice(0, 16)?.replace('T', ' ')}</span>
                        </div>
                        <div>{item.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      placeholder={t.notePlaceholder}
                      rows={3}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm focus:outline-none"
                    />
                    <button
                      onClick={submitInternalNote}
                      disabled={!internalNote.trim()}
                      className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {t.saveNote}
                    </button>
                  </div>
                </section>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.noDetail}</div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
