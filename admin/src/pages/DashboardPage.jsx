import { useState, useEffect } from 'react';
import { KeyRound, UserPlus, UserRoundCheck, Users } from 'lucide-react';
import { getAdminStats } from '../services/api';
import { runtimeConfig } from '../config/runtime';

// 后台已裁剪为知识中枢：这里只展示注册用户与今日账号动作。
// 工单、物料、报价、推广等运营指标已随业务下线，不要再往回加。
const TEXT = {
  en: {
    loading: 'Loading...',
    loadFailed: 'Failed to load',
    title: 'User Statistics',
    subtitle: 'Registered accounts and today\'s account activity.',
    customerTotal: 'Registered users',
    recentRegistrations: 'New registrations (7 days)',
    loginsToday: 'Logins today',
    registrationsToday: 'Registrations today',
    verificationCodesToday: 'Verification codes today',
    apiNote: 'Today counts reset at 00:00 UTC.',
    retry: 'Retry',
  },
  'zh-CN': {
    loading: '加载中...',
    loadFailed: '加载失败',
    title: '用户统计',
    subtitle: '注册账号情况与今日账号动作。',
    customerTotal: '注册用户总数',
    recentRegistrations: '近 7 天新增注册',
    loginsToday: '今日登录',
    registrationsToday: '今日注册',
    verificationCodesToday: '今日验证码',
    apiNote: '今日计数按 UTC 零点重置。',
    retry: '重试',
  },
};

export function DashboardPage() {
  const t = TEXT[runtimeConfig.locale] || TEXT.en;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAdminStats()
      .then((nextStats) => { if (active) setStats(nextStats); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  if (loading) {
    return <div className="py-12 text-center text-[var(--color-text-muted)]">{t.loading}</div>;
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <div className="mb-2 text-[var(--color-error)]">{t.loadFailed}</div>
        <div className="text-sm text-[var(--color-text-muted)]">{error}</div>
        <button onClick={() => setReloadKey((current) => current + 1)} className="mt-4 min-h-10 whitespace-nowrap rounded-lg border border-[var(--color-border)] px-4 text-sm">{t.retry}</button>
      </div>
    );
  }

  const apiCalls = stats?.apiCalls || {};
  const cards = [
    { icon: Users, label: t.customerTotal, value: stats?.customers ?? 0 },
    { icon: UserPlus, label: t.recentRegistrations, value: stats?.recentRegistrations ?? 0 },
    { icon: UserRoundCheck, label: t.loginsToday, value: apiCalls.login ?? 0 },
    { icon: UserPlus, label: t.registrationsToday, value: apiCalls.register_customer ?? 0 },
    { icon: KeyRound, label: t.verificationCodesToday, value: apiCalls.send_code ?? 0 },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <card.icon size={18} />
              <span className="text-sm text-[var(--color-text-secondary)]">{card.label}</span>
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[var(--color-text-muted)]">{t.apiNote}</p>
    </div>
  );
}
