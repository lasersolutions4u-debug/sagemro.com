import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Star } from 'lucide-react';
import { submitRating } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  en: {
    title: 'Confirm Service & Review',
    serviceNo: 'Service No',
    incomplete: 'Work order information is incomplete',
    commentLabel: 'Acceptance Comment (Optional)',
    commentPlaceholder: 'Confirm service result, remaining concerns, or follow-up needs...',
    submitting: 'Submitting...',
    submit: 'Confirm Service & Submit Review',
    dimensions: {
      timeliness: 'Response & Timeliness',
      technical: 'Problem Solving',
      communication: 'Communication',
      professional: 'SAGEMRO Service Standard',
    },
  },
  cn: {
    title: '确认服务并评价',
    serviceNo: '服务单号',
    incomplete: '工单信息不完整',
    commentLabel: '验收备注（可选）',
    commentPlaceholder: '记录服务结果、仍需关注的问题或后续需求...',
    submitting: '提交中...',
    submit: '确认服务并提交评价',
    dimensions: {
      timeliness: '响应及时性',
      technical: '问题解决能力',
      communication: '沟通配合',
      professional: 'SAGEMRO 服务规范',
    },
  },
};

export function RatingModal({ isOpen, onClose, workOrder, onSuccess }) {
  const copy = isCnLocale() ? COPY.cn : COPY.en;
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
      setError(copy.incomplete);
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
        <span className="ml-2 text-sm text-[var(--color-text-secondary)]">{value}</span>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="sm">
      <div className="space-y-4">
        {/* 工单信息 */}
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
          <div className="text-sm text-[var(--color-text-primary)]">
            {copy.serviceNo}: {workOrder?.order_no || workOrder?.id}
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
          {Object.entries(copy.dimensions).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
              {renderStars(key)}
            </div>
          ))}
        </div>

        {/* 评价备注 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {copy.commentLabel}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={copy.commentPlaceholder}
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
          {submitting ? copy.submitting : copy.submit}
        </button>
      </div>
    </Modal>
  );
}
