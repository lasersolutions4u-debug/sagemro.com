import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import {
  getWorkOrder,
  submitRating,
  resolveWorkOrder,
  cancelWorkOrder,
  submitEngineerReview,
  getEngineerReview,
} from '../../services/api';
import { statusConfig, urgencyConfig, typeLabels, categoryConfig, categoryL2Labels, formatSlaRemaining } from '../../data/workOrderConfig.js';
import { toastSuccess, toastError, toastWarning, confirmDialog } from '../../utils/feedback';
import { Stars } from './Stars';
import { MessagePanel } from './MessagePanel';
import { EngineerPricingPanel, CustomerPricingPanel } from './PricingPanels';
import { RepairRecordPanel } from './RepairRecordPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { isCnLocale } from '../../utils/locale';

function hasServiceReportContent(record) {
  if (!record) return false;
  const hasText = Boolean(record.symptom || record.diagnosis || record.solution);
  const hasLabor = Number(record.labor_hours || 0) > 0;
  let hasParts = false;
  try {
    const parts = JSON.parse(record.parts_used || '[]');
    hasParts = Array.isArray(parts) && parts.some((part) => part?.name);
  } catch {
    hasParts = false;
  }
  return hasText || hasLabor || hasParts;
}

const COPY = {
  cn: {
    title: '工单详情',
    incompleteInfo: '工单信息不完整',
    ratingSuccess: '服务已确认，感谢你的评价。',
    ratingFailed: '评价提交失败',
    tabs: {
      info: '详情',
      messages: '消息',
      submitQuote: '提交报价',
      confirmQuote: '确认报价',
      review: '评价',
      serviceReport: '服务报告',
      attachments: '附件',
    },
    issueType: '问题类型',
    equipmentCategory: '设备类别',
    submitted: '提交时间',
    slaDeadline: 'SLA 截止时间',
    engineer: 'SAGEMRO 工程师',
    customer: '客户',
    faultDescription: '故障描述',
    aiAnalysis: 'AI 分析',
    matchedEquipment: '匹配设备',
    saveReportFirst: '请先保存服务报告，再标记服务完成。',
    markCompleteConfirm: '确认服务报告已完整，且现场服务已完成？',
    reportSubmitted: '服务报告已提交，等待客户确认。',
    operationFailed: '操作失败',
    markComplete: '标记服务完成',
    cancelConfirm: '确定要取消这个服务请求吗？此操作不可撤销。',
    cancelled: '服务请求已取消',
    cancelRequest: '取消服务请求',
    progress: '进度',
    confirmAndReview: '确认服务并评价',
    viewReview: '查看评价 →',
    yourCustomerReview: '你对客户的评价',
    cooperation: '配合度',
    communication: '沟通',
    payment: '付款及时性',
    environment: '现场条件',
    internalOnly: '该评价仅 SAGEMRO 内部运营可见',
    reviewCustomer: '评价客户',
    reviewCustomerHint: '该评价仅 SAGEMRO 内部运营可见，不会展示给客户',
    customerReviewPlaceholder: '记录客户配合情况（可选）...',
    cancel: '取消',
    submitReview: '提交评价',
    submitting: '正在提交...',
    yourReview: '你的评价',
    timeliness: '时效性',
    technical: '技术能力',
    professional: '专业性',
    reviewed: '评价时间',
    serviceReview: '服务评价',
    serviceReviewPlaceholder: '分享你的服务体验（可选）...',
    reviewUnavailable: '当前不可评价',
    loading: '加载中...',
  },
  en: {
    title: 'Work Order Details',
    incompleteInfo: 'Work order information is incomplete',
    ratingSuccess: 'Service confirmed. Thank you for the review.',
    ratingFailed: 'Review submission failed',
    tabs: {
      info: 'Details',
      messages: 'Messages',
      submitQuote: 'Submit Quote',
      confirmQuote: 'Confirm Quote',
      review: 'Review',
      serviceReport: 'Service Report',
      attachments: 'Attachments',
    },
    issueType: 'Issue Type',
    equipmentCategory: 'Equipment Category',
    submitted: 'Submitted',
    slaDeadline: 'SLA Deadline',
    engineer: 'SAGEMRO Engineer',
    customer: 'Customer',
    faultDescription: 'Fault Description',
    aiAnalysis: 'AI Analysis',
    matchedEquipment: 'Matched Equipment',
    saveReportFirst: 'Please save the service report before marking the service complete.',
    markCompleteConfirm: 'Confirm that the service report is complete and the on-site work is finished?',
    reportSubmitted: 'Service report submitted for customer confirmation.',
    operationFailed: 'Operation failed',
    markComplete: 'Mark Service Complete',
    cancelConfirm: 'Are you sure you want to cancel this service request? This action cannot be undone.',
    cancelled: 'Service request cancelled',
    cancelRequest: 'Cancel Service Request',
    progress: 'Progress',
    confirmAndReview: 'Confirm Service & Review',
    viewReview: 'View Review →',
    yourCustomerReview: 'Your Review of the Customer',
    cooperation: 'Cooperation',
    communication: 'Communication',
    payment: 'Payment Timeliness',
    environment: 'Site Conditions',
    internalOnly: 'This review is only visible to SAGEMRO internal operations',
    reviewCustomer: 'Review Customer',
    reviewCustomerHint: 'This review is only visible to SAGEMRO internal operations, not to the customer',
    customerReviewPlaceholder: 'Note customer cooperation details (optional)...',
    cancel: 'Cancel',
    submitReview: 'Submit Review',
    submitting: 'Submitting...',
    yourReview: 'Your Review',
    timeliness: 'Timeliness',
    technical: 'Technical Skill',
    professional: 'Professionalism',
    reviewed: 'Reviewed',
    serviceReview: 'Service Review',
    serviceReviewPlaceholder: 'Share your service experience (optional)...',
    reviewUnavailable: 'Review not available',
    loading: 'Loading...',
  },
};

