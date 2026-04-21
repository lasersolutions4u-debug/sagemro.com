import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Star } from 'lucide-react';
import { submitRating } from '../../services/api';

const ratingDimensions = [
  { key: 'timeliness', label: '时效性' },
  { key: 'technical', label: '技术熟练' },
  { key: 'communication', label: '沟通流畅' },
  { key: 'professional', label: '专业性' },
];

export function RatingModal({ isOpen, onClose, workOrder, onSuccess }) {
  const [ratings, setRatings] = useState({
    timeliness: 5,
    technical: 5,
    communication: 5,
    professional: 5,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!workOrder?.id || !workOrder?.engineer_id || !workOrder?.customer_id) {
      setError('工单信息不完整');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await submitRating({
        work_order_id: workOrder.id,
        engineer_id: workOrder.engineer_id,
        customer_id: workOrder.customer_id,
        rating_timeliness: ratings.timeliness,
        rating_technical: ratings.technical,
        rating_communication: ratings.communication,
        rating_professional: ratings.professional,
        comment: comment,
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.message);
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
              size={24}
              className={star <= value ? 'text-[var(--color-primary)] fill-[var(--color-primary)]' : 'text-gray-300'}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-[var(--color-text-secondary)]">{value}分</span>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="服务评价" size="sm">
      <div className="space-y-4">
        {/* 工单信息 */}
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
          <div className="text-sm text-[var(--color-text-primary)]">
            工单号：{workOrder?.order_no || workOrder?.id}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 评分维度 */}
        <div className="space-y-3">
          {ratingDimensions.map((dim) => (
            <div key={dim.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">{dim.label}</span>
              {renderStars(dim.key)}
            </div>
          ))}
        </div>

        {/* 评价备注 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            评价备注（选填）
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="分享您的服务体验..."
            rows={3}
            className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-text-muted)] text-white rounded-xl font-medium transition-colors"
        >
          {submitting ? '提交中...' : '提交评价'}
        </button>
      </div>
    </Modal>
  );
}
