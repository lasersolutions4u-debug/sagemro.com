import { useState, useEffect } from 'react';
import { Archive, ClipboardCheck, FileText, Package, ShieldAlert, Timer, TrendingUp, UserCheck, Wrench } from 'lucide-react';
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

  const operations = stats.operations || {};
  const cards = [
    { icon: TrendingUp, label: '今日新增 AI 线索', value: operations.aiLeadsToday ?? 0, color: 'var(--color-info)' },
    { icon: ClipboardCheck, label: '待审核服务申请', value: operations.pendingReview ?? stats.workOrders.pending, color: 'var(--color-primary)' },
    { icon: ShieldAlert, label: '高风险停机问题', value: operations.highRiskDowntime ?? 0, color: 'var(--color-error)' },
    { icon: FileText, label: '待报价', value: operations.pendingQuotes ?? 0, color: 'var(--color-warning)' },
    { icon: UserCheck, label: '待派工', value: operations.pendingDispatch ?? stats.workOrders.pending, color: 'var(--color-info)' },
    { icon: Wrench, label: '服务中', value: operations.inService ?? stats.workOrders.in_progress, color: 'var(--color-success)' },
    { icon: Archive, label: '待归档', value: operations.pendingArchive ?? 0, color: 'var(--color-text-muted)' },
    { icon: Package, label: '备件线索', value: operations.partsLeads ?? 0, color: 'var(--color-warning)' },
    { icon: Timer, label: 'Euchio 新机线索', value: operations.euchioMachineLeads ?? 0, color: 'var(--color-primary)' },
  ];

  const statusItems = [
    { label: '待处理', value: stats.workOrders.pending, color: 'var(--color-info)' },
    { label: '处理中', value: stats.workOrders.in_progress, color: 'var(--color-warning)' },
    { label: '已完成', value: stats.workOrders.completed, color: 'var(--color-success)' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">SAGEMRO Operations Console</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          线索分流、官方服务确认、派工管理、报价审核、服务质量和合规归档。
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