const STATUS_CN = {
  pending: '待处理',
  assigned: '已分配',
  in_progress: '处理中',
  pricing: '待报价',
  pending_payment: '待付款',
  in_service: '服务中',
  resolved: '已解决',
  pending_review: '待评价',
  completed: '已完成',
  rejected: '已拒绝',
  cancelled: '已取消',
};

const URGENCY_CN = {
  normal: '普通',
  urgent: '紧急',
  critical: '非常紧急',
};

const TYPE_CN = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '备件采购',
  aftersales: '售后服务',
  other: '其他',
};

const CATEGORY_CN = {
  laser_cutting: '激光切割',
  bending: '折弯',
  punching: '冲压 / 冲床',
  welding: '焊接',
  surface_treatment: '表面处理',
  auxiliary: '辅助系统',
  cnc_automation: '数控与自动化',
  inspection: '检测与质检',
  other: '其他设备',
};

const CATEGORY_L2_CN = {
  mechanical_fault: '机械故障',
  electrical_fault: '电气故障',
  optical_fault: '光路 / 光束故障',
  hydraulic_fault: '液压系统故障',
  arc_fault: '电弧 / 焊接质量问题',
  wire_feeder_fault: '送丝机构故障',
  tooling_fault: '模具 / 刀具故障',
  compressor_fault: '空压机故障',
  chiller_fault: '冷水机 / 冷却故障',
  gas_generation: '制氮 / 制氧系统故障',
  power_supply: '电源 / 稳压系统故障',
  cnc_system: '数控系统故障',
  servo_drive: '伺服 / 驱动故障',
  robot_fault: '机器人故障',
  plc_fault: 'PLC / 自动化故障',
  sensor_fault: '传感器 / 检测故障',
  cooling_fault: '冷却系统故障',
  gas_fault: '气路 / 辅助气体故障',
  control_system: '控制系统故障',
  media_fault: '磨料 / 介质故障',
  dust_collection: '除尘 / 环保系统故障',
  calibration: '精度校准',
  software_fault: '软件 / 系统故障',
  general_fault: '一般故障',
  maintenance: '维护保养',
  parameter_debug: '参数调试',
  installation: '安装调试',
  consultation: '技术咨询',
  parts_replacement: '备件更换',
  other: '其他',
};

