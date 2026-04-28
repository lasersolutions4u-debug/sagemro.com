import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { getEngineerTickets, acceptTicket, rejectTicket, updateEngineerStatus, getEngineerWallet, applyWithdraw } from '../../services/api';
import { WorkOrderStatus, PartnerLevelLabels, CommissionRates } from '../../types';
import { WorkOrderDetailModal } from '../WorkOrder/WorkOrderDetailModal';

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
  const [walletData, setWalletData] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !engineerId) return;
    loadTickets();
    loadWallet();
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

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const data = await getEngineerWallet(engineerId);
      setWalletData(data);
    } catch (e) {
      console.error('加载钱包失败:', e);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 100) { setWithdrawMsg('提现金额不能低于100元'); return; }
    if (amount > walletData.wallet_balance) { setWithdrawMsg('提现金额不能超过钱包余额'); return; }
    setWithdrawLoading(true);
    setWithdrawMsg('');
    try {
      const result = await applyWithdraw(amount);
      setWithdrawMsg(result.message || '提现申请已提交');
      setWithdrawAmount('');
      loadWallet();
    } catch (e) {
      setWithdrawMsg(e.message || '提现失败');
    } finally {
      setWithdrawLoading(false);
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

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="工程师管理台" size="md">
      <div className="space-y-5">
        {/* 查看档案入口 */}
        <button
          onClick={onViewProfile}
          className="w-full py-2 px-4 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>查看我的档案</span>
        </button>

        {/* 工程师等级与钱包面板 */}
        {walletData && (
          <div className="p-4 bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl border border-[var(--color-primary)]/20 space-y-3">
            {/* 等级 + 提成率 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs text-white rounded ${PartnerLevelLabels[walletData.level]?.color || 'bg-blue-500'}`}>
                  {PartnerLevelLabels[walletData.level]?.label || '初级'}工程师
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">提成 {(walletData.commission_rate * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--color-text-secondary)]">信用分</span>
                <span className={`text-sm font-bold ${walletData.credit_score >= 90 ? 'text-green-500' : walletData.credit_score >= 70 ? 'text-orange-500' : 'text-red-500'}`}>
                  {walletData.credit_score}
                </span>
              </div>
            </div>
            {/* 余额卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {walletLoading ? '...' : walletData.wallet_balance.toLocaleString()}元
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">钱包余额</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {walletLoading ? '...' : walletData.deposit_balance.toLocaleString()}元
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">保证金</div>
              </div>
            </div>
            {/* 提现 */}
            {walletData.wallet_balance > 0 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="输入提现金额（元）"
                    min="100"
                    max={walletData.wallet_balance}
                    className="flex-1 px-3 py-1.5 border border-[var(--color-input-border)] rounded-lg bg-[var(--color-input-bg)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawLoading}
                    className="px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                  >
                    {withdrawLoading ? '提交中...' : '申请提现'}
                  </button>
                </div>
                {withdrawMsg && (
                  <p className="text-xs text-center text-[var(--color-text-secondary)]">{withdrawMsg}</p>
                )}
              </div>
            )}
          </div>
        )}

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
                  <p className="text-sm text-[var(--color-text-secondary)]">{ticket.description?.slice(0, 50)}...</p>
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
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1">{ticket.type} | {ticket.description?.slice(0, 60)}...</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(ticket.id)}
                      disabled={actionLoading === ticket.id}
                      className="flex-1 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      接单
                    </button>
                    <button
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
