import { useState, useEffect } from 'react';
import { Users, UserCog, FileText, Clock } from 'lucide-react';
import { getAdminStats } from '../services/api';

export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getAdminStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-muted)]">加载中...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-[var(--color-error)] mb-2">加载失败</div>
        <div className="text-sm text-[var(--color-text-muted)]">{error}</div>
      </div>
    );
  }

  const cards = [
    { icon: Users, label: '客户数', value: stats.customers, color: 'var(--color-info)' },
    { icon: UserCog, label: '工程师数', value: stats.engineers, color: 'var(--color-success)' },
    { icon: FileText, label: '工单总数', value: stats.workOrders.total, color: 'var(--color-primary)' },
    { icon: Clock, label: '近7天注册', value: stats.recentRegistrations, color: 'var(--color-warning)' },
  ];

  const statusItems = [
    { label: '待处理', value: stats.workOrders.pending, color: 'var(--color-info)' },
    { label: '处理中', value: stats.workOrders.in_progress, color: 'var(--color-warning)' },
    { label: '已完成', value: stats.workOrders.completed, color: 'var(--color-success)' },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">数据概览</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={18} style={{ color: card.color }} />
              <span className="text-sm text-[var(--color-text-secondary)]">{card.label}</span>
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-4">
        <h3 className="text-sm font-medium mb-4">工单状态分布</h3>
        <div className="space-y-3">
          {statusItems.map((item) => {
            const total = stats.workOrders.total || 1;
            const pct = Math.round((item.value / total) * 100);
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm text-[var(--color-text-secondary)] w-16">{item.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{item.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
