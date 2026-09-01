import { useEffect } from 'react';
import { NotFoundPage } from '../common/NotFoundPage';
import { PublicSiteShell } from '../Public/PublicSiteShell';
import {
  getBrandServicePage,
  getBrandServicePageRoute,
  getBrandServicePages,
  getBrandServiceRequestHref,
} from '../../data/brandServicePages';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { getServicePage } from '../../data/servicePages';
import { setSeoMetadata } from '../../utils/seo';

const categoryLabels = {
  en: { machine: 'Machine builders', 'laser-source': 'Laser sources', 'control-system': 'Control systems', 'cutting-head': 'Cutting heads' },
  'zh-CN': { machine: '整机品牌', 'laser-source': '激光器品牌', 'control-system': '控制系统', 'cutting-head': '切割头' },
};

const copy = {
  en: {
    eyebrow: 'Independent multi-brand service support',
    hubTitle: 'Find service support by installed equipment brand',
    hubIntro: 'Select the machine, laser source, control system, or cutting-head brand installed at your site. Brand pages explain what evidence to prepare and how independent service scope is confirmed.',
    scope: 'Support scope', needs: 'Common service needs', inputs: 'Information to prepare', boundary: 'Service boundary', related: 'Related services', submit: 'Submit this brand service request', breadcrumb: 'Brands',
  },
  'zh-CN': {
    eyebrow: '独立多品牌设备服务',
    hubTitle: '按现场设备品牌查找服务支持',
    hubIntro: '选择现场使用的整机、激光器、控制系统或切割头品牌，查看需要准备的资料，以及独立服务范围如何确认。',
    scope: '支持范围', needs: '常见服务需求', inputs: '需准备的信息', boundary: '服务边界', related: '相关服务', submit: '提交该品牌设备问题', breadcrumb: '支持品牌',
  },
};

export function BrandServicePages({ pathname = '/brands', locale = 'en', onOpenLegal }) {
  const normalizedLocale = locale === 'zh-CN' ? 'zh-CN' : 'en';
  const route = getBrandServicePageRoute(pathname);
  const page = route?.type === 'detail' ? getBrandServicePage(route.slug, normalizedLocale) : null;
  const isMissing = route?.type === 'not-found' || (route?.type === 'detail' && !page);
  const selectedCopy = copy[normalizedLocale];

  useEffect(() => {
    const path = page ? `/brands/${page.slug}` : '/brands';
    const seoRoute = getPublicSeoRoute(path, normalizedLocale);
    setSeoMetadata({
      title: isMissing ? (normalizedLocale === 'zh-CN' ? '品牌页面不存在 | SAGEMRO' : 'Brand page not found | SAGEMRO') : seoRoute?.title,
      description: isMissing ? '' : seoRoute?.description,
      canonical: isMissing ? undefined : seoRoute?.canonical,
      lang: normalizedLocale,
      robots: isMissing ? 'noindex,nofollow,noarchive' : 'index,follow',
      structuredData: isMissing ? null : seoRoute?.structuredData,
    });
  }, [isMissing, normalizedLocale, page]);

  if (isMissing) return <NotFoundPage isCn={normalizedLocale === 'zh-CN'} />;

  return (
    <PublicSiteShell isCn={normalizedLocale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      {page
        ? <BrandDetail page={page} locale={normalizedLocale} selectedCopy={selectedCopy} />
        : <BrandHub locale={normalizedLocale} selectedCopy={selectedCopy} />}
    </PublicSiteShell>
  );
}

function BrandHub({ locale, selectedCopy }) {
  const pages = getBrandServicePages(locale);
  return (
    <div className="mx-auto max-w-[1240px] px-5 py-12 lg:px-8 lg:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#176b4b]">{selectedCopy.eyebrow}</p>
      <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight md:text-5xl">{selectedCopy.hubTitle}</h1>
      <p className="mt-5 max-w-3xl leading-7 text-[#52606b]">{selectedCopy.hubIntro}</p>
      <div className="mt-12 space-y-12">
        {Object.entries(categoryLabels[locale]).map(([category, label]) => (
          <section key={category}>
            <h2 className="text-2xl font-semibold">{label}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pages.filter((page) => page.category === category).map((page) => (
                <a key={page.slug} href={`/brands/${page.slug}/`} className="border border-[#d7dfda] bg-white p-5 hover:border-[#176b4b]">
                  <h3 className="font-semibold">{page.brandName}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#63716a]">{page.description}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function BrandDetail({ page, locale, selectedCopy }) {
  const relatedServices = page.relatedServiceSlugs.map((slug) => getServicePage(slug, locale)).filter(Boolean);
  return (
    <article className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-16">
      <nav className="text-sm text-[#63716a]"><a href="/brands/" className="hover:text-[#176b4b]">{selectedCopy.breadcrumb}</a><span className="px-2">/</span>{page.brandName}</nav>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#176b4b]">{selectedCopy.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">{page.title}</h1>
      <p className="mt-5 max-w-4xl text-base leading-8 text-[#52606b]">{page.summary}</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <ListSection title={selectedCopy.scope} items={page.supportScope} />
        <ListSection title={selectedCopy.needs} items={page.commonNeeds} />
        <ListSection title={selectedCopy.inputs} items={page.customerInputs} />
        <section className="border border-[#d7dfda] bg-[#eef2ef] p-6"><h2 className="text-xl font-semibold">{selectedCopy.boundary}</h2><p className="mt-4 text-sm leading-7 text-[#52606b]">{page.serviceBoundary}</p><p className="mt-4 text-sm leading-7 text-[#52606b]">{page.independenceNotice}</p></section>
      </div>
      <a href={getBrandServiceRequestHref(page.slug, locale)} className="mt-8 inline-flex min-h-12 items-center bg-[#176b4b] px-6 text-sm font-semibold text-white hover:bg-[#11543b]">{selectedCopy.submit}</a>
      <section className="mt-12 border-t border-[#d7dfda] pt-8"><h2 className="text-xl font-semibold">{selectedCopy.related}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{relatedServices.map((service) => <a key={service.slug} href={`/services/${service.slug}/`} className="border border-[#d7dfda] bg-white p-4 text-sm font-semibold hover:border-[#176b4b]">{service.title}</a>)}</div></section>
    </article>
  );
}

function ListSection({ title, items }) {
  return <section className="border border-[#d7dfda] bg-white p-6"><h2 className="text-xl font-semibold">{title}</h2><ul className="mt-4 space-y-3 text-sm leading-7 text-[#52606b]">{items.map((item) => <li key={item}>— {item}</li>)}</ul></section>;
}
