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

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(pathname, canonicalHost = 'https://sagemro.com') {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', `${canonicalHost}${pathname}`);
}

const toolsPageCopy = {
  en: {
    hubTitle: 'Free Sheet Metal and Laser Cutting Calculators',
    hubDescription: 'Use free SAGEMRO calculators for metal weight, steel price planning, laser cutting cost, gas use, speed reference, bending, ROI, and auxiliary sizing.',
    back: 'Back to SAGEMRO AI',
    eyebrow: 'Shop-floor tools',
    h1: 'Free tools for sheet metal, laser cutting, bending, ROI, and auxiliary planning.',
    intro: 'Start with numbers you can check: material weight, reference budget, cutting time, assist gas, bending assumptions, equipment ROI, and support equipment needs. Each tool keeps assumptions visible so you can review the next decision with better context.',
    materials: 'Materials',
    profiles: 'Profiles',
    boundary: 'Boundary',
    boundaryText: 'Planning references only. Supplier quotes and qualified review decide final production choices.',
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
    back: '返回 SAGEMRO AI',
    eyebrow: '行业工具',
    h1: '钣金、激光切割、折弯、投资和辅机规划工具。',
    intro: '先从可检查的数据开始：材料重量、预算参考、切割时间、辅助气体、折弯假设、设备 ROI 和辅机需求。每个工具都会把假设列出来，方便你再做下一步判断。',
    materials: '材料',
    profiles: '型材',
    boundary: '使用边界',
    boundaryText: '仅作为规划参考。最终生产选择仍需结合供应商报价和合格人员复核。',
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

export function IndustryToolsPage({ pathname = '/tools', onOpenLegal }) {
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
    document.title = `${pageTitle} | SAGEMRO`;
    setMeta('description', pageDescription);
    setCanonical(selectedTool ? `/tools/${selectedTool.slug}` : '/tools', canonicalHost);
  }, [canonicalHost, pageDescription, pageTitle, selectedTool]);

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
    />
  );
}

function ToolsHub({ copy, locale, onOpenLegal }) {
  const canonicalHost = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';
  const materials = getLocalizedMaterialDensities(locale);
  const profiles = getLocalizedShapeProfiles(locale);
  const tools = industryTools.map((tool) => getLocalizedTool(tool, locale));

  useEffect(() => {
    document.title = `${copy.hubTitle} | SAGEMRO`;
    setMeta('description', copy.hubDescription);
    setCanonical('/tools', canonicalHost);
  }, [canonicalHost, copy]);

  return (
    <ToolPageShell copy={copy} onOpenLegal={onOpenLegal}>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
        <div>
          <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
            <ArrowLeft size={16} />
            {copy.back}
          </a>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
            <Calculator size={14} className="text-[var(--color-primary)]" />
            {copy.eyebrow}
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
            {copy.h1}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            {copy.intro}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolLinkCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[#111820] px-4 py-5 text-white sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-amber-300">{copy.materials}</div>
            <p className="mt-1 text-white/80">{Object.values(materials).map((item) => item.label).join(', ')}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-amber-300">{copy.profiles}</div>
            <p className="mt-1 text-white/80">{Object.values(profiles).map((item) => item.label).join(', ')}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-amber-300">{copy.boundary}</div>
            <p className="mt-1 text-white/80">{copy.boundaryText}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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

function ToolDetail({ tool, copy, locale, values, onChange, onOpenLegal }) {
  const relatedTools = useMemo(
    () => industryTools.filter((item) => item.id !== tool.id).map((item) => getLocalizedTool(item, locale)),
    [locale, tool.id],
  );

  return (
    <ToolPageShell copy={copy} onOpenLegal={onOpenLegal}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <a href="/tools" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          {copy.allTools}
        </a>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <Calculator size={14} className="text-[var(--color-primary)]" />
              {copy.detailEyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
              {tool.seoTitle}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {tool.guideBody}
            </p>
          </div>

          <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
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
          </aside>
        </section>

        <div className="mt-6">
          <IndustryToolCalculator tool={tool} values={values} onChange={onChange} />
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{tool.guideTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">{tool.guideBody}</p>
            <div className="mt-4 rounded-lg bg-[#111820] px-4 py-3 text-xs leading-relaxed text-white/85">
              {copy.keepInputs}
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
        </section>
      </main>
    </ToolPageShell>
  );
}

function ToolLinkCard({ tool }) {
  const Icon = toolIcons[tool.id] || Calculator;

  return (
    <a href={`/tools/${tool.slug}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-primary)] hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{tool.label}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{tool.description}</p>
        </div>
      </div>
    </a>
  );
}

function ToolPageShell({ children, copy, onOpenLegal }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
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
      {children}
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
