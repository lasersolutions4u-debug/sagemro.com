import { useEffect } from 'react';
import { ArrowLeft, ClipboardList, Wrench } from 'lucide-react';
import { getRelatedDiagnosticGuidesForService } from '../../data/diagnosticGuides';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { getServicePage, getServicePages } from '../../data/servicePages';
import { setSeoMetadata } from '../../utils/seo';
import { getServicePageRoute } from '../../utils/servicePageRoute';
import { NotFoundPage } from '../common/NotFoundPage';
import { PublicConversionPanel } from '../common/PublicConversionPanel';
import { PublicSiteShell } from '../Public/PublicSiteShell';

const copy = {
  en: {
    hubTitle: 'Industrial Equipment Service Support | SAGEMRO',
    hubDescription: 'Explore structured service support for laser cutting, press brakes, remote diagnostics, and preventive maintenance.',
    eyebrow: 'Service support',
    hubHeading: 'Structured equipment service support for a clear next action.',
    hubIntro: 'Choose the service context that best matches the equipment and operating concern. Each page explains the information to prepare and the boundary between remote and onsite support.',
    back: 'Back to SAGEMRO AI',
    services: 'Services',
    tools: 'Tools',
    insights: 'Insights',
    chat: 'AI chat',
    equipment: 'Equipment scope',
    issues: 'Issue scope',
    process: 'How the review works',
    checklist: 'Information to prepare',
    remote: 'Remote support boundary',
    onsite: 'Onsite support boundary',
    review: 'Reviewed by SAGEMRO Technical Service Team',
    relatedGuides: 'Related reviewed guides',
    guideEmpty: 'More reviewed guides will be added when their evidence is complete.',
    relatedServices: 'Related services',
    breadcrumb: 'Services',
  },
  'zh-CN': {
    hubTitle: '工业设备服务支持 | SAGEMRO',
    hubDescription: '查看激光切割、折弯机、远程诊断和预防性维护的结构化服务支持。',
    eyebrow: '服务支持',
    hubHeading: '用结构化设备服务支持，明确下一步行动。',
    hubIntro: '选择最符合设备和运行问题的服务场景。每个页面说明应准备的信息，以及远程与现场支持的边界。',
    back: '返回 SAGEMRO AI',
    services: '服务',
    tools: '工具',
    insights: '洞察',
    chat: 'AI 对话',
    equipment: '设备范围',
    issues: '问题范围',
    process: '服务评估流程',
    checklist: '需准备的信息',
    remote: '远程支持边界',
    onsite: '现场支持边界',
    review: '由 SAGEMRO 技术服务团队审核',
    relatedGuides: '相关已审核指南',
    guideEmpty: '更多指南将在证据完整并通过审核后发布。',
    relatedServices: '相关服务',
    breadcrumb: '服务',
  },
};

