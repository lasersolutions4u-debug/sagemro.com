import { useEffect, useMemo } from 'react';
import { ArrowLeft, ClipboardList, Wrench } from 'lucide-react';
import { getRelatedDiagnosticGuidesForService } from '../../data/diagnosticGuides';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { getServicePage, getServicePages } from '../../data/servicePages';
import { setSeoMetadata } from '../../utils/seo';
import { getServicePageRoute } from '../../utils/servicePageRoute';
import { NotFoundPage } from '../common/NotFoundPage';
import { PublicConversionPanel } from '../common/PublicConversionPanel';
import { PublicSiteShell } from '../Public/PublicSiteShell';

// 这里以前还各自留了一份 hubTitle / hubDescription / hubHeading / hubIntro，与
// data/publicSeoRoutes.js 里 /services 路由的 title/description/h1/paragraphs[0] 是同一批文案的两份副本
// （而且已经不一致：组件里的 description 多了一个 "Explore"）。静态壳与客户端各读一份，
// 就意味着爬虫与用户看到的可能不是同一句话。现在枢纽页的正文全部取自路由数据，
// 这里只留界面标签。见 tests/service-pages.test.mjs 的单一来源断言。
const copy = {
  en: {
    eyebrow: 'Service support',
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
    relatedGuides: 'Related reviewed guides',
    relatedServices: 'Related services',
    breadcrumb: 'Services',
  },
  'zh-CN': {
    eyebrow: '服务支持',
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
    relatedGuides: '相关已审核指南',
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
  // getPublicSeoRoute 每次都会重建整张路由表，所以按 locale 记忆一次，别放在渲染体里裸调。
  const hubRoute = useMemo(() => getPublicSeoRoute('/services', locale), [locale]);

  useEffect(() => {
    const publicRoute = page ? getPublicSeoRoute(`/services/${page.slug}`, locale) : hubRoute;
    // 枢纽页的 title/description 直接取路由数据（壳读的是同一份），只在这里补品牌后缀——
    // 与 renderPublicDocument 的做法一致。
    const title = page ? page.seoTitle : `${hubRoute?.title ?? ''} | SAGEMRO`;
    const description = page ? (page.seoDescription ?? page.description) : hubRoute?.description;
    const canonical = isMissing ? `${canonicalHost}/services/${slug}` : publicRoute?.canonical;
    setSeoMetadata({
      title,
      description,
      canonical,
      lang: locale,
      robots: isMissing ? 'noindex,nofollow,noarchive' : 'index,follow',
      structuredData: isMissing ? null : publicRoute?.structuredData,
      alternates: isMissing ? undefined : publicRoute?.alternates,
    });
  }, [canonicalHost, hubRoute, isMissing, locale, page, slug]);

  if (isMissing) return <NotFoundPage isCn={locale === 'zh-CN'} />;
  if (!page && !hubRoute) return null;

  return (
    <PublicSiteShell isCn={locale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      {page ? (
        <ServiceDetail page={page} copy={selectedCopy} locale={locale} acquisitionContext={acquisitionContext} onStartDiagnosis={onStartDiagnosis} onOpenServiceRequest={onOpenServiceRequest} />
      ) : (
        <ServicesHub copy={selectedCopy} locale={locale} route={hubRoute} />
      )}
    </PublicSiteShell>
  );
}

function ServicesHub({ copy: selectedCopy, locale, route }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <a href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"><ArrowLeft size={16} />{selectedCopy.back}</a>
      <div className="mt-6 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">{selectedCopy.eyebrow}</div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{route.body.h1}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{(route.body.paragraphs ?? [])[0]}</p>
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

function ServiceDetail({ page, copy: selectedCopy, locale, acquisitionContext }) {
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
      {/* 额外小节（如备件页的交换件）。带锚点，便于从渠道商页等处直接链到这一节。 */}
      {(page.extraSections ?? []).map((section) => (
        <section key={section.anchor ?? section.heading} id={section.anchor} className="mt-8">
          <SectionTitle title={section.heading} />
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{section.body}</p>
        </section>
      ))}
      <section className="mt-8 grid gap-4 md:grid-cols-2"><InfoCard title={selectedCopy.remote} body={page.remoteBoundary} /><InfoCard title={selectedCopy.onsite} body={page.onsiteBoundary} /></section>
      <section className="mt-8 border-t border-[var(--color-border)] pt-5 text-sm leading-6 text-[var(--color-text-secondary)]"><p>{page.evidenceNotes}</p></section>
      {relatedGuides.length > 0 && <section className="mt-8"><SectionTitle title={selectedCopy.relatedGuides} /><div className="mt-3 grid gap-3 sm:grid-cols-2">{relatedGuides.map((guide) => <a key={guide.slug} href={`/insights/${guide.slug}/`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm font-medium hover:border-[var(--color-primary)]">{guide.title}</a>)}</div></section>}
      <div className="mt-8"><PublicConversionPanel context={page.title} acquisitionContext={acquisitionContext} serviceRequestPreset={{ service: page.serviceKind }} /></div>
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
