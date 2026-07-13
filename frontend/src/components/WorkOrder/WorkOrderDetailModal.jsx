import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import {
  getWorkOrder,
  submitRating,
  resolveWorkOrder,
  cancelWorkOrder,
  submitEngineerReview,
  getEngineerReview,
  checkInWorkOrder,
  requestWorkOrderPaymentStart,
  createMachineLead,
} from '../../services/api';
import {
  statusConfig,
  statusConfigCn,
  urgencyConfig,
  urgencyConfigCn,
  typeLabels,
  typeLabelsCn,
  categoryConfig,
  categoryConfigCn,
  categoryL2Labels,
  categoryL2LabelsCn,
  formatSlaRemaining,
  formatSlaRemainingCn,
} from '../../data/workOrderConfig.js';
import { toastSuccess, toastError, toastWarning, confirmDialog } from '../../utils/feedback';
import { Stars } from './Stars';
import { MessagePanel } from './MessagePanel';
import { EngineerPricingPanel, CustomerPricingPanel } from './PricingPanels';
import { RepairRecordPanel } from './RepairRecordPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { PaymentModal } from '../Payment/PaymentModal';
import { formatCustomerDeviceLine, formatServiceTextForLocale } from '../../utils/workOrderDisplay';
import { canEngineerViewCustomerContact, redactContactInfo } from '../../utils/contactRedaction';
import { isCnLocale } from '../../utils/locale';

const CURRENCY = isCnLocale() ? 'CNY' : 'USD';

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

function payoutLabel(status) {
  const labels = {
    not_ready: 'Payout not ready',
    pending: 'Payout pending',
    processing: 'Payout processing',
    completed: 'Payout completed',
    exception: 'Payout exception',
  };
  return labels[status] || status || 'Payout not ready';
}

const MACHINE_NEED_TYPES = [
  'Laser cutting machine',
  'Laser welding machine',
  'Press brake',
  'Production line',
  'Other complete machine',
];

const MACHINE_NEED_TYPES_CN = [
  '激光切割机',
  '激光焊接机',
  '折弯机',
  '产线设备',
  '其他整机设备',
];

