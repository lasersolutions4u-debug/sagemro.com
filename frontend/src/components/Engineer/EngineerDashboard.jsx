import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { getEngineerTickets, acceptTicket, rejectTicket, updateEngineerStatus } from '../../services/api';
import { WorkOrderStatus } from '../../types';

const statusConfig = {
  [WorkOrderStatus.PENDING]: { text: '待接单', color: 'bg-blue-500', textColor: 'text-blue-500' },
  [WorkOrderStatus.ASSIGNED]: { text: '已分配', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  [WorkOrderStatus.IN_PROGRESS]: { text: '处理中', color: 'bg-orange-500', textColor: 'text-orange-500' },
  [WorkOrderStatus.RESOLVED]: { text: '已解决', color: 'bg-green-500', textColor: 'text-green-500' },
  [WorkOrderStatus.COMPLETED]: { text: '已完成', color: 'bg-gray-500', textColor: 'text-gray-500' },
};

export function EngineerDashboard({ isOpen, onClose, engineerId, onViewProfile }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [engineerStatus, setEngineerStatus] = useState('available');
  const [actionLoading, setActionLoading] = useState(null);

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
  const completedTickets = tickets.filter(t => ['resolved', 'completed'].includes(t.status));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="工程师工作台" size="lg">
      <div className="space-y-5">
        {/* 查看档案入口 */}
        <button
          onClick={onViewProfile}
          className="w-full py-2 px-4 bg-[#f4f3f4] dark:bg-[#2a2a3c] hover:bg-[#e5e4e7] dark:hover:bg-[#3a3a4c] text-[#08060d] dark:text-[#f3f4f6] rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>查看我的档案</span>
        </button>

        {/* 状态切换 */}
        <div>
          <label className="block text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">
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
                    ? 'bg-[#f59e0b] text-white'
                    : 'bg-[#f4f3f4] dark:bg-[#2a2a3c] text-[#6b6375] hover:bg-[#e5e4e7]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 今日概览 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
            <div className="text-2xl font-bold text-[#f59e0b]">{pendingTickets.length}</div>
            <div className="text-sm text-[#6b6375]">待接单</div>
          </div>
          <div className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
            <div className="text-2xl font-bold text-orange-500">{inProgressTickets.length}</div>
            <div className="text-sm text-[#6b6375]">处理中</div>
          </div>
        </div>

        {/* 处理中工单 */}
        {inProgressTickets.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">处理中</h3>
            <div className="space-y-2">
              {inProgressTickets.map((ticket) => (
                <div key={ticket.id} className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[#08060d] dark:text-[#f3f4f6]">
                      {ticket.order_no || ticket.id}
                    </span>
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${statusConfig[ticket.status]?.color}`}>
                      {statusConfig[ticket.status]?.text}
                    </span>
                  </div>
                  <p className="text-sm text-[#6b6375]">{ticket.description?.slice(0, 50)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 推荐工单 */}
        {pendingTickets.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">推荐工单</h3>
            <div className="space-y-2">
              {pendingTickets.map((ticket) => (
                <div key={ticket.id} className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[#08060d] dark:text-[#f3f4f6]">
                      {ticket.order_no || ticket.id}
                    </span>
                    <span className={`px-2 py-0.5 text-xs text-white rounded ${statusConfig[ticket.status]?.color}`}>
                      {statusConfig[ticket.status]?.text}
                    </span>
                  </div>
                  <p className="text-sm text-[#6b6375] mb-2">{ticket.description?.slice(0, 80)}...</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(ticket.id)}
                      disabled={actionLoading === ticket.id}
                      className="flex-1 py-1.5 bg-[#f59e0b] hover:bg-[#fbbf24] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      接单
                    </button>
                    <button
                      onClick={() => handleReject(ticket.id)}
                      disabled={actionLoading === ticket.id}
                      className="flex-1 py-1.5 bg-[#f4f3f4] dark:bg-[#3a3a4c] text-[#6b6375] rounded-lg text-sm transition-colors disabled:opacity-50"
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
        {!loading && pendingTickets.length === 0 && inProgressTickets.length === 0 && (
          <div className="text-center py-8 text-[#6b6375]">
            暂没有可处理的工单
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-[#6b6375]">
            加载中...
          </div>
        )}
      </div>
    </Modal>
  );
}
