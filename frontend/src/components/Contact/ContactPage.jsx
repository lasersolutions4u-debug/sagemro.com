import { useEffect } from 'react';
import { Clock, Mail, Timer } from 'lucide-react';
import { getPublicSeoRoute } from '../../data/publicSeoRoutes';
import { getServicePricing } from '../../data/servicePricing';
import {
  SUPPORT_EMAIL,
  getSupportCopy,
} from '../../data/companyProfile';
import { isCnLocale } from '../../utils/locale';
import { setSeoMetadata } from '../../utils/seo';
import { openConsultationForm } from '../../utils/consultation';
import { PublicSiteShell } from '../Public/PublicSiteShell';

/**
 * 联系页。
 *
 * 与 /about/ 同一套原则：正文由 SEO 路由数据驱动，静态壳与客户端渲染同一份内容。
 * 页面上额外只多一个「渠道条」——邮箱、工作时间、回复时效。它刻意不重复正文里的句子，
 * 只把值提到首屏，避免出现两份措辞。
 *
 * 这一页是收款方审核真正会打开的页面：谁能联系上、多久回、按哪个时区、谁开票。
 * 所有值取自 companyProfile.js，不在组件里另写一份。
 *
 * 🔴 2026-11-13：电话暂不对外公布，联系以邮件为主。号码仍保留在 companyProfile.js，
 * 要恢复时改那一处并在渠道条加回一张卡片即可。
 */
const copy = {
  en: {
    eyebrow: 'Contact',
    back: 'Back to home',
    emailLabel: 'Email',
    hoursLabel: 'Working hours',
    responseLabel: 'Response time',
    priceLead: 'Indicative budget:',
    cta: 'Request a consultation',
    ctaNote: 'The form writes straight to the service team. Email is the fastest written channel.',
  },
  'zh-CN': {
    eyebrow: '联系我们',
    back: '返回首页',
    emailLabel: '邮箱',
    hoursLabel: '工作时间',
    responseLabel: '回复时效',
    priceLead: '参考价格：',
    cta: '提交咨询需求',
    ctaNote: '表单直接进入服务团队；邮件是最快的书面渠道。',
  },
};

export function ContactPage({ onOpenLegal }) {
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const labels = copy[locale];
  const route = getPublicSeoRoute('/contact', locale);
  const support = getSupportCopy(locale);

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
  // mailto: 已经在渠道卡上，不要在下方链接区再列一遍。
  const links = (route.body.links ?? []).filter((link) => !/^(mailto|tel):/.test(link.href));
  // 价格量级：买家最先想知道「大概多少钱」。数字与 /services 的定价块同源（servicePricing.js），
  // 这里只取前两条（远程诊断 + 现场服务），完整区间与不包含项在服务页。
  const pricing = getServicePricing('laser-cutting-machine-repair', locale);

  return (
    <PublicSiteShell isCn={locale === 'zh-CN'} onOpenLegal={onOpenLegal}>
      <section className="border-b border-[#e6dccf] bg-[#f7f3ed] px-5 py-8 md:py-20">
        <div className="mx-auto max-w-[1240px] lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#92400e]">{labels.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#21160c] sm:text-3xl md:mt-4 md:text-4xl">
            {route.body.h1}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-[1.7] text-[#6b5a48] md:text-base">{(route.body.paragraphs ?? [])[0]}</p>

          {/* 渠道条：只有值，没有句子。正文里同一件事已经写成完整段落，两处不会出现两种说法。
              手机上它必须落在首屏内——联系页的第一屏如果看不到联系方式，这一页就没有完成它的工作。 */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex min-h-16 items-center gap-3 rounded-xl border border-[#e6dccf] bg-[#fffdf8] px-4 py-3 transition-colors hover:border-[#d97706] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#92400e]"
            >
              <Mail size={18} className="shrink-0 text-[#92400e]" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7863]">{labels.emailLabel}</span>
                <span className="block break-all text-sm font-semibold text-[#21160c]">{SUPPORT_EMAIL}</span>
              </span>
            </a>
            <div className="flex min-h-16 items-center gap-3 rounded-xl border border-[#e6dccf] bg-[#fffdf8] px-4 py-3">
              <Clock size={18} className="shrink-0 text-[#92400e]" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7863]">{labels.hoursLabel}</span>
                <span className="block text-sm font-semibold text-[#21160c]">{support.hoursShort} · {support.timezone}</span>
              </span>
            </div>
            <div className="flex min-h-16 items-center gap-3 rounded-xl border border-[#e6dccf] bg-[#fffdf8] px-4 py-3">
              <Timer size={18} className="shrink-0 text-[#92400e]" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7863]">{labels.responseLabel}</span>
                <span className="block text-sm font-semibold text-[#21160c]">{support.response}</span>
              </span>
            </div>
          </div>

          {pricing && (
            <p className="mt-6 text-sm leading-[1.7] text-[#6b5a48]">
              {labels.priceLead}{' '}
              <a
                href="/services/laser-cutting-machine-repair/#indicative-pricing"
                className="font-semibold text-[#92400e] underline decoration-[#e7b65b] underline-offset-4"
              >
                {pricing.rows.slice(0, 2).map((row) => row.value).join(' · ')}
              </a>
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={openConsultationForm}
              className="flex min-h-11 items-center rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-[#21160c] shadow-sm transition-colors hover:bg-[#fbbf24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#92400e]"
            >
              {labels.cta}
            </button>
            <p className="text-xs leading-6 text-[#8a7863]">{labels.ctaNote}</p>
          </div>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-5 py-12 md:py-16">
        <div className="mx-auto max-w-[1240px] lg:px-8">
          {/* 单栏 + 分隔线：五节之间本来没有并列关系，两栏网格会凭空造出分组。 */}
          <div className="max-w-[68ch] divide-y divide-[#e6dccf]">
            {sections.map((section) => (
              <section key={section.heading} className="py-7 first:pt-0 last:pb-0">
                <h2 className="text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-[#21160c]">{section.heading}</h2>
                <p className="mt-3 text-sm leading-[1.7] text-[#6b5a48]">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e6dccf] pt-6">
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