const COPY = {
  en: {
    modalTitle: 'Work Order Details',
    tabs: {
      info: 'Details',
      messages: 'Messages',
      submitQuote: 'Submit Quote',
      confirmQuote: 'Confirm Quote',
      review: 'Review',
      serviceReport: 'Service Report',
      machineLead: 'Machine Lead',
    },
    incomplete: 'Work order information is incomplete',
    ratingSaved: 'Service confirmed. Thank you for the review.',
    ratingFailed: 'Review submission failed: ',
    saveReportFirst: 'Please save the service report before submitting the final report.',
    submitFinalConfirm: 'Submit the final service report to the customer for confirmation and review?',
    finalReportSent: 'Final service report sent to the customer for confirmation.',
    arrivalTitle: 'Arrival verification',
    arrivalAddress: 'Customer site',
    arrivalButton: 'Check in at customer site',
    arrivalLocating: 'Getting current location...',
    arrivalVerified: 'Arrival verified. You may begin or complete the service task.',
    arrivalBeforeComplete: 'Please check in at the customer site before submitting the final service report.',
    arrivalLocationFailed: 'Unable to get your current location. Please allow browser location access and try again.',
    operationFailed: 'Operation failed: ',
    machineLeadNeed: 'Please add at least one complete-machine equipment need.',
    machineLeadIntent: 'Please describe the customer whole-machine purchase intent.',
    machineLeadSaved: 'Machine lead submitted to Admin.',
    machineLeadFailed: 'Machine lead submission failed: ',
    payoutTitle: 'Engineer service payment',
    payoutNote: 'This internal closure is handled by Admin after customer confirmation.',
    payoutMethod: 'Method',
    payoutAmount: 'Amount',
    payoutReference: 'Reference',
    issueType: 'Issue Type',
    equipmentCategory: 'Equipment Category',
    submitted: 'Submitted',
    slaDeadline: 'SLA Deadline',
    engineer: 'SAGEMRO Engineer',
    machine: 'Machine',
    customer: 'Customer',
    faultDescription: 'Fault Description',
    aiAnalysis: 'AI Analysis',
    matchedEquipment: 'Matched Equipment',
    attachments: 'Attachments',
    submitFinalReport: 'Submit Final Report to Customer',
    cancelConfirm: 'Are you sure you want to cancel this service request? This action cannot be undone.',
    cancelSuccess: 'Service request cancelled',
    cancelService: 'Cancel Service Request',
    paymentStartConfirm: 'Request Admin approval to start service after payment follow-up?',
    paymentStartNote: 'Engineer confirmed payment follow-up with the customer.',
    paymentStartSent: 'Start request sent to Admin for payment confirmation.',
    paymentStartFailed: 'Start request failed: ',
    waitingPaymentConfirmation: 'Waiting for Admin Payment Confirmation',
    submitting: 'Submitting...',
    requestAdminStart: 'Request Admin Approval to Start',
    progress: 'Progress',
    confirmReview: 'Confirm Service & Review',
    viewReview: 'View Review →',
    yourReview: 'Your Review',
    serviceReview: 'Service Review',
    ratingUnavailable: 'Review not available',
    reviewed: 'Reviewed',
    ratingCommentPlaceholder: 'Share your service experience (optional)...',
    ratingDimensions: {
      timeliness: 'Timeliness',
      technical: 'Technical Skill',
      communication: 'Communication',
      professional: 'Professionalism',
    },
    submitReview: 'Submit Review',
    customerReviewTitle: 'Your Review of the Customer',
    internalReviewVisible: 'This review is only visible to SAGEMRO internal operations',
    reviewCustomer: 'Review Customer',
    internalReviewEditorNote: 'This review is only visible to SAGEMRO internal operations, not to the customer',
    engineerReviewPlaceholder: 'Note customer cooperation details (optional)...',
    engineerReviewDimensions: {
      cooperation: 'Cooperation',
      communication: 'Communication',
      payment: 'Payment Timeliness',
      environment: 'Site Conditions',
    },
    cancel: 'Cancel',
    machineLeadTitle: 'Whole-machine opportunity',
    machineLeadHelper: 'Use this only when the customer is considering one or more new complete machines such as laser cutting, laser welding, press brake, or production line equipment. Parts, consumables, peripherals, and retrofit opportunities stay in engineer value-added service workflows.',
    equipmentNeeds: 'Equipment needs',
    addEquipment: 'Add equipment',
    equipmentNumber: (index) => `Equipment #${index + 1}`,
    remove: 'Remove',
    equipmentType: 'Equipment type',
    selectType: 'Select type',
    quantity: 'Quantity',
    specification: 'Power / specification',
    specificationPlaceholder: '3015 single table, 3000W',
    needNotes: 'Need notes',
    needNotesPlaceholder: 'Timeline, preferred configuration, known constraints',
    region: 'Region',
    regionPlaceholder: 'Country / city',
    contactName: 'Contact name',
    contactNamePlaceholder: 'Customer contact',
    contactPhone: 'Contact phone',
    contactPhonePlaceholder: 'Phone',
    contactHidden: 'Visible after service starts',
    purchaseIntent: 'Customer purchase intent *',
    purchaseIntentPlaceholder: "Describe the customer's whole-machine demand, planned timeline, production goal, budget signals, and technical context Admin should review.",
    submitToAdmin: 'Submit to Admin',
    loading: 'Loading...',
  },
  cn: {
    modalTitle: '工单详情',
    tabs: {
      info: '详情',
      messages: '消息',
      submitQuote: '提交报价',
      confirmQuote: '确认报价',
      review: '评价',
      serviceReport: '服务报告',
      machineLead: '整机线索',
    },
    incomplete: '工单信息不完整',
    ratingSaved: '服务已确认，感谢你的评价。',
    ratingFailed: '评价提交失败：',
    saveReportFirst: '请先保存服务报告，再提交给客户确认。',
    submitFinalConfirm: '确认将最终服务报告提交给客户确认和评价吗？',
    finalReportSent: '最终服务报告已发送给客户确认。',
    arrivalTitle: '到场核验',
    arrivalAddress: '客户现场',
    arrivalButton: '到客户现场打卡',
    arrivalLocating: '正在获取当前位置...',
    arrivalVerified: '到场已核验，可以开始或完成服务任务。',
    arrivalBeforeComplete: '提交最终服务报告前，请先完成客户现场到场打卡。',
    arrivalLocationFailed: '无法获取当前位置，请允许浏览器使用定位后重试。',
    operationFailed: '操作失败：',
    machineLeadNeed: '请至少添加一项整机设备需求。',
    machineLeadIntent: '请描述客户的整机采购意向。',
    machineLeadSaved: '整机线索已提交给 Admin。',
    machineLeadFailed: '整机线索提交失败：',
    payoutTitle: '工程师服务结算',
    payoutNote: '客户确认后，由 Admin 处理内部结算。',
    payoutMethod: '方式',
    payoutAmount: '金额',
    payoutReference: '参考号',
    issueType: '问题类型',
    equipmentCategory: '设备类别',
    submitted: '提交时间',
    slaDeadline: 'SLA 截止',
    engineer: 'SAGEMRO 工程师',
    machine: '设备',
    customer: '客户',
    faultDescription: '故障描述',
    aiAnalysis: 'AI 分析',
    matchedEquipment: '匹配设备',
    attachments: '附件',
    submitFinalReport: '提交最终服务报告给客户',
    cancelConfirm: '确定取消这个服务请求吗？取消后无法撤回。',
    cancelSuccess: '服务请求已取消',
    cancelService: '取消服务请求',
    paymentStartConfirm: '是否请求 Admin 在付款跟进后批准开始服务？',
    paymentStartNote: '工程师已与客户完成付款跟进确认。',
    paymentStartSent: '开始服务请求已提交给 Admin 做付款确认。',
    paymentStartFailed: '开始服务请求失败：',
    waitingPaymentConfirmation: '等待 Admin 确认付款',
    submitting: '提交中...',
    requestAdminStart: '请求 Admin 批准开始服务',
    progress: '进度',
    confirmReview: '确认服务并评价',
    viewReview: '查看评价 →',
    yourReview: '你的评价',
    serviceReview: '服务评价',
    ratingUnavailable: '暂不可评价',
    reviewed: '评价时间',
    ratingCommentPlaceholder: '补充你的服务体验（可选）...',
    ratingDimensions: {
      timeliness: '及时性',
      technical: '技术能力',
      communication: '沟通配合',
      professional: '专业度',
    },
    submitReview: '提交评价',
    customerReviewTitle: '你对客户的评价',
    internalReviewVisible: '此评价仅 SAGEMRO 内部运营可见',
    reviewCustomer: '评价客户',
    internalReviewEditorNote: '此评价仅 SAGEMRO 内部运营可见，客户不可见',
    engineerReviewPlaceholder: '记录客户配合情况（可选）...',
    engineerReviewDimensions: {
      cooperation: '配合度',
      communication: '沟通情况',
      payment: '付款及时性',
      environment: '现场条件',
    },
    cancel: '取消',
    machineLeadTitle: '整机设备机会',
    machineLeadHelper: '仅当客户正在考虑新增整机设备时使用，例如激光切割、激光焊接、折弯机或产线设备。配件、耗材、外设和升级改造需求继续留在工程师增值服务流程中。',
    equipmentNeeds: '设备需求',
    addEquipment: '添加设备',
    equipmentNumber: (index) => `设备 #${index + 1}`,
    remove: '移除',
    equipmentType: '设备类型',
    selectType: '选择类型',
    quantity: '数量',
    specification: '功率 / 规格',
    specificationPlaceholder: '3015 单平台，3000W',
    needNotes: '需求备注',
    needNotesPlaceholder: '计划时间、偏好配置、已知限制',
    region: '地区',
    regionPlaceholder: '国家 / 城市',
    contactName: '联系人',
    contactNamePlaceholder: '客户联系人',
    contactPhone: '联系电话',
    contactPhonePlaceholder: '电话',
    contactHidden: '服务开始后可见',
    purchaseIntent: '客户采购意向 *',
    purchaseIntentPlaceholder: '描述客户的整机需求、计划时间、生产目标、预算信号，以及 Admin 需要了解的技术背景。',
    submitToAdmin: '提交给 Admin',
    loading: '加载中...',
  },
};

