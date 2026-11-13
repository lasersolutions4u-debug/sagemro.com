import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { getServiceBilling } from '../../data/serviceBilling';
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
 *
 * 版式上有两处刻意的取舍：
 * 1. 首屏先给四个数字（glance），再给条款。审核方与客户最先问的就是这四个，不该滑三屏才看到。
 * 2. 单栏、约 68ch 的行宽、h2 到 text-xl。原先正文是 930px 宽、约 107 字符一行，
 *    且 h2 与正文几乎同字号，读起来就是一整块文字。
 */
const copy = {
  en: {
    eyebrow: 'Payment, cancellation and refunds',
    version: 'Version',
    effective: 'effective',
    back: 'Back to home',
    jump: 'Jump to',
    cta: 'Ask about an invoice or a refund',
    ctaNote: 'Send the quotation or invoice number. A written reply follows within one business day.',
  },
  'zh-CN': {
    eyebrow: '付款、取消与退款',
    version: '版本',
    effective: '生效日',
    back: '返回首页',
    jump: '跳到',
    cta: '咨询发票或退款',
    ctaNote: '请附报价单或发票编号，一个工作日内书面回复。',
  },
};

/**
 * 章节跳转的短标签。8 节的长标题不适合直接当导航，这里只给锚点一个短名。
 * 顺序与 publicSeoRoutes.js 里 refundPolicyPage 的 anchors 数组一致。
 */
const JUMP_LABELS = {
  en: {
    'quotation-first': 'Quotation',
    'deposit-and-balance': 'Deposit & balance',
    cancellation: 'Cancellation',
    'cancellation-by-sagemro': 'Our cancellation',
    refunds: 'Refunds',
    'workmanship-warranty': 'Workmanship',
    'maker-warranty': 'Maker warranty',
    dispute: 'Disputes',
  },
  'zh-CN': {
    'quotation-first': '先报价',
    'deposit-and-balance': '预付款与尾款',
    cancellation: '客户取消',
    'cancellation-by-sagemro': '我方取消',
    refunds: '退款',
    'workmanship-warranty': '工艺保修',
    'maker-warranty': '原厂保修',
    dispute: '发票争议',
  },
};

export function RefundPolicyPage({ onOpenLegal }) {
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const labels = copy[locale];
  const route = getPublicSeoRoute('/refund-policy', locale);
  const billing = getServiceBilling(locale);

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

  // 「一页看全」在壳里是列表、这里是卡片，数据同源（glance），所以不会出现两份措辞。
  const sections = (route.body.sections ?? []).filter((section) => section.variant !== 'stats');
  const links = route.body.links ?? [];
  const glance = billing.page.glance;

  return (
    <PublicSiteShell isCn={locale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      <section className="border-b border-[#e6dccf] bg-[#f7f3ed] px-5 py-12 md:py-20">
        <div className="mx-auto max-w-[1240px] lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#92400e]">{labels.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#21160c] sm:text-3xl md:text-4xl">
            {route.body.h1}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-[1.7] text-[#6b5a48]">{(route.body.paragraphs ?? [])[0]}</p>
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-[#8a7863]">
            <FileText size={14} aria-hidden="true" />
            {labels.version} {billing.version} · {labels.effective} {billing.effective}
          </p>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-5 py-10 md:py-14">
        <div className="mx-auto max-w-[1240px] lg:px-8">
          {/* 首屏四个数字：付多少、何时付、取消怎么算、退多久。 */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#e6dccf] bg-[#e6dccf] md:grid-cols-4">
            {glance.map((item) => (
              <div key={item.label} className="bg-[#fffdf8] p-4 md:p-5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#92400e]">{item.label}</dt>
                <dd className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#21160c]">{item.value}</dd>
                <p className="mt-1 text-xs leading-[1.6] text-[#756552]">{item.note}</p>
              </div>
            ))}
          </dl>

          {/* 8 节的页面需要路标：锚点已经存在，这里把它们变成可点的短标签。 */}
          <nav aria-label={labels.jump} className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7863]">{labels.jump}</span>
            {sections.map((section) => section.anchor && (
              <a
                key={section.anchor}
                href={`#${section.anchor}`}
                className="rounded-full border border-[#e6dccf] bg-[#fffdf8] px-3 py-1 text-xs font-medium text-[#5f5142] transition-colors hover:border-[#d97706] hover:text-[#92400e]"
              >
                {JUMP_LABELS[locale][section.anchor] ?? section.heading}
              </a>
            ))}
          </nav>

          <div className="mt-10 max-w-[68ch] divide-y divide-[#e6dccf]">
            {sections.map((section) => (
              <section key={section.heading} id={section.anchor} className="scroll-mt-24 py-7 first:pt-0 last:pb-0">
                <h2 className="text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-[#21160c]">{section.heading}</h2>
                <p className="mt-3 text-sm leading-[1.7] text-[#6b5a48]">{section.body}</p>
                {Array.isArray(section.items) && (
                  <ul className="mt-3 space-y-2 text-sm leading-[1.7] text-[#6b5a48]">
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
              className="flex min-h-11 items-center rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-[#21160c] shadow-sm transition-colors hover:bg-[#fbbf24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#92400e]"
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
