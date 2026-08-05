import { runtimeConfig } from '../config/runtime';

export function PromotionAnalyticsPage() {
  const isCn = runtimeConfig.locale === 'zh-CN';

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <p className="text-sm font-medium text-[var(--color-primary)]">SAGEMRO</p>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
        {isCn ? '推广分析' : 'Promotion Analytics'}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
        {isCn ? '推广概览和渠道分析即将提供。' : 'Promotion overview and channel analysis are coming soon.'}
      </p>
    </section>
  );
}
