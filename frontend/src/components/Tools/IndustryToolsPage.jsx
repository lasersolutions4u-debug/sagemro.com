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
  getToolBySlug,
  industryTools,
  materialDensities,
  shapeProfiles,
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

function setCanonical(pathname) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', `https://sagemro.com${pathname}`);
}

export function IndustryToolsPage({ pathname = '/tools', onOpenLegal }) {
  const slug = pathname.split('/tools/')[1]?.replace(/\/$/, '') || '';
  const selectedTool = getToolBySlug(slug);
  const [forms, setForms] = useState(defaultIndustryToolForms);
  const pageTitle = selectedTool ? selectedTool.seoTitle : 'Free Sheet Metal and Laser Cutting Calculators';
  const pageDescription = selectedTool
    ? selectedTool.seoDescription
    : 'Use free SAGEMRO calculators for metal weight, steel price planning, laser cutting cost, gas use, speed reference, bending, ROI, and auxiliary sizing.';

  useEffect(() => {
    document.title = `${pageTitle} | SAGEMRO`;
    setMeta('description', pageDescription);
    setCanonical(selectedTool ? `/tools/${selectedTool.slug}` : '/tools');
  }, [pageDescription, pageTitle, selectedTool]);

  if (slug && !selectedTool) {
    return <NotFoundPage isCn={isCnLocale()} />;
  }

  if (!selectedTool) {
    return <ToolsHub onOpenLegal={onOpenLegal} />;
  }

  return (
    <ToolDetail
      tool={selectedTool}
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

function ToolsHub({ onOpenLegal }) {
  const referenceItems = [
    {
      label: 'Material range',
      Icon: Scale,
      body: Object.values(materialDensities).map((item) => item.label).join(', '),
    },
    {
      label: 'Profile coverage',
      Icon: Ruler,
      body: Object.values(shapeProfiles).map((item) => item.label).join(', '),
    },
    {
      label: 'Planning boundary',
      Icon: Calculator,
      body: 'Planning references only. Supplier quotes and qualified review decide final production choices.',
    },
  ];

  useEffect(() => {
    document.title = 'Free Sheet Metal and Laser Cutting Calculators | SAGEMRO';
    setMeta('description', 'Use free SAGEMRO calculators for metal weight, steel price planning, laser cutting cost, gas use, speed reference, bending, ROI, and auxiliary sizing.');
    setCanonical('/tools');
  }, []);

  return (
    <ToolPageShell onOpenLegal={onOpenLegal}>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
        <div>
          <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
            <ArrowLeft size={16} />
            Back to service
          </a>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
            <Calculator size={14} className="text-[var(--color-primary)]" />
            Shop-floor tools
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
            Free tools for sheet metal, laser cutting, bending, ROI, and auxiliary planning.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            Start with numbers you can check: material weight, reference budget, cutting time, assist gas, bending assumptions, equipment ROI, and support equipment needs. Each tool keeps assumptions visible so you can review the next decision with better context.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {industryTools.map((tool) => (
              <ToolLinkCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#1f2a32] bg-[#0f171d] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:grid-cols-3">
          {referenceItems.map((item, index) => (
            <ToolReferenceItem key={item.label} item={item} isFirst={index === 0} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Insights</div>
            <h2 className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">Read practical notes behind the calculators</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              Short equipment and process articles connect the tools to real production decisions.
            </p>
          </div>
          <a href="/insights" className="mt-4 inline-flex rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] sm:mt-0">
            Read insights
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

function ToolDetail({ tool, values, onChange, onOpenLegal }) {
  const relatedTools = useMemo(() => industryTools.filter((item) => item.id !== tool.id), [tool.id]);

  return (
    <ToolPageShell onOpenLegal={onOpenLegal}>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <a href="/tools" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          All tools
        </a>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <Calculator size={14} className="text-[var(--color-primary)]" />
              Free industry calculator
            </div>
            <h1 className="mt-4 break-words text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
              {tool.seoTitle}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {tool.guideBody}
            </p>
          </div>

          <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Related tools
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
              Keep the inputs with your quote notes, drawing revision, material grade, and supplier reference so the estimate can be checked later.
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">FAQ</h2>
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

function ToolPageShell({ children, onOpenLegal }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <BrandMark variant="logo" className="h-8 w-8 object-contain" />
            SAGEMRO
          </a>
          <nav className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <a href="/tools" className="hover:text-[var(--color-primary)]">Tools</a>
            <a href="/" className="hover:text-[var(--color-primary)]">AI chat</a>
          </nav>
        </div>
      </header>
      {children}
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
