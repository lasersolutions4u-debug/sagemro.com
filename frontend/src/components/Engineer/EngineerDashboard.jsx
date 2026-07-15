import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Clock } from 'lucide-react';
import { getEngineerTickets, acceptTicket, rejectTicket, updateEngineerStatus } from '../../services/api';
import { WorkOrderStatus } from '../../types';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { formatSlaRemaining, formatSlaRemainingCn, categoryConfig, categoryConfigCn, categoryL2Labels, categoryL2LabelsCn } from '../../data/workOrderConfig';
import { isCnLocale } from '../../utils/locale';

const statusConfig = {
  [WorkOrderStatus.PENDING]: { text: 'Pending Dispatch', color: 'bg-blue-500', textColor: 'text-blue-500' },
  [WorkOrderStatus.ASSIGNED]: { text: 'Assigned', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  [WorkOrderStatus.IN_PROGRESS]: { text: 'In Progress', color: 'bg-orange-500', textColor: 'text-orange-500' },
  [WorkOrderStatus.PRICING]: { text: 'Awaiting Pricing', color: 'bg-purple-500', textColor: 'text-purple-500' },
  [WorkOrderStatus.IN_SERVICE]: { text: 'In Service', color: 'bg-cyan-500', textColor: 'text-cyan-500' },
  [WorkOrderStatus.RESOLVED]: { text: 'Resolved', color: 'bg-green-500', textColor: 'text-green-500' },
  [WorkOrderStatus.PENDING_REVIEW]: { text: 'Pending Review', color: 'bg-teal-500', textColor: 'text-teal-500' },
  [WorkOrderStatus.COMPLETED]: { text: 'Completed', color: 'bg-gray-500', textColor: 'text-gray-500' },
};

const statusConfigCn = {
  [WorkOrderStatus.PENDING]: { text: '待派工', color: 'bg-blue-500', textColor: 'text-blue-500' },
  [WorkOrderStatus.ASSIGNED]: { text: '已派工', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  [WorkOrderStatus.IN_PROGRESS]: { text: '处理中', color: 'bg-orange-500', textColor: 'text-orange-500' },
  [WorkOrderStatus.PRICING]: { text: '待报价', color: 'bg-purple-500', textColor: 'text-purple-500' },
  [WorkOrderStatus.IN_SERVICE]: { text: '服务中', color: 'bg-cyan-500', textColor: 'text-cyan-500' },
  [WorkOrderStatus.RESOLVED]: { text: '待客户确认', color: 'bg-green-500', textColor: 'text-green-500' },
  [WorkOrderStatus.PENDING_REVIEW]: { text: '待评价', color: 'bg-teal-500', textColor: 'text-teal-500' },
  [WorkOrderStatus.COMPLETED]: { text: '已完成', color: 'bg-gray-500', textColor: 'text-gray-500' },
};

const COPY = {
  en: {
    title: 'SAGEMRO Internal Engineer Workspace',
    viewProfile: 'View My Profile',
    profileHint: 'View your level and credit info in "My Profile"',
    availability: 'Availability Status',
    statusOptions: { available: 'Available', paused: 'Paused', offline: 'Offline' },
    assigned: 'Assigned',
    inProgress: 'In Progress',
    assignedTasks: 'Assigned Service Tasks',
    returnPrompt: 'Please enter the reason for returning this dispatch. It will be recorded for SAGEMRO operations.',
    urgent: 'Urgent',
    critical: 'Critical',
    customer: 'Customer',
    confirmAssignment: 'Confirm Assignment',
    returnDispatch: 'Return to Dispatch',
    empty: 'No service assignments to process',
    loading: 'Loading...',
  },
  cn: {
    title: 'SAGEMRO 工程师工作台',
    viewProfile: '查看我的资料',
    profileHint: '在“我的资料”中查看你的等级和信用信息',
    availability: '可服务状态',
    statusOptions: { available: '可接单', paused: '暂停接单', offline: '离线' },
    assigned: '已派工',
    inProgress: '处理中',
    assignedTasks: '已派工服务任务',
    returnPrompt: '请输入退回派工的原因，该原因会记录给 SAGEMRO 运营。',
    urgent: '紧急',
    critical: '高风险',
    customer: '客户',
    confirmAssignment: '接受派工',
    returnDispatch: '退回派工',
    empty: '暂无需要处理的服务派工',
    loading: '加载中...',
  },
};

export function EngineerDashboard({ isOpen, onClose, engineerId, onViewProfile }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const statuses = isCn ? statusConfigCn : statusConfig;
  const categories = isCn ? categoryConfigCn : categoryConfig;
  const categoryLabels = isCn ? categoryL2LabelsCn : categoryL2Labels;
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [engineerStatus, setEngineerStatus] = useState('available');
  const [actionLoading, setActionLoading] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEngineerTickets(engineerId);
      setTickets(data.work_orders || []);
    } catch (e) {
      console.error('加载工单失败:', e);
    } finally {
      setLoading(false);
    }
  }, [engineerId]);

  useEffect(() => {
    if (!isOpen || !engineerId) return;
    loadTickets();
  }, [isOpen, engineerId, loadTickets]);

  const handleAccept = async (ticketId) => {
    setActionLoading(ticketId);
    try {
      await acceptTicket({ work_order_id: ticketId, engineer_id: engineerId });
      await loadTickets();
    } catch (e) {
      console.error('确认派工失败:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (ticketId) => {
    const reason = window.prompt(copy.returnPrompt, '')?.trim();
    if (!reason) return;
    setActionLoading(ticketId);
    try {
      await rejectTicket({ work_order_id: ticketId, engineer_id: engineerId, reason });
      await loadTickets();
    } catch (e) {
      console.error('退回派工失败:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateEngineerStatus({ engineer_id: engineerId, status: newStatus });
      setEngineerStatus(newStatus);
    } catch (e) {
      console.error('状态更新失败:', e);
    }
  };

  // 分类服务任务
  const pendingTickets = tickets.filter(t => ['pending', 'assigned'].includes(t.status));
  const activeTickets = tickets.filter(t => !['pending', 'assigned'].includes(t.status));

  const renderSlaBadge = (ticket) => {
    const sla = ticket.sla_status;
    if (!sla || sla.remaining_seconds == null) return null;
    const text = isCn ? formatSlaRemainingCn(sla) : formatSlaRemaining(sla);
    const colors = {
      on_track: 'text-green-500 bg-green-500/10',
      at_risk: 'text-yellow-500 bg-yellow-500/10',
      breached: 'text-red-500 bg-red-500/10',
    };
    return (
      <span className={`flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded ${colors[sla.status] || ''}`}>
        <Clock size={10} />
        {text}
      </span>
    );
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="md">
      <div className="space-y-5">
        {/* 查看档案入口 */}
        <button
          onClick={onViewProfile}
          className="w-full py-2 px-4 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>{copy.viewProfile}</span>
        </button>

        {/* 工程师等级与信用分（免费模式，无钱包） */}
        <div className="p-4 bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl border border-[var(--color-primary)]/20">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-secondary)]">
              {copy.profileHint}
            </div>
          </div>
        </div>

        {/* 状态切换 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {copy.availability}
          </label>
          <div className="flex gap-2">
            {[
              { value: 'available', label: copy.statusOptions.available },
              { value: 'paused', label: copy.statusOptions.paused },
              { value: 'offline', label: copy.statusOptions.offline },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  engineerStatus === opt.value
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 今日概览 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
            <div className="text-2xl font-bold text-[var(--color-primary)]">{pendingTickets.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">{copy.assigned}</div>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
            <div className="text-2xl font-bold text-orange-500">{activeTickets.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">{copy.inProgress}</div>
          </div>
        </div>

        {/* 进行中工单 */}
        {activeTickets.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{copy.inProgress}</h3>
            <div className="space-y-2">
              {activeTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-3 bg-[var(--color-surface-elevated)] rounded-xl cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
                  onClick={() => { setSelectedTicket(ticket); setDetailModalOpen(true); }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {ticket.order_no || ticket.id}
                      </span>
                      {renderSlaBadge(ticket)}
                      {ticket.urgency === 'urgent' && <span className="text-xs text-orange-500">{copy.urgent}</span>}
                      {ticket.urgency === 'critical' && <span className="text-xs text-red-500">{copy.critical}</span>}
                    </div>
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${statuses[ticket.status]?.color}`}>
                      {statuses[ticket.status]?.text}
                    </span>
                  </div>
                  {ticket.customer_name && (
                    <p className="text-xs text-[var(--color-primary)] mb-1">{copy.customer}: {ticket.customer_name}{ticket.customer_region ? ` · ${ticket.customer_region}` : ''}</p>
                  )}
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {ticket.category_l1 && ticket.category_l1 !== 'other'
                      ? `${categories[ticket.category_l1]?.label || ticket.category_l1}${ticket.category_l2 && ticket.category_l2 !== 'other' ? ' · ' + (categoryLabels[ticket.category_l2] || ticket.category_l2) : ''}`
                      : ticket.type} | {ticket.description?.slice(0, 50)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 已派工服务任务：旧 accept/reject 接口暂作确认/退回兼容动作。 */}
        {pendingTickets.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{copy.assignedTasks}</h3>
            <div className="space-y-2">
              {pendingTickets.map((ticket) => (
                <div key={ticket.id} className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {ticket.order_no || ticket.id}
                      </span>
                      {renderSlaBadge(ticket)}
                      {ticket.urgency === 'urgent' && <span className="text-xs text-orange-500">{copy.urgent}</span>}
                      {ticket.urgency === 'critical' && <span className="text-xs text-red-500">{copy.critical}</span>}
                    </div>
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${statuses[ticket.status]?.color}`}>
                      {statuses[ticket.status]?.text}
                    </span>
                  </div>
                  {ticket.customer_name && (
                    <p className="text-xs text-[var(--color-primary)] mb-1">{copy.customer}: {ticket.customer_name}{ticket.customer_region ? ` · ${ticket.customer_region}` : ''}</p>
                  )}
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                    {ticket.category_l1 && ticket.category_l1 !== 'other'
                      ? `${categories[ticket.category_l1]?.label || ticket.category_l1}${ticket.category_l2 && ticket.category_l2 !== 'other' ? ' · ' + (categoryLabels[ticket.category_l2] || ticket.category_l2) : ''}`
                      : ticket.type} | {ticket.description?.slice(0, 60)}...
                  </p>
                  <div className="flex gap-2">
                    <button
                      data-testid="accept-ticket-button"
                      onClick={() => handleAccept(ticket.id)}
                      disabled={actionLoading === ticket.id}
                      className="flex-1 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {copy.confirmAssignment}
                    </button>
                    <button
                      data-testid="reject-ticket-button"
                      onClick={() => handleReject(ticket.id)}
                      disabled={actionLoading === ticket.id}
                      className="flex-1 py-1.5 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {copy.returnDispatch}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && pendingTickets.length === 0 && activeTickets.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">
            {copy.empty}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">
            {copy.loading}
          </div>
        )}
      </div>
    </Modal>

    {/* 工单详情弹窗 */}
    <WorkOrderDetailModal
      isOpen={detailModalOpen}
      onClose={() => setDetailModalOpen(false)}
      workOrder={selectedTicket}
      userType="engineer"
      userId={engineerId}
      onRateSuccess={loadTickets}
      onConfirmed={loadTickets}
    />
    </>
  );
}
