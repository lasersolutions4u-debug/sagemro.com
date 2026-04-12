import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Star } from 'lucide-react';
import { getWorkOrder } from '../../services/api';
import { submitRating } from '../../services/api';
import { WorkOrderStatus } from '../../types';

const statusConfig = {
  [WorkOrderStatus.PENDING]: { text: '待处理', color: 'bg-blue-500' },
  [WorkOrderStatus.ASSIGNED]: { text: '已分配', color: 'bg-yellow-500' },
  [WorkOrderStatus.IN_PROGRESS]: { text: '处理中', color: 'bg-orange-500' },
  [WorkOrderStatus.RESOLVED]: { text: '已解决', color: 'bg-green-500' },
  [WorkOrderStatus.COMPLETED]: { text: '已完成', color: 'bg-gray-500' },
  [WorkOrderStatus.REJECTED]: { text: '已拒绝', color: 'bg-red-500' },
  [WorkOrderStatus.CANCELLED]: { text: '已取消', color: 'bg-gray-400' },
};

const urgencyConfig = {
  normal: { text: '普通', color: 'text-gray-500' },
  urgent: { text: '紧急', color: 'text-orange-500' },
  critical: { text: '非常紧急', color: 'text-red-500' },
};

const typeLabels = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '配件采购',
  aftersales: '售后服务',
  other: '其他',
};

export function WorkOrderDetailModal({ isOpen, onClose, workOrder, onRateSuccess }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratings, setRatings] = useState({
    timeliness: 5,
    technical: 5,
    communication: 5,
    professional: 5,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && workOrder?.id) {
      loadDetail();
    }
  }, [isOpen, workOrder]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await getWorkOrder(workOrder.id);
      setDetail(data);
    } catch (e) {
      console.error('加载工单详情失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!detail?.engineer_id || !detail?.customer_id) {
      alert('工单信息不完整');
      return;
    }

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
        comment: comment,
      });
      setShowRating(false);
      onRateSuccess?.();
      loadDetail();
    } catch (e) {
      alert('评价提交失败: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (dimension) => {
    const value = ratings[dimension];
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRatings({ ...ratings, [dimension]: star })}
            className="p-0.5 transition-colors"
          >
            <Star
              size={20}
              className={star <= value ? 'text-[#f59e0b] fill-[#f59e0b]' : 'text-gray-300'}
            />
          </button>
        ))}
      </div>
    );
  };

  if (!workOrder) return null;

  const status = statusConfig[workOrder.status] || statusConfig[WorkOrderStatus.PENDING];
  const urgency = urgencyConfig[workOrder.urgency] || urgencyConfig.normal;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="工单详情" size="lg">
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-[#6b6375]">加载中...</div>
        ) : detail ? (
          <>
            {/* 基本信息 */}
            <div className="p-4 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#08060d] dark:text-[#f3f4f6]">
                  {detail.order_no || detail.id}
                </span>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>
                    {status.text}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded ${urgency.color}`}>
                    {urgency.text}
                  </span>
                </div>
              </div>
              <div className="text-sm text-[#6b6375]">
                问题类型：{typeLabels[detail.type] || detail.type}
              </div>
              <div className="text-sm text-[#6b6375]">
                提交时间：{new Date(detail.created_at).toLocaleString('zh-CN')}
              </div>
            </div>

            {/* 问题描述 */}
            <div>
              <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">问题描述</h3>
              <div className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-sm text-[#08060d] dark:text-[#e0e0e0]">
                {detail.description}
              </div>
            </div>

            {/* AI 智能分析 */}
            {detail.ai_summary && (() => {
              let aiData = typeof detail.ai_summary === 'string'
                ? JSON.parse(detail.ai_summary)
                : detail.ai_summary;
              return (
                <div>
                  <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">AI 智能分析</h3>
                  <div className="p-3 bg-[#f59e0b]/10 dark:bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl space-y-2">
                    {aiData.summary && (
                      <p className="text-sm text-[#08060d] dark:text-[#e0e0e0]">{aiData.summary}</p>
                    )}
                    {aiData.required_specialties && aiData.required_specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-[#6b6375]">匹配设备类型：</span>
                        {aiData.required_specialties.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-[#f59e0b]/20 text-[#f59e0b] rounded">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {aiData.suggested_skills && aiData.suggested_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-[#6b6375]">建议技能：</span>
                        {aiData.suggested_skills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-[#2a2a3c] text-[#f59e0b] rounded">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {aiData.urgency_notes && (
                      <p className="text-xs text-orange-500">{aiData.urgency_notes}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 处理时间线 */}
            {detail.logs && detail.logs.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">处理进度</h3>
                <div className="space-y-2">
                  {detail.logs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-[#f59e0b]" />
                      <div className="flex-1">
                        <p className="text-[#08060d] dark:text-[#e0e0e0]">{log.content}</p>
                        <p className="text-xs text-[#6b6375]">
                          {new Date(log.created_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 已评价显示 */}
            {detail.status === 'completed' && detail.rating && (
              <div>
                <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">您的评价</h3>
                <div className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b6375]">时效性</span>
                    <span className="text-[#f59e0b]">{'★'.repeat(detail.rating.rating_timeliness)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b6375]">技术熟练</span>
                    <span className="text-[#f59e0b]">{'★'.repeat(detail.rating.rating_technical)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b6375]">沟通流畅</span>
                    <span className="text-[#f59e0b]">{'★'.repeat(detail.rating.rating_communication)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b6375]">专业性</span>
                    <span className="text-[#f59e0b]">{'★'.repeat(detail.rating.rating_professional)}</span>
                  </div>
                  {detail.rating.comment && (
                    <div className="pt-2 border-t border-[#e5e4e7] dark:border-[#3a3a4c] text-sm text-[#08060d] dark:text-[#e0e0e0]">
                      {detail.rating.comment}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 评价按钮（resolved状态可评价） */}
            {detail.status === 'resolved' && !showRating && (
              <button
                onClick={() => setShowRating(true)}
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] text-white rounded-xl font-medium transition-colors"
              >
                立即评价
              </button>
            )}

            {/* 评价表单 */}
            {showRating && (
              <div className="space-y-3 p-4 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
                <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6]">服务评价</h3>
                {[
                  { key: 'timeliness', label: '时效性' },
                  { key: 'technical', label: '技术熟练' },
                  { key: 'communication', label: '沟通流畅' },
                  { key: 'professional', label: '专业性' },
                ].map((dim) => (
                  <div key={dim.key} className="flex items-center justify-between">
                    <span className="text-sm text-[#6b6375]">{dim.label}</span>
                    {renderStars(dim.key)}
                  </div>
                ))}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="分享您的服务体验（选填）..."
                  rows={2}
                  className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] resize-none text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRating(false)}
                    className="flex-1 py-2 bg-[#e5e4e7] dark:bg-[#3a3a4c] text-[#6b6375] rounded-xl text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitRating}
                    disabled={submitting}
                    className="flex-1 py-2 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl text-sm"
                  >
                    {submitting ? '提交中...' : '提交评价'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
