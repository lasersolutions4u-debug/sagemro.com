import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  ChartNoAxesCombined,
  CircleDollarSign,
  Factory,
  Flame,
  Gauge,
  Ruler,
  Scale,
  Snowflake,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { Footer } from '../common/Footer';
import { NotFoundPage } from '../common/NotFoundPage';
import { IndustryToolCalculator } from './IndustryToolCalculator';
import {
  defaultIndustryToolForms,
  getLocalizedMaterialDensities,
  getLocalizedShapeProfiles,
  getLocalizedTool,
  getToolBySlug,
  industryTools,
} from '../../data/industryTools';
import { isCnLocale } from '../../utils/locale';
import { setSeoMetadata } from '../../utils/seo';

const toolIcons = {
  'metal-weight': Scale,
  'steel-price': ChartNoAxesCombined,
  'laser-cost': CircleDollarSign,
  'press-brake-tonnage': Factory,
  'gas-consumption': Flame,
  'cutting-speed': Gauge,
  'bend-allowance': Ruler,
  'equipment-roi': CircleDollarSign,
  'auxiliary-sizing': Snowflake,
};

const toolsPageCopy = {
  en: {
    hubTitle: 'Free Sheet Metal and Laser Cutting Calculators',
    hubDescription: 'Use free SAGEMRO calculators for metal weight, steel price planning, laser cutting cost, gas use, speed reference, bending, ROI, and auxiliary sizing.',
    back: 'Back to service',
    eyebrow: 'Shop-floor tools',
    h1: 'Free tools for sheet metal, laser cutting, bending, ROI, and auxiliary planning.',
    intro: 'Start with numbers you can check: material weight, reference budget, cutting time, assist gas, bending assumptions, equipment ROI, and support equipment needs. Each tool keeps assumptions visible so you can review the next decision with better context.',
    materials: 'Material range',
    profiles: 'Profile coverage',
    boundary: 'Planning boundary',
    boundaryText: 'Planning references only. Supplier quotes and qualified review decide final production choices.',
    aiChat: 'AI Chat',
    aiChatTitle: 'Not sure which tool fits your case?',
    aiChatBody: 'Describe your material, specs, and production scenario in the AI chat. It will recommend the right tool and explain the assumptions behind each number.',
    askAiChat: 'Ask AI Chat',
    insights: 'Insights',
    insightTitle: 'Read practical notes behind the calculators',
    insightBody: 'Short equipment and process articles connect the tools to real production decisions.',
    readInsights: 'Read insights',
    allTools: 'All tools',
    detailEyebrow: 'Free industry calculator',
    relatedTools: 'Related tools',
    keepInputs: 'Keep the inputs with your quote notes, drawing revision, material grade, and supplier reference so the estimate can be checked later.',
    faq: 'FAQ',
    navTools: 'Tools',
    navChat: 'AI chat',
  },
  'zh-CN': {
    hubTitle: '钣金、激光切割和折弯行业工具',
    hubDescription: '使用 SAGEMRO 行业工具估算材料重量、钢材预算、激光切割成本、辅助气体用量、切割速度、折弯、设备 ROI 和辅机选型参考。',
    back: '返回服务首页',
    eyebrow: '行业工具',
    h1: '钣金、切割、折弯与设备规划工具。',
    intro: '先从可检查的数据开始：材料重量、预算参考、切割时间、辅助气体、折弯假设、设备 ROI 和辅机需求。每个工具都会把假设列出来，方便你再做下一步判断。',
    materials: '材料范围',
    profiles: '型材覆盖',
    boundary: '使用边界',
    boundaryText: '仅作为规划参考。最终生产选择仍需结合供应商报价和合格人员复核。',
    aiChat: 'AI 对话',
    aiChatTitle: '不确定哪个工具适合你的情况？',
    aiChatBody: '在 AI 聊天中描述你的材料、规格和生产场景，AI 会推荐合适的工具并解释每个数字背后的假设。',
    askAiChat: '询问 AI',
    insights: '洞察',
    insightTitle: '查看计算器背后的实务说明',
    insightBody: '用简短文章把工具结果和真实生产、采购、服务判断连接起来。',
    readInsights: '查看洞察',
    allTools: '全部工具',
    detailEyebrow: '免费行业计算器',
    relatedTools: '相关工具',
    keepInputs: '建议把输入值和报价记录、图纸版本、材料牌号、供应商参考一起保留，方便后续复核。',
    faq: '常见问题',
    navTools: '工具',
    navChat: 'AI 对话',
  },
};

