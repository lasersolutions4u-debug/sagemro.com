import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ChevronRight, Clock } from 'lucide-react';
import { WorkOrderStatus } from '../../types';
import { getWorkOrders, cancelWorkOrder } from '../../services/api';
import { toastSuccess, toastError, confirmDialog } from '../../utils/feedback';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { formatSlaRemaining, categoryConfig, categoryL2Labels } from '../../data/workOrderConfig';
import { isCnLocale } from '../../utils/locale';

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
  en: {
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
  },
  cn: {
    [WorkOrderStatus.PENDING]: { text: '待处理', color: 'bg-blue-500' },
    [WorkOrderStatus.ASSIGNED]: { text: '已分配', color: 'bg-blue-400' },
    [WorkOrderStatus.IN_PROGRESS]: { text: '处理中', color: 'bg-yellow-500' },
    [WorkOrderStatus.PRICING]: { text: '待报价', color: 'bg-orange-500' },
    [WorkOrderStatus.IN_SERVICE]: { text: '服务中', color: 'bg-purple-500' },
    [WorkOrderStatus.RESOLVED]: { text: '已解决', color: 'bg-green-500' },
    [WorkOrderStatus.PENDING_REVIEW]: { text: '待评价', color: 'bg-teal-500' },
    [WorkOrderStatus.COMPLETED]: { text: '已完成', color: 'bg-gray-500' },
    [WorkOrderStatus.REJECTED]: { text: '已拒绝', color: 'bg-red-500' },
    [WorkOrderStatus.CANCELLED]: { text: '已取消', color: 'bg-gray-400' },
  },
};

const COPY = {
  cn: {
    title: '我的服务',
    loading: '加载中...',
    loadFailed: '加载失败',
    empty: '暂无服务请求',
    engineer: 'SAGEMRO 工程师',
    noDevice: '未指定设备',
    submitted: '提交时间',
    cancelConfirm: '确定要取消这个服务请求吗？此操作不可撤销。',
    cancelled: '服务请求已取消',
    operationFailed: '操作失败',
    cancel: '取消',
    rate: '评价',
    serviceStatus: '服务状态：',
  },
  en: {
    title: 'My Services',
    loading: 'Loading...',
    loadFailed: 'Failed to load',
    empty: 'No service requests found',
    engineer: 'SAGEMRO Engineer',
    noDevice: 'No device specified',
    submitted: 'Submitted',
    cancelConfirm: 'Are you sure you want to cancel this service request? This action cannot be undone.',
    cancelled: 'Service request cancelled',
    operationFailed: 'Operation failed',
    cancel: 'Cancel',
    rate: 'Rate',
    serviceStatus: 'Service Status:',
  },
};

const categoryCnLabels = {
  laser_cutting: '激光切割',
  bending: '折弯',
  punching: '冲压 / 冲床',
  welding: '焊接',
  surface_treatment: '表面处理',
  auxiliary: '辅助系统',
  cnc_automation: '数控与自动化',
  inspection: '检测与质检',
  other: '其他设备',
};

const categoryL2CnLabels = {
  mechanical_fault: '机械故障',
  electrical_fault: '电气故障',
  optical_fault: '光路 / 光束故障',
  hydraulic_fault: '液压系统故障',
  arc_fault: '电弧 / 焊接质量问题',
  wire_feeder_fault: '送丝机构故障',
  tooling_fault: '模具 / 刀具故障',
  compressor_fault: '空压机故障',
  chiller_fault: '冷水机 / 冷却故障',
  gas_generation: '制氮 / 制氧系统故障',
  power_supply: '电源 / 稳压系统故障',
  cnc_system: '数控系统故障',
  servo_drive: '伺服 / 驱动故障',
  robot_fault: '机器人故障',
  plc_fault: 'PLC / 自动化故障',
  sensor_fault: '传感器 / 检测故障',
  cooling_fault: '冷却系统故障',
  gas_fault: '气路 / 辅助气体故障',
  control_system: '控制系统故障',
  media_fault: '磨料 / 介质故障',
  dust_collection: '除尘 / 环保系统故障',
  calibration: '精度校准',
  software_fault: '软件 / 系统故障',
  general_fault: '一般故障',
  maintenance: '维护保养',
  parameter_debug: '参数调试',
  installation: '安装调试',
  consultation: '技术咨询',
  parts_replacement: '备件更换',
  other: '其他',
};

