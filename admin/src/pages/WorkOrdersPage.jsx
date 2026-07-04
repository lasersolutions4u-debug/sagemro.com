import { useState, useEffect } from 'react';
import {
  assignAdminWorkOrder,
  assignAdminWorkOrderRegionalLead,
  approveAdminWorkOrderPricing,
  archiveAdminWorkOrder,
  getAdminWorkOrder,
  getAdminWorkOrderMessages,
  getAdminUsers,
  getAdminWorkOrders,
  postAdminWorkOrderMessage,
  rejectAdminWorkOrderPricing,
} from '../services/api';
import { runtimeConfig } from '../config/runtime';

const STATUS_MAP = {
  pending: { color: 'var(--color-info)' },
  pending_dispatch: { color: 'var(--color-warning)' },
  assigned: { color: 'var(--color-warning)' },
  in_progress: { color: 'var(--color-warning)' },
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

function isImageAttachment(attachment) {
  return attachment?.file_type?.startsWith('image/');
}

const TEXT = {
  en: {
    statuses: {
      pending: 'Pending',
      pending_dispatch: 'Regional dispatch pending',
      assigned: 'Assigned',
      in_progress: 'In progress',
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
    return: 'Return',
    archive: 'Archive',
    regionalLeadOption: 'Select regional lead',
    assigning: 'Assigning',
    assignRegion: 'Assign region',
    engineerOption: 'Select engineer',
    dispatching: 'Dispatching',
    directDispatch: 'Direct dispatch',
    view: 'View',
    previous: 'Previous',
    next: 'Next',
    drawerTitle: 'Service Control View',
    drawerSubtitle: 'Review customer communication, internal notes, AI summary, service report, and two-way reviews.',
    close: 'Close',
    customerLabel: 'Customer',
    engineerLabel: 'Engineer',
    quoteReviewLabel: 'Quote review',
    riskControlLabel: 'Risk control',
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
  },
  'zh-CN': {
    statuses: {
      pending: '待处理',
      pending_dispatch: '待区域派工',
      assigned: '已分配',
      in_progress: '处理中',
      resolved: '已解决',
      completed: '已完成',
      rejected: '已拒绝',
      cancelled: '已取消',
    },
    urgency: {
      normal: '普通',
      urgent: '紧急',
      critical: '非常紧急',
    },
    types: {
      fault: '设备故障',
      maintenance: '设备保养',
      parameter: '参数调试',
      other: '其他',
    },
    pricing: {
      pending_review: '待运营复核',
      submitted: '已发客户确认',
      confirmed: '客户已确认',
      draft: '退回修改',
    },
    tabs: {
      all: '全部',
      pending: '待处理',
      pending_dispatch: '待区域派工',
      in_progress: '处理中',
      completed: '已完成',
    },
    title: '派工与服务质量',
    subtitle: '主流程为 Admin 分配给区域负责人，区域负责人再分给具体工程师；直接派工程师作为兼容操作保留，并受利益冲突风控限制。',
    loading: '加载中...',
    empty: '暂无数据',
    selectRegionalLead: '请先选择区域负责人',
    assignedRegionalLead: (orderNo) => `已分配区域负责人：${orderNo}`,
    assignRegionalLeadFailed: '分配区域负责人失败',
    selectEngineer: '请先选择内部工程师',
    assignedEngineer: (orderNo) => `已派工：${orderNo}`,
    assignEngineerFailed: '派工失败',
    quoteSent: (orderNo) => `已审核报价已发送给客户：${orderNo}`,
    quoteReviewFailed: '报价审核失败',
    rejectPrompt: '退回原因（可选，工程师端可见内部备注）：',
    quoteReturned: (orderNo) => `已退回报价修改：${orderNo}`,
    quoteReturnFailed: '报价退回失败',
    archived: (orderNo) => `已归档：${orderNo}`,
    archiveFailed: '归档失败',
    detailLoadFailed: '工单详情加载失败',
    noteSaveFailed: '内部备注保存失败',
    headers: {
      orderNo: '服务编号',
      customer: '客户',
      regionalLead: '区域负责人',
      engineer: '内部工程师',
      type: '类型',
      urgency: '紧急',
      status: '状态',
      quoteArchive: '报价/归档',
      createdAt: '创建时间',
      dispatch: '派工',
      detail: '详情',
    },
    conflictFallback: '存在利益冲突',
    noQuote: '暂无报价',
    approve: '通过',
    return: '退回',
    archive: '归档',
    regionalLeadOption: '选择区域负责人',
    assigning: '分配中',
    assignRegion: '分配区域',
    engineerOption: '选择工程师',
    dispatching: '派工中',
    directDispatch: '直接派工',
    view: '查看',
    previous: '上一页',
    next: '下一页',
    drawerTitle: '工单监管视图',
    drawerSubtitle: '查看客户沟通、内部备注、AI 摘要、服务报告和双向评价。',
    close: '关闭',
    customerLabel: '客户',
    engineerLabel: '工程师',
    quoteReviewLabel: '报价审核',
    riskControlLabel: '风控',
    aiSummaryTitle: 'AI 初诊摘要',
    noAiSummary: '暂无 AI 摘要',
    attachmentsTitle: '诊断图片与附件',
    attachmentCount: (count) => `${count} 个`,
    openAttachment: '点击查看附件',
    noAttachments: '暂无诊断图片或附件',
    reportTitle: '服务报告',
    reportFields: {
      symptom: '症状',
      diagnosis: '诊断',
      solution: '处理',
      laborHours: '工时',
    },
    noReport: '暂无服务报告',
    customerReviewTitle: '客户服务评价',
    average: '平均',
    scoreRows: {
      timeliness: '响应及时',
      technical: '技术能力',
      communication: '沟通体验',
      professional: '专业形象',
      cooperation: '配合程度',
      payment: '付款配合',
      environment: '现场条件',
    },
    noCustomerReview: '客户尚未评价本次服务',
    engineerReviewTitle: '工程师内部客户评价',
    internalRiskNote: '内部风控资料，仅用于派工判断、服务准备和质量复盘，客户不可见。',
    noEngineerReview: '工程师尚未提交客户协作评价',
    messagesTitle: '工单会话与内部备注',
    messageCount: (count) => `${count} 条`,
    noMessages: '暂无消息',
    internalNote: '内部备注',
    notePlaceholder: '添加内部备注，仅 Admin / 区域负责人 / 工程师可见，客户不可见。',
    saveNote: '保存内部备注',
    noDetail: '未加载到工单详情',
  },
};

export function WorkOrdersPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
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
    getAdminUsers('engineer', 1, 100, { status: 'available' })
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
      setMessage(t.quoteReturned(wo.order_no));
    } catch (err) {
      setMessage(err.message || t.quoteReturnFailed);
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

  async function openDetail(wo) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailMessages([]);
    try {
      const [detailData, messagesData] = await Promise.all([
        getAdminWorkOrder(wo.id),
        getAdminWorkOrderMessages(wo.id),
      ]);
      setDetail(detailData);
      setDetailMessages(messagesData.list || []);
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

  return (
    <div>
      <div className="mb-6">
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t.subtitle}
        </p>
      </div>
      {message && (
        <div className="mb-4 rounded-lg bg-[var(--color-surface-elevated)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
          <div className="overflow-x-auto">
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
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.dispatch}</th>
                  <th className="text-left py-3 px-2 text-[var(--color-text-secondary)] font-medium">{t.headers.detail}</th>
                </tr>
              </thead>
              <tbody>
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-[var(--color-text-muted)]">
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  data.list.map((wo) => {
                    const statusInfo = STATUS_MAP[wo.status] || { color: 'var(--color-text-muted)' };
                    return (
                      <tr key={wo.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50">
                        <td className="py-3 px-2 font-mono text-[var(--color-primary)]">{wo.order_no}</td>
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
                                ? `${t.pricing[wo.pricing_status] || wo.pricing_status}${wo.pricing_total_amount || wo.pricing_subtotal ? ` · ${wo.pricing_total_amount || wo.pricing_subtotal} CNY` : ''}`
                                : t.noQuote}
                            </div>
                            {wo.pricing_status === 'pending_review' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleApprovePricing(wo)}
                                  disabled={assigningId === `${wo.id}:approve`}
                                  className="rounded-lg bg-[var(--color-primary)] px-2 py-1 text-xs text-white disabled:opacity-50"
                                >
                                  {t.approve}
                                </button>
                                <button
                                  onClick={() => handleRejectPricing(wo)}
                                  disabled={assigningId === `${wo.id}:reject`}
                                  className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] disabled:opacity-50"
                                >
                                  {t.return}
                                </button>
                              </div>
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
                          <div className="flex min-w-[320px] flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedRegionalLeads[wo.id] || wo.assigned_regional_lead_id || ''}
                                onChange={(event) => setSelectedRegionalLeads((prev) => ({ ...prev, [wo.id]: event.target.value }))}
                                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                              >
                                <option value="">{t.regionalLeadOption}</option>
                                {regionalLeads.map((lead) => (
                                  <option key={lead.id} value={lead.id}>
                                    {lead.name}{lead.responsible_region || lead.service_region ? ` · ${lead.responsible_region || lead.service_region}` : ''}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAssignRegionalLead(wo)}
                                disabled={assigningId === `${wo.id}:lead`}
                                className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                {assigningId === `${wo.id}:lead` ? t.assigning : t.assignRegion}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                            <select
                              value={selectedEngineers[wo.id] || wo.engineer_id || ''}
                              onChange={(event) => setSelectedEngineers((prev) => ({ ...prev, [wo.id]: event.target.value }))}
                              className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                            >
                              <option value="">{t.engineerOption}</option>
                              {engineers.map((engineer) => (
                                <option key={engineer.id} value={engineer.id}>
                                  {engineer.name}{engineer.service_region ? ` · ${engineer.service_region}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssign(wo)}
                              disabled={assigningId === `${wo.id}:engineer`}
                              className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            >
                              {assigningId === `${wo.id}:engineer` ? t.dispatching : t.directDispatch}
                            </button>
                            </div>
                          </div>
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
          <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-primary)]">Service Record</div>
                <h3 className="text-lg font-semibold">{t.drawerTitle}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{t.drawerSubtitle}</p>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
              >
                {t.close}
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">{t.loading}</div>
            ) : detail ? (
              <div className="space-y-4">
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
                    <div>{t.riskControlLabel}: {detail.conflict_status || 'clear'}</div>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="mb-2 font-medium">{t.aiSummaryTitle}</h4>
                  <pre className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface-elevated)] p-3 text-xs text-[var(--color-text-secondary)]">
                    {detail.ai_summary || t.noAiSummary}
                  </pre>
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
      )}
    </div>
  );
}
