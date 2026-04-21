import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  getWorkOrder,
  submitRating,
  resolveWorkOrder,
  submitEngineerReview,
  getEngineerReview,
} from '../../services/api';
import { statusConfig, urgencyConfig, typeLabels } from '../../data/workOrderConfig.js';
import { toastSuccess, toastError, toastWarning, confirmDialog } from '../../utils/feedback';
import { Stars } from './Stars';
import { MessagePanel } from './MessagePanel';
import { EngineerPricingPanel, CustomerPricingPanel } from './PricingPanels';

// ========== 主组件 ==========
export function WorkOrderDetailModal({ isOpen, onClose, workOrder, onRateSuccess, onConfirmed, userType, userId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('info');
  const [showRating, setShowRating] = useState(false);
  const [ratings, setRatings] = useState({ timeliness: 5, technical: 5, communication: 5, professional: 5 });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 工程师评价客户
  const [showEngineerReview, setShowEngineerReview] = useState(false);
  const [engineerReview, setEngineerReview] = useState(null);
  const [engReviewRatings, setEngReviewRatings] = useState({ cooperation: 5, communication: 5, payment: 5, environment: 5 });
  const [engReviewComment, setEngReviewComment] = useState('');
  const [engReviewSubmitting, setEngReviewSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && workOrder?.id) {
      loadDetail();
      setTab('info');
    }
  }, [isOpen, workOrder]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await getWorkOrder(workOrder.id);
      setDetail(data);
      // 加载工程师评价
      if (userType === 'engineer') {
        try {
          const revData = await getEngineerReview(workOrder.id);
          setEngineerReview(revData.review);
        } catch {}
      }
    } catch (e) {
      console.error('加载工单详情失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!detail?.engineer_id || !detail?.customer_id) { toastWarning('工单信息不完整'); return; }
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
      setShowRating(false);
      toastSuccess('评价已提交');
      onRateSuccess?.();
      loadDetail();
    } catch (e) {
      toastError('评价提交失败: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!workOrder) return null;

  const status = statusConfig[workOrder.status] || { text: workOrder.status, color: 'bg-gray-500' };
  const urgency = urgencyConfig[workOrder.urgency] || urgencyConfig.normal;
  const isEngineer = userType === 'engineer';
  const isCustomer = userType === 'customer';

  const tabs = [
    { key: 'info', label: '工单信息' },
    { key: 'messages', label: '消息对话' },
  ];

  // 核价Tab：合伙人看表单，客户看报价确认
  if (workOrder.status === 'in_progress' || workOrder.status === 'pricing' || workOrder.status === 'in_service') {
    tabs.push({ key: 'pricing', label: isEngineer ? '核价' : '报价确认' });
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
        <div className="text-sm text-[var(--color-text-secondary)]">问题类型：{typeLabels[workOrder.type] || workOrder.type}</div>
        <div className="text-sm text-[var(--color-text-secondary)]">提交时间：{workOrder.created_at ? new Date(workOrder.created_at).toLocaleString('zh-CN') : '-'}</div>
        {detail?.engineer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            合伙人：<span className="text-[var(--color-primary)]">{detail.engineer_name}</span>
            {detail.engineer_phone && <span className="ml-1 opacity-70">{detail.engineer_phone}</span>}
          </div>
        )}
        {detail?.customer_name && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            客户：<span className="text-[var(--color-primary)]">{detail.customer_name}</span>
            {detail.customer_phone && <span className="ml-1 opacity-70">{detail.customer_phone}</span>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">问题描述</h3>
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-primary)]">
          {workOrder.description}
        </div>
      </div>

      {detail?.ai_summary && (() => {
        let aiData;
        try { aiData = typeof detail.ai_summary === 'string' ? JSON.parse(detail.ai_summary) : detail.ai_summary; } catch { return null; }
        return (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">AI 智能分析</h3>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-[var(--color-text-primary)] space-y-2">
              {aiData.summary && <p>{aiData.summary}</p>}
              {aiData.required_specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">匹配设备：</span>
                  {aiData.required_specialties.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 合伙人：标记服务完成 */}
      {isEngineer && (workOrder.status === 'in_service' || workOrder.status === 'pricing') && (
        <button
          onClick={async () => {
            if (!(await confirmDialog('确认服务已完成？'))) return;
            try {
              await resolveWorkOrder(workOrder.id, userId);
              toastSuccess('已标记服务完成，等待客户确认。');
              loadDetail();
              onConfirmed?.();
            } catch (e) {
              toastError('操作失败: ' + e.message);
            }
          }}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium"
        >
          标记服务完成
        </button>
      )}

      {detail?.logs?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">处理进度</h3>
          <div className="space-y-2">
            {detail.logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                <div>
                  <p className="text-[var(--color-text-primary)]">{log.content}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{new Date(log.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 评价区（resolved状态） */}
      {workOrder.status === 'resolved' && detail?.rating && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">您的评价</h3>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl space-y-2">
            {[
              { key: 'timeliness', label: '时效性' },
              { key: 'technical', label: '技术熟练' },
              { key: 'communication', label: '沟通流畅' },
              { key: 'professional', label: '专业性' },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={detail.rating[`rating_${dim.key}`]} readonly />
              </div>
            ))}
            {detail.rating.comment && (
              <div className="pt-2 border-t border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">{detail.rating.comment}</div>
            )}
          </div>
        </div>
      )}

      {workOrder.status === 'resolved' && !showRating && !detail?.rating && (
        <button onClick={() => setShowRating(true)} className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium">
          立即评价
        </button>
      )}

      {showRating && (
        <div className="space-y-3 p-4 bg-[var(--color-surface-elevated)] rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">服务评价</h3>
          {[
            { key: 'timeliness', label: '时效性' },
            { key: 'technical', label: '技术熟练' },
            { key: 'communication', label: '沟通流畅' },
            { key: 'professional', label: '专业性' },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={ratings[dim.key]} onChange={(v) => setRatings({ ...ratings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="分享服务体验（选填）..." rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowRating(false)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">取消</button>
            <button onClick={handleSubmitRating} disabled={submitting} className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl text-sm">
              {submitting ? '提交中...' : '提交评价'}
            </button>
          </div>
        </div>
      )}

      {/* 工程师评价客户（仅工程师可见） */}
      {isEngineer && (workOrder.status === 'resolved' || workOrder.status === 'completed' || workOrder.status === 'pending_review') && engineerReview && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">您对客户的评价</h3>
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
            {[
              { key: 'rating_cooperation', label: '配合度' },
              { key: 'rating_communication', label: '沟通顺畅' },
              { key: 'rating_payment', label: '付款及时' },
              { key: 'rating_environment', label: '现场环境' },
            ].map((dim) => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
                <Stars value={engineerReview[dim.key]} readonly />
              </div>
            ))}
            {engineerReview.comment && (
              <div className="pt-2 border-t border-blue-500/20 text-sm text-[var(--color-text-primary)]">{engineerReview.comment}</div>
            )}
            <div className="text-xs text-[var(--color-text-muted)]">此评价仅平台和合伙人可见</div>
          </div>
        </div>
      )}

      {isEngineer && (workOrder.status === 'resolved' || workOrder.status === 'completed' || workOrder.status === 'pending_review') && !engineerReview && !showEngineerReview && (
        <button onClick={() => setShowEngineerReview(true)} className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium">
          评价客户
        </button>
      )}

      {showEngineerReview && (
        <div className="space-y-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">评价客户</h3>
          <div className="text-xs text-[var(--color-text-muted)]">此评价仅平台和合伙人可见，客户不可见</div>
          {[
            { key: 'cooperation', label: '配合度' },
            { key: 'communication', label: '沟通顺畅' },
            { key: 'payment', label: '付款及时' },
            { key: 'environment', label: '现场环境' },
          ].map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{dim.label}</span>
              <Stars value={engReviewRatings[dim.key]} onChange={(v) => setEngReviewRatings({ ...engReviewRatings, [dim.key]: v })} />
            </div>
          ))}
          <textarea value={engReviewComment} onChange={(e) => setEngReviewComment(e.target.value)} placeholder="记录客户配合情况（选填）..." rows={2}
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowEngineerReview(false)} className="flex-1 py-2 bg-[var(--color-border)] text-[var(--color-text-secondary)] rounded-xl text-sm">取消</button>
            <button
              onClick={async () => {
                if (!detail?.engineer_id || !detail?.customer_id) { toastWarning('工单信息不完整'); return; }
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
                  toastSuccess('评价已提交');
                  loadDetail();
                } catch (e) {
                  toastError('评价提交失败: ' + e.message);
                } finally {
                  setEngReviewSubmitting(false);
                }
              }}
              disabled={engReviewSubmitting}
              className="flex-1 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-xl text-sm"
            >
              {engReviewSubmitting ? '提交中...' : '提交评价'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="工单详情" size="md">
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
          <div className="text-center py-8 text-[var(--color-text-muted)]">加载中...</div>
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
          </>
        )}
      </div>
    </Modal>
  );
}
