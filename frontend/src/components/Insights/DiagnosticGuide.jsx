import { AlertTriangle, CheckCircle2, ExternalLink, Wrench } from 'lucide-react';
import { getServicePage } from '../../data/servicePages';
import { getToolBySlug, getLocalizedTool } from '../../data/industryTools';
import { getTechnicalAuthor } from '../../data/technicalAuthors';
import { PublicConversionPanel } from '../common/PublicConversionPanel';

const copy = {
  en: {
    breadcrumb: 'Insights', directAnswer: 'Direct answer', reviewed: 'Last reviewed', safety: 'Safety boundary', symptoms: 'Symptoms',
    cause: 'Cause', check: 'Check', action: 'Action', orderedChecks: 'Check in this order', stop: 'Stop and escalate',
    relatedService: 'Related service', relatedTool: 'Related tool', author: 'Author', technicalReview: 'Technical review',
    sources: 'Sources', accessed: 'Accessed', corrections: 'Request a correction', start: 'Start service diagnosis', request: 'Request service review',
  },
  'zh-CN': {
    breadcrumb: '洞察', directAnswer: '直接答案', reviewed: '最后审核日期', safety: '安全边界', symptoms: '症状',
    cause: '原因', check: '检查', action: '行动', orderedChecks: '按此顺序检查', stop: '停止并升级',
    relatedService: '相关服务', relatedTool: '相关工具', author: '作者', technicalReview: '技术审核',
    sources: '来源', accessed: '访问日期', corrections: '申请更正', start: '开始服务诊断', request: '申请服务评估',
  },
};

export function DiagnosticGuide({ guide, locale = 'en', acquisitionContext, onStartDiagnosis, onOpenServiceRequest }) {
  const text = copy[locale] ?? copy.en;
  const author = getTechnicalAuthor(guide.authorId, locale);
  const reviewer = getTechnicalAuthor(guide.reviewedBy, locale);
  const relatedService = guide.relatedServiceSlug ? getServicePage(guide.relatedServiceSlug, locale) : null;
  const rawTool = guide.relatedToolSlug ? getToolBySlug(guide.relatedToolSlug) : null;
  const relatedTool = rawTool ? getLocalizedTool(rawTool, locale) : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:py-10">
      <nav aria-label="breadcrumb" className="text-sm text-[var(--color-text-secondary)]"><a href="/insights" className="hover:text-[var(--color-primary)]">{text.breadcrumb}</a><span className="px-2">/</span><span>{guide.category}</span></nav>
      <article className="mt-6">
        <header>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{guide.category}</div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{guide.title}</h1>
          <section className="mt-5" aria-labelledby="direct-answer"><h2 id="direct-answer" className="text-base font-semibold">{text.directAnswer}</h2><p className="mt-2 text-base leading-7 text-[var(--color-text-secondary)]">{guide.directAnswer}</p></section>
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">{text.reviewed}: <time dateTime={guide.reviewedAt}>{guide.reviewedAt}</time></p>
        </header>

        <section className="mt-8 rounded-xl border-2 border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-5" aria-labelledby="safety-boundary"><h2 id="safety-boundary" className="flex items-center gap-2 text-xl font-semibold"><AlertTriangle size={20} />{text.safety}</h2><p className="mt-3 text-sm leading-6">{guide.safety}</p></section>
        <GuideList title={text.symptoms} items={guide.symptoms} />

        <section className="mt-8" aria-labelledby="cause-check-action"><h2 id="cause-check-action" className="text-xl font-semibold">{text.cause} / {text.check} / {text.action}</h2><div className="mt-3 hidden overflow-x-auto rounded-xl border border-[var(--color-border)] md:block"><table className="w-full text-left text-sm"><caption className="sr-only">{text.cause}, {text.check}, {text.action}</caption><thead className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]"><tr><th scope="col" className="p-3">{text.cause}</th><th scope="col" className="p-3">{text.check}</th><th scope="col" className="p-3">{text.action}</th></tr></thead><tbody>{guide.causes.map((cause, index) => <tr key={cause} className="border-t border-[var(--color-border)] align-top"><td className="p-3">{cause}</td><td className="p-3">{guide.checks[index]}</td><td className="p-3">{guide.actions[index]}</td></tr>)}</tbody></table></div><div className="mt-3 grid gap-3 md:hidden">{guide.causes.map((cause, index) => <section key={cause} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h3 className="font-semibold">{text.cause}</h3><p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{cause}</p><h3 className="mt-3 font-semibold">{text.check}</h3><p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{guide.checks[index]}</p><h3 className="mt-3 font-semibold">{text.action}</h3><p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{guide.actions[index]}</p></section>)}</div></section>

        <section className="mt-8" aria-labelledby="ordered-checks"><h2 id="ordered-checks" className="text-xl font-semibold">{text.orderedChecks}</h2><ol className="mt-3 space-y-3">{guide.checks.map((check, index) => <li key={check} className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm leading-6"><span className="font-semibold text-[var(--color-primary)]">{index + 1}</span><span>{check}</span></li>)}</ol></section>
        <GuideList title={text.stop} items={guide.stopConditions} warning />

        {(relatedService || relatedTool) && <section className="mt-8 grid gap-3 sm:grid-cols-2">{relatedService && <RelatedLink icon={Wrench} title={text.relatedService} href={`/services/${relatedService.slug}`} label={relatedService.title} />}{relatedTool && <RelatedLink icon={CheckCircle2} title={text.relatedTool} href={`/tools/${relatedTool.slug}`} label={relatedTool.label} />}</section>}
        <section className="mt-8 border-t border-[var(--color-border)] pt-5 text-sm leading-6"><div><span className="font-semibold">{text.author}: </span>{author && <a href={author.url} className="text-[var(--color-primary)] hover:underline">{author.name}</a>}</div><div className="mt-2"><span className="font-semibold">{text.technicalReview}: </span>{reviewer && <a href={reviewer.url} className="text-[var(--color-primary)] hover:underline">{reviewer.name}</a>}</div></section>
        <section className="mt-8" aria-labelledby="sources"><h2 id="sources" className="text-xl font-semibold">{text.sources}</h2><ul className="mt-3 space-y-3">{guide.references.map((source) => <li key={source.url} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm"><a href={source.url} className="font-medium text-[var(--color-primary)] hover:underline">{source.title} <ExternalLink size={14} className="inline" /></a><div className="mt-1 text-[var(--color-text-secondary)]">{source.publisher} · {text.accessed}: {source.accessedAt}</div></li>)}</ul><p className="mt-4 text-sm"><a href={reviewer?.url} className="text-[var(--color-primary)] hover:underline">{text.corrections}</a></p></section>
        <div className="mt-8"><PublicConversionPanel context={guide.title} acquisitionContext={acquisitionContext} primaryLabel={text.start} secondaryLabel={text.request} onStartDiagnosis={onStartDiagnosis} onOpenServiceRequest={onOpenServiceRequest} /></div>
      </article>
    </main>
  );
}

function GuideList({ title, items, warning = false }) {
  return <section className={`mt-8 rounded-xl border p-5 ${warning ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}><h2 className="text-xl font-semibold">{title}</h2><ul className="mt-3 space-y-2 text-sm leading-6">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul></section>;
}

function RelatedLink({ icon: Icon, title, href, label }) {
  return <a href={href} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)]"><Icon size={18} className="text-[var(--color-primary)]" /><div className="mt-3 text-sm text-[var(--color-text-secondary)]">{title}</div><div className="mt-1 font-semibold">{label}</div></a>;
}
