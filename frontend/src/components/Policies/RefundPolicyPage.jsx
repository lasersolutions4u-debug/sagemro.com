import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { isCnLocale } from '../../utils/locale';
import { setSeoMetadata } from '../../utils/seo';
import { openConsultationForm } from '../../utils/consultation';
import { PublicSiteShell } from '../Public/PublicSiteShell';

/**
 * 付款、取消与退款政策页。
 *
 * 正文来自 SEO 路由数据（`data/serviceBilling.js` → `publicSeoRoutes.js`），
 * 与服务条款弹窗共用同一份措辞——这一页不是另写一套，而是把条款里的付款分档
 * 摊开成可读、可截图、可被审核方直接打开的一页。
 */
const copy = {
  en: {
    eyebrow: 'Payment, cancellation and refunds',
    updated: 'Last updated',
    back: 'Back to home',
    cta: 'Ask about an invoice or a refund',
    ctaNote: 'Send the quotation or invoice number. A written reply follows within one business day.',
  },
  'zh-CN': {
    eyebrow: '付款、取消与退款',
    updated: '最后更新',
    back: '返回首页',
    cta: '咨询发票或退款',
    ctaNote: '请附报价单或发票编号，一个工作日内书面回复。',
  },
};

export function RefundPolicyPage({ onOpenLegal }) {
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const labels = copy[locale];
  const route = getPublicSeoRoute('/refund-policy', locale);

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

  if (!route) return null;

  const sections = route.body.sections ?? [];
  const links = route.body.links ?? [];

  return (
    <PublicSiteShell isCn={locale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      <section className="border-b border-[#e6dccf] bg-[#f7f3ed] px-5 py-14 md:py-20">
        <div className="mx-auto max-w-[1240px] lg:px-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#92400e]">{labels.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] text-[#21160c] md:text-4xl">
            {route.body.h1}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#6b5a48]">{(route.body.paragraphs ?? [])[0]}</p>
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-[#8a7863]">
            <FileText size={14} aria-hidden="true" />
            {labels.updated}: {route.modified}
          </p>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-5 py-12 md:py-16">
        <div className="mx-auto max-w-3xl lg:px-3">
          <div className="divide-y divide-[#e6dccf]">
            {sections.map((section) => (
              <section key={section.heading} className="py-7 first:pt-0 last:pb-0">
                <h2 className="text-base font-semibold text-[#21160c]">{section.heading}</h2>
                <p className="mt-3 text-sm leading-7 text-[#6b5a48]">{section.body}</p>
                {Array.isArray(section.items) && (
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-[#6b5a48]">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a227]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e6dccf] pt-6">
            <button
              type="button"
              onClick={openConsultationForm}
              className="flex min-h-11 items-center rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-[#21160c] shadow-sm transition-colors hover:bg-[#fbbf24]"
            >
              {labels.cta}
            </button>
            <p className="text-xs leading-6 text-[#8a7863]">{labels.ctaNote}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            <a href="/" className="text-sm font-semibold text-[#2d2116] underline decoration-[#c9b9a5] underline-offset-4 transition-colors hover:text-[#92400e]">
              {labels.back}
            </a>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-[#2d2116] underline decoration-[#c9b9a5] underline-offset-4 transition-colors hover:text-[#92400e]"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
