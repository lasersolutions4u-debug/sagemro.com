import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Clock } from 'lucide-react';
import { getEngineerTickets, acceptTicket, rejectTicket, updateEngineerStatus } from '../../services/api';
import { WorkOrderStatus } from '../../types';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';
import { formatSlaRemaining, categoryConfig, categoryL2Labels } from '../../data/workOrderConfig';

const statusConfig = {
  [WorkOrderStatus.PENDING]: { text: '待接单', color: 'bg-blue-500', textColor: 'text-blue-500' },
  [WorkOrderStatus.ASSIGNED]: { text: '已分配', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  [WorkOrderStatus.IN_PROGRESS]: { text: '处理中', color: 'bg-orange-500', textColor: 'text-orange-500' },
  [WorkOrderStatus.PRICING]: { text: '等待报价', color: 'bg-purple-500', textColor: 'text-purple-500' },
  [WorkOrderStatus.IN_SERVICE]: { text: '服务中', color: 'bg-cyan-500', textColor: 'text-cyan-500' },
  [WorkOrderStatus.RESOLVED]: { text: '已解决', color: 'bg-green-500', textColor: 'text-green-500' },
  [WorkOrderStatus.PENDING_REVIEW]: { text: '待评价', color: 'bg-teal-500', textColor: 'text-teal-500' },
  [WorkOrderStatus.COMPLETED]: { text: '已完成', color: 'bg-gray-500', textColor: 'text-gray-500' },
};

export function EngineerDashboard({ isOpen, onClose, engineerId, onViewProfile }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [engineerStatus, setEngineerStatus] = useState('available');
  const [actionLoading, setActionLoading] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    if (!isOpen || !engineerId) return;
    loadTickets();
  }, [isOpen, engineerId]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await getEngineerTickets(engineerId);
      setTickets(data.work_orders || []);
    } catch (e) {
      console.error('加载工单失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (ticketId) => {
    setActionLoading(ticketId);
    try {
      await acceptTicket({ work_order_id: ticketId, engineer_id: engineerId });
      await loadTickets();
    } catch (e) {
      console.error('接单失败:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (ticketId) => {
    setActionLoading(ticketId);
    try {
      await rejectTicket({ work_order_id: ticketId, engineer_id: engineerId });
      await loadTickets();
    } catch (e) {
      console.error('拒单失败:', e);
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

  // 分类工单
  const pendingTickets = tickets.filter(t => t.status === 'pending');
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress');
  const activeTickets = tickets.filter(t => t.status !== 'pending');

  const renderSlaBadge = (ticket) => {
    const sla = ticket.sla_status;
    if (!sla || sla.remaining_seconds == null) return null;
    const text = formatSlaRemaining(sla);
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
    <Modal isOpen={isOpen} onClose={onClose} title="服务商管理台" size="md">
      <div className="space-y-5">
        {/* 查看档案入口 */}
        <button
          onClick={onViewProfile}
          className="w-full py-2 px-4 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>查看我的档案</span>
        </button>

        {/* 工程师等级与信用分（免费模式，无钱包） */}
        <div className="p-4 bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl border border-[var(--color-primary)]/20">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-secondary)]">
              等级与信用信息请前往「我的档案」查看
            </div>
          </div>
        </div>

        {/* 状态切换 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            接单状态
          </label>
          <div className="flex gap-2">
            {[
              { value: 'available', label: '可接单' },
              { value: 'paused', label: '暂停接单' },
              { value: 'offline', label: '离线' },
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
            <div className="text-sm text-[var(--color-text-secondary)]">待接单</div>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
            <div className="text-2xl font-bold text-orange-500">{activeTickets.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">进行中</div>
          </div>
        </div>

        {/* 进行中工单 */}
        {activeTickets.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">进行中</h3>
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
                      {ticket.urgency === 'urgent' && <span className="text-xs text-orange-500">⚡紧急</span>}
                      {ticket.urgency === 'critical' && <span className="text-xs text-red-500">🔥非常紧急</span>}
                    </div>
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${statusConfig[ticket.status]?.color}`}>
                      {statusConfig[ticket.status]?.text}
                    </span>
                  </div>
                  {ticket.customer_name && (
                    <p className="text-xs text-[var(--color-primary)] mb-1">客户：{ticket.customer_name}{ticket.customer_region ? ` · ${ticket.customer_region}` : ''}</p>
                  )}
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {ticket.category_l1 && ticket.category_l1 !== 'other'
                      ? `${categoryConfig[ticket.category_l1]?.label || ticket.category_l1}${ticket.category_l2 && ticket.category_l2 !== 'other' ? ' · ' + (categoryL2Labels[ticket.category_l2] || ticket.category_l2) : ''}`
                      : ticket.type} | {ticket.description?.slice(0, 50)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 推荐工单 */}
        {pendingTickets.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">推荐工单</h3>
            <div className="space-y-2">
              {pendingTickets.map((ticket) => (
                <div key={ticket.id} className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {ticket.order_no || ticket.id}
                      </span>
                      {renderSlaBadge(ticket)}
                      {ticket.urgency === 'urgent' && <span className="text-xs text-orange-500">⚡紧急</span>}
                      {ticket.urgency === 'critical' && <span className="text-xs text-red-500">🔥非常紧急</span>}
                    </div>
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${statusConfig[ticket.status]?.color}`}>
                      {statusConfig[ticket.status]?.text}
                    </span>
                  </div>
                  {ticket.customer_name && (
                    <p className="text-xs text-[var(--color-primary)] mb-1">客户：{ticket.customer_name}{ticket.customer_region ? ` · ${ticket.customer_region}` : ''}</p>
                  )}
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                    {ticket.category_l1 && ticket.category_l1 !== 'other'
                      ? `${categoryConfig[ticket.category_l1]?.label || ticket.category_l1}${ticket.category_l2 && ticket.category_l2 !== 'other' ? ' · ' + (categoryL2Labels[ticket.category_l2] || ticket.category_l2) : ''}`
                      : ticket.type} | {ticket.description?.slice(0, 60)}...
                  </p>
                  <div className="flex gap-2">
                    <button
                      data-testid="accept-ticket-button"
                      onClick={() => handleAccept(ticket.id)}
                      disabled={actionLoading === ticket.id}
                      className="flex-1 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      接单
                    </button>
                    <button
                      data-testid="reject-ticket-button"
                      onClick={() => handleReject(ticket.id)}
                      disabled={actionLoading === ticket.id}
                      className="flex-1 py-1.5 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      拒单
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
            暂没有可处理的工单
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">
            加载中...
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
