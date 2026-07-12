import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Star } from 'lucide-react';
import { submitEngineerReview } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  en: {
    title: 'Review Customer',
    orderNo: 'Order No',
    internalOnly: 'This review is only visible to SAGEMRO internal operations, not to the customer',
    incomplete: 'Work order information is incomplete',
    commentLabel: 'Comment (Optional)',
    commentPlaceholder: 'Record customer cooperation, site conditions, etc...',
    submitting: 'Submitting...',
    submit: 'Submit Review',
    dimensions: {
      cooperation: 'Cooperation',
      communication: 'Communication',
      payment: 'Payment Timeliness',
      environment: 'Site Conditions',
    },
  },
  cn: {
    title: '评价客户配合',
    orderNo: '工单号',
    internalOnly: '此评价仅供 SAGEMRO 内部运营查看，不向客户展示',
    incomplete: '工单信息不完整',
    commentLabel: '备注（可选）',
    commentPlaceholder: '记录客户配合、付款沟通、现场条件等情况...',
    submitting: '提交中...',
    submit: '提交评价',
    dimensions: {
      cooperation: '配合程度',
      communication: '沟通情况',
      payment: '付款及时性',
      environment: '现场条件',
    },
  },
};

export function EngineerReviewModal({ isOpen, onClose, workOrder, onSuccess }) {
  const copy = isCnLocale() ? COPY.cn : COPY.en;
  const [ratings, setRatings] = useState({
    cooperation: 5,
    communication: 5,
    payment: 5,
    environment: 5,
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
      await submitEngineerReview(workOrder.id, {
        engineer_id: workOrder.engineer_id,
        customer_id: workOrder.customer_id,
        rating_cooperation: ratings.cooperation,
        rating_communication: ratings.communication,
        rating_payment: ratings.payment,
        rating_environment: ratings.environment,
        comment,
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
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
          <div className="text-sm text-[var(--color-text-primary)]">
            {copy.orderNo}: {workOrder?.order_no || workOrder?.id}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">
            {copy.internalOnly}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {Object.entries(copy.dimensions).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
              {renderStars(key)}
            </div>
          ))}
        </div>

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
