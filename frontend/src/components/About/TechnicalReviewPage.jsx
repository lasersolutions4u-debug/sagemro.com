import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getTechnicalAuthor } from '../../data/technicalAuthors';
import { getTechnicalReviewPolicy } from '../../data/technicalReviewPolicy';
import { setSeoMetadata } from '../../utils/seo';
import { BrandMark } from '../common/BrandMark';
import { Footer } from '../common/Footer';

export function TechnicalReviewPage({ locale = 'en', onOpenLegal }) {
  const policy = getTechnicalReviewPolicy(locale);
  const author = getTechnicalAuthor('sagemro-technical-service-team', locale);
  const host = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';
  const canonical = `${host}/about/technical-review/`;
  const organizationId = `${canonical}#technical-team`;

  useEffect(() => {
    setSeoMetadata({
      title: policy.seoTitle,
      description: policy.description,
      canonical,
      lang: locale,
      robots: 'index,follow',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'AboutPage',
            name: policy.title,
            description: policy.description,
            url: canonical,
            datePublished: policy.publishedAt,
            dateModified: policy.reviewedAt,
            author: { '@id': organizationId },
            publisher: { '@id': organizationId },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'about', item: `${host}/about/` },
              { '@type': 'ListItem', position: 2, name: 'technical-review', item: canonical },
            ],
          },
          {
            '@type': 'Organization',
            '@id': organizationId,
            name: author.name,
            description: author.bio,
            url: author.url,
          },
        ],
      },
    });
  }, [author, canonical, host, locale, organizationId, policy]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold"><BrandMark variant="logo" className="h-8 w-8 object-contain" />SAGEMRO</a>
          <a href="/services/" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{locale === 'zh-CN' ? '服务' : 'Services'}</a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"><ArrowLeft size={16} />{locale === 'zh-CN' ? '返回 SAGEMRO' : 'Back to SAGEMRO'}</a>
        <article className="mt-7">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{policy.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">{policy.intro}</p>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">{locale === 'zh-CN' ? '最后审核日期' : 'Last reviewed'}: <time dateTime={policy.reviewedAt}>{policy.reviewedAt}</time></p>
          <div className="mt-8 space-y-6">
            {policy.sections.map((section) => (
              <section key={section.heading} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h2 className="text-xl font-semibold">{section.heading}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{section.body}</p>
              </section>
            ))}
          </div>
          <section className="mt-8 border-t border-[var(--color-border)] pt-6">
            <h2 className="text-xl font-semibold">{locale === 'zh-CN' ? '报告错误' : 'Report an error'}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{policy.errorReporting}</p>
            <a href="mailto:support@sagemro.com" className="mt-3 inline-flex text-sm font-medium text-[var(--color-primary)] hover:underline">support@sagemro.com</a>
          </section>
        </article>
      </main>
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
