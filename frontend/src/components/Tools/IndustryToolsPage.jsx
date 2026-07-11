import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  ChartNoAxesCombined,
  CircleDollarSign,
  Factory,
  Scale,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { Footer } from '../common/Footer';
import { IndustryToolCalculator } from './IndustryToolCalculator';
import {
  defaultIndustryToolForms,
  getToolBySlug,
  industryTools,
  materialDensities,
  shapeProfiles,
} from '../../data/industryTools';

const toolIcons = {
  'metal-weight': Scale,
  'steel-price': ChartNoAxesCombined,
  'laser-cost': CircleDollarSign,
  'press-brake-tonnage': Factory,
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
    : 'Use free SAGEMRO calculators for metal weight, steel price planning, laser cutting cost, and press brake tonnage.';

  useEffect(() => {
    document.title = `${pageTitle} | SAGEMRO`;
    setMeta('description', pageDescription);
    setCanonical(selectedTool ? `/tools/${selectedTool.slug}` : '/tools');
  }, [pageDescription, pageTitle, selectedTool]);

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
  useEffect(() => {
    document.title = 'Free Sheet Metal and Laser Cutting Calculators | SAGEMRO';
    setMeta('description', 'Use free SAGEMRO calculators for metal weight, steel price planning, laser cutting cost, and press brake tonnage.');
    setCanonical('/tools');
  }, []);

  return (
    <ToolPageShell onOpenLegal={onOpenLegal}>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
        <div>
          <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
            <ArrowLeft size={16} />
            Back to SAGEMRO AI
          </a>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
            <Calculator size={14} className="text-[var(--color-primary)]" />
            Shop-floor tools
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-[var(--color-text-primary)] sm:text-5xl">
            Free calculators for sheet metal, laser cutting, bending, and material planning.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            Start with numbers you can check: material weight, reference budget, cutting time, and press brake tonnage. Each tool keeps assumptions visible so you can review the next decision with better context.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {industryTools.map((tool) => (
              <ToolLinkCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[#111820] px-4 py-5 text-white sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-amber-300">Materials</div>
            <p className="mt-1 text-white/80">{Object.values(materialDensities).map((item) => item.label).join(', ')}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-amber-300">Profiles</div>
            <p className="mt-1 text-white/80">{Object.values(shapeProfiles).map((item) => item.label).join(', ')}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-amber-300">Boundary</div>
            <p className="mt-1 text-white/80">Planning references only. Supplier quotes and qualified review decide final production choices.</p>
          </div>
        </div>
      </section>
    </ToolPageShell>
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
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              <Calculator size={14} className="text-[var(--color-primary)]" />
              Free industry calculator
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
              Related tools
            </div>
            <div className="mt-3 grid gap-2">
              {relatedTools.map((item) => (
                <a key={item.id} href={`/tools/${item.slug}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)]">
                  {item.label}
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