function formatDate(value, isCn) {
  return value ? new Date(value).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-';
}

function getStatusText(status, isCn) {
  if (isCn) return STATUS_CN[status] || status;
  return statusConfig[status]?.text || status;
}

function getUrgencyText(urgency, isCn) {
  if (isCn) return URGENCY_CN[urgency] || urgency;
  return urgencyConfig[urgency]?.text || urgency;
}

function getTypeText(type, isCn) {
  if (isCn) return TYPE_CN[type] || type;
  return typeLabels[type] || type;
}

// ========== 主组件 ==========
export function WorkOrderDetailModal({ isOpen, onClose, workOrder, onRateSuccess, onConfirmed, userType, userId }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('info');
  const [ratings, setRatings] = useState({ timeliness: 5, technical: 5, communication: 5, professional: 5 });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 工程师评价客户
  const [showEngineerReview, setShowEngineerReview] = useState(false);
  const [engineerReview, setEngineerReview] = useState(null);
  const [engReviewRatings, setEngReviewRatings] = useState({ cooperation: 5, communication: 5, payment: 5, environment: 5 });
  const [engReviewComment, setEngReviewComment] = useState('');
  const [engReviewSubmitting, setEngReviewSubmitting] = useState(false);
  const workOrderId = workOrder?.id;

  const loadDetail = useCallback(async () => {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const data = await getWorkOrder(workOrderId);
      setDetail(data);
      // 加载工程师评价
      if (userType === 'engineer') {
        try {
          const revData = await getEngineerReview(workOrderId);
          setEngineerReview(revData.review);
        } catch {
          // No prior engineer review is fine; keep the review section empty.
        }
      }
    } catch (e) {
      console.error('加载工单详情失败:', e);
    } finally {
      setLoading(false);
    }
  }, [workOrderId, userType]);

  useEffect(() => {
    if (isOpen && workOrderId) {
      loadDetail();
      // 客户侧：待评价/已解决状态自动跳转到评价 tab
      const initialStatus = workOrder.status;
      const autoTab = (userType === 'customer' &&
        (initialStatus === 'pending_review' || initialStatus === 'resolved'))
        ? 'rating' : 'info';
      setTab(autoTab);
    }
  }, [isOpen, workOrder, workOrderId, userType, loadDetail]);

  const handleSubmitRating = async () => {
    if (!detail?.engineer_id || !detail?.customer_id) { toastWarning(copy.incompleteInfo); return; }
    setSubmitting(true);
    try {
      await submitRating({
        work_order_id: detail.id,
        engineer_id: detail.engineer_id,
        customer_id: detail.customer_id,
        rating_timeliness: ratings.timeliness,
        rating_technical: ratings.technical,
        rating_communication: ratings.communication,
        rating_professional: ratings.professional,
        comment,
      });
      toastSuccess(copy.ratingSuccess);
      onRateSuccess?.();
      loadDetail();
    } catch (e) {
      toastError(`${copy.ratingFailed}: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!workOrder) return null;

  // 使用 detail 中的最新状态（loadDetail 刷新后），回退到 prop 中的初始状态
  const effectiveStatus = detail?.status || workOrder.status;
  const baseStatus = statusConfig[effectiveStatus] || { text: effectiveStatus, color: 'bg-gray-500' };
  const status = { ...baseStatus, text: getStatusText(effectiveStatus, isCn) };
  const baseUrgency = urgencyConfig[workOrder.urgency] || urgencyConfig.normal;
  const urgency = { ...baseUrgency, text: getUrgencyText(workOrder.urgency, isCn) };
  const isEngineer = userType === 'engineer';
  const isCustomer = userType === 'customer';

  const tabs = [
    { key: 'info', label: copy.tabs.info },
    { key: 'messages', label: copy.tabs.messages },
  ];

  // 核价Tab：工程师看表单，客户看报价确认（含待付款状态）
  if (effectiveStatus === 'in_progress' || effectiveStatus === 'pricing' || effectiveStatus === 'pending_payment' || effectiveStatus === 'in_service') {
    tabs.push({ key: 'pricing', label: isEngineer ? copy.tabs.submitQuote : copy.tabs.confirmQuote });
  }

  // 评价Tab：客户对服务进行评价（resolved/pending_review 可评价，completed 查看已有评价）
  const canRate = effectiveStatus === 'resolved' || effectiveStatus === 'pending_review';
  const hasRating = detail?.rating;
  if (isCustomer && (canRate || (effectiveStatus === 'completed' && hasRating))) {
    tabs.push({ key: 'rating', label: copy.tabs.review });
  }

  // 维修记录Tab：工程师在服务中及之后可见，客户在有记录时可见
  const hasRepairRecord = detail?.repair_record;
  const repairStatuses = ['in_service', 'pricing', 'resolved', 'pending_review', 'completed'];
  if ((isEngineer && repairStatuses.includes(effectiveStatus)) || (isCustomer && hasRepairRecord)) {
    tabs.push({ key: 'repairRecord', label: copy.tabs.serviceReport });
  }

  // 附件Tab：工单已分配后可见；若 AI 对话图片已随工单带入，pending 阶段也要可查看。
  if (effectiveStatus !== 'pending' || detail?.attachments?.length > 0) {
    tabs.push({ key: 'attachments', label: copy.tabs.attachments });
  }

  const renderInfoTab = () => (
    <div className="space-y-4">
      <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-[var(--color-text-primary)]">{detail?.order_no || workOrder.id}</span>
          <div className="flex gap-2">
            <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>{status.text}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${urgency.color}`}>{urgency.text}</span>
          </div>
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">{copy.issueType}: {getTypeText(workOrder.type, isCn)}</div>
        {(workOrder.category_l1 && workOrder.category_l1 !== 'other') && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {copy.equipmentCategory}: {isCn ? CATEGORY_CN[workOrder.category_l1] || workOrder.category_l1 : categoryConfig[workOrder.category_l1]?.label || workOrder.category_l1}
            {workOrder.category_l2 && workOrder.category_l2 !== 'other' && (
              <span className="ml-1">· {isCn ? CATEGORY_L2_CN[workOrder.category_l2] || workOrder.category_l2 : categoryL2Labels[workOrder.category_l2] || workOrder.category_l2}</span>
            )}
          </div>
        )}
        <div className="text-sm text-[var(--color-text-secondary)]">{copy.submitted}: {formatDate(workOrder.created_at, isCn)}</div>
        {detail?.sla_deadline && (() => {
          const sla = detail.sla_status || {};
          const remaining = formatSlaRemaining(sla);
          const slaColor = sla.status === 'breached' ? 'text-red-500' : sla.status === 'at_risk' ? 'text-yellow-500' : 'text-green-500';
          return (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[var(--color-text-secondary)]">{copy.slaDeadline}: {formatDate(detail.sla_deadline, isCn)}</span>
              {remaining && <span className={slaColor}>{remaining}</span>}
            </div>
          );
        })()}
        {detail?.engineer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {copy.engineer}: <span className="text-[var(--color-primary)]">{detail.engineer_name}</span>
            {detail.engineer_phone && <span className="ml-1 opacity-70">{detail.engineer_phone}</span>}
          </div>
        )}
        {detail?.customer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {copy.customer}: <span className="text-[var(--color-primary)]">{detail.customer_name}</span>
            {detail.customer_phone && <span className="ml-1 opacity-70">{detail.customer_phone}</span>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{copy.faultDescription}</h3>
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">
          {workOrder.description}
        </div>
      </div>

      {detail?.ai_summary && (() => {
        let aiData;
        try { aiData = typeof detail.ai_summary === 'string' ? JSON.parse(detail.ai_summary) : detail.ai_summary; } catch { return null; }
        return (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{copy.aiAnalysis}</h3>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-[var(--color-text-primary)] space-y-2">
              {aiData.summary && <p>{aiData.summary}</p>}
              {aiData.required_specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">{copy.matchedEquipment}:</span>
                  {aiData.required_specialties.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 工程师：标记服务完成 */}
      {isEngineer && (effectiveStatus === 'in_service' || effectiveStatus === 'pricing') && (
        <button
          data-testid="mark-service-complete-button"
          onClick={async () => {
            if (!hasServiceReportContent(detail?.repair_record)) {
              setTab('repairRecord');
              toastWarning(copy.saveReportFirst);
              return;
            }
            if (!(await confirmDialog(copy.markCompleteConfirm))) return;
            try {
              await resolveWorkOrder(workOrder.id, userId);
              toastSuccess(copy.reportSubmitted);
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError(`${copy.operationFailed}: ${e.message}`);
            }
          }}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium"
        >
          {copy.markComplete}
        </button>
      )}

      {/* 客户：取消工单 */}
      {isCustomer && ['pending', 'assigned', 'in_progress', 'pricing'].includes(effectiveStatus) && (
        <button
          data-testid="cancel-work-order-button"
          onClick={async () => {
            if (!(await confirmDialog(copy.cancelConfirm, { danger: true }))) return;
            try {
              await cancelWorkOrder(workOrder.id);
              toastSuccess(copy.cancelled);
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError(`${copy.operationFailed}: ${e.message}`);
            }
          }}
          className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium"
        >
          {copy.cancelRequest}
        </button>
      )}

      {detail?.logs?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{copy.progress}</h3>
          <div className="space-y-2">
            {detail.logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                <div>
                  <p className="text-[var(--color-text-primary)]">{log.content}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDate(log.created_at, isCn)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 评价入口（resolved/pending_review状态，客户可见） */}
      {isCustomer && canRate && !hasRating && (
        <button
          data-testid="rate-work-order-button"
          onClick={() => setTab('rating')}
          className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium"
        >
          {copy.confirmAndReview}
        </button>
      )}
      {isCustomer && hasRating && (
        <button
          onClick={() => setTab('rating')}
          className="w-full py-2.5 text-sm text-[var(--color-primary)] hover:underline"
        >
          {copy.viewReview}
        </button>
      )}

      {/* 工程师评价客户（仅工程师可见） */}
      {isEngineer && (effectiveStatus === 'resolved' || effectiveStatus === 'completed' || effectiveStatus === 'pending_review') && engineerReview && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{copy.yourCustomerReview}</h3>
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
            {[
              { key: 'rating_cooperation', label: copy.cooperation },
              { key: 'rating_communication', label: copy.communication },
              { key: 'rating_payment', label: copy.payment },
              { key: 'rating_environment', label: copy.environment },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={engineerReview[dim.key]} readonly />
              </div>
            ))}
            {engineerReview.comment && (
              <div className="pt-2 border-t border-blue-500/20 text-sm text-[var(--color-text-primary)]">{engineerReview.comment}</div>
            )}
            <div className="text-xs text-[var(--color-text-muted)]">{copy.internalOnly}</div>
          </div>
        </div>
      )}

      {isEngineer && (effectiveStatus === 'resolved' || effectiveStatus === 'completed' || effectiveStatus === 'pending_review') && !engineerReview && !showEngineerReview && (
        <button onClick={() => setShowEngineerReview(true)} className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium">
          {copy.reviewCustomer}
        </button>
      )}

      {showEngineerReview && (
        <div className="space-y-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{copy.reviewCustomer}</h3>
          <div className="text-xs text-[var(--color-text-muted)]">{copy.reviewCustomerHint}</div>
          {[
            { key: 'cooperation', label: copy.cooperation },
            { key: 'communication', label: copy.communication },
            { key: 'payment', label: copy.payment },
            { key: 'environment', label: copy.environment },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={engReviewRatings[dim.key]} onChange={(v) => setEngReviewRatings({ ...engReviewRatings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={engReviewComment} onChange={(e) => setEngReviewComment(e.target.value)} placeholder={copy.customerReviewPlaceholder} rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowEngineerReview(false)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">{copy.cancel}</button>
            <button
              onClick={async () => {
                if (!detail?.engineer_id || !detail?.customer_id) { toastWarning(copy.incompleteInfo); return; }
                setEngReviewSubmitting(true);
                try {
                  await submitEngineerReview(workOrder.id, {
                    engineer_id: detail.engineer_id,
                    customer_id: detail.customer_id,
                    rating_cooperation: engReviewRatings.cooperation,
                    rating_communication: engReviewRatings.communication,
                    rating_payment: engReviewRatings.payment,
                    rating_environment: engReviewRatings.environment,
                    comment: engReviewComment,
                  });
                  setShowEngineerReview(false);
                  toastSuccess(copy.ratingSuccess);
                  loadDetail();
                } catch (e) {
                  toastError(`${copy.ratingFailed}: ${e.message}`);
                } finally {
                  setEngReviewSubmitting(false);
                }
              }}
              disabled={engReviewSubmitting}
              className="flex-1 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl text-sm"
            >
              {engReviewSubmitting ? copy.submitting : copy.submitReview}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderRatingTab = () => (
    <div className="space-y-4">
      {hasRating ? (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">{copy.yourReview}</h3>
          <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
            {[
              { key: 'timeliness', label: copy.timeliness },
              { key: 'technical', label: copy.technical },
              { key: 'communication', label: copy.communication },
              { key: 'professional', label: copy.professional },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={detail.rating[`rating_${dim.key}`]} readonly />
              </div>
            ))}
            {detail.rating.comment && (
              <div className="pt-3 border-t border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">{detail.rating.comment}</div>
            )}
            <div className="pt-1 text-xs text-[var(--color-text-muted)]">
              {copy.reviewed}: {formatDate(detail.rating.created_at, isCn)}
            </div>
          </div>
        </div>
      ) : canRate ? (
        <div className="space-y-3 p-4 bg-[var(--color-surface-elevated)] rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{copy.serviceReview}</h3>
          {[
            { key: 'timeliness', label: copy.timeliness },
            { key: 'technical', label: copy.technical },
            { key: 'communication', label: copy.communication },
            { key: 'professional', label: copy.professional },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={ratings[dim.key]} onChange={(v) => setRatings({ ...ratings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={copy.serviceReviewPlaceholder} rows={3}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
          <button
            data-testid="submit-rating-button"
            onClick={handleSubmitRating}
            disabled={submitting}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl font-medium"
          >
            {submitting ? copy.submitting : copy.submitReview}
          </button>
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">{copy.reviewUnavailable}</div>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="md">
      <div>
        {/* Tab 切换 */}
        <div className="flex gap-1 mb-4 border-b border-[var(--color-border)] pb-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">{copy.loading}</div>
        ) : (
          <>
            {tab === 'info' && renderInfoTab()}
            {tab === 'messages' && (
              <MessagePanel workOrderId={workOrder.id} userType={userType} userId={userId} />
            )}
            {tab === 'pricing' && isEngineer && (
              <EngineerPricingPanel
                workOrderId={workOrder.id}
                engineerId={userId}
                commissionRate={detail?.engineer_commission_rate || 0.80}
                engineerLevel={detail?.engineer_level || 'junior'}
                onSubmitted={() => { loadDetail(); onConfirmed?.(); }}
              />
            )}
            {tab === 'pricing' && isCustomer && (
              <CustomerPricingPanel workOrderId={workOrder.id} customerId={userId} onConfirmed={() => { loadDetail(); onConfirmed?.(); }} />
            )}
            {tab === 'rating' && renderRatingTab()}
            {tab === 'repairRecord' && (
              <RepairRecordPanel
                workOrderId={workOrder.id}
                userType={userType}
                repairRecord={detail?.repair_record || null}
                onSaved={() => loadDetail()}
              />
            )}
            {tab === 'attachments' && (
              <AttachmentsPanel
                workOrderId={workOrder.id}
                userType={userType}
                userId={userId}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
