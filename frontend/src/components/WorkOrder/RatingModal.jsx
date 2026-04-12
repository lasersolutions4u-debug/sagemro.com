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
              className={star <= value ? 'text-[#f59e0b] fill-[#f59e0b]' : 'text-gray-300'}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-[#6b6375]">{value}分</span>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="服务评价" size="md">
      <div className="space-y-4">
        {/* 工单信息 */}
        <div className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
          <div className="text-sm text-[#08060d] dark:text-[#f3f4f6]">
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
              <span className="text-sm text-[#08060d] dark:text-[#f3f4f6]">{dim.label}</span>
              {renderStars(dim.key)}
            </div>
          ))}
        </div>

        {/* 评价备注 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-1">
            评价备注（选填）
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="分享您的服务体验..."
            rows={3}
            className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] resize-none"
          />
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
        >
          {submitting ? '提交中...' : '提交评价'}
        </button>
      </div>
    </Modal>
  );
}
