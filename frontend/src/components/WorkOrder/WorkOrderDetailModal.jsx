import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import {
  getWorkOrder,
  submitRating,
  resolveWorkOrder,
  cancelWorkOrder,
  submitEngineerReview,
  getEngineerReview,
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
import { UpsellRequestModal } from '../Upsell/UpsellRequestModal';
import { isCnLocale } from '../../utils/locale';
import {
  derivePaymentSummary,
  deriveSafetyStage,
  parseAiSummary,
} from './workOrderDetailModel';

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

// ========== 主组件 ==========
export function WorkOrderDetailModal({ isOpen, onClose, workOrder, onRateSuccess, onConfirmed, userType, userId }) {
  const isCn = isCnLocale();
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
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [machineLeadForm, setMachineLeadForm] = useState({
    machine_type: '',
    customer_intent: '',
    contact_name: '',
    contact_phone: '',
    region: '',
  });
  const [machineLeadSubmitting, setMachineLeadSubmitting] = useState(false);
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
    if (!detail?.engineer_id || !detail?.customer_id) { toastWarning(isCn ? '工单信息不完整' : 'Work order information is incomplete'); return; }
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
      toastSuccess(isCn ? '服务已确认，感谢你的评价。' : 'Service confirmed. Thank you for the review.');
      onRateSuccess?.();
      loadDetail();
    } catch (e) {
      toastError((isCn ? '评价提交失败：' : 'Review submission failed: ') + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMachineLead = async () => {
    if (!machineLeadForm.customer_intent.trim()) {
      toastWarning(isCn ? '请填写客户整机采购意向。' : 'Please describe the customer whole-machine purchase intent.');
      return;
    }
    setMachineLeadSubmitting(true);
    try {
      await createMachineLead({
        work_order_id: workOrder.id,
        machine_type: machineLeadForm.machine_type,
        customer_intent: machineLeadForm.customer_intent,
        contact_name: machineLeadForm.contact_name || detail?.customer_name || '',
        contact_phone: machineLeadForm.contact_phone || detail?.customer_phone || '',
        region: machineLeadForm.region || detail?.region || detail?.customer_region || '',
      });
      toastSuccess(isCn ? '整机线索已提交到后台线索池。' : 'Machine lead submitted to the admin lead pool.');
      setMachineLeadForm({
        machine_type: '',
        customer_intent: '',
        contact_name: '',
        contact_phone: '',
        region: '',
      });
    } catch (e) {
      toastError((isCn ? '整机线索提交失败：' : 'Machine lead submission failed: ') + e.message);
    } finally {
      setMachineLeadSubmitting(false);
    }
  };

  if (!workOrder) return null;

  // 使用 detail 中的最新状态（loadDetail 刷新后），回退到 prop 中的初始状态
  const effectiveStatus = detail?.status || workOrder.status;
  const localizedStatusConfig = isCn ? statusConfigCn : statusConfig;
  const localizedUrgencyConfig = isCn ? urgencyConfigCn : urgencyConfig;
  const localizedTypeLabels = isCn ? typeLabelsCn : typeLabels;
  const localizedCategoryConfig = isCn ? categoryConfigCn : categoryConfig;
  const localizedCategoryL2Labels = isCn ? categoryL2LabelsCn : categoryL2Labels;
  const status = localizedStatusConfig[effectiveStatus] || { text: effectiveStatus, color: 'bg-gray-500' };
  const urgency = localizedUrgencyConfig[workOrder.urgency] || localizedUrgencyConfig.normal;
  const isEngineer = userType === 'engineer';
  const isCustomer = userType === 'customer';
  const parsedAiSummary = parseAiSummary(detail?.ai_summary);
  const safetyStage = deriveSafetyStage(detail || workOrder, parsedAiSummary);
  const paymentSummary = derivePaymentSummary(detail || workOrder, detail?.payment || null);

  const tabs = [
    { key: 'info', label: isCn ? '详情' : 'Details' },
    { key: 'messages', label: isCn ? '沟通记录' : 'Messages' },
  ];

  // 核价Tab：工程师看表单，客户看报价确认（含待付款状态）
  if (effectiveStatus === 'in_progress' || effectiveStatus === 'pricing' || effectiveStatus === 'pending_payment' || effectiveStatus === 'in_service') {
    tabs.push({ key: 'pricing', label: isEngineer ? (isCn ? '提交报价' : 'Submit Quote') : (isCn ? '确认报价' : 'Confirm Quote') });
  }

  // 评价Tab：客户对服务进行评价（resolved/pending_review 可评价，completed 查看已有评价）
  const canRate = effectiveStatus === 'resolved' || effectiveStatus === 'pending_review';
  const hasRating = detail?.rating;
  if (isCustomer && (canRate || (effectiveStatus === 'completed' && hasRating))) {
    tabs.push({ key: 'rating', label: isCn ? '评价' : 'Review' });
  }

  // 维修记录Tab：工程师在服务中及之后可见，客户在有记录时可见
  const hasRepairRecord = detail?.repair_record;
  const repairStatuses = ['in_service', 'pricing', 'resolved', 'pending_review', 'completed'];
  if ((isEngineer && repairStatuses.includes(effectiveStatus)) || (isCustomer && hasRepairRecord)) {
    tabs.push({ key: 'repairRecord', label: isCn ? '服务报告' : 'Service Report' });
  }
  if (isEngineer) {
    tabs.push({ key: 'machineLead', label: isCn ? '整机线索' : 'Machine Lead' });
  }

  // 附件Tab：工单已分配后可见；若 AI 对话图片已随工单带入，pending 阶段也要可查看。
  if (effectiveStatus !== 'pending' || detail?.attachments?.length > 0) {
    tabs.push({ key: 'attachments', label: isCn ? '附件' : 'Attachments' });
  }

  const renderSection = (title, children) => (
    <section className="rounded-xl bg-[var(--color-surface-elevated)] p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </section>
  );

  const renderInfoTab = () => (
    <div className="space-y-4">
      <div className="rounded-xl bg-[var(--color-surface-elevated)] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-[var(--color-text-primary)]">{detail?.order_no || workOrder.id}</span>
          <div className="flex gap-2">
            <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>{status.text}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${urgency.color}`}>{urgency.text}</span>
          </div>
        </div>
        {detail?.sla_deadline && (() => {
          const sla = detail.sla_status || {};
          const remaining = isCn ? formatSlaRemainingCn(sla) : formatSlaRemaining(sla);
          const slaColor = sla.status === 'breached' ? 'text-red-500' : sla.status === 'at_risk' ? 'text-yellow-500' : 'text-green-500';
          return (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[var(--color-text-secondary)]">
                {isCn ? '服务时限：' : 'SLA Deadline: '}{new Date(detail.sla_deadline).toLocaleString(isCn ? 'zh-CN' : 'en-US')}
              </span>
              {remaining && <span className={slaColor}>{remaining}</span>}
            </div>
          );
        })()}
      </div>

      {renderSection(isCn ? '客户问题' : 'Customer Issue', (
        <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
          <div>{isCn ? '问题类型：' : 'Issue Type: '}{localizedTypeLabels[workOrder.type] || workOrder.type || '-'}</div>
          <div className="rounded-lg bg-[var(--color-surface)] p-3 text-[var(--color-text-primary)]">
            {workOrder.description || (isCn ? '暂无服务描述' : 'No service description yet')}
          </div>
        </div>
      ))}

      {renderSection(isCn ? '设备信息' : 'Device Information', (
        <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
          <div>
            {isCn ? '设备类别：' : 'Equipment Category: '}
            {localizedCategoryConfig[workOrder.category_l1]?.label || workOrder.category_l1 || (isCn ? '待补充' : 'Pending')}
          </div>
          <div>
            {workOrder.category_l2 && workOrder.category_l2 !== 'other'
              ? (localizedCategoryL2Labels[workOrder.category_l2] || workOrder.category_l2)
              : (isCn ? '设备型号与历史记录待补充' : 'Model and service history pending')}
          </div>
        </div>
      ))}

      {parsedAiSummary && renderSection(isCn ? 'AI 初诊摘要' : 'AI Analysis', (
        <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
          {parsedAiSummary.summary && <p className="text-[var(--color-text-primary)]">{parsedAiSummary.summary}</p>}
          {parsedAiSummary.required_specialties?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {parsedAiSummary.required_specialties.map((item, index) => (
                <span key={`${item}-${index}`} className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">{item}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      {renderSection(isCn ? '安全风险' : 'Safety Risk', (
        <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
          <div className="font-medium text-[var(--color-text-primary)]">{safetyStage.label}</div>
          <div>{safetyStage.description}</div>
        </div>
      ))}

      {renderSection(isCn ? '派工信息' : 'Dispatch Information', (
        <div className="grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
          <div>{isCn ? '客户：' : 'Customer: '}{detail?.customer_name || '-'}</div>
          <div>{isCn ? '工程师：' : 'Engineer: '}{detail?.engineer_name || '-'}</div>
          <div>{isCn ? '提交时间：' : 'Submitted: '}{workOrder.created_at ? new Date(workOrder.created_at).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-'}</div>
          <div>{isCn ? '地区：' : 'Region: '}{detail?.customer_region || '-'}</div>
        </div>
      ))}

      {renderSection(isCn ? '配件准备' : 'Parts Preparation', (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {isCn ? '报价或服务报告中可引用物料库；找不到合适物料时，工程师可提交新增物料申请。' : 'Use material references in quote or service report. If a part is missing, submit a material request from the work order.'}
        </p>
      ))}

      {isEngineer && renderSection(isCn ? '增购与改造需求' : 'Upsell & Retrofit Need', (
        <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
          <p>
            {isCn
              ? '现场发现配件、易损件、周边设备、自动化改造或折弯模具需求时，可提交给 Admin 安排业务跟进。'
              : 'Capture field needs for parts, consumables, peripheral equipment, automation retrofit, or bending tooling.'}
          </p>
          <button
            type="button"
            onClick={() => setUpsellOpen(true)}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white"
          >
            {isCn ? '提交增购与改造需求' : 'Submit need'}
          </button>
        </div>
      ))}

      {renderSection(isCn ? '回款与确认' : 'Payment & Confirmation', (
        <div className="grid gap-2 sm:grid-cols-2">
          {paymentSummary.map((item) => (
            <div key={item.label} className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
              <div className="text-xs text-[var(--color-text-muted)]">{item.label}</div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.value}</div>
            </div>
          ))}
        </div>
      ))}

      {/* 工程师：标记服务完成 */}
      {isEngineer && (effectiveStatus === 'in_service' || effectiveStatus === 'pricing') && (
        <button
          data-testid="mark-service-complete-button"
          onClick={async () => {
            if (!hasServiceReportContent(detail?.repair_record)) {
              setTab('repairRecord');
              toastWarning(isCn ? '请先保存服务报告，再标记服务完成。' : 'Please save the service report before marking the service complete.');
              return;
            }
            if (!(await confirmDialog(isCn ? '确认服务报告已完整填写，现场工作已完成？' : 'Confirm that the service report is complete and the on-site work is finished?'))) return;
            try {
              await resolveWorkOrder(workOrder.id, userId);
              toastSuccess(isCn ? '服务报告已提交，等待客户确认。' : 'Service report submitted for customer confirmation.');
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError((isCn ? '操作失败：' : 'Operation failed: ') + e.message);
            }
          }}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium"
        >
          {isCn ? '标记服务完成' : 'Mark Service Complete'}
        </button>
      )}

      {/* 客户：取消工单 */}
      {isCustomer && ['pending', 'assigned', 'in_progress', 'pricing'].includes(effectiveStatus) && (
        <button
          data-testid="cancel-work-order-button"
          onClick={async () => {
            if (!(await confirmDialog(
              isCn ? '确认取消这条服务申请？此操作不可恢复。' : 'Are you sure you want to cancel this service request? This action cannot be undone.',
              { danger: true }
            ))) return;
            try {
              await cancelWorkOrder(workOrder.id);
              toastSuccess(isCn ? '服务申请已取消' : 'Service request cancelled');
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError((isCn ? '操作失败：' : 'Operation failed: ') + e.message);
            }
          }}
          className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium"
        >
          {isCn ? '取消服务申请' : 'Cancel Service Request'}
        </button>
      )}

      {detail?.logs?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{isCn ? '服务进度' : 'Progress'}</h3>
          <div className="space-y-2">
            {detail.logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                <div>
                  <p className="text-[var(--color-text-primary)]">{log.content}</p>
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
          {isCn ? '确认服务并评价' : 'Confirm Service & Review'}
        </button>
      )}
      {isCustomer && hasRating && (
        <button
          onClick={() => setTab('rating')}
          className="w-full py-2.5 text-sm text-[var(--color-primary)] hover:underline"
        >
          {isCn ? '查看评价 →' : 'View Review →'}
        </button>
      )}

      {/* 工程师评价客户（仅工程师可见） */}
      {isEngineer && (effectiveStatus === 'resolved' || effectiveStatus === 'completed' || effectiveStatus === 'pending_review') && engineerReview && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{isCn ? '你对客户协作的评价' : 'Your Review of the Customer'}</h3>
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
            {[
              { key: 'rating_cooperation', label: isCn ? '配合程度' : 'Cooperation' },
              { key: 'rating_communication', label: isCn ? '沟通效率' : 'Communication' },
              { key: 'rating_payment', label: isCn ? '付款配合' : 'Payment Timeliness' },
              { key: 'rating_environment', label: isCn ? '现场条件' : 'Site Conditions' },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={engineerReview[dim.key]} readonly />
              </div>
            ))}
            {engineerReview.comment && (
              <div className="pt-2 border-t border-blue-500/20 text-sm text-[var(--color-text-primary)]">{engineerReview.comment}</div>
            )}
            <div className="text-xs text-[var(--color-text-muted)]">{isCn ? '该评价仅 SAGEMRO 内部运营可见' : 'This review is only visible to SAGEMRO internal operations'}</div>
          </div>
        </div>
      )}

      {isEngineer && (effectiveStatus === 'resolved' || effectiveStatus === 'completed' || effectiveStatus === 'pending_review') && !engineerReview && !showEngineerReview && (
        <button onClick={() => setShowEngineerReview(true)} className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium">
          {isCn ? '评价客户协作' : 'Review Customer'}
        </button>
      )}

      {showEngineerReview && (
        <div className="space-y-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{isCn ? '评价客户协作' : 'Review Customer'}</h3>
          <div className="text-xs text-[var(--color-text-muted)]">{isCn ? '该评价仅 SAGEMRO 内部运营可见，客户不可见。' : 'This review is only visible to SAGEMRO internal operations, not to the customer'}</div>
          {[
            { key: 'cooperation', label: isCn ? '配合程度' : 'Cooperation' },
            { key: 'communication', label: isCn ? '沟通效率' : 'Communication' },
            { key: 'payment', label: isCn ? '付款配合' : 'Payment Timeliness' },
            { key: 'environment', label: isCn ? '现场条件' : 'Site Conditions' },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={engReviewRatings[dim.key]} onChange={(v) => setEngReviewRatings({ ...engReviewRatings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={engReviewComment} onChange={(e) => setEngReviewComment(e.target.value)} placeholder={isCn ? '记录客户协作情况（可选）...' : 'Note customer cooperation details (optional)...'} rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowEngineerReview(false)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">{isCn ? '取消' : 'Cancel'}</button>
            <button
              onClick={async () => {
                if (!detail?.engineer_id || !detail?.customer_id) { toastWarning(isCn ? '工单信息不完整' : 'Work order information is incomplete'); return; }
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
                  toastSuccess(isCn ? '评价已提交。' : 'Service confirmed. Thank you for the review.');
                  loadDetail();
                } catch (e) {
                  toastError((isCn ? '评价提交失败：' : 'Review submission failed: ') + e.message);
                } finally {
                  setEngReviewSubmitting(false);
                }
              }}
              disabled={engReviewSubmitting}
              className="flex-1 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl text-sm"
            >
              {engReviewSubmitting ? (isCn ? '提交中...' : 'Submitting...') : (isCn ? '提交评价' : 'Submit Review')}
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
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">{isCn ? '你的评价' : 'Your Review'}</h3>
          <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
            {[
              { key: 'timeliness', label: isCn ? '响应及时' : 'Timeliness' },
              { key: 'technical', label: isCn ? '技术能力' : 'Technical Skill' },
              { key: 'communication', label: isCn ? '沟通体验' : 'Communication' },
              { key: 'professional', label: isCn ? '专业形象' : 'Professionalism' },
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
              {isCn ? '评价时间：' : 'Reviewed: '}{detail.rating.created_at ? new Date(detail.rating.created_at).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-'}
            </div>
          </div>
        </div>
      ) : canRate ? (
        <div className="space-y-3 p-4 bg-[var(--color-surface-elevated)] rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{isCn ? '服务评价' : 'Service Review'}</h3>
          {[
            { key: 'timeliness', label: isCn ? '响应及时' : 'Timeliness' },
            { key: 'technical', label: isCn ? '技术能力' : 'Technical Skill' },
            { key: 'communication', label: isCn ? '沟通体验' : 'Communication' },
            { key: 'professional', label: isCn ? '专业形象' : 'Professionalism' },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={ratings[dim.key]} onChange={(v) => setRatings({ ...ratings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={isCn ? '简单说说这次服务体验（可选）...' : 'Share your service experience (optional)...'} rows={3}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
          <button
            data-testid="submit-rating-button"
            onClick={handleSubmitRating}
            disabled={submitting}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl font-medium"
          >
            {submitting ? (isCn ? '提交中...' : 'Submitting...') : (isCn ? '提交评价' : 'Submit Review')}
          </button>
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">{isCn ? '暂不能评价' : 'Review not available'}</div>
      )}
    </div>
  );

  const renderMachineLeadTab = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          {isCn ? '整机商机' : 'Whole-machine opportunity'}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
          {isCn
            ? '仅在客户考虑购买激光切割机、折弯机、整线等完整设备时使用。配件、耗材、外设和升级改造仍走工程师增值服务流程。'
            : 'Use this only when the customer is considering a new complete machine such as a laser cutting machine, press brake, or production line. Parts, consumables, peripherals, and retrofit opportunities stay in engineer value-added service workflows.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{isCn ? '设备类型' : 'Machine type'}</span>
          <input
            value={machineLeadForm.machine_type}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, machine_type: e.target.value })}
            placeholder={isCn ? '光纤激光切割机、折弯机...' : 'Fiber laser cutting machine, press brake...'}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{isCn ? '地区' : 'Region'}</span>
          <input
            value={machineLeadForm.region}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, region: e.target.value })}
            placeholder={detail?.region || detail?.customer_region || (isCn ? '国家 / 城市' : 'Country / city')}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{isCn ? '联系人' : 'Contact name'}</span>
          <input
            value={machineLeadForm.contact_name}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, contact_name: e.target.value })}
            placeholder={detail?.customer_name || (isCn ? '客户联系人' : 'Customer contact')}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{isCn ? '联系电话' : 'Contact phone'}</span>
          <input
            value={machineLeadForm.contact_phone}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, contact_phone: e.target.value })}
            placeholder={detail?.customer_phone || (isCn ? '客户电话' : 'Phone')}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-[var(--color-text-secondary)]">{isCn ? '客户整机采购意向 *' : 'Customer purchase intent *'}</span>
          <textarea
            value={machineLeadForm.customer_intent}
            onChange={(e) => setMachineLeadForm({ ...machineLeadForm, customer_intent: e.target.value })}
            placeholder={isCn ? '说明客户想买的整机设备、时间计划、产能目标和现场背景。' : "Describe the customer's whole-machine demand, planned timeline, production goal, and site context."}
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
        {machineLeadSubmitting ? (isCn ? '提交中...' : 'Submitting...') : (isCn ? '提交到后台整机线索池' : 'Submit to Admin Lead Pool')}
      </button>
    </div>
  );

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={isCn ? '工单详情' : 'Work Order Details'} size="md">
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
          <div className="text-center py-8 text-[var(--color-text-muted)]">{isCn ? '加载中...' : 'Loading...'}</div>
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
            {tab === 'machineLead' && renderMachineLeadTab()}
          </>
        )}
      </div>
    </Modal>
    <UpsellRequestModal
      isOpen={upsellOpen}
      onClose={() => setUpsellOpen(false)}
      context={{
        sourceType: 'work_order',
        workOrderId: workOrder.id,
        workOrderNo: detail?.order_no || workOrder.order_no || workOrder.id,
      }}
    />
    </>
  );
}
