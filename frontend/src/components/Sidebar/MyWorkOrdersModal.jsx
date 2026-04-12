import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ChevronRight } from 'lucide-react';
import { WorkOrderStatus } from '../../types';
import { getWorkOrders } from '../../services/api';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';

const statusLabels = {
  [WorkOrderStatus.PENDING]: { text: '待处理', color: 'bg-blue-500' },
  [WorkOrderStatus.PROCESSING]: { text: '处理中', color: 'bg-yellow-500' },
  [WorkOrderStatus.RESOLVED]: { text: '已解决', color: 'bg-green-500' },
  [WorkOrderStatus.COMPLETED]: { text: '已完成', color: 'bg-gray-500' },
};

export function MyWorkOrdersModal({ isOpen, onClose }) {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadWorkOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const customerId = localStorage.getItem('sagemro_customer_id') || 'guest';
        const data = await getWorkOrders(customerId);
        setWorkOrders(data.work_orders || []);
      } catch (e) {
        console.error('加载工单失败:', e);
        setError(e.message);
        const stored = localStorage.getItem('sagemro_workorders');
        if (stored) {
          setWorkOrders(JSON.parse(stored));
        }
      } finally {
        setLoading(false);
      }
    };

    loadWorkOrders();
  }, [isOpen]);

  const handleViewDetail = (order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleRateSuccess = () => {
    // 刷新工单列表
    const loadWorkOrders = async () => {
      try {
        const customerId = localStorage.getItem('sagemro_customer_id') || 'guest';
        const data = await getWorkOrders(customerId);
        setWorkOrders(data.work_orders || []);
      } catch (e) {
        console.error('刷新工单失败:', e);
      }
    };
    loadWorkOrders();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="我的工单" size="lg">
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-8 text-[#6b6375]">
              加载中...
            </div>
          )}

          {error && (
            <div className="text-center py-4 text-red-500 text-sm">
              加载失败: {error}
            </div>
          )}

          {!loading && workOrders.length === 0 && !error && (
            <div className="text-center py-8 text-[#6b6375]">
              暂无工单记录
            </div>
          )}

          {!loading && workOrders.map((order) => {
            const status = statusLabels[order.status] || statusLabels[WorkOrderStatus.PENDING];
            return (
              <div
                key={order.id}
                className="p-4 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl cursor-pointer hover:bg-[#e5e4e7] dark:hover:bg-[#3a3a4c] transition-colors"
                onClick={() => handleViewDetail(order)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[#08060d] dark:text-[#f3f4f6]">
                    {order.order_no || order.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>
                      {status.text}
                    </span>
                    <ChevronRight size={16} className="text-[#6b6375]" />
                  </div>
                </div>
                <p className="text-sm text-[#6b6375] mb-1">
                  {order.type} | {order.device_id || '未指定设备'}
                </p>
                <p className="text-sm text-[#08060d] dark:text-[#e0e0e0] line-clamp-2">
                  {order.description}
                </p>
                <p className="mt-2 text-xs text-[#6b6375]">
                  提交时间：{new Date(order.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
            );
          })}

          {/* 图例 */}
          <div className="pt-4 border-t border-[#e5e4e7] dark:border-[#3a3a4c]">
            <p className="text-xs text-[#6b6375] mb-2">工单状态图例：</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(statusLabels).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${val.color}`} />
                  <span className="text-xs text-[#6b6375]">{val.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 工单详情弹窗 */}
      <WorkOrderDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        workOrder={selectedOrder}
        onRateSuccess={handleRateSuccess}
      />
    </>
  );
}
