import { useEffect } from 'react';
import { NotFoundPage } from '../common/NotFoundPage';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { isCnLocale } from '../../utils/locale';
import { setSeoMetadata } from '../../utils/seo';
import { PublicSiteShell } from '../Public/PublicSiteShell';

const copy = {
  en: { eyebrow: 'About SAGEMRO', back: 'Back to home' },
  'zh-CN': { eyebrow: '关于 SAGEMRO', back: '返回首页' },
};

/**
 * 公司 / 关于页。
 *
 * 与主题聚合页同样的原则：正文完全由 SEO 路由数据驱动，静态壳与客户端渲染同一份内容，
 * 不存在"爬虫看到一套、用户看到另一套"。这一页是给搜索引擎与 AI 的实体自我描述，
 * 所以宁可短也不写没有依据的话。
 */
export function AboutPage({ pathname = '/about', onOpenLegal }) {
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const labels = copy[locale];
  const isAbout = pathname === '/about' || pathname === '/about/';
  const route = isAbout ? getPublicSeoRoute('/about', locale) : null;

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

  if (!isAbout) return <NotFoundPage isCn={locale === 'zh-CN'} />;
  if (!route) return null;

  return (
    <PublicSiteShell isCn={locale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      <section className="border-b border-[#e6dccf] bg-[#f7f3ed] px-5 py-14 md:py-20">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d97706]">{labels.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] text-[#21160c] md:text-4xl">
            {route.body.h1}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#6b5a48]">{(route.body.paragraphs ?? [])[0]}</p>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-5 py-12 md:py-16">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          {/* 用 h2 + p 而不是 dl/dt/dd：这几节本质是章节标题，不是术语-释义对。
              用 dl 会让渲染后的页面一个标题都没有（静态壳里有 6 个 h2），
              可见页面与爬虫视图的层级就对不上了。 */}
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {(route.body.sections ?? []).map((section) => (
              <section key={section.heading}>
                <h2 className="text-base font-semibold text-[#21160c]">{section.heading}</h2>
                <p className="mt-3 text-sm leading-7 text-[#6b5a48]">{section.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 flex flex-wrap gap-x-5 gap-y-2 max-w-[1240px] lg:px-3">
          <a href="/" className="text-sm font-semibold text-[#2d2116] underline decoration-[#c9b9a5] underline-offset-4 transition-colors hover:text-[#d97706]">
            {labels.back}
          </a>
          {(route.body.links ?? []).map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-[#2d2116] underline decoration-[#c9b9a5] underline-offset-4 transition-colors hover:text-[#d97706]"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}