export function IndustryToolsPage({ pathname = '/tools', onOpenLegal, onSendMessage, onNavigateHome }) {
  const locale = isCnLocale() ? 'zh-CN' : 'en';
  const canonicalHost = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';
  const copy = toolsPageCopy[locale];
  const slug = pathname.split('/tools/')[1]?.replace(/\/$/, '') || '';
  const rawSelectedTool = getToolBySlug(slug);
  const selectedTool = getLocalizedTool(rawSelectedTool, locale);
  const [forms, setForms] = useState(defaultIndustryToolForms);
  const pageTitle = selectedTool ? selectedTool.seoTitle : copy.hubTitle;
  const pageDescription = selectedTool
    ? selectedTool.seoDescription
    : copy.hubDescription;

  useEffect(() => {
    const isMissing = Boolean(slug && !rawSelectedTool);
    setSeoMetadata({
      title: isMissing ? '工具未找到 | SAGEMRO' : `${pageTitle} | SAGEMRO`,
      description: isMissing ? '找不到请求的 SAGEMRO 行业工具。' : pageDescription,
      canonical: `${canonicalHost}${selectedTool ? `/tools/${selectedTool.slug}` : slug ? `/tools/${slug}` : '/tools'}`,
      lang: locale,
      robots: isMissing ? 'noindex,nofollow,noarchive' : 'index,follow',
    });
  }, [canonicalHost, pageDescription, pageTitle, rawSelectedTool, selectedTool, slug, locale]);

  if (slug && !rawSelectedTool) {
    return <NotFoundPage isCn={locale === 'zh-CN'} />;
  }

  if (!selectedTool) {
    return <ToolsHub copy={copy} locale={locale} onOpenLegal={onOpenLegal} />;
  }

  return (
    <ToolDetail
      tool={selectedTool}
      copy={copy}
      locale={locale}
      values={forms[selectedTool.id] || defaultIndustryToolForms[selectedTool.id]}
      onChange={(name, value) => {
        setForms((current) => ({
          ...current,
          [selectedTool.id]: {
            ...(current[selectedTool.id] || defaultIndustryToolForms[selectedTool.id]),
            [name]: value,
          },
        }));
      }}
      onOpenLegal={onOpenLegal}
      onSendMessage={onSendMessage}
      onNavigateHome={onNavigateHome}
    />
  );
}