export function ServicePages({ pathname = '/services', locale = 'en', acquisitionContext, onStartDiagnosis, onOpenServiceRequest, onOpenLegal }) {
  const selectedCopy = copy[locale] ?? copy.en;
  const route = getServicePageRoute(pathname);
  const slug = route?.slug ?? '';
  const page = route?.type === 'detail' ? getServicePage(slug, locale) : null;
  const isMissing = route?.type === 'not-found' || Boolean(route?.type === 'detail' && !page);
  const canonicalHost = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';

  useEffect(() => {
    const title = page ? page.seoTitle : selectedCopy.hubTitle;
    const description = page ? page.description : selectedCopy.hubDescription;
    const publicRoute = getPublicSeoRoute(page ? `/services/${page.slug}` : '/services', locale);
    const canonical = isMissing ? `${canonicalHost}/services/${slug}` : publicRoute?.canonical;
    setSeoMetadata({ title, description, canonical, lang: locale, robots: isMissing ? 'noindex,nofollow,noarchive' : 'index,follow', structuredData: isMissing ? null : publicRoute?.structuredData });
  }, [canonicalHost, isMissing, locale, page, selectedCopy, slug]);

  if (isMissing) return <NotFoundPage isCn={locale === 'zh-CN'} />;

  return (
    <PublicSiteShell isCn={locale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      {page ? (
        <ServiceDetail page={page} copy={selectedCopy} locale={locale} acquisitionContext={acquisitionContext} onStartDiagnosis={onStartDiagnosis} onOpenServiceRequest={onOpenServiceRequest} />
      ) : (
        <ServicesHub copy={selectedCopy} locale={locale} />
      )}
    </PublicSiteShell>
  );
}

function ServicesHub({ copy: selectedCopy, locale }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"><ArrowLeft size={16} />{selectedCopy.back}</a>
      <div className="mt-6 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{selectedCopy.eyebrow}</div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{selectedCopy.hubHeading}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{selectedCopy.hubIntro}</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {getServicePages(locale).map((page) => (
          <a key={page.slug} href={`/services/${page.slug}/`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 transition hover:border-[var(--color-primary)] hover:shadow-sm">
            <Wrench size={19} className="text-[var(--color-primary)]" />
            <h2 className="mt-4 text-lg font-semibold">{page.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{page.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function ServiceDetail({ page, copy: selectedCopy, locale, acquisitionContext, onStartDiagnosis, onOpenServiceRequest }) {
  const relatedPages = getServicePages(locale).filter((candidate) => candidate.slug !== page.slug);
  const relatedGuides = getRelatedDiagnosticGuidesForService(page.slug, locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:py-10">
      {/* breadcrumb → answer-first → equipment → process → checklist → boundary → review → conversion → related */}
      <nav aria-label="breadcrumb" className="text-sm text-[var(--color-text-secondary)]"><a href="/services/" className="hover:text-[var(--color-primary)]">{selectedCopy.breadcrumb}</a><span className="px-2">/</span><span>{page.title}</span></nav>
      <section className="mt-7">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{selectedCopy.eyebrow}</div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{page.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">{page.summary}</p>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <InfoCard title={selectedCopy.equipment} body={page.equipment} />
        <InfoCard title={selectedCopy.issues} items={page.issues} />
      </section>
      <section className="mt-8"><SectionTitle icon={ClipboardList} title={selectedCopy.process} /><ol className="mt-3 space-y-3">{page.process.map((step, index) => <li key={step} className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm leading-6"><span className="font-semibold text-[var(--color-primary)]">{index + 1}</span><span>{step}</span></li>)}</ol></section>
      <section className="mt-8"><SectionTitle title={selectedCopy.checklist} /><ul className="mt-3 grid gap-2 sm:grid-cols-2">{page.customerInputs.map((item) => <li key={item} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">{item}</li>)}</ul></section>
      <section className="mt-8 grid gap-4 md:grid-cols-2"><InfoCard title={selectedCopy.remote} body={page.remoteBoundary} /><InfoCard title={selectedCopy.onsite} body={page.onsiteBoundary} /></section>
      <section className="mt-8 border-t border-[var(--color-border)] pt-5 text-sm leading-6 text-[var(--color-text-secondary)]"><div className="font-medium text-[var(--color-text-primary)]">{selectedCopy.review}</div><div>{page.reviewedAt}</div><p className="mt-2">{page.evidenceNotes}</p></section>
      <section className="mt-8"><SectionTitle title={selectedCopy.relatedGuides} />{relatedGuides.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{relatedGuides.map((guide) => <a key={guide.slug} href={`/insights/${guide.slug}/`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm font-medium hover:border-[var(--color-primary)]">{guide.title}</a>)}</div> : <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{selectedCopy.guideEmpty}</p>}</section>
      <div className="mt-8"><PublicConversionPanel context={page.title} acquisitionContext={acquisitionContext} primaryLabel={page.primaryCta} secondaryLabel={page.secondaryCta} onStartDiagnosis={onStartDiagnosis} onOpenServiceRequest={onOpenServiceRequest} /></div>
      <section className="mt-8"><SectionTitle title={selectedCopy.relatedServices} /><div className="mt-3 grid gap-3 sm:grid-cols-2">{relatedPages.map((related) => <a key={related.slug} href={`/services/${related.slug}/`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm font-medium hover:border-[var(--color-primary)]">{related.title}</a>)}</div></section>
    </div>
  );
}

function InfoCard({ title, body, items }) {
  return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4"><h2 className="text-base font-semibold">{title}</h2>{body && <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{body}</p>}{items && <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">{items.map((item) => <li key={item}>{item}</li>)}</ul>}</div>;
}

function SectionTitle({ icon: Icon, title }) {
  return <h2 className="flex items-center gap-2 text-xl font-semibold">{Icon && <Icon size={18} className="text-[var(--color-primary)]" />}{title}</h2>;
}
