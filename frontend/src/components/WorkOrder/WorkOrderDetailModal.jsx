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

  // 附件Tab：工单已分配后可见；若 AI 对话图片已随工单带入，pending 阶段也要可查看。
  if (effectiveStatus !== 'pending' || detail?.attachments?.length > 0) {
    tabs.push({ key: 'attachments', label: isCn ? '附件' : 'Attachments' });
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
        <div className="text-sm text-[var(--color-text-secondary)]">{isCn ? '问题类型：' : 'Issue Type: '}{localizedTypeLabels[workOrder.type] || workOrder.type}</div>
        {(workOrder.category_l1 && workOrder.category_l1 !== 'other') && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {isCn ? '设备类别：' : 'Equipment Category: '}{localizedCategoryConfig[workOrder.category_l1]?.label || workOrder.category_l1}
            {workOrder.category_l2 && workOrder.category_l2 !== 'other' && (
              <span className="ml-1">· {localizedCategoryL2Labels[workOrder.category_l2] || workOrder.category_l2}</span>
            )}
          </div>
        )}
        <div className="text-sm text-[var(--color-text-secondary)]">
          {isCn ? '提交时间：' : 'Submitted: '}{workOrder.created_at ? new Date(workOrder.created_at).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-'}
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
        {detail?.engineer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {isCn ? 'SAGEMRO 工程师：' : 'SAGEMRO Engineer: '}<span className="text-[var(--color-primary)]">{detail.engineer_name}</span>
            {detail.engineer_phone && <span className="ml-1 opacity-70">{detail.engineer_phone}</span>}
          </div>
        )}
        {detail?.customer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {isCn ? '客户：' : 'Customer: '}<span className="text-[var(--color-primary)]">{detail.customer_name}</span>
            {detail.customer_phone && <span className="ml-1 opacity-70">{detail.customer_phone}</span>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{isCn ? '问题描述' : 'Fault Description'}</h3>
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">
          {workOrder.description}
        </div>
      </div>

      {detail?.ai_summary && (() => {
        let aiData;
        try { aiData = typeof detail.ai_summary === 'string' ? JSON.parse(detail.ai_summary) : detail.ai_summary; } catch { return null; }
        return (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{isCn ? 'AI 初诊摘要' : 'AI Analysis'}</h3>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-[var(--color-text-primary)] space-y-2">
              {aiData.summary && <p>{aiData.summary}</p>}
              {aiData.required_specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">{isCn ? '匹配能力：' : 'Matched Equipment:'}</span>
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

  return (
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
          </>
        )}
      </div>
    </Modal>
  );
}