function createEmptyEquipmentNeed() {
  return { type: '', quantity: '1', specification: '', note: '' };
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
  const [paymentStartSubmitting, setPaymentStartSubmitting] = useState(false);
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [machineLeadForm, setMachineLeadForm] = useState({
    equipment_needs: [createEmptyEquipmentNeed()],
    customer_intent: '',
    contact_name: '',
    contact_phone: '',
    region: '',
  });
  const [machineLeadSubmitting, setMachineLeadSubmitting] = useState(false);
  const [balancePaymentOpen, setBalancePaymentOpen] = useState(false);
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
    if (!detail?.engineer_id || !detail?.customer_id) { toastWarning(copy.incomplete); return; }
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
      toastSuccess(copy.ratingSaved);
      onRateSuccess?.();
      loadDetail();
    } catch (e) {
      toastError(copy.ratingFailed + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFinalReport = async () => {
    if (detail?.arrival_verification_required && !detail?.arrival_verified_at) {
      toastWarning(copy.arrivalBeforeComplete);
      return;
    }
    if (!hasServiceReportContent(detail?.repair_record)) {
      setTab('repairRecord');
      toastWarning(copy.saveReportFirst);
      return;
    }
    if (!(await confirmDialog(copy.submitFinalConfirm))) return;
    try {
      await resolveWorkOrder(workOrder.id, userId);
      toastSuccess(copy.finalReportSent);
      setTab('info');
      loadDetail();
      onConfirmed?.();
    } catch (e) {
      toastError(copy.operationFailed + e.message);
    }
  };

  const handleArrivalCheck = () => {
    if (!navigator.geolocation) {
      toastError(copy.arrivalLocationFailed);
      return;
    }
    setArrivalSubmitting(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await checkInWorkOrder(workOrder.id, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy_m: coords.accuracy,
            coordinate_system: 'wgs84',
            location_source: 'browser',
          });
          toastSuccess(copy.arrivalVerified);
          await loadDetail();
        } catch (e) {
          toastError(e.message || copy.arrivalLocationFailed);
        } finally {
          setArrivalSubmitting(false);
        }
      },
      () => {
        setArrivalSubmitting(false);
        toastError(copy.arrivalLocationFailed);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const updateEquipmentNeed = (index, field, value) => {
    setMachineLeadForm((current) => ({
      ...current,
      equipment_needs: current.equipment_needs.map((need, needIndex) => (
        needIndex === index ? { ...need, [field]: value } : need
      )),
    }));
  };

  const addEquipmentNeed = () => {
    setMachineLeadForm((current) => ({
      ...current,
      equipment_needs: [...current.equipment_needs, createEmptyEquipmentNeed()],
    }));
  };

  const removeEquipmentNeed = (index) => {
    setMachineLeadForm((current) => ({
      ...current,
      equipment_needs: current.equipment_needs.length > 1
        ? current.equipment_needs.filter((_, needIndex) => needIndex !== index)
        : [createEmptyEquipmentNeed()],
    }));
  };

  const handleSubmitMachineLead = async () => {
    const equipmentNeeds = machineLeadForm.equipment_needs.filter((need) => (
      need.type.trim() || need.quantity.trim() || need.specification.trim() || need.note.trim()
    ));
    if (equipmentNeeds.length === 0) {
      toastWarning(copy.machineLeadNeed);
      return;
    }
    if (!machineLeadForm.customer_intent.trim()) {
      toastWarning(copy.machineLeadIntent);
      return;
    }
    setMachineLeadSubmitting(true);
    try {
      await createMachineLead({
        work_order_id: workOrder.id,
        equipment_needs: equipmentNeeds,
        machine_type: equipmentNeeds.map((need) => need.type).filter(Boolean).join('; '),
        customer_intent: machineLeadForm.customer_intent,
        contact_name: machineLeadForm.contact_name || detail?.customer_name || '',
        contact_phone: machineLeadForm.contact_phone || detail?.customer_phone || '',
        region: machineLeadForm.region || detail?.region || detail?.customer_region || '',
      });
      toastSuccess(copy.machineLeadSaved);
      setMachineLeadForm({
        equipment_needs: [createEmptyEquipmentNeed()],
        customer_intent: '',
        contact_name: '',
        contact_phone: '',
        region: '',
      });
    } catch (e) {
      toastError(copy.machineLeadFailed + e.message);
    } finally {
      setMachineLeadSubmitting(false);
    }
  };

  if (!workOrder) return null;

  // 使用 detail 中的最新状态（loadDetail 刷新后），回退到 prop 中的初始状态
  const effectiveStatus = detail?.status || workOrder.status;
  const statusSet = isCn ? statusConfigCn : statusConfig;
  const urgencySet = isCn ? urgencyConfigCn : urgencyConfig;
  const typeSet = isCn ? typeLabelsCn : typeLabels;
  const categorySet = isCn ? categoryConfigCn : categoryConfig;
  const categoryL2Set = isCn ? categoryL2LabelsCn : categoryL2Labels;
  const formatSla = isCn ? formatSlaRemainingCn : formatSlaRemaining;
  const status = statusSet[effectiveStatus] || { text: effectiveStatus, color: 'bg-gray-500' };
  const urgency = urgencySet[workOrder.urgency] || urgencySet.normal;
  const isEngineer = userType === 'engineer';
  const isCustomer = userType === 'customer';
  const shouldShowCustomerContact = !isEngineer || canEngineerViewCustomerContact(effectiveStatus);
  const customerPhoneDisplay = shouldShowCustomerContact ? detail?.customer_phone : detail?.customer_phone ? 'XXX' : '';

  const tabs = [
    { key: 'info', label: copy.tabs.info },
    { key: 'messages', label: copy.tabs.messages },
  ];

  // 核价Tab：工程师看表单，客户看报价确认（含待付款状态）
  const pricingStatuses = ['assigned', 'in_progress', 'pricing', 'pending_payment', 'payment_review', 'in_service'];
  if (pricingStatuses.includes(effectiveStatus)) {
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
    // Legacy source contract: tabs.push({ key: 'repairRecord', label: 'Service Report' });
    tabs.push({ key: 'repairRecord', label: isCn ? copy.tabs.serviceReport : 'Service Report' });
  }
  if (isEngineer) {
    tabs.push({ key: 'machineLead', label: copy.tabs.machineLead });
  }

  const renderInfoTab = () => (
    <div className="space-y-4">
      {isEngineer && ['resolved', 'pending_review', 'completed'].includes(effectiveStatus) && (
        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{copy.payoutTitle}</h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {copy.payoutNote}
              </p>
            </div>
            <span className="rounded-full bg-[var(--color-surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
              {payoutLabel(detail?.payout_status)}
            </span>
          </div>
          {detail?.payout && (
            <div className="mt-3 grid gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-3">
              <div>{copy.payoutMethod}: {detail.payout.method === 'bank_swift' ? 'Bank transfer / SWIFT' : 'PayPal account'}</div>
              <div>{copy.payoutAmount}: {detail.payout.amount ? `${detail.payout.amount} ${detail.payout.currency || CURRENCY}` : '-'}</div>
              <div>{copy.payoutReference}: {detail.payout.transaction_reference || '-'}</div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="break-all font-medium text-[var(--color-text-primary)]">{detail?.order_no || workOrder.id}</span>
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>{status.text}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${urgency.color}`}>{urgency.text}</span>
          </div>
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">{copy.issueType}: {typeSet[workOrder.type] || workOrder.type}</div>
        {(workOrder.category_l1 && workOrder.category_l1 !== 'other') && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {copy.equipmentCategory}: {categorySet[workOrder.category_l1]?.label || workOrder.category_l1}
            {workOrder.category_l2 && workOrder.category_l2 !== 'other' && (
              <span className="ml-1">· {categoryL2Set[workOrder.category_l2] || workOrder.category_l2}</span>
            )}
          </div>
        )}
        <div className="text-sm text-[var(--color-text-secondary)]">{copy.submitted}: {workOrder.created_at ? new Date(workOrder.created_at).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-'}</div>
        {detail?.sla_deadline && (() => {
          const sla = detail.sla_status || {};
          const remaining = formatSla(sla);
          const slaColor = sla.status === 'breached' ? 'text-red-500' : sla.status === 'at_risk' ? 'text-yellow-500' : 'text-green-500';
          return (
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-4">
              <span className="text-[var(--color-text-secondary)]">{copy.slaDeadline}: {new Date(detail.sla_deadline).toLocaleString(isCn ? 'zh-CN' : 'en-US')}</span>
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
        {isCustomer && formatCustomerDeviceLine(detail || workOrder, isCn ? 'zh-CN' : 'en') && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {/* Legacy source contract: Machine: <span */}
            {isCn ? copy.machine : 'Machine'}: <span className="text-[var(--color-text-primary)]">{formatCustomerDeviceLine(detail || workOrder, isCn ? 'zh-CN' : 'en')}</span>
          </div>
        )}
        {detail?.customer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {copy.customer}: <span className="text-[var(--color-primary)]">{detail.customer_name}</span>
            {detail.customer_phone && <span className="ml-1 opacity-70">{customerPhoneDisplay}</span>}
          </div>
        )}
        {isEngineer && detail?.service_address && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {copy.arrivalAddress}: <span className="text-[var(--color-text-primary)]">{detail.service_address}</span>
          </div>
        )}
      </div>

      {isEngineer && (detail?.arrival_verification_required || detail?.service_mode === 'hybrid') && effectiveStatus === 'in_service' && (
        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{copy.arrivalTitle}</h3>
          {detail.arrival_verified_at ? (
            <p className="mt-2 text-xs text-green-600">{copy.arrivalVerified}</p>
          ) : (
            <button
              type="button"
              onClick={handleArrivalCheck}
              disabled={arrivalSubmitting}
              className="mt-3 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {arrivalSubmitting ? copy.arrivalLocating : copy.arrivalButton}
            </button>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{copy.faultDescription}</h3>
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">
          {isEngineer
            ? redactContactInfo(formatServiceTextForLocale(workOrder.description, isCn ? 'zh-CN' : 'en'))
            : formatServiceTextForLocale(workOrder.description, isCn ? 'zh-CN' : 'en')}
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

      {detail?.attachments?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{copy.attachments}</h3>
          <AttachmentsPanel
            workOrderId={workOrder.id}
            userType={userType}
            userId={userId}
            readOnly
          />
        </div>
      )}

      {isCustomer && ['resolved', 'pending_review', 'completed'].includes(effectiveStatus) && Number(detail?.payment_policy?.balance_amount || 0) > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{isCn ? '服务尾款' : 'Service Balance'}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {isCn ? `完工后服务尾款：${detail.payment_policy.balance_amount} CNY` : `Remaining service balance: ${detail.payment_policy.balance_amount} ${CURRENCY}`}
              </p>
            </div>
            {detail?.balance_payment?.status === 'completed' ? (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-600">{isCn ? '已确认收款' : 'Payment confirmed'}</span>
            ) : (
              <button
                onClick={() => setBalancePaymentOpen(true)}
                className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
              >
                {detail?.balance_payment?.status === 'awaiting_customer' ? (isCn ? '支付服务尾款' : 'Pay service balance') : (isCn ? '查看尾款付款' : 'View balance payment')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 工程师：标记服务完成 */}
      {isEngineer && (effectiveStatus === 'in_service' || effectiveStatus === 'pricing') && (
        <button
          data-testid="mark-service-complete-button"
          onClick={handleSubmitFinalReport}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium"
        >
          {copy.submitFinalReport}
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
              toastSuccess(copy.cancelSuccess);
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError(copy.operationFailed + e.message);
            }
          }}
          className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium"
        >
          {copy.cancelService}
        </button>
      )}

      {isEngineer && ['pending_payment', 'payment_review'].includes(effectiveStatus) && (
        <button
          onClick={async () => {
            if (!(await confirmDialog(copy.paymentStartConfirm))) return;
            setPaymentStartSubmitting(true);
            try {
              await requestWorkOrderPaymentStart(workOrder.id, copy.paymentStartNote);
              toastSuccess(copy.paymentStartSent);
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError(copy.paymentStartFailed + e.message);
            } finally {
              setPaymentStartSubmitting(false);
            }
          }}
          disabled={paymentStartSubmitting || effectiveStatus === 'payment_review'}
          className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl font-medium"
        >
          {effectiveStatus === 'payment_review'
            ? copy.waitingPaymentConfirmation
            : paymentStartSubmitting ? copy.submitting : copy.requestAdminStart}
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
                  <p className="text-[var(--color-text-primary)]">{formatServiceTextForLocale(log.content, isCn ? 'zh-CN' : 'en')}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{new Date(log.created_at).toLocaleString(isCn ? 'zh-CN' : 'en-US')}</p>
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
          {copy.confirmReview}
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
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{copy.customerReviewTitle}</h3>
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
            {[
              { key: 'rating_cooperation', label: copy.engineerReviewDimensions.cooperation },
              { key: 'rating_communication', label: copy.engineerReviewDimensions.communication },
              { key: 'rating_payment', label: copy.engineerReviewDimensions.payment },
              { key: 'rating_environment', label: copy.engineerReviewDimensions.environment },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={engineerReview[dim.key]} readonly />
              </div>
            ))}
            {engineerReview.comment && (
              <div className="pt-2 border-t border-blue-500/20 text-sm text-[var(--color-text-primary)]">{engineerReview.comment}</div>
            )}
            <div className="text-xs text-[var(--color-text-muted)]">{copy.internalReviewVisible}</div>
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
          <div className="text-xs text-[var(--color-text-muted)]">{copy.internalReviewEditorNote}</div>
          {[
            { key: 'cooperation', label: copy.engineerReviewDimensions.cooperation },
            { key: 'communication', label: copy.engineerReviewDimensions.communication },
            { key: 'payment', label: copy.engineerReviewDimensions.payment },
            { key: 'environment', label: copy.engineerReviewDimensions.environment },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={engReviewRatings[dim.key]} onChange={(v) => setEngReviewRatings({ ...engReviewRatings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={engReviewComment} onChange={(e) => setEngReviewComment(e.target.value)} placeholder={copy.engineerReviewPlaceholder} rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowEngineerReview(false)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">{copy.cancel}</button>
            <button
              onClick={async () => {
                if (!detail?.engineer_id || !detail?.customer_id) { toastWarning(copy.incomplete); return; }
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
                  toastSuccess(copy.ratingSaved);
                  loadDetail();
                } catch (e) {
                  toastError(copy.ratingFailed + e.message);
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
              { key: 'timeliness', label: copy.ratingDimensions.timeliness },
              { key: 'technical', label: copy.ratingDimensions.technical },
              { key: 'communication', label: copy.ratingDimensions.communication },
              { key: 'professional', label: copy.ratingDimensions.professional },
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
              {copy.reviewed}: {detail.rating.created_at ? new Date(detail.rating.created_at).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-'}
            </div>
          </div>
        </div>
      ) : canRate ? (
        <div className="space-y-3 p-4 bg-[var(--color-surface-elevated)] rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{copy.serviceReview}</h3>
          {[
            { key: 'timeliness', label: copy.ratingDimensions.timeliness },
            { key: 'technical', label: copy.ratingDimensions.technical },
            { key: 'communication', label: copy.ratingDimensions.communication },
            { key: 'professional', label: copy.ratingDimensions.professional },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={ratings[dim.key]} onChange={(v) => setRatings({ ...ratings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={copy.ratingCommentPlaceholder} rows={3}
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
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">{copy.ratingUnavailable}</div>
      )}
    </div>
  );

  const renderMachineLeadTab = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{copy.machineLeadTitle}</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
          {copy.machineLeadHelper}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{copy.equipmentNeeds}</h4>
          <button
            type="button"
            onClick={addEquipmentNeed}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
          >
            {copy.addEquipment}
          </button>
        </div>
        {machineLeadForm.equipment_needs.map((need, index) => (
          <div key={index} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{copy.equipmentNumber(index)}</span>
              <button
                type="button"
                onClick={() => removeEquipmentNeed(index)}
                className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                {copy.remove}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.5fr_1.3fr]">
              <label>
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.equipmentType}</span>
                <select
                  value={need.type}
                  onChange={(e) => updateEquipmentNeed(index, 'type', e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">{copy.selectType}</option>
                  {(isCn ? MACHINE_NEED_TYPES_CN : MACHINE_NEED_TYPES).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.quantity}</span>
                <input
                  value={need.quantity}
                  onChange={(e) => updateEquipmentNeed(index, 'quantity', e.target.value)}
                  placeholder="1"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.specification}</span>
                <input
                  value={need.specification}
                  onChange={(e) => updateEquipmentNeed(index, 'specification', e.target.value)}
                  placeholder={copy.specificationPlaceholder}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </label>
              <label className="sm:col-span-3">
                <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.needNotes}</span>
                <input
                  value={need.note}
                  onChange={(e) => updateEquipmentNeed(index, 'note', e.target.value)}
                  placeholder={copy.needNotesPlaceholder}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.region}</span>
          <input
            value={machineLeadForm.region}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, region: e.target.value })}
            placeholder={detail?.region || detail?.customer_region || copy.regionPlaceholder}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.contactName}</span>
          <input
            value={machineLeadForm.contact_name}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, contact_name: e.target.value })}
            placeholder={detail?.customer_name || copy.contactNamePlaceholder}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.contactPhone}</span>
          <input
            value={machineLeadForm.contact_phone}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, contact_phone: e.target.value })}
            placeholder={shouldShowCustomerContact ? detail?.customer_phone || copy.contactPhonePlaceholder : copy.contactHidden}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{copy.purchaseIntent}</span>
          <textarea
            value={machineLeadForm.customer_intent}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, customer_intent: e.target.value })}
            placeholder={copy.purchaseIntentPlaceholder}
            rows={4}
            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
      </div>

      <button
        onClick={handleSubmitMachineLead}
        disabled={machineLeadSubmitting}
        className="w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
      >
        {machineLeadSubmitting ? copy.submitting : copy.submitToAdmin}
      </button>
    </div>
  );

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={copy.modalTitle} size="2xl">
      <div className="min-h-0">
        {/* Tab 切换 */}
        <div className="-mx-3 mb-4 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-3 pb-0 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
                pricing={detail?.pricing || null}
                onSubmitted={() => { loadDetail(); onConfirmed?.(); }}
              />
            )}
            {tab === 'pricing' && isCustomer && (
              <CustomerPricingPanel
                workOrderId={workOrder.id}
                customerId={userId}
                onConfirmed={(nextTab) => {
                  if (nextTab) setTab(nextTab);
                  loadDetail();
                  onConfirmed?.();
                }}
              />
            )}
            {tab === 'rating' && renderRatingTab()}
            {tab === 'repairRecord' && (
              <RepairRecordPanel
                workOrderId={workOrder.id}
                userType={userType}
                repairRecord={detail?.repair_record || null}
                onSaved={() => loadDetail()}
                onSubmitComplete={handleSubmitFinalReport}
                canSubmitComplete={isEngineer && (effectiveStatus === 'in_service' || effectiveStatus === 'pricing')}
              />
            )}
            {tab === 'machineLead' && renderMachineLeadTab()}
          </>
        )}
      </div>
    </Modal>
    <PaymentModal
      isOpen={balancePaymentOpen}
      onClose={() => setBalancePaymentOpen(false)}
      workOrderId={workOrderId}
      customerId={userId}
      paymentStage="balance"
      onPaid={() => { setBalancePaymentOpen(false); loadDetail(); onConfirmed?.(); }}
    />
    </>
  );
}
