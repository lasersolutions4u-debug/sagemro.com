import { useEffect } from 'react';
import { ArrowLeft, BookOpen, Calculator, Newspaper } from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { Footer } from '../common/Footer';
import { NotFoundPage } from '../common/NotFoundPage';
import { getLocalizedInsight, getLocalizedInsights } from '../../data/insights';
import { isCnLocale } from '../../utils/locale';
import { setSeoMetadata } from '../../utils/seo';

const insightsCopy = {
  en: {
    hubTitle: 'SAGEMRO Insights for Laser and Metal Forming Equipment',
    hubDescription: 'Practical notes, calculators, and decision guides for laser and metal forming equipment.',
    back: 'Back to service',
    eyebrow: 'SAGEMRO Insights',
    h1: 'Practical notes for machine decisions, service risk, and shop-floor planning.',
    intro: 'Short, checkable guides connected to the calculators and AI workspace. The goal is to clarify assumptions before service, purchasing, or production decisions.',
    aiBridge: 'Reading an insight? When your AI analysis mentions a concept you haven\'t seen before, jump straight to the matching article for a quick reference.',
    allInsights: 'All insights',
    relatedCalculator: 'Related calculator',
    navTools: 'Tools',
    navInsights: 'Insights',
    navChat: 'AI chat',
  },
  'zh-CN': {
    hubTitle: 'SAGEMRO 洞察：激光和成型设备',
    hubDescription: '面向激光和成型设备的实务说明、计算工具和判断参考。',
    back: '返回服务首页',
    eyebrow: 'SAGEMRO 洞察',
    h1: '关于设备判断、服务风险和车间规划的实务说明。',
    intro: '这些简短、可检查的内容会连接计算器和 AI 工作区，帮助你在服务、采购或生产决策前先把假设说清楚。',
    aiBridge: '正在阅读一篇洞察？当 AI 分析提到你还不熟悉的概念时，直接跳到对应的文章快速查阅。',
    allInsights: '全部洞察',
    relatedCalculator: '相关计算器',
    navTools: '工具',
    navInsights: '洞察',
    navChat: 'AI 对话',
  },
};

export function InsightsPage({ pathname = '/insights', onOpenLegal }) {
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const canonicalHost = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';
  const copy = insightsCopy[locale];
  const slug = pathname.split('/insights/')[1]?.replace(/\/$/, '') || '';
  const insight = getLocalizedInsight(slug, locale);
  const localizedInsights = getLocalizedInsights(locale);

  useEffect(() => {
    const title = insight ? insight.title : copy.hubTitle;
    const description = insight
      ? insight.description
      : copy.hubDescription;
    const isMissing = Boolean(slug && !insight);
    setSeoMetadata({
      title: isMissing ? '洞察未找到 | SAGEMRO' : `${title} | SAGEMRO`,
      description: isMissing ? '找不到请求的 SAGEMRO 洞察文章。' : description,
      canonical: `${canonicalHost}${insight ? `/insights/${insight.slug}` : slug ? `/insights/${slug}` : '/insights'}`,
      lang: locale,
      robots: isMissing ? 'noindex,nofollow,noarchive' : 'index,follow',
      structuredData: insight ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: insight.title,
        description: insight.description,
        url: `${canonicalHost}/insights/${insight.slug}`,
        publisher: { '@type': 'Organization', name: 'SAGEMRO' },
      } : null,
    });
  }, [canonicalHost, copy, insight, slug, locale]);

  if (slug && !insight) {
    return <NotFoundPage isCn={locale === 'zh-CN'} />;
  }

  if (insight) {
    return <InsightDetail copy={copy} insight={insight} onOpenLegal={onOpenLegal} />;
  }

  return <InsightsHub copy={copy} insights={localizedInsights} onOpenLegal={onOpenLegal} />;
}

function InsightsHub({ copy, insights, onOpenLegal }) {
  return (
    <InsightShell copy={copy} onOpenLegal={onOpenLegal}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          {copy.back}
        </a>
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <Newspaper size={14} className="text-[var(--color-primary)]" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
              {copy.h1}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {copy.intro}
            </p>
            <div className="mt-5 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-3">
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                {copy.aiBridge}
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {insights.map((item) => (
              <InsightCard key={item.slug} item={item} />
            ))}
          </div>
        </section>
      </main>
    </InsightShell>
  );
}

function InsightDetail({ copy, insight, onOpenLegal }) {
  return (
    <InsightShell copy={copy} onOpenLegal={onOpenLegal}>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
        <a href="/insights" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          {copy.allInsights}
        </a>
        <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 font-semibold text-[var(--color-primary)]">{insight.category}</span>
            <span>{insight.readingTime}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
            {insight.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            {insight.description}
          </p>

          <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-start gap-3">
              <Calculator size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.relatedCalculator}</div>
                <a href={`/tools/${insight.toolSlug}`} className="mt-1 inline-flex text-sm text-[var(--color-primary)] hover:underline">
                  {insight.toolLabel}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-6">
            {insight.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{section.heading}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{section.body}</p>
              </section>
            ))}
          </div>
        </article>
      </main>
    </InsightShell>
  );
}

function InsightCard({ item }) {
  return (
    <a href={`/insights/${item.slug}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 transition hover:border-[var(--color-primary)] hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <BookOpen size={18} />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{item.category}</div>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">{item.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{item.description}</p>
        </div>
      </div>
    </a>
  );
}

function InsightShell({ children, copy, onOpenLegal }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <BrandMark variant="logo" className="h-8 w-8 object-contain" />
            SAGEMRO
          </a>
          <nav className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <a href="/tools" className="hover:text-[var(--color-primary)]">{copy.navTools}</a>
            <a href="/insights" className="hover:text-[var(--color-primary)]">{copy.navInsights}</a>
            <a href="/" className="hover:text-[var(--color-primary)]">{copy.navChat}</a>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
