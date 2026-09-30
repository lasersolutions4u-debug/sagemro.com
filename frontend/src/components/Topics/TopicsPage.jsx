import { useEffect } from 'react';
import { NotFoundPage } from '../common/NotFoundPage';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { isCnLocale } from '../../utils/locale';
import { setSeoMetadata } from '../../utils/seo';
import { PublicSiteShell } from '../Public/PublicSiteShell';

const copy = {
  en: {
    eyebrow: 'Browse by topic',
    intro: 'The same page often belongs to more than one topic.',
    back: 'Back to home',
    allServices: 'All service records',
  },
  'zh-CN': {
    eyebrow: '按主题浏览',
    intro: '同一个页面常常同时属于几个主题。',
    back: '返回首页',
    allServices: '全部服务项目',
  },
};

/**
 * 主题聚合页。
 *
 * 页面结构完全由 SEO 路由数据驱动（标题、分组、链接文字都取自 getPublicSeoRoute），
 * 所以静态壳与客户端渲染的是同一份内容——不存在"爬虫看到一套、用户看到另一套"。
 */
export function TopicsPage({ pathname = '/topics', onOpenLegal }) {
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const labels = copy[locale];
  const isHub = pathname === '/topics' || pathname === '/topics/';
  const route = isHub ? getPublicSeoRoute('/topics', locale) : null;

  useEffect(() => {
    if (!route) return;
    setSeoMetadata({
      title: `${route.title} | SAGEMRO`,
      description: route.description,
      canonical: route.canonical,
      robots: route.robots,
      lang: locale,
      structuredData: route.structuredData,
      alternates: route.alternates,
    });
  }, [locale, route]);

  if (!isHub) return <NotFoundPage isCn={locale === 'zh-CN'} />;
  if (!route) return null;

  return (
    <PublicSiteShell isCn={locale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      <section className="border-b border-[#e6dccf] bg-[#f7f3ed] px-5 py-14 md:py-20">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#92400e]">{labels.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] text-[#21160c] md:text-4xl">
            {route.body.h1}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#6b5a48]">{(route.body.paragraphs ?? [])[0]}</p>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-5 py-12 md:py-16">
        <div className="mx-auto grid max-w-[1240px] gap-6 md:grid-cols-2 lg:px-3">
          {(route.body.sections ?? []).map((section) => (
            <article key={section.heading} className="rounded-xl border border-[#e6dccf] bg-white p-5">
              <h2 className="text-base font-semibold text-[#21160c]">{section.heading}</h2>
              <ul className="mt-3 space-y-2">
                {(section.items ?? []).map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="text-sm font-medium text-[#b45309] underline decoration-[#e7b65b] underline-offset-4 transition-colors hover:text-[#92400e]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 flex flex-wrap gap-x-5 gap-y-2 max-w-[1240px] lg:px-3">
          <a href="/" className="text-sm font-semibold text-[#2d2116] underline decoration-[#c9b9a5] underline-offset-4 transition-colors hover:text-[#92400e]">
            {labels.back}
          </a>
          {(route.body.links ?? []).map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-[#2d2116] underline decoration-[#c9b9a5] underline-offset-4 transition-colors hover:text-[#92400e]"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}