function formatDate(value, isCn) {
  return value ? new Date(value).toLocaleString(isCn ? 'zh-CN' : 'en-US') : '-';
}

function formatCategory(order, isCn) {
  if (!order.category_l1 || order.category_l1 === 'other') return order.type;
  const l1 = isCn
    ? categoryCnLabels[order.category_l1] || order.category_l1
    : categoryConfig[order.category_l1]?.label || order.category_l1;
  const l2 = order.category_l2 && order.category_l2 !== 'other'
    ? (isCn ? categoryL2CnLabels[order.category_l2] || order.category_l2 : categoryL2Labels[order.category_l2] || order.category_l2)
    : '';
  return l2 ? `${l1} · ${l2}` : l1;
}

function formatSlaText(sla, isCn) {
  if (!isCn) return formatSlaRemaining(sla);
  if (!sla || sla.remaining_seconds == null) return null;
  const seconds = sla.remaining_seconds;
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const prefix = sla.status === 'breached' ? '逾期 ' : '剩余 ';
  if (h > 0) return prefix + h + '小时' + (m > 0 ? m + '分钟' : '');
  if (m > 0) return prefix + m + '分钟';
  return sla.status === 'breached' ? '刚刚逾期' : '少于 1 分钟';
}

export function MyWorkOrdersModal({ isOpen, onClose }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const localizedStatusLabels = isCn ? statusLabels.cn : statusLabels.en;
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
      <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="md">
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              {copy.loading}
            </div>
          )}

          {error && (
            <div className="text-center py-4 text-red-500 text-sm">
              {copy.loadFailed}: {error}
            </div>
          )}

          {!loading && workOrders.length === 0 && !error && (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              {copy.empty}
            </div>
          )}

          {!loading && workOrders.map((order) => {
            const status = localizedStatusLabels[order.status] || localizedStatusLabels[WorkOrderStatus.PENDING];
            const sla = order.sla_status;
            const slaText = formatSlaText(sla, isCn);
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
                    {copy.engineer}: {order.engineer_name}
                  </p>
                )}
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                  {formatCategory(order, isCn)} | {order.device_id || copy.noDevice}
                </p>
                <p className="text-sm text-[var(--color-text-primary)] line-clamp-2">
                  {order.description}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {copy.submitted}: {formatDate(order.created_at, isCn)}
                  </p>
                  <div className="flex items-center gap-2">
                    {[WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.PRICING].includes(order.status) && (
                      <button
                        data-testid="cancel-work-order-list-button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!(await confirmDialog(copy.cancelConfirm, { danger: true }))) return;
                          try {
                            await cancelWorkOrder(order.id);
                            toastSuccess(copy.cancelled);
                            setWorkOrders((prev) =>
                              prev.map((wo) => wo.id === order.id ? { ...wo, status: WorkOrderStatus.CANCELLED } : wo)
                            );
                          } catch (err) {
                            toastError(`${copy.operationFailed}: ${err.message}`);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        {copy.cancel}
                      </button>
                    )}
                    {(order.status === WorkOrderStatus.PENDING_REVIEW || order.status === WorkOrderStatus.RESOLVED) && (
                      <button
                        data-testid="go-rate-button"
                        onClick={(e) => { e.stopPropagation(); handleViewDetail(order); }}
                        className="px-3 py-1.5 text-xs font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                      >
                        {copy.rate}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 图例（只显示客户相关状态） */}
          <div className="pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-secondary)] mb-2">{copy.serviceStatus}</p>
            <div className="flex flex-wrap gap-3">
              {customerStatuses.map((key) => {
                const val = localizedStatusLabels[key];
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
