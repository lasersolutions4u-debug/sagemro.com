import { useEffect } from 'react';
import { ArrowLeft, BookOpen, Calculator, Newspaper } from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { Footer } from '../common/Footer';
import { NotFoundPage } from '../common/NotFoundPage';
import { getInsightBySlug, insights } from '../../data/insights';

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(pathname) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', `https://sagemro.com${pathname}`);
}

export function InsightsPage({ pathname = '/insights', onOpenLegal }) {
  const slug = pathname.split('/insights/')[1]?.replace(/\/$/, '') || '';
  const insight = getInsightBySlug(slug);

  useEffect(() => {
    const title = insight ? insight.title : 'SAGEMRO Insights for Laser and Metal Forming Equipment';
    const description = insight
      ? insight.description
      : 'Practical notes, calculators, and decision guides for laser and metal forming equipment.';
    document.title = `${title} | SAGEMRO`;
    setMeta('description', description);
    setCanonical(insight ? `/insights/${insight.slug}` : '/insights');
  }, [insight]);

  if (slug && !insight) {
    return <NotFoundPage />;
  }

  if (insight) {
    return <InsightDetail insight={insight} onOpenLegal={onOpenLegal} />;
  }

  return <InsightsHub onOpenLegal={onOpenLegal} />;
}

function InsightsHub({ onOpenLegal }) {
  return (
    <InsightShell onOpenLegal={onOpenLegal}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          Back to service
        </a>
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <Newspaper size={14} className="text-[var(--color-primary)]" />
              SAGEMRO Insights
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
              Practical notes for machine decisions, service risk, and shop-floor planning.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              Short, checkable guides connected to the calculators and AI workspace. The goal is to clarify assumptions before service, purchasing, or production decisions.
            </p>
            <div className="mt-5 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-3">
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-text-primary)]">Reading an insight?</span> When your AI analysis mentions a concept you haven\'t seen before, jump straight to the matching article for a quick reference.
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

function InsightDetail({ insight, onOpenLegal }) {
  return (
    <InsightShell onOpenLegal={onOpenLegal}>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
        <a href="/insights" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          All insights
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
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">Related calculator</div>
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

function InsightShell({ children, onOpenLegal }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <BrandMark variant="logo" className="h-8 w-8 object-contain" />
            SAGEMRO
          </a>
          <nav className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <a href="/tools" className="hover:text-[var(--color-primary)]">Tools</a>
            <a href="/insights" className="hover:text-[var(--color-primary)]">Insights</a>
            <a href="/" className="hover:text-[var(--color-primary)]">AI chat</a>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