function ToolsHub({ copy, locale, onOpenLegal }) {
  const canonicalHost = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';
  const materials = getLocalizedMaterialDensities(locale);
  const profiles = getLocalizedShapeProfiles(locale);
  const tools = industryTools.map((tool) => getLocalizedTool(tool, locale));
  const referenceItems = [
    {
      label: copy.materials,
      Icon: Scale,
      body: Object.values(materials).map((item) => item.label).join(', '),
    },
    {
      label: copy.profiles,
      Icon: Ruler,
      body: Object.values(profiles).map((item) => item.label).join(', '),
    },
    {
      label: copy.boundary,
      Icon: Calculator,
      body: copy.boundaryText,
    },
  ];

  useEffect(() => {
    setSeoMetadata({
      title: `${copy.hubTitle} | SAGEMRO`,
      description: copy.hubDescription,
      canonical: `${canonicalHost}/tools`,
      lang: locale,
    });
  }, [canonicalHost, copy]);

  return (
    <ToolPageShell copy={copy} onOpenLegal={onOpenLegal}>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-12">
        <div>
          <div className="flex flex-col items-start gap-4">
            <a href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
              <ArrowLeft size={16} />
              {copy.back}
            </a>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <Calculator size={14} className="text-[var(--color-primary)]" />
              {copy.eyebrow}
            </div>
          </div>
          <h1 className="mt-5 max-w-2xl break-keep text-3xl font-semibold leading-[1.1] text-[var(--color-text-primary)] sm:text-[2.4rem]">
            {copy.h1}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            {copy.intro}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            {tools.map((tool) => (
              <ToolLinkCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#1f2a32] bg-[#0f171d] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:grid-cols-3">
          {referenceItems.map((item, index) => (
            <ToolReferenceItem key={item.label} item={item} isFirst={index === 0} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{copy.aiChat}</div>
            <h2 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{copy.aiChatTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              {copy.aiChatBody}
            </p>
          </div>
          <a href="/" className="mt-4 inline-flex rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] sm:mt-0">
            {copy.askAiChat}
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{copy.insights}</div>
            <h2 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{copy.insightTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              {copy.insightBody}
            </p>
          </div>
          <a href="/insights" className="mt-4 inline-flex rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] sm:mt-0">
            {copy.readInsights}
          </a>
        </div>
      </section>
    </ToolPageShell>
  );
}

function ToolReferenceItem({ item, isFirst }) {
  const Icon = item.Icon;

  return (
    <div className={`flex gap-3 px-5 py-5 ${isFirst ? '' : 'border-t border-white/10 md:border-l md:border-t-0'}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-300/10 text-amber-300 ring-1 ring-amber-300/15">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">{item.label}</div>
        <p className="mt-2 text-sm leading-6 text-white/78">{item.body}</p>
      </div>
    </div>
  );
}

function ToolDetail({ tool, copy, locale, values, onChange, onOpenLegal, onSendMessage, onNavigateHome }) {
  const relatedTools = useMemo(
    () => industryTools.filter((item) => item.id !== tool.id).map((item) => getLocalizedTool(item, locale)),
    [locale, tool.id],
  );
  const handleSendToolReview = (prompt) => {
    onSendMessage?.(prompt);
    onNavigateHome?.();
  };

  return (
    <ToolPageShell copy={copy} onOpenLegal={onOpenLegal}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 flex flex-col items-start gap-4">
          <a href="/tools" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
            <ArrowLeft size={16} />
            {copy.allTools}
          </a>
        </div>

        <section>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <Calculator size={14} className="text-[var(--color-primary)]" />
              {copy.detailEyebrow}
            </div>
            <h1 className="mt-4 break-words text-3xl font-semibold leading-[1.08] text-[var(--color-text-primary)] sm:text-[2.75rem]">
              {tool.seoTitle}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {tool.guideBody}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <IndustryToolCalculator tool={tool} values={values} onChange={onChange} onSendMessage={handleSendToolReview} />

            <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{tool.guideTitle}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">{tool.guideBody}</p>
              <div className="mt-4 rounded-lg bg-[#111820] px-4 py-3 text-xs leading-relaxed text-white/85">
                {copy.keepInputs}
              </div>
            </div>
          </div>

          <aside className="grid gap-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                {copy.relatedTools}
              </div>
              <div className="mt-3 grid gap-2">
                {relatedTools.slice(0, 6).map((item) => (
                  <a key={item.id} href={`/tools/${item.slug}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)]">
                    {item.shortLabel || item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.faq}</h2>
              <div className="mt-3 space-y-3">
                {tool.faqs.map(([question, answer]) => (
                  <div key={question} className="border-t border-[var(--color-border)] pt-3">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{question}</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </ToolPageShell>
  );
}

function ToolLinkCard({ tool }) {
  const Icon = toolIcons[tool.id] || Calculator;

  return (
    <a href={`/tools/${tool.slug}`} className="h-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-primary)] hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-[var(--color-text-primary)]">{tool.label}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{tool.description}</p>
        </div>
      </div>
    </a>
  );
}

function ToolPageShell({ children, copy, onOpenLegal }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <BrandMark variant="logo" className="h-8 w-8 object-contain" />
            SAGEMRO
          </a>
          <nav className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <a href="/tools" className="hover:text-[var(--color-primary)]">{copy.navTools}</a>
            <a href="/" className="hover:text-[var(--color-primary)]">{copy.navChat}</a>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
