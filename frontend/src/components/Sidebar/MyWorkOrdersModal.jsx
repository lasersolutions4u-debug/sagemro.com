import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ChevronRight, Clock } from 'lucide-react';
import { WorkOrderStatus } from '../../types';
import { getWorkOrders, cancelWorkOrder } from '../../services/api';
import { toastSuccess, toastError, confirmDialog } from '../../utils/feedback';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { formatSlaRemaining, categoryConfig, categoryL2Labels } from '../../data/workOrderConfig';

// 客户侧需要关注的状态
const customerStatuses = [
  WorkOrderStatus.PENDING,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.PRICING,
  WorkOrderStatus.IN_SERVICE,
  WorkOrderStatus.RESOLVED,
  WorkOrderStatus.PENDING_REVIEW,
  WorkOrderStatus.COMPLETED,
];

const statusLabels = {
  [WorkOrderStatus.PENDING]: { text: 'Pending', color: 'bg-blue-500' },
  [WorkOrderStatus.ASSIGNED]: { text: 'Assigned', color: 'bg-blue-400' },
  [WorkOrderStatus.IN_PROGRESS]: { text: 'In Progress', color: 'bg-yellow-500' },
  [WorkOrderStatus.PRICING]: { text: 'Awaiting Quote', color: 'bg-orange-500' },
  [WorkOrderStatus.IN_SERVICE]: { text: 'In Service', color: 'bg-purple-500' },
  [WorkOrderStatus.RESOLVED]: { text: 'Resolved', color: 'bg-green-500' },
  [WorkOrderStatus.PENDING_REVIEW]: { text: 'Pending Review', color: 'bg-teal-500' },
  [WorkOrderStatus.COMPLETED]: { text: 'Completed', color: 'bg-gray-500' },
  [WorkOrderStatus.REJECTED]: { text: 'Rejected', color: 'bg-red-500' },
  [WorkOrderStatus.CANCELLED]: { text: 'Cancelled', color: 'bg-gray-400' },
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
    // 刷新服务任务列表
    const loadWorkOrders = async () => {
      try {
        const customerId = localStorage.getItem('sagemro_customer_id') || 'guest';
        const data = await getWorkOrders(customerId);
        setWorkOrders(data.work_orders || []);
      } catch (e) {
        console.error('刷新服务任务失败:', e);
      }
    };
    loadWorkOrders();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="My Services" size="md">
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              Loading...
            </div>
          )}

          {error && (
            <div className="text-center py-4 text-red-500 text-sm">
              Failed to load: {error}
            </div>
          )}

          {!loading && workOrders.length === 0 && !error && (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              No service requests found
            </div>
          )}

          {!loading && workOrders.map((order) => {
            const status = statusLabels[order.status] || statusLabels[WorkOrderStatus.PENDING];
            const sla = order.sla_status;
            const slaText = formatSlaRemaining(sla);
            const slaColors = {
              on_track: 'text-green-500',
              at_risk: 'text-yellow-500',
              breached: 'text-red-500',
            };
            const slaBg = {
              on_track: 'bg-green-500/10',
              at_risk: 'bg-yellow-500/10',
              breached: 'bg-red-500/10',
            };
            const activeStatuses = [
              WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED,
              WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.PRICING,
              WorkOrderStatus.IN_SERVICE, WorkOrderStatus.PENDING_PAYMENT,
            ];
            const showSla = sla && sla.remaining_seconds != null && activeStatuses.includes(order.status);
            return (
              <div
                key={order.id}
                className="p-4 bg-[var(--color-surface-elevated)] rounded-xl cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
                onClick={() => handleViewDetail(order)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {order.order_no || order.id}
                  </span>
                  <div className="flex items-center gap-2">
                    {showSla && (
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${slaColors[sla.status]} ${slaBg[sla.status]}`}>
                        <Clock size={10} />
                        {slaText}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${status.color}`}>
                      {status.text}
                    </span>
                    <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />
                  </div>
                </div>
                {order.engineer_name && (
                  <p className="text-xs text-[var(--color-primary)] mb-1">
                    SAGEMRO Engineer: {order.engineer_name}
                  </p>
                )}
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                  {order.category_l1 && order.category_l1 !== 'other'
                    ? `${categoryConfig[order.category_l1]?.label || order.category_l1}${order.category_l2 && order.category_l2 !== 'other' ? ' · ' + (categoryL2Labels[order.category_l2] || order.category_l2) : ''}`
                    : order.type} | {order.device_id || 'No device specified'}
                </p>
                <p className="text-sm text-[var(--color-text-primary)] line-clamp-2">
                  {order.description}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Submitted: {new Date(order.created_at).toLocaleString('en-US')}
                  </p>
                  <div className="flex items-center gap-2">
                    {[WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.PRICING].includes(order.status) && (
                      <button
                        data-testid="cancel-work-order-list-button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!(await confirmDialog('Are you sure you want to cancel this service request? This action cannot be undone.', { danger: true }))) return;
                          try {
                            await cancelWorkOrder(order.id);
                            toastSuccess('Service request cancelled');
                            setWorkOrders((prev) =>
                              prev.map((wo) => wo.id === order.id ? { ...wo, status: WorkOrderStatus.CANCELLED } : wo)
                            );
                          } catch (err) {
                            toastError('Operation failed: ' + err.message);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    {(order.status === WorkOrderStatus.PENDING_REVIEW || order.status === WorkOrderStatus.RESOLVED) && (
                      <button
                        data-testid="go-rate-button"
                        onClick={(e) => { e.stopPropagation(); handleViewDetail(order); }}
                        className="px-3 py-1.5 text-xs font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                      >
                        Rate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 图例（只显示客户相关状态） */}
          <div className="pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-secondary)] mb-2">Service Status:</p>
            <div className="flex flex-wrap gap-3">
              {customerStatuses.map((key) => {
                const val = statusLabels[key];
                return (
                  <div key={key} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${val.color}`} />
                    <span className="text-xs text-[var(--color-text-secondary)]">{val.text}</span>
                  </div>
                );
              })}
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
        onConfirmed={handleRateSuccess}
        userType="customer"
        userId={localStorage.getItem('sagemro_customer_id')}
      />
    </>
  );
}
