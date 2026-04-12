import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { WorkOrderStatus } from '../../types';

const statusLabels = {
  [WorkOrderStatus.PENDING]: { text: '待处理', color: 'bg-blue-500' },
  [WorkOrderStatus.PROCESSING]: { text: '处理中', color: 'bg-yellow-500' },
  [WorkOrderStatus.RESOLVED]: { text: '已解决', color: 'bg-green-500' },
  [WorkOrderStatus.CLOSED]: { text: '已关闭', color: 'bg-gray-500' },
};

export function MyWorkOrdersModal({ isOpen, onClose }) {
  const [workOrders, setWorkOrders] = useState([]);

  // 从 localStorage 加载工单（后续会从 API 获取）
  useEffect(() => {
    const stored = localStorage.getItem('sagemro_workorders');
    if (stored) {
      setWorkOrders(JSON.parse(stored));
    }
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="我的工单">
      <div className="space-y-3">
        {workOrders.length === 0 ? (
          <div className="text-center py-8 text-[#6b6375]">
            暂无工单记录
          </div>
        ) : (
          workOrders.map((order) => {
            const status = statusLabels[order.status] || statusLabels[WorkOrderStatus.PENDING];
            return (
              <div
                key={order.id}
                className="p-4 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[#08060d] dark:text-[#f3f4f6]">
                    {order.id}
                  </span>
                  <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>
                    {status.text}
                  </span>
                </div>
                <p className="text-sm text-[#6b6375] mb-1">
                  {order.type} | {order.device_model || '未指定设备'}
                </p>
                <p className="text-sm text-[#08060d] dark:text-[#e0e0e0] line-clamp-2">
                  {order.description}
                </p>
                <p className="mt-2 text-xs text-[#6b6375]">
                  提交时间：{new Date(order.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
            );
          })
        )}

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
  );
}
