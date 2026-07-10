import { useState, useEffect } from 'react';
import { Archive, ClipboardCheck, FileText, Package, ShieldAlert, Timer, TrendingUp, UserCheck, Wrench } from 'lucide-react';
import { getAdminStats } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const TEXT = {
  en: {
    loading: 'Loading...',
    loadFailed: 'Failed to load',
    title: 'SAGEMRO Operations Console',
    subtitle: 'Lead routing, service review, dispatch management, quote approval, service quality, and compliant archiving.',
    cards: {
      aiLeadsToday: 'New machine leads today',
      pendingReview: 'Service requests pending review',
      highRiskDowntime: 'High-risk downtime issues',
      pendingQuotes: 'Quotes pending review',
      pendingDispatch: 'Pending dispatch',
      inService: 'In service',
      pendingArchive: 'Pending archive',
      valueAddedRequests: 'Value-added requests',
      euchioMachineLeads: 'Machine leads total',
    },
    status: {
      pending: 'Pending',
      inProgress: 'In progress',
      completed: 'Completed',
    },
    statusDistribution: 'Service order status',
  },
  'zh-CN': {
    loading: '加载中...',
    loadFailed: '加载失败',
    title: 'SAGEMRO 运营中枢',
    subtitle: '线索分流、服务审核、派工管理、报价确认、服务质量和合规归档。',
    cards: {
      aiLeadsToday: '今日新增整机线索',
      pendingReview: '待审核服务申请',
      highRiskDowntime: '高风险停机问题',
      pendingQuotes: '待报价',
      pendingDispatch: '待派工',
      inService: '服务中',
      pendingArchive: '待归档',
      valueAddedRequests: '增值服务需求',
      euchioMachineLeads: '整机线索总数',
    },
    status: {
      pending: '待处理',
      inProgress: '处理中',
      completed: '已完成',
    },
    statusDistribution: '工单状态分布',
  },
};

export function DashboardPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
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
    return <div className="text-center py-12 text-[var(--color-text-muted)]">{t.loading}</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-[var(--color-error)] mb-2">{t.loadFailed}</div>
        <div className="text-sm text-[var(--color-text-muted)]">{error}</div>
      </div>
    );
  }

  const operations = stats.operations || {};
  const cards = [
    { icon: TrendingUp, label: t.cards.aiLeadsToday, value: operations.aiLeadsToday ?? 0, color: 'var(--color-info)' },
    { icon: ClipboardCheck, label: t.cards.pendingReview, value: operations.pendingReview ?? stats.workOrders.pending, color: 'var(--color-primary)' },
    { icon: ShieldAlert, label: t.cards.highRiskDowntime, value: operations.highRiskDowntime ?? 0, color: 'var(--color-error)' },
    { icon: FileText, label: t.cards.pendingQuotes, value: operations.pendingQuotes ?? 0, color: 'var(--color-warning)' },
    { icon: UserCheck, label: t.cards.pendingDispatch, value: operations.pendingDispatch ?? stats.workOrders.pending, color: 'var(--color-info)' },
    { icon: Wrench, label: t.cards.inService, value: operations.inService ?? stats.workOrders.in_progress, color: 'var(--color-success)' },
    { icon: Archive, label: t.cards.pendingArchive, value: operations.pendingArchive ?? 0, color: 'var(--color-text-muted)' },
    { icon: Package, label: t.cards.valueAddedRequests, value: operations.valueAddedRequests ?? 0, color: 'var(--color-warning)' },
    { icon: Timer, label: t.cards.euchioMachineLeads, value: operations.euchioMachineLeads ?? 0, color: 'var(--color-primary)' },
  ];

  const statusItems = [
    { label: t.status.pending, value: stats.workOrders.pending, color: 'var(--color-info)' },
    { label: t.status.inProgress, value: stats.workOrders.in_progress, color: 'var(--color-warning)' },
    { label: t.status.completed, value: stats.workOrders.completed, color: 'var(--color-success)' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t.subtitle}
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
        <h3 className="text-sm font-medium mb-4">{t.statusDistribution}</h3>
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
